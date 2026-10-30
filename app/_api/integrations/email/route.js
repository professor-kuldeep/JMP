import crypto from 'node:crypto';
import {readBoundedBody} from '../../../lib/http-body.mjs';
import {practiceDb, practiceResult, clientByEmail} from '../../../lib/practice-store';
import {verifyInboundSignature, validateInboundMessage} from '../../../lib/practice-communications.mjs';
import {practiceJson, practiceApiError} from '../../../lib/practice-http';
import {crmError} from '../../../lib/crm.mjs';
export async function POST(request) {
 try {
  const bytes = await readBoundedBody(request, 32000);
  if (!verifyInboundSignature(bytes, request.headers.get('x-jmp-timestamp'), request.headers.get('x-jmp-signature'), process.env.CRM_EMAIL_WEBHOOK_SECRET)) throw crmError('Invalid integration signature.', 401);
  let payload; try { payload = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw crmError('Use a valid JSON message.'); }
  const value = validateInboundMessage(payload), client = await clientByEmail(value.clientEmail); if (!client) throw crmError('No active client matches this sender.', 404);
  const db = practiceDb(), fingerprint = crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const previous = await practiceResult(db.from('cms_practice_items').select('id,client_id,data').eq('kind', 'message').eq('data->>externalMessageId', value.externalMessageId).maybeSingle());
  if (previous) { if (previous.client_id !== client.id || previous.data.fingerprint !== fingerprint) throw crmError('This message ID already contains different content.', 409); return practiceJson({received: true, duplicate: true, id: previous.id}); }
  const {clientEmail, ...data} = value;
  const row = await practiceResult(db.rpc('coretax_practice_save', {p_id: crypto.randomUUID(), p_client: client.id, p_kind: 'message', p_parent: null, p_expected: 0, p_actor: 'Verified email integration', p_data: {...data, fingerprint, direction: 'inbound', channel: 'email', clientVisible: true, author: client.name, status: 'recorded'}, p_jobs: []}));
  return practiceJson({received: true, id: row.id});
 } catch (error) { return practiceApiError(error); }
}
