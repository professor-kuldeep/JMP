import Link from 'next/link';
export default function NotFound() {
  return <main id="main-content" className="public-main section" tabIndex={-1}><div className="container content-box"><span className="eyebrow">404</span><h1>Page not found</h1><p className="lead">The page you are looking for may have moved. Return to the homepage to find what you need.</p><Link className="btn" href="/">Back to Home</Link></div></main>;
}
