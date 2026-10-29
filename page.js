import { notFound } from 'next/navigation';
import { pageMetadata, safeJson, structuredData } from './lib/seo.mjs';
import PageRenderer from './components/PageRenderer';
import { getPageBySlug, getSettings } from './lib/store';

export const dynamic = 'force-dynamic';


export async function generateMetadata() {
  const [page, settings] = await Promise.all([getPageBySlug('home'), getSettings()]);
  return pageMetadata(page, settings, process.env);
}

export default async function HomePage() {
  const [page, settings] = await Promise.all([getPageBySlug('home'), getSettings()]);
  if (!page) notFound();
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJson(structuredData(page, settings, process.env))}}/><PageRenderer page={page} settings={settings}/></>;
}
