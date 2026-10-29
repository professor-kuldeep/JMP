# CSS and appearance corrections

This update corrects the low-contrast headings visible in the supplied screenshot, improves responsive typography and card borders, uses a 4:3 desktop hero photograph, and displays the complete supplied logo in the footer.

## What changed

- `app/globals.css`: background-specific text colors, readable buttons and footer colors, working font fallbacks, continuous feature-card borders, responsive headings, and a 4:3 desktop hero frame. Photos keep their proportions through `object-fit: cover`.
- `app/lib/appearance.mjs`: shared theme resolution for the website and CMS preview. Invalid color values fall back safely. Foreground colors adjust when the selected background would make them hard to read; brand and background selections remain available.
- `app/layout.js` and `app/admin/components/LivePagePreview.jsx`: both render the same resolved appearance variables.
- `app/components/Footer.jsx`: the bundled footer bitmap was already cropped. When that legacy asset is selected, the footer now uses the complete main logo. Other custom footer logos remain supported.
- `app/admin/page.js`: adds **Restore default colors** in Appearance. This changes the editable palette; **Save Appearance** publishes it.
- `app/blog/blog.css`: uses the same readable colors on blog headings and filters.
- `tests/appearance.test.mjs`: covers the screenshot palette, default colors, dark surfaces, light branding, light footers, malformed settings, and preservation of saved settings.

## Apply the update

1. Copy the contents of `JMP-main/` to the existing project root and redeploy through your existing hosting workflow.
2. Keep the existing environment variables, Supabase connection, uploaded media and database. This update requires no database migration or reset.
3. If the current website has gray backgrounds and you want the original navy, gold and white palette, open **Admin > Appearance > Restore default colors > Save Appearance**. Existing stored background choices are otherwise respected. Advanced Custom CSS remains an explicit override.

The website remains a responsive, vertically scrolling page. The 4:3 setting applies to the desktop hero image, rather than clipping or stretching the full page into a fixed-size canvas.

## Verification

- `npm ci --no-audit --no-fund` completed using the supplied lockfile and Node 24.
- `npm test`: all 38 tests passed.
- `npm run build`: production compilation and route generation passed.
- Chromium checks passed at widths 320, 360, 390, 560, 768, 800, 801, 1024, 1101, 1280 and 1440 pixels, including mobile navigation, submenu controls, Escape dismissal, image loading, hero proportions, consistent CTA gutters and absence of horizontal overflow.
- About, services, contact, blog and admin routes loaded successfully on a phone-sized viewport.
- Rendered heading contrast was checked using both the screenshot's pale-heading/gray-background palette and a dark-surface palette. Default desktop and phone layouts were visually inspected. No browser runtime errors were observed.

Live database authentication and production deployment were not part of this local CSS update. No credentials, dependencies, build output, browser binaries or test screenshots are included in this ZIP.
