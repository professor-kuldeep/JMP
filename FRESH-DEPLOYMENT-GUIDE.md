# JMP CoreTax CMS: Fresh Vercel + Supabase deployment

## What is included
Admin redesign, page builder, blog management, public `/blog` route, password-reset request and recovery endpoint, custom admin sessions, and existing TOTP 2FA.

## 1. Database and media
If resetting everything, create a NEW Supabase project (do not delete a project containing data you need). Run the ENTIRE `supabase/schema.sql` in Supabase SQL Editor. In Supabase Storage create bucket `cms-media` (use access settings matching your asset visibility needs). If your health endpoint reports missing bucket, double check its exact name.

## 2. Environment variables
In Vercel Project Settings > Environment Variables add the keys from `.env.example` with actual values. `ADMIN_SECRET` must be random >=32 characters. Do NOT copy an ADMIN_SECRET from a chat or commit secrets. Configure Production; redeploy after changes. Set Supabase Authentication > URL Configuration > Site URL to the actual website domain, e.g. `https://jmp-six.vercel.app`, and add `https://jmp-six.vercel.app/reset-password` as allowed redirect. Ensure the domain matches the deployment.

## 3. Build and deployment
Commit project files at repository ROOT, without a parent directory. Use Next.js framework, `npm install` and `npm run build`. Requires Node 24.x. Production login requires working Supabase service role, public URL + anonymous key, and ADMIN_SECRET.

## 4. First Super Admin
Administrator creation is NOT automatic at build time. Run the included `scripts/bootstrap-supabase-admin.mjs` ONCE from a secure local shell with required `BOOTSTRAP_ADMIN_*` values, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ADMIN_SECRET` matching Vercel. `npm run supabase:bootstrap-admin` creates/updates credentials and issues a new TOTP secret and recovery codes. Store these securely and immediately remove bootstrap password from the environment. Do not run bootstrap each deployment: it can overwrite credentials and 2FA.

## 5. Password recovery
Use `/admin` > Forgot password? or `/reset-password`. The page posts to same-origin `/api/auth/recovery`, avoiding browser cross-origin restrictions. Recovery tokens are handled at `/api/auth/recovery/complete` without browser calls to Supabase. An email must be a PASSWORD RECOVERY email, not a magic link. The recovery page handles fragment `access_token` + `refresh_token` with `type=recovery` and query `token_hash` + `type=recovery`. Default Supabase recovery emails normally use the fragment flow. After saving new password, use original admin username and TOTP at `/admin`.

## 6. Verification
Check `/api/health`, `/admin`, `/reset-password`, `/blog`, public home and a published post. The health endpoint indicates backend configuration; test user actions separately. The project does not auto-create a user or migrate data solely by deployment.

## Security
Never disclose session/access tokens in screenshots. Never expose `SUPABASE_SERVICE_ROLE_KEY` or `ADMIN_SECRET` in client code. A new Supabase project has new auth users; bootstrap them. Back up any old database before deleting it. Recovery requests should be protected by Supabase's rate limits; configure SMTP for reliable production email.
