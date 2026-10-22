const checks = [
  ['NEXT_PUBLIC_SUPABASE_URL', Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), 'required'],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY), 'required'],
  ['SUPABASE_SERVICE_ROLE_KEY', Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY), 'required/server-only'],
  ['ADMIN_SECRET >= 32 chars', String(process.env.ADMIN_SECRET || '').length >= 32, 'required'],
  ['TURNSTILE keys', Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY), 'recommended'],
  ['SECURITY_ALERT_WEBHOOK_URL', Boolean(process.env.SECURITY_ALERT_WEBHOOK_URL), 'optional']
];
for (const [name, ok, level] of checks) console.log(`${ok ? 'OK ' : 'NO '} ${name} (${level})`);
if (checks.some(([,,level],i)=>level.startsWith('required')&&!checks[i][1])) process.exitCode=1;
