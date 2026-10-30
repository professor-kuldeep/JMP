import {requirePermission} from '../../../../lib/auth';
import {uploadPracticeDocument, documentDownload} from '../../../../lib/practice-store';
import {readDocumentForm} from '../../../../lib/http-body.mjs';
import {practiceJson, practiceApiError} from '../../../../lib/practice-http';
export async function GET(request) { try { await requirePermission(request, 'practice:read'); return practiceJson(await documentDownload(new URL(request.url).searchParams.get('id'))); } catch (error) { return practiceApiError(error); } }
export async function POST(request) { try { const session = await requirePermission(request, 'practice:write', {csrf: true}); return practiceJson({document: await uploadPracticeDocument(await readDocumentForm(request), session.username)}); } catch (error) { return practiceApiError(error); } }
