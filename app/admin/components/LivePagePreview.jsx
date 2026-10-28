'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import PageRenderer from '../../components/PageRenderer';
import { appearanceVariables } from '../../lib/appearance.mjs';

const documentShell = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="preview-root"></div></body></html>';
const widths = { desktop: 1280, tablet: 768, mobile: 390 };

export default function LivePagePreview({ page, settings = {}, menus = {}, device = 'desktop' }) {
  const iframe = useRef(null);
  const viewport = useRef(null);
  const [frameDocument, setFrameDocument] = useState(null);
  const [bounds, setBounds] = useState({ width: 430, height: 540 });
  const [expanded, setExpanded] = useState(false);
  const width = widths[device] || widths.desktop;
  const scale = Math.min(1, bounds.width / width);

  useEffect(() => {
    // An iframe can finish loading before React hydrates the parent.
    const connect = () => {
      const doc = iframe.current?.contentDocument;
      if (doc?.getElementById('preview-root')) setFrameDocument(doc);
    };
    const frame = iframe.current;
    connect(); frame?.addEventListener('load', connect);
    return () => frame?.removeEventListener('load', connect);
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setBounds({ width: entry.contentRect.width, height: entry.contentRect.height }));
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [expanded]);

  useEffect(() => {
    if (!frameDocument) return;
    const syncStyles = () => {
      const copies = [...document.head.querySelectorAll('link[rel="stylesheet"], style')].map(node => node.cloneNode(true));
      frameDocument.head.querySelectorAll('[data-preview-style]').forEach(node => node.remove());
      for (const node of copies) { node.setAttribute('data-preview-style', ''); frameDocument.head.appendChild(node); }
      frameDocument.documentElement.className = document.documentElement.className;
      frameDocument.title = `${page?.title || 'Page'} preview`;
    };
    syncStyles();
    const observer = new MutationObserver(syncStyles);
    observer.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'media'] });
    return () => observer.disconnect();
  }, [frameDocument, page?.title]);

  useEffect(() => {
    if (!frameDocument) return;
    const vars = appearanceVariables(settings);
    for (const [key, value] of Object.entries(vars)) frameDocument.body.style.setProperty(key, value);
  }, [frameDocument, settings]);

  useEffect(() => {
    if (!expanded) return;
    const close = event => { if (event.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', close);
    frameDocument?.addEventListener('keydown', close);
    return () => { document.removeEventListener('keydown', close); frameDocument?.removeEventListener('keydown', close); };
  }, [expanded, frameDocument]);

  function click(event) {
    const link = event.target.closest?.('a');
    if (!link) return;
    event.preventDefault(); event.stopPropagation();
    const href = link.getAttribute('href') || '';
    const hash = href.includes('#') ? href.slice(href.indexOf('#') + 1) : '';
    if (hash) frameDocument?.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
  }
  function jump(bottom = false) {
    const doc = iframe.current?.contentDocument;
    if (doc) doc.defaultView?.scrollTo({ top: bottom ? doc.documentElement.scrollHeight : 0, behavior: 'smooth' });
  }
  if (!page) return null;
  const target = frameDocument?.getElementById('preview-root');
  return <div className={`live-preview-shell actual-preview ${device} ${expanded ? 'preview-expanded' : ''}`} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={expanded ? 'Expanded page preview' : undefined}>
    <div className="actual-preview-tools"><span>{width}px · {Math.round(scale * 100)}%</span><div><button type="button" onClick={() => jump()}>Top</button><button type="button" onClick={() => jump(true)}>Bottom</button><button type="button" onClick={() => setExpanded(!expanded)}>{expanded ? 'Close preview' : 'Expand'}</button></div></div>
    <div className="preview-viewport" ref={viewport}>
      <iframe ref={iframe} title={`${page.title || 'Page'} ${device} preview`} sandbox="allow-same-origin" srcDoc={documentShell} onLoad={event => { const doc = event.currentTarget.contentDocument; if (doc?.getElementById('preview-root')) setFrameDocument(doc); }} style={{ width, height: bounds.height / scale, transform: `scale(${scale})` }}/>
      {target && createPortal(<div className="public-preview-document" onClickCapture={click} onSubmitCapture={event => { event.preventDefault(); event.stopPropagation(); }}>
        {settings.customCss && <style>{String(settings.customCss).replace(/<\/style/gi, '')}</style>}
        <Header settings={settings} menus={menus} preview/>
        <PageRenderer page={page} settings={settings} preview/>
        <Footer settings={settings} menus={menus} preview/>
      </div>, target)}
    </div>
    <div className="actual-preview-note">Scroll inside the page to see every section. Preview links and forms stay in the editor.</div>
  </div>;
}
