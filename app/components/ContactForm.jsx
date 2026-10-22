'use client';
import { useState } from 'react';
import TurnstileWidget from './TurnstileWidget';

const fallbackServices = ['Accounting / Bookkeeping', 'GST Compliance', 'Income Tax', 'Audit & Assurance', 'Business Advisory', 'Other'];

export default function ContactForm({ services = fallbackServices, heading = 'Send an Enquiry', successMessage = 'Thank you. Your enquiry has been submitted.' }) {
  const [status, setStatus] = useState(''); const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(''); const [turnstileReset, setTurnstileReset] = useState(0);
  const options = Array.isArray(services) && services.length ? services : fallbackServices;

  async function submit(event) {
    event.preventDefault(); setLoading(true); setStatus('');
    const form = event.currentTarget; const payload = { ...Object.fromEntries(new FormData(form).entries()), turnstileToken };
    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Unable to submit enquiry.');
      setStatus(successMessage); form.reset(); setTurnstileToken(''); setTurnstileReset((value) => value + 1);
      setTimeout(() => { window.location.href = '/thank-you'; }, 650);
    } catch (error) { setStatus(error.message || 'Something went wrong. Please try again.'); setTurnstileToken(''); setTurnstileReset((value) => value + 1); }
    finally { setLoading(false); }
  }

  return <form className="contact-form" onSubmit={submit}>
    {heading && <h3>{heading}</h3>}
    <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <div className="field"><label>Name *</label><input name="name" required /></div>
    <div className="field"><label>Email *</label><input type="email" name="email" required /></div>
    <div className="field"><label>Phone</label><input name="phone" /></div>
    <div className="field"><label>Service Interested In</label><select name="service">{options.map((item) => <option key={item}>{item}</option>)}</select></div>
    <div className="field"><label>Message *</label><textarea name="message" required></textarea></div>
    <TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileReset} action="contact" />
    <button className="btn" disabled={loading}>{loading ? 'Submitting...' : 'Submit Enquiry →'}</button>
    {status && <div className="form-status">{status}</div>}
  </form>;
}
