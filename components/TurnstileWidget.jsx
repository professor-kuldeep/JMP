'use client';
import { useEffect, useRef } from 'react';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

function loadTurnstile() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (window.__coretaxTurnstilePromise) return window.__coretaxTurnstilePromise;
  window.__coretaxTurnstilePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-coretax-turnstile]');
    if (existing) { existing.addEventListener('load', () => resolve(window.turnstile)); existing.addEventListener('error', reject); return; }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true; script.defer = true; script.dataset.coretaxTurnstile = 'true';
    script.onload = () => resolve(window.turnstile); script.onerror = reject; document.head.appendChild(script);
  });
  return window.__coretaxTurnstilePromise;
}

export default function TurnstileWidget({ onToken, resetKey = 0, action = 'form' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;
    let cancelled = false; let widgetId = null;
    loadTurnstile().then((turnstile) => {
      if (cancelled || !turnstile || !ref.current) return;
      ref.current.innerHTML = '';
      widgetId = turnstile.render(ref.current, {
        sitekey: SITE_KEY, action,
        callback: (token) => onToken?.(token),
        'expired-callback': () => onToken?.(''),
        'error-callback': () => onToken?.('')
      });
    }).catch(() => onToken?.(''));
    return () => { cancelled = true; try { if (widgetId && window.turnstile) window.turnstile.remove(widgetId); } catch {} };
  }, [onToken, resetKey, action]);
  if (!SITE_KEY) return null;
  return <div className="turnstile-wrap"><div ref={ref} /></div>;
}
