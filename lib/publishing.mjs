export function isPublicPage(page, now = Date.now()) {
  if (page?.status !== 'published') return false;
  if (!page.publishAt) return true;
  const date = Date.parse(page.publishAt);
  return Number.isFinite(date) && date <= now;
}
export function publicationLabel(page, now = Date.now()) {
  return page?.status === 'published' && !isPublicPage(page, now) ? 'scheduled' : page?.status || 'draft';
}
export function normalizePublication(payload) {
  if (!['draft', 'published'].includes(payload.status || 'draft')) throw Object.assign(new Error('Choose draft or published status.'), {status:400});
  if (!payload.publishAt) return {...payload, publishAt:''};
  const date = new Date(payload.publishAt);
  if (!Number.isFinite(date.getTime())) throw Object.assign(new Error('Choose a valid publication date and time.'), {status:400});
  return {...payload, publishAt: date.toISOString()};
}
export function isEnquiryOverdue(item, hours = 48, now = Date.now()) {
  if(item?.status==='closed')return false;
  if(item?.followUpAt){const followUp=Date.parse(item.followUpAt);return Number.isFinite(followUp)&&followUp<=now;}
  const date = Date.parse(item?.createdAt);
  return Number.isFinite(date) && ['new','in-progress'].includes(item.status || 'new') && now - date >= hours * 3600000;
}
