import { NextResponse } from 'next/server';
import { supabaseAuthClient } from '../../../lib/supabase';

export async function POST(request) {
  const json = (message, status = 200) => NextResponse.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } });
  const origin = request.headers.get('origin');
  const target = new URL(request.url);
  if (!origin || origin !== target.origin) return json('Request origin not allowed.', 403);
  const type = request.headers.get('content-type') || '';
  if (!type.startsWith('application/json')) return json('JSON required.', 415);
  let body;
  try { body = await request.json(); } catch { return json('Invalid request.', 400); }
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json('Enter a valid email.', 400);
  const supabase = supabaseAuthClient();
  if (!supabase) return json('Password recovery is not configured. Contact the administrator.', 503);
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${target.origin}/reset-password` });
    if (error) {
      // Suppress account enumeration and hide internal Supabase API details.
      if (error.status === 429) return json('Too many requests. Try again later.', 429);
      console.error('Recovery email request failed:', error.status || 'unknown', error.code || 'unknown');
      return json('Recovery email could not be sent. Check the Supabase Auth configuration and email delivery settings.', 502);
    }
    return json('If an account exists for this email, a password-reset email has been sent.');
  } catch (error) {
    console.error('Supabase recovery network request failed:', error?.name || 'error');
    return json('Recovery email service is unavailable. Check the Supabase URL and deployment settings.', 502);
  }
}
