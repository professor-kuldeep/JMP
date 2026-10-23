# Supabase Setup - Step by Step

## 1. Create a Supabase project

Create a new project in Supabase. Use a strong database password and enable MFA on the Supabase account.

## 2. Create CMS tables and media bucket

Open **Supabase Dashboard -> SQL Editor -> New query**. Paste the full contents of:

`supabase/schema.sql`

Run it once. It creates the CMS tables, RLS configuration, rate-limit function and the public `cms-media` bucket. Public means files can be viewed on the website; uploads/deletes remain server-only through the service-role key.

## 3. Get Supabase keys

From **Project Settings -> API**, copy:

- Project URL
- anon/publishable key
- service-role secret

Never expose the service-role secret in browser code or a `NEXT_PUBLIC_*` variable.

## 4. Add Vercel environment variables

Add:

```text
NEXT_PUBLIC_SUPABASE_URL=<project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-or-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-secret>
SUPABASE_MEDIA_BUCKET=cms-media
ADMIN_SECRET=<32+ character random secret>
ADMIN_SESSION_IDLE_MINUTES=45
ADMIN_SESSION_ABSOLUTE_HOURS=8
SECURITY_REQUIRE_2FA=true
ADMIN_TOTP_ISSUER=JM Pabari CoreTax CMS
```

Optional:

```text
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
SECURITY_ALERT_WEBHOOK_URL=
ADMIN_ALLOWED_IPS=
ADMIN_SESSION_BIND_IP=false
```

## 5. Generate ADMIN_SECRET

Locally in the project folder:

```bash
npm install
npm run security:secret
```

Copy the generated secret into Vercel as `ADMIN_SECRET`.

## 6. Create the first Super Admin

Do this locally, not by storing the bootstrap password in Vercel.

PowerShell example:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://YOURPROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
$env:ADMIN_SECRET="YOUR_32_PLUS_CHARACTER_SECRET"
$env:BOOTSTRAP_ADMIN_USERNAME="admin"
$env:BOOTSTRAP_ADMIN_DISPLAY_NAME="Primary Administrator"
$env:BOOTSTRAP_ADMIN_EMAIL="admin@yourdomain.com"
$env:BOOTSTRAP_ADMIN_PASSWORD="YOUR_STRONG_PASSWORD"
npm run supabase:bootstrap-admin
```

The script creates/updates the Supabase Auth user, creates the CMS `super_admin` profile, and prints:

- TOTP secret
- authenticator URI
- one-time recovery codes

Add the TOTP secret to Google Authenticator, Microsoft Authenticator, 1Password, Authy, etc. Save recovery codes offline.

After bootstrapping, clear `BOOTSTRAP_ADMIN_PASSWORD` from your shell history/environment. It is not needed in Vercel.

## 7. Deploy to Vercel

Push the project to Git and connect/import it in Vercel. The repository root must contain `package.json`.

After adding/changing environment variables, redeploy.

## 8. Verify health

Open:

`https://your-domain/api/health`

Expected key values:

```json
{
  "ok": true,
  "version": "6.0.0-supabase",
  "storage": { "persistent": true, "provider": "supabase-postgres" },
  "auth": "supabase-auth",
  "media": "supabase-storage"
}
```

## 9. Login

Open `/admin` and use:

- Username: the bootstrap username, e.g. `admin`
- Password: the bootstrap password you chose
- Verification code: current 6-digit code from your authenticator app

## 10. Create additional admins

Use **Admin -> Users**. Each admin requires a real email because passwords are managed by Supabase Auth. Do not share the Super Admin account.

## 11. Test before production domain

Test all of the following:

- login + 2FA
- create/edit/publish page
- revision restore
- media upload/delete
- contact form -> Enquiries
- enquiry status/notes
- user creation and temporary password change
- session revocation
- backup/export
- Turnstile (if enabled)
