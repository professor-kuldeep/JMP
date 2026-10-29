# JMP CMS v8 — Visitor analytics, GA4, GSC and enquiry attribution

Open **Admin > Traffic & Search** after installing this release. The existing website design and CSS corrections are retained.

## Included

- Built-in visits, consenting-browser visitor estimates, page views, daily trends, landing pages, sources, campaigns, devices and recent page views.
- Successfully saved enquiries connected to the consenting visitor's session, entry page and campaign. The public collector cannot submit a successful-enquiry event; that event is written after the enquiry is saved.
- Service-page contact buttons preselect the relevant service.
- Assigned team members, explicit follow-up dates and an activity history in the CRM enquiry table. The existing overdue filter also recognizes explicit follow-up dates. Enquiry CSV exports include these fields and attribution.
- GA4 reporting: active users, sessions, page views, engagement, key events, pages and acquisition sources.
- Search Console reporting: finalized Web-search clicks, impressions, CTR, average position, daily trends, top queries and pages.
- Date filters, CSV exports, property discovery for GSC, connection status, refresh controls and separate empty/error states for each data provider.
- Google account authorization with read-only scopes, PKCE, expiring state bound to the initiating administrator, encrypted offline tokens, automatic token refresh and disconnection. The return flow preserves the existing Strict admin-session cookie.
- Alternative Google service-account authentication through protected server settings.
- Analytics read/manage permissions: administrators can manage integrations; the Marketing role can read reports. Visitors cannot access reports or Google credentials.

## Install without resetting the existing site

1. Copy the contents of `JMP-main/` into the existing project root. Keep the current hosting environment, Supabase project, users, content and uploaded media.
2. In the existing Supabase SQL Editor, run **`supabase/migrations/20261028_visitor_analytics.sql`**. It adds `cms_visit_events` and `cms_integrations` in a transaction, enables row-level security and leaves access restricted to the server service role. No existing tables are reset.
3. Run `npm ci`, `npm test` and `npm run build` using Node 24, then deploy through the existing project.
4. Open **Traffic & Search > Connections**, choose whether to enable the built-in tracker, and save. It is enabled by default when that setting has not previously been stored. Tracking starts only after the visitor chooses Allow analytics.
5. Configure either Google sign-in or service-account reporting below, enter the property identifiers, and select **Save & test connections**. Use Refresh reports after authorization.

The website remains usable when reporting is unconfigured. Missing analytics storage or denied Google access appears as a setup/error state; the CRM does not substitute demonstration data. No earlier visit history can be reconstructed by the new built-in tracker.

## Option A: Connect a Google account

1. In a Google Cloud project, enable the **Google Analytics Data API** and **Google Search Console API**.
2. Configure the OAuth consent screen/audience. If the application is in testing, add the intended Google account as a test user. Follow Google's publishing/verification requirements for the application's intended audience.
3. Create an OAuth client of type **Web application**.
4. Add this exact authorized redirect URI, replacing the origin with the final domain:

   `https://your-domain.com/api/admin/insights/google/callback`

5. Add these protected server environment variables in the hosting project, then redeploy:

   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` — the same full callback URL
   - `GOOGLE_TOKEN_ENCRYPTION_KEY` — a random 32-byte key encoded as 64 hexadecimal characters or base64

   Generate a key locally with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

6. In **Traffic & Search > Connections**, select **Connect a Google account**, save any changes, then select **Connect Google account**. Use an account that can read the required GA4 and GSC properties. Approve both read-only reporting permissions.
7. After returning to the CRM, enter the property identifiers and select **Save & test connections**.

Tokens are stored as AES-256-GCM authenticated ciphertext in the separate integration table. They are not exposed in CMS settings, visitor HTML or report responses. Keep the encryption key stable across deployments; reconnect Google if it is lost or changed. Disconnect clears the CRM credential and attempts to revoke the Google grant.

## Option B: Server service account

1. Create a Google service account in a project with both reporting APIs enabled.
2. In GA4 property access management, grant the service account's email a role sufficient to read reports, such as Viewer.
3. In Search Console, add that service account email as a user of the intended verified property with sufficient read access. Creating credentials alone does not grant access to a property.
4. Store the complete credentials JSON in **`GOOGLE_SERVICE_ACCOUNT_JSON`** as a protected server setting. Keep the JSON valid, including its escaped private-key newlines. Do not upload the key through the CMS Media screen.
5. Redeploy, select **Server service account** in Connections, enter property identifiers, save and refresh.

Service-account mode does not require the Google OAuth client settings. Both methods keep credentials on the server; none of these secret variables should have a `NEXT_PUBLIC_` prefix.

## Property identifiers

| Field | Example | Purpose |
| --- | --- | --- |
| GA4 Measurement ID | `G-XXXXXXXXXX` | Sends new website events to GA4 after consent. |
| GA4 Property ID | `123456789` | Reads reports from the GA4 Data API. This is a different identifier. |
| GSC Domain property | `sc-domain:example.com` | Reads all data available for the selected Domain property. |
| GSC URL-prefix property | `https://www.example.com/` | Must exactly match the property in Search Console, including protocol, hostname and path. |

**Find accessible GSC properties** uses the currently saved authentication method. Enable **Send analytics to GA4 after consent** only when a valid Measurement ID is set. Reporting an existing GA4 property does not require enabling this site's GA4 tag if tracking is already supplied elsewhere; avoid installing duplicate tags.

## How counts and attribution work

- Visitors are distinct browser IDs recorded after consent, not identified people. Separate devices and cleared storage can create separate visitor counts.
- Visits are sessions that expire after 30 minutes of inactivity. The first recorded page, source, medium and campaign remain attached to the session as the visitor navigates.
- Query strings and URL fragments are excluded from stored page paths. Explicit UTM source/medium/campaign values are sanitized; referrers are reduced to hostnames.
- Traffic-event records exclude contact names, email addresses, telephone numbers, form messages, raw IP addresses and full user-agent strings. Enquiries retain their normal contact details in the existing protected CRM and may include consented attribution.
- A form submission without analytics consent still works and stays unattributed. A failed analytics write cannot discard a saved enquiry.
- Visit conversion is the percentage of recorded visits that include a successfully saved enquiry. Several enquiries in one visit count as one converted visit, so this rate cannot exceed 100%.
- Admin, API and password-recovery routes are excluded. Do Not Track and Global Privacy Control signals suppress tracking. Visitors can reopen Analytics preferences in the footer; declining stops new measurement and removes local visitor/session IDs.
- Local browser visitor IDs expire after 90 days. Server event retention is configurable from 30 to 365 days. Expired events are removed during incoming tracking activity; a quiet site may retain expired rows until the next recording activity. Clear visitor history removes built-in events without removing enquiries or Google data.
- Built-in date ranges use UTC. GA4 uses its property time zone; GSC uses Pacific time and only finalized Web-search data is requested. Recent GSC dates may lag. The three systems are not expected to have identical totals.
- GA4 key events reflect the property's configured key events. Mark `generate_lead` as a key event in GA4 if appropriate for your measurement plan.
- Google reports are cached in server memory for up to five minutes. Refresh requests new reports, subject to Google's quotas and availability.
- The built-in report reads up to 50,000 events per request. If reached, the UI explicitly asks for a narrower date range. GSC query/page tables show leading rows; anonymized queries and other API reporting limits can make row sums differ from totals.

Review the site's existing privacy text so that it accurately describes the tracking you choose to enable. This package does not replace your existing policy with invented legal terms.

## Recovery and operation

- Existing content backup exports continue to cover the original CMS collections. The separate analytics/integration tables and hosting secrets are not embedded in those JSON exports. Use database backups for those tables and retain environment secrets privately; reconnect Google after a restore when needed.
- Settings save and Google connection/disconnection actions are audited. Report reads are private and uncached at the browser response level.
- If Google reports fail, built-in visits and CRM enquiries remain available. The UI distinguishes authorization/property errors from a valid report containing zero rows.
- Existing email delivery behavior is retained; this release does not add an email delivery queue or claim live email-provider verification.

## Verification and limits

Automated checks cover event validation and minimization, consent and session behavior, attribution persistence, reporting math and deduplication, CSV escaping, settings validation, authorization/CSRF, deletion confirmation, enquiry preservation during analytics failure, OAuth encryption/state, the Strict-cookie return flow, and GA4/GSC requests and response parsing with mocked providers.

All 62 automated tests and the production build passed locally. Browser checks at widths 320, 390, 768, 1024 and 1440 pixels exercise the public consent/form flow and the actual CRM interface using explicit test API fixtures. No demonstration records or test routes are shipped. Real Google account authorization, Google report access and the Supabase migration require your account/project configuration; those external operations were not performed in this environment.

Primary API references:

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/batchRunReports
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- https://developers.google.com/webmaster-tools/v1/sites/list
