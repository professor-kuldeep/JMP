import {sendVisit,visitorContext} from './visitor-browser.mjs';
export {visitorContext as enquiryAttribution};
const allowed = new Set(['generate_lead','consultation_click','telephone_click','email_click','resource_download']);
export function trackEvent(name, parameters = {}) {
  if (typeof window === 'undefined' || !allowed.has(name) || /^\/(admin|api|reset-password)(\/|$)/.test(window.location.pathname)) return;
  if (window.__jmpVisitTrackingReady && name !== 'generate_lead') sendVisit(name);
  if (!window.__jmpAnalyticsReady) return;
  const safe = {page_path:window.location.pathname};
  for (const key of ['form_id','link_type']) if (typeof parameters[key] === 'string') safe[key] = parameters[key].slice(0,60);
  window.gtag?.('event',name,safe);
}
