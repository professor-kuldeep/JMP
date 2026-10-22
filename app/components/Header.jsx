'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function Header({ settings, menus }) {
  const [open, setOpen] = useState(false);
  const header = menus?.header || [];
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="logo" href="/" aria-label={settings?.siteName || 'Website'}>
          <img src={settings?.logo || '/assets/img/jm-logo.png'} alt={settings?.siteName || 'Logo'} />
        </Link>
        <button className="menu-toggle" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span></span><span></span><span></span>
        </button>
        <nav className={`nav ${open ? 'open' : ''}`} aria-label="Primary navigation">
          {header.map((item) => (
            item.children?.length ? (
              <div className="nav-item dropdown" key={`${item.label}-${item.url}`}>
                <Link href={item.url || '#'} className="nav-link" onClick={() => setOpen(false)}>{item.label}</Link>
                <button className="dropdown-toggle" type="button" aria-label={`Open ${item.label} menu`}></button>
                <div className="dropdown-menu wide">
                  {item.children.map((child) => (
                    <Link href={child.url || '#'} key={`${child.label}-${child.url}`} onClick={() => setOpen(false)}>{child.label}</Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link className="nav-link" href={item.url || '#'} key={`${item.label}-${item.url}`} onClick={() => setOpen(false)}>{item.label}</Link>
            )
          ))}
        </nav>
      </div>
    </header>
  );
}
