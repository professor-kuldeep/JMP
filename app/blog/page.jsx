import Link from 'next/link';
import { getSettings, listPages } from '../lib/store';
import { selectPosts, blogHref } from '../lib/blog.mjs';
import { siteOrigin } from '../lib/seo.mjs';
import ArticleCard from '../components/ArticleCard';
import './blog.css';

export const dynamic = 'force-dynamic';
export async function generateMetadata({searchParams}) {
  const params = await searchParams;
  const [settings,pages] = await Promise.all([getSettings(),listPages()]);
  const normalized = selectPosts(pages.filter(p=>p.template === 'blog' && !p.noIndex),params);
  const origin = siteOrigin(settings,process.env);
  return {title:'Insights & Articles | JMP CoreTax', description:'Read tax, accounting and compliance insights from the JMP CoreTax team.', alternates:origin ? {canonical:origin+blogHref({category:params?.category,author:params?.author,page:normalized.page})} : undefined, robots:params?.q ? {index:false,follow:true} : undefined};
}
export default async function BlogIndex({searchParams}) {
  const params = await searchParams;
  const posts = (await listPages()).filter(p => p.template === 'blog' && !p.noIndex).sort((a,b)=>String(b.blogDate || b.createdAt || '').localeCompare(String(a.blogDate || a.createdAt || '')));
  const categories = [...new Set(posts.map(p=>p.blogCategory).filter(Boolean))].sort();
  const selection = selectPosts(posts,params);
  const {q,category,author,page,totalPages,total,items} = selection;
  return <main id="main-content" className="jmp-blog public-main" tabIndex={-1}>
    <section className="blog-heading"><div className="container"><span className="eyebrow">JMP CoreTax</span><h1>Insights &amp; Articles</h1><p>Guides and practical perspectives on tax, compliance and accounting.</p></div></section>
    <div className="container blog-body">
      <form className="blog-search" action="/blog" role="search"><label htmlFor="article-search">Find an article</label><div><input id="article-search" name="q" type="search" defaultValue={q} placeholder="Search topics, titles or authors" maxLength={100}/>{category && <input type="hidden" name="category" value={category}/>}<button type="submit" className="btn">Search</button></div></form>
      <nav className="blog-filters" aria-label="Blog categories"><Link href={blogHref({q,author})} className={!category?'selected':''}>All articles</Link>{categories.map(c=><Link key={c} className={category===c?'selected':''} href={blogHref({category:c,q,author})}>{c}</Link>)}</nav>
      {(q || author || category) && <p className="blog-results">{total} {total === 1 ? 'article' : 'articles'}{q ? ` matching “${q}”` : ''}{author ? ` by ${author}` : ''}<Link href="/blog">Clear filters</Link></p>}
      {items.length ? <div className="blog-cards">{items.map(post=><ArticleCard key={post.id} post={post}/>)}</div> : <div className="blog-empty"><p>{posts.length?'No articles match these filters.':'Our team’s published articles will appear here.'}</p><Link href={posts.length ? '/blog' : '/resources'}>{posts.length ? 'View all articles →' : 'Browse preparation checklists →'}</Link></div>}
      {totalPages > 1 && <nav className="blog-pagination" aria-label="Article pages">{page > 1 && <Link href={blogHref({category,author,q,page:page-1})}>← Previous</Link>}<span>Page {page} of {totalPages}</span>{page < totalPages && <Link href={blogHref({category,author,q,page:page+1})}>Next →</Link>}</nav>}
    </div>
  </main>;
}
