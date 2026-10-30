import {requirePortal} from '../../../lib/portal-auth';
import {documentDownload, uploadPracticeDocument} from '../../../lib/practice-store';
import {readDocumentForm} from '../../../lib/http-body.mjs';
import {practiceJson, practiceApiError} from '../../../lib/practice-http';
export async function GET(request) { try { const session = await requirePortal(request); return practiceJson(await documentDownload(new URL(request.url).searchParams.get('id'), session.client.id)); } catch (error) { return practiceApiError(error,true); } }
export async function POST(request) { try { const session = await requirePortal(request, true); return practiceJson({document: await uploadPracticeDocument(await readDocumentForm(request), 'Client: ' + session.client.email, session.client.id)}); } catch (error) { return practiceApiError(error,true); } }
