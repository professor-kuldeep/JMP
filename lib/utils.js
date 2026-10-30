export function cleanSlug(slug) {
  return String(slug || '')
    .toLowerCase()
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'new-page';
}

export function pagePath(slug) {
  return slug === 'home' ? '/' : `/${slug}`;
}

export function stripHtml(value = '') {
  return String(value).replace(/<[^>]*>/g, '');
}
