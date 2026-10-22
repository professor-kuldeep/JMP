# JMP CoreTax CMS v6: Clean install and recovery guide

## Caution: deleting projects and data
A new GitHub repository or Vercel project does **not** require deleting the old Supabase database. If you want to erase *all* data, export or back up the old project first and create a **new** Supabase project. Deleting a Supabase project permanently destroys its content, user accounts and storage. **Do not delete** an existing working project until the new deployment has been verified.

## 1. Set up GitHub and Vercel
- Upload the ZIP contents (not the containing folder) to your new repository.
- Import that repository into Vercel as Next.js, root directory `/`, build `npm run build`.
- Use a supported pinned Node.js major version in Vercel Project Settings, and re-deploy after configuring environment variables.

## 2. Create a fresh Supabase project
- In the new project's SQL Editor, paste and run the **contents** of `supabase/schema.sql` (not its file path). This also creates the public `cms-media` storage bucket and read policy; verify in Supabase > Storage.
- Use `data/seed.json` only if you want starter content and know how to import it. The SQL schema does not automatically import these JSON records.

## 3. Configure Vercel production variables
- `NEXT_PUBLIC_SUPABASE_URL`: new project's `https://...supabase.co` URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: new project's public anon key (not a service-role key)
- `SUPABASE_SERVICE_ROLE_KEY`: new project's **server-only** service-role key; never expose to client, GitHub, or screenshots
- `ADMIN_SECRET`: securely generated 32+ character random secret, kept private. Do not use a secret exposed in a chat transcript.
- `SECURITY_REQUIRE_2FA=true`
- `SUPABASE_MEDIA_BUCKET=cms-media`
- For optional Cloudflare Turnstile, provide both matching site/secret keys.
- Do not add `BOOTSTRAP_ADMIN_PASSWORD` to Vercel and do not commit `.env.local`.

Run `npm run security:check` locally with the configured variables if desired. Changing variables requires a **fresh production build** because the public Supabase keys are embedded at build time.

## 4. Create the first Super Admin exactly once
The CMS does not auto-create an administrator when Vercel builds. This is deliberate: deployment must not reset admin passwords, 2FA seeds, or recovery codes.

Run `npm install` in the project locally. Create an untracked `.env.local` containing your new project's `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, **the same** `ADMIN_SECRET` as Vercel, and:

```
BOOTSTRAP_ADMIN_EMAIL=your-admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=your-private-strong-password
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_DISPLAY_NAME=Primary Administrator
```

Then run:

```
node --env-file=.env.local scripts/bootstrap-supabase-admin.mjs
```

Save the TOTP seed and **one-time** recovery codes privately, enroll the seed into an authenticator app, then securely delete the bootstrap password from `.env.local`. This can create/update an existing matching Supabase Auth account, so run it only for your authorized account. Never commit secrets or output logs.

## 5. Verify
- `/api/health`: check `storage.persistent=true` and `auth=supabase-auth`; check media availability separately.
- `/admin`: sign in with username, Supabase Auth password, and the authenticator's current 6-digit TOTP code. The Admin Secret is **not** the password.
- `/blog`: articles should appear only when published; verify manually.
- `/reset-password`: request reset with the email form, then use the fresh email; the request now passes through a same-origin API to avoid direct browser fetch problems. Recovery link validation and password update still require browser access to the configured Supabase project.

## 6. Supabase Auth URL configuration
- Site URL: `https://YOUR-PRODUCTION-DOMAIN` (no `/admin` or `/reset-password`)
- Allowed Redirect URLs: `https://YOUR-PRODUCTION-DOMAIN/reset-password`
- Do not change Site URL to `/reset-password` when using the website's **Send Reset Link** form. It specifies redirect automatically.
- Use **Reset Password** email rather than magic link. Old recovery links should be discarded.

## Security and diagnostics
- The CSP in this version allows browser connections to the configured **exact Supabase HTTPS project origin**. This fixes prior browser `Failed to fetch` errors caused by blocked `connect-src` requests. If the browser still fails, inspect DevTools > Console and Network for CSP, DNS, CORS, and `/auth/v1` failures.
- The same-origin reset email endpoint returns generic messages and validates request origins. Enable rate limiting/bot protection at the edge and in Supabase, since public password recovery can otherwise be abused.
- A new Supabase project has new user IDs. Don't transplant profiles from an old project without reconciling user identities.
- The reset-password page intentionally does not turn the recovery session into a JMP CMS admin session; the normal admin login still requires TOTP.

## Build validation
Source syntax and ZIP consistency checks are distinct from a full `next build`. Run `npm install && npm run build` in CI/Vercel and test login, recovery, uploads and publication against the actual new Supabase project before retiring your old project.
