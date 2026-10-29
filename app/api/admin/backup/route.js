import { NextResponse } from 'next/server';
import { requirePermission } from '../../../lib/auth';
import { getData, replaceData } from '../../../lib/store';
import { apiError } from '../../../lib/api-error'; import { writeSecurityAudit } from '../../../lib/security'; import { sanitizeCmsValue } from '../../../lib/validation';
export async function GET(request){
  try{await requirePermission(request,'backup:export');const {searchParams}=new URL(request.url);const includeEnquiries=searchParams.get('includeEnquiries')==='true';if(includeEnquiries)await requirePermission(request,'enquiries:export');const data=await getData();const safe={...data,enquiries:includeEnquiries?(data.enquiries||[]):[]};return new NextResponse(JSON.stringify(safe,null,2),{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="coretax-cms-backup-${new Date().toISOString().slice(0,10)}${includeEnquiries?'-with-enquiries':''}.json"`,'Cache-Control':'private, no-store'}});}catch(error){return apiError(error);}
}
export async function POST(request){
  try{const session=await requirePermission(request,'*',{csrf:true});if(session.role!=='super_admin')return NextResponse.json({message:'Only the Super Admin can restore a complete CMS backup.'},{status:403});const payload=sanitizeCmsValue(await request.json());if(!payload||!Array.isArray(payload.pages)||typeof payload.settings!=='object'||typeof payload.menus!=='object')return NextResponse.json({message:'Invalid CMS backup file.'},{status:400});const restored=await replaceData(payload);await writeSecurityAudit(request,session,'backup_restored','cms');return NextResponse.json({success:true,updatedAt:restored.updatedAt});}catch(error){return apiError(error);}
}
