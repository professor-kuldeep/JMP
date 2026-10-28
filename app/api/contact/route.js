import crypto from 'crypto';
import { sendEnquiryEmails } from '../../lib/enquiry-mail.mjs';
import { NextResponse } from 'next/server';
import { getEnquiries, getSettings, nextId, saveEnquiries } from '../../lib/store';
import { apiError } from '../../lib/api-error';
import { checkContactRateLimit, getClientIp, verifyTurnstile } from '../../lib/security';
import { cleanEmail, cleanText } from '../../lib/validation';

export async function POST(request) {
  try {
    const payload = await request.json().catch(() => ({}));
    if (String(payload.website || '').trim()) return NextResponse.json({ success: true });
    const turnstile = await verifyTurnstile(payload.turnstileToken, request);
    if (!turnstile.ok) return NextResponse.json({ message: 'Security verification failed. Please try again.' }, { status: 403 });
    const limit = await checkContactRateLimit(request);
    if (limit.unavailable) return NextResponse.json({ message: 'Form protection is temporarily unavailable. Please try again shortly.' }, { status: 503 });
    if (!limit.allowed) return NextResponse.json({ message: 'Too many submissions. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 600) } });

    const name = cleanText(payload.name, 120).trim(); const email = cleanEmail(payload.email); const message = cleanText(payload.message, 4000).trim();
    const phone = cleanText(payload.phone, 60).trim(); const service = cleanText(payload.service, 160).trim();
    if (!name || !email || !message) return NextResponse.json({ message: 'Please enter a valid name, email and message.' }, { status: 400 });
    const [enquiries, settings] = await Promise.all([getEnquiries(), getSettings()]);
    const retentionDays = Math.min(Math.max(Number(settings.enquiryRetentionDays || 365), 30), 3650);
    const cutoff = Date.now() - retentionDays * 86400000;
    const retained = enquiries.filter((item) => !item.createdAt || new Date(item.createdAt).getTime() >= cutoff);
    const enquiry = { id: nextId(retained), name, email, phone, service, message, status: 'new', notes: '', source: 'Website Contact Form', createdAt: new Date().toISOString(), sourceIpHash: crypto.createHmac('sha256', process.env.ADMIN_SECRET || 'contact-ip-local-key').update(getClientIp(request)).digest('hex').slice(0, 20) };
    await saveEnquiries([enquiry, ...retained].slice(0, 10000));
    try { const delivery = await sendEnquiryEmails(enquiry, settings); if (delivery.failed) console.warn('An enquiry was saved but an email could not be delivered.'); } catch { console.warn('An enquiry was saved but email delivery was unavailable.'); }
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
