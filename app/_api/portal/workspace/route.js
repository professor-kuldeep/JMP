import crypto from 'node:crypto';
import {requirePortal} from '../../../lib/portal-auth';
import {clientWorkspace, completePracticeTask, decidePracticeQuote, practiceDb, practiceResult} from '../../../lib/practice-store';
import {text, publicPracticeItem} from '../../../lib/practice.mjs';
import {readJsonBody} from '../../../lib/http-body.mjs';
import {practiceJson, practiceApiError} from '../../../lib/practice-http';
import {crmError, UUID} from '../../../lib/crm.mjs';
export async function GET(request) { try { const session = await requirePortal(request); return practiceJson(await clientWorkspace(session.client.id, true)); } catch (error) { return practiceApiError(error,true); } }
export async function POST(request) {
 try {
  const session = await requirePortal(request, true), payload = await readJsonBody(request, 12000), actor = 'Client: ' + session.client.email; let row;
  if (payload.action === 'complete-task') row = await completePracticeTask(payload.id, payload.version, actor, session.client.id);
  else if (payload.action === 'decide-quote') row = await decidePracticeQuote(payload.id, payload.version, payload.decision, session.client.id, actor);
  else if (payload.action === 'message') {
   const body = text(payload.body, 8000); if (!body || !UUID.test(payload.requestId || '')) throw crmError('Write a message before sending.');
   const existing=await practiceResult(practiceDb().from('cms_practice_items').select('*').eq('id',payload.requestId).maybeSingle());
   if(existing){if(existing.client_id!==session.client.id||existing.kind!=='message'||existing.data.description!==body||existing.data.title!==text(payload.subject||'Client message',180))throw crmError('This message request contains different details.',409);return practiceJson({item:publicPracticeItem(existing)});}
   row = await practiceResult(practiceDb().rpc('coretax_practice_save', {p_id: payload.requestId, p_client: session.client.id, p_kind: 'message', p_parent: null, p_expected: 0, p_actor: actor, p_data: {title: text(payload.subject || 'Client message', 180), description: body, channel: 'portal', direction: 'inbound', clientVisible: true, author: session.client.name, status: 'recorded'}, p_jobs: []}));
  } else throw crmError('Choose a supported portal action.');
  return practiceJson({item: publicPracticeItem(row)});
 } catch (error) { return practiceApiError(error,true); }
}
