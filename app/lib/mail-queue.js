import crypto from 'node:crypto';
import {supabaseAdmin} from './supabase';
import {crmLocalMutate} from './crm-store';
import {isProduction,storageRequired} from './runtime-store';
import {recordOperation} from './monitoring';
export async function enqueueEmails(plans) {
 if(!plans.length)return;const db=supabaseAdmin();
 if(db){const {error}=await db.from('cms_jobs').upsert(plans.map(p=>({id:p.key,payload:p.message,context:p.context||{}})),{onConflict:'id',ignoreDuplicates:true});if(error)throw storageRequired(error);}
 else if(!isProduction())await crmLocalMutate(data=>{data.jobs||=[];for(const p of plans)if(!data.jobs.some(j=>j.id===p.key))data.jobs.push({id:p.key,payload:p.message,state:'pending',attempts:0,next_attempt_at:new Date().toISOString(),created_at:new Date().toISOString()});});else throw storageRequired();
}
export async function processEmailQueue(limit=5,fetcher=fetch,environment=process.env) {
 if(!environment.RESEND_API_KEY||!environment.ENQUIRY_EMAIL_FROM)return {sent:0,failed:0,skipped:true};
 const db=supabaseAdmin();let jobs;
 if(db){const {data,error}=await db.rpc('coretax_claim_jobs',{p_limit:limit});if(error)throw storageRequired(error);jobs=data||[];}
 else if(!isProduction())jobs=await crmLocalMutate(data=>{const due=(data.jobs||[]).filter(j=>j.attempts<5&&(j.state==='pending'&&j.next_attempt_at<=new Date().toISOString()||j.state==='processing'&&Date.parse(j.claimed_at)<Date.now()-600000)).slice(0,limit);for(const j of due)Object.assign(j,{state:'processing',attempts:j.attempts+1,claimed_at:new Date().toISOString(),claim_token:crypto.randomUUID()});return structuredClone(due);});else throw storageRequired();
 const result={sent:0,failed:0};
 for(const job of jobs){
  let ok=false;try{const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${environment.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':job.id},body:JSON.stringify({...job.payload,from:environment.ENQUIRY_EMAIL_FROM}),signal:AbortSignal.timeout(5000)});ok=response.ok;}catch{}
  const change={state:ok?'sent':job.attempts>=5?'failed':'pending',last_error:ok?'':'EMAIL_PROVIDER_UNAVAILABLE',next_attempt_at:new Date(Date.now()+Math.min(360,2**job.attempts)*60000).toISOString(),updated_at:new Date().toISOString()};
  if(db){const {error}=await db.from('cms_jobs').update(change).eq('id',job.id).eq('claim_token',job.claim_token);if(error)await recordOperation('mail','QUEUE_UPDATE_FAILED');}else await crmLocalMutate(data=>{const item=(data.jobs||[]).find(j=>j.id===job.id&&j.claim_token===job.claim_token);if(item)Object.assign(item,change);});
  result[ok?'sent':'failed']++;if(!ok)await recordOperation('mail','EMAIL_DELIVERY_FAILED','warning');
 }
 return result;
}
