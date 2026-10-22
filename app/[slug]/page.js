import { notFound } from 'next/navigation';
import PageRenderer from '../components/PageRenderer';
import { getPageBySlug, getSettings } from '../lib/store';

export const dynamic = 'force-dynamic';

function metadataFor(page) {
  if (!page) return { title: 'Page' };
  const title = page.seoTitle || page.title || 'Page';
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

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return metadataFor(await getPageBySlug(slug));
}

export default async function DynamicPage({ params }) {
  const { slug } = await params;
  const [page, settings] = await Promise.all([getPageBySlug(slug), getSettings()]);
  if (!page) notFound();
  return <PageRenderer page={page} settings={settings} />;
}
