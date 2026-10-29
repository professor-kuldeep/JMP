import crypto from 'crypto';
import { supabaseAdmin, supabaseAuthClient, assertSupabaseConfigured } from './supabase';
import { isRole } from './permissions';

function safeUsername(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._@-]/g, '').slice(0, 120); }
function base32(buffer) { const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; const bits = [...buffer].map((b) => b.toString(2).padStart(8, '0')).join(''); let output = ''; for (let i = 0; i < bits.length; i += 5) output += alphabet[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return output; }
function hmacRecovery(code) { const secret = process.env.ADMIN_SECRET || 'local-development-only-secret-change-me'; return crypto.createHmac('sha256', secret).update(String(code || '').replace(/\s+/g, '').toUpperCase()).digest('hex'); }
function fromRow(row) { if (!row) return null; return { id: row.user_id, username: row.username, displayName: row.display_name || row.username, email: row.email || '', role: row.role || 'viewer', totpSecret: row.totp_secret || '', twoFactorEnabled: Boolean(row.two_factor_enabled), recoveryCodeHashes: Array.isArray(row.recovery_code_hashes) ? row.recovery_code_hashes : [], disabled: Boolean(row.disabled), mustChangePassword: Boolean(row.must_change_password), createdAt: row.created_at, updatedAt: row.updated_at, source: row.source || 'supabase' }; }
function toRow(user) { return { user_id: user.id, username: safeUsername(user.username), display_name: String(user.displayName || user.username || '').slice(0,120), email: String(user.email || '').trim().toLowerCase().slice(0,180), role: user.role || 'viewer', totp_secret: user.totpSecret || '', two_factor_enabled: Boolean(user.twoFactorEnabled), recovery_code_hashes: Array.isArray(user.recoveryCodeHashes) ? user.recoveryCodeHashes : [], disabled: Boolean(user.disabled), must_change_password: Boolean(user.mustChangePassword), source: user.source || 'supabase', updated_at: new Date().toISOString() }; }

export function generateTotpSecret() { return base32(crypto.randomBytes(20)); }
export function buildOtpAuthUri(username, secret) { const issuer = process.env.ADMIN_TOTP_ISSUER || 'JM Pabari CoreTax CMS'; const account = username || 'admin'; return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`; }
export function generateRecoveryCodes(count = 8) { const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({ length: count }, () => { const bytes = crypto.randomBytes(12); let out = ''; for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length]; return `${out.slice(0,4)}-${out.slice(4,8)}-${out.slice(8,12)}`; }); }
export function publicUser(user) { if (!user) return null; const { totpSecret, recoveryCodeHashes, ...safe } = user; return { ...safe, twoFactorEnabled: Boolean(user.twoFactorEnabled && user.totpSecret), recoveryCodesRemaining: Array.isArray(recoveryCodeHashes) ? recoveryCodeHashes.length : 0 }; }

export async function listUsers() { const db = supabaseAdmin(); if (!db) return []; const { data, error } = await db.from('cms_profiles').select('*').order('username', { ascending: true }); if (error) throw error; return (data || []).map(fromRow); }
export async function getUserById(id) { const db = supabaseAdmin(); if (!db || !id) return null; const { data, error } = await db.from('cms_profiles').select('*').eq('user_id', String(id)).maybeSingle(); if (error) throw error; return fromRow(data); }
export async function findUserByUsername(username) { const db = supabaseAdmin(); const target = safeUsername(username); if (!db || !target) return null; const { data, error } = await db.from('cms_profiles').select('*').eq('username', target).maybeSingle(); if (error) throw error; return fromRow(data); }

export async function authenticateUser(user, password) {
  if (!user?.email || !password) return { ok: false };
  const auth = supabaseAuthClient();
  if (!auth) return { ok: false, error: 'Supabase Auth is not configured.' };
  const { data, error } = await auth.auth.signInWithPassword({ email: user.email, password: String(password) });
  if (error || !data?.user || data.user.id !== user.id) return { ok: false, error: error?.message || 'Invalid credentials.' };
  try { await auth.auth.signOut(); } catch {}
  return { ok: true };
}

export async function ensureBootstrapAdmin() {
  const db = supabaseAdmin();
  if (!db) return null;
  const { count, error } = await db.from('cms_profiles').select('*', { count: 'exact', head: true });
  if (error) throw error;
  if ((count || 0) > 0) return null;
  return null;
}

export async function createUser({ username, displayName = '', email = '', role = 'editor', password, twoFactorEnabled = true }) {
  const db = assertSupabaseConfigured('Supabase is required for multi-user administration.');
  const cleanUsername = safeUsername(username);
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanUsername.length < 3) throw Object.assign(new Error('Username must contain at least 3 valid characters.'), { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw Object.assign(new Error('A valid email address is required for Supabase Auth.'), { status: 400 });
  if (await findUserByUsername(cleanUsername)) throw Object.assign(new Error('That username already exists.'), { status: 409 });
  if (!isRole(role)) throw Object.assign(new Error('Invalid role.'), { status: 400 });
  if (String(password || '').length < 12) throw Object.assign(new Error('Password must be at least 12 characters.'), { status: 400 });
  const { data: authData, error: authError } = await db.auth.admin.createUser({ email: cleanEmail, password: String(password), email_confirm: true, user_metadata: { username: cleanUsername, display_name: displayName || cleanUsername } });
  if (authError) throw Object.assign(new Error(authError.message), { status: 400 });
  const effectiveTwoFactor = process.env.SECURITY_REQUIRE_2FA !== 'false' ? true : Boolean(twoFactorEnabled);
  const totpSecret = effectiveTwoFactor ? generateTotpSecret() : '';
  const recoveryCodes = effectiveTwoFactor ? generateRecoveryCodes() : [];
  const user = { id: authData.user.id, username: cleanUsername, displayName: String(displayName || cleanUsername).trim().slice(0,120), email: cleanEmail, role, totpSecret, twoFactorEnabled: effectiveTwoFactor, recoveryCodeHashes: recoveryCodes.map(hmacRecovery), disabled: false, mustChangePassword: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), source: 'cms-supabase' };
  const { error: profileError } = await db.from('cms_profiles').insert({ ...toRow(user), created_at: user.createdAt });
  if (profileError) { await db.auth.admin.deleteUser(authData.user.id).catch(() => {}); throw profileError; }
  return { user, recoveryCodes, otpauthUri: totpSecret ? buildOtpAuthUri(cleanUsername, totpSecret) : '' };
}

export async function updateUser(id, changes = {}) {
  const db = assertSupabaseConfigured();
  const current = await getUserById(id);
  if (!current) throw Object.assign(new Error('User not found.'), { status: 404 });
  const next = { ...current };
  if (Object.prototype.hasOwnProperty.call(changes, 'displayName')) next.displayName = String(changes.displayName || '').trim().slice(0,120);
  if (Object.prototype.hasOwnProperty.call(changes, 'email')) {
    const cleanEmail = String(changes.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw Object.assign(new Error('A valid email address is required.'), { status: 400 });
    const { error } = await db.auth.admin.updateUserById(String(id), { email: cleanEmail, email_confirm: true });
    if (error) throw error;
    next.email = cleanEmail;
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'role')) { if (!isRole(changes.role)) throw Object.assign(new Error('Invalid role.'), { status: 400 }); next.role = changes.role; }
  if (Object.prototype.hasOwnProperty.call(changes, 'disabled')) { next.disabled = Boolean(changes.disabled); await db.auth.admin.updateUserById(String(id), { ban_duration: next.disabled ? '876000h' : 'none' }).catch(() => {}); }
  if (changes.password) { if (String(changes.password).length < 12) throw Object.assign(new Error('Password must be at least 12 characters.'), { status: 400 }); const { error } = await db.auth.admin.updateUserById(String(id), { password: String(changes.password) }); if (error) throw error; next.mustChangePassword = Boolean(changes.mustChangePassword ?? true); }
  if (Object.prototype.hasOwnProperty.call(changes, 'mustChangePassword')) next.mustChangePassword = Boolean(changes.mustChangePassword);
  next.updatedAt = new Date().toISOString();
  const { error } = await db.from('cms_profiles').update(toRow(next)).eq('user_id', String(id)); if (error) throw error;
  return next;
}

export async function deleteUser(id) { const db = assertSupabaseConfigured(); const current = await getUserById(id); if (!current) throw Object.assign(new Error('User not found.'), { status: 404 }); await db.from('cms_profiles').delete().eq('user_id', String(id)); const { error } = await db.auth.admin.deleteUser(String(id)); if (error) throw error; return current; }
export async function resetRecoveryCodes(id) { const db = assertSupabaseConfigured(); const current = await getUserById(id); if (!current) throw Object.assign(new Error('User not found.'), { status: 404 }); const recoveryCodes = generateRecoveryCodes(); const next = { ...current, recoveryCodeHashes: recoveryCodes.map(hmacRecovery), updatedAt: new Date().toISOString() }; const { error } = await db.from('cms_profiles').update(toRow(next)).eq('user_id', String(id)); if (error) throw error; return recoveryCodes; }
export async function resetTwoFactor(id) { const db = assertSupabaseConfigured(); const current = await getUserById(id); if (!current) throw Object.assign(new Error('User not found.'), { status: 404 }); const totpSecret = generateTotpSecret(); const recoveryCodes = generateRecoveryCodes(); const next = { ...current, totpSecret, twoFactorEnabled: true, recoveryCodeHashes: recoveryCodes.map(hmacRecovery), updatedAt: new Date().toISOString() }; const { error } = await db.from('cms_profiles').update(toRow(next)).eq('user_id', String(id)); if (error) throw error; return { user: next, totpSecret, recoveryCodes, otpauthUri: buildOtpAuthUri(next.username, totpSecret) }; }
export async function consumeRecoveryCode(user, code) { if (!user || !Array.isArray(user.recoveryCodeHashes) || !user.recoveryCodeHashes.length) return false; const candidate = hmacRecovery(code); const index = user.recoveryCodeHashes.findIndex((value) => value === candidate); if (index === -1) return false; const db = supabaseAdmin(); if (!db) return false; const remaining = [...user.recoveryCodeHashes]; remaining.splice(index, 1); const next = { ...user, recoveryCodeHashes: remaining, updatedAt: new Date().toISOString() }; const { error } = await db.from('cms_profiles').update(toRow(next)).eq('user_id', user.id); return !error; }
