import { getSettings } from './lib/store';
import { siteOrigin } from './lib/seo.mjs';
export const dynamic = 'force-dynamic';
export default async function robots() {
  const origin = siteOrigin(await getSettings(), process.env);
  return {rules:{userAgent:'*', allow:'/', disallow:['/admin','/api/','/reset-password']}, sitemap:origin ? origin+'/sitemap.xml' : undefined};
}
