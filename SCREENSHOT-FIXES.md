# Screenshot review — v9.0.1

This update includes the Vercel function-limit fix and the visible issues marked in the second screenshot.

- **Hero image and caption:** the image remains 4:3. Its caption is now a compact, full-width panel directly below the photo. The offset blue box, extra outline, decorative arrow and tiny “JMP / ADVISORY” label have been removed.
- **Footer logo:** the cropped legacy footer image no longer falls back to the header image. A dedicated full footer mark (`public/assets/img/footer-brand.svg`) uses the supplied complete JMP brand artwork with a transparent, light treatment for the dark footer. Custom Footer Logo selections remain respected; a dark treatment is applied to the built-in mark on light footer backgrounds.
- **Analytics text:** “Allow optional analytics to help us improve this website. Your enquiry details are not included.” Decline/Allow controls and consent behavior remain unchanged.
- **Empty service finder:** older databases can have published service overview pages without the newer individual service pages. The finder now links to the published detail page when available, otherwise to an existing overview/section. It does not require creating replacement CMS pages. If no relevant service pages are published, a direct enquiry prompt appears instead of an empty set of controls.
- **Related links and footer navigation:** known service links use the same published-page fallback, repeated footer entries are removed, and a contact-form CTA labelled “Book a Consultation” is rendered as “Request a Consultation”.

No extra database migration is required for these presentation changes. Your current CMS copy is retained. The original v9 database migration remains required for the v9 CRM and operations features.

Read `VERCEL-HOBBY-FIX.md` before redeploying. Upload the complete package, keep the Next.js framework preset, and use `npm run build` so the old-route compatibility check runs.

The visual treatment was reviewed against the supplied screenshots and covered by component/asset checks. Full browser layout QA has not been completed in this workspace.
