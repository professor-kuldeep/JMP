import test,{before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
const db=new PGlite({extensions:{pgcrypto,btree_gist}}),sql=await fs.readFile(new URL('../supabase/migrations/20261028_experience_v9.sql',import.meta.url),'utf8');
const query=async(sql,values=[])=> (await db.query(sql,values)).rows;
const create=async(data={name:'Test Client',email:'client@example.test',message:'Help with GST',status:'new'},key=crypto.randomUUID(),jobs=[])=> (await query('select public.coretax_create_enquiry($1::jsonb,$2::uuid,$3,$4::jsonb) result',[JSON.stringify(data),key,JSON.stringify([data.name,data.email,data.message]),JSON.stringify(jobs)]))[0].result;
before(async()=>{
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,bucket_id text);");
 await db.exec(await fs.readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
 await db.exec(sql);await db.exec(sql);
});
beforeEach(async()=>{await db.exec('truncate public.cms_bookings,public.cms_jobs,public.cms_enquiries cascade;alter sequence public.cms_enquiries_id_seq restart with 1;');});
after(()=>db.close());
test('migration is additive and sensitive RPCs and tables are unavailable to browser roles',async()=>{
 for(const role of ['anon','authenticated']){assert.equal((await query("select has_function_privilege($1,'public.coretax_create_enquiry(jsonb,uuid,text,jsonb)','execute') allowed",[role]))[0].allowed,false);assert.equal((await query("select has_table_privilege($1,'public.cms_jobs','select') allowed",[role]))[0].allowed,false);}
 assert.equal((await query("select public from storage.buckets where id='cms-backups'"))[0].public,false);
});
test('atomic submissions have unique database IDs and retries create one enquiry and one outbox job',async()=>{
 const data={name:'Test',email:'a@example.test',message:'GST',status:'new'},key=crypto.randomUUID(),jobs=[{key:'test-mail',message:{to:['a@example.test'],text:'Saved'}}];
 const results=await Promise.all(Array.from({length:12},()=>create(data,key,jobs)));assert.equal(results.filter(r=>!r.duplicate).length,1);
 assert.equal((await query('select count(*)::int n from cms_enquiries'))[0].n,1);assert.equal((await query('select count(*)::int n from cms_jobs'))[0].n,1);
 await assert.rejects(()=>create({...data,message:'Changed'},key,jobs),/REQUEST_CONFLICT/);
 const independent=await Promise.all(Array.from({length:12},(_,i)=>create({...data,name:'Client '+i})));assert.equal(new Set(independent.map(r=>r.enquiry.id)).size,12);
});
test('failed outbox insertion rolls back the enquiry instead of saving an unnotifiable half-transaction',async()=>{
 await assert.rejects(()=>create(undefined,crypto.randomUUID(),[{message:{text:'No job key'}}]));
 assert.equal((await query('select count(*)::int n from cms_enquiries'))[0].n,0);
});
test('record-level updates preserve unrelated leads and reject stale editor versions',async()=>{
 const a=(await create()).enquiry,b=(await create({name:'Other',email:'b@example.test',message:'Tax'})).enquiry;
 const changed=(await query('select coretax_update_enquiry($1,$2::jsonb,$3,$4) result',[a.id,JSON.stringify({status:'client',notes:'Saved'}),a.updatedAt,'admin']))[0].result;
 assert.equal(changed.status,'client');assert.equal(changed.activity.length,1);
 await assert.rejects(()=>query('select coretax_update_enquiry($1,$2::jsonb,$3,$4)',[a.id,JSON.stringify({notes:'Stale'}),a.updatedAt,'other']),/STALE_VERSION/);
 assert.equal((await query('select data->>\'name\' name from cms_enquiries where id=$1',[b.id]))[0].name,'Other');
});
test('CRM filtering and pagination run in the database, including references and time-zone task boundaries',async()=>{
 const now=new Date('2030-01-01T20:00:00Z');
 for(let i=0;i<28;i++)await create({name:'GST Client '+i,email:`c${i}@example.test`,message:'GST support',status:i===0?'client':'new',assignedTo:i%2?'A':'B',service:'GST',followUpAt:i===0?'2030-01-02T00:00:00Z':'2030-01-01T21:00:00Z'});
 const filters={page:2,pageSize:10,status:'new',q:'GST',owner:'',service:'',task:'today',timeZone:'Asia/Kolkata'};
 const result=(await query('select coretax_query_enquiries($1::jsonb,48,$2) result',[JSON.stringify(filters),now.toISOString()]))[0].result;
 assert.equal(result.total,27);assert.equal(result.enquiries.length,10);assert.equal(result.summary.total,28);assert.equal(result.summary.stages.client,1);assert.equal(result.summary.today,27);
 const reference=(await query('select coretax_query_enquiries($1::jsonb,48,$2) result',[JSON.stringify({...filters,page:1,task:'all',q:'JMP-000002'}),now.toISOString()]))[0].result;assert.equal(reference.total,1);
});
test('queue claiming uses exclusive leases and does not give the same job to two workers',async()=>{
 await create(undefined,crypto.randomUUID(),[{key:'mail-1',message:{text:'One'}},{key:'mail-2',message:{text:'Two'}}]);
 const a=await query('select * from coretax_claim_jobs(1)'),b=await query('select * from coretax_claim_jobs(1)');assert.equal(a.length,1);assert.equal(b.length,1);assert.notEqual(a[0].id,b[0].id);assert.equal(a[0].attempts,1);assert.ok(a[0].claim_token);assert.equal((await query('select * from coretax_claim_jobs(10)')).length,0);
});
const reserve=async(start,end,replaces=null,event=null)=>{const id=crypto.randomUUID();return (await query('select coretax_reserve_booking($1,$2,$3,$4,$5,$6,$7::jsonb,$8) result',[id,'a'.repeat(64),'team@example.test',start,end,event||'jmp'+id.replaceAll('-',''),JSON.stringify({name:'Booking',email:'b@example.test',service:'GST',timeZone:'Asia/Kolkata',createdAt:new Date().toISOString()}),replaces]))[0].result;};
test('booking overlap is rejected by PostgreSQL and the failed reservation leaves no orphan lead',async()=>{
 await reserve('2030-01-02T04:00:00Z','2030-01-02T04:30:00Z');
 await assert.rejects(()=>reserve('2030-01-02T04:15:00Z','2030-01-02T04:45:00Z'),/exclusion constraint/);
 assert.equal((await query('select count(*)::int n from cms_enquiries'))[0].n,1);
 await reserve('2030-01-02T04:30:00Z','2030-01-02T05:00:00Z');assert.equal((await query('select count(*)::int n from cms_bookings'))[0].n,2);
});
test('rescheduling retains the old reservation until the replacement is confirmed',async()=>{
 const old=await reserve('2030-01-02T04:00:00Z','2030-01-02T04:30:00Z');await query('select coretax_confirm_booking($1)',[old.id]);
 const next=await reserve('2030-01-02T05:00:00Z','2030-01-02T05:30:00Z',old.id,old.calendar_event_id);
 assert.equal((await query('select status from cms_bookings where id=$1',[old.id]))[0].status,'confirmed');
 await query('select coretax_confirm_booking($1)',[next.id]);assert.equal((await query('select status from cms_bookings where id=$1',[old.id]))[0].status,'rescheduled');
 assert.equal((await query('select count(*)::int n from cms_enquiries'))[0].n,1);assert.equal((await query('select data->>\'bookingId\' id from cms_enquiries'))[0].id,next.id);
});
test('backup restoration is atomic, preserves sequence progress and holds email jobs for review',async()=>{
 await create(undefined,crypto.randomUUID(),[{key:'backup-mail',message:{text:'Saved'}}]);const snapshot=(await query('select coretax_backup_snapshot() result'))[0].result;
 await create({name:'Later client',email:'l@example.test',message:'Later'});await query('select coretax_restore_snapshot($1::jsonb)',[JSON.stringify(snapshot)]);
 assert.equal((await query('select count(*)::int n from cms_enquiries'))[0].n,1);assert.equal((await query('select state from cms_jobs'))[0].state,'failed');
 assert.ok((await create()).enquiry.id>2);
 const damaged=structuredClone(snapshot);delete damaged.tables.cms_pages;await assert.rejects(()=>query('select coretax_restore_snapshot($1::jsonb)',[JSON.stringify(damaged)]),/INCOMPLETE_BACKUP/);
 assert.equal((await query('select count(*)::int n from cms_enquiries'))[0].n,2);
});
test('maintenance lease prevents concurrent cleanup and backup workers',async()=>{
 await db.exec("delete from cms_integrations where id='operations_lease'");
 assert.equal((await query('select coretax_claim_maintenance($1) ok',[crypto.randomUUID()]))[0].ok,true);
 assert.equal((await query('select coretax_claim_maintenance($1) ok',[crypto.randomUUID()]))[0].ok,false);
});
test('cancellation blocks rescheduling and a pending reschedule blocks cancellation',async()=>{
 const first=await reserve('2030-01-02T04:00:00Z','2030-01-02T04:30:00Z');await query('select coretax_confirm_booking($1)',[first.id]);await query('select coretax_start_booking_cancel($1)',[first.id]);
 await assert.rejects(()=>reserve('2030-01-02T06:00:00Z','2030-01-02T06:30:00Z',first.id,first.calendar_event_id),/NOT_FOUND/);
 const second=await reserve('2030-01-03T04:00:00Z','2030-01-03T04:30:00Z');await query('select coretax_confirm_booking($1)',[second.id]);await reserve('2030-01-03T06:00:00Z','2030-01-03T06:30:00Z',second.id,second.calendar_event_id);await assert.rejects(()=>query('select coretax_start_booking_cancel($1)',[second.id]),/BOOKING_CHANGE_PENDING/);
});
test('the service role can execute transactional enquiry storage without browser privileges',async()=>{await db.exec('set role service_role');try{assert.ok((await create()).enquiry.reference.startsWith('JMP-'));}finally{await db.exec('reset role');}});
test('an expired fifth delivery lease becomes a reviewable failure',async()=>{await create(undefined,crypto.randomUUID(),[{key:'expired-worker',message:{text:'Test'}}]);await db.exec("update cms_jobs set state='processing',attempts=5,claimed_at=now()-interval '20 minutes'");await query('select * from coretax_claim_jobs(1)');assert.equal((await query('select state from cms_jobs'))[0].state,'failed');});
