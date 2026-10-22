import Link from 'next/link';
export default function NotFound() {
  return <main className="section"><div className="container content-box"><span className="eyebrow">404</span><h1>Page not found</h1><p className="lead">The page may be unpublished or removed from the admin panel.</p><Link className="btn" href="/">Back to Home</Link></div></main>;
}
