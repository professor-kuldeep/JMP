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
 const result={sent:0,failed:0};let notificationSettings=null;
 for(const job of jobs){
  if(db&&(job.context?.bookingReminderId||job.context?.practiceClientId||job.context?.availabilityNotification)){
   let skip=false;
   if(job.context.bookingReminderId){const {data,error}=await db.from('cms_bookings').select('status,start_at').eq('id',job.context.bookingReminderId).maybeSingle();if(error)throw storageRequired(error);skip=!data||data.status!=='confirmed'||Date.parse(data.start_at)<=Date.now()||Date.parse(data.start_at)!==Date.parse(job.context.bookingStart);}
   if(!skip&&job.context.practiceClientId){const {data,error}=await db.from('cms_practice_clients').select('active').eq('id',job.context.practiceClientId).maybeSingle();if(error)throw storageRequired(error);skip=!data?.active;}
   if(!skip&&job.context.practiceTaskId){const {data,error}=await db.from('cms_practice_items').select('data,parent_id').eq('id',job.context.practiceTaskId).maybeSingle();if(error)throw storageRequired(error);skip=!data||!data.data.clientVisible||!data.data.remindClient||['completed','approved','submitted'].includes(data.data.status)||data.data.dueDate!==job.context.taskDue;if(!skip&&data.parent_id){const parent=await db.from('cms_practice_items').select('data').eq('id',data.parent_id).maybeSingle();if(parent.error)throw storageRequired(parent.error);skip=['completed','on_hold'].includes(parent.data?.data?.status);}}
   if(!skip&&job.context.availabilityNotification){const {data,error}=await db.from('cms_booking_waitlist').select('status').eq('id',job.context.waitlistId).maybeSingle();if(error)throw storageRequired(error);skip=!data||data.status!=='notified';}
   if(!skip&&(job.context.bookingReminderId||job.context.practiceTaskId||job.context.availabilityNotification)){
    if(!notificationSettings){const {data,error}=await db.from('cms_settings').select('data').eq('id',1).maybeSingle();if(error)throw storageRequired(error);notificationSettings=data?.data||{};}
    if(job.context.bookingReminderId&&!notificationSettings.bookingRemindersEnabled)skip=true;
    if(job.context.practiceTaskId&&(!notificationSettings.practiceRemindersEnabled||!notificationSettings.clientPortalEnabled))skip=true;
    if(job.context.availabilityNotification&&(!notificationSettings.bookingEnabled||!notificationSettings.bookingWaitlistEnabled))skip=true;
   }
   if(skip){const {error}=await db.from('cms_jobs').update({state:'skipped',last_error:'NOTIFICATION_SUPERSEDED',updated_at:new Date().toISOString()}).eq('id',job.id).eq('claim_token',job.claim_token);if(error)throw storageRequired(error);result.skipped=(result.skipped||0)+1;continue;}
  }
  let ok=false;try{const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${environment.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':job.id},body:JSON.stringify({...job.payload,from:environment.ENQUIRY_EMAIL_FROM}),signal:AbortSignal.timeout(5000)});ok=response.ok;}catch{}
  const change={state:ok?'sent':job.attempts>=5?'failed':'pending',last_error:ok?'':'EMAIL_PROVIDER_UNAVAILABLE',next_attempt_at:new Date(Date.now()+Math.min(360,2**job.attempts)*60000).toISOString(),updated_at:new Date().toISOString()};
  if(db){const {error}=await db.from('cms_jobs').update(change).eq('id',job.id).eq('claim_token',job.claim_token);if(error)await recordOperation('mail','QUEUE_UPDATE_FAILED');}else await crmLocalMutate(data=>{const item=(data.jobs||[]).find(j=>j.id===job.id&&j.claim_token===job.claim_token);if(item)Object.assign(item,change);});
  result[ok?'sent':'failed']++;if(!ok)await recordOperation('mail','EMAIL_DELIVERY_FAILED','warning');
 }
 return result;
}
