import {bookingConfig,bookingTeam,candidateSlots,availableSlots,validateBookingPayload,safeBooking,validDate} from './booking.mjs';
import {enquiryAutomation} from './practice.mjs';
import {dateKey,crmError} from './crm.mjs';
import {calendarBusy,writeCalendarBooking,removeCalendarBooking,findCalendarEvent} from './calendar';
import {bookingBusy,reserveBooking,confirmBooking,readBooking,cancelBookingRecord,startBookingCancel} from './booking-store';
import {siteOrigin} from './seo.mjs';
import {enqueueEmails} from './mail-queue';
import {normalizeAttribution} from './traffic.mjs';
export async function getAvailableBookingSlots(settings,date,staffId='default'){
 const config=bookingConfig(settings,staffId);if(!config.enabled||!config.calendarId)throw crmError('Online booking is not available yet. Please send an enquiry.',503);
 const chosen=date||dateKey(new Date(Date.now()+config.leadHours*3600000),config.timeZone),slots=candidateSlots(chosen,config);
 const minDate=dateKey(new Date(),config.timeZone),maxDate=dateKey(new Date(Date.now()+config.windowDays*86400000),config.timeZone);
 const publicConfig={date:chosen,duration:config.duration,timeZone:config.timeZone,minDate,maxDate,location:config.location,staffId:config.staffId,staffName:config.staffName,team:bookingTeam(settings),waitlistEnabled:settings.bookingWaitlistEnabled===true};
 if(!slots.length)return {...publicConfig,slots:[]};
 const from=new Date(Date.parse(slots[0].start)-config.buffer*60000).toISOString(),until=new Date(Date.parse(slots.at(-1).end)+config.buffer*60000).toISOString();
 const [calendar,reserved]=await Promise.all([calendarBusy(config.calendarId,from,until),bookingBusy(config.calendarId,from,until)]);
 return {...publicConfig,slots:availableSlots(slots,[...calendar,...reserved],config.buffer)};
}
export async function getNextAvailableBookingSlots(settings, date, staffId='default') {
 const config=bookingConfig(settings,staffId),first=date||dateKey(new Date(Date.now()+config.leadHours*3600000),config.timeZone);
 if(!validDate(first))throw crmError('Choose a valid appointment date.');
 let checked=0,last=null;
 for(let offset=0;offset<14&&checked<3;offset++){
  const day=new Date(first+'T12:00:00Z');if(!Number.isFinite(day.getTime()))throw crmError('Choose a valid date.');day.setUTCDate(day.getUTCDate()+offset);const key=day.toISOString().slice(0,10);
  if(!candidateSlots(key,config).length)continue;
  last=await getAvailableBookingSlots(settings,key,staffId);checked++;if(last.slots.length)return {...last,earliestChecked:true};
 }
 return {...(last||await getAvailableBookingSlots(settings,first,staffId)),earliestChecked:true,noNextSlot:true};
}
export function bookingMailPlans(row,token,settings,event='confirmed'){
 if(!process.env.RESEND_API_KEY||!process.env.ENQUIRY_EMAIL_FROM)return [];
 const origin=siteOrigin(settings,process.env),manage=origin&&/^[\w-]{43}$/.test(token)?`${origin}/booking/manage#${row.id}.${token}`:'',time=new Date(row.start_at).toLocaleString('en-IN',{timeZone:row.data.timeZone,dateStyle:'full',timeStyle:'short'}),reference='JMP-'+String(row.enquiry_id).padStart(6,'0');
 return [{key:`booking-${row.id}-${event}`,context:{enquiryId:row.enquiry_id,reference},message:{from:process.env.ENQUIRY_EMAIL_FROM,to:[row.data.email],subject:`Consultation ${event} | ${settings.siteName||'JMP'}`,text:`Your consultation is ${event}.\n\nReference: ${reference}\nService: ${row.data.service}\nTime: ${time} (${row.data.timeZone})\n${row.data.location||''}\n\n${manage?'Manage, reschedule or cancel: '+manage:'Keep the management link shown on your booking confirmation.'}\n\nPlease use a suitable agreed channel for any sensitive documents.`}}];
}
export async function createBooking(settings,payload,replaces=null){
 const details=enquiryAutomation(validateBookingPayload(payload),settings),config=bookingConfig(settings,replaces?(replaces.data.staffId||'default'):(payload.staffId||'default')),attribution=normalizeAttribution(replaces?.data?.attribution||payload.attribution);
 details.staffId=config.staffId;details.staffName=config.staffName;
 if(replaces&&replaces.calendar_id!==config.calendarId)throw crmError('Contact the team to move an appointment whose calendar has changed.',409);
 if(settings.visitorTrackingEnabled!==false&&attribution)details.attribution=attribution;
 if(!config.enabled||!config.calendarId)throw crmError('Online booking is not available. Please send an enquiry.',503);
 // A retry can complete an existing reservation without mistaking its own hold for a conflict.
 let previous=null;try{previous=await readBooking(payload.requestKey,payload.manageToken);}catch(error){if(error.status!==404)throw error;}
 if(previous){if(previous.calendar_id!==config.calendarId||Date.parse(previous.start_at)!==Date.parse(payload.start)||['cancelled','rescheduled','cancelling'].includes(previous.status)||['name','email','phone','service'].some(k=>(previous.data[k]||'')!==(details[k]||'')))throw crmError('This request has already changed. Keep the original details when retrying, or contact the team.',409);if(previous.status==='confirmed')return {booking:safeBooking(previous),manageToken:payload.manageToken,duplicate:true};}
 if(!previous){const date=dateKey(new Date(payload.start),config.timeZone),availability=await getAvailableBookingSlots(settings,date,config.staffId);if(!availability.slots.some(s=>Date.parse(s.start)===Date.parse(payload.start)))throw crmError('This time is no longer available. Please choose another.',409);}
 const row=previous||await reserveBooking(payload,details,config,replaces);
 await writeCalendarBooking(row,Boolean(row.replaces_id));
 const booking=await confirmBooking(row.id,bookingMailPlans(row,payload.manageToken,settings,row.replaces_id?'rescheduled':'confirmed'));
 return {booking:safeBooking(booking),manageToken:payload.manageToken,duplicate:false};
}
export async function cancelBooking(settings,row,token=''){
 if(row.status==='cancelled')return safeBooking(row);
 if(row.status==='rescheduled')throw crmError('This appointment was rescheduled. Use your newest management link.',409);
 await startBookingCancel(row.id);await removeCalendarBooking(row);await cancelBookingRecord(row.id);
 if(token)await enqueueEmails(bookingMailPlans(row,token,settings,'cancelled'));
 return safeBooking({...row,status:'cancelled'});
}
export async function reconcileBookingHolds(settings={}){
 const {supabaseAdmin}=await import('./supabase');const db=supabaseAdmin();if(!db)return {checked:0};
 const {data,error}=await db.from('cms_bookings').select('*').in('status',['hold','cancelling']).lt('updated_at',new Date(Date.now()-600000).toISOString()).limit(10);if(error)throw error;
 for(const row of data||[]){const event=await findCalendarEvent(row);if(row.status==='cancelling'){if(event)await removeCalendarBooking(row);await cancelBookingRecord(row.id);await enqueueEmails(bookingMailPlans(row,'',settings,'cancelled'));}else if(event&&Date.parse(event.start?.dateTime)===Date.parse(row.start_at))await confirmBooking(row.id,bookingMailPlans(row,'',settings,row.replaces_id?'rescheduled':'confirmed'));else if(!event)await cancelBookingRecord(row.id);}
 return {checked:data?.length||0};
}
