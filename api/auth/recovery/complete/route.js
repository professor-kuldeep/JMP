import { NextResponse } from 'next/server';
import { supabaseAuthClient, supabaseAdmin } from '../../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reply = (message, status = 200) => NextResponse.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return reply('Invalid request origin.', 403);
  if (!(request.headers.get('content-type') || '').includes('application/json')) return reply('JSON required.', 415);
  const body = await request.json().catch(() => ({}));
  const password = String(body.password || '');
  if (password.length < 12 || password.length > 256) return reply('Password must contain 12–256 characters.', 400);
  const client = supabaseAuthClient();
  if (!client) return reply('Password recovery is not configured.', 503);
  let session = null;
  try {
    if (body.token_hash && body.type === 'recovery') {
      const result = await client.auth.verifyOtp({ token_hash: String(body.token_hash), type: 'recovery' });
      if (result.error) throw result.error;
      session = result.data?.session;
    } else if (body.access_token && body.refresh_token && body.type === 'recovery') {
      const result = await client.auth.setSession({ access_token: String(body.access_token), refresh_token: String(body.refresh_token) });
      if (result.error) throw result.error;
      session = result.data?.session;
    } else return reply('Recovery link is missing or unsupported. Please request a new recovery link.', 400);
    if (!session?.access_token || !session.user?.id) return reply('The recovery link could not establish a session.', 401);
    // A recovery token proves control of the account email; it must not
    // allow a password reset for an account outside this CMS.
    const db = supabaseAdmin();
    if (!db) return reply('Admin password recovery is not configured.', 503);
    const { data: profile, error: lookupError } = await db.from('cms_profiles')
      .select('user_id').eq('user_id', session.user.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!profile) return reply('No CMS admin profile is associated with this account. Contact a Super Admin.', 403);
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    // Supabase Auth password changes do not invalidate our separate signed
    // CMS session cookies. Revoke every CMS admin session after the reset.
    const { error: revokeError } = await db.from('cms_admin_sessions')
      .update({ revoked: true })
      .eq('user_id', session.user.id)
      .eq('revoked', false);
    if (revokeError) throw revokeError;
    await client.auth.signOut({ scope: 'local' }).catch(() => {});
    return reply('Password updated successfully. Return to admin login with your existing authenticator.');
  } catch (error) { console.error('Password recovery verification failed:', error?.message); return reply('The link is invalid, expired or the password update failed. Request a fresh recovery email.', 400); }
}
