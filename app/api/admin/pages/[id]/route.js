import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { normalizePublication } from '../../../../lib/publishing.mjs';
import { requirePermission } from '../../../../lib/auth';
import { cleanSlug } from '../../../../lib/utils';
import { getPages, getRevisions, savePages, saveRevisions } from '../../../../lib/store';
import { apiError } from '../../../../lib/api-error';
import { writeSecurityAudit } from '../../../../lib/security';
import { sanitizeCmsValue } from '../../../../lib/validation';

export async function PUT(request, { params }) {
  try {
    const session = await requirePermission(request, 'pages:write', { csrf: true });
    const { id } = await params; const payload = normalizePublication(sanitizeCmsValue(await request.json())); const pageId = Number(id);
    const pages = await getPages(); const index = pages.findIndex((page) => Number(page.id) === pageId);
    if (index === -1) return NextResponse.json({ message: 'Page not found.' }, { status: 404 });
    const currentPage = pages[index];
    if (payload.updatedAt && currentPage.updatedAt && String(payload.updatedAt) !== String(currentPage.updatedAt)) {
      return NextResponse.json({ message: `This page was changed by ${currentPage.updatedBy || 'another administrator'} after you opened it. Reload the latest version before saving so their work is not overwritten.`, code: 'EDIT_CONFLICT', currentUpdatedAt: currentPage.updatedAt }, { status: 409 });
    }
    if (payload.status === 'published') await requirePermission(request, 'pages:publish');
    const slug = pages[index].slug === 'home' ? 'home' : cleanSlug(payload.slug || payload.title);
    if (['book-consultation','booking','blog','admin','api','robots.txt','sitemap.xml','reset-password'].includes(slug)) return NextResponse.json({ message: 'This URL slug is reserved. Choose another slug.' }, { status: 400 });
    if (slug !== pages[index].slug && pages.some((page) => page.slug === slug)) return NextResponse.json({ message: 'A page with this slug already exists.' }, { status: 409 });
    const revisions = await getRevisions(); const key = String(pageId); const history = revisions[key] || [];
    revisions[key] = [{ id: crypto.randomUUID(), savedAt: new Date().toISOString(), savedBy: session.username, page: structuredClone(pages[index]) }, ...history].slice(0, 30);
    const updated = { ...pages[index], ...payload, id: pageId, slug, sections: Array.isArray(payload.sections) ? payload.sections : [], updatedAt: new Date().toISOString(), updatedBy: session.username };
    const nextPages = [...pages]; nextPages[index] = updated;
    await Promise.all([savePages(nextPages), saveRevisions(revisions)]);
    await writeSecurityAudit(request, session, 'page_updated', `page:${pageId}`, { title: updated.title, slug: updated.slug, status: updated.status });
    return NextResponse.json({ page: updated });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request, { params }) {
  try {
    const session = await requirePermission(request, 'pages:delete', { csrf: true }); const { id } = await params; const pageId = Number(id);
    const pages = await getPages(); const page = pages.find((item) => Number(item.id) === pageId);
    if (!page) return NextResponse.json({ message: 'Page not found.' }, { status: 404 });
    if (page.slug === 'home') return NextResponse.json({ message: 'Home page cannot be deleted.' }, { status: 400 });
    const revisions = await getRevisions(); delete revisions[String(pageId)];
    await Promise.all([savePages(pages.filter((item) => Number(item.id) !== pageId)), saveRevisions(revisions)]);
    await writeSecurityAudit(request, session, 'page_deleted', `page:${pageId}`, { title: page.title, slug: page.slug });
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
