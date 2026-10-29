import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { requirePermission } from '../../../../../lib/auth';
import { getPages, getRevisions, savePages, saveRevisions } from '../../../../../lib/store';
import { apiError } from '../../../../../lib/api-error';
import { writeSecurityAudit } from '../../../../../lib/security';

export async function GET(request, { params }) {
  try { await requirePermission(request, 'pages:read'); const { id } = await params; const revisions = await getRevisions(); return NextResponse.json({ revisions: revisions[String(id)] || [] }); }
  catch (error) { return apiError(error); }
}
export async function POST(request, { params }) {
  try {
    const session = await requirePermission(request, 'pages:restore', { csrf: true }); const { id } = await params; const pageId = Number(id); const { revisionId } = await request.json();
    const [pages, revisions] = await Promise.all([getPages(), getRevisions()]); const index = pages.findIndex((page) => Number(page.id) === pageId);
    if (index === -1) return NextResponse.json({ message: 'Page not found.' }, { status: 404 });
    const key = String(pageId); const history = revisions[key] || []; const revision = history.find((item) => String(item.id) === String(revisionId));
    if (!revision?.page) return NextResponse.json({ message: 'Revision not found.' }, { status: 404 });
    const current = structuredClone(pages[index]); revisions[key] = [{ id: crypto.randomUUID(), savedAt: new Date().toISOString(), savedBy: session.username, page: current }, ...history].slice(0, 30);
    const restored = { ...structuredClone(revision.page), id: pageId, updatedAt: new Date().toISOString(), updatedBy: session.username }; const nextPages = [...pages]; nextPages[index] = restored;
    await Promise.all([savePages(nextPages), saveRevisions(revisions)]); await writeSecurityAudit(request, session, 'page_revision_restored', `page:${pageId}`, { revisionId });
    return NextResponse.json({ page: restored });
  } catch (error) { return apiError(error); }
}
