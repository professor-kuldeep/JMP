import { notFound } from 'next/navigation';
import { pageMetadata, safeJson, structuredData } from '../lib/seo.mjs';
import '../blog/blog.css';
import PageRenderer from '../components/PageRenderer';
import { getPageBySlug, getSettings, listPages } from '../lib/store';

export const dynamic = 'force-dynamic';


export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [page, settings] = await Promise.all([getPageBySlug(slug), getSettings()]);
  return pageMetadata(page, settings, process.env);
}

export default async function DynamicPage({ params }) {
  const { slug } = await params;
  const [page, settings] = await Promise.all([getPageBySlug(slug), getSettings()]);
  if (!page) notFound();
  const relatedPosts = page.template === 'blog' ? (await listPages()).filter(post => post.template === 'blog' && !post.noIndex && post.id !== page.id).sort((a,b) => Number(b.blogCategory === page.blogCategory) - Number(a.blogCategory === page.blogCategory) || String(b.blogDate || b.createdAt || '').localeCompare(String(a.blogDate || a.createdAt || ''))).slice(0,3) : [];
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJson(structuredData(page, settings, process.env))}}/><PageRenderer page={page} settings={settings} relatedPosts={relatedPosts}/></>;
}
