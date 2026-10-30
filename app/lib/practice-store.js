import crypto from 'node:crypto';
import {supabaseAdmin, getSupabaseStatus} from './supabase';
import {readEnquiry} from './crm-store';
import {getSettings} from './store';
import {getUserById} from './users';
import {hasPermission} from './permissions';
import {crmError, dateKey} from './crm.mjs';
import {validateClient, validatePracticeItem, onboardingTemplate, requiredId, publicPracticeItem, nextDueDate, practiceSummary, validateDocument, PRIVATE_DOCUMENT_BUCKET} from './practice.mjs';

export function practiceDb() { const db = supabaseAdmin(); if (!db) throw practiceStorageError(); return db; }
export function practiceStorageError() { return Object.assign(new Error('Connect Supabase and run the v10 practice migration before using the client workspace.'), {status: 503, code: 'STORAGE_NOT_CONFIGURED'}); }
export function practiceDbError(error) {
  if (['P0002', 'PGRST116'].includes(error?.code)) return crmError('This record is unavailable.', 404);
  if (error?.code === '40001') return crmError('This record changed. Refresh it before saving.', 409);
  if (error?.code === '23505') return crmError('This record already exists or this enquiry is already linked to a case.', 409);
  if (error?.code === '22023') return crmError(error.message === 'QUOTE_EXPIRED' ? 'This quotation has expired. Ask the team for a revised quotation.' : error.message === 'SECOND_REVIEWER_REQUIRED' ? 'A different publisher must approve this submission.' : 'The selected records do not belong together.');
  return practiceStorageError();
}
export async function practiceResult(query) { const {data, error} = await query; if (error) throw practiceDbError(error); return data; }
export async function readClient(id, active = false) {
  requiredId(id, 'client'); let query = practiceDb().from('cms_practice_clients').select('*').eq('id', id); if (active) query = query.eq('active', true);
  const client = await practiceResult(query.maybeSingle()); if (!client) throw crmError('This client is unavailable.', 404); return client;
}
export async function clientByEmail(email) { return practiceResult(practiceDb().from('cms_practice_clients').select('*').eq('email', email).eq('active', true).maybeSingle()); }
export async function listClients(search = '', page = 1) {
  const q = String(search).replace(/[^\p{L}\p{N}@+._ -]/gu, '').slice(0, 100); let query = practiceDb().from('cms_practice_clients').select('*', {count: 'exact'}).order('name');
  if (q) query = query.or(`name.ilike.*${q}*,email.ilike.*${q}*,company.ilike.*${q}*`);
  const offset = (Math.max(1, Math.min(10000, Number(page) || 1)) - 1) * 50, {data, error, count} = await query.range(offset, offset + 49);
  if (error) throw practiceDbError(error); return {clients: data || [], total: count || 0, page: offset / 50 + 1};
}
export async function saveClient(payload, actor) {
  const value = validateClient(payload), db = practiceDb(), id = payload.id ? requiredId(payload.id, 'client') : crypto.randomUUID();
  let client;
  if (payload.id) {
    const previous = await readClient(id);
    if (previous.auth_user_id && previous.email !== value.email) throw crmError('A portal account is linked to this email. Keep the address or create a separate client record.', 409);
    if (!Number.isInteger(payload.version) || payload.version !== previous.version) throw crmError('Refresh this client before saving.', 409);
    let update = db.from('cms_practice_clients').update({...value, version: previous.version + 1, updated_at: new Date().toISOString()}).eq('id', id).eq('version', previous.version);
    if(previous.email!==value.email)update=update.is('auth_user_id',null);
    client = await practiceResult(update.select('*').maybeSingle());
    if (!client) throw crmError('This client changed. Refresh before saving.', 409);
    if (!value.active) await practiceResult(db.from('cms_portal_sessions').delete().eq('client_id', id));
  } else client = await practiceResult(db.from('cms_practice_clients').insert({id, ...value}).select('*').single());
  await practiceResult(db.from('cms_practice_events').insert({client_id: id, actor, action: payload.id ? 'Updated client' : 'Created client'}));
  return client;
}
export async function readPracticeItem(id, clientId = null) {
  requiredId(id); let query = practiceDb().from('cms_practice_items').select('*').eq('id', id);
  if (clientId) query = query.eq('client_id', clientId);
  const row = await practiceResult(query.maybeSingle()); if (!row) throw crmError('This record is unavailable.', 404); return row;
}
export async function checkOwner(ownerId) {
  if (!ownerId) return;
  const user = await getUserById(ownerId); if (!user || user.disabled || !hasPermission(user.role,'practice:read')) throw crmError('Choose an active Administrator or Client Services team member.'); return user;
}
export async function clientWorkspace(clientId, portal = false) {
  const client = await readClient(clientId, portal), db = practiceDb();
  let query = db.from('cms_practice_items').select('*', {count: 'exact'}).eq('client_id', clientId).order('updated_at', {ascending: false}).limit(500);
  if (portal) query = query.eq('data->>clientVisible', 'true');
  const {data, error, count} = await query; if (error) throw practiceDbError(error);
  let items = data || [];
  const jobIds = items.filter(i => i.kind === 'message' && i.data.emailJobId).map(i => i.data.emailJobId);
  if (jobIds.length) {
    const jobs = await practiceResult(db.from('cms_jobs').select('id,state').in('id', jobIds));
    items = items.map(i => i.kind === 'message' && i.data.emailJobId ? {...i, data: {...i.data, delivery: jobs.find(j => j.id === i.data.emailJobId)?.state || 'queued'}} : i);
  }
  return {client: portal ? {id: client.id, name: client.name, company: client.company, email: client.email} : client, items: portal ? items.map(publicPracticeItem).filter(Boolean) : items, total: count || 0, truncated: (count || 0) > 500, summary: practiceSummary(portal ? items.map(publicPracticeItem).filter(Boolean) : items), events: portal ? [] : await practiceResult(db.from('cms_practice_events').select('id,actor,action,at,item_id').eq('client_id', clientId).order('at', {ascending: false}).limit(40))};
}
export function clientMailPlan(client, id, subject, body, context = {}) {
  if (!process.env.RESEND_API_KEY || !process.env.ENQUIRY_EMAIL_FROM) throw crmError('Configure email delivery before sending this notification.', 503);
  return {key: id, context: {practiceClientId: client.id, ...context}, message: {from: process.env.ENQUIRY_EMAIL_FROM, to: [client.email], subject, text: body}};
}
export async function savePracticeItem(payload, actor) {
  const client = await readClient(requiredId(payload.clientId, 'client'), true), previous = payload.id ? await readPracticeItem(payload.id, client.id) : null;
  const kind = previous?.kind || payload.kind, value = validatePracticeItem(kind, payload.data || {}, previous), id = previous?.id || requiredId(payload.requestId, 'request');
  await checkOwner(value.ownerId);
  const parent = payload.parentId ? requiredId(payload.parentId, 'case') : null;
  const jobs = [];
  if (kind === 'quote') {
    value.onboarding = onboardingTemplate(value.service);
    if (value.status === 'sent') {
      const settings = await getSettings();
      if (payload.notify === true) jobs.push(clientMailPlan(client, `quote-${id}-issued`, `Quotation ready | ${settings.siteName || 'JMP'}`, 'A quotation is ready for your review. Sign in to the client portal to read the scope, fee basis and terms.\n\n' + portalUrl(settings)));
    }
  }
  if (kind === 'message') {
    value.author = actor;
    if (value.channel === 'note' || value.direction === 'internal') value.clientVisible = false;
    value.fingerprint = crypto.createHash('sha256').update(JSON.stringify([value.title,value.description,value.channel,value.direction,value.clientVisible,value.sendEmail,value.replyToId])).digest('hex');
    if (!previous) {
      const existing = await practiceResult(practiceDb().from('cms_practice_items').select('*').eq('id',id).maybeSingle());
      if(existing){if(existing.kind==='message'&&existing.client_id===client.id&&existing.data.fingerprint===value.fingerprint)return existing;throw crmError('This message request already contains different details.',409);}
    }
    if (value.sendEmail) {
      if (value.direction !== 'outbound' || value.channel !== 'email' || !value.clientVisible) throw crmError('Email replies must be client-visible outbound messages.');
      value.emailJobId = `practice-message-${id}`;
      jobs.push(clientMailPlan(client, value.emailJobId, value.title.replace(/[\r\n]/g, ' '), value.description, {practiceMessageId: id}));
    }
    if (value.replyToId) { const reply = await readPracticeItem(value.replyToId, client.id); if (reply.kind !== 'message') throw crmError('Choose a message to reply to.'); }
    // A recorded message is immutable so the audit thread cannot be rewritten.
    if (previous) throw crmError('Add a new message instead of editing the conversation history.', 409);
  }
  if (kind === 'task' && value.recurrence !== 'none' && !value.dueDate) throw crmError('Recurring tasks need a first due date.');
  return practiceResult(practiceDb().rpc('coretax_practice_save', {p_id: id, p_client: client.id, p_kind: kind, p_parent: parent, p_data: value, p_expected: previous ? payload.version : 0, p_actor: actor, p_jobs: jobs}));
}
export function portalUrl(settings = {}) {
  const input = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || settings.siteUrl;
  try { const url = new URL(input); if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.hostname === 'localhost')) throw new Error(); return url.origin + '/client-portal'; }
  catch { throw crmError('Save an HTTPS Site URL before generating portal links.', 503); }
}
export async function assertPortalReady(settings) {
  if(!getSupabaseStatus().authConfigured)throw crmError('Configure Supabase Auth before enabling client sign-in.',503);
  portalUrl(settings); await practiceResult(practiceDb().from('cms_practice_clients').select('id').limit(1));
  const bucket=await practiceDb().storage.getBucket(PRIVATE_DOCUMENT_BUCKET);
  if(bucket.error||!bucket.data||bucket.data.public!==false)throw crmError('Run the v10 migration and keep the client-documents bucket private before enabling the portal.',503);
}
export async function convertPracticeEnquiry(payload,actor){
  const enquiryId=Number(payload.enquiryId);if(!Number.isSafeInteger(enquiryId)||enquiryId<1)throw crmError('Choose a valid enquiry.');
  const lead=await readEnquiry(enquiryId),input=validateClient(payload.client||{});
  if(input.email!==String(lead.email||'').toLowerCase())throw crmError('Use the enquiry email when linking it to a client.');
  let client=await clientByEmail(input.email);
  if(!client){try{client=await saveClient(input,actor);}catch(error){client=await clientByEmail(input.email);if(!client)throw error;}}
  const existing=await practiceResult(practiceDb().from('cms_practice_items').select('*').eq('kind','case').eq('data->>sourceEnquiryId',String(enquiryId)).maybeSingle());
  if(existing){if(existing.client_id!==client.id)throw crmError('This enquiry is already linked to another client.',409);return {client,item:existing};}
  const item=await openPracticeCase({clientId:client.id,requestId:payload.requestId,enquiryId,onboarding:true,data:{title:(lead.service||'Client')+' engagement',service:lead.service||'',description:lead.message||'',status:'onboarding'}},actor);
  return {client,item};
}
export async function openPracticeCase(payload, actor) {
  const clientId = requiredId(payload.clientId, 'client'), value = validatePracticeItem('case', payload.data || {}); await checkOwner(value.ownerId);
  const enquiryId = payload.enquiryId == null || payload.enquiryId === '' ? null : Number(payload.enquiryId);
  if (enquiryId !== null && (!Number.isSafeInteger(enquiryId) || enquiryId < 1)) throw crmError('Choose a valid enquiry.');
  return practiceResult(practiceDb().rpc('coretax_open_case', {p_id: requiredId(payload.requestId, 'request'), p_client: clientId, p_data: value, p_template: payload.onboarding === false ? [] : onboardingTemplate(value.service), p_actor: actor, p_enquiry: enquiryId}));
}
export async function completePracticeTask(id, version, actor, portalClient = null) {
  const row = await readPracticeItem(id, portalClient);
  if (row.kind !== 'task' || (portalClient && (!row.data.clientVisible || !row.data.clientCompletable))) throw crmError('This task cannot be completed here.', 403);
  const due = nextDueDate(row.data.dueDate, row.data.recurrence, row.data.anchorDay), next = due ? {...row.data, dueDate: due, seriesId: row.data.seriesId || row.id} : null;
  if (next) { delete next.completedAt; delete next.completedBy; }
  return practiceResult(practiceDb().rpc('coretax_complete_task', {p_client: row.client_id, p_id: row.id, p_expected: version, p_actor: actor, p_next: next}));
}
export async function decidePracticeQuote(id, version, decision, clientId, actor) {
  if(!['accepted','declined'].includes(decision)||!Number.isInteger(version)||version<1)throw crmError('Choose a valid quotation decision and refresh its version.');
  return practiceResult(practiceDb().rpc('coretax_decide_quote', {p_client: clientId, p_id: requiredId(id), p_expected: version, p_decision: decision, p_actor: actor, p_today: dateKey(new Date(), 'Asia/Kolkata')}));
}
export async function uploadPracticeDocument(form, actor, portalClient = null) {
  const clientId = portalClient || requiredId(form.get('clientId'), 'client'), client = await readClient(clientId, true), file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') throw crmError('Choose a document to upload.');
  const id = requiredId(form.get('requestId'), 'upload'), bytes = Buffer.from(await file.arrayBuffer()), info = validateDocument(bytes, file.name, file.type), hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const parentId = form.get('parentId') ? requiredId(form.get('parentId'), 'document request') : null;
  if (parentId) { const parent = await readPracticeItem(parentId, client.id); if (!['case', 'request'].includes(parent.kind) || (portalClient && !parent.data.clientVisible)) throw crmError('Choose an available document request.'); }
  const existing = await practiceResult(practiceDb().from('cms_practice_items').select('*').eq('id', id).maybeSingle());
  if (existing) { if (existing.client_id === client.id && existing.kind === 'document' && existing.data.sha256 === hash) return portalClient ? publicPracticeItem(existing) : existing; throw crmError('This upload request has already been used.', 409); }
  const storagePath = `${client.id}/${id}.${info.extension}`, db = practiceDb();
  const uploaded = await db.storage.from(PRIVATE_DOCUMENT_BUCKET).upload(storagePath, bytes, {contentType: info.mime, upsert: false, cacheControl: '0'});
  if (uploaded.error) throw practiceStorageError();
  try {
    const row = await practiceResult(db.rpc('coretax_practice_save', {p_id: id, p_client: client.id, p_kind: 'document', p_parent: parentId, p_expected: 0, p_actor: actor, p_data: {...info, title: info.filename, description: '', status: 'submitted', storagePath, sha256: hash, clientVisible: portalClient ? true : form.get('clientVisible') === 'true', uploadedBy: actor}, p_jobs: []}));
    return portalClient ? publicPracticeItem(row) : row;
  } catch (error) { await db.storage.from(PRIVATE_DOCUMENT_BUCKET).remove([storagePath]); throw error; }
}
export async function documentDownload(id, portalClient = null) {
  const row = await readPracticeItem(id, portalClient); await readClient(row.client_id, Boolean(portalClient));
  if (row.kind !== 'document' || (portalClient && !row.data.clientVisible)) throw crmError('This document is unavailable.', 404);
  const path = row.data.storagePath;
  if (typeof path !== 'string' || !path.startsWith(row.client_id + '/') || path.includes('..')) throw crmError('This document is unavailable.', 404);
  const {data, error} = await practiceDb().storage.from(PRIVATE_DOCUMENT_BUCKET).createSignedUrl(path, 60, {download: row.data.filename || true});
  if (error || !data?.signedUrl) throw practiceStorageError(); return {url: data.signedUrl, expiresIn: 60};
}
export async function reviewDocument(payload, actor) {
  const row = await readPracticeItem(payload.id);
  if (row.kind !== 'document' || !['approved', 'needs_correction'].includes(payload.status)) throw crmError('Choose a document review action.');
  if (payload.status === 'needs_correction' && !String(payload.feedback || '').trim()) throw crmError('Explain what the client needs to correct.');
  return practiceResult(practiceDb().rpc('coretax_practice_save', {p_id: row.id, p_client: row.client_id, p_kind: 'document', p_parent: row.parent_id, p_data: {...row.data, status: payload.status, feedback: String(payload.feedback || '').slice(0, 2000)}, p_expected: payload.version, p_actor: actor, p_jobs: []}));
}

export async function reversePayment(payload,actor){
 const row=await readPracticeItem(payload.id);if(row.kind!=='payment'||row.data.status!=='recorded')throw crmError('Choose a recorded payment to reverse.',409);
 const reason=String(payload.reason||'').trim().slice(0,1000);if(!reason)throw crmError('Enter the reason for this reversal.');
 return practiceResult(practiceDb().rpc('coretax_practice_save',{p_id:row.id,p_client:row.client_id,p_kind:'payment',p_parent:row.parent_id,p_data:{...row.data,status:'reversed',reversedAt:new Date().toISOString(),reversalReason:reason},p_expected:payload.version,p_actor:actor,p_jobs:[]}));
}
