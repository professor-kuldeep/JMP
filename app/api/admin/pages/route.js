import { NextResponse } from 'next/server';
import { normalizePublication } from '../../../lib/publishing.mjs';
import { requirePermission } from '../../../lib/auth';
import { cleanSlug } from '../../../lib/utils';
import { getPages, nextId, savePages } from '../../../lib/store';
import { apiError } from '../../../lib/api-error';
import { writeSecurityAudit } from '../../../lib/security';
import { sanitizeCmsValue } from '../../../lib/validation';

export async function GET(request) {
  try { await requirePermission(request, 'pages:read'); const pages = [...await getPages()].sort((a,b)=>(a.order||999)-(b.order||999)); return NextResponse.json({ pages }); }
  catch (error) { return apiError(error); }
}
export async function POST(request) {
  try {
    const session = await requirePermission(request, 'pages:write', { csrf: true });
    const payload = normalizePublication(sanitizeCmsValue(await request.json()));
    if (payload.status === 'published') await requirePermission(request, 'pages:publish');
    const pages = await getPages(); const slug = cleanSlug(payload.slug || payload.title);
    if (['book-consultation','booking','blog','admin','api','robots.txt','sitemap.xml','reset-password'].includes(slug)) return NextResponse.json({ message: 'This URL slug is reserved. Choose another slug.' }, { status: 400 });
    if (pages.some((page) => page.slug === slug)) return NextResponse.json({ message: 'A page with this slug already exists.' }, { status: 409 });
    const page = { ...payload, id: nextId(pages), slug, status: payload.status || 'draft', title: payload.title || 'New Page', sections: Array.isArray(payload.sections) ? payload.sections : [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedBy: session.username };
    await savePages([...pages, page]);
    await writeSecurityAudit(request, session, 'page_created', `page:${page.id}`, { title: page.title, slug: page.slug, status: page.status });
    return NextResponse.json({ page });
  } catch (error) { return apiError(error); }
}
