'use client';

import Link from 'next/link';
import { normalizedMenus } from '../lib/experience.mjs';
import { usePathname } from 'next/navigation';
import Icon from './Icon';
import FormattedText from './FormattedText';

export default function Footer({ settings = {}, menus, preview = false }) {
  const pathname = usePathname();
  if (!preview && (pathname.startsWith('/admin') || pathname.startsWith('/reset-password'))) return null;
  const navigation = normalizedMenus(menus);
  const footer = navigation.footer || navigation.header || [];
  // The bundled legacy footer bitmap is cropped; use the complete brand asset.
  const footerLogo = !settings.footerLogo || /^\/assets\/img\/footer-logo\.(png|webp)$/.test(settings.footerLogo)
    ? settings.logo || '/assets/img/jm-logo.webp' : settings.footerLogo;
  const social = [['linkedin', 'LinkedIn', 'in'], ['facebook', 'Facebook', 'f'], ['instagram', 'Instagram', '◎']].filter(([key]) => settings[key] && settings[key] !== '#');
  return <footer className="site-footer">
    <div className="container footer-topline"><span>{settings.tagline || 'Chartered Accountants'}</span><a href="#main-content">Back to top <Icon name="arrow" size={16}/></a></div>
    <div className="container footer-main">
      <div className="footer-brand">
        <img src={footerLogo} alt={settings.siteName || 'J M Pabari & Associates'} loading="lazy"/>
        <FormattedText text={settings.footerText || settings.tagline}/>
        {social.length > 0 && <div className="socials">{social.map(([key, label, mark]) => <a href={settings[key]} key={key} aria-label={label} target="_blank" rel="noopener noreferrer">{mark}</a>)}</div>}
      </div>
      <div className="footer-col"><h2>Explore</h2>{footer.slice(0, 7).map((item, index) => <Link href={item.url || '#'} key={`${item.label}-${index}`}>{item.label}</Link>)}</div>
      <div className="footer-col footer-contact"><h2>Get in touch</h2>
        {settings.phone && <a href={`tel:${settings.phone.replace(/[^+\d]/g, '')}`}><Icon name="phone" size={18}/><span>{settings.phone}</span></a>}
        {settings.email && <a href={`mailto:${settings.email}`}><Icon name="mail" size={18}/><span>{settings.email}</span></a>}
        {settings.address && <p><Icon name="pin" size={18}/><span>{settings.address}</span></p>}
      </div>
    </div>
    <div className="footer-bottom"><div className="container"><span>© {new Date().getFullYear()} {settings.siteName || 'J M Pabari & Associates'}. All rights reserved.</span><div>{(settings.analyticsEnabled || settings.visitorTrackingEnabled !== false) && !preview && <button type="button" className="analytics-preferences" onClick={()=>window.dispatchEvent(new Event('jmp-analytics-preferences'))}>Analytics preferences</button>}<Link href="/privacy-policy">Privacy Policy</Link><Link href="/terms-conditions">Terms &amp; Conditions</Link></div></div></div>
  </footer>;
}
