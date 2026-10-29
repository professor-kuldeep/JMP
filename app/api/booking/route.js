import {readJsonBody} from '../../lib/http-body.mjs';
import {after,NextResponse} from 'next/server';
import {getSettings} from '../../lib/store';
import {createBooking} from '../../lib/booking-service';
import {checkContactRateLimit,verifyTurnstile,verifyRequestOrigin} from '../../lib/security';
import {processEmailQueue} from '../../lib/mail-queue';
import {normalizeAttribution,normalizeVisitEvent} from '../../lib/traffic.mjs';
import {recordVisitEvent} from '../../lib/insights-store';
import {apiError} from '../../lib/api-error';
export async function POST(request){try{if(!verifyRequestOrigin(request))return NextResponse.json({message:'Invalid request origin.'},{status:403});const payload=await readJsonBody(request,8000);if((await verifyTurnstile(payload.turnstileToken,request)).ok!==true)return NextResponse.json({message:'Complete the security verification.'},{status:403});const limit=await checkContactRateLimit(request);if(!limit.allowed)return NextResponse.json({message:'Too many requests. Please try again shortly.'},{status:429});const settings=await getSettings();if(request.headers.get('dnt')==='1'||request.headers.get('sec-gpc')==='1')delete payload.attribution;const result=await createBooking(settings,payload);after(async()=>{const attribution=settings.visitorTrackingEnabled!==false?normalizeAttribution(payload.attribution):null;if(attribution)try{await recordVisitEvent(normalizeVisitEvent({...attribution,id:result.booking.id,name:'generate_lead'},new Date(),true),settings.visitorRetentionDays);}catch{}try{await processEmailQueue(2);}catch{}});return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error,'The appointment could not be confirmed. Please try again or send an enquiry.',{public:true});}}
