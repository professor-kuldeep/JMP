import { NextResponse } from 'next/server';
import { createAdminSession, setSessionCookie, userPayload } from '../../../lib/auth';
import { checkLoginRateLimit, claimTotpUse, clearLoginRateLimit, getSecurityConfigStatus, isProduction, isAdminIpAllowed, sendSecurityAlert, verifyRequestOrigin, verifyTotp, verifyTurnstile, writeSecurityAudit } from '../../../lib/security';
import { authenticateUser, consumeRecoveryCode, findUserByUsername } from '../../../lib/users';
import { apiError } from '../../../lib/api-error';

export async function POST(request) {
  try {
    if (!verifyRequestOrigin(request)) return NextResponse.json({ message: 'Invalid request origin.' }, { status: 403 });
    if (!isAdminIpAllowed(request)) { await writeSecurityAudit(request, null, 'login_blocked_ip', 'admin'); return NextResponse.json({ message: 'Admin access is not allowed from this network.' }, { status: 403 }); }
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const otp = String(body.otp || '').trim();
    const security = getSecurityConfigStatus();
    if (isProduction() && (!security.adminSecretStrong || !security.supabase || !security.supabaseAuth)) return NextResponse.json({ message: 'Secure admin setup is incomplete. Configure Supabase and ADMIN_SECRET, then redeploy.' }, { status: 503 });
    const turnstile = await verifyTurnstile(body.turnstileToken, request);
    if (!turnstile.ok) { await writeSecurityAudit(request, null, 'login_turnstile_failed', 'admin', { username }); return NextResponse.json({ message: 'Security verification failed. Refresh the page and try again.' }, { status: 403 }); }
    const limit = await checkLoginRateLimit(request, username);
    if (limit.unavailable) return NextResponse.json({ message: 'Security rate limiting is unavailable because Supabase is not configured correctly.' }, { status: 503 });
    if (!limit.allowed) { await writeSecurityAudit(request, null, 'login_rate_limited', 'admin', { username }); await sendSecurityAlert({ type: 'login_rate_limited', username, at: new Date().toISOString() }); return NextResponse.json({ message: 'Too many login attempts. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 900) } }); }
    const user = await findUserByUsername(username);
    const authResult = user && !user.disabled ? await authenticateUser(user, password) : { ok: false };
    const passwordOk = Boolean(authResult.ok);
    let secondFactorOk = false;
    let usedRecoveryCode = false;
    if (passwordOk) {
      if (!user.twoFactorEnabled || !user.totpSecret) secondFactorOk = process.env.SECURITY_REQUIRE_2FA === 'false';
      else if (/^\d{6}$/.test(otp)) secondFactorOk = verifyTotp(user.totpSecret, otp) && await claimTotpUse(user.id, otp);
      else if (otp) { secondFactorOk = await consumeRecoveryCode(user, otp); usedRecoveryCode = secondFactorOk; }
    }
    if (!passwordOk || !secondFactorOk) { await writeSecurityAudit(request, null, 'login_failed', 'admin', { username, reason: !passwordOk ? 'credentials' : 'two_factor' }); return NextResponse.json({ message: 'Invalid username, password or verification code.' }, { status: 401 }); }
    await clearLoginRateLimit(request, username);
    const { token, session } = await createAdminSession(user, request);
    const response = NextResponse.json({ user: userPayload(session), csrfToken: session.csrfToken, recoveryCodeUsed: usedRecoveryCode });
    setSessionCookie(response, token);
    await writeSecurityAudit(request, session, usedRecoveryCode ? 'login_success_recovery_code' : 'login_success', 'admin');
    await sendSecurityAlert({ type: 'admin_login', username, role: user.role, recoveryCodeUsed: usedRecoveryCode, at: new Date().toISOString() });
    return response;
  } catch (error) { return apiError(error, 'Login failed.'); }
}
