import { NextResponse } from 'next/server';
import { clearSessionCookie, requireAdmin, revokeAllSessions } from '../../../../lib/auth';
import { sendSecurityAlert, writeSecurityAudit } from '../../../../lib/security';
import { apiError } from '../../../../lib/api-error';
export async function POST(request){try{const session=await requireAdmin(request,{csrf:true});if(session.role!=='super_admin')return NextResponse.json({message:'Only the Super Admin can sign out every administrator session.'},{status:403});const revoked=await revokeAllSessions();await writeSecurityAudit(request,session,'logout_all_sessions','security',{revoked});await sendSecurityAlert({type:'logout_all_sessions',username:session.username,revoked,at:new Date().toISOString()});const response=NextResponse.json({success:true,revoked});clearSessionCookie(response);return response;}catch(error){return apiError(error);}}
