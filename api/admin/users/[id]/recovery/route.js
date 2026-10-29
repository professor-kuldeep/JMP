import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth';
import { getUserById, resetRecoveryCodes } from '../../../../../lib/users';
import { apiError } from '../../../../../lib/api-error'; import { writeSecurityAudit } from '../../../../../lib/security';
export async function POST(request,{params}){try{const session=await requireAdmin(request,{csrf:true});if(session.role!=='super_admin')return NextResponse.json({message:'Only the Super Admin can reset recovery codes.'},{status:403});const{id}=await params;const user=await getUserById(id);if(!user)return NextResponse.json({message:'User not found.'},{status:404});const recoveryCodes=await resetRecoveryCodes(id);await writeSecurityAudit(request,session,'recovery_codes_reset',`user:${id}`,{username:user.username});return NextResponse.json({recoveryCodes});}catch(error){return apiError(error);}}
