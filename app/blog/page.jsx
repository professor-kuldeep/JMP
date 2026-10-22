import Link from 'next/link';
import { listPages } from '../lib/store';
import './blog.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Insights & Articles | JMP CoreTax', description: 'Read tax, accounting and compliance insights from the JMP CoreTax team.', alternates: { canonical: '/blog' } };

export default async function BlogIndex({ searchParams }) {
  const params = await searchParams;
  const category = typeof params?.category === 'string' ? params.category : '';
  const posts = (await listPages()).filter(p => p.template === 'blog' && !p.noIndex).sort((a,b)=>String(b.blogDate || b.createdAt || '').localeCompare(String(a.blogDate || a.createdAt || '')));
  const categories = [...new Set(posts.map(p=>p.blogCategory).filter(Boolean))].sort();
  const filtered = category ? posts.filter(p=>p.blogCategory === category) : posts;
  return <main className="jmp-blog"><section className="blog-heading"><div className="container"><span className="eyebrow">JMP CoreTax</span><h1>Insights & Articles</h1><p>News, guides and practical perspectives on tax, compliance and accounting.</p></div></section><div className="container blog-body"><nav className="blog-filters" aria-label="Blog categories"><Link href="/blog" className={!category?'selected':''}>All articles</Link>{categories.map(c=><Link key={c} className={category===c?'selected':''} href={`/blog?category=${encodeURIComponent(c)}`}>{c}</Link>)}</nav>{filtered.length ? <div className="blog-cards">{filtered.map(post=><article className="blog-entry" key={post.id}>{post.heroImage && <Link className="blog-image" href={`/${post.slug}`}><img src={post.heroImage} alt={post.title || 'Article featured image'} loading="lazy"/></Link>}<div className="blog-entry-inner"><div className="blog-byline"><span>{post.blogCategory || 'Insights'}</span>{(post.blogDate || post.createdAt) && <time dateTime={post.blogDate || post.createdAt}>{new Date(post.blogDate || post.createdAt).toLocaleDateString('en-IN',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'})}</time>}</div><h2><Link href={`/${post.slug}`}>{post.title}</Link></h2><p>{post.metaDescription || post.heroText || ''}</p><div className="blog-entry-foot"><span>By {post.blogAuthor || 'JMP Editorial Team'}</span><Link href={`/${post.slug}`}>Read article →</Link></div></div></article>)}</div> : <p className="blog-empty">{category?'No published posts in this category yet.':'No published articles yet. Check back soon.'}</p>}</div></main>;
}
