'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
export default function EnquiryConfirmation() {
 const [reference,setReference]=useState('');useEffect(()=>{try{const value=JSON.parse(sessionStorage.getItem('jmp-enquiry-receipt')||'null');if(value&&Date.now()-value.at<86400000&&/^JMP-\d{6,}$/.test(value.reference))setReference(value.reference);}catch{}},[]);
 return <section className="section"><div className="container"><div className="enquiry-receipt"><span className="receipt-check" aria-hidden="true">✓</span><h1>Your enquiry has been received.</h1>{reference&&<p className="receipt-reference">Your reference: <strong>{reference}</strong></p>}<p>Our team will review your requirement and contact you using the details you provided.</p><ol><li>Keep your reference for any follow-up.</li><li>Prepare a brief outline of the support you need.</li><li>Wait for the team to confirm the scope and an appropriate channel before sending sensitive documents.</li></ol><div className="hero-actions"><Link className="btn" href="/resources">Explore preparation guides</Link><Link className="btn outline" href="/">Back to home</Link></div></div></div></section>;
}
