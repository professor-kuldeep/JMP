# JMP CMS Blog Management

Go to `/admin` → Blog → **New Blog Post**. Set title, unique URL slug, category, author, publication date, hero description (excerpt), hero image (featured image), content sections, and SEO metadata. Save Draft to keep it private, or Publish to add it automatically to `/blog`. Published articles keep their existing `/<slug>` links; the `/blog` listing only links to published, indexable articles. Use category filters on `/blog` and in CMS. The categories are free-text labels; use consistent spelling. The existing Supabase `cms_pages.data` JSON stores these additional fields; no migration is necessary. Do not use `blog` as an article slug (reserved for the index).

### Notes

- This is an extension of the existing CMS, not a separate blogging service. Existing admin permissions continue to govern editing, publishing, and deleting.
- The content editor still uses the existing section-based editor rather than a WordPress block editor.
- Use the Media Library to upload featured images.
- The article public URL format remains `/<slug>` to avoid breaking existing links.
- Commit and deploy to Vercel as usual. No Supabase reset or schema execution is required for this feature.
