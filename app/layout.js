import './globals.css';
import { Cormorant_Garamond, Poppins } from 'next/font/google';
import Header from './components/Header';
import Footer from './components/Footer';
import PublicCustomCSS from './components/PublicCustomCSS';
import { getMenus, getSettings } from './lib/store';

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-poppins' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-cormorant' });

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const settings = await getSettings();
  return {
    title: settings.siteName || 'J M Pabari & Associates',
    description: settings.tagline || 'Chartered Accountants website with admin CMS.',
    icons: settings.favicon ? { icon: [{ url: settings.favicon }] } : undefined
  };
}

export default async function RootLayout({ children }) {
  const [settings, menus] = await Promise.all([getSettings(), getMenus()]);
  return (
    <html lang="en" className={`${poppins.variable} ${cormorant.variable}`}>
      <body style={{
        '--primary': settings.primaryColor || '#123c69', '--accent': settings.accentColor || '#f2b84b',
        '--heading-color': settings.headingColor || settings.primaryColor || '#123c69',
        '--text-color': settings.textColor || '#25313d', '--page-background': settings.backgroundColor || '#ffffff',
        '--surface-color': settings.surfaceColor || '#ffffff', '--link-color': settings.linkColor || settings.primaryColor || '#123c69',
        '--footer-background': settings.footerBackgroundColor || '#0b2239'
      }}>
        <PublicCustomCSS css={settings.customCss || ''}/>
        <Header settings={settings} menus={menus} />
        {children}
        <Footer settings={settings} menus={menus} />
      </body>
    </html>
  );
}
