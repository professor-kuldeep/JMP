import crypto from 'node:crypto';
import {after,NextResponse} from 'next/server';
import {getSettings} from '../../lib/store';
import {enquiryAutomation} from '../../lib/practice.mjs';
import {createEnquiry} from '../../lib/crm-store';
import {validateEnquiry,UUID} from '../../lib/crm.mjs';
import {enquiryMailPlans,mailConfiguration} from '../../lib/enquiry-mail.mjs';
import {processEmailQueue} from '../../lib/mail-queue';
import {apiError} from '../../lib/api-error';
import {checkContactRateLimit,getClientIp,verifyTurnstile,verifyRequestOrigin} from '../../lib/security';
import {normalizeAttribution,normalizeVisitEvent} from '../../lib/traffic.mjs';
import {recordVisitEvent} from '../../lib/insights-store';
import {recordOperation} from '../../lib/monitoring';
import {readJsonBody} from '../../lib/http-body.mjs';
export async function POST(request){
 try{
  if(!verifyRequestOrigin(request))return NextResponse.json({message:'Invalid request origin.'},{status:403});
  const payload=await readJsonBody(request);
  if(String(payload.website||'').trim())return NextResponse.json({success:true});
  const validation=validateEnquiry(payload);if(!validation.valid)return NextResponse.json({message:'Please check the highlighted fields.',errors:validation.errors},{status:400});
  if(!UUID.test(payload.requestKey||''))return NextResponse.json({message:'Refresh the form and try again.'},{status:400});
  const turnstile=await verifyTurnstile(payload.turnstileToken,request);if(!turnstile.ok)return NextResponse.json({message:'Security verification failed. Please try again.'},{status:403});
  const limit=await checkContactRateLimit(request);if(limit.unavailable)return NextResponse.json({message:'Form protection is temporarily unavailable. Please try again shortly.'},{status:503});
  if(!limit.allowed)return NextResponse.json({message:'Too many submissions. Please try again later.'},{status:429,headers:{'Retry-After':String(limit.retryAfter||600)}});
  const settings=await getSettings(),enquiry=enquiryAutomation({...validation.value,status:'new',notes:'',source:'Website Contact Form',createdAt:new Date().toISOString(),sourceIpHash:crypto.createHmac('sha256',process.env.ADMIN_SECRET||'local-dev-only').update(getClientIp(request)).digest('hex').slice(0,20)},settings);
  const attribution=settings.visitorTrackingEnabled!==false&&request.headers.get('dnt')!=='1'&&request.headers.get('sec-gpc')!=='1'?normalizeAttribution(payload.attribution):null;if(attribution)enquiry.attribution=attribution;
  const plans=mailConfiguration().configured?enquiryMailPlans({...enquiry,id:payload.requestKey},settings):[],saved=await createEnquiry(enquiry,payload.requestKey,plans);
  after(async()=>{
   if(attribution&&!saved.duplicate)try{await recordVisitEvent(normalizeVisitEvent({...attribution,id:crypto.randomUUID(),name:'generate_lead'},new Date(),true),settings.visitorRetentionDays);}catch{await recordOperation('analytics','LEAD_EVENT_UNAVAILABLE','warning');}
   try{await processEmailQueue(2);}catch{await recordOperation('mail','QUEUE_WORKER_UNAVAILABLE');}
  });
  return NextResponse.json({success:true,reference:saved.enquiry.reference,duplicate:saved.duplicate});
 }catch(error){return apiError(error,'Your enquiry could not be saved. Please try again.',{public:true});}
}
