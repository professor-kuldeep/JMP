'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Icon from './Icon';

export default function Header({ settings = {}, menus }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const root = useRef(null);
  const toggle = useRef(null);
  const hidden = pathname.startsWith('/admin') || pathname.startsWith('/reset-password');
  const header = menus?.header || [];
  const isActive = (url) => url && (url === '/' ? pathname === '/' : pathname === url.split('#')[0]);

  function close() { setOpen(false); setExpanded(null); }

  useEffect(() => {
    const dismiss = (event) => {
      if (event.key === 'Escape') {
        const submenu = root.current?.querySelector('.dropdown.expanded .dropdown-toggle');
        const mobileMenu = root.current?.querySelector('.menu-toggle[aria-expanded="true"]');
        close(); (mobileMenu || submenu)?.focus();
      }
      if (event.type === 'pointerdown' && !root.current?.contains(event.target)) close();
    };
    const resize = () => { if (window.innerWidth > 1100) close(); };
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', dismiss);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('resize', resize);
    };
  }, []);

  if (hidden) return null;

  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header" ref={root}>
      <div className="header-utility"><div className="container">
        <span>{settings.tagline || 'Chartered Accountants'}<span className="utility-divider" aria-hidden="true">/</span>J M Pabari &amp; Associates</span>
        <div>{settings.email && <a href={`mailto:${settings.email}`}><Icon name="mail" size={13}/>{settings.email}</a>}{settings.phone && <a href={`tel:${settings.phone.replace(/[^+\d]/g, '')}`}><Icon name="phone" size={13}/>{settings.phone}</a>}</div>
      </div></div>
      <div className="container header-inner">
        <Link className="logo" href="/" aria-label={`${settings.siteName || 'J M Pabari & Associates'} home`} onClick={close}>
          <img src={settings.logo || '/assets/img/jm-logo.png'} alt={settings.siteName || 'J M Pabari & Associates'} width="290" height="60"/>
        </Link>
        <button ref={toggle} type="button" className={`menu-toggle ${open ? 'is-open' : ''}`} aria-label={open ? 'Close navigation' : 'Open navigation'} aria-controls="primary-navigation" aria-expanded={open} onClick={() => { setOpen(!open); setExpanded(null); }}>
          <Icon name={open ? 'close' : 'menu'}/>
        </button>
        <nav id="primary-navigation" className={`nav ${open ? 'open' : ''}`} aria-label="Primary navigation">
          {header.map((item, index) => item.children?.length ? (
            <div className={`nav-item dropdown ${expanded === index ? 'expanded' : ''}`} key={`${item.label}-${index}`}
              onPointerEnter={(event) => { if (event.pointerType === 'mouse' && window.innerWidth > 1100) setExpanded(index); }}
              onPointerLeave={(event) => { if (event.pointerType === 'mouse' && window.innerWidth > 1100 && !event.currentTarget.contains(document.activeElement)) setExpanded(null); }}>
              <Link href={item.url || '#'} className={`nav-link ${isActive(item.url) ? 'active' : ''}`} aria-current={isActive(item.url) ? 'page' : undefined} onClick={close}>{item.label}</Link>
              <button className="dropdown-toggle" type="button" aria-label={`${expanded === index ? 'Close' : 'Open'} ${item.label} submenu`} aria-controls={`submenu-${index}`} aria-expanded={expanded === index} onClick={() => setExpanded(expanded === index ? null : index)}><Icon name="chevron" size={13}/></button>
              <div id={`submenu-${index}`} className="dropdown-menu">
                <span className="dropdown-label">{item.label}</span>
                {item.children.map((child, childIndex) => <Link href={child.url || '#'} key={`${child.label}-${childIndex}`} onClick={close}>{child.label}<Icon name="arrow" size={15}/></Link>)}
              </div>
            </div>
          ) : (
            <Link className={`nav-link ${isActive(item.url) ? 'active' : ''} ${item.url?.split('#')[0] === '/contact' ? 'nav-cta' : ''}`} href={item.url || '#'} aria-current={isActive(item.url) ? 'page' : undefined} key={`${item.label}-${index}`} onClick={close}>{item.label}{item.url?.split('#')[0] === '/contact' && <Icon name="arrow" size={15}/>}</Link>
          ))}
        </nav>
      </div>
    </header>
  </>;
}
