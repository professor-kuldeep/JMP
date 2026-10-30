import crypto from 'node:crypto';
import {after} from 'next/server';
import {requirePermission} from '../../../lib/auth';
import {listUsers} from '../../../lib/users';
import {getSettings, saveSettings, getEnquiries} from '../../../lib/store';
import {practiceDb, practiceResult, listClients, clientWorkspace, saveClient, savePracticeItem, openPracticeCase, completePracticeTask, reviewDocument, reversePayment, clientMailPlan, assertPortalReady, convertPracticeEnquiry} from '../../../lib/practice-store';
import {generatePortalInvite} from '../../../lib/portal-auth';
import {validateWorkflowRules, businessReport, validDate} from '../../../lib/practice.mjs';
import {crmError} from '../../../lib/crm.mjs';
import {practiceJson, practiceApiError} from '../../../lib/practice-http';
import {readJsonBody} from '../../../lib/http-body.mjs';
import {enqueueEmails, processEmailQueue} from '../../../lib/mail-queue';
import {writeSecurityAudit} from '../../../lib/security';
import {getSupabaseStatus} from '../../../lib/supabase';
import {hasPermission} from '../../../lib/permissions';

export async function GET(request) {
 try {
  await requirePermission(request, 'practice:read'); const query = new URL(request.url).searchParams;
  if (query.get('client')) return practiceJson(await clientWorkspace(query.get('client')));
  if (query.get('report') === 'business') {
   await requirePermission(request, 'analytics:read');
   const from = query.get('from') || '', to = query.get('to') || '';
   if ((from && !validDate(from)) || (to && !validDate(to)) || (from && to && from > to)) throw crmError('Choose a valid reporting date range.');
   const all = []; for (let offset = 0; ; offset += 1000) { const rows = await practiceResult(practiceDb().from('cms_practice_items').select('*').in('kind', ['case', 'quote','payment']).order('id').range(offset, offset + 999)); all.push(...rows); if (rows.length < 1000) break; }
   const inRange = value => (!from || String(value).slice(0, 10) >= from) && (!to || String(value).slice(0, 10) <= to);
   const enquiries=await getEnquiries();return practiceJson({report: businessReport(enquiries.filter(e => inRange(e.createdAt)), all.filter(i => i.kind === 'case'), all.filter(i => i.kind === 'quote' && inRange(i.data.decidedAt || i.created_at)),all.filter(i=>i.kind==='payment'&&inRange(i.data.paidOn)),enquiries), from, to});
  }
  const [clients, users, settings] = await Promise.all([listClients(query.get('search'), query.get('page')), listUsers(), getSettings()]);
  return practiceJson({...clients, team: users.filter(u => !u.disabled&&hasPermission(u.role,'practice:read')).map(u => ({id: u.id, name: u.displayName || u.username})), rules: settings.practiceWorkflowRules || [], portalEnabled: settings.clientPortalEnabled === true, remindersEnabled: settings.practiceRemindersEnabled === true, emailReady: Boolean(process.env.RESEND_API_KEY && process.env.ENQUIRY_EMAIL_FROM), inboundEmailReady: String(process.env.CRM_EMAIL_WEBHOOK_SECRET || '').length >= 32, authReady: getSupabaseStatus().authConfigured});
 } catch (error) { return practiceApiError(error); }
}
export async function POST(request) {
 try {
  const session = await requirePermission(request, 'practice:write', {csrf: true}), payload = await readJsonBody(request, 32000), actor = session.username; let result;
  if (payload.action === 'save-client') result = {client: await saveClient(payload.client || {}, actor)};
  else if(payload.action==='convert-enquiry'){await requirePermission(request,'enquiries:write');result=await convertPracticeEnquiry(payload,actor);}
  else if (payload.action === 'open-case') result = {item: await openPracticeCase(payload, actor)};
  else if (payload.action === 'save-item') result = {item: await savePracticeItem(payload, actor)};
  else if (payload.action === 'complete-task') result = {item: await completePracticeTask(payload.id, payload.version, actor)};
  else if(payload.action==='reverse-payment')result={item:await reversePayment(payload,actor)};
  else if (payload.action === 'review-document') result = {item: await reviewDocument(payload, actor)};
  else if (payload.action === 'revoke-client-sessions') { await requirePermission(request, 'practice:manage'); await practiceResult(practiceDb().from('cms_portal_sessions').delete().eq('client_id', payload.clientId)); result={revoked:true}; }
  else if (payload.action === 'invite') {
   await requirePermission(request, 'practice:manage');
   const invitation = await generatePortalInvite(payload.clientId);
   if (payload.sendEmail === true) { await enqueueEmails([clientMailPlan(invitation.client, 'portal-invite-' + crypto.randomUUID(), 'Your private client portal invitation', 'Use this one-time link to set your password and open your client workspace.\n\n' + invitation.url)]); result = {queued: true}; }
   else result = {inviteUrl: invitation.url};
  } else if (payload.action === 'save-workflows') {
   await requirePermission(request, 'practice:manage');
   const rules = validateWorkflowRules(payload.rules), users = await listUsers();
   if (rules.some(r => r.ownerId && !users.some(u => u.id === r.ownerId && !u.disabled&&hasPermission(u.role,'practice:read')))) throw crmError('Select active client-service team members for assignment rules.');
   if (typeof payload.portalEnabled !== 'boolean') throw crmError('Choose whether to enable the client portal.');
   if (payload.portalEnabled && !getSupabaseStatus().authConfigured) throw crmError('Configure Supabase Auth before enabling client sign-in.');
   const settings = await getSettings();if(payload.portalEnabled)await assertPortalReady(settings);await saveSettings({...settings, practiceWorkflowRules: rules.map(r=>({...r,ownerName:users.find(u=>u.id===r.ownerId)?.displayName||users.find(u=>u.id===r.ownerId)?.username||''})), clientPortalEnabled: payload.portalEnabled, practiceRemindersEnabled: payload.remindersEnabled === true}); result = {saved: true};
  } else throw crmError('Choose a supported client workspace action.');
  await writeSecurityAudit(request, session, 'practice_' + payload.action, 'practice');
  after(async () => { try { await processEmailQueue(2); } catch {} });
  return practiceJson(result);
 } catch (error) { return practiceApiError(error); }
}
