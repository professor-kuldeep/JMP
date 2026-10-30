import {requirePermission} from '../../../lib/auth';
import {practiceDb, practiceResult} from '../../../lib/practice-store';
import {practiceJson, practiceApiError} from '../../../lib/practice-http';
import {submitContentReview, decideContentReview} from '../../../lib/content-review';
import {readJsonBody} from '../../../lib/http-body.mjs';
import {writeSecurityAudit} from '../../../lib/security';
export async function GET(request) { try { await requirePermission(request, 'pages:read');const state=new URL(request.url).searchParams.get('state')||'pending';let query=practiceDb().from('cms_page_reviews').select('*').order('created_at', {ascending: false}).limit(100);if(['pending','approved','changes_requested'].includes(state))query=query.eq('state',state);return practiceJson({reviews:await practiceResult(query)}); } catch (error) { return practiceApiError(error); } }
export async function POST(request) {
 try {
  const payload = await readJsonBody(request, 250000), session = await requirePermission(request, payload.action === 'submit' ? 'pages:review' : 'pages:approve', {csrf: true});
  const result = payload.action === 'submit' ? {review: await submitContentReview(payload, session.username)} : await decideContentReview(payload, session.username);
  await writeSecurityAudit(request, session, 'content_review_' + (payload.action === 'submit' ? 'submitted' : payload.decision), 'page-review');
  return practiceJson(result);
 } catch (error) { return practiceApiError(error); }
}
