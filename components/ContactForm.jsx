'use client';
import { useEffect, useId, useState } from 'react';
import Icon from './Icon';
import { trackEvent, enquiryAttribution } from '../lib/analytics.mjs';
import { PAGE_SERVICES } from '../lib/service-links.mjs';
import TurnstileWidget from './TurnstileWidget';

const fallbackServices = ['Accounting / Bookkeeping', 'GST Compliance', 'Income Tax', 'Audit & Assurance', 'Business Advisory', 'Other'];

export default function ContactForm({ services = fallbackServices, heading = 'Send an Enquiry', successMessage = 'Thank you. Your enquiry has been submitted.', preview = false }) {
  const formId = useId();
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState(''); const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(''); const [turnstileReset, setTurnstileReset] = useState(0);
  const options = Array.isArray(services) && services.length ? services : fallbackServices;

  const [selectedService,setSelectedService]=useState('');
  const [requestedService,setRequestedService]=useState('');
  useEffect(()=>{if(preview)return;const requested=new URLSearchParams(window.location.search).get('service')||'';if(options.includes(requested)||Object.values(PAGE_SERVICES).includes(requested)){setRequestedService(requested);setSelectedService(requested);}},[services,preview]);

  async function submit(event) {
    event.preventDefault(); if (preview) return; if (loading) return; setLoading(true); setStatus(''); setFailed(false);
    const form = event.currentTarget; const payload = { ...Object.fromEntries(new FormData(form).entries()), turnstileToken, attribution:enquiryAttribution() };
    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Unable to submit enquiry.');
      trackEvent('generate_lead',{form_id:'enquiry'});
      setStatus(successMessage); form.reset(); setSelectedService(''); setTurnstileToken(''); setTurnstileReset((value) => value + 1);
      setTimeout(() => { window.location.href = '/thank-you'; }, 650);
    } catch (error) { setFailed(true); setStatus(error.message || 'Something went wrong. Please try again.'); setTurnstileToken(''); setTurnstileReset((value) => value + 1); }
    finally { setLoading(false); }
  }

  return <form id="enquiry-form" className="contact-form" onSubmit={submit} aria-busy={loading}>
    {heading && <h3>{heading}</h3>}
    <p className="contact-form-intro">Share your details and a member of our team will get back to you.</p>
    <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <div className="form-fields">
      <div className="field"><label htmlFor={`${formId}-name`}>Full name <span aria-hidden="true">*</span></label><input id={`${formId}-name`} name="name" autoComplete="name" placeholder="Your full name" maxLength={120} required/></div>
      <div className="field"><label htmlFor={`${formId}-email`}>Email address <span aria-hidden="true">*</span></label><input id={`${formId}-email`} type="email" name="email" autoComplete="email" placeholder="you@company.com" maxLength={254} required/></div>
      <div className="field"><label htmlFor={`${formId}-phone`}>Phone number</label><input id={`${formId}-phone`} type="tel" name="phone" autoComplete="tel" placeholder="Your phone number" maxLength={40}/></div>
      <div className="field"><label htmlFor={`${formId}-service`}>Service of interest</label><select id={`${formId}-service`} name="service" value={selectedService} onChange={event=>setSelectedService(event.target.value)}><option value="">Select a service</option>{requestedService&&!options.includes(requestedService)&&<option>{requestedService}</option>}{options.map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="field field-full"><label htmlFor={`${formId}-message`}>How can we help? <span aria-hidden="true">*</span></label><textarea id={`${formId}-message`} name="message" placeholder="Tell us about your requirement…" maxLength={4000} required/></div>
    </div>
    {!preview && <TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileReset} action="contact" />}
    <button className="btn" disabled={loading}>{loading ? 'Submitting…' : 'Submit Enquiry'}<Icon name="arrow" size={18}/></button>
    {status && <div className={`form-status ${failed ? 'error' : 'success'}`} role={failed ? 'alert' : 'status'}>{status}</div>}
  </form>;
}
