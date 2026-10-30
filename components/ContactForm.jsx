'use client';
import {useEffect,useId,useRef,useState} from 'react';
import Link from 'next/link';
import Icon from './Icon';
import {trackEvent,enquiryAttribution} from '../lib/analytics.mjs';
import {PAGE_SERVICES} from '../lib/service-links.mjs';
import {validateEnquiry} from '../lib/crm.mjs';
import TurnstileWidget from './TurnstileWidget';
const fallbackServices=['Accounting / Bookkeeping','GST Compliance','Income Tax','Audit & Assurance','Business Advisory','Other'];
export default function ContactForm({services=fallbackServices,heading='Send an Enquiry',successMessage='Thank you. Your enquiry has been submitted.',preview=false}){
 const formId=useId(),busy=useRef(false),request=useRef({key:'',signature:''}),summary=useRef(null);
 const [status,setStatus]=useState(''),[errors,setErrors]=useState({}),[loading,setLoading]=useState(false),[receipt,setReceipt]=useState('');
 const [turnstileToken,setTurnstileToken]=useState(''),[turnstileReset,setTurnstileReset]=useState(0),[selectedService,setSelectedService]=useState(''),[requestedService,setRequestedService]=useState('');
 const options=Array.isArray(services)&&services.length?services:fallbackServices;
 useEffect(()=>{if(preview)return;const requested=new URLSearchParams(window.location.search).get('service')||'';if(options.includes(requested)||Object.values(PAGE_SERVICES).includes(requested)){setRequestedService(requested);setSelectedService(requested);}},[services,preview]);
 useEffect(()=>{if(status&&!receipt)summary.current?.focus();},[status,receipt]);
 const fieldProps=name=>({'aria-invalid':errors[name]?true:undefined,'aria-describedby':errors[name]?`${formId}-${name}-error`:undefined});
 const error=name=>errors[name]&&<span id={`${formId}-${name}-error`} className="field-error">{errors[name]}</span>;
 async function submit(event){
  event.preventDefault();if(preview||busy.current)return;const form=event.currentTarget,payload={...Object.fromEntries(new FormData(form).entries()),turnstileToken,attribution:enquiryAttribution()},validation=validateEnquiry(payload);
  setStatus('');setErrors(validation.errors);
  if(!validation.valid){setStatus('Please check the highlighted fields.');return;}
  const signature=JSON.stringify(validation.value);if(request.current.signature!==signature||!request.current.key)request.current={key:crypto.randomUUID(),signature};payload.requestKey=request.current.key;
  busy.current=true;setLoading(true);
  try{
   const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await response.json();
   if(!response.ok){setErrors(data.errors||{});throw new Error(data.message||'Unable to submit enquiry.');}
   if(!data.duplicate)trackEvent('generate_lead',{form_id:'enquiry'});
   const reference=/^JMP-\d{6,}$/.test(data.reference||'')?data.reference:'';
   setReceipt(reference||'received');setStatus(successMessage);
   try{sessionStorage.setItem('jmp-enquiry-receipt',JSON.stringify({reference,at:Date.now()}));}catch{}
  }catch(err){setStatus(err.message||'Your enquiry could not be submitted. Please try again.');setTurnstileToken('');setTurnstileReset(n=>n+1);}
  finally{busy.current=false;setLoading(false);}
 }
 if(receipt)return <div className="contact-form enquiry-success" role="status"><span className="receipt-check" aria-hidden="true">✓</span><h3>Enquiry received.</h3><p>{status}</p>{receipt!=='received'&&<p className="receipt-reference">Your reference: <strong>{receipt}</strong></p>}<p>The team will review your request and contact you using the details provided.</p><Link className="btn" href="/thank-you">What happens next <Icon name="arrow" size={18}/></Link></div>;
 return <form id="enquiry-form" className="contact-form" onSubmit={submit} aria-busy={loading} noValidate>
  {heading&&<h3>{heading}</h3>}<p className="contact-form-intro">Share a few details. Fields marked * are required.</p>
  {status&&<div ref={summary} tabIndex={-1} className="form-status error" role="alert">{status}{Object.keys(errors).length>0&&<ul>{Object.entries(errors).map(([name,message])=><li key={name}><a href={'#'+formId+'-'+name}>{message}</a></li>)}</ul>}</div>}
  <div aria-hidden="true" style={{position:'absolute',left:'-10000px',width:1,height:1,overflow:'hidden'}}><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
  <fieldset disabled={loading} className="form-fields">
   <div className="field"><label htmlFor={`${formId}-name`}>Full name *</label><input {...fieldProps('name')} id={`${formId}-name`} name="name" autoComplete="name" placeholder="Your full name" maxLength={120} required/>{error('name')}</div>
   <div className="field"><label htmlFor={`${formId}-email`}>Email address *</label><input {...fieldProps('email')} id={`${formId}-email`} type="email" name="email" autoComplete="email" placeholder="you@company.com" maxLength={254} required/>{error('email')}</div>
   <div className="field"><label htmlFor={`${formId}-phone`}>Phone number</label><input {...fieldProps('phone')} id={`${formId}-phone`} type="tel" name="phone" autoComplete="tel" placeholder="Include your country code" maxLength={40}/>{error('phone')}</div>
   <div className="field"><label htmlFor={`${formId}-service`}>Service of interest</label><select id={`${formId}-service`} name="service" value={selectedService} onChange={e=>setSelectedService(e.target.value)}><option value="">Select a service</option>{requestedService&&!options.includes(requestedService)&&<option>{requestedService}</option>}{options.map(item=><option key={item}>{item}</option>)}</select></div>
   <div className="field field-full"><label htmlFor={`${formId}-message`}>How can we help? *</label><textarea {...fieldProps('message')} id={`${formId}-message`} name="message" placeholder="Briefly describe the support you need…" maxLength={4000} required/>{error('message')}</div>
  </fieldset>
  <p className="form-privacy">Please keep sensitive documents out of this form. Read our <Link href="/privacy-policy">privacy policy</Link>.</p>
  {!preview&&<TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileReset} action="contact"/>}
  <button className="btn" disabled={loading||preview}>{loading?'Submitting…':'Submit Enquiry'}<Icon name="arrow" size={18}/></button>
 </form>;
}
