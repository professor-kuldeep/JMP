import { createClient } from '@supabase/supabase-js';

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, anonKey, serviceRoleKey, configured: Boolean(url && serviceRoleKey), authConfigured: Boolean(url && anonKey) };
}

export function getSupabaseStatus() {
  const value = env();
  return {
    configured: value.configured,
    authConfigured: value.authConfigured,
    urlConfigured: Boolean(value.url),
    serviceRoleConfigured: Boolean(value.serviceRoleKey),
    anonKeyConfigured: Boolean(value.anonKey)
  };
}

export function supabaseAdmin() {
  const { url, serviceRoleKey, configured } = env();
  if (!configured) return null;
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { 'X-Client-Info': 'coretax-cms-v6-server' } }
  });
}

export function supabaseAuthClient() {
  const { url, anonKey, authConfigured } = env();
  if (!authConfigured) return null;
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { 'X-Client-Info': 'coretax-cms-v6-auth' } }
  });
}

export function assertSupabaseConfigured(message = 'Supabase is not configured.') {
  const client = supabaseAdmin();
  if (!client) throw Object.assign(new Error(message), { status: 503, code: 'SUPABASE_NOT_CONFIGURED' });
  return client;
}

export function mediaBucket() {
  return process.env.SUPABASE_MEDIA_BUCKET || 'cms-media';
}
