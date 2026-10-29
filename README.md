# JMP CMS v8 — Traffic, Search and CRM

Visitor analytics, GA4/GSC reporting connections and enquiry attribution are included. Read **ANALYTICS-CRM-UPGRADE.md** first for the additive database migration, Google setup and verification limits. Existing CSS fixes are described in **CSS-FIXES.md**.

# JMP / CoreTax CMS v7

The existing Next.js 16 and Supabase CMS with an upgraded public website, functional rich-text formatting toggles and a scrollable preview of the actual page layout.

## Install and check

```bash
npm ci
npm test
npm run build
npm start
```

Use Node.js 24. Deploy through the existing GitHub / Vercel project and retain its Supabase and authentication settings.

See DESIGN-UPGRADE.md for the full change list, applying content to an existing database, scheduled publishing, email delivery, analytics and verification limits. SUPABASE-SETUP.md and SECURITY-SETUP.md still describe the existing database and authentication setup. For v8 analytics, run the additive migration in ANALYTICS-CRM-UPGRADE.md; existing content and authentication tables are retained.

Use Admin > Website Health to review the content upgrade plan for an existing database. Add approved team details through the Team / Partner Profiles section type.

For a production-style preview, run the build and start commands above. The strict production Content Security Policy intentionally does not permit eval used by React development diagnostics.

## Rollback

Revert the application code or promote an earlier Vercel deployment. That restores code, not database state. Content changed through the upgrade plan retains revisions in the existing CMS revision history.
