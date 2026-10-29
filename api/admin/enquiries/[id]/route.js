import { NextResponse } from 'next/server';
import { requirePermission } from '../../../../lib/auth';
import { getEnquiries, saveEnquiries } from '../../../../lib/store';
import { apiError } from '../../../../lib/api-error';
import { writeSecurityAudit } from '../../../../lib/security';
import { cleanText } from '../../../../lib/validation';

export async function PUT(request, { params }) {
  try {
    const session = await requirePermission(request, 'enquiries:write', { csrf: true }); const { id } = await params; const payload = await request.json();
    const enquiries = await getEnquiries(); const index = enquiries.findIndex((item) => String(item.id) === String(id));
    if (index === -1) return NextResponse.json({ message: 'Enquiry not found.' }, { status: 404 });
    const changes = {};
    if (Object.prototype.hasOwnProperty.call(payload,'status')) { const status = cleanText(payload.status,40).trim(); if (!['new','contacted','in-progress','closed'].includes(status)) return NextResponse.json({ message:'Invalid enquiry status.' },{status:400}); changes.status=status; }
    if (Object.prototype.hasOwnProperty.call(payload,'notes')) changes.notes = cleanText(payload.notes,5000).trim();
    if(Object.hasOwn(payload,'assignedTo'))changes.assignedTo=cleanText(payload.assignedTo,120).trim();
    if(Object.hasOwn(payload,'followUpAt')){const date=payload.followUpAt?new Date(payload.followUpAt):null;if(date&&!Number.isFinite(date.getTime()))return NextResponse.json({message:'Choose a valid follow-up date.'},{status:400});changes.followUpAt=date?date.toISOString():'';}
    const changed=Object.keys(changes).filter(key=>changes[key]!==enquiries[index][key]);
    if(changed.length)changes.activity=[{at:new Date().toISOString(),by:session.username,action:'Updated '+changed.join(', ')},...(enquiries[index].activity||[])].slice(0,100);
    const enquiry = { ...enquiries[index], ...changes, updatedAt:new Date().toISOString(), updatedBy:session.username }; const next=[...enquiries]; next[index]=enquiry; await saveEnquiries(next);
    await writeSecurityAudit(request,session,'enquiry_updated',`enquiry:${id}`,{status:enquiry.status}); return NextResponse.json({ enquiry });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request,{params}) {
  try { const session=await requirePermission(request,'enquiries:delete',{csrf:true}); const {id}=await params; const enquiries=await getEnquiries(); await saveEnquiries(enquiries.filter((item)=>String(item.id)!==String(id))); await writeSecurityAudit(request,session,'enquiry_deleted',`enquiry:${id}`); return NextResponse.json({success:true}); }
  catch(error){ return apiError(error); }
}
