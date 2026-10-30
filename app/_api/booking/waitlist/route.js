import {after} from 'next/server';
import {readJsonBody} from '../../../lib/http-body.mjs';
import {getSettings} from '../../../lib/store';
import {verifyRequestOrigin, verifyTurnstile, checkContactRateLimit} from '../../../lib/security';
import {joinAppointmentWaitlist, cancelAppointmentWaitlist} from '../../../lib/practice-maintenance';
import {practiceJson, practiceApiError} from '../../../lib/practice-http';
import {processEmailQueue} from '../../../lib/mail-queue';
import {crmError} from '../../../lib/crm.mjs';
export async function POST(request) {
 try {
  if (!verifyRequestOrigin(request)) throw crmError('Invalid request origin.', 403);
  const payload = await readJsonBody(request, 4000), limit = await checkContactRateLimit(request);
  if (!limit.allowed) throw crmError(limit.unavailable ? 'Request protection is unavailable. Try again shortly.' : 'Please wait before making another request.', limit.unavailable ? 503 : 429);
  if (payload.action === 'cancel') return practiceJson(await cancelAppointmentWaitlist(payload));
  if (!(await verifyTurnstile(payload.turnstileToken, request)).ok) throw crmError('Complete the security verification.', 403);
  await joinAppointmentWaitlist(payload, await getSettings());
  after(async () => { try { await processEmailQueue(2); } catch {} });
  return practiceJson({message: 'Your waiting-list request is saved. Check your email for the details and cancellation link.'});
 } catch (error) { return practiceApiError(error,true); }
}
