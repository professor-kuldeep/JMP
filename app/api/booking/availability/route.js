import crypto from 'node:crypto';
import {NextResponse} from 'next/server';
import {getSettings} from '../../../lib/store';
import {getAvailableBookingSlots} from '../../../lib/booking-service';
import {rateLimit,getClientIp} from '../../../lib/security';
import {apiError} from '../../../lib/api-error';
export async function GET(request){try{const key=crypto.createHash('sha256').update(getClientIp(request)).digest('hex').slice(0,32),limit=await rateLimit('booking-slots:'+key,60,300);if(!limit.allowed)return NextResponse.json({message:'Please wait before checking more dates.'},{status:429});return NextResponse.json(await getAvailableBookingSlots(await getSettings(),new URL(request.url).searchParams.get('date')),{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error,'Available times could not be loaded. Please try again or send an enquiry.',{public:true});}}
