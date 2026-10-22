import Link from 'next/link';

export default function Footer({ settings, menus }) {
  const footer = menus?.footer || menus?.header || [];
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div className="footer-brand">
          <img src={settings?.footerLogo || settings?.logo || '/assets/img/footer-logo.png'} alt={settings?.siteName || 'Logo'} />
          <p>{settings?.footerText || settings?.tagline}</p>
        </div>
        <div className="footer-col">
          <h4>Quick Links</h4>
          {footer.slice(0, 7).map((item) => <Link href={item.url || '#'} key={`${item.label}-${item.url}`}>{item.label}</Link>)}
        </div>
        <div className="footer-col">
          <h4>Contact Us</h4>
          {settings?.phone && <p>☎ {settings.phone}</p>}
          {settings?.email && <p>✉ {settings.email}</p>}
          {settings?.address && <p>⌖ {settings.address}</p>}
        </div>
        <div className="footer-col">
          <h4>Follow Us</h4>
          <div className="socials">
            <a href={settings?.linkedin || '#'} aria-label="LinkedIn">in</a>
            <a href={settings?.facebook || '#'} aria-label="Facebook">f</a>
            <a href={settings?.instagram || '#'} aria-label="Instagram">◎</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          <span>© {new Date().getFullYear()} {settings?.siteName || 'Website'}. All Rights Reserved.</span>
          <span><Link href="/privacy-policy">Privacy Policy</Link><Link href="/terms-conditions">Terms &amp; Conditions</Link></span>
        </div>
      </div>
    </footer>
  );
}
