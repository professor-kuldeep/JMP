import { NextResponse } from 'next/server';
import { requirePermission } from '../../../lib/auth';
import { getPages, getRevisions, savePages, saveRevisions } from '../../../lib/store';
import { contentPlan, applyContentPlan } from '../../../lib/content-upgrade.mjs';
import { writeSecurityAudit } from '../../../lib/security';
import { apiError } from '../../../lib/api-error';
export async function GET(request) {
  try {await requirePermission(request,'pages:read');return NextResponse.json(contentPlan(await getPages()));} catch(error){return apiError(error);}
}
export async function POST(request) {
  try {
    const session=await requirePermission(request,'pages:write',{csrf:true});
    await requirePermission(request,'pages:publish');
    const payload=await request.json();
    const pages=await getPages(), plan=contentPlan(pages);
    if (payload.fingerprint!==plan.fingerprint) return NextResponse.json({message:'Content changed since this plan was opened. Refresh the plan before applying it.'},{status:409});
    if (!plan.changes.length) return NextResponse.json({applied:0,message:'The content pack is already up to date.'});
    const next=applyContentPlan(pages,await getRevisions(),session.username);
    await saveRevisions(next.revisions);
    await savePages(next.pages);
    await writeSecurityAudit(request,session,'content_pack_applied','pages',{slugs:next.changes.map(item=>item.slug).join(',')});
    return NextResponse.json({applied:next.changes.length,message:'Content pack applied. New service pages are drafts for review before publishing.'});
  } catch(error){return apiError(error);}
}
