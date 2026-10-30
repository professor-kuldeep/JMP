import {UUID, crmError, dateKey} from './crm.mjs';

export const PRACTICE_KINDS = ['case', 'task', 'request', 'document', 'quote', 'message', 'payment'];
export const CASE_STAGES = ['onboarding', 'in_progress', 'awaiting_client', 'review', 'completed', 'on_hold'];
export const TASK_STAGES = ['open', 'completed'];
export const REQUEST_STAGES = ['requested', 'submitted', 'approved', 'needs_correction'];
export const QUOTE_STAGES = ['draft', 'sent', 'accepted', 'declined'];
export const RECURRENCES = ['none', 'monthly', 'quarterly', 'yearly'];
export const PRIVATE_DOCUMENT_BUCKET = 'client-documents';
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const label = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
export const text = (value, max = 300) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
export const normalizeEmail = value => text(value, 254).toLowerCase();
export const validEmail = value => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
export function validDate(value) { try { return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value; } catch { return false; } }
export function requiredId(value, description = 'record') { if (!UUID.test(value || '')) throw crmError(`Choose a valid ${description}.`); return value; }
const choice = (value, choices, fallback) => { const v = value ?? fallback; if (!choices.includes(v)) throw crmError('Choose a supported status or option.'); return v; };
const date = value => { if (value && !validDate(value)) throw crmError('Use a valid YYYY-MM-DD date.'); return value || ''; };
const owner = value => value ? requiredId(value, 'team member') : '';

export function validateClient(payload) {
  const value = {name: text(payload.name, 120), email: normalizeEmail(payload.email), company: text(payload.company, 160), phone: text(payload.phone, 40), active: payload.active !== false};
  if (!value.name || !validEmail(value.email)) throw crmError('Enter a client name and valid email address.');
  return value;
}
export function moneyMinor(value) {
  const input = String(value ?? '').trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(input)) throw crmError('Enter a fee with up to two decimal places.');
  const [whole, fraction = ''] = input.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function validatePracticeItem(kind, payload, previous = null) {
  if (!PRACTICE_KINDS.includes(kind) || kind === 'document') throw crmError('Use the document upload action for files.');
  const value = {title: text(payload.title, 180), description: text(payload.description, 8000)};
  if (!value.title) throw crmError('Enter a title.');
  if (kind === 'case') return {...value, service: text(payload.service, 160), status: choice(payload.status, CASE_STAGES, 'onboarding'), ownerId: owner(payload.ownerId), dueDate: date(payload.dueDate), internalNotes: text(payload.internalNotes, 8000), clientVisible: true, sourceEnquiryId: previous?.data?.sourceEnquiryId || null};
  if (kind === 'task') return {...value, status: previous?.data?.status || 'open', ownerId: owner(payload.ownerId), dueDate: date(payload.dueDate), recurrence: choice(payload.recurrence, RECURRENCES, 'none'), anchorDay: previous?.data?.anchorDay || (payload.dueDate ? Number(payload.dueDate.slice(-2)) : null), clientVisible: payload.clientVisible === true, clientCompletable: payload.clientCompletable === true, remindClient: payload.remindClient === true, seriesId: previous?.data?.seriesId || '', internalNotes: text(payload.internalNotes, 4000)};
  if (kind === 'request') return {...value, status: previous?.data?.status || 'requested', dueDate: date(payload.dueDate), clientVisible: true, remindClient: payload.remindClient === true};
  if (kind === 'quote') {
    if (previous && previous.data.status !== 'draft') throw crmError('Issued quotations are fixed. Create a new quotation to revise the scope or fees.', 409);
    if (!value.description) throw crmError('Describe the scope and fee basis before issuing a quotation.');
    const amountMinor = moneyMinor(payload.amount), currency = choice(payload.currency, ['INR', 'USD', 'GBP', 'EUR', 'CAD', 'AUD'], 'INR');
    return {...value, service: text(payload.service, 160), amountMinor, currency, expiresOn: date(payload.expiresOn), status: choice(payload.status, ['draft', 'sent'], 'draft'), clientVisible: payload.status === 'sent', terms: text(payload.terms, 4000), ownerId: owner(payload.ownerId)};
  }
  if (kind === 'payment') {
    if (previous) throw crmError('Payment entries are fixed. Reverse an incorrect entry and record its correction.', 409);
    const amountMinor=moneyMinor(payload.amount);if(amountMinor<1||!payload.paidOn)throw crmError('Enter a positive received amount and payment date.');if(payload.paidOn>dateKey(new Date(),'Asia/Kolkata'))throw crmError('A confirmed payment cannot have a future date.');
    return {...value,amountMinor,currency:choice(payload.currency,['INR','USD','GBP','EUR','CAD','AUD'],'INR'),paidOn:date(payload.paidOn),reference:text(payload.reference,160),status:'recorded',clientVisible:payload.clientVisible===true};
  }
  return {...value, status: 'recorded', clientVisible: payload.clientVisible === true, direction: choice(payload.direction, ['outbound', 'inbound', 'internal'], 'internal'), channel: choice(payload.channel, ['portal', 'email', 'note'], 'note'), sendEmail: payload.sendEmail === true, replyToId: payload.replyToId ? requiredId(payload.replyToId, 'message') : ''};
}

export function nextDueDate(value, recurrence, anchorDay) {
  if (!validDate(value) || recurrence === 'none') return '';
  const months = {monthly: 1, quarterly: 3, yearly: 12}[recurrence];
  if (!months) return '';
  const current = new Date(value + 'T12:00:00Z'), target = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + months, 1));
  const end = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(Number(anchorDay) || current.getUTCDate(), end));
  return target.toISOString().slice(0, 10);
}

const TEMPLATE_ITEMS = {
  general: [{kind: 'task', title: 'Confirm scope and main contact'}, {kind: 'request', title: 'Share the records agreed with the team'}],
  gst: [{kind: 'task', title: 'Confirm GST period and filing scope'}, {kind: 'request', title: 'GST registration details'}, {kind: 'request', title: 'Sales and purchase records for the agreed period'}, {kind: 'request', title: 'Previous returns and reconciliation records'}],
  accounting: [{kind: 'task', title: 'Confirm accounting period and reporting needs'}, {kind: 'request', title: 'Opening balances and previous financial statements'}, {kind: 'request', title: 'Bank statements for the agreed period'}, {kind: 'request', title: 'Sales, purchase and expense records'}],
  audit: [{kind: 'task', title: 'Confirm engagement scope and audit period'}, {kind: 'request', title: 'Financial statements and trial balance'}, {kind: 'request', title: 'Schedules and supporting records agreed with the team'}],
  tax: [{kind: 'task', title: 'Confirm assessment period and taxpayer details'}, {kind: 'request', title: 'Income and deduction records agreed with the team'}, {kind: 'request', title: 'Previous return and tax payment details'}],
  setup: [{kind: 'task', title: 'Confirm proposed entity and ownership'}, {kind: 'request', title: 'Identity and address records agreed with the team'}, {kind: 'task', title: 'Confirm registration and approval steps'}]
};
export function onboardingTemplate(service = '') {
  const topic = /gst|indirect tax/i.test(service) ? 'gst' : /account|bookkeep|payroll/i.test(service) ? 'accounting' : /audit|assurance/i.test(service) ? 'audit' : /tax/i.test(service) ? 'tax' : /setup|incorporat|corporate|registration/i.test(service) ? 'setup' : 'general';
  return TEMPLATE_ITEMS[topic].map(item => ({...item, description: '', status: item.kind === 'task' ? 'open' : 'requested', clientVisible: true, clientCompletable: item.kind === 'task', remindClient: false, recurrence: 'none', dueDate: '', ownerId: ''}));
}

export function validateWorkflowRules(rules) {
  if (!Array.isArray(rules) || rules.length > 20) throw crmError('Use up to 20 workflow rules.');
  return rules.map(rule => {
    const service = text(rule.service, 160), hours = Number(rule.followUpHours);
    if (!service || !Number.isInteger(hours) || hours < 1 || hours > 720) throw crmError('Each rule needs a service and a follow-up delay of 1–720 hours.');
    return {id: requiredId(rule.id, 'rule'), service, ownerId: owner(rule.ownerId), followUpHours: hours, enabled: rule.enabled !== false};
  });
}
export function enquiryAutomation(enquiry, settings = {}, now = new Date()) {
  const rules = Array.isArray(settings.practiceWorkflowRules) ? settings.practiceWorkflowRules : [];
  const rule = rules.find(r => r&&typeof r.service==='string'&&r.enabled !== false && r.service.toLowerCase() === String(enquiry.service || '').toLowerCase()) || rules.find(r => r&&r.enabled !== false && r.service === '*');
  if (!rule) return enquiry;
  return {...enquiry, assignedTo: rule.ownerName || rule.ownerId || '', assignedUserId: rule.ownerId || '', followUpAt: new Date(now.getTime() + Math.max(1, Math.min(720, Number(rule.followUpHours) || 24)) * 3600000).toISOString(), automationRuleId: rule.id};
}

export function publicPracticeItem(row) {
  const d = row.data || {};
  if (d.clientVisible !== true || (row.kind === 'quote' && d.status === 'draft')) return null;
  const fields = {
    case: ['title', 'description', 'service', 'status', 'dueDate'],
    task: ['title', 'description', 'status', 'dueDate', 'recurrence', 'clientCompletable'],
    request: ['title', 'description', 'status', 'dueDate'],
    document: ['title', 'description', 'status', 'filename', 'size', 'mime', 'feedback'],
    quote: ['title', 'description', 'service', 'status', 'amountMinor', 'currency', 'expiresOn', 'terms', 'decidedAt'],
    message: ['title', 'description', 'channel', 'direction', 'author', 'delivery']
    ,payment: ['title','description','amountMinor','currency','paidOn','reference','status']
  }[row.kind];
  if (!fields) return null;
  return {id: row.id, kind: row.kind, parent_id: row.parent_id, version: row.version, created_at: row.created_at, updated_at: row.updated_at, data: Object.fromEntries(fields.filter(k => d[k] !== undefined).map(k => [k, d[k]]))};
}
export function practiceSummary(items, today = dateKey(new Date(), 'Asia/Kolkata')) {
  const tasks = items.filter(i => i.kind === 'task'), done = tasks.filter(i => i.data.status === 'completed');
  return {activeCases: items.filter(i => i.kind === 'case' && !['completed', 'on_hold'].includes(i.data.status)).length, openTasks: tasks.length - done.length, overdue: tasks.filter(i => i.data.status !== 'completed' && i.data.dueDate && i.data.dueDate < today).length, missingDocuments: items.filter(i => i.kind === 'request' && ['requested', 'needs_correction'].includes(i.data.status)).length, progress: tasks.length ? Math.round(done.length / tasks.length * 100) : 0};
}

export function validateDocument(bytes, filename, mime = '') {
  if (!bytes?.length || bytes.length > MAX_DOCUMENT_BYTES) throw crmError('Choose a non-empty file up to 4 MB.', 413);
  const name = text(filename, 160).replace(/[\\/]/g, '_'), ext = name.split('.').pop().toLowerCase();
  const formats = {pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
  if (!formats[ext]) throw crmError('Use PDF, PNG, JPG, WebP, CSV, XLSX or DOCX files.');
  const start = Array.from(bytes.subarray(0, 12)), ascii = new TextDecoder().decode(bytes.subarray(0, 12));
  const valid = ext === 'pdf' ? ascii.startsWith('%PDF-') : ext === 'png' ? start.slice(0, 8).join() === '137,80,78,71,13,10,26,10' : ['jpg', 'jpeg'].includes(ext) ? start[0] === 255 && start[1] === 216 && start[2] === 255 : ext === 'webp' ? ascii.startsWith('RIFF') && ascii.slice(8) === 'WEBP' : ['xlsx', 'docx'].includes(ext) ? start[0] === 80 && start[1] === 75 && start[2] === 3 && start[3] === 4 : !bytes.includes(0) && !/^\s*<(?:!doctype|html|script|svg)/i.test(new TextDecoder().decode(bytes.subarray(0, 300)));
  if (!valid) throw crmError('The file contents do not match a supported document format.');
  return {filename: name, extension: ext, mime: formats[ext], size: bytes.length};
}

export function businessReport(enquiries = [], cases = [], quotes = [], payments = [], sourceEnquiries = enquiries) {
  const channels = new Map();
  for (const lead of enquiries) {
    const source = text(lead.attribution?.source || 'Unattributed', 120), key = source;
    if (!channels.has(key)) channels.set(key, {source, enquiries: 0, progressed: 0, clients: 0, collectedByCurrency: {}});
    const row = channels.get(key); row.enquiries++;
    if (['contacted', 'consultation', 'client'].includes(lead.status)) row.progressed++;
    if (lead.status === 'client') row.clients++;
  }
  // Accepted quotations are quoted fees, not paid revenue. Never mix currencies.
  const fees = {};
  for (const q of quotes.filter(q => q.data.status === 'accepted')) {
    const currency = q.data.currency || 'INR'; fees[currency] = (fees[currency] || 0) + Number(q.data.amountMinor || 0);
  }
  const sources=new Map(),collected={};
  for(const lead of [...sourceEnquiries].sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||''))))if(lead.practiceClientId&&!sources.has(lead.practiceClientId))sources.set(lead.practiceClientId,text(lead.attribution?.source||'Unattributed',120));
  for(const payment of payments.filter(p=>p.data.status==='recorded')){
    const source=sources.get(payment.client_id)||'Unattributed',currency=payment.data.currency||'INR',amount=Number(payment.data.amountMinor)||0;
    if(!channels.has(source))channels.set(source,{source,enquiries:0,progressed:0,clients:0,collectedByCurrency:{}});
    const row=channels.get(source);row.collectedByCurrency[currency]=(row.collectedByCurrency[currency]||0)+amount;collected[currency]=(collected[currency]||0)+amount;
  }
  const converted = enquiries.filter(e => e.status === 'client').length;
  return {enquiries: enquiries.length, convertedClients: converted, conversionRate: enquiries.length ? +(100 * converted / enquiries.length).toFixed(1) : 0, channels: [...channels.values()], activeCases: cases.filter(c => !['completed', 'on_hold'].includes(c.data.status)).length, acceptedFees: fees, collectedFees:collected,feeBasis: 'Accepted quotation fees and manually recorded confirmed payments are reported separately.',sourceBasis:'Payment source uses the earliest linked enquiry. Unlinked or unconsented enquiries remain unattributed.'};
}
