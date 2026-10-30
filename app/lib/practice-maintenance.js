import crypto from 'node:crypto';
import {practiceDb, practiceResult, clientMailPlan, portalUrl} from './practice-store';
import {enqueueEmails} from './mail-queue';
import {dateKey, crmError, UUID} from './crm.mjs';
import {normalizeEmail, validEmail, validDate, text} from './practice.mjs';
import {bookingConfig} from './booking.mjs';
import {getAvailableBookingSlots} from './booking-service';
import {portalHash} from './portal-auth';

export async function joinAppointmentWaitlist(payload, settings) {
 if (!settings.bookingEnabled || !settings.bookingWaitlistEnabled) throw crmError('The appointment waiting list is unavailable. Please contact the team.', 503);
 const email = normalizeEmail(payload.email), name = text(payload.name, 120), service = text(payload.service, 160), date = payload.date, config = bookingConfig(settings, payload.staffId || 'default');
 const first = dateKey(new Date(), config.timeZone), last = dateKey(new Date(Date.now() + config.windowDays * 86400000), config.timeZone);
 if (!name || !validEmail(email) || !service || !UUID.test(payload.requestId || '') || !validDate(date) || date < first || date > last || payload.consent !== true) throw crmError('Enter your name, email, service and a date within the booking window, and allow a waiting-list email.');
 const origin = new URL(portalUrl(settings)).origin, token = crypto.randomBytes(32).toString('hex'), dedupe = portalHash(email + '|' + date + '|' + config.staffId), db = practiceDb();
 if (!process.env.RESEND_API_KEY || !process.env.ENQUIRY_EMAIL_FROM) throw crmError('Waiting-list email is unavailable. Please contact the team.', 503);
 return practiceResult(db.rpc('coretax_join_waitlist', {p_id: payload.requestId, p_dedupe: dedupe, p_token_hash: portalHash(token), p_data: {name, email, service, date, staffId: config.staffId, staffName: config.staffName}, p_message: {from: process.env.ENQUIRY_EMAIL_FROM, to: [email], subject: 'Your consultation waiting-list request', text: `Your request for ${date} has been saved. We will email if a time becomes available. A notification does not reserve an appointment.\n\nLeave the waiting list: ${origin}/waitlist#${payload.requestId}.${token}`}}));
}
export async function cancelAppointmentWaitlist(payload) {
 if (!UUID.test(payload.id || '') || !/^[a-f0-9]{64}$/.test(payload.token || '')) throw crmError('This waiting-list link is invalid.', 404);
 const row = await practiceResult(practiceDb().from('cms_booking_waitlist').select('id,token_hash').eq('id', payload.id).maybeSingle());
 const expected = Buffer.from(row?.token_hash || '0'.repeat(64)), actual = Buffer.from(portalHash(payload.token));
 if (!row || !crypto.timingSafeEqual(expected, actual)) throw crmError('This waiting-list link is invalid.', 404);
 await practiceResult(practiceDb().from('cms_booking_waitlist').update({status: 'cancelled', updated_at: new Date().toISOString()}).eq('id', row.id));
 return {cancelled: true};
}
export async function runPracticeMaintenance(settings) {
 const db = practiceDb(), now = new Date(), today = dateKey(now, 'Asia/Kolkata'), tomorrow = dateKey(new Date(now.getTime() + 86400000), 'Asia/Kolkata');
 await practiceResult(db.from('cms_portal_sessions').delete().lt('idle_expires_at', now.toISOString()));
 await practiceResult(db.from('cms_booking_waitlist').update({status: 'expired'}).eq('status', 'waiting').lt('expires_at', now.toISOString()));
 await practiceResult(db.from('cms_booking_waitlist').update({status:'expired'}).eq('status','waiting').lt('data->>date',today));
 await practiceResult(db.from('cms_booking_waitlist').delete().lt('created_at',new Date(now.getTime()-90*86400000).toISOString()));
 const plans = [], result = {taskNotifications: 0, bookingReminders: 0, waitingListNotifications: 0};
 if (!process.env.RESEND_API_KEY || !process.env.ENQUIRY_EMAIL_FROM) return {...result, mailSetupRequired: true};
 if (settings.practiceRemindersEnabled) {
  const tasks = await practiceResult(db.rpc('coretax_due_practice_notifications',{p_today:today,p_until:tomorrow,p_limit:200}));
  for (const task of tasks) {
   if (['completed', 'approved', 'submitted'].includes(task.data.status)) continue;
   const client = task.client;
   plans.push(clientMailPlan(client, `practice-due-${task.id}-${task.data.dueDate}-${today}`, `A client workspace step needs attention | ${settings.siteName || 'JMP'}`, `A preparation step is due ${task.data.dueDate}. Sign in to your client workspace for the details and any document requests.\n\n${portalUrl(settings)}`,{practiceTaskId:task.id,taskDue:task.data.dueDate})); result.taskNotifications++;
  }
  const recipient = normalizeEmail(process.env.ENQUIRY_EMAIL_TO || settings.notificationEmail || settings.email);
  if (validEmail(recipient)) {
   const overdue = await practiceResult(db.rpc('coretax_query_enquiries', {p_filter: {q: '', status: 'all', owner: '', service: '', task: 'overdue', page: 1, pageSize: 1, timeZone: 'Asia/Kolkata'}, p_hours: Number(settings.followUpHours) || 48, p_now: now.toISOString()}));
   if (overdue.summary?.overdue) plans.push({key: 'practice-overdue-leads-' + today, message: {from: process.env.ENQUIRY_EMAIL_FROM, to: [recipient], subject: 'CRM follow-ups need attention', text: `${overdue.summary.overdue} enquiries have an overdue suggested or scheduled follow-up. Review the CRM Follow-ups section and assign the next action.`}});
  }
 }
 if (settings.bookingRemindersEnabled) {
  const rows = await practiceResult(db.rpc('coretax_due_booking_reminders',{p_now:now.toISOString(),p_limit:100}));
  for (const row of rows) {
   const time = new Date(row.start_at).toLocaleString('en-IN', {timeZone: row.data.timeZone, dateStyle: 'full', timeStyle: 'short'});
   plans.push({key: `booking-reminder-${row.id}`, context: {bookingReminderId: row.id, bookingStart: row.start_at}, message: {from: process.env.ENQUIRY_EMAIL_FROM, to: [row.data.email], subject: 'Your consultation is coming up', text: `Your confirmed consultation is scheduled for ${time} (${row.data.timeZone}).\n\n${row.data.location || ''}\n\nUse the private management link from your confirmation to reschedule or cancel.`}}); result.bookingReminders++;
  }
 }
 if (settings.bookingEnabled && settings.bookingWaitlistEnabled) {
  const waiting = await practiceResult(db.from('cms_booking_waitlist').select('*').eq('status', 'waiting').gt('expires_at', now.toISOString()).order('checked_at',{ascending:true,nullsFirst:true}).order('created_at').limit(30)), availability = new Map();
  // Check at most one calendar/date per run to keep the Hobby function bounded.
  const first = waiting.find(w => w.data.date >= today), key = first ? first.data.staffId + '|' + first.data.date : '';
  if (first) { try { availability.set(key, await getAvailableBookingSlots(settings, first.data.date, first.data.staffId)); } catch {} }
  if(first)await practiceResult(db.from('cms_booking_waitlist').update({checked_at:now.toISOString()}).eq('status','waiting').eq('data->>staffId',first.data.staffId).eq('data->>date',first.data.date));
  for (const row of waiting) {
   if (row.data.date < today) { await practiceResult(db.from('cms_booking_waitlist').update({status: 'expired'}).eq('id', row.id)); continue; }
   if (row.data.staffId + '|' + row.data.date !== key || !availability.get(key)?.slots.length) continue;
   const origin = new URL(portalUrl(settings)).origin;
   // The state change and outbox insert are one transaction, so a retry is safe.
   await practiceResult(db.rpc('coretax_notify_waitlist', {p_id: row.id, p_message: {from: process.env.ENQUIRY_EMAIL_FROM, to: [row.data.email], subject: 'A consultation time may be available', text: `A time is currently available on ${row.data.date} with ${row.data.staffName}.\n\nCheck the booking page: ${origin}/book-consultation\n\nThis email does not hold a time. Availability will be checked again when you book.`}})); result.waitingListNotifications++;
  }
 }
 await enqueueEmails(plans); return result;
}
