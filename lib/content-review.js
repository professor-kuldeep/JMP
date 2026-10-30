import {practiceDb, practiceResult} from './practice-store';
import {getPages, getSettings} from './store';
import {hasPermission} from './permissions';
import {normalizePublication} from './publishing.mjs';
import {sanitizeCmsValue} from './validation';
import {cleanSlug} from './utils';
import {requiredId, text} from './practice.mjs';
import {crmError} from './crm.mjs';
import {invalidatePublicContent} from './public-cache';

export async function requirePublishingReview(session, payload, current = null) {
 const settings = await getSettings();
 if (settings.contentApprovalRequired && !hasPermission(session.role, 'pages:approve') && (payload.status === 'published' || current?.status === 'published')) throw crmError('Submit these changes for review. The current public page stays available until a publisher approves them.', 403);
}
export async function submitContentReview(payload, actor) {
 const pages = await getPages(), page = pages.find(p => Number(p.id) === Number(payload.page?.id));
 if (!page) throw crmError('Save this as a draft page before submitting it for review.');
 if (!payload.page.updatedAt || payload.page.updatedAt !== page.updatedAt) throw crmError('This page changed. Reload the latest version before submitting.', 409);
 const value = normalizePublication(sanitizeCmsValue(payload.page)), slug = page.slug === 'home' ? 'home' : cleanSlug(value.slug || value.title);
 if (['waitlist','client-portal', 'search', 'admin', 'api', 'booking', 'book-consultation', 'blog', 'reset-password', 'robots.txt', 'sitemap.xml'].includes(slug)) throw crmError('This page URL is reserved.');
 if (pages.some(p => p.id !== page.id && p.slug === slug)) throw crmError('Another page uses this URL.', 409);
 return practiceResult(practiceDb().from('cms_page_reviews').insert({id: requiredId(payload.requestId, 'review request'), page_id: page.id, snapshot: {...value, id: page.id, slug, status: 'published', sections: Array.isArray(value.sections) ? value.sections : []}, base_updated_at: page.updatedAt, submitted_by: actor}).select('*').single());
}
export async function decideContentReview(payload, actor) {
 const id = requiredId(payload.id, 'review');
 if (payload.decision === 'approve') { const page = await practiceResult(practiceDb().rpc('coretax_approve_page', {p_id: id, p_actor: actor})); invalidatePublicContent(); return {page}; }
 if (payload.decision !== 'request-changes' || !text(payload.feedback, 4000)) throw crmError('Explain the requested changes.');
 const review = await practiceResult(practiceDb().from('cms_page_reviews').update({state: 'changes_requested', reviewed_by: actor, reviewed_at: new Date().toISOString(), feedback: text(payload.feedback, 4000)}).eq('id', id).eq('state', 'pending').select('*').maybeSingle());
 if (!review) throw crmError('This review has already been decided.', 409); return {review};
}
