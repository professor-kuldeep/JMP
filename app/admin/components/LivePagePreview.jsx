'use client';

import FormattedText from '../../components/FormattedText';

function PreviewSection({ section, settings }) {
  if (!section) return null;
  if (section.type === 'stats') return <div className="lp-stats">{(section.items || []).map((item, index) => <div key={index}><b>{item.value || '—'}</b><span>{item.label}</span></div>)}</div>;
  if (section.type === 'split') return <section className="lp-section lp-split"><div><small>{section.kicker}</small><h3>{section.title}</h3><FormattedText text={section.text}/>{section.buttonText && <span className="lp-btn">{section.buttonText}</span>}</div><div className="lp-mini-grid">{(section.cards || []).map((card, index) => <div className="lp-card" key={index}><b>{card.title}</b><FormattedText text={card.text}/></div>)}</div></section>;
  if (section.type === 'text') return <section className="lp-section"><small>{section.kicker}</small><h3>{section.title}</h3><FormattedText text={section.text}/></section>;
  if (section.type === 'brand') return <section className="lp-section lp-brand">{section.logo && <img src={section.logo} alt="" />}<div><h3>{section.title}</h3><FormattedText text={section.text}/></div></section>;
  if (section.type === 'cards') return <section className="lp-section"><small>{section.kicker}</small><h3>{section.title}</h3><div className="lp-card-grid">{(section.items || []).map((item, index) => <div className="lp-card" key={index}><b>{item.title}</b><span>{item.text}</span></div>)}</div></section>;
  if (section.type === 'process') return <section className="lp-section"><small>{section.kicker}</small><h3>{section.title}</h3><div className="lp-process">{(section.items || []).map((item, index) => <div key={index}><i>{index + 1}</i><b>{item.title}</b><span>{item.text}</span></div>)}</div></section>;
  if (section.type === 'cta') return <section className="lp-cta"><div><h3>{section.title}</h3><FormattedText text={section.text}/></div>{section.buttonText && <span className="lp-btn">{section.buttonText}</span>}</section>;
  if (section.type === 'contact') return <section className="lp-section lp-contact"><div><small>{section.kicker}</small><h3>{section.title}</h3><FormattedText text={section.text}/><p><b>{settings?.phone || 'Phone'}</b><br/>{settings?.email || 'Email'}</p></div><div className="lp-form"><span>Name</span><span>Email</span><span>Phone</span><span className="large">Message</span><b>Submit Enquiry</b></div></section>;
  return null;
}

export default function LivePagePreview({ page, settings = {}, device = 'desktop' }) {
  if (!page) return null;
  return <div className={`live-preview-shell ${device}`}>
    <div className="lp-browser"><span></span><span></span><span></span><div>{page.slug === 'home' ? '/' : `/${page.slug || 'new-page'}`}</div></div>
    <div className="lp-site">
      <header className="lp-header"><div className="lp-logo">{settings.logo ? <img src={settings.logo} alt="" /> : <b>{settings.siteName || 'JM Pabari'}</b>}</div><div className="lp-nav"><span>Home</span><span>Services</span><span>About</span><span>Contact</span></div></header>
      <section className="lp-hero">
        <div><small>{page.heroKicker}</small><h2>{page.heroTitle || page.title || 'Page Heading'}</h2><p>{page.heroText || 'Your page introduction will appear here.'}</p><div className="lp-actions">{page.button1Text && <span className="lp-btn">{page.button1Text}</span>}{page.button2Text && <span className="lp-btn secondary">{page.button2Text}</span>}</div></div>
        <div className="lp-hero-image">{page.heroImage ? <img src={page.heroImage} alt="" /> : <span>Hero Image</span>}</div>
      </section>
      {(page.sections || []).map((section, index) => <PreviewSection key={index} section={section} settings={settings} />)}
      <footer className="lp-footer"><b>{settings.siteName || 'J M Pabari & Associates'}</b><span>{settings.footerText || 'Footer content'}</span></footer>
    </div>
  </div>;
}
