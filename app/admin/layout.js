import './cms-base.css';
import './admin-revamp.css';
export const metadata = {
  title: 'Secure Admin | CoreTax CMS',
  robots: { index: false, follow: false, noarchive: true }
};

export default function AdminLayout({ children }) {
  return children;
}
