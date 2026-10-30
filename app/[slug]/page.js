import { notFound } from 'next/navigation';
import { pageMetadata, safeJson, structuredData } from '../lib/seo.mjs';
import '../blog/blog.css';
import PageRenderer from '../components/PageRenderer';
import ClientPortal from '../components/ClientPortal';
import {WaitingListCancellation} from '../components/AppointmentWaitlist';
import SiteSearch from '../components/SiteSearch';
import {siteSearchEntries} from '../lib/site-search.mjs';
import Link from 'next/link';
import { getPageBySlug, getSettings, listPages } from '../lib/public-store';

export const dynamic = 'force-dynamic';


export async function generateMetadata({ params }) {
  const { slug } = await params;
  if (slug === 'search') return {title:'Search the website | JMP',robots:{index:false,follow:true}};
  if (slug === 'waitlist') return {title:'Appointment waiting list | JMP',robots:{index:false,follow:false},referrer:'no-referrer'};
  if (slug === 'client-portal') return {title:'Client portal | JMP',robots:{index:false,follow:false},referrer:'no-referrer'};
  const [page, settings] = await Promise.all([getPageBySlug(slug), getSettings()]);
  return pageMetadata(page, settings, process.env);
}

export default async function DynamicPage({ params }) {
  const { slug } = await params;
  if (slug === 'search') return <SiteSearch entries={siteSearchEntries(await listPages())}/>;
  if (slug === 'waitlist') return <WaitingListCancellation/>;
  if (slug === 'client-portal') { const settings=await getSettings(); return settings.clientPortalEnabled===true ? <ClientPortal/> : <main id="main-content" className="portal-shell"><span className="eyebrow">Client workspace</span><h1>Let’s help you get started.</h1><p>Contact the team to arrange access to your client workspace.</p><Link className="btn" href="/contact">Contact the team</Link></main>; }
  const [page, settings] = await Promise.all([getPageBySlug(slug), getSettings()]);
  if (!page) notFound();
  const relatedPosts = page.template === 'blog' ? (await listPages()).filter(post => post.template === 'blog' && !post.noIndex && post.id !== page.id).sort((a,b) => Number(b.blogCategory === page.blogCategory) - Number(a.blogCategory === page.blogCategory) || String(b.blogDate || b.createdAt || '').localeCompare(String(a.blogDate || a.createdAt || ''))).slice(0,3) : [];
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJson(structuredData(page, settings, process.env))}}/><PageRenderer page={page} settings={settings} relatedPosts={relatedPosts} availablePages={page.slug==='resources'?await listPages():[]}/></>;
}
