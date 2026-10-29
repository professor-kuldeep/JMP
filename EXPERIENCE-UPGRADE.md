# JMP CMS v9 — visitor experience, CRM and operations

This package extends v8 in the existing Next.js 16 / Supabase application. Existing content, appearance controls, authentication, MFA, permissions, the rich-text editor, live page preview and GA4/GSC connections remain available.

## What visitors see

- A clearer homepage introduction, direct links to audit and income tax services, a service finder with personal/business filters, and clearer CoreTax navigation.
- Larger body text, consistent service cards and spacing, accessible focus feedback and reduced-motion support.
- A 4:3 hero frame on desktop and mobile, responsive image delivery, and CMS focal-point and image-description controls.
- Service-page navigation with working anchors for overview, documents, process, FAQs and contact. Each canonical service has a relevant preparation list.
- A searchable resource centre with keyword, type and topic filters. Articles come from published CMS pages; draft and future articles remain excluded. Existing checklist downloads remain available.
- A mobile call/enquiry bar which hides around the form, the footer and the analytics consent controls.
- Field-specific form errors, preserved inputs after failure, duplicate protection and a persistent enquiry reference. Successful submissions stay visible; the previous automatic redirect is removed.
- A consultation calendar with actual free/busy checks, working hours, advance notice, buffers, blocked dates, time-zone handling and confirmed reservations. Visitors receive a private management link for rescheduling/cancellation and can download an ICS calendar file.

Online booking starts disabled. Visitors see an enquiry route until a team calendar is configured. This package contains no invented available appointments, clients, reviews or live analytics.

## What staff see

- Enquiries has Pipeline, List and Follow-ups views. Pipeline stages are New, Contacted, Consultation, Client and Closed. Existing `in-progress` records appear as Consultation.
- Search, stage, owner and service filters run in PostgreSQL with indexed queries and 25 records per page. The board displays the current page; pagination and matching totals are visible.
- Leads can be moved with drag-and-drop or the stage selector. The detail dialog contains contact links, original message, attribution, owner, follow-up, internal notes and activity history.
- Follow-ups has Today / Upcoming / Overdue views in the staff member's browser time zone. Closed leads and clients are excluded. A completed follow-up stays completed until another is scheduled. Unscheduled new/active leads use the configured response interval.
- CSV exports follow the current filters and stream all matching pages. Spreadsheet formula characters are escaped.
- Operations & Booking shows delivery counts, notifications awaiting review, scheduler status, appointments, booking configuration, encrypted backups and operational events.
- CMS image editing includes desktop/mobile 4:3 previews, focal-point sliders and alternative text. Uploads are prepared in the browser, then safely decoded, resized and stripped of metadata on the server. PDF/GIF files retain their bytes. The upload request limit is 4 MB; existing stored assets remain available.

## Upgrade an existing v8 installation

1. Keep a current database/media backup and the hosting environment settings.
2. Run `supabase/migrations/20261028_experience_v9.sql` in the existing Supabase SQL Editor before deploying v9. If upgrading from before v8, first run `20261028_visitor_analytics.sql`.
3. Install with Node.js 24 and `npm ci`, then deploy the source through the existing Vercel project.
4. Open Admin → Enquiries and Admin → Operations & Booking. Confirm the new tables and RPCs are available.
5. Configure email, scheduling, backups and the calendar as described below. Test a real submission and appointment with your own accounts after deployment.

For a fresh Supabase installation, run the complete `supabase/schema.sql`, which includes both migrations. The migration preserves existing pages and identifiers. It normalizes recognised legacy navigation labels, the original placeholder homepage introduction and consultation button wording. Other custom copy is retained. Default homepage audit/tax card destinations are corrected when rendered.

## Enquiry delivery and reliability

Every submission includes a random request key. A PostgreSQL function locks that key, allocates a database ID, inserts one enquiry and writes its notification jobs in one transaction. Retrying the same key/details returns the original reference. Reusing the key for different details returns a conflict. Collection replacement is no longer used by normal enquiry creation, updates or deletion.

Editing an enquiry includes its last update timestamp. Stale editors receive a reload message instead of overwriting another member's changes. Activity is bounded to 100 entries.

Set `RESEND_API_KEY`, `ENQUIRY_EMAIL_FROM`, and optionally `ENQUIRY_EMAIL_TO`; use a sender verified with Resend. Enable team notification and/or visitor acknowledgement in Forms. The response is returned after the database transaction; delivery runs afterward. Jobs use stable provider idempotency keys, exclusive leases, a maximum of five attempts and increasing retry delays. Failed jobs are visible and can be retried individually. A crashed final attempt becomes a reviewable failure after its lease expires.

## Team calendar connection

1. Enable Google Calendar API in your Google Cloud project and create a service account.
2. Store the account's complete JSON as the server-only `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON` setting. Never place it in public frontend variables or upload it as CMS media.
3. Create or select a dedicated consultation calendar. Share it with the service account email and grant **Make changes to events**. The account needs to read free/busy and create/change events.
4. In Operations & Booking, enter the calendar ID, time zone, working days/hours, duration, buffer, minimum notice, booking horizon and blocked dates. Save and use **Test saved calendar** to check free/busy access. Then enable booking.
5. Confirm an appointment, inspect the team calendar event, reschedule it and cancel it using the visitor's private link. Configure email delivery for confirmation messages.

Calendar access uses `calendar.events` and `calendar.freebusy` scopes, separate from the read-only GA4/GSC reporting connection. The team calendar contains a private event; visitor email confirmation and ICS download are handled by this application. Google attendee invitations and automatic video links are not created.

Availability combines Google free/busy with database reservations. A PostgreSQL exclusion constraint rejects overlaps, including concurrent requests. Rescheduling holds the new slot while preserving the old reservation until Google accepts the change. Cancellation reserves its state before removing the event. Retried event creation uses the same Google event ID. Maintenance reconciles interrupted holds and cancellations. A pending appointment remains blocked until its external state can be checked; it is not shown as confirmed prematurely.

Google Calendar is an external system: manual edits made directly in Google can race with a website booking. Use a dedicated calendar and review unusual operational events. Restoring an application backup does not roll back external Google Calendar events; review appointments and connections after restoration.

The management link contains a random 256-bit token in the URL fragment. Only its SHA-256 hash is stored on the booking row. The token is sent in a same-origin request body; management pages are excluded from analytics and indexing. Treat the link as private. If a network response is interrupted, the form offers a link to check that request's status.

## Scheduling and cleanup

Set a random server-only `CRON_SECRET` with at least 32 characters. `GET /api/maintenance` requires the exact Bearer secret. The included Vercel schedule runs daily at 03:00 UTC (08:30 India time, subject to the hosting plan's scheduling precision).

For timely retries, install the included `.github/workflows/maintenance.yml` in the connected repository, set repository variable `SITE_URL` to the final HTTPS origin, and set repository secret `CRON_SECRET` to match hosting. It requests maintenance every five minutes; GitHub scheduled jobs can be delayed. A compatible external scheduler can use the same endpoint. Do not put the secret in a URL. Daily execution is a fallback; it does not provide minute-level retry timing. The admin **Run maintenance now** control is also available.

Workers use a database lease. Maintenance handles queued delivery, expiry cleanup, interrupted calendar changes and incremental media backups. It records a heartbeat and failure categories in Operations. The UI highlights a heartbeat older than 26 hours. `/api/health` checks database and media access and returns HTTP 503 when unhealthy; point an external uptime monitor at this endpoint if out-of-band outage alerts are required.

Retention runs independently of incoming traffic: enquiries use the configured 30–3650 days; visits use 30–365 days; queue contents expire after seven days; operations events after 30 days; security audit records after 90 days. Past booking records use the enquiry retention interval. Expired session/rate-limit/OTP records are cleaned. Encrypted backup copies have their own retention below.

## Backups and restoration

Set a stable 32-byte `CMS_BACKUP_ENCRYPTION_KEY` (64 hex characters or base64). Keep a separate protected copy, alongside `GOOGLE_TOKEN_ENCRYPTION_KEY` and hosting secrets. The migration creates the **private** `cms-backups` bucket.

Backups contain a consistent PostgreSQL snapshot of application tables, including enquiries, profiles, reporting connections, jobs and bookings. The snapshot is compressed and encrypted with AES-256-GCM. Owned CMS media objects are copied as actual bytes into the private backup bucket with SHA-256 integrity hashes. External image URLs remain references. Bundled source assets belong to the source package/repository.

A backup becomes Complete only after all owned media copies finish. Work is resumable in batches. The admin can continue a pending backup; scheduled workers continue it as well. Backups older than 14 days are removed, while the latest completed backup is retained until a replacement succeeds. Application snapshots are limited to 80 MB uncompressed / 50 MB encrypted; large installations should also use provider-native database backup and storage backup tools.

Only the Super Admin can review and restore a completed backup. Review verifies the encrypted database snapshot, every copied media hash, and the presence of referenced Supabase Auth identities. Type RESTORE to proceed. Media is verified/copied and application records are restored in one database transaction; active CMS sessions are revoked. Restored pending email jobs are paused for review to avoid silently resending old notifications. Re-sign in and review them in Operations.

These backups restore application data and owned media in the existing project. Supabase Auth identity records, hosting secrets, external calendars and source repositories have separate lifecycles. Use Supabase's native database backups for full project/Auth disaster recovery. Very large media restorations may exceed an individual function's execution window and should use provider recovery tooling. The original JSON content export is still supported for compatibility; it does not embed uploaded media.

## Performance and monitoring

Public settings, navigation and CMS page data use Next.js Data Cache with a 60-second lifetime and immediate tag expiration after CMS writes/restoration. Publication visibility is checked per request. Admin and private API responses remain uncached.

Trusted local/Supabase images use the Next.js image optimizer and responsive sizes, including AVIF/WebP delivery. Other remote images use a safe fallback. Original GIF behavior is preserved. Source dimensions reserve space, and the hero frame stays at 4:3. Existing supplied public assets are retained.

Structured server instrumentation and operational event records use category codes, not request bodies, access tokens, client emails or provider error text. Google report and calendar failures are visible in operational events. Public error screens offer retry/contact routes.

## Verification and deployment limits

Run `npm test`, `npm run build`, then `npm run test:smoke`. The package includes PostgreSQL-engine tests with PGlite for migrations, database IDs/idempotency, transaction rollback, stale updates, filtering, queue leases, booking conflicts, rescheduling/cancellation and atomic restore. Rendered component tests cover service/resource filters, field feedback, saved references, CRM stage changes, image focal points and booking confirmation. API tests cover permission/CSRF boundaries and Calendar request formats. Backup tests exercise actual encrypted bytes, media copying and corruption checks. Image tests exercise Sharp.

The production HTTP smoke check exercises key public routes, private API boundaries and image optimization. CI runs tests, a production build and that smoke check. The managed preview in this workspace supplies Vite-only flags to Next.js, so final browser layout/interaction QA could not be completed here. Test the deployed site on desktop/mobile, with a keyboard and at 200% zoom before public release. No live Supabase migration, Google authorization, production email, public deployment or external scheduler was activated from this workspace.

Google API references: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query and https://developers.google.com/workspace/calendar/api/v3/reference/events/insert.
