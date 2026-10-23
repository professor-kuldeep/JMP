# JMP / CoreTax CMS

Next.js 16 website and Supabase-backed CMS.

## Install and deploy
1. Create a Vercel project connected to this repository.
2. Configure the existing Supabase and CMS authentication environment variables. See `SUPABASE-SETUP.md` and `SECURITY-SETUP.md`.
3. If deploying a **new** database, follow `SUPABASE-SETUP.md`. For an existing live database, **do not rerun bootstrap/migration scripts blindly**.
4. Deploy and verify `/admin`, login/2FA, navigation, media, page editing, and public site routes.

## Admin design revamp
Admin layout is scoped to `app/admin/admin-revamp.css` and imported through `app/admin/layout.js`. It improves desktop scrolling sidebar, responsive mobile tab navigation, component spacing, and accessible focus states. It does not modify auth/database routes or data.

## Rollback
Revert the design commit in GitHub or promote an earlier Vercel deployment. This restores application code only, **not** database state. No database changes are required for the UI update.
