'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent } from '../lib/analytics.mjs';
export default function PublicAnalytics({measurementId = '',enabled = false}) {
  const pathname = usePathname();
  const active = enabled && /^G-[A-Z0-9]{4,20}$/.test(measurementId) && !/^\/(admin|reset-password)(\/|$)/.test(pathname);
  const [choice,setChoice] = useState(null);
  const [loaded,setLoaded] = useState(false);
  const key = `jmp-analytics-consent-${measurementId}`;
  useEffect(() => { const reopen=()=>setChoice('ask'); window.addEventListener('jmp-analytics-preferences',reopen); return ()=>window.removeEventListener('jmp-analytics-preferences',reopen); },[]);
  useEffect(() => { try { setChoice(localStorage.getItem(key) || 'ask'); } catch { setChoice('ask'); } },[key]);
  useEffect(() => {
    const allowed = active && choice === 'allowed';
    window.__jmpAnalyticsReady = allowed && loaded;
    if (measurementId) window[`ga-disable-${measurementId}`] = !allowed;
    if (!allowed) return;
    if (window.__jmpLoadedAnalyticsId === measurementId) { setLoaded(true); return; }
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
    window.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    window.gtag('js',new Date());
    window.gtag('config',measurementId,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
    const script = document.createElement('script'); script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.onload = () => {window.__jmpLoadedAnalyticsId=measurementId;setLoaded(true);};
    script.onerror = () => setLoaded(false);
    document.head.appendChild(script);
    return () => {script.onload=null;script.onerror=null;script.remove();};
  },[active,choice,measurementId,loaded]);
  useEffect(() => {
    if (!active || choice !== 'allowed' || !loaded) return;
    window.__jmpAnalyticsReady = true;
    window.gtag?.('event','page_view',{page_path:pathname,page_location:window.location.origin+pathname,page_title:document.title});
    const click = event => {
      const link = event.target.closest?.('a'); if (!link) return;
      const href = link.getAttribute('href') || '';
      if (href.startsWith('tel:')) trackEvent('telephone_click',{link_type:'phone'});
      else if (href.startsWith('mailto:')) trackEvent('email_click',{link_type:'email'});
      else if (link.hasAttribute('download') || href.startsWith('/downloads/')) trackEvent('resource_download',{link_type:'resource'});
      else if (href === '/contact' && link.matches('.btn,.text-cta,.nav-cta')) trackEvent('consultation_click',{link_type:'enquiry'});
    };
    document.addEventListener('click',click);
    return () => document.removeEventListener('click',click);
  },[active,choice,loaded,pathname]);
  function choose(value) { try {localStorage.setItem(key,value);} catch {} setChoice(value); }
  if (!active || choice !== 'ask') return null;
  return <div className="analytics-choice" role="region" aria-label="Usage analytics preference"><p>Allow usage analytics to help us improve this website?</p><div><button type="button" onClick={()=>choose('declined')}>Decline</button><button type="button" onClick={()=>choose('allowed')}>Allow analytics</button></div></div>;
}
