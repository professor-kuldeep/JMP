import crypto from 'node:crypto';
import {cookies} from 'next/headers';
import {supabaseAuthClient} from './supabase';
import {practiceDb, practiceResult, clientByEmail, readClient, portalUrl, clientMailPlan} from './practice-store';
import {normalizeEmail, validEmail} from './practice.mjs';
import {crmError} from './crm.mjs';
import {verifyRequestOrigin, isProduction} from './security';
import {getSettings} from './store';
import {enqueueEmails} from './mail-queue';

export const portalHash = value => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const cookieName = () => isProduction() ? '__Host-jmp_portal_session' : 'jmp_portal_session';
const same = (a, b) => { const x = Buffer.from(a || ''), y = Buffer.from(b || ''); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const noAuth = () => crmError('Sign in to the client portal to continue.', 401);
export function setPortalCookie(response, token = '') { response.cookies.set(cookieName(), token, {httpOnly: true, secure: isProduction(), sameSite: 'strict', path: '/', maxAge: token ? 8 * 3600 : 0, priority: 'high'}); }
export async function requirePortal(request, csrf = false) {
  if ((await getSettings()).clientPortalEnabled !== true) throw noAuth();
  const token = (await cookies()).get(cookieName())?.value;
  if (!/^[a-f0-9]{64}$/.test(token || '')) throw noAuth();
  const db = practiceDb(), session = await practiceResult(db.from('cms_portal_sessions').select('*').eq('token_hash', portalHash(token)).maybeSingle());
  if (!session || Date.parse(session.idle_expires_at) <= Date.now() || Date.parse(session.absolute_expires_at) <= Date.now()) throw noAuth();
  const client = await readClient(session.client_id, true);
  if (client.auth_user_id !== session.user_id) throw noAuth();
  const identity = await db.auth.admin.getUserById(session.user_id);
  if (identity.error || !identity.data?.user || Date.parse(identity.data.user.banned_until || '') > Date.now()) throw noAuth();
  if (csrf && (!verifyRequestOrigin(request) || !same(request.headers.get('x-csrf-token'), session.csrf_token))) throw crmError('Refresh the portal and try again.', 403);
  await practiceResult(db.from('cms_portal_sessions').update({idle_expires_at: new Date(Math.min(Date.now() + 45 * 60000, Date.parse(session.absolute_expires_at))).toISOString()}).eq('token_hash', session.token_hash));
  return {client, csrfToken: session.csrf_token, tokenHash: session.token_hash};
}
export async function portalLogin(payload) {
  const auth = supabaseAuthClient(); if (!auth) throw crmError('Client sign-in is not configured yet.', 503);
  const email = normalizeEmail(payload.email);
  if (!validEmail(email) || typeof payload.password !== 'string' || payload.password.length > 128) throw noAuth();
  const {data, error} = await auth.auth.signInWithPassword({email, password: payload.password});
  if (error || !data?.user?.email_confirmed_at) throw noAuth();
  const client = await clientByEmail(normalizeEmail(data.user.email));
  if (!client || (client.auth_user_id && client.auth_user_id !== data.user.id)) throw noAuth();
  return createPortalSession(client, data.user.id);
}
async function createPortalSession(client, userId) {
  const db = practiceDb();
  if (!client.auth_user_id) {
    const bound = await practiceResult(db.from('cms_practice_clients').update({auth_user_id: userId, updated_at: new Date().toISOString()}).eq('id', client.id).eq('email', client.email).eq('active', true).is('auth_user_id', null).select('*').maybeSingle());
    if (!bound) { const fresh = await readClient(client.id, true); if (fresh.auth_user_id !== userId) throw noAuth(); }
  }
  const token = crypto.randomBytes(32).toString('hex'), csrfToken = crypto.randomBytes(32).toString('hex');
  await practiceResult(db.from('cms_portal_sessions').insert({token_hash: portalHash(token), client_id: client.id, user_id: userId, csrf_token: csrfToken, idle_expires_at: new Date(Date.now() + 45 * 60000).toISOString(), absolute_expires_at: new Date(Date.now() + 8 * 3600000).toISOString()}));
  return {token, csrfToken, client: {id: client.id, name: client.name, email: client.email, company: client.company}};
}
export async function portalActivation(payload) {
  if (!['invite', 'recovery'].includes(payload.type) || !/^[a-f0-9]{32,128}$/i.test(payload.tokenHash || '')) throw crmError('This account link is invalid or has expired.', 400);
  if (typeof payload.password !== 'string' || payload.password.length < 12 || payload.password.length > 128) throw crmError('Use a password of 12–128 characters.');
  const auth = supabaseAuthClient(); if (!auth) throw crmError('Client sign-in is not configured yet.', 503);
  const {data, error} = await auth.auth.verifyOtp({token_hash: payload.tokenHash, type: payload.type});
  if (error || !data?.user?.email_confirmed_at) throw crmError('This account link is invalid or has expired. Request another link.');
  const client = await clientByEmail(normalizeEmail(data.user.email));
  if (!client || (client.auth_user_id && client.auth_user_id !== data.user.id)) throw noAuth();
  const updated = await practiceDb().auth.admin.updateUserById(data.user.id, {password: payload.password});
  if (updated.error) throw crmError('The password could not be saved. Request a new account link.');
  await practiceResult(practiceDb().from('cms_portal_sessions').delete().eq('client_id', client.id));
  return createPortalSession(client, data.user.id);
}
export async function generatePortalInvite(clientId) {
  const client = await readClient(clientId, true), settings = await getSettings(), base = portalUrl(settings), db = practiceDb();
  let type = client.auth_user_id ? 'recovery' : 'invite', result = await db.auth.admin.generateLink({type, email: client.email});
  if (result.error && type === 'invite' && ['email_exists', 'user_already_exists'].includes(result.error.code)) { type = 'recovery'; result = await db.auth.admin.generateLink({type, email: client.email}); }
  const hash = result.data?.properties?.hashed_token;
  if (result.error || !hash) throw crmError('A portal account link could not be generated. Check Supabase Auth configuration.', 503);
  return {url: `${base}#${new URLSearchParams({token_hash: hash, type})}`, client, type};
}
export async function requestPortalRecovery(email) {
  const client = await clientByEmail(normalizeEmail(email));
  if (!client) return;
  const invitation = await generatePortalInvite(client.id);
  await enqueueEmails([clientMailPlan(client, 'portal-access-' + crypto.randomUUID(), 'Your private client portal link', `Use this one-time link to set your portal password. It expires according to the account security settings.\n\n${invitation.url}\n\nIf you did not request this, you can ignore this email.`)]);
}
