import { NextResponse } from 'next/server';
import { requireAdmin, revokeUserSessions } from '../../../../../lib/auth';
import { publicUser, resetTwoFactor } from '../../../../../lib/users';
import { apiError } from '../../../../../lib/api-error';
import { sendSecurityAlert, writeSecurityAudit } from '../../../../../lib/security';
export async function POST(request,{params}){try{const session=await requireAdmin(request,{csrf:true});if(session.role!=='super_admin')return NextResponse.json({message:'Only the Super Admin can reset two-factor authentication.'},{status:403});const{id}=await params;const result=await resetTwoFactor(id);await revokeUserSessions(id);await writeSecurityAudit(request,session,'two_factor_reset',`user:${id}`,{username:result.user.username});await sendSecurityAlert({type:'two_factor_reset',actor:session.username,username:result.user.username,at:new Date().toISOString()});return NextResponse.json({user:publicUser(result.user),totpSecret:result.totpSecret,recoveryCodes:result.recoveryCodes,otpauthUri:result.otpauthUri});}catch(error){return apiError(error);}}
