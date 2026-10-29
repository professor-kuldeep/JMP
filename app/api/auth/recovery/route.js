import { NextResponse } from 'next/server';
import { supabaseAuthClient } from '../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store' };
function sameOrigin(request) { const origin = request.headers.get('origin'); return origin && origin === new URL(request.url).origin; }
function response(message, status = 200) { return NextResponse.json({ message }, { status, headers: noStore }); }
export async function POST(request) {
  if (!sameOrigin(request)) return response('Invalid request origin.', 403);
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) return response('JSON required.', 415);
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response('Enter a valid email.', 400);
  const client = supabaseAuthClient();
  if (!client) return response('Password recovery is not configured. Check Supabase server environment variables.', 503);
  try {
    const redirectTo = `${new URL(request.url).origin}/reset-password`;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    // Do not disclose whether a user exists. Rate-limiting is also enforced by Supabase Auth.
    if (error && (error.status === 429 || /rate limit/i.test(error.message))) return response('Too many requests. Please try again later.', 429);
    if (error) { console.error('Recovery email could not be sent:', error.message); return response('Recovery email service is currently unavailable. Check the server logs and Supabase Auth settings.', 503); }
    return response('If this address has an account, a recovery email has been sent.');
  } catch (error) { console.error('Recovery request failed:', error?.message); return response('Recovery service is currently unavailable.', 503); }
}
