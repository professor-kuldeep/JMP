export function siteOrigin(settings = {}, environment = {}) {
  const raw = settings.siteUrl || environment.SITE_URL || environment.NEXT_PUBLIC_SITE_URL || (environment.VERCEL_PROJECT_PRODUCTION_URL ? `https://${environment.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  try { const url = new URL(raw); return ['http:','https:'].includes(url.protocol) && !url.username && !url.password ? url.origin : ''; } catch { return ''; }
}
export const pagePath = page => page.slug === 'home' ? '/' : `/${page.slug}`;
export function pageMetadata(page, settings = {}, environment = {}) {
  if (!page) return {};
  const base = siteOrigin(settings, environment), path = pagePath(page);
  const title = page.seoTitle || page.title;
  const description = page.metaDescription || '';
  const canonical = page.canonicalUrl || (base ? base + path : '');
  const image = page.ogImage || settings.defaultOgImage;
  return {
    title, description,
    alternates: canonical ? {canonical} : undefined,
    robots: page.noIndex ? {index:false, follow:false} : undefined,
    openGraph: { title:page.ogTitle || title, description:page.ogDescription || description, url:canonical || undefined, type:page.template === 'blog' ? 'article' : 'website', images:image ? [image] : undefined },
    twitter: {card: image ? 'summary_large_image' : 'summary', title:page.ogTitle || title, description:page.ogDescription || description, images:image ? [image] : undefined}
  };
}
export function structuredData(page, settings = {}, environment = {}) {
  const base = siteOrigin(settings, environment);
  if (!base) return [];
  const url = base + pagePath(page), businessId = base + '/#business';
  const absolute = path => { try { return new URL(path,base).href; } catch { return undefined; } };
  const data = [{ '@context':'https://schema.org', '@type':'AccountingService', '@id':businessId, name:settings.siteName, url:base, telephone:settings.phone || undefined, email:settings.email || undefined, logo:settings.logo ? absolute(settings.logo) : undefined, address:settings.address ? { '@type':'PostalAddress', streetAddress:settings.address, addressLocality:settings.addressLocality || undefined, addressRegion:settings.addressRegion || undefined, postalCode:settings.postalCode || undefined, addressCountry:settings.addressCountry || undefined } : undefined, sameAs:['linkedin','facebook','instagram'].map(key=>settings[key]).filter(value=>value && /^https:\/\//.test(value)) }];
  if (page.slug !== 'home') data.push({ '@context':'https://schema.org', '@type':'BreadcrumbList', itemListElement:[{ '@type':'ListItem', position:1, name:'Home', item:base+'/' }, { '@type':'ListItem', position:2, name:page.title, item:url }] });
  if (page.template === 'blog') data.push({ '@context':'https://schema.org', '@type':'Article', headline:page.heroTitle || page.title, mainEntityOfPage:url, datePublished:page.publishAt || page.blogDate || page.createdAt || undefined, dateModified:page.updatedAt || undefined, author:{ '@type':page.blogAuthorType === 'Person' ? 'Person' : 'Organization', name:page.blogAuthor || settings.siteName }, publisher:{ '@id':businessId }, image:page.ogImage || page.heroImage ? absolute(page.ogImage || page.heroImage) : undefined });
  return data;
}
export const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
