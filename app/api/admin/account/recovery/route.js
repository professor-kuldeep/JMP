import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { resetRecoveryCodes } from '../../../../lib/users';
import { apiError } from '../../../../lib/api-error'; import { writeSecurityAudit } from '../../../../lib/security';
export async function POST(request){try{const session=await requireAdmin(request,{csrf:true});const recoveryCodes=await resetRecoveryCodes(session.userId);await writeSecurityAudit(request,session,'recovery_codes_self_reset',`user:${session.userId}`);return NextResponse.json({recoveryCodes});}catch(error){return apiError(error);}}
