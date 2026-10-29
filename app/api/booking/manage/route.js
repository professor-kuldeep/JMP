import {readJsonBody} from '../../../lib/http-body.mjs';
import crypto from 'node:crypto';
import {after,NextResponse} from 'next/server';
import {getSettings} from '../../../lib/store';
import {readBooking} from '../../../lib/booking-store';
import {safeBooking} from '../../../lib/booking.mjs';
import {createBooking,cancelBooking} from '../../../lib/booking-service';
import {rateLimit,getClientIp,verifyRequestOrigin} from '../../../lib/security';
import {processEmailQueue} from '../../../lib/mail-queue';
import {apiError} from '../../../lib/api-error';
export async function POST(request){try{
 if(!verifyRequestOrigin(request))return NextResponse.json({message:'Invalid request origin.'},{status:403});const payload=await readJsonBody(request,8000),key=crypto.createHash('sha256').update(getClientIp(request)).digest('hex').slice(0,32),limit=await rateLimit('booking-manage:'+key,30,600);if(!limit.allowed)return NextResponse.json({message:'Too many requests. Please wait before trying again.'},{status:429});
 const row=await readBooking(payload.id,payload.token),settings=await getSettings();let result;
 if(payload.action==='read')result={booking:safeBooking(row)};
 else if(payload.action==='cancel')result={booking:await cancelBooking(settings,row,payload.token)};
 else if(payload.action==='reschedule'){
  let retry=null;try{retry=await readBooking(payload.requestKey,payload.manageToken);}catch(e){if(e.status!==404)throw e;}
  if(retry?.status==='confirmed'&&retry.replaces_id===row.id)result={booking:safeBooking(retry),manageToken:payload.manageToken};
  else {
  if(row.status!=='confirmed')return NextResponse.json({message:'Only a confirmed consultation can be rescheduled.'},{status:409});
  if(Date.parse(row.start_at)<=Date.now())return NextResponse.json({message:'Contact the team to change a past appointment.'},{status:409});
  result=await createBooking(settings,{...payload,name:row.data.name,email:row.data.email,phone:row.data.phone,service:row.data.service},row);
  }
 }else return NextResponse.json({message:'Invalid booking action.'},{status:400});
 after(async()=>{try{await processEmailQueue(2);}catch{}});return NextResponse.json(result,{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}catch(error){return apiError(error,'The booking could not be updated. Please try again.',{public:true});}}
