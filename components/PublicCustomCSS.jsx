'use client';
import { usePathname } from 'next/navigation';

// Custom CSS is never inserted in the CMS administration or password recovery screens.
export default function PublicCustomCSS({ css = '' }) {
  const pathname = usePathname() || '/';
  if (!css || pathname.startsWith('/admin') || pathname.startsWith('/reset-password')) return null;
  return <style data-cms-custom-css="true">{css.replace(/<\/style/gi, '')}</style>;
}
