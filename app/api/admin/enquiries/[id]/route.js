import {NextResponse} from 'next/server';
import {requirePermission} from '../../../../lib/auth';
import {readEnquiry,updateEnquiry,deleteEnquiry} from '../../../../lib/crm-store';
import {enquiryChanges} from '../../../../lib/crm.mjs';
import {apiError} from '../../../../lib/api-error';
import {writeSecurityAudit} from '../../../../lib/security';
export async function GET(request,{params}){try{await requirePermission(request,'enquiries:read');const {_requestKey,_fingerprint,...enquiry}=await readEnquiry((await params).id);return NextResponse.json({enquiry});}catch(error){return apiError(error);}}
export async function PUT(request,{params}){try{const session=await requirePermission(request,'enquiries:write',{csrf:true}),{id}=await params,payload=await request.json();const enquiry=await updateEnquiry(id,enquiryChanges(payload),payload.updatedAt,session.username);await writeSecurityAudit(request,session,'enquiry_updated',`enquiry:${id}`,{status:enquiry.status});const {_requestKey,_fingerprint,...safe}=enquiry;return NextResponse.json({enquiry:safe});}catch(error){return apiError(error);}}
export async function DELETE(request,{params}){try{const session=await requirePermission(request,'enquiries:delete',{csrf:true}),{id}=await params;await deleteEnquiry(id);await writeSecurityAudit(request,session,'enquiry_deleted',`enquiry:${id}`);return NextResponse.json({success:true});}catch(error){return apiError(error);}}
