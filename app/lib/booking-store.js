import crypto from 'node:crypto';
import {supabaseAdmin} from './supabase';
import {crmError,UUID} from './crm.mjs';
import {storageRequired} from './runtime-store';
export const tokenHash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
export async function readBooking(id,token,admin=false){if(!UUID.test(id||'')||(!admin&&!/^[\w-]{43}$/.test(token||'')))throw crmError('Booking not found or the management link has expired.',404);const db=supabaseAdmin();if(!db)throw storageRequired();const {data,error}=await db.from('cms_bookings').select('*').eq('id',id).maybeSingle();if(error)throw storageRequired(error);const provided=tokenHash(token),expected=data?.token_hash||'0'.repeat(64);if(!data||(!admin&&!crypto.timingSafeEqual(Buffer.from(provided),Buffer.from(expected))))throw crmError('Booking not found or the management link has expired.',404);return data;}
export async function bookingBusy(calendarId,start,end){const db=supabaseAdmin();if(!db)throw storageRequired();const {data,error}=await db.from('cms_bookings').select('start_at,end_at').eq('calendar_id',calendarId).in('status',['hold','confirmed','cancelling']).lt('start_at',end).gt('end_at',start);if(error)throw storageRequired(error);return(data||[]).map(r=>({start:r.start_at,end:r.end_at}));}
export async function reserveBooking(payload,details,config,replaces=null){
 const db=supabaseAdmin();if(!db)throw storageRequired();const id=payload.requestKey,eventId=replaces?.calendar_event_id||'jmp'+id.replaceAll('-','');
 const {data,error}=await db.rpc('coretax_reserve_booking',{p_id:id,p_token_hash:tokenHash(payload.manageToken),p_calendar:config.calendarId,p_start:payload.start,p_end:new Date(Date.parse(payload.start)+config.duration*60000).toISOString(),p_event:eventId,p_data:{...details,timeZone:config.timeZone,location:config.location},p_replaces:replaces?.id||null});
 if(error){if(['23P01','23505'].includes(error.code))throw crmError('This time was just reserved, or the request has already changed. Choose another time.',409);throw storageRequired(error);}return data;
}
export async function confirmBooking(id,plans=[]){const db=supabaseAdmin();if(!db)throw storageRequired();const {data,error}=await db.rpc('coretax_confirm_booking',{p_id:id,p_jobs:plans});if(error)throw storageRequired(error);return data;}
export async function cancelBookingRecord(id){const db=supabaseAdmin();if(!db)throw storageRequired();const {error}=await db.from('cms_bookings').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',id);if(error)throw storageRequired(error);}
export async function startBookingCancel(id){const db=supabaseAdmin();if(!db)throw storageRequired();const {data,error}=await db.rpc('coretax_start_booking_cancel',{p_id:id});if(error){if(error.code==='40001')throw crmError('An appointment change is still being checked. Please try again shortly.',409);throw storageRequired(error);}return data;}
