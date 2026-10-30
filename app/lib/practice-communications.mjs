import crypto from 'node:crypto';
import {normalizeEmail, validEmail, text} from './practice.mjs';
import {crmError} from './crm.mjs';
export function verifyInboundSignature(bytes, timestamp, signature, secret, now = Date.now()) {
 if (typeof secret !== 'string' || secret.length < 32 || !/^\d{10}$/.test(timestamp || '') || Math.abs(now - Number(timestamp) * 1000) > 300000 || !/^[a-f0-9]{64}$/i.test(signature || '')) return false;
 const expected = crypto.createHmac('sha256', secret).update(timestamp + '.').update(bytes).digest(), provided = Buffer.from(signature, 'hex');
 return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}
export function validateInboundMessage(payload) {
 if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw crmError('Use a valid email message object.');
 const clientEmail = normalizeEmail(payload.clientEmail), sender = normalizeEmail(payload.sender), body = text(payload.body, 8000), messageId = text(payload.messageId, 250);
 if (!validEmail(clientEmail) || sender !== clientEmail || !body || !messageId || /[\r\n]/.test(messageId)) throw crmError('Provide the verified client sender, message ID and plain-text message.');
 return {clientEmail, title: text(payload.subject || 'Email from client', 180).replace(/[\r\n]/g, ' '), description: body, externalMessageId: messageId};
}
