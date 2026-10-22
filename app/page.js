import { notFound } from 'next/navigation';
import PageRenderer from './components/PageRenderer';
import { getPageBySlug, getSettings } from './lib/store';

export const dynamic = 'force-dynamic';

function metadataFor(page) {
  if (!page) return {};
  const title = page.seoTitle || page.title;
  const description = page.metaDescription || '';
  return {
    title,
    description,
    alternates: page.canonicalUrl ? { canonical: page.canonicalUrl } : undefined,
    robots: page.noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: page.ogTitle || title,
      description: page.ogDescription || description,
      images: page.ogImage ? [page.ogImage] : undefined
    }
  };
}

export async function generateMetadata() {
  return metadataFor(await getPageBySlug('home'));
}

export default async function HomePage() {
  const [page, settings] = await Promise.all([getPageBySlug('home'), getSettings()]);
  if (!page) notFound();
  return <PageRenderer page={page} settings={settings} />;
}
