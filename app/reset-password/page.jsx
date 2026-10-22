'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import './reset-password.css';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function ResetPasswordPage() {
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('Checking your recovery link…');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [client, setClient] = useState(null);

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) {
      setStatus('request');
      setMessage('Enter your email to request a reset link. The recovery form requires Supabase browser settings to finish the reset.');
      return;
    }
    // This is a dedicated recovery page. Never reuse its session for the CMS admin login.
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { detectSessionInUrl: false, persistSession: false, autoRefreshToken: false, flowType: 'implicit' }
    });
    setClient(supabase);
    let active = true;
    const ready = () => {
      if (!active) return;
      setStatus('ready');
      setMessage('Set a new password for your JMP CMS account.');
      window.history.replaceState({}, '', window.location.pathname);
    };
    (async () => {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const failure = query.get('error_description') || hash.get('error_description');
      const code = query.get('code');
      const tokenHash = query.get('token_hash');
      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');
      const type = query.get('type') || hash.get('type');
      if (!active) return;
      if (failure) {
        setStatus('request'); setMessage(decodeURIComponent(failure)); return;
      }
      if (!code && !tokenHash && !accessToken) {
        setStatus('request'); setMessage('Enter your account email to request a fresh password-reset link.'); return;
      }
      try {
        let error;
        if (tokenHash && type === 'recovery') {
          ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' }));
        } else if (accessToken && refreshToken && type === 'recovery') {
          ({ error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }));
        } else if (code) {
          // PKCE recovery, if configured separately by the email template.
          ({ error } = await supabase.auth.exchangeCodeForSession(code));
        } else {
          throw new Error('This link is not a password-recovery link. Request a new reset email.');
        }
        if (error) throw error;
        if (active) ready();
      } catch (err) {
        if (!active) return;
        window.history.replaceState({}, '', window.location.pathname);
        setStatus('request');
        setMessage(err?.message || 'The recovery link could not be verified. Request a new email.');
      }
    })();
    // Do NOT sign out here: component cleanup must not invalidate an in-progress recovery flow.
    return () => { active = false; };
  }, []);

  async function requestReset(event) {
    event.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    try {
      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Unable to send reset email.');
      setStatus('sent');
      setMessage('If this account exists, a password-reset email has been sent. Open the newest email and use its link.');
    } catch (err) {
      setMessage(err?.message || 'Could not send reset email. Please retry later.');
    } finally { setBusy(false); }
  }

  async function updatePassword(event) {
    event.preventDefault();
    if (!client || status !== 'ready' || busy) return;
    if (password.length < 12) return setMessage('Use a password with at least 12 characters.');
    if (password !== confirm) return setMessage('The passwords do not match.');
    setBusy(true); setMessage('Updating password…');
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      await client.auth.signOut({ scope: 'local' });
      setPassword(''); setConfirm(''); setStatus('done');
      setMessage('Password updated. Return to JMP CMS login with your username, new password and existing 2FA code.');
    } catch (err) {
      setMessage(err?.message || 'Unable to update password. Request a new recovery link.');
    } finally { setBusy(false); }
  }

  return <main className="jmp-recovery"><section className="jmp-recovery-panel">
    <p className="jmp-recovery-eyebrow">JMP CORETAX CMS</p>
    <h1>Reset admin password</h1>
    <p role="status" className="jmp-recovery-message">{message}</p>
    {status === 'ready' && <form onSubmit={updatePassword}>
      <label htmlFor="jmp-new-pass">New password</label>
      <input id="jmp-new-pass" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} />
      <label htmlFor="jmp-confirm-pass">Confirm password</label>
      <input id="jmp-confirm-pass" type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e => setConfirm(e.target.value)} />
      <button type="submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
    </form>}
    {(status === 'request' || status === 'sent') && <form onSubmit={requestReset}>
      <label htmlFor="jmp-recovery-email">Admin account email</label>
      <input id="jmp-recovery-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
      <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
    </form>}
    <a href="/admin">Return to admin login</a>
  </section></main>;
}
