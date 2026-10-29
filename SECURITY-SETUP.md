# Security Setup - Supabase Edition

Production minimum:

- Supabase account MFA enabled
- Vercel account MFA enabled
- Git provider MFA enabled
- domain registrar MFA + transfer lock
- `ADMIN_SECRET` 32+ random characters
- `SECURITY_REQUIRE_2FA=true`
- individual admin accounts, no shared login
- service-role key server-only
- Cloudflare Turnstile recommended
- optional IP allowlist for fixed-office environments

The CMS uses Supabase Auth for passwords. Password hashes are not stored in CMS tables. The CMS profile table stores role, TOTP secret and recovery-code hashes. Admin sessions are random signed cookies backed by revocable records in Supabase PostgreSQL.

If a takeover is suspected:

1. Revoke all sessions from Admin -> Security or Supabase SQL.
2. Rotate `ADMIN_SECRET` and redeploy.
3. Reset affected Supabase Auth passwords.
4. Reset TOTP/recovery codes for affected admins.
5. Rotate Supabase service-role secret if exposure is suspected.
6. Review `cms_audit_logs` and Vercel deployment/activity logs.
