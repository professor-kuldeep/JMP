import crypto from 'node:crypto';
import {supabaseAdmin} from './supabase';
import {getSettings} from './store';
import {processEmailQueue} from './mail-queue';
import {recordOperation} from './monitoring';
import {backupEnvironment,listBackups,startBackup,continueBackup,purgeOldBackups} from './backups';
import {calendarEnvironment} from './calendar';
import {reconcileBookingHolds} from './booking-service';
import {storageRequired} from './runtime-store';
export async function operationStatus(){
 const db=supabaseAdmin(),environment={calendar:calendarEnvironment(),backups:backupEnvironment(),mail:Boolean(process.env.RESEND_API_KEY&&process.env.ENQUIRY_EMAIL_FROM),scheduler:Boolean(process.env.CRON_SECRET)};
 if(!db)return {ready:false,environment,queue:{pending:0,processing:0,sent:0,failed:0},jobs:[],events:[],backups:[],lastRun:null,message:'Connect Supabase and run the v9 migration to enable operations.'};
 const [counts,events,backups,lastRun,jobs]=await Promise.all([
  Promise.all(['pending','processing','sent','failed'].map(async state=>{const {count,error}=await db.from('cms_jobs').select('id',{count:'exact',head:true}).eq('state',state);if(error)throw storageRequired(error);return [state,count||0];})),
  db.from('cms_operations_events').select('*').order('at',{ascending:false}).limit(15),listBackups(),db.from('cms_integrations').select('data').eq('id','operations_last_run').maybeSingle(),db.from('cms_jobs').select('id,state,attempts,last_error,created_at,context,subject:payload->>subject').in('state',['pending','processing','failed']).order('created_at',{ascending:false}).limit(25)
 ]);if(events.error||lastRun.error||jobs.error)throw storageRequired(events.error||lastRun.error||jobs.error);
 return {ready:true,environment,queue:Object.fromEntries(counts),jobs:jobs.data||[],events:events.data||[],backups,lastRun:lastRun.data?.data||null};
}
export async function cleanupRetention(settings){
 const db=supabaseAdmin();if(!db)throw storageRequired();const cutoff=days=>new Date(Date.now()-days*86400000).toISOString(),enquiryDays=Math.min(3650,Math.max(30,Number(settings.enquiryRetentionDays)||365)),visitDays=Math.min(365,Math.max(30,Number(settings.visitorRetentionDays)||90));
 const results=await Promise.all([
  db.from('cms_enquiries').delete().lt('created_at',cutoff(enquiryDays)),db.from('cms_visit_events').delete().lt('occurred_at',cutoff(visitDays)),
  db.from('cms_jobs').delete().lt('created_at',cutoff(7)),db.from('cms_operations_events').delete().lt('at',cutoff(30)),db.from('cms_audit_logs').delete().lt('at',cutoff(90)),
  db.from('cms_bookings').delete().lt('end_at',cutoff(enquiryDays)),db.from('cms_rate_limits').delete().lt('expires_at',new Date().toISOString()),db.from('cms_totp_uses').delete().lt('expires_at',new Date().toISOString()),db.from('cms_admin_sessions').delete().lt('absolute_expires_at',cutoff(7))
 ]);if(results.some(r=>r.error))throw storageRequired(results.find(r=>r.error).error);return {enquiryDays,visitDays};
}
export async function runMaintenance(){
 const db=supabaseAdmin();if(!db)throw storageRequired();const token=crypto.randomUUID(),claimed=await db.rpc('coretax_claim_maintenance',{p_token:token});if(claimed.error)throw storageRequired(claimed.error);if(!claimed.data)return {busy:true};
 const startedAt=new Date().toISOString(),result={startedAt,mail:null,cleanup:null,booking:null,backup:null,errors:[]};
 try{const settings=await getSettings();
  for(const [name,run] of [['mail',()=>processEmailQueue(10)],['cleanup',()=>cleanupRetention(settings)],['booking',()=>calendarEnvironment().configured?reconcileBookingHolds(settings):{skipped:true}],['backup',async()=>{if(!backupEnvironment().configured)return {setupRequired:true};let backups=await listBackups(),pending=backups.find(b=>['pending','processing'].includes(b.state));if(!pending&&!backups.some(b=>b.state==='complete'&&Date.parse(b.created_at)>Date.now()-86400000)){pending=await startBackup();}const value=pending?await continueBackup(pending.id):{current:true};await purgeOldBackups();return value;}]]){try{result[name]=await run();}catch{result.errors.push(name);await recordOperation(name,'MAINTENANCE_FAILED');}}
  result.finishedAt=new Date().toISOString();await db.from('cms_integrations').upsert({id:'operations_last_run',data:result,updated_at:result.finishedAt});return result;
 }finally{await db.from('cms_integrations').delete().eq('id','operations_lease').eq('data->>token',token);}
}
