import FormattedText from './FormattedText';
import './formatted-text.css';
import Link from 'next/link';
import ContactForm from './ContactForm';
import Icon from './Icon';

const serviceIcons = ['shield', 'document', 'briefcase', 'people', 'chart', 'clock'];

function Hero({ page }) {
  const home = page.template === 'home' || page.slug === 'home';
  const visual = home || Boolean(page.heroImage);
  return <section className={`hero ${home ? 'hero-home' : 'hero-inner'} ${visual ? 'has-visual' : ''}`} aria-labelledby="page-heading">
    <div className="container hero-grid">
      <div className="hero-copy">
        {!home && <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">{page.title}</span></nav>}
        {page.heroKicker && <span className="eyebrow">{page.heroKicker}</span>}
        <h1 id="page-heading">{page.heroTitle || page.title}</h1>
        {page.heroText && <FormattedText text={page.heroText} className="lead"/>}
        {(page.button1Text || page.button2Text) && <div className="hero-actions">
          {page.button1Text && <Link className="btn" href={page.template === 'contact' && (!page.button1Url || page.button1Url === '/contact') ? '#enquiry-form' : (page.button1Url || '/contact')}>{page.button1Text}</Link>}
          {page.button2Text && <Link className="btn outline" href={page.button2Url || '/our-services'}>{page.button2Text}<Icon name="arrow" size={18}/></Link>}
        </div>}
        {home && <div className="hero-note"><Icon name="shield" size={19}/><span>Accounting. Taxation. Advisory.</span></div>}
      </div>
      {visual && <div className={`hero-art ${!page.heroImage ? 'hero-art-default' : ''}`}>
        <div className="hero-image-frame"><img src={page.heroImage || '/assets/img/hero-desk.png'} alt={page.heroImage ? (page.heroTitle || page.title) : 'A professional workspace with a laptop, notebook and Chartered Accountant mug'} width={page.heroImage ? undefined : 692} height={page.heroImage ? undefined : 248} fetchPriority="high"/></div>
        {home && <><div className="hero-art-caption"><span className="art-caption-line"/><div><span>A clearer perspective.</span><small>For your next business decision.</small></div><Icon name="diagonal" size={28}/></div><span className="hero-art-index" aria-hidden="true">JMP / ADVISORY</span></>}
      </div>}
    </div>
  </section>;
}

function SectionHeading({ section }) {
  return <div className="section-heading">{section.kicker && <span className="eyebrow">{section.kicker}</span>}{section.title && <h2>{section.title}</h2>}</div>;
}

function ContactDetails({ settings }) {
  return <div className="contact-details">
    {settings.phone && <a href={`tel:${settings.phone.replace(/[^+\d]/g, '')}`}><span className="contact-icon"><Icon name="phone" size={20}/></span><span><small>Call our team</small><strong>{settings.phone}</strong></span><Icon name="diagonal" size={18}/></a>}
    {settings.email && <a href={`mailto:${settings.email}`}><span className="contact-icon"><Icon name="mail" size={20}/></span><span><small>Email us</small><strong>{settings.email}</strong></span><Icon name="diagonal" size={18}/></a>}
    {settings.address && <div><span className="contact-icon"><Icon name="pin" size={20}/></span><span><small>Our office</small><strong>{settings.address}</strong></span></div>}
  </div>;
}

function Section({ section, settings }) {
  if (!section) return null;
  if (section.type === 'stats') {
    return <section className="stats-section" aria-label="Our practice at a glance"><div className="container trust-strip">{(section.items || []).map((item, index) => <div className="trust-item" key={index}><strong>{item.value}</strong><p>{item.label}</p></div>)}</div></section>;
  }
  if (section.type === 'split') {
    return <section className="section section-about"><div className="container split-grid"><div><SectionHeading section={section}/><FormattedText text={section.text} className="lead"/>{section.buttonText && <Link className="text-cta" href={section.buttonUrl || '#'}>{section.buttonText}<Icon name="arrow" size={20}/></Link>}</div><div className="feature-grid">{(section.cards || []).map((card, index) => <div className="mini-card" key={index}><div className="icon-circle"><Icon name={['document', 'chart', 'shield', 'people'][index % 4]} size={24}/></div><h3>{card.title}</h3><FormattedText text={card.text}/></div>)}</div></div></section>;
  }
  if (section.type === 'text') {
    return <section className="section section-text"><div className="container"><div className="content-box"><SectionHeading section={section}/><FormattedText text={section.text} className="lead"/></div></div></section>;
  }
  if (section.type === 'brand') {
    return <section className="section"><div className="container brand-panel">{section.logo && <div className="brand-image"><img src={section.logo} alt={section.title || 'Brand'} loading="lazy"/></div>}<div><span className="eyebrow">Dedicated Entity</span><h2>{section.title}</h2><FormattedText text={section.text} className="lead"/></div></div></section>;
  }
  if (section.type === 'cards') {
    return <section className="section section-soft"><div className="container"><SectionHeading section={section}/><div className="card-grid three">{(section.items || []).map((item, index) => <article className={`service-card ${item.url ? 'is-linked' : ''}`} id={item.id || undefined} key={index}>{item.url ? <Link className="service-card-link" href={item.url}><div className="service-card-top"><Icon name={serviceIcons[index % serviceIcons.length]} size={30}/><span>{String(index + 1).padStart(2, '0')}</span></div><h3>{item.title}</h3><FormattedText text={item.text}/><span className="service-card-action">Explore service<Icon name="diagonal" size={20}/></span></Link> : <><div className="service-card-top"><Icon name={serviceIcons[index % serviceIcons.length]} size={30}/><span>{String(index + 1).padStart(2, '0')}</span></div><h3>{item.title}</h3><FormattedText text={item.text}/></>}</article>)}</div></div></section>;
  }
  if (section.type === 'process') {
    return <section className="section"><div className="container"><SectionHeading section={section}/><div className="process-grid">{(section.items || []).map((item, index) => <div className="process-card" key={index}><span className="process-number">{String(index + 1).padStart(2, '0')}</span><h3>{item.title}</h3><FormattedText text={item.text}/></div>)}</div></div></section>;
  }
  if (section.type === 'cta') {
    return <section className="section section-cta"><div className="container cta-band"><div><span className="eyebrow">Let’s move forward</span><h2>{section.title}</h2><FormattedText text={section.text}/></div>{section.buttonText && <Link className="btn" href={section.buttonUrl || '#'}>{section.buttonText}</Link>}</div></section>;
  }
  if (section.type === 'contact') {
    return <section className="section"><div className="container contact-wrap"><div><SectionHeading section={{ ...section, kicker: section.kicker || 'Start a conversation', title: section.title || 'How can we help you?' }}/><FormattedText text={section.text || 'Tell us a little about your business and what you need. Our team will help you with the next step.'} className="lead"/><ContactDetails settings={settings}/></div><ContactForm services={settings.formServices} heading={settings.formHeading} successMessage={settings.formSuccessMessage}/></div></section>;
  }
  return null;
}

export default function PageRenderer({ page, settings = {} }) {
  return <main id="main-content" className={`public-main template-${page.template || 'default'}`} tabIndex={-1}>
    <Hero page={page}/>
    {page.template === 'blog' && <div className="container blog-article-byline"><span>{page.blogCategory || 'Insights'}</span><span>By {page.blogAuthor || 'JMP Editorial Team'}</span>{page.blogDate && <time dateTime={page.blogDate}>{new Date(`${page.blogDate}T00:00:00Z`).toLocaleDateString('en-IN',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'})}</time>}<Link href="/blog">← All articles</Link></div>}
    {(page.sections || []).map((section, index) => <Section section={section} settings={settings} key={index}/>)}
  </main>;
}
