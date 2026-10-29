import Link from 'next/link';
import SiteImage from './SiteImage';
export default function ArticleCard({post}) {
  const date = new Date(post.blogDate || post.createdAt || '');
  return <article className="blog-entry">
    {post.heroImage && <Link className="blog-image" href={`/${post.slug}`}><SiteImage src={post.heroImage} alt={post.title || 'Article image'} width={600} height={375}/></Link>}
    <div className="blog-entry-inner"><div className="blog-byline"><span>{post.blogCategory || 'Insights'}</span>{Number.isFinite(date.getTime()) && <time dateTime={date.toISOString()}>{date.toLocaleDateString('en-IN',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'})}</time>}</div>
      <h2><Link href={`/${post.slug}`}>{post.title}</Link></h2><p>{post.metaDescription || post.heroText || ''}</p>
      <div className="blog-entry-foot"><Link href={`/blog?author=${encodeURIComponent(post.blogAuthor || 'JMP Editorial Team')}`}>By {post.blogAuthor || 'JMP Editorial Team'}</Link><Link href={`/${post.slug}`}>Read article →</Link></div>
    </div>
  </article>;
}
