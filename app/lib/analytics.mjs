const allowed = new Set(['generate_lead','consultation_click','telephone_click','email_click','resource_download']);
export function trackEvent(name, parameters = {}) {
  if (typeof window === 'undefined' || !window.__jmpAnalyticsReady || !allowed.has(name) || /^\/(admin|reset-password)(\/|$)/.test(window.location.pathname)) return;
  const safe = {page_path:window.location.pathname};
  for (const key of ['form_id','link_type']) if (typeof parameters[key] === 'string') safe[key] = parameters[key].slice(0,60);
  window.gtag?.('event',name,safe);
}
