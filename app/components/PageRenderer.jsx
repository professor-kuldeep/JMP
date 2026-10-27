import FormattedText from './FormattedText';
import './formatted-text.css';
import Link from 'next/link';
import ContactForm from './ContactForm';

function Hero({ page }) {
  return (
    <section className="hero">
      <div className="container">
        <div>
          {page.heroKicker && <span className="eyebrow">{page.heroKicker}</span>}
          <h1>{page.heroTitle || page.title}</h1>
          {page.heroText && <FormattedText text={page.heroText} className="lead"/>}
          <div className="hero-actions">
            {page.button1Text && <Link className="btn" href={page.button1Url || '/contact'}>{page.button1Text}</Link>}
            {page.button2Text && <Link className="btn outline" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.35)' }} href={page.button2Url || '/our-services'}>{page.button2Text}</Link>}
          </div>
        </div>
        <div className="hero-art">
          {page.heroImage ? <img src={page.heroImage} alt={page.heroTitle || page.title || ''} /> : <div><h2>{page.template === 'service' ? 'CoreTax' : 'CA'}</h2><p>Professional financial clarity</p></div>}
        </div>
      </div>
    </section>
  );
}

function Section({ section, settings }) {
  if (!section) return null;
  if (section.type === 'stats') {
    return <div className="container trust-strip">{(section.items || []).map((item, index) => <div className="trust-item" key={index}><strong>{item.value}</strong><p>{item.label}</p></div>)}</div>;
  }
  if (section.type === 'split') {
    return <section className="section"><div className="container split-grid"><div>{section.kicker && <span className="eyebrow">{section.kicker}</span>}<h2>{section.title}</h2><FormattedText text={section.text} className="lead"/>{section.buttonText && <Link className="btn" href={section.buttonUrl || '#'}>{section.buttonText}</Link>}</div><div className="feature-card"><div className="feature-grid">{(section.cards || []).map((card, index) => <div className="mini-card" key={index}><div className="icon-circle">✓</div><h3>{card.title}</h3><FormattedText text={card.text}/></div>)}</div></div></div></section>;
  }
  if (section.type === 'text') {
    return <section className="section"><div className="container"><div className="content-box">{section.kicker && <span className="eyebrow">{section.kicker}</span>}<h2>{section.title}</h2><FormattedText text={section.text} className="lead"/></div></div></section>;
  }
  if (section.type === 'brand') {
    return <section className="section"><div className="container brand-panel">{section.logo && <img src={section.logo} alt={section.title || 'Brand'} />}<div><span className="eyebrow">Dedicated Entity</span><h2>{section.title}</h2><FormattedText text={section.text} className="lead"/></div></div></section>;
  }
  if (section.type === 'cards') {
    return <section className="section section-soft"><div className="container">{section.kicker && <span className="eyebrow">{section.kicker}</span>}<h2>{section.title}</h2><div className="card-grid three">{(section.items || []).map((item, index) => <article className="service-card" id={item.id || undefined} key={index}>{item.url ? <Link href={item.url}><h3>{item.title}</h3><FormattedText text={item.text}/></Link> : <><h3>{item.title}</h3><FormattedText text={item.text}/></>}</article>)}</div></div></section>;
  }
  if (section.type === 'process') {
    return <section className="section"><div className="container">{section.kicker && <span className="eyebrow">{section.kicker}</span>}<h2>{section.title}</h2><div className="process-grid">{(section.items || []).map((item, index) => <div className="process-card" key={index}><h3>{item.title}</h3><FormattedText text={item.text}/></div>)}</div></div></section>;
  }
  if (section.type === 'cta') {
    return <section className="section"><div className="container cta-band"><div><h2>{section.title}</h2><FormattedText text={section.text}/></div>{section.buttonText && <Link className="btn" href={section.buttonUrl || '#'}>{section.buttonText}</Link>}</div></section>;
  }
  if (section.type === 'contact') {
    return <section className="section"><div className="container contact-wrap"><div>{section.kicker && <span className="eyebrow">{section.kicker}</span>}<h2>{section.title || 'Reach our team'}</h2><FormattedText text={section.text || 'Fill the form and the enquiry will be saved inside Admin → Enquiries.'} className="lead"/><div className="content-box">{settings?.phone && <p><strong>Phone:</strong> {settings.phone}</p>}{settings?.email && <p><strong>Email:</strong> {settings.email}</p>}{settings?.address && <p><strong>Location:</strong> {settings.address}</p>}</div></div><ContactForm services={settings?.formServices} heading={settings?.formHeading} successMessage={settings?.formSuccessMessage} /></div></section>;
  }
  return null;
}

export default function PageRenderer({ page, settings = {} }) {
  return (
    <main>
      <Hero page={page} />
      {page.template === 'blog' && <div className="container blog-article-byline"><span>{page.blogCategory || 'Insights'}</span><span>By {page.blogAuthor || 'JMP Editorial Team'}</span>{page.blogDate && <time dateTime={page.blogDate}>{new Date(`${page.blogDate}T00:00:00Z`).toLocaleDateString('en-IN',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'})}</time>}<Link href="/blog">← All articles</Link></div>}
      {(page.sections || []).map((section, index) => <Section section={section} settings={settings} key={index} />)}
    </main>
  );
}
