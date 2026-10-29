# Appearance editor upgrade

Under **Admin → Appearance** you can now set the favicon (choose from Media or paste a URL), primary/accent/heading/text/page background/surface/link/footer colors using a color swatch or HEX input, and save Additional CSS in an advanced editor.

## Deployment

Upload the updated ZIP contents to the GitHub repository linked to Vercel and redeploy. No Supabase schema migration is needed: settings are saved in existing `cms_settings.data` JSON.

## Security and limitations

- Only users with `appearance:write` can save these settings.
- CSS is limited to 20,000 characters; `@import`, `@font-face`, CSS `url()` and browser-script patterns are rejected server-side. It only renders on public site paths, never on `/admin` or `/reset-password`.
- The browser favicon may be cached; hard-refresh or check in an incognito window after saving.
- Use square PNG, SVG or ICO files for favicon, preferably 32×32 or 48×48 pixels.
- CSS overrides may conflict with built-in styling. Test desktop and mobile layouts after saving.
- Core site styles may contain hard-coded colors; custom CSS can override those when theme variables do not affect a particular element.
