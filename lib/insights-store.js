import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {supabaseAdmin} from './supabase';
import {analyticsError} from './traffic.mjs';
const localEvents=path.join(process.cwd(),'data','visitor-events.json');
const localConnection=path.join(process.cwd(),'data','google-connection.json');
const production=()=>process.env.NODE_ENV==='production'||Boolean(process.env.VERCEL);
let writes=Promise.resolve(),lastPurge=0;
async function localRead(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function localWrite(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(value));await fs.rename(temp,file);}
function storageError(error){return analyticsError(['42P01','PGRST205'].includes(String(error?.code))?'Analytics tables are missing. Run supabase/migrations/20261028_visitor_analytics.sql.':'Analytics storage is unavailable. Check the Supabase configuration.',503,'ANALYTICS_STORAGE');}
export async function recordVisitEvent(event,retentionDays=90){
  const db=supabaseAdmin(),cutoff=new Date(Date.now()-Math.min(365,Math.max(30,Number(retentionDays)||90))*86400000).toISOString();
  if(db){const {error}=await db.from('cms_visit_events').upsert({id:event.id,event_name:event.name,path:event.path,visitor_id:event.visitorId,session_id:event.sessionId,occurred_at:event.occurredAt,data:event},{onConflict:'id',ignoreDuplicates:true});if(error)throw storageError(error);
    if(Date.now()-lastPurge>3600000){lastPurge=Date.now();const cleanup=await db.from('cms_visit_events').delete().lt('occurred_at',cutoff);if(cleanup.error)lastPurge=0;}return;
  }
  if(production())throw storageError();
  const job=writes.catch(()=>{}).then(async()=>{const events=await localRead(localEvents,[]);if(!events.some(item=>item.id===event.id))events.push(event);await localWrite(localEvents,events.filter(item=>item.occurredAt>=cutoff).slice(-50000));});writes=job;return job;
}
export async function readVisitEvents(range){
  const db=supabaseAdmin();
  if(!db){if(production())return {events:[],status:'setup_required',message:'Connect Supabase and run the analytics migration to store visits.',truncated:false};const events=(await localRead(localEvents,[])).filter(e=>e.occurredAt>=range.start&&e.occurredAt<range.end);return {events,status:'local',truncated:false};}
  const events=[],limit=50000;
  for(let offset=0;offset<limit;offset+=1000){const {data,error}=await db.from('cms_visit_events').select('data').gte('occurred_at',range.start).lt('occurred_at',range.end).order('occurred_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+999);if(error)return {events:[],status:'setup_required',message:storageError(error).message,truncated:false};events.push(...(data||[]).map(row=>row.data));if(!data||data.length<1000)return {events,status:'ready',truncated:false};}
  return {events,status:'ready',truncated:true,limit};
}
export async function clearVisitEvents(){const db=supabaseAdmin();if(db){const {error}=await db.from('cms_visit_events').delete().gte('occurred_at','1970-01-01');if(error)throw storageError(error);}else if(!production()){await writes.catch(()=>{});await localWrite(localEvents,[]);}else throw storageError();}
export async function readGoogleConnection(){const db=supabaseAdmin();if(!db)return production()?null:localRead(localConnection,null);const {data,error}=await db.from('cms_integrations').select('data').eq('id','google_reporting').maybeSingle();if(error)throw storageError(error);return data?.data||null;}
export async function saveGoogleConnection(data){const db=supabaseAdmin();if(db){const result=data?await db.from('cms_integrations').upsert({id:'google_reporting',data,updated_at:new Date().toISOString()}):await db.from('cms_integrations').delete().eq('id','google_reporting');if(result.error)throw storageError(result.error);}else if(!production())await localWrite(localConnection,data);else throw storageError();}
