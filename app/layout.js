import './globals.css';
import './experience.css';
import './components/formatted-text.css';
import { Cormorant_Garamond, Poppins } from 'next/font/google';
import Header from './components/Header';
import Footer from './components/Footer';
import QuickContact from './components/QuickContact';
import PublicAnalytics from './components/PublicAnalytics';
import { siteOrigin } from './lib/seo.mjs';
import PublicCustomCSS from './components/PublicCustomCSS';
import { getMenus, getSettings } from './lib/public-store';
import { appearanceVariables } from './lib/appearance.mjs';

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-poppins' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-cormorant' });

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const settings = await getSettings();
  return {
    metadataBase: siteOrigin(settings, process.env) ? new URL(siteOrigin(settings, process.env)) : undefined,
    title: settings.siteName || 'J M Pabari & Associates',
    description: settings.tagline || 'Chartered Accountants website with admin CMS.',
    icons: settings.favicon ? { icon: [{ url: settings.favicon }] } : undefined
  };
}

export default async function RootLayout({ children }) {
  const [settings, menus] = await Promise.all([getSettings(), getMenus()]);
  return (
    <html lang="en" className={`${poppins.variable} ${cormorant.variable}`}>
      <body style={appearanceVariables(settings)}>
        <PublicAnalytics measurementId={settings.gaMeasurementId || ''} enabled={Boolean(settings.analyticsEnabled)} visitorEnabled={settings.visitorTrackingEnabled !== false}/>
        <PublicCustomCSS css={settings.customCss || ''}/>
        <Header settings={settings} menus={menus} />
        {children}
        <Footer settings={settings} menus={menus} />
        <QuickContact phone={settings.phone || ''}/>
      </body>
    </html>
  );
}
