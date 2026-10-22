import './globals.css';
import { Cormorant_Garamond, Poppins } from 'next/font/google';
import Header from './components/Header';
import Footer from './components/Footer';
import { getMenus, getSettings } from './lib/store';

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-poppins' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-cormorant' });

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const settings = await getSettings();
  return {
    title: settings.siteName || 'J M Pabari & Associates',
    description: settings.tagline || 'Chartered Accountants website with admin CMS.'
  };
}

export default async function RootLayout({ children }) {
  const [settings, menus] = await Promise.all([getSettings(), getMenus()]);
  return (
    <html lang="en" className={`${poppins.variable} ${cormorant.variable}`}>
      <body style={{ '--primary': settings.primaryColor || '#123c69', '--accent': settings.accentColor || '#f2b84b' }}>
        <Header settings={settings} menus={menus} />
        {children}
        <Footer settings={settings} menus={menus} />
      </body>
    </html>
  );
}
