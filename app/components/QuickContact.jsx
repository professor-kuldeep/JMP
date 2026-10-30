'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import Link from 'next/link';
import Icon from './Icon';
export default function QuickContact({phone=''}) {
 const path=usePathname(),[hidden,setHidden]=useState(false);
 useEffect(()=>{
  const visible=new Set(),targets=new Set(),update=()=>setHidden(visible.size>0||Boolean(document.querySelector('.analytics-choice'))||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''));
  const observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting&&targets.has(e.target))visible.add(e.target);else visible.delete(e.target);}update();});
  const scan=()=>{for(const el of targets)if(!el.isConnected){observer.unobserve(el);targets.delete(el);visible.delete(el);}for(const el of document.querySelectorAll('.contact-form,.booking-form,.booking-success,.booking-management,.enquiry-receipt,.site-footer'))if(!targets.has(el)){targets.add(el);observer.observe(el);}update();};
  const mutation=new MutationObserver(scan);mutation.observe(document.body,{childList:true,subtree:true});document.addEventListener('focusin',update);document.addEventListener('focusout',update);scan();
  return()=>{observer.disconnect();mutation.disconnect();document.removeEventListener('focusin',update);document.removeEventListener('focusout',update);};
 },[path]);
 if(path==='/waitlist'||path==='/client-portal'||path.startsWith('/admin')||path.startsWith('/reset-password')||path.startsWith('/booking/manage')||hidden)return null;
 return <aside className="quick-contact" aria-label="Quick contact">{phone&&<a href={'tel:'+phone.replace(/[^+\d]/g,'')}><Icon name="phone" size={19}/>Call the team</a>}<Link href="/contact#enquiry-form"><Icon name="mail" size={19}/>Send an enquiry</Link></aside>;
}
