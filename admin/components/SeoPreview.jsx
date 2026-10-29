'use client';
export default function SeoPreview({ page }) {
  const title = page?.seoTitle || page?.title || 'Page title';
  const desc = page?.metaDescription || 'Add a meta description to control how this page may appear in search results.';
  const slug = page?.slug === 'home' ? '' : (page?.slug || 'page-url');
  return <div className="seo-preview-wrap">
    <div className="seo-preview">
      <div className="seo-url">https://yourdomain.com/{slug}</div>
      <div className="seo-title">{title}</div>
      <div className="seo-desc">{desc}</div>
    </div>
    <div className="seo-counters"><span className={(title.length > 60 || title.length < 35) ? 'warn' : 'ok'}>Title: {title.length}/60</span><span className={(desc.length > 160 || desc.length < 120) ? 'warn' : 'ok'}>Description: {desc.length}/160</span></div>
  </div>;
}
