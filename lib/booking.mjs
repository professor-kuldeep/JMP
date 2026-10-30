import {validTimeZone,dateKey,crmError,UUID} from './crm.mjs';
export const BOOKING_KEYS=['bookingEnabled','bookingCalendarId','bookingTimeZone','bookingDuration','bookingBuffer','bookingLeadHours','bookingWindowDays','bookingWeekdays','bookingDayStart','bookingDayEnd','bookingBlockedDates','bookingLocation','bookingTeam','bookingRemindersEnabled','bookingWaitlistEnabled'];
export function bookingTeam(settings={}) { return [{id:'default',name:'Team consultation'},...(Array.isArray(settings.bookingTeam)?settings.bookingTeam:[]).filter(s=>s.enabled!==false).map(s=>({id:s.id,name:s.name}))]; }
export function bookingConfig(settings={},staffId='default'){
 const staff=staffId==='default'?null:(Array.isArray(settings.bookingTeam)?settings.bookingTeam:[]).find(s=>s.id===staffId&&s.enabled!==false);
 if(staffId!=='default'&&!staff)throw crmError('This team member is unavailable. Choose another appointment.');
 return {enabled:settings.bookingEnabled===true,staffId,staffName:staff?.name||'Team consultation',calendarId:String(staff?.calendarId||settings.bookingCalendarId||'').trim(),timeZone:validTimeZone(settings.bookingTimeZone),duration:Number(settings.bookingDuration??30),buffer:Number(settings.bookingBuffer??15),leadHours:Number(settings.bookingLeadHours??24),windowDays:Number(settings.bookingWindowDays??30),weekdays:staff?.weekdays||settings.bookingWeekdays||[1,2,3,4,5],dayStart:staff?.dayStart||settings.bookingDayStart||'09:30',dayEnd:staff?.dayEnd||settings.bookingDayEnd||'17:30',blockedDates:[...(settings.bookingBlockedDates||[]),...(staff?.blockedDates||[])],location:String(settings.bookingLocation||'The team will confirm meeting details.').slice(0,300)};
}
export function validateBookingSettings(settings){
 const c=bookingConfig(settings);
 if(settings.bookingEnabled!=null&&typeof settings.bookingEnabled!=='boolean')throw crmError('Choose a valid booking on/off setting.');
 if(c.enabled&&!c.calendarId)throw crmError('Add your team calendar ID before enabling bookings.');
 if(c.calendarId.length>250||/[\s<>]/.test(c.calendarId))throw crmError('Enter a valid Google Calendar ID.');
 if(settings.bookingTimeZone&&c.timeZone!==settings.bookingTimeZone)throw crmError('Enter a valid IANA time zone.');
 for(const [value,min,max,label] of [[c.duration,15,120,'Duration'],[c.buffer,0,60,'Buffer'],[c.leadHours,1,720,'Minimum notice'],[c.windowDays,1,90,'Booking window']])if(!Number.isInteger(value)||value<min||value>max)throw crmError(`${label} is outside its supported range.`);
 if(!Array.isArray(c.weekdays)||!c.weekdays.length||c.weekdays.some(v=>!Number.isInteger(v)||v<0||v>6))throw crmError('Select at least one valid working day.');
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.dayStart)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.dayEnd)||c.dayEnd<=c.dayStart)throw crmError('Choose valid working hours with the end after the start.');
 if(!Array.isArray(c.blockedDates)||c.blockedDates.length>100||c.blockedDates.some(d=>!validDate(d)))throw crmError('Use YYYY-MM-DD for blocked dates.');
 if(!Array.isArray(settings.bookingTeam||[])||(settings.bookingTeam||[]).length>6)throw crmError('Configure up to six individual team calendars.');
 const seen=new Set();for(const staff of settings.bookingTeam||[]){
  if(!UUID.test(staff.id||'')||seen.has(staff.id)||typeof staff.name!=='string'||!staff.name.trim()||staff.name.length>100||!staff.calendarId||staff.calendarId.length>250||/[\s<>]/.test(staff.calendarId))throw crmError('Each team calendar needs a unique ID, display name and valid calendar ID.');
  seen.add(staff.id);
  validateBookingSettings({...settings,bookingTeam:[],bookingCalendarId:staff.calendarId,bookingWeekdays:staff.weekdays||c.weekdays,bookingDayStart:staff.dayStart||c.dayStart,bookingDayEnd:staff.dayEnd||c.dayEnd,bookingBlockedDates:staff.blockedDates||[]});
 }
 for(const key of ['bookingRemindersEnabled','bookingWaitlistEnabled'])if(settings[key]!=null&&typeof settings[key]!=='boolean')throw crmError('Choose valid appointment notification settings.');
 return c;
}
export function validDate(value){try{return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}catch{return false;}}
export function zonedDateTime(date,time,timeZone){
 const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number),target=Date.UTC(y,m-1,d,h,min);let guess=target;
 const formatter=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 for(let i=0;i<4;i++){const parts=Object.fromEntries(formatter.formatToParts(new Date(guess)).map(p=>[p.type,p.value])),represented=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute)),difference=target-represented;guess+=difference;if(!difference)return new Date(guess);}
 throw crmError('This local time is unavailable because of a clock change.');
}
export function candidateSlots(date,config,now=new Date()){
 if(!validDate(date))throw crmError('Choose a valid appointment date.');
 const today=dateKey(now,config.timeZone),last=dateKey(new Date(now.getTime()+config.windowDays*86400000),config.timeZone);
 if(date<today||date>last||config.blockedDates.includes(date)||!config.weekdays.includes(new Date(date+'T12:00:00Z').getUTCDay()))return [];
 const start=zonedDateTime(date,config.dayStart,config.timeZone),end=zonedDateTime(date,config.dayEnd,config.timeZone),slots=[];
 for(let t=start.getTime();t+config.duration*60000<=end.getTime();t+=(config.duration+config.buffer)*60000)if(t>=now.getTime()+config.leadHours*3600000)slots.push({start:new Date(t).toISOString(),end:new Date(t+config.duration*60000).toISOString()});
 return slots;
}
export function availableSlots(slots,busy=[],buffer=0){return slots.filter(s=>!busy.some(b=>Date.parse(s.start)<Date.parse(b.end)+buffer*60000&&Date.parse(s.end)+buffer*60000>Date.parse(b.start)));}
export function validateBookingPayload(payload){
 const name=String(payload.name||'').trim().slice(0,120),email=String(payload.email||'').trim().toLowerCase().slice(0,254),service=String(payload.service||'').trim().slice(0,160),phone=String(payload.phone||'').trim().slice(0,40);
 if(!name||!email||!service||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw crmError('Enter your name, a valid email address and the service you need.');
 if(!UUID.test(payload.requestKey||'')||!/^[a-zA-Z0-9_-]{43}$/.test(payload.manageToken||''))throw crmError('Refresh the booking form and try again.');
 if(!Number.isFinite(Date.parse(payload.start)))throw crmError('Choose an available time.');
 return {name,email,phone,service,message:'Consultation booking request',createdAt:new Date().toISOString()};
}
export function safeBooking(row){return {id:row.id,start:row.start_at,end:row.end_at,status:row.status,timeZone:row.data?.timeZone||'Asia/Kolkata',service:row.data?.service||'',location:row.data?.location||'',staffId:row.data?.staffId||'default',staffName:row.data?.staffName||'Team consultation',reference:row.enquiry_id?'JMP-'+String(row.enquiry_id).padStart(6,'0'):''};}
