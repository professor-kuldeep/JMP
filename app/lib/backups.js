import crypto from 'node:crypto';
import {supabaseAdmin,mediaBucket} from './supabase';
import {backupKey,encryptBackup,decryptBackup} from './backup-crypto.mjs';
import {storageRequired} from './runtime-store';
import {crmError} from './crm.mjs';
import {recordOperation} from './monitoring';
const BUCKET='cms-backups',sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const safePath=value=>typeof value==='string'&&value.length<1000&&!value.startsWith('/')&&!value.split('/').some(p=>p==='..'||p==='.')&&!/[\u0000-\u001f\\]/.test(value);
const database=()=>{const db=supabaseAdmin();if(!db)throw storageRequired();return db;};
export function backupEnvironment(){try{backupKey();return {configured:true,bucket:BUCKET};}catch{return {configured:false,bucket:BUCKET};}}
export async function listBackups(){const {data,error}=await database().from('cms_backups').select('id,state,data,created_at,updated_at').order('created_at',{ascending:false}).limit(10);if(error)throw storageRequired(error);return(data||[]).map(({data,...row})=>({...row,copied:data.cursor||0,total:data.files?.length||0,externalMedia:data.externalMedia||0,bytes:data.bytes||0,message:data.message||''}));}
export async function startBackup(){
 backupKey();const db=database(),id=crypto.randomUUID();const {data:snapshot,error}=await db.rpc('coretax_backup_snapshot');if(error)throw storageRequired(error);
 const files=[],external=[];
 for(const row of snapshot.tables.cms_media||[]){const item=row.data||{};if(item.storagePath&&item.bucket===mediaBucket()&&safePath(item.storagePath))files.push({bucket:item.bucket,path:item.storagePath,target:id+'/media/'+files.length});else if(item.url)external.push(item.id);}
 const payload={schemaVersion:9,createdAt:new Date().toISOString(),snapshot};if(Buffer.byteLength(JSON.stringify(payload))>80*1024*1024)throw crmError('The application snapshot is too large. Use a managed database backup.',413);const bytes=encryptBackup(payload),databasePath=id+'/database.enc';
 if(bytes.length>50*1024*1024)throw crmError('This backup exceeds the application export limit. Use a managed database backup.',413);
 const uploaded=await db.storage.from(BUCKET).upload(databasePath,bytes,{contentType:'application/octet-stream',upsert:false});if(uploaded.error)throw storageRequired(uploaded.error);
 const data={databasePath,databaseHash:sha(bytes),files,cursor:0,externalMedia:external.length,bytes:bytes.length};
 const inserted=await db.from('cms_backups').insert({id,state:'pending',data});if(inserted.error)throw storageRequired(inserted.error);return {id};
}
export async function continueBackup(id){
 const db=database(),token=crypto.randomUUID(),now=new Date().toISOString();
 const claimed=await db.from('cms_backups').update({lease_token:token,lease_until:new Date(Date.now()+180000).toISOString(),state:'processing'}).eq('id',id).in('state',['pending','processing']).or('lease_until.is.null,lease_until.lt.'+now).select('*').maybeSingle();if(claimed.error)throw storageRequired(claimed.error);if(!claimed.data)return {busy:true};
 const data=claimed.data.data;
 try{
  let processed=0;while(data.cursor<data.files.length&&processed<5){const file=data.files[data.cursor];if(!safePath(file.path)||file.bucket!==mediaBucket())throw new Error();const source=await db.storage.from(file.bucket).download(file.path);if(source.error)throw source.error;const bytes=Buffer.from(await source.data.arrayBuffer()),upload=await db.storage.from(BUCKET).upload(file.target,bytes,{contentType:'application/octet-stream',upsert:true});if(upload.error)throw upload.error;file.hash=sha(bytes);file.size=bytes.length;data.bytes+=bytes.length;data.cursor++;processed++;}
  const complete=data.cursor===data.files.length;
  const updated=await db.from('cms_backups').update({state:complete?'complete':'pending',data,lease_token:null,lease_until:null,updated_at:new Date().toISOString()}).eq('id',id).eq('lease_token',token);if(updated.error)throw updated.error;return {complete,copied:data.cursor,total:data.files.length};
 }catch{await db.from('cms_backups').update({state:'failed',data:{...data,message:'Backup could not finish. Check storage access and retry with a new snapshot.'},lease_token:null,lease_until:null}).eq('id',id).eq('lease_token',token);await recordOperation('backup','BACKUP_FAILED');throw crmError('The backup did not finish. No completed backup was replaced.',503);}
}
async function loadVerifiedBackup(id){
 const db=database(),{data:record,error}=await db.from('cms_backups').select('*').eq('id',id).eq('state','complete').maybeSingle();if(error)throw storageRequired(error);if(!record)throw crmError('Choose a completed backup.',400);
 const file=await db.storage.from(BUCKET).download(record.data.databasePath);if(file.error)throw storageRequired(file.error);const bytes=Buffer.from(await file.data.arrayBuffer());if(sha(bytes)!==record.data.databaseHash)throw crmError('The database backup failed its integrity check.',400);
 const payload=decryptBackup(bytes);if(payload.schemaVersion!==9||payload.snapshot?.schemaVersion!==9||!payload.snapshot.tables)throw crmError('This backup format cannot be restored.',400);
 return {db,record,payload};
}
export async function inspectBackup(id){const {payload,record,db}=await loadVerifiedBackup(id);for(const row of payload.snapshot.tables.cms_profiles||[]){const user=await db.auth.admin.getUserById(row.user_id);if(user.error||!user.data.user)throw crmError('This backup contains accounts that are missing from this project. Restore the Supabase Auth database backup first.',409);}for(const file of record.data.files){if(!safePath(file.target)||!safePath(file.path)||file.bucket!==mediaBucket())throw crmError('The media manifest is invalid.',400);const source=await db.storage.from(BUCKET).download(file.target);if(source.error)throw storageRequired(source.error);if(sha(Buffer.from(await source.data.arrayBuffer()))!==file.hash)throw crmError('A media file failed its integrity check. This backup cannot be restored.',400);}return {id,createdAt:payload.createdAt,rows:Object.fromEntries(Object.entries(payload.snapshot.tables).map(([name,rows])=>[name,rows.length])),media:record.data.files.length,externalMedia:record.data.externalMedia||0,verified:true};}
export async function restoreBackup(id){
 await inspectBackup(id);const {db,record,payload}=await loadVerifiedBackup(id);
 for(const file of record.data.files){if(file.bucket!==mediaBucket()||!safePath(file.path)||!safePath(file.target))throw crmError('The media manifest is invalid.',400);const source=await db.storage.from(BUCKET).download(file.target);if(source.error)throw storageRequired(source.error);const bytes=Buffer.from(await source.data.arrayBuffer());if(sha(bytes)!==file.hash)throw crmError('A media file failed its integrity check. Restoration stopped.',400);const original=(payload.snapshot.tables.cms_media||[]).find(r=>r.data?.storagePath===file.path)?.data;const restored=await db.storage.from(file.bucket).upload(file.path,bytes,{contentType:original?.type||'application/octet-stream',upsert:true});if(restored.error)throw storageRequired(restored.error);}
 const {error}=await db.rpc('coretax_restore_snapshot',{p_snapshot:payload.snapshot});if(error)throw storageRequired(error);await recordOperation('backup','BACKUP_RESTORED','info',id);return {restored:true,signInAgain:true};
}
export async function purgeOldBackups(){const db=database(),{data,error}=await db.from('cms_backups').select('id,data').lt('created_at',new Date(Date.now()-14*86400000).toISOString()).not('state','in','(pending,processing)');if(error)throw error;const newest=await db.from('cms_backups').select('id').eq('state','complete').order('created_at',{ascending:false}).limit(1);if(newest.error)throw newest.error;const keep=newest.data?.[0]?.id;for(const row of data||[]){if(row.id===keep)continue;const paths=[row.data.databasePath,...(row.data.files||[]).map(f=>f.target)].filter(Boolean);for(let i=0;i<paths.length;i+=100){const removed=await db.storage.from(BUCKET).remove(paths.slice(i,i+100));if(removed.error)throw removed.error;}const deleted=await db.from('cms_backups').delete().eq('id',row.id);if(deleted.error)throw deleted.error;}}
