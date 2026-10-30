'use client';
import {useEffect, useRef, useState} from 'react';
import TurnstileWidget from './TurnstileWidget';
export default function AppointmentWaitlist({date, staffId = 'default', services = []}) {
 const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [turnstile, setTurnstile] = useState(''), [reset, setReset] = useState(0), key = useRef(null), lock = useRef(false);
 async function submit(event) {
  event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError(''); key.current ||= crypto.randomUUID();
  const fields = Object.fromEntries(new FormData(event.currentTarget));
  try { const response = await fetch('/api/booking/waitlist', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...fields, date, staffId, requestId: key.current, consent: fields.consent === 'on', turnstileToken: turnstile})}), data = await response.json(); if (!response.ok) throw new Error(data.message); setNotice(data.message); }
  catch (e) { setError(e.message || 'Please try again.'); setTurnstile(''); setReset(n => n + 1); }
  finally { lock.current = false; setBusy(false); }
 }
 if (notice) return <div className="practice-notice" role="status">{notice}</div>;
 return <details className="practice-panel"><summary>Let me know if a time opens on {date}</summary><p className="practice-muted">Join the waiting list for this date. A notification gives you a chance to book; it does not reserve a time.</p><form className="practice-form" onSubmit={submit}><fieldset disabled={busy}><div className="practice-form-grid"><label>Name<input name="name" autoComplete="name" maxLength={120} required/></label><label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required/></label><label>Service<select name="service" required><option value="">Choose a service</option>{services.map(s => <option key={s}>{s}</option>)}</select></label></div><label className="practice-check"><input type="checkbox" name="consent" required/>Email me about this waiting-list request.</label><TurnstileWidget onToken={setTurnstile} resetKey={reset} action="booking_waitlist"/>{error && <p className="practice-notice error" role="alert">{error}</p>}<button className="practice-button" disabled={busy}>{busy ? 'Saving request…' : 'Join waiting list'}</button></fieldset></form></details>;
}
export function WaitingListCancellation() {
 const [credentials, setCredentials] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
 useEffect(() => { const [id, token] = window.location.hash.slice(1).split('.'); window.history.replaceState(null, '', window.location.pathname); if (/^[a-f0-9-]{36}$/i.test(id || '') && /^[a-f0-9]{64}$/.test(token || '')) setCredentials({id, token}); else setMessage('Open the private cancellation link from your waiting-list email.'); }, []);
 async function cancel() { setBusy(true); setMessage(''); try { const response = await fetch('/api/booking/waitlist', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...credentials, action: 'cancel'})}), data = await response.json(); if (!response.ok) throw new Error(data.message); setMessage('You have left this appointment waiting list.'); setCredentials(null); } catch (e) { setMessage(e.message || 'Please try again.'); } finally { setBusy(false); } }
 return <main id="main-content" className="portal-shell"><span className="eyebrow">Appointment waiting list</span><h1>Manage your request.</h1>{message && <p role="status">{message}</p>}{credentials && <><p>Use this button to stop notifications for this waiting-list request.</p><button className="practice-button" disabled={busy} onClick={cancel}>{busy ? 'Updating…' : 'Leave waiting list'}</button></>}</main>;
}
