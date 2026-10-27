# JMP CMS v6: Admin password reset

The existing `/admin` login has a **Forgot password?** link to `/reset-password`. The reset page supports requesting an email link, setting a new password, and returning to the standard login with the same authenticator or recovery code. Password resets preserve CMS role and TOTP configuration.

## Deploy

1. Deploy the updated ZIP contents to the GitHub repository connected to Vercel; redeploy Production.
2. Ensure Vercel Production includes `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and a strong `ADMIN_SECRET`. Never expose the service role key or Admin secret to the browser.
3. In Supabase Authentication > URL Configuration, set **Site URL** to `https://jmp-six.vercel.app` (or your current production domain) and include `https://jmp-six.vercel.app/reset-password` in Redirect URLs. A custom domain must have its corresponding redirect URL as well.
4. Ensure the account has an existing `auth.users` record AND matching `public.cms_profiles` record. Email password reset is intentionally denied for users without a CMS profile. Initialize the Super Admin profile through the provided bootstrap procedure if missing.
5. Configure Supabase Auth's email sending (production SMTP recommended). Be aware of email rate limits.

## User flow

1. Open `/admin`, select **Forgot password?** (or navigate to `/reset-password`).
2. Enter the CMS Admin account email and click **Send reset link**.
3. Open the newest recovery email and follow the link to `/reset-password`. Keep the recovery tokens private.
4. Enter and confirm a new password (12–256 characters).
5. Return to `/admin`; sign in with the existing username, new password and current TOTP or valid unused recovery code.

On successful reset, the website revokes previously issued CMS Admin sessions for that user. TOTP enrollment is **not** changed, and there is no 2FA bypass. Server authorization and rate limits still apply.

## Troubleshooting

- "No CMS admin profile" means the Auth account exists but the CMS account is missing. Password recovery will not create an administrative account.
- No email: confirm SMTP settings, spam folder, Supabase Auth limits, and permitted redirect URLs.
- Expired/used link: request a new reset link. Do not reuse old reset URLs.
- Supabase dashboard-sent email may use a different redirect URL; request from the CMS form for the intended redirect.

## Verification

Test request, email delivery, token verification, password change, re-login with existing 2FA, rejection of an expired link, and rejection of prior CMS sessions in a staging environment before promoting to Production. A working end-to-end Supabase email flow cannot be verified without deployment and credentials.
