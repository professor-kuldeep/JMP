import {isPublicPage} from './publishing.mjs';
const plain = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/[*_`#~+]/g, '').replace(/\s+/g, ' ').trim();
export function siteSearchEntries(pages = [], now = Date.now()) {
 const entries = [];
 for (const page of pages) {
  if (!isPublicPage(page, now) || !/^[a-z0-9-]+$/.test(page.slug || '') || ['client-portal', 'admin', 'waitlist', 'search', 'reset-password'].includes(page.slug)) continue;
  const href = page.slug === 'home' ? '/' : '/' + page.slug;
  entries.push({id: 'page-' + page.id, title: plain(page.title), text: plain(page.metaDescription || page.heroText).slice(0, 350), href, kind: page.template === 'blog' ? 'Article' : page.template === 'service' ? 'Service' : 'Page'});
  for (const [i, section] of (page.sections || []).entries()) if (section.type === 'faq') for (const [j, item] of (section.items || []).entries()) if (item.question) entries.push({id: `faq-${page.id}-${i}-${j}`, title: plain(item.question), text: plain(item.answer).slice(0, 500), href, kind: 'FAQ'});
 }
 return entries;
}
export function searchSite(entries, query = '', kind = 'All') {
 const words = plain(query).toLocaleLowerCase().split(' ').filter(Boolean).slice(0, 12);
 return entries.filter(e => (kind === 'All' || e.kind === kind) && words.every(w => (e.title + ' ' + e.text).toLocaleLowerCase().includes(w))).sort((a, b) => Number(words.some(w => b.title.toLocaleLowerCase().includes(w))) - Number(words.some(w => a.title.toLocaleLowerCase().includes(w))) || a.title.localeCompare(b.title));
}
