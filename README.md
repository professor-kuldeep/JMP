# JMP CMS v9 — visitor experience, CRM & booking

The existing Next.js 16 / Supabase website now includes a service finder, searchable resources, mobile contact controls, readable page layouts, 4:3 image controls, calendar booking, a CRM pipeline and an operations workspace.

Start with **[EXPERIENCE-UPGRADE.md](EXPERIENCE-UPGRADE.md)** for installation, the required migration, calendar/email setup, encrypted backups, scheduling and verification limits.

## Install and check

Use Node.js 24.

```bash
npm ci
npm test
npm run build
npm run test:smoke
npm start
```

Deploy through the existing GitHub / Vercel project and retain its Supabase, authentication and Turnstile environment settings. For an existing v8 database, run `supabase/migrations/20261028_experience_v9.sql` before deploying. For a fresh database, use the complete `supabase/schema.sql`. Earlier installations also need the included v8 analytics migration.

## Features and configuration

- **Enquiries:** Pipeline, List and Follow-ups views; stage/owner/service search; atomic submissions; duplicate protection; conflict-aware edits; notes and activity; filtered CSV exports.
- **Operations & Booking:** actual Google Calendar availability, working hours and appointment management; email delivery queue and retries; maintenance status; encrypted application/media backups and verified restoration.
- **Traffic & Search:** consent-aware visitor tracking, enquiry attribution and existing GA4/GSC report connections. See [ANALYTICS-CRM-UPGRADE.md](ANALYTICS-CRM-UPGRADE.md).
- **CMS:** existing pages, blog, formatting controls, page preview, navigation, publication scheduling, appearance settings, account security and role permissions.

Calendar booking begins disabled until the team calendar is configured. Email, encrypted backups and the production scheduler each require the server settings listed in the upgrade guide. Code and provider fixtures have been tested; real account authorization and production activation must be completed in the hosting environment.

The original JSON content export remains available. It contains media references; encrypted application and uploaded-media backups are managed in Operations & Booking.

## Existing setup references

See [SUPABASE-SETUP.md](SUPABASE-SETUP.md), [SECURITY-SETUP.md](SECURITY-SETUP.md) and [PASSWORD-RESET-SETUP.md](PASSWORD-RESET-SETUP.md) for the existing account/database setup. [DESIGN-UPGRADE.md](DESIGN-UPGRADE.md), [CSS-FIXES.md](CSS-FIXES.md) and [APPEARANCE-UPGRADE.md](APPEARANCE-UPGRADE.md) describe retained design/editor features.

Use Admin → Website Health for the existing content upgrade review. Add approved team information through the Team / Partner Profiles section type.

For a production-style preview, use `npm run build` followed by `npm start`. The production CSP does not allow the eval used by React development diagnostics. Managed browser preview was unavailable for this upgrade; desktop/mobile layout, keyboard and 200% zoom review remain deployment checks.

## Rollback and recovery

Promoting an earlier Vercel deployment restores application code. Database state and external calendars have separate lifecycles. Existing CMS content revisions remain available; v9 adds encrypted application/media recovery. Preserve the database backup and stable encryption keys before any production upgrade or restoration. Review appointments, restored notification jobs and Google connections after restoring data.
