import { createHash } from 'node:crypto';
const email = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '')) ? String(value).trim() : '';
export function mailConfiguration(environment = process.env) {
  return {configured:Boolean(environment.RESEND_API_KEY && environment.ENQUIRY_EMAIL_FROM),provider:'Resend'};
}
export function enquiryMailPlans(enquiry, settings = {}, environment = process.env) {
  const plans = [];
  const from = environment.ENQUIRY_EMAIL_FROM;
  const recipient = email(environment.ENQUIRY_EMAIL_TO || settings.notificationEmail || settings.email);
  const visitor = email(enquiry.email);
  const firm = String(settings.siteName || 'Our team').replace(/[\r\n]/g,' ');
  const key = createHash('sha256').update(`${enquiry.id}:${enquiry.createdAt}`).digest('hex').slice(0,32);
  if (settings.enquiryNotificationsEnabled && recipient) plans.push({key:`enquiry-${key}-team`,message:{from,to:[recipient],reply_to:visitor || undefined,subject:`New website enquiry | ${firm}`,text:`A new website enquiry has been saved.\n\nName: ${enquiry.name}\nEmail: ${visitor}\nPhone: ${enquiry.phone || 'Not provided'}\nService: ${enquiry.service || 'Not selected'}\n\nMessage:\n${enquiry.message}\n\nReview and update the follow-up status in the CMS Enquiries section.`}});
  if (settings.enquiryAcknowledgementEnabled && visitor) plans.push({key:`enquiry-${key}-visitor`,message:{from,to:[visitor],reply_to:recipient || undefined,subject:`We received your enquiry | ${firm}`,text:`Thank you for your enquiry.\n\nYour message has been received by ${firm}. The team will review your requirement and reply using the details you provided.\n\nPlease avoid sending sensitive documents until the team confirms the appropriate channel.\n\n${firm}`}});
  return plans;
}
export async function sendEnquiryEmails(enquiry, settings = {}, environment = process.env, fetcher = fetch) {
  if (!mailConfiguration(environment).configured) return {enabled:false,sent:0,failed:0};
  const plans = enquiryMailPlans(enquiry,settings,environment);
  // Email failure must never discard a successfully stored enquiry.
  const results = await Promise.allSettled(plans.map(async plan => {
    const response = await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${environment.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':plan.key},body:JSON.stringify(plan.message),signal:AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error('Enquiry email delivery failed.');
  }));
  return {enabled:plans.length > 0,sent:results.filter(r=>r.status==='fulfilled').length,failed:results.filter(r=>r.status==='rejected').length};
}
