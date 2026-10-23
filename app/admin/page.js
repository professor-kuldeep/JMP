'use client';
import { useEffect, useMemo, useState } from 'react';
import SectionBuilder, { newSection } from './components/SectionBuilder';
import MenuBuilder from './components/MenuBuilder';
import MediaPicker from './components/MediaPicker';
import LivePagePreview from './components/LivePagePreview';
import SeoPreview from './components/SeoPreview';
import TurnstileWidget from '../components/TurnstileWidget';

const emptyPage = {
  id: null, slug: '', title: '', seoTitle: '', metaDescription: '', ogTitle: '', ogDescription: '', ogImage: '', canonicalUrl: '', noIndex: false,
  status: 'draft', template: 'default', order: 99, blogCategory: '', blogAuthor: '', blogDate: '', heroKicker: '', heroTitle: '', heroText: '', heroImage: '',
  button1Text: 'Book a Consultation →', button1Url: '/contact', button2Text: '', button2Url: '', sections: [newSection('text')]
};

const pagePresets = {
  blank: emptyPage,
  service: {
    ...emptyPage, template: 'service', heroKicker: 'Professional Services', heroTitle: 'Service Page', heroText: 'Add a concise introduction to this service.',
    sections: [newSection('text'), newSection('cards'), newSection('process'), newSection('cta')]
  },
  blog: {
    ...emptyPage, template: 'blog', blogCategory: 'Tax Insights', blogAuthor: 'JMP Editorial Team', blogDate: new Date().toISOString().slice(0, 10), heroKicker: 'Insights', heroTitle: 'Article Title', heroText: 'Add a short article summary.', button1Text: '', button1Url: '',
    sections: [newSection('text')]
  },
  contact: {
    ...emptyPage, template: 'contact', heroKicker: 'Contact Us', heroTitle: 'Let’s Talk', heroText: 'Tell us how we can help.', button1Text: '', button1Url: '',
    sections: [newSection('contact')]
  }
};

function StatCard({ label, value, note, onClick }) {
  return <button type="button" className={`admin-stat ${onClick ? 'clickable' : ''}`} onClick={onClick}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</button>;
}

function Field({ label, value, onChange, textarea = false, type = 'text', placeholder = '', help = '', counter = null }) {
  return <div className="field"><div className="field-label-row"><label>{label}</label>{counter !== null && <span className="field-counter">{String(value || '').length}/{counter}</span>}</div>{textarea
    ? <textarea value={value || ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    : <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}{help && <p className="small field-help">{help}</p>}</div>;
}

function EmptyPanel({ title, text, action }) {
  return <div className="empty-state friendly"><b>{title}</b><p>{text}</p>{action}</div>;
}

function formatDate(value) {
  try { return new Date(value).toLocaleString(); } catch { return ''; }
}

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [login, setLogin] = useState({ username: 'admin', password: '', otp: '' });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [tab, setTab] = useState('dashboard');
  const [pages, setPages] = useState([]);
  const [settings, setSettings] = useState({});
  const [menus, setMenus] = useState({ header: [], footer: [] });
  const [enquiries, setEnquiries] = useState([]);
  const [media, setMedia] = useState([]);
  const [storage, setStorage] = useState(null);
  const [editing, setEditing] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [search, setSearch] = useState('');
  const [pageSearch, setPageSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [localSavedAt, setLocalSavedAt] = useState(null);
  const [enquiryStatus, setEnquiryStatus] = useState('all');
  const [mediaSearch, setMediaSearch] = useState('');
  const [securityStatus, setSecurityStatus] = useState(null);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', displayName: '', email: '', role: 'editor', password: '', twoFactorEnabled: true });
  const [userSetup, setUserSetup] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [accountRecoveryCodes, setAccountRecoveryCodes] = useState([]);
  const [securitySearch, setSecuritySearch] = useState('');

  function notify(text, type = 'success') {
    setMessage(text); setMessageType(type);
    window.clearTimeout(window.__coretaxNoticeTimer);
    window.__coretaxNoticeTimer = window.setTimeout(() => setMessage(''), 4500);
  }

  async function api(url, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const baseHeaders = options.body instanceof FormData ? (options.headers || {}) : { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const headers = (!['GET', 'HEAD'].includes(method) && csrfToken && !url.endsWith('/login')) ? { ...baseHeaders, 'x-csrf-token': csrfToken } : baseHeaders;
    const response = await fetch(url, { ...options, headers, credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Request failed.');
    return data;
  }

  function can(permission, user = session) {
    return Boolean(user && (user.role === 'super_admin' || (user.permissions || []).includes('*') || (user.permissions || []).includes(permission)));
  }

  async function checkSession() {
    try { const data = await api('/api/admin/me'); setSession(data.user); setCsrfToken(data.csrfToken || ''); await loadAll(data.user); }
    catch { setSession(null); }
  }

  async function loadAll(user = session) {
    try {
      const statusData = await api('/api/admin/status'); setStorage(statusData || null);
      const jobs = [];
      if (can('pages:read', user)) jobs.push(api('/api/admin/pages').then((d) => setPages(d.pages || []))); else setPages([]);
      if (can('settings:read', user) || can('menus:read', user) || can('forms:read', user) || can('appearance:read', user)) jobs.push(api('/api/admin/settings').then((d) => { setSettings(d.settings || {}); setMenus(d.menus || { header: [], footer: [] }); }));
      if (can('enquiries:read', user)) jobs.push(api('/api/admin/enquiries').then((d) => setEnquiries(d.enquiries || []))); else setEnquiries([]);
      if (can('media:read', user)) jobs.push(api('/api/admin/media').then((d) => setMedia(d.media || []))); else setMedia([]);
      if (can('security:read', user)) {
        jobs.push(api('/api/admin/security/status').then((d) => setSecurityStatus(d.security || null)));
        jobs.push(api('/api/admin/security/audit?limit=100').then((d) => setSecurityEvents(d.events || [])));
      }
      jobs.push(api('/api/admin/security/sessions').then((d) => setActiveSessions(d.sessions || [])).catch(() => setActiveSessions([])));
      if (user?.role === 'super_admin') jobs.push(api('/api/admin/users').then((d) => setUsers(d.users || []))); else setUsers([]);
      await Promise.allSettled(jobs);
    } catch (error) { notify(error.message, 'error'); }
  }

  useEffect(() => { checkSession(); }, []);

  useEffect(() => {
    if (!editing) return;
    const timer = setTimeout(() => {
      try {
        const key = `coretax-page-draft-${editing.id || 'new'}`;
        localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), page: editing }));
        setLocalSavedAt(new Date());
      } catch {}
    }, 700);
    return () => clearTimeout(timer);
  }, [editing]);

  async function handleLogin(event) {
    event.preventDefault(); setMessage('');
    try {
      const data = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ ...login, turnstileToken }) });
      setSession(data.user); setCsrfToken(data.csrfToken || ''); setTab(data.user?.mustChangePassword ? 'account' : 'dashboard');
      setTurnstileToken(''); setTurnstileReset((v) => v + 1); await loadAll(data.user);
      if (data.recoveryCodeUsed) notify('Recovery code accepted. Generate a fresh set of recovery codes soon.', 'info');
    } catch (error) { setTurnstileToken(''); setTurnstileReset((v) => v + 1); notify(error.message, 'error'); }
  }

  async function logout() { await api('/api/admin/logout', { method: 'POST' }); setSession(null); setCsrfToken(''); }

  async function logoutAllSessions() {
    if (!confirm('Sign out every active admin session, including this one?')) return;
    try { await api('/api/admin/security/logout-all', { method: 'POST', body: JSON.stringify({ confirm: true }) }); setSession(null); setCsrfToken(''); }
    catch (error) { notify(error.message, 'error'); }
  }

  async function createAdminUser(event) {
    event.preventDefault(); setSaving(true);
    try {
      const data = await api('/api/admin/users', { method: 'POST', body: JSON.stringify(newUser) });
      setUserSetup(data); setNewUser({ username: '', displayName: '', email: '', role: 'editor', password: '', twoFactorEnabled: true });
      notify('Administrator account created. Save the setup details now.'); await loadAll(session);
    } catch (error) { notify(error.message, 'error'); } finally { setSaving(false); }
  }

  async function updateAdminUser(user, changes) {
    try { const data = await api(`/api/admin/users/${user.id}`, { method: 'PUT', body: JSON.stringify(changes) }); setUsers((rows) => rows.map((row) => row.id === user.id ? data.user : row)); notify('User updated.'); await loadAll(session); }
    catch (error) { notify(error.message, 'error'); }
  }

  async function deleteAdminUser(user) {
    if (!confirm(`Delete administrator ${user.username}?`)) return;
    try { await api(`/api/admin/users/${user.id}`, { method: 'DELETE' }); notify('Administrator deleted.'); await loadAll(session); }
    catch (error) { notify(error.message, 'error'); }
  }

  async function resetRecoveryCodes(user) {
    if (!confirm(`Replace all recovery codes for ${user.username}? Old codes will stop working.`)) return;
    try { const data = await api(`/api/admin/users/${user.id}/recovery`, { method: 'POST', body: JSON.stringify({ confirm: true }) }); setUserSetup({ user, recoveryCodes: data.recoveryCodes, totpSecret: '', otpauthUri: '' }); notify('Recovery codes regenerated.'); }
    catch (error) { notify(error.message, 'error'); }
  }

  async function resetUserTwoFactor(user) {
    if (!confirm(`Reset authenticator setup for ${user.username}? All active sessions and old 2FA/recovery codes will stop working.`)) return;
    try { const data = await api(`/api/admin/users/${user.id}/two-factor`, { method: 'POST', body: JSON.stringify({ confirm: true }) }); setUserSetup(data); notify('Two-factor authentication reset. Save the new setup details now.'); await loadAll(session); }
    catch (error) { notify(error.message, 'error'); }
  }

  async function resetUserPassword(user) {
    const password = window.prompt(`Enter a temporary password for ${user.username}. Use at least 12 characters.`);
    if (!password) return;
    if (password.length < 12) return notify('Temporary password must be at least 12 characters.', 'error');
    try { await updateAdminUser(user, { password, mustChangePassword: true }); notify('Temporary password set. The user must change it after signing in.'); }
    catch (error) { notify(error.message, 'error'); }
  }

  async function revokeActiveSession(row) {
    if (!confirm(`Sign out ${row.current ? 'this session' : row.username + ' on this device'}?`)) return;
    try { const data = await api('/api/admin/security/sessions', { method: 'DELETE', body: JSON.stringify({ id: row.id }) }); if (data.current) { setSession(null); setCsrfToken(''); } else { notify('Session revoked.'); await loadAll(session); } }
    catch (error) { notify(error.message, 'error'); }
  }

  async function changeOwnPassword(event) {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) return notify('New password and confirmation do not match.', 'error');
    setSaving(true);
    try { const data = await api('/api/admin/account/password', { method: 'POST', body: JSON.stringify(passwordForm) }); notify(data.message || 'Password changed.'); setSession(null); setCsrfToken(''); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }
    catch (error) { notify(error.message, 'error'); } finally { setSaving(false); }
  }

  async function resetOwnRecoveryCodes() {
    if (!confirm('Generate a new set of recovery codes? Existing recovery codes will stop working.')) return;
    try { const data = await api('/api/admin/account/recovery', { method: 'POST', body: JSON.stringify({ confirm: true }) }); setAccountRecoveryCodes(data.recoveryCodes || []); notify('New recovery codes generated. Store them somewhere safe.'); }
    catch (error) { notify(error.message, 'error'); }
  }

  function makePreset(name = 'blank') { return structuredClone(pagePresets[name] || pagePresets.blank); }

  async function editPage(page, preset = 'blank') {
    let draft = page ? structuredClone(page) : makePreset(preset);
    const key = `coretax-page-draft-${draft.id || 'new'}`;
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      if (cached?.page && cached.savedAt && (!page?.updatedAt || cached.savedAt > new Date(page.updatedAt).getTime()) && confirm('A newer browser draft was found. Restore it?')) draft = cached.page;
    } catch {}
    setEditing(draft); setLocalSavedAt(null); setTab('edit-page'); setRevisions([]);
    if (draft.id) {
      try { const data = await api(`/api/admin/pages/${draft.id}/revisions`); setRevisions(data.revisions || []); } catch { setRevisions([]); }
    }
  }

  async function persistPage(desiredStatus = null, leave = false) {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = { ...editing, status: desiredStatus || editing.status || 'draft', order: Number(editing.order) || 99, sections: Array.isArray(editing.sections) ? editing.sections : [] };
      const data = payload.id
        ? await api(`/api/admin/pages/${payload.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await api('/api/admin/pages', { method: 'POST', body: JSON.stringify(payload) });
      const saved = structuredClone(data.page || payload);
      setEditing(saved);
      try { localStorage.removeItem(`coretax-page-draft-${editing.id || 'new'}`); if (saved.id) localStorage.removeItem(`coretax-page-draft-${saved.id}`); } catch {}
      setLocalSavedAt(null);
      notify(saved.status === 'published' ? 'Page published successfully.' : 'Draft saved successfully.');
      await loadAll();
      if (saved.id) {
        try { const rev = await api(`/api/admin/pages/${saved.id}/revisions`); setRevisions(rev.revisions || []); } catch {}
      }
      if (leave) { setEditing(null); setTab('pages'); }
    } catch (error) { notify(error.message, 'error'); }
    finally { setSaving(false); }
  }

  async function deletePage(id) {
    if (!confirm('Delete this page? This action cannot be undone.')) return;
    try { await api(`/api/admin/pages/${id}`, { method: 'DELETE' }); notify('Page deleted.'); await loadAll(); }
    catch (error) { notify(error.message, 'error'); }
  }

  async function duplicatePage(page) {
    const existing = new Set(pages.map((p) => p.slug));
    const base = `${page.slug === 'home' ? 'home' : page.slug}-copy`; let slug = base; let count = 2;
    while (existing.has(slug)) slug = `${base}-${count++}`;
    const payload = { ...page, id: undefined, createdAt: undefined, updatedAt: undefined, slug, title: `${page.title} Copy`, status: 'draft', order: (Number(page.order) || 99) + 1 };
    try { await api('/api/admin/pages', { method: 'POST', body: JSON.stringify(payload) }); notify('Page duplicated as a draft.'); await loadAll(); }
    catch (error) { notify(error.message, 'error'); }
  }

  async function togglePublish(page) {
    try { await api(`/api/admin/pages/${page.id}`, { method: 'PUT', body: JSON.stringify({ ...page, status: page.status === 'published' ? 'draft' : 'published' }) }); notify(page.status === 'published' ? 'Page moved to draft.' : 'Page published.'); await loadAll(); }
    catch (error) { notify(error.message, 'error'); }
  }

  async function restoreRevision(revisionId) {
    if (!editing?.id || !confirm('Restore this revision? Your current saved version will remain in revision history.')) return;
    try { const data = await api(`/api/admin/pages/${editing.id}/revisions`, { method: 'POST', body: JSON.stringify({ revisionId }) }); setEditing(structuredClone(data.page)); const rev = await api(`/api/admin/pages/${editing.id}/revisions`); setRevisions(rev.revisions || []); notify('Revision restored.'); await loadAll(); }
    catch (error) { notify(error.message, 'error'); }
  }

  async function saveSettings(event) {
    event?.preventDefault?.(); setSaving(true);
    try { await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ settings, menus }) }); notify('Changes saved successfully.'); await loadAll(); }
    catch (error) { notify(error.message, 'error'); }
    finally { setSaving(false); }
  }

  async function updateEnquiry(item, changes) {
    try {
      const data = await api(`/api/admin/enquiries/${item.id}`, { method: 'PUT', body: JSON.stringify(changes) });
      setEnquiries((current) => current.map((entry) => String(entry.id) === String(item.id) ? data.enquiry : entry));
      notify('Enquiry updated.');
    } catch (error) { notify(error.message, 'error'); }
  }

  async function deleteEnquiry(id) {
    if (!confirm('Delete this enquiry?')) return;
    try { await api(`/api/admin/enquiries/${id}`, { method: 'DELETE' }); notify('Enquiry deleted.'); await loadAll(); }
    catch (error) { notify(error.message, 'error'); }
  }

  async function uploadMedia(event) {
    const file = event.target.files?.[0]; if (!file) return;
    notify('Uploading media...', 'info'); const form = new FormData(); form.append('file', file);
    try { const data = await api('/api/admin/media', { method: 'POST', body: form }); notify(`Uploaded: ${data.media?.name || file.name}`); await loadAll(); return data.media; }
    catch (error) { notify(error.message, 'error'); }
    finally { event.target.value = ''; }
  }

  async function updateMedia(item, changes) {
    try { const data = await api(`/api/admin/media/${item.id}`, { method: 'PUT', body: JSON.stringify(changes) }); setMedia((current) => current.map((entry) => entry.id === item.id ? data.media : entry)); notify('Media details updated.'); }
    catch (error) { notify(error.message, 'error'); }
  }

  async function deleteMedia(id) {
    if (!confirm('Delete this media item?')) return;
    try { await api(`/api/admin/media/${id}`, { method: 'DELETE' }); notify('Media deleted.'); await loadAll(); }
    catch (error) { notify(error.message, 'error'); }
  }

  async function importBackup(event) {
    const file = event.target.files?.[0]; if (!file) return;
    if (!confirm('Restore this CMS backup? Current saved content will be replaced.')) { event.target.value = ''; return; }
    try { const payload = JSON.parse(await file.text()); await api('/api/admin/backup', { method: 'POST', body: JSON.stringify(payload) }); notify('CMS backup restored successfully.'); await loadAll(); setTab('dashboard'); }
    catch (error) { notify(error.message || 'Backup restore failed.', 'error'); }
    event.target.value = '';
  }

  async function copyText(value) { try { await navigator.clipboard.writeText(value); notify('Copied to clipboard.'); } catch { notify('Could not copy automatically.', 'error'); } }

  const filteredEnquiries = useMemo(() => {
    const q = search.toLowerCase();
    return enquiries.filter((item) => (!q || JSON.stringify(item).toLowerCase().includes(q)) && (enquiryStatus === 'all' || (item.status || 'new') === enquiryStatus));
  }, [enquiries, search, enquiryStatus]);

  const filteredPages = useMemo(() => {
    const q = pageSearch.toLowerCase();
    return pages.filter((page) => !q || `${page.title} ${page.slug} ${page.status} ${page.template}`.toLowerCase().includes(q));
  }, [pages, pageSearch]);

  const blogPages = useMemo(() => [...pages.filter((page) => page.template === 'blog')].sort((a,b) => String(b.blogDate || b.createdAt || '').localeCompare(String(a.blogDate || a.createdAt || ''))), [pages]);
  const [blogFilter, setBlogFilter] = useState('all');
  const [blogQuery, setBlogQuery] = useState('');
  const filteredBlogs = useMemo(() => blogPages.filter(p => (blogFilter === 'all' || (blogFilter === 'published' ? p.status === 'published' : blogFilter === 'draft' ? p.status === 'draft' : p.blogCategory === blogFilter)) && [p.title,p.blogCategory,p.blogAuthor,p.metaDescription].join(' ').toLowerCase().includes(blogQuery.toLowerCase())), [blogPages, blogFilter, blogQuery]);
  const filteredMedia = useMemo(() => { const q = mediaSearch.toLowerCase(); return media.filter((item) => !q || `${item.name} ${item.alt || ''}`.toLowerCase().includes(q)); }, [media, mediaSearch]);
  const recentPages = useMemo(() => [...pages].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)).slice(0, 5), [pages]);
  const latestEnquiries = useMemo(() => enquiries.slice(0, 5), [enquiries]);
  const filteredSecurityEvents = useMemo(() => { const q = securitySearch.toLowerCase().trim(); return securityEvents.filter((event) => !q || JSON.stringify(event).toLowerCase().includes(q)); }, [securityEvents, securitySearch]);

  if (!session) return <main className="admin-shell"><div className="login-box"><span className="eyebrow">Secure Admin Access</span><h1>CoreTax CMS Login</h1><p className="small">Use your own administrator account, password and authenticator code. A one-time recovery code can also be used if your authenticator is unavailable.</p><form onSubmit={handleLogin}><Field label="Username" value={login.username} onChange={(v) => setLogin({ ...login, username: v })} /><Field label="Password" type="password" value={login.password} onChange={(v) => setLogin({ ...login, password: v })} /><Field label="Authenticator / Recovery Code" value={login.otp} placeholder="6-digit code or recovery code" onChange={(v) => setLogin({ ...login, otp: v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20) })} /><TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileReset} action="admin_login" /><button className="btn">Secure Login</button></form><p className="small"><a href="/reset-password">Forgot password?</a></p><p className="small field-help">Protected by rate limiting, 2FA/recovery codes, revocable sessions, CSRF checks and audit logging.</p>{message && <p className={`form-status ${messageType}`}>{message}</p>}</div></main>;

  const persistent = Boolean(storage?.storage?.persistent); const blobReady = Boolean(storage?.blob);
  const nav = [
    ['dashboard','Dashboard','⌂', 'dashboard:read'],
    ['pages','Pages','▤', 'pages:read'],
    ['blog','Blog','✎', 'pages:read'],
    ['media','Media','▧', 'media:read'],
    ['enquiries','Enquiries','✉', 'enquiries:read'],
    ['menus','Navigation','☰', 'menus:write'],
    ['forms','Forms','◫', 'forms:write'],
    ['appearance','Appearance','◐', 'appearance:write'],
    ['settings','Settings','⚙', 'settings:write'],
    ['users','Users','♙', 'super_admin'],
    ['security','Security','⌾', 'security:read'],
    ['account','My Account','●', 'account'],
    ['backup','Backup','↺', 'backup:export'],
    ['help','Help','?', 'help']
  ].filter(([, , , permission]) => permission === 'help' || permission === 'account' || (permission === 'super_admin' ? session.role === 'super_admin' : can(permission)));

  return <main className="admin-shell">
    <div className="admin-top"><div className="admin-brand"><strong>CoreTax Site Control Panel</strong><span className="admin-version">CoreTax CMS · v6</span></div><div className="admin-actions"><a className="admin-btn light" href="/" target="_blank" rel="noreferrer">View Website ↗</a><button className="admin-btn light" onClick={loadAll}>Refresh</button><button className="admin-btn danger" onClick={logout}>Logout</button></div></div>
    <div className="admin-layout">
      <aside className="admin-sidebar" aria-label="CMS navigation"><div className="admin-sidebar-heading"><span className="admin-sidebar-overline">WORKSPACE</span><strong>Manage your website</strong><small>Content, design & security</small></div><nav className="admin-nav" aria-label="Admin sections">{nav.map(([key,label,icon]) => <button type="button" key={key} title={label} aria-current={tab === key || (key === 'pages' && tab === 'edit-page') ? 'page' : undefined} className={tab === key || (key === 'pages' && tab === 'edit-page') ? 'active' : ''} onClick={() => setTab(key)}><span aria-hidden="true" className="admin-nav-icon">{icon}</span><span className="admin-nav-label">{label}</span></button>)}</nav><div className="admin-sidebar-foot"><span className="admin-status-dot"/>CMS workspace <span className="admin-sidebar-foot-muted">· Secure access</span></div></aside>
      <section className="admin-main">
        {message && <div className={`admin-notice ${messageType}`}><strong>{message}</strong><button onClick={() => setMessage('')}>×</button></div>}

        {tab === 'dashboard' && <>
          <div className="admin-page-head"><div><span className="eyebrow">Welcome back</span><h2>Website Dashboard</h2><p className="small">The most common website tasks are one click away.</p></div><div className="admin-actions">{can('pages:write') && <><button className="admin-btn" onClick={() => editPage(null, 'blank')}>+ New Page</button><button className="admin-btn light" onClick={() => editPage(null, 'blog')}>+ New Blog</button></>}</div></div>
          <div className="admin-stats-grid">{can('pages:read') && <><StatCard label="Pages" value={pages.length} note={`${pages.filter(p => p.status === 'published').length} published`} onClick={() => setTab('pages')} /><StatCard label="Drafts" value={pages.filter(p => p.status === 'draft').length} note="Not visible publicly" onClick={() => setTab('pages')} /></>}{can('enquiries:read') && <StatCard label="New Enquiries" value={enquiries.filter(e => (e.status || 'new') === 'new').length} note={`${enquiries.length} total`} onClick={() => setTab('enquiries')} />}{can('media:read') && <StatCard label="Media" value={media.length} note="Images & files" onClick={() => setTab('media')} />}</div>
          {(can('pages:read') || can('enquiries:read')) && <div className="dashboard-grid">
            {can('pages:read') && <div className="admin-card"><div className="card-title-row"><h3>Recently Edited Pages</h3><button className="text-link" onClick={() => setTab('pages')}>View all</button></div>{recentPages.length ? <div className="simple-list">{recentPages.map((page) => <button key={page.id} onClick={() => editPage(page)}><span><b>{page.title}</b><small>{formatDate(page.updatedAt)}</small></span><em className={`pill ${page.status === 'draft' ? 'draft' : ''}`}>{page.status}</em></button>)}</div> : <EmptyPanel title="No pages yet" text="Create your first page to get started." />}</div>}
            {can('enquiries:read') && <div className="admin-card"><div className="card-title-row"><h3>Latest Enquiries</h3><button className="text-link" onClick={() => setTab('enquiries')}>View all</button></div>{latestEnquiries.length ? <div className="simple-list">{latestEnquiries.map((item) => <button key={item.id} onClick={() => setTab('enquiries')}><span><b>{item.name}</b><small>{item.service || item.email}</small></span><em className={`enquiry-badge ${item.status || 'new'}`}>{item.status || 'new'}</em></button>)}</div> : <EmptyPanel title="No enquiries yet" text="New contact-form submissions will appear here." />}</div>}
          </div>}
          {(can('pages:write') || can('menus:write') || can('appearance:write')) && <div className="admin-card quick-start"><h3>Quick Start</h3><p className="small">Choose what you want to do.</p><div className="quick-action-grid">{can('pages:write') && <><button onClick={() => editPage(null, 'service')}><b>Service Page</b><span>Start with service-ready sections</span></button><button onClick={() => editPage(null, 'blog')}><b>Blog Post</b><span>Start a new article draft</span></button></>}{can('menus:write') && <button onClick={() => setTab('menus')}><b>Navigation</b><span>Edit header and dropdown menus</span></button>}{can('appearance:write') && <button onClick={() => setTab('appearance')}><b>Branding</b><span>Logos, colors and footer</span></button>}</div></div>}
          {(!persistent || !blobReady) && <div className="system-hint"><b>Setup note:</b> {!persistent ? 'Connect Supabase for permanent CMS changes. ' : ''}{!blobReady ? 'Configure Supabase Storage for media uploads.' : ''}{can('settings:write') && <button onClick={() => setTab('settings')}>View system setup</button>}</div>}
        </>}

        {tab === 'pages' && <div className="admin-card"><div className="admin-page-head"><div><h2>Pages</h2><p className="small">Create, edit, duplicate, publish and organize website pages.</p></div><div className="admin-actions">{can('pages:write') && <><button className="admin-btn light" onClick={() => editPage(null, 'service')}>+ Service Page</button><button className="admin-btn" onClick={() => editPage(null, 'blank')}>+ Add Page</button></>}</div></div><div className="field search-field"><input placeholder="Search pages..." value={pageSearch} onChange={(e) => setPageSearch(e.target.value)} /></div><div className="table-wrap"><table className="admin-table"><thead><tr><th>Page</th><th>URL</th><th>Status</th><th>Type</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{filteredPages.map((page) => <tr key={page.id}><td><strong>{page.title}</strong><br/><span className="small">{page.seoTitle || 'SEO title not set'}</span></td><td><code>{page.slug === 'home' ? '/' : `/${page.slug}`}</code></td><td>{can('pages:publish') ? <button className={`pill ${page.status === 'draft' ? 'draft' : ''}`} onClick={() => togglePublish(page)}>{page.status}</button> : <span className={`pill ${page.status === 'draft' ? 'draft' : ''}`}>{page.status}</span>}</td><td>{page.template}</td><td className="small">{formatDate(page.updatedAt)}</td><td><div className="admin-actions compact"><button className="admin-btn light" onClick={() => editPage(page)}>Edit</button>{can('pages:write') && <button className="admin-btn light" onClick={() => duplicatePage(page)}>Duplicate</button>}{page.status === 'published' && <a className="admin-btn light" href={page.slug === 'home' ? '/' : `/${page.slug}`} target="_blank" rel="noreferrer">View</a>}{page.slug !== 'home' && can('pages:delete') && <button className="admin-btn danger" onClick={() => deletePage(page.id)}>Delete</button>}</div></td></tr>)}</tbody></table></div>{filteredPages.length === 0 && <EmptyPanel title="No matching pages" text="Try a different search or add a new page." />}</div>}

        {tab === 'blog' && <div className="admin-card"><div className="admin-page-head"><div><h2>Blog Management</h2><p className="small">Manage articles, categories, authors, featured images and SEO. Published posts automatically appear at <a href="/blog" target="_blank" rel="noreferrer">/blog ↗</a>.</p></div>{can('pages:write') && <button className="admin-btn" onClick={() => editPage(null, 'blog')}>+ New Blog Post</button>}</div>
          <div className="blog-toolbar"><input aria-label="Search blog posts" placeholder="Search blog posts..." value={blogQuery} onChange={e=>setBlogQuery(e.target.value)}/><select aria-label="Filter blog posts" value={blogFilter} onChange={e=>setBlogFilter(e.target.value)}><option value="all">All posts ({blogPages.length})</option><option value="published">Published</option><option value="draft">Drafts</option>{[...new Set(blogPages.map(p=>p.blogCategory).filter(Boolean))].sort().map(c=><option key={c} value={c}>{c}</option>)}</select><a className="admin-btn light" href="/blog" target="_blank" rel="noreferrer">View Blog ↗</a></div>
          {filteredBlogs.length ? <div className="blog-admin-grid">{filteredBlogs.map((page) => <article className="blog-admin-card" key={page.id}>{page.heroImage && <img className="blog-admin-cover" src={page.heroImage} alt=""/>}<span className={`pill ${page.status === 'draft' ? 'draft' : ''}`}>{page.status}</span><h3>{page.title}</h3><p>{page.metaDescription || page.heroText || 'No summary yet.'}</p><small>{page.blogCategory || 'Uncategorized'} · {page.blogAuthor || 'Editorial Team'} · {page.blogDate || formatDate(page.createdAt)}</small><div className="admin-actions compact"><button className="admin-btn light" onClick={() => editPage(page)}>Edit</button>{can('pages:write') && <button className="admin-btn light" onClick={() => duplicatePage(page)}>Duplicate</button>}{page.status === 'published' && <a className="admin-btn light" target="_blank" rel="noreferrer" href={`/${page.slug}`}>View ↗</a>}{can('pages:delete') && <button className="admin-btn danger" onClick={() => deletePage(page.id)}>Delete</button>}</div></article>)}</div> : <EmptyPanel title={blogPages.length ? 'No matching blog posts' : 'No blog posts yet'} text={blogPages.length ? 'Try changing your filters.' : 'Create your first article without touching code.'} action={can('pages:write') && <button className="admin-btn" onClick={() => editPage(null, 'blog')}>Create Blog Post</button>} />}</div>}


        {tab === 'edit-page' && editing && <div className="page-editor-root">
          <div className="admin-page-head sticky-editor-head"><div><span className="eyebrow">Visual Page Editor</span><h2>{editing.id ? editing.title || 'Edit Page' : 'Create New Page'}</h2><p className="small autosave-note">{localSavedAt ? `Browser autosaved ${localSavedAt.toLocaleTimeString()}` : 'Changes are autosaved in this browser until you save to the website.'}</p></div><div className="admin-actions"><button type="button" className="admin-btn light" onClick={() => { setEditing(null); setTab('pages'); }}>Exit</button><button type="button" className="admin-btn light" disabled={saving} onClick={() => persistPage('draft')}>Save Draft</button><button type="button" className="admin-btn" disabled={saving} onClick={() => persistPage('published')}>{saving ? 'Saving...' : (editing.status === 'published' ? 'Save Changes' : 'Publish')}</button></div></div>
          {!editing.id && <div className="starter-strip"><span>Start with:</span><button onClick={() => setEditing(makePreset('blank'))}>Blank</button><button onClick={() => setEditing(makePreset('service'))}>Service</button><button onClick={() => setEditing(makePreset('blog'))}>Blog</button><button onClick={() => setEditing(makePreset('contact'))}>Contact</button></div>}
          <div className="page-editor-workspace">
            <div className="page-editor-fields">
              <details className="admin-card edit-panel" open><summary><div><b>1. Page Basics</b><span>Title, URL and publishing</span></div></summary><div className="panel-body"><div className="admin-grid three"><Field label="Page Title" value={editing.title} onChange={(v) => setEditing({ ...editing, title: v })} /><Field label="URL Slug" value={editing.slug} onChange={(v) => setEditing({ ...editing, slug: v })} placeholder="about-us" /><div className="field"><label>Page Type</label><select value={editing.template || 'default'} onChange={(e) => setEditing({ ...editing, template: e.target.value })}><option value="default">Standard Page</option><option value="home">Home</option><option value="service">Service</option><option value="contact">Contact</option><option value="legal">Legal</option><option value="blog">Blog / Article</option></select></div><div className="field"><label>Status</label><select value={editing.status || 'draft'} onChange={(e) => setEditing({ ...editing, status: e.target.value })}><option value="draft">Draft</option><option value="published">Published</option></select></div><Field label="Page Order" type="number" value={editing.order ?? 99} onChange={(v) => setEditing({ ...editing, order: v })} /><div className="field"><label>Search Visibility</label><label className="check-row"><input type="checkbox" checked={Boolean(editing.noIndex)} onChange={(e) => setEditing({ ...editing, noIndex: e.target.checked })} /> Hide from search engines</label></div></div></div></details>

              {editing.template === 'blog' && <details className="admin-card edit-panel" open><summary><div><b>Blog Details</b><span>Category, author, publication date and featured image</span></div></summary><div className="panel-body"><div className="admin-grid three"><Field label="Category" value={editing.blogCategory || ''} onChange={v=>setEditing({...editing,blogCategory:v})} placeholder="Tax Insights"/><Field label="Author" value={editing.blogAuthor || ''} onChange={v=>setEditing({...editing,blogAuthor:v})} placeholder="Editorial Team"/><Field label="Publication Date" type="date" value={editing.blogDate || ''} onChange={v=>setEditing({...editing,blogDate:v})}/></div><p className="small">Use the Hero Image below as the featured image on the public blog listing. Use Hero Description for the article excerpt. Only published posts appear publicly.</p></div></details>}

              <details className="admin-card edit-panel" open><summary><div><b>2. Hero Section</b><span>The first section visitors see</span></div></summary><div className="panel-body"><div className="admin-grid"><Field label="Small Kicker" value={editing.heroKicker} onChange={(v) => setEditing({ ...editing, heroKicker: v })} /><Field label="Hero Heading" value={editing.heroTitle} onChange={(v) => setEditing({ ...editing, heroTitle: v })} /><Field label="Primary Button Text" value={editing.button1Text} onChange={(v) => setEditing({ ...editing, button1Text: v })} /><Field label="Primary Button URL" value={editing.button1Url} onChange={(v) => setEditing({ ...editing, button1Url: v })} /><Field label="Secondary Button Text" value={editing.button2Text} onChange={(v) => setEditing({ ...editing, button2Text: v })} /><Field label="Secondary Button URL" value={editing.button2Url} onChange={(v) => setEditing({ ...editing, button2Url: v })} /></div><Field label="Hero Description" textarea value={editing.heroText} onChange={(v) => setEditing({ ...editing, heroText: v })} /><MediaPicker label="Hero Image" value={editing.heroImage} onChange={(v) => setEditing({ ...editing, heroImage: v })} media={media} onUpload={uploadMedia} /></div></details>

              <div className="admin-card"><SectionBuilder sections={editing.sections || []} onChange={(sections) => setEditing({ ...editing, sections })} media={media} onUploadMedia={uploadMedia} /></div>

              <details className="admin-card edit-panel"><summary><div><b>SEO & Social Sharing</b><span>How this page can appear in Google and social previews</span></div></summary><div className="panel-body"><SeoPreview page={editing} /><div className="admin-grid"><Field label="SEO Title" counter={60} value={editing.seoTitle} onChange={(v) => setEditing({ ...editing, seoTitle: v })} /><Field label="Canonical URL" value={editing.canonicalUrl} onChange={(v) => setEditing({ ...editing, canonicalUrl: v })} placeholder="https://example.com/page" /><Field label="Open Graph Title" value={editing.ogTitle} onChange={(v) => setEditing({ ...editing, ogTitle: v })} /><MediaPicker label="Social Sharing Image" value={editing.ogImage} onChange={(v) => setEditing({ ...editing, ogImage: v })} media={media} onUpload={uploadMedia} /></div><Field label="Meta Description" textarea counter={160} value={editing.metaDescription} onChange={(v) => setEditing({ ...editing, metaDescription: v })} /><Field label="Open Graph Description" textarea value={editing.ogDescription} onChange={(v) => setEditing({ ...editing, ogDescription: v })} /></div></details>

              {editing.id && <details className="admin-card edit-panel"><summary><div><b>Revision History</b><span>Restore an earlier saved version</span></div></summary><div className="panel-body">{revisions.length === 0 ? <EmptyPanel title="No earlier revisions" text="Older versions will appear after you save changes." /> : <div className="revision-list">{revisions.map((revision) => <div className="revision-row" key={revision.id}><div><strong>{revision.page?.title || 'Page revision'}</strong><br/><span className="small">Saved {formatDate(revision.savedAt)}</span></div><button type="button" className="admin-btn light" onClick={() => restoreRevision(revision.id)}>Restore</button></div>)}</div>}</div></details>}
              <div className="editor-save-bottom"><button className="admin-btn light" onClick={() => persistPage('draft')}>Save Draft</button><button className="admin-btn large" onClick={() => persistPage('published')}>{saving ? 'Saving...' : (editing.status === 'published' ? 'Save Changes' : 'Publish Page')}</button></div>
            </div>
            <aside className="page-preview-panel"><div className="preview-head"><div><b>Live Preview</b><span>Updates while you type</span></div><div className="device-switch"><button className={previewDevice === 'desktop' ? 'active' : ''} onClick={() => setPreviewDevice('desktop')}>Desktop</button><button className={previewDevice === 'mobile' ? 'active' : ''} onClick={() => setPreviewDevice('mobile')}>Mobile</button></div></div><LivePagePreview page={editing} settings={settings} device={previewDevice} /></aside>
          </div>
        </div>}

        {tab === 'media' && <div className="admin-card"><div className="admin-page-head"><div><h2>Media Library</h2><p className="small">Upload, search and reuse images without copying URLs manually.</p></div>{can('media:write') && <label className="admin-btn file-button">+ Upload Media<input type="file" onChange={uploadMedia} /></label>}</div>{!blobReady && <div className="inline-warning">Supabase Storage is not connected. Configure Supabase and run the included schema before using production uploads.</div>}<div className="field search-field"><input placeholder="Search media..." value={mediaSearch} onChange={(e) => setMediaSearch(e.target.value)} /></div><div className="media-grid">{filteredMedia.map((item) => <div className="media-card" key={item.id}>{/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(item.url || '') || (item.url || '').includes('blob.vercel-storage.com') ? <img src={item.url} alt={item.alt || item.name} /> : <div className="media-file-icon">FILE</div>}<strong title={item.name}>{item.name}</strong><input className="media-alt-input" placeholder="Alt text" defaultValue={item.alt || ''} onBlur={(e) => { if (e.target.value !== (item.alt || '')) updateMedia(item, { alt: e.target.value }); }} /><span className="small">{new Date(item.createdAt).toLocaleDateString()}</span><div className="admin-actions compact"><button className="admin-btn light" onClick={() => copyText(item.url)}>Copy URL</button><a className="admin-btn light" href={item.url} target="_blank" rel="noreferrer">Open</a>{can('media:delete') && <button className="admin-btn danger" onClick={() => deleteMedia(item.id)}>Delete</button>}</div></div>)}</div>{filteredMedia.length === 0 && <EmptyPanel title="No media found" text="Upload an image or try another search." />}</div>}

        {tab === 'enquiries' && <div className="admin-card"><div className="admin-page-head"><div><h2>Enquiries</h2><p className="small">Track leads from new enquiry through follow-up and closure.</p></div><a className="admin-btn" href="/api/admin/enquiries/export">Export CSV</a></div><div className="filter-row"><div className="field search-field"><input placeholder="Search name, email, phone, service or message" value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="field compact-field"><select value={enquiryStatus} onChange={(e) => setEnquiryStatus(e.target.value)}><option value="all">All Statuses</option><option value="new">New</option><option value="contacted">Contacted</option><option value="in-progress">In Progress</option><option value="closed">Closed</option></select></div></div><div className="table-wrap"><table className="admin-table enquiries-table"><thead><tr><th>Date</th><th>Contact</th><th>Service</th><th>Message</th><th>Status</th><th>Internal Note</th><th></th></tr></thead><tbody>{filteredEnquiries.map((item) => <tr key={item.id}><td className="small">{formatDate(item.createdAt)}</td><td><strong>{item.name}</strong><br/><a href={`mailto:${item.email}`}>{item.email}</a><br/><span>{item.phone}</span></td><td>{item.service}</td><td className="message-cell">{item.message}</td><td><select className={`status-select ${item.status || 'new'}`} value={item.status || 'new'} onChange={(e) => updateEnquiry(item, { status: e.target.value })}><option value="new">New</option><option value="contacted">Contacted</option><option value="in-progress">In Progress</option><option value="closed">Closed</option></select></td><td><textarea className="note-box" defaultValue={item.notes || ''} placeholder="Add note..." onBlur={(e) => { if (e.target.value !== (item.notes || '')) updateEnquiry(item, { notes: e.target.value }); }} /></td><td>{can('enquiries:delete') && <button className="admin-btn danger" onClick={() => deleteEnquiry(item.id)}>Delete</button>}</td></tr>)}</tbody></table></div>{filteredEnquiries.length === 0 && <EmptyPanel title="No matching enquiries" text="Try another search or status filter." />}</div>}

        {tab === 'menus' && <form onSubmit={saveSettings}><div className="admin-page-head"><div><h2>Navigation</h2><p className="small">Build header dropdowns and footer links visually.</p></div><button className="admin-btn" disabled={saving}>Save Navigation</button></div><div className="admin-card"><MenuBuilder title="Header Menu" items={menus.header || []} allowChildren onChange={(header) => setMenus({ ...menus, header })} /></div><div className="admin-card"><MenuBuilder title="Footer Quick Links" items={menus.footer || []} onChange={(footer) => setMenus({ ...menus, footer })} /></div></form>}

        {tab === 'forms' && <form className="admin-card" onSubmit={saveSettings}><div className="admin-page-head"><div><h2>Contact Form</h2><p className="small">Control the options and messages shown in your website enquiry form.</p></div><button className="admin-btn" disabled={saving}>Save Form Settings</button></div><div className="admin-grid"><Field label="Form Heading" value={settings.formHeading || 'Send an Enquiry'} onChange={(v) => setSettings({ ...settings, formHeading: v })} /><Field label="Success Message" value={settings.formSuccessMessage || 'Thanks — your enquiry has been received.'} onChange={(v) => setSettings({ ...settings, formSuccessMessage: v })} /><Field label="Enquiry Retention (Days)" type="number" value={settings.enquiryRetentionDays || 365} onChange={(v) => setSettings({ ...settings, enquiryRetentionDays: Number(v) || 365 })} help="Older enquiries are automatically removed when new submissions arrive. Minimum 30 days." /></div><div className="field"><label>Service Dropdown Options</label><textarea value={(settings.formServices || []).join('\n')} onChange={(e) => setSettings({ ...settings, formServices: e.target.value.split('\n').map((v) => v.trim()).filter(Boolean) })}></textarea><p className="small field-help">One service per line. These options appear in the public contact form.</p></div><div className="inline-info">Form submissions are stored in <b>Enquiries</b>. Email notification delivery is not enabled unless a mail provider is separately connected.</div></form>}

        {tab === 'appearance' && <form className="admin-card" onSubmit={saveSettings}><div className="admin-page-head"><div><h2>Appearance</h2><p className="small">Manage the visual identity used across the whole website.</p></div><button className="admin-btn" disabled={saving}>Save Appearance</button></div><div className="admin-grid"><MediaPicker label="Main Logo" value={settings.logo} onChange={(v) => setSettings({ ...settings, logo: v })} media={media} onUpload={uploadMedia} /><MediaPicker label="Footer Logo" value={settings.footerLogo} onChange={(v) => setSettings({ ...settings, footerLogo: v })} media={media} onUpload={uploadMedia} /><Field label="Primary Brand Color" type="color" value={settings.primaryColor || '#123c69'} onChange={(v) => setSettings({ ...settings, primaryColor: v })} /><Field label="Accent Color" type="color" value={settings.accentColor || '#f2b84b'} onChange={(v) => setSettings({ ...settings, accentColor: v })} /></div><Field label="Footer Text" textarea value={settings.footerText} onChange={(v) => setSettings({ ...settings, footerText: v })} /></form>}

        {tab === 'settings' && <form className="admin-card" onSubmit={saveSettings}><div className="admin-page-head"><div><h2>Site Settings</h2><p className="small">Business details and system connection status.</p></div><button className="admin-btn" disabled={saving}>Save Settings</button></div><div className="admin-grid"><Field label="Site Name" value={settings.siteName} onChange={(v) => setSettings({ ...settings, siteName: v })} /><Field label="Tagline" value={settings.tagline} onChange={(v) => setSettings({ ...settings, tagline: v })} /><Field label="Phone" value={settings.phone} onChange={(v) => setSettings({ ...settings, phone: v })} /><Field label="Email" type="email" value={settings.email} onChange={(v) => setSettings({ ...settings, email: v })} /><Field label="LinkedIn URL" value={settings.linkedin} onChange={(v) => setSettings({ ...settings, linkedin: v })} /><Field label="Facebook URL" value={settings.facebook} onChange={(v) => setSettings({ ...settings, facebook: v })} /><Field label="Instagram URL" value={settings.instagram} onChange={(v) => setSettings({ ...settings, instagram: v })} /></div><Field label="Business Address" textarea value={settings.address} onChange={(v) => setSettings({ ...settings, address: v })} /><div className="system-status-grid"><div className={`system-status ${persistent ? 'ok' : 'warn'}`}><b>CMS Database</b><span>{persistent ? 'Connected' : 'Setup needed'}</span><small>{storage?.storage?.provider || 'Unknown provider'}</small></div><div className={`system-status ${blobReady ? 'ok' : 'warn'}`}><b>Media Storage</b><span>{blobReady ? 'Connected' : 'Setup needed'}</span><small>Supabase Storage</small></div></div></form>}


        {tab === 'users' && session.role === 'super_admin' && <div>
          <div className="admin-page-head"><div><h2>Administrator Users</h2><p className="small">Give each person their own account, role and 2FA setup. Avoid sharing one administrator password.</p></div></div>
          {userSetup && <div className="admin-card setup-card"><div className="admin-page-head"><div><h3>Save These Setup Details Now</h3><p className="small">The authenticator secret and recovery codes are shown for setup/recovery. Store them securely, then close this panel.</p></div><button className="admin-btn light" onClick={() => setUserSetup(null)}>Close</button></div>{userSetup.totpSecret && <><label>Authenticator Setup Key</label><div className="secret-row"><code>{userSetup.totpSecret}</code><button className="admin-btn light" onClick={() => copyText(userSetup.totpSecret)}>Copy</button></div></>}{userSetup.otpauthUri && <p className="small">Authenticator URI is available for QR creation by a trusted authenticator tool.</p>}<label>Recovery Codes</label><div className="recovery-grid">{(userSetup.recoveryCodes || []).map((code) => <code key={code}>{code}</code>)}</div><button className="admin-btn light" onClick={() => copyText((userSetup.recoveryCodes || []).join('\n'))}>Copy Recovery Codes</button></div>}
          <form className="admin-card" onSubmit={createAdminUser}><h3>Add Administrator</h3><div className="admin-grid three"><Field label="Username" value={newUser.username} onChange={(v) => setNewUser({ ...newUser, username: v })} /><Field label="Display Name" value={newUser.displayName} onChange={(v) => setNewUser({ ...newUser, displayName: v })} /><Field label="Email" type="email" value={newUser.email} onChange={(v) => setNewUser({ ...newUser, email: v })} /><Field label="Temporary Password" type="password" value={newUser.password} onChange={(v) => setNewUser({ ...newUser, password: v })} help="Minimum 12 characters. The user should change it after first login." /><div className="field"><label>Role</label><select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}><option value="admin">Administrator</option><option value="editor">Editor</option><option value="marketing">Marketing</option><option value="viewer">Enquiry Viewer</option><option value="super_admin">Super Admin</option></select></div><div className="field"><label>Two-Factor Authentication</label><select value={newUser.twoFactorEnabled ? 'yes' : 'no'} onChange={(e) => setNewUser({ ...newUser, twoFactorEnabled: e.target.value === 'yes' })}><option value="yes">Required</option><option value="no">Disabled</option></select></div></div><button className="admin-btn" disabled={saving}>Create User</button></form>
          <div className="admin-card"><h3>Existing Users</h3><div className="table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Role</th><th>2FA</th><th>Recovery</th><th>Status</th><th>Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.displayName || user.username}</strong><br/><span className="small">{user.username}{user.email ? ` · ${user.email}` : ''}</span></td><td><select value={user.role} onChange={(e) => updateAdminUser(user, { role: e.target.value })}><option value="super_admin">Super Admin</option><option value="admin">Administrator</option><option value="editor">Editor</option><option value="marketing">Marketing</option><option value="viewer">Enquiry Viewer</option></select></td><td>{user.twoFactorEnabled ? 'Enabled' : 'Off'}</td><td>{user.recoveryCodesRemaining || 0} codes</td><td><button className={`pill ${user.disabled ? 'draft' : ''}`} onClick={() => updateAdminUser(user, { disabled: !user.disabled })}>{user.disabled ? 'Disabled' : 'Active'}</button></td><td><div className="admin-actions compact"><button className="admin-btn light" onClick={() => resetRecoveryCodes(user)}>Recovery Codes</button><button className="admin-btn light" onClick={() => resetUserTwoFactor(user)}>Reset 2FA</button><button className="admin-btn light" onClick={() => resetUserPassword(user)}>Temp Password</button>{user.id !== session.id && <button className="admin-btn danger" onClick={() => deleteAdminUser(user)}>Delete</button>}</div></td></tr>)}</tbody></table></div></div>
        </div>}

        {tab === 'account' && <div>
          <div className="admin-page-head"><div><h2>My Account</h2><p className="small">Signed in as <b>{session.displayName || session.username}</b> · {session.role.replace('_',' ')}</p></div></div>
          {session.mustChangePassword && <div className="inline-warning"><b>Password change required:</b> This account is using a temporary password. Change it before making administrative changes.</div>}
          <form className="admin-card" onSubmit={changeOwnPassword}><h3>Change Password</h3><div className="admin-grid three"><Field label="Current Password" type="password" value={passwordForm.currentPassword} onChange={(v) => setPasswordForm({ ...passwordForm, currentPassword: v })} /><Field label="New Password" type="password" value={passwordForm.newPassword} onChange={(v) => setPasswordForm({ ...passwordForm, newPassword: v })} help="Use at least 12 characters and do not reuse another account password." /><Field label="Confirm New Password" type="password" value={passwordForm.confirmPassword} onChange={(v) => setPasswordForm({ ...passwordForm, confirmPassword: v })} /></div><button className="admin-btn" disabled={saving}>Change Password & Sign Out</button></form>
          <div className="admin-card"><div className="admin-page-head"><div><h3>Recovery Codes</h3><p className="small">Use one recovery code if your authenticator is unavailable. Each code works only once.</p></div><button className="admin-btn light" onClick={resetOwnRecoveryCodes}>Generate New Codes</button></div>{accountRecoveryCodes.length > 0 && <><div className="recovery-grid">{accountRecoveryCodes.map((code) => <code key={code}>{code}</code>)}</div><button className="admin-btn light" onClick={() => copyText(accountRecoveryCodes.join('\n'))}>Copy Codes</button></>}</div>
          <div className="admin-card"><h3>Active Sessions</h3><div className="table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Last Activity</th><th>Device</th><th>IP</th><th></th></tr></thead><tbody>{activeSessions.filter((row) => session.role === 'super_admin' || row.userId === session.id).map((row) => <tr key={row.id}><td>{row.username}{row.current ? ' (This session)' : ''}</td><td>{formatDate(row.lastSeenAt)}</td><td className="small">{row.userAgent || 'Unknown device'}</td><td>{row.ipHint || '—'}</td><td><button className="admin-btn danger" onClick={() => revokeActiveSession(row)}>Sign Out</button></td></tr>)}</tbody></table></div></div>
        </div>}

        {tab === 'security' && <div>
          <div className="admin-page-head"><div><h2>Security Center</h2><p className="small">Review takeover protection, administrator sessions and recent security activity.</p></div>{session.role === 'super_admin' && <button type="button" className="admin-btn danger" onClick={logoutAllSessions}>Sign Out All Sessions</button>}</div>
          <div className="system-status-grid">
            <div className={`system-status ${securityStatus?.supabase ? 'ok' : 'warn'}`}><b>Secure Session Store</b><span>{securityStatus?.supabase ? 'Protected' : 'Setup needed'}</span><small>Supabase PostgreSQL</small></div>
            <div className={`system-status ${securityStatus?.passwordHash ? 'ok' : 'warn'}`}><b>Authentication</b><span>{securityStatus?.passwordHash ? 'Supabase Auth' : 'Setup needed'}</span><small>Password hashing managed by Supabase Auth</small></div>
            <div className={`system-status ${securityStatus?.twoFactorConfigured ? 'ok' : 'warn'}`}><b>Two-Factor Authentication</b><span>{securityStatus?.twoFactorConfigured ? 'Enabled' : 'Setup needed'}</span><small>Authenticator app (TOTP)</small></div>
            <div className={`system-status ${securityStatus?.alertsConfigured ? 'ok' : 'warn'}`}><b>Security Alerts</b><span>{securityStatus?.alertsConfigured ? 'Connected' : 'Optional'}</span><small>Webhook notifications</small></div>
            <div className={`system-status ${securityStatus?.adminSecretStrong ? 'ok' : 'warn'}`}><b>Session Signing Secret</b><span>{securityStatus?.adminSecretStrong ? 'Strong' : 'Setup needed'}</span><small>32+ character ADMIN_SECRET</small></div>
            <div className={`system-status ${securityStatus?.ipAllowlistConfigured ? 'ok' : ''}`}><b>Admin IP Allowlist</b><span>{securityStatus?.ipAllowlistConfigured ? 'Enabled' : 'Optional'}</span><small>{securityStatus?.sessionIpBinding ? 'Session IP binding enabled' : 'Session IP binding off'}</small></div><div className={`system-status ${securityStatus?.turnstileConfigured ? 'ok' : 'warn'}`}><b>Bot Protection</b><span>{securityStatus?.turnstileConfigured ? 'Turnstile On' : 'Optional'}</span><small>Cloudflare Turnstile login/form checks</small></div><div className={`system-status ${securityStatus?.multiUserEnabled ? 'ok' : 'warn'}`}><b>Individual Admin Accounts</b><span>{securityStatus?.multiUserEnabled ? 'Enabled' : 'Setup needed'}</span><small>Role-based Supabase user profiles</small></div>
          </div>
          <div className="admin-card"><h3>Session Policy</h3><p className="small">Idle timeout: <b>{securityStatus?.sessionIdleMinutes || 45} minutes</b> · Absolute session lifetime: <b>{securityStatus?.sessionAbsoluteHours || 8} hours</b>. Mutating admin requests are protected by CSRF and same-origin checks.</p></div>
          <div className="admin-card"><div className="admin-page-head"><div><h3>Active Administrator Sessions</h3><p className="small">Revoke a single device without changing everyone’s password.</p></div></div><div className="table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Last Activity</th><th>Device</th><th>IP</th><th></th></tr></thead><tbody>{activeSessions.map((row) => <tr key={row.id}><td>{row.username}{row.current ? ' (Current)' : ''}</td><td>{formatDate(row.lastSeenAt)}</td><td className="small">{row.userAgent || 'Unknown'}</td><td>{row.ipHint || '—'}</td><td><button className="admin-btn danger" onClick={() => revokeActiveSession(row)}>Revoke</button></td></tr>)}</tbody></table></div></div>
          <div className="admin-card"><div className="admin-page-head"><div><h3>Security Audit Log</h3><p className="small">Recent logins and sensitive admin actions.</p></div><a className="admin-btn light" href="/api/admin/security/audit/export">Export CSV</a></div><div className="field search-field"><input placeholder="Search user, action, IP or target..." value={securitySearch} onChange={(e) => setSecuritySearch(e.target.value)} /></div><div className="table-wrap"><table className="admin-table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>IP</th></tr></thead><tbody>{filteredSecurityEvents.map((event) => <tr key={event.id || `${event.at}-${event.action}`}><td>{formatDate(event.at)}</td><td>{event.username}</td><td>{event.action}</td><td>{event.target || '—'}</td><td>{event.ip || '—'}</td></tr>)}</tbody></table>{filteredSecurityEvents.length === 0 && <div className="empty-state">No matching audit events.</div>}</div></div>
        </div>}

        {tab === 'backup' && <div className="admin-card"><div className="admin-page-head"><div><h2>Backup & Restore</h2><p className="small">Export website configuration safely. Enquiries are excluded by default because they contain personal information.</p></div><a className="admin-btn" href="/api/admin/backup">Download Safe Backup</a></div><div className="backup-grid"><div className="backup-box"><h3>Website Backup</h3><p>Pages, sections, menus, settings, media references and revision history. Enquiries are excluded.</p><a className="admin-btn light" href="/api/admin/backup">Export Safe Backup</a>{can('enquiries:export') && <a className="admin-btn light" href="/api/admin/backup?includeEnquiries=true">Export With Enquiries</a>}</div>{session.role === 'super_admin' && <div className="backup-box"><h3>Restore Website Data</h3><p>Super Admin only. This replaces the currently stored CMS content. Create a fresh backup first.</p><label className="admin-btn light file-button">Choose Backup File<input type="file" accept="application/json,.json" onChange={importBackup} /></label></div>}</div></div>}

        {tab === 'help' && <div><div className="admin-page-head"><div><h2>Help & Quick Guide</h2><p className="small">Simple instructions for day-to-day website management.</p></div></div><div className="help-grid"><div className="admin-card"><h3>Edit a Page</h3><p>Go to <b>Pages → Edit</b>. Change the content while watching the live preview, then click <b>Save Changes</b>.</p></div><div className="admin-card"><h3>Add a Service Page</h3><p>Go to <b>Pages → + Service Page</b>. A starter layout is created automatically. Replace the text and publish.</p></div><div className="admin-card"><h3>Change an Image</h3><p>Click <b>Choose Media</b> next to an image field. Pick an existing image or upload a new one.</p></div><div className="admin-card"><h3>Edit Dropdown Menus</h3><p>Go to <b>Navigation</b>. Add parent links and child links, reorder them, then save.</p></div><div className="admin-card"><h3>Handle Enquiries</h3><p>Go to <b>Enquiries</b>. Change the status from New to Contacted, In Progress or Closed and add internal notes.</p></div><div className="admin-card"><h3>Recover Content</h3><p>Every saved page keeps revisions. Open the page, expand <b>Revision History</b> and restore a previous version.</p></div><div className="admin-card"><h3>Security Center</h3><p>Use <b>Security</b> to review 2FA, password hashing, audit events and immediately sign out all sessions if access is ever in doubt.</p></div></div></div>}
      </section>
    </div>
  </main>;
}
