# JMP CMS v7: website, editor and preview upgrade

## Fixes requested

### Long pages can be scrolled in the preview

The preview now renders the same Header, PageRenderer and Footer used by the public website inside a separate document. It has its own bounded viewport and native document scrolling, rather than a clipped miniature page.

- Desktop (1280px), tablet (768px) and mobile (390px) modes use actual responsive breakpoints.
- Top and Bottom controls move within the preview document.
- Expand opens a larger preview; Close or Escape returns to the editor.
- Text, colours, sections and navigation reflect the current editor state.
- Links and enquiry forms are intercepted so previewing stays inside the editor and cannot submit enquiries.
- Frame initialisation also handles the case where the document loads before React hydrates the parent.

### Formatting buttons toggle correctly

Bold, italic, underline, strikethrough, inline code, headings, lists and quotes toggle off when applied again. The editor recognises existing formatting rather than adding another pair of Markdown markers. Selection is restored after each action.

It also includes active button indicators, clear formatting, undo/redo and Ctrl/Cmd+B, I and U shortcuts. Nested bold/italic is rendered correctly. Existing Markdown content remains supported; raw HTML is still rendered as text.

## Website improvements

- Six dedicated service pages: Audit & Assurance, Income Tax, GST & Indirect Tax, Accounting & Bookkeeping, Corporate Compliance and Financial & Business Advisory.
- Editable FAQ and Team / Partner Profiles section types.
- Resources page with three downloadable preparation checklists.
- Careers copy no longer contains authoring placeholders or claims that vacancies have been confirmed.
- Blog search, category/author filters, pagination and related articles.
- Canonical URLs, default social sharing image, sitemap.xml, robots.txt and business/breadcrumb/article structured data.
- Optimised WebP versions of bundled images; original PNG URLs remain available.
- Request-level memoisation reduces duplicate public content reads without caching private admin records across requests.

Real partner names, qualifications and photographs were not available. Use the Team / Partner Profiles section to add approved details; the upgrade does not invent staff or credentials.

## Admin improvements

- Website Health screen with search, media and configuration checks.
- A reviewable content upgrade plan for an existing CMS database.
- Scheduled publication using the optional Publish on field. Choose Published and save. The page becomes public on requests at or after that time; drafts remain private. The date/time input uses the editor's local time. No database schema change or external scheduled task is needed.
- Unsaved-change warnings for page editing and configuration; existing browser draft recovery is retained.
- Follow-up reminders and an overdue enquiry filter, with a configurable interval.
- Controls for the final website URL, structured address fields, sharing image, analytics, email notifications and visitor acknowledgements.

## Apply to the existing GitHub / Vercel project

1. Extract the ZIP and place the files inside JMP-main/ at your repository root.
2. Keep the existing hosting environment variables, Supabase project, authentication configuration and database.
3. Run npm ci, npm test and npm run build, then redeploy through the existing Vercel project.
4. In Admin > Site Settings, add the final website URL and review sharing/business details.
5. For an existing populated database, open Admin > Website Health. Review the displayed content upgrade plan and apply it. Missing service pages are created as drafts; review and publish them, then update relevant navigation links in Admin > Navigation. Only recognised original placeholder content in Resources/Careers is replaced, with a revision retained. Customised content is preserved.
6. Review the website on the deployed domain and verify the connected Supabase workflows with your own administrator account.

The revised seed content is used by a fresh installation or the read-only preview. A populated database is not overwritten by replacing application files. No schema reset, migration, bootstrap or backup restore is needed for this upgrade.

## Optional email delivery

Add these server-side environment variables in your hosting provider:

- RESEND_API_KEY: a Resend sending API key.
- ENQUIRY_EMAIL_FROM: a sender using your verified sending domain.
- ENQUIRY_EMAIL_TO: optional fixed team recipient; takes precedence over the Forms setting.

Then enable team notifications and/or visitor acknowledgements in Admin > Forms and save. API keys are never stored in public CMS settings. Enquiries are saved before attempting email delivery, and mail errors do not discard the enquiry. Stable idempotency keys reduce duplicate delivery on retries. Delivery still depends on a configured, functioning mail provider; this package does not include a background retry queue.

Follow-up reminders appear within the CMS. The upgrade does not send scheduled follow-up emails.

## Optional analytics

Add your GA4 measurement ID in Admin > Site Settings and enable analytics. A visitor preference prompt appears before loading GA4. The footer allows the preference to be revisited. Custom events cover successful enquiry submissions, consultation links, telephone/email clicks and resource downloads; form contents and personal details are excluded. Admin and password-recovery paths are excluded.

The Content Security Policy permits the configured same-origin preview and the specific Google endpoints required by this feature; production does not allow eval or third-party framing.

## Verification

- Automated tests cover repeated formatting toggles, rendered toolbar behaviour, keyboard shortcuts, undo/redo, nested formatting, safe text rendering and long-page preview rendering/controls.
- Further tests cover scheduled visibility, follow-up reminders, canonical URLs, structured data, blog filters/pagination, non-destructive content upgrades and email success/failure handling with a mocked provider.
- Production compilation and route generation were checked.
- The cloud preview served the public and editor fixture pages, but its client interactions did not update reliably. DOM component tests were used to verify the editor and preview controls. Cross-browser/mobile layout verification on the deployed site remains advisable.
- Live Supabase login/2FA, database writes, media uploads, real email delivery and GA4 reporting were not exercised because project credentials were not supplied.

No test-only preview routes, sample administrator sessions, local stores, secret environment files, node_modules or generated build output are included in the ZIP.
