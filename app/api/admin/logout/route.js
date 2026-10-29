import { NextResponse } from 'next/server';
import { clearSessionCookie, destroyCurrentSession, requireAdmin } from '../../../lib/auth';
import { writeSecurityAudit } from '../../../lib/security';
import { apiError } from '../../../lib/api-error';

export async function POST(request) {
  try {
    const session = await requireAdmin(request, { csrf: true });
    await writeSecurityAudit(request, session, 'logout', 'admin');
    await destroyCurrentSession();
    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  } catch (error) { return apiError(error); }
}
