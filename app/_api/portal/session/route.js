import {after} from 'next/server';
import {requirePortal, portalLogin, portalActivation, setPortalCookie, requestPortalRecovery} from '../../../lib/portal-auth';
import {practiceDb, practiceResult} from '../../../lib/practice-store';
import {practiceJson, practiceApiError} from '../../../lib/practice-http';
import {readJsonBody} from '../../../lib/http-body.mjs';
import {getSettings} from '../../../lib/store';
import {checkLoginRateLimit, verifyRequestOrigin, verifyTurnstile} from '../../../lib/security';
import {crmError} from '../../../lib/crm.mjs';
import {processEmailQueue} from '../../../lib/mail-queue';
export async function GET(request) { try { const session = await requirePortal(request); return practiceJson({client: {id: session.client.id, name: session.client.name, company: session.client.company, email: session.client.email}, csrfToken: session.csrfToken}); } catch (error) { return practiceApiError(error,true); } }
export async function POST(request) {
 try {
  if (!verifyRequestOrigin(request)) throw crmError('Invalid request origin.', 403);
  if ((await getSettings()).clientPortalEnabled !== true) throw crmError('The client portal is not available yet. Please contact the team.', 503);
  const payload = await readJsonBody(request, 4000), limit = await checkLoginRateLimit(request, 'portal:' + String(payload.email || '').toLowerCase());
  if (limit.unavailable) throw crmError('Account protection is temporarily unavailable. Please try again shortly.', 503);
  if (!limit.allowed) throw Object.assign(crmError('Too many account requests. Please wait before trying again.', 429), {retryAfter: limit.retryAfter});
  if (!(await verifyTurnstile(payload.turnstileToken, request)).ok) throw crmError('Complete the security verification.', 403);
  if (payload.action === 'recovery') {
   if (!process.env.RESEND_API_KEY || !process.env.ENQUIRY_EMAIL_FROM) throw crmError('Email account recovery is unavailable. Contact the team for a new invitation.', 503);
   // Use the same public response for every email, including unknown accounts.
   try { await requestPortalRecovery(payload.email); } catch {}
   after(async () => { try { await processEmailQueue(2); } catch {} });
   return practiceJson({message: 'If an active client account matches that email, an account link will be sent.'});
  }
  const result = payload.action === 'activate' ? await portalActivation(payload) : payload.action === 'login' ? await portalLogin(payload) : null;
  if (!result) throw crmError('Choose a supported sign-in action.');
  const response = practiceJson({client: result.client, csrfToken: result.csrfToken}); setPortalCookie(response, result.token); return response;
 } catch (error) { return practiceApiError(error,true); }
}
export async function DELETE(request) { try { const session = await requirePortal(request, true); await practiceResult(practiceDb().from('cms_portal_sessions').delete().eq('token_hash', session.tokenHash)); const response = practiceJson({signedOut: true}); setPortalCookie(response); return response; } catch (error) { return practiceApiError(error,true); } }
