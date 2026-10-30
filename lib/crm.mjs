
export const STAGES = [
  { id: 'new', label: 'New' }, { id: 'contacted', label: 'Contacted' },
  { id: 'consultation', label: 'Consultation' }, { id: 'client', label: 'Client' },
  { id: 'closed', label: 'Closed' }
];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const stageOf = item => item?.status === 'in-progress' ? 'consultation' : item?.status || 'new';
export const crmError = (message, status = 400) => Object.assign(new Error(message), { status, code: 'CRM_ERROR' });
const text = (value, max) => String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/g, '').trim().slice(0, max);
export function validateEnquiry(payload = {}) {
  const value = { name: text(payload.name, 120), email: text(payload.email, 254).toLowerCase(), phone: text(payload.phone, 40), service: text(payload.service, 160), message: text(payload.message, 4000) };
  const errors = {};
  if (!value.name) errors.name = 'Enter your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) errors.email = 'Enter a valid email address.';
  if (value.phone && !/^[+\d\s().-]{6,40}$/.test(value.phone)) errors.phone = 'Enter a phone number using digits, spaces and an optional country code.';
  if (!value.message) errors.message = 'Tell us briefly how we can help.';
  return { value, errors, valid: !Object.keys(errors).length };
}
export function enquiryChanges(payload = {}, now = new Date()) {
  const changes = {};
  if (Object.hasOwn(payload, 'status')) {
    if (!STAGES.some(s => s.id === payload.status)) throw crmError('Choose a valid pipeline stage.');
    changes.status = payload.status;
  }
  for (const [key, max] of [['notes', 5000], ['assignedTo', 120]]) if (Object.hasOwn(payload, key)) changes[key] = text(payload[key], max);
  if (Object.hasOwn(payload, 'followUpAt')) {
    const date = payload.followUpAt ? new Date(payload.followUpAt) : null;
    if (date && !Number.isFinite(date.getTime())) throw crmError('Choose a valid follow-up date.');
    changes.followUpAt = date ? date.toISOString() : '';
  }
  if (Object.hasOwn(payload, 'completeFollowUp') && payload.completeFollowUp === true) { changes.followUpAt = ''; changes.followUpCompletedAt = now.toISOString(); }
  return changes;
}
export function crmFilters(params) {
  const get = key => params instanceof URLSearchParams ? params.get(key) : params?.[key];
  const page = Math.max(1, Math.min(100000, Number.parseInt(get('page'), 10) || 1));
  const pageSize = Math.max(1, Math.min(100, Number.parseInt(get('pageSize'), 10) || 25));
  const status = get('status') || 'all', task = get('task') || 'all';
  if (!['all', ...STAGES.map(s => s.id)].includes(status) || !['all', 'today', 'upcoming', 'overdue'].includes(task)) throw crmError('Invalid enquiry filter.');
  return { page, pageSize, status, task, q: text(get('q'), 120), owner: text(get('owner'), 120), service: text(get('service'), 160), timeZone: validTimeZone(get('timeZone')) };
}
export function validTimeZone(value) { try { new Intl.DateTimeFormat('en', { timeZone: value || 'Asia/Kolkata' }).format(); return value || 'Asia/Kolkata'; } catch { return 'Asia/Kolkata'; } }
export function dateKey(date, timeZone = 'Asia/Kolkata') { return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date)); }
export function taskMatches(item, task, timeZone, now = new Date(), hours = 48) {
  if (task === 'all') return true;
  if (['closed', 'client'].includes(stageOf(item))) return false;
  const explicit = item.followUpAt && Number.isFinite(Date.parse(item.followUpAt));
  const due = explicit ? new Date(item.followUpAt) : ['new', 'consultation'].includes(stageOf(item)) && !item.followUpCompletedAt ? new Date(Date.parse(item.createdAt) + hours * 3600000) : null;
  if (!due || !Number.isFinite(due.getTime())) return false;
  if (task === 'overdue') return due < now;
  return task === 'today' ? dateKey(due, timeZone) === dateKey(now, timeZone) : dateKey(due, timeZone) > dateKey(now, timeZone);
}
export function filterEnquiries(items, filters, hours = 48, now = new Date()) {
  const q = filters.q.toLowerCase();
  return items.filter(item => (filters.status === 'all' || stageOf(item) === filters.status) && (!filters.owner || item.assignedTo === filters.owner) && (!filters.service || item.service === filters.service) && (!q || [item.name, item.email, item.phone, item.service, item.message, item.reference].join(' ').toLowerCase().includes(q)) && taskMatches(item, filters.task, filters.timeZone, now, hours));
}
export function summarizeEnquiries(items, hours = 48, now = new Date(), timeZone = 'Asia/Kolkata') {
  return { total: items.length, stages: Object.fromEntries(STAGES.map(s => [s.id, items.filter(i => stageOf(i) === s.id).length])), overdue: items.filter(i => taskMatches(i, 'overdue', timeZone, now, hours)).length, today: items.filter(i => taskMatches(i, 'today', timeZone, now, hours)).length, upcoming: items.filter(i => taskMatches(i, 'upcoming', timeZone, now, hours)).length, owners: [...new Set(items.map(i => i.assignedTo).filter(Boolean))].sort(), services: [...new Set(items.map(i => i.service).filter(Boolean))].sort() };
}
