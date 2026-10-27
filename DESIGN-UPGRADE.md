# JMP design upgrade

A visual refresh of the existing Next.js / Supabase project. The existing page content, CMS configuration, database schema, API routes and security logic are retained.

## What changed

- Navy, ivory and gold visual system with CMS-controlled theme colors.
- Editorial homepage hero using the supplied workspace image instead of a placeholder.
- Consistent public page layouts, service cards, numbered processes, brand sections and call-to-action panels.
- Responsive navigation with working submenu buttons, current-page indicators, Escape dismissal and outside-click dismissal.
- Skip-to-content navigation, visible keyboard focus, associated form labels, autocomplete and accessible form status messages.
- Clearer enquiry form, error styling, prevention of duplicate submissions while a request is in progress, and a direct form anchor on the contact page.
- Redesigned footer with telephone/email links. Empty social profile links are hidden.
- Complete blog index styling for cards, categories and empty states.
- Redesigned CMS sign-in, dashboard, sidebar, tables, form controls, page editor, media picker and appearance controls.
- Mobile CMS navigation, scrollable tables and a stacked page editor.
- Coordinated password-recovery styling.
- Public and administrative CSS separated to reduce styling conflicts.
- Existing live-preview component restyled to approximate the public design. It remains an approximation, not a full browser rendering.
- Added a dependency lockfile for reproducible installation.

## Deploy to the existing Vercel project

1. Extract the ZIP and update the files in the GitHub repository already connected to Vercel. The application files inside `JMP-main/` belong in the repository root.
2. Keep the current Vercel environment variables and Supabase project configuration.
3. Run `npm ci` and `npm run build`, or let Vercel perform the build.
4. Deploy from that repository. Check the public homepage, service pages, contact form, blog and `/admin` after deployment.

No database migration, schema reset, administrator bootstrap, or backup restore is needed for this design update. Existing CMS content and saved Appearance settings continue to be read by the same data layer.

For a production-style local preview, run `npm run build` followed by `npm start`. The existing strict Content Security Policy blocks evaluation used by React's development tooling; the production build avoids that requirement. Production security headers were not changed.

If additional CSS has previously been saved in the CMS Appearance panel, it still applies to public pages and may override parts of the redesign. Review any conflicting custom rules after deployment.

## Verification

- Production compilation and route generation: passed.
- Original API routes, authentication and data-layer files, database schema and seed content: byte-for-byte unchanged.
- Desktop homepage rendering and image layout: inspected in browser.
- Further browser checks were blocked by the preview environment. Mobile layouts and authenticated CMS interactions were not fully verified in browser.
- Live Supabase login, 2FA, content saving, uploads and enquiry submission require the existing project credentials and remain untested in this workspace.

No preview-only routes, sample admin sessions, environment files, dependency folders or generated build output are included in the ZIP.
