'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { normalizedMenus } from '../lib/experience.mjs';
import Icon from './Icon';

export default function Header({ settings = {}, menus, preview = false }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const root = useRef(null);
  const toggle = useRef(null);
  const hidden = !preview && (pathname.startsWith('/admin') || pathname.startsWith('/reset-password'));
  const header = normalizedMenus(menus).header || [];
  const isActive = (url) => url && (url === '/' ? pathname === '/' : pathname === url.split('#')[0]);

  function close() { setOpen(false); setExpanded(null); }

  useEffect(() => {
    const ownerDocument = root.current?.ownerDocument || document;
    const ownerWindow = ownerDocument.defaultView || window;
    const dismiss = (event) => {
      if (event.key === 'Escape') {
        const submenu = root.current?.querySelector('.dropdown.expanded .dropdown-toggle');
        const mobileMenu = root.current?.querySelector('.menu-toggle[aria-expanded="true"]');
        close(); (mobileMenu || submenu)?.focus();
      }
      if (event.type === 'pointerdown' && !root.current?.contains(event.target)) close();
    };
    const resize = () => { if (ownerWindow.innerWidth > 1100) close(); };
    ownerDocument.addEventListener('keydown', dismiss);
    ownerDocument.addEventListener('pointerdown', dismiss);
    ownerWindow.addEventListener('resize', resize);
    return () => {
      ownerDocument.removeEventListener('keydown', dismiss);
      ownerDocument.removeEventListener('pointerdown', dismiss);
      ownerWindow.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(()=>{const el=root.current;if(!el)return;const doc=el.ownerDocument,measure=()=>doc.documentElement.style.setProperty('--site-header-height',Math.ceil(el.getBoundingClientRect().height)+'px');const observer=new ResizeObserver(measure);observer.observe(el);measure();return()=>observer.disconnect();},[hidden]);

  if (hidden) return null;

  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header" ref={root}>
      <div className="header-utility"><div className="container">
        <span>{settings.tagline || 'Chartered Accountants'}<span className="utility-divider" aria-hidden="true">/</span>J M Pabari &amp; Associates</span>
        <div>{settings.clientPortalEnabled===true && <Link href="/client-portal">Client portal</Link>}{settings.email && <a href={`mailto:${settings.email}`}><Icon name="mail" size={13}/>{settings.email}</a>}{settings.phone && <a href={`tel:${settings.phone.replace(/[^+\d]/g, '')}`}><Icon name="phone" size={13}/>{settings.phone}</a>}</div>
      </div></div>
      <div className="container header-inner">
        <Link className="logo" href="/" aria-label={`${settings.siteName || 'J M Pabari & Associates'} home`} onClick={close}>
          <img src={settings.logo || '/assets/img/jm-logo.webp'} alt={settings.siteName || 'J M Pabari & Associates'} width="290" height="60"/>
        </Link>
        <button ref={toggle} type="button" className={`menu-toggle ${open ? 'is-open' : ''}`} aria-label={open ? 'Close navigation' : 'Open navigation'} aria-controls="primary-navigation" aria-expanded={open} onClick={() => { setOpen(!open); setExpanded(null); }}>
          <Icon name={open ? 'close' : 'menu'}/>
        </button>
        <nav id="primary-navigation" className={`nav ${open ? 'open' : ''}`} aria-label="Primary navigation">
          <Link className="nav-search-link" href="/search" onClick={close} aria-label="Search the website"><Icon name="document" size={16}/><span>Search website</span></Link>
          {header.map((item, index) => item.children?.length ? (
            <div className={`nav-item dropdown ${expanded === index ? 'expanded' : ''}`} key={`${item.label}-${index}`}
              onPointerEnter={(event) => { if (event.pointerType === 'mouse' && (root.current?.ownerDocument.defaultView?.innerWidth || window.innerWidth) > 1100) setExpanded(index); }}
              onPointerLeave={(event) => { if (event.pointerType === 'mouse' && (root.current?.ownerDocument.defaultView?.innerWidth || window.innerWidth) > 1100 && !event.currentTarget.contains(root.current?.ownerDocument.activeElement)) setExpanded(null); }}>
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
