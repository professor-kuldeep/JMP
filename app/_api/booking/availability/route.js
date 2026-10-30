import crypto from 'node:crypto';
import {NextResponse} from 'next/server';
import {getSettings} from '../../../lib/store';
import {getAvailableBookingSlots,getNextAvailableBookingSlots} from '../../../lib/booking-service';
import {rateLimit,getClientIp} from '../../../lib/security';
import {apiError} from '../../../lib/api-error';
export async function GET(request){
 try{
  const query=new URL(request.url).searchParams,next=query.get('next')==='1',key=crypto.createHash('sha256').update(getClientIp(request)).digest('hex').slice(0,32),limit=await rateLimit((next?'booking-next:':'booking-slots:')+key,next?10:60,300);
  if(!limit.allowed)return NextResponse.json({message:'Please wait before checking more dates.'},{status:limit.unavailable?503:429});
  const settings=await getSettings(),result=await(next?getNextAvailableBookingSlots:getAvailableBookingSlots)(settings,query.get('date'),query.get('staff')||'default');
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error,'Available times could not be loaded. Please try again or send an enquiry.',{public:true});}
}
