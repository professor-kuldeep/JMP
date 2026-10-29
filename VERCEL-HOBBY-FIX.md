# Vercel function-limit fix — v9.0.1

The screenshot reports: “No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan.” This package reduces routing entry points while retaining the v9 website, CRM, booking, analytics, authentication and operations features.

## What changed

- The 46 API implementation modules are now in the Next.js private folder `app/_api`. They are no longer separate deployable API routes.
- `app/api/[...path]/route.js` dispatches the existing URLs to those modules. Browser code, OAuth redirect URLs, the scheduler URL and existing integrations use the same public paths.
- Static routes take priority over dynamic IDs. Unsupported methods return 405 and never fall through to a different endpoint. HEAD and OPTIONS retain normal HTTP behavior. Requests, cookies, uploads, query strings, authentication, CSRF checks and deferred work reach the existing handlers.
- The Node.js API entry point retains a 60-second maximum duration for maintenance and backup operations.
- `npm run build` now runs a preparation step and a conservative routing-budget check. The final Next.js manifest has one API entry point and 12 total App Router entries, including internal error pages. Local packaging with `@vercel/next 27.0.1` produced **3 unique bundled functions**; aliases such as RSC paths share those bundles.

## Redeploy this package

1. Extract the archive and update the existing repository with the **contents of `JMP-main`**.
2. In Vercel → Project Settings → Build and Deployment, use:

   | Setting | Value |
   | --- | --- |
   | Framework Preset | Next.js |
   | Root Directory | The directory containing `package.json`, `vercel.json` and `app/` |
   | Build Command | `npm run build` |
   | Install Command | `npm install` or `npm ci` |
   | Output Directory | Default; remove a custom override |
   | Node.js | 24.x |

   If these files are directly at the repository root, leave Root Directory empty. If they are in a `JMP-main` subdirectory, select that directory.
3. Keep the existing environment variables and Supabase configuration.
4. Deploy the new commit. For this first deployment, turn off **Use existing Build Cache** in the Redeploy dialog.
5. Build logs should show the preparation result (`apiHandlers: 46`, `apiEntrypoints: 1`) and the final routing budget. Confirm the new deployment, then test sign-in and a form submission.

Use `npm run build`, rather than overriding the build with `next build`, so the compatibility guard runs.

## Uploading through GitHub

GitHub's **Upload files** action adds/replaces files but does not delete old ones. The preparation step recognises unchanged v9 API files still in `app/api` and moves them into the private `app/_api-migration-backup` folder during the build. Their contents are preserved, and they no longer create functions.

If an old API file contains custom changes, or an unknown extra API route is present, the build stops with its filename before moving any of those files. Merge the custom changes into the corresponding `app/_api` module and update `scripts/api-routes.json` when adding a URL. This prevents custom work from being silently discarded.

The new archive already has the consolidated source layout. Source modules and the route registry must all be uploaded together. Files whose names start with `_` are required private application code; retain them.

## Validation

- 112 automated tests pass, including the original v9 tests and additional dispatcher/migration/budget checks.
- The production Next.js build passes the 12-entry conservative budget.
- Local Vercel packaging produces 3 unique functions, below the screenshot's 12-function limit.
- Production HTTP smoke checks cover the public site, all protected API methods, method handling, dynamic IDs, OAuth failure redirects and image optimization.

The existing Vercel project has not been redeployed from this workspace. A different framework/root configuration or additional unrelated serverless files in the repository can change deployment output; use the settings above and the complete project contents.

The package also includes the presentation fixes in `SCREENSHOT-FIXES.md`. There is **no additional SQL migration** beyond the v9 migration already included in `EXPERIENCE-UPGRADE.md`. Calendar, email, Google reporting, backup keys and scheduler settings are unchanged.

References: https://vercel.com/docs/functions/runtimes and https://nextjs.org/docs/app/getting-started/project-structure#private-folders.
