'use client';
import { useEffect, useState } from 'react';
import './reset-password.css';

export default function ResetPasswordPage() {
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('Checking your recovery link…');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [credential, setCredential] = useState(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const failure = query.get('error_description') || hash.get('error_description');
    const tokenHash = query.get('token_hash');
    const type = query.get('type') || hash.get('type');
    const access = hash.get('access_token');
    const refresh = hash.get('refresh_token');
    if (failure) { setStatus('request'); setMessage(failure); }
    else if (tokenHash && type === 'recovery') { setCredential({ token_hash: tokenHash, type: 'recovery' }); setStatus('ready'); setMessage('Enter your new password.'); }
    else if (access && refresh && type === 'recovery') { setCredential({ access_token: access, refresh_token: refresh, type: 'recovery' }); setStatus('ready'); setMessage('Enter your new password.'); }
    else { setStatus('request'); setMessage('Enter your account email to request a new password-reset link.'); }
    // Remove temporary authentication tokens from the address bar after storing them in memory.
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  async function api(path, data) {
    const res = await fetch(path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.message || 'Request failed.');
    return result;
  }
  async function requestReset(event) {
    event.preventDefault(); if (busy || !email.trim()) return;
    setBusy(true);
    try { const result = await api('/api/auth/recovery', { email: email.trim() }); setStatus('sent'); setMessage(result.message); }
    catch (error) { setMessage(error?.message || 'Could not send email.'); }
    finally { setBusy(false); }
  }
  async function updatePassword(event) {
    event.preventDefault(); if (!credential || busy) return;
    if (password.length < 12) { setMessage('Use at least 12 characters.'); return; }
    if (password !== confirm) { setMessage('Passwords do not match.'); return; }
    setBusy(true);
    try { const result = await api('/api/auth/recovery/complete', { ...credential, password }); setCredential(null); setPassword(''); setConfirm(''); setStatus('done'); setMessage(result.message); }
    catch (error) { setMessage(error?.message || 'Password update failed.'); setStatus('request'); setCredential(null); }
    finally { setBusy(false); }
  }
  return <main className="jmp-recovery"><section className="jmp-recovery-panel">
    <p className="jmp-recovery-eyebrow">JMP CORETAX CMS</p><h1>Reset admin password</h1>
    <p className="jmp-recovery-message" role="status">{message}</p>
    {status === 'ready' && <form onSubmit={updatePassword}>
      <label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)}/>
      <label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e => setConfirm(e.target.value)}/>
      <button disabled={busy} type="submit">{busy ? 'Updating…' : 'Update password'}</button>
    </form>}
    {(status === 'request' || status === 'sent') && <form onSubmit={requestReset}>
      <label htmlFor="recovery-email">Admin account email</label><input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/>
      <button disabled={busy} type="submit">{busy ? 'Sending…' : 'Send reset link'}</button>
    </form>}
    <a href="/admin">Return to admin login</a>
  </section></main>;
}
