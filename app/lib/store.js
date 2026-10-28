import crypto from 'crypto';
import { cache } from 'react';
import { isPublicPage } from './publishing.mjs';
import fs from 'fs/promises';
import path from 'path';
import { supabaseAdmin, getSupabaseStatus } from './supabase';

const localFile = path.join(process.cwd(), 'data', 'local-store.json');
const seedFile = path.join(process.cwd(), 'data', 'seed.json');

function isProduction() { return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL); }
function normalizeData(data = {}) {
  return {
    settings: data.settings || {}, menus: data.menus || { header: [], footer: [] }, pages: Array.isArray(data.pages) ? data.pages : [],
    enquiries: Array.isArray(data.enquiries) ? data.enquiries : [], media: Array.isArray(data.media) ? data.media : [],
    revisions: data.revisions && typeof data.revisions === 'object' ? data.revisions : {}, updatedAt: data.updatedAt || null
  };
}
async function getSeed() { return normalizeData(JSON.parse(await fs.readFile(seedFile, 'utf8'))); }
async function readLocal() { try { return normalizeData(JSON.parse(await fs.readFile(localFile, 'utf8'))); } catch { return getSeed(); } }
async function writeLocal(data) { await fs.mkdir(path.dirname(localFile), { recursive: true }); await fs.writeFile(localFile, JSON.stringify(normalizeData(data), null, 2), 'utf8'); }

async function ensureSeed() {
  const db = supabaseAdmin();
  if (!db) return;
  const { count, error } = await db.from('cms_pages').select('*', { count: 'exact', head: true });
  if (error) throw error;
  if ((count || 0) > 0) return;
  const seed = await getSeed();
  const pageRows = seed.pages.map((page) => ({ id: Number(page.id), slug: page.slug, status: page.status || 'draft', order_num: Number(page.order || 99), data: page, created_at: page.createdAt || new Date().toISOString(), updated_at: page.updatedAt || new Date().toISOString() }));
  const enquiryRows = seed.enquiries.map((item) => ({ id: Number(item.id), data: item, created_at: item.createdAt || new Date().toISOString() }));
  const mediaRows = seed.media.map((item) => ({ id: Number(item.id), data: item, created_at: item.createdAt || new Date().toISOString() }));
  await Promise.all([
    db.from('cms_settings').upsert({ id: 1, data: seed.settings, updated_at: new Date().toISOString() }),
    db.from('cms_menus').upsert({ id: 1, data: seed.menus, updated_at: new Date().toISOString() }),
    pageRows.length ? db.from('cms_pages').upsert(pageRows) : Promise.resolve(),
    enquiryRows.length ? db.from('cms_enquiries').upsert(enquiryRows) : Promise.resolve(),
    mediaRows.length ? db.from('cms_media').upsert(mediaRows) : Promise.resolve()
  ]);
}

async function dbRead(name) {
  const db = supabaseAdmin();
  if (!db) return null;
  await ensureSeed();
  if (name === 'settings' || name === 'menus') {
    const table = name === 'settings' ? 'cms_settings' : 'cms_menus';
    const { data, error } = await db.from(table).select('data').eq('id', 1).maybeSingle();
    if (error) throw error;
    return data?.data ?? (name === 'menus' ? { header: [], footer: [] } : {});
  }
  if (name === 'pages') {
    const { data, error } = await db.from('cms_pages').select('id,data,slug,status,order_num,created_at,updated_at').order('order_num', { ascending: true });
    if (error) throw error;
    return (data || []).map((row) => ({ ...(row.data || {}), id: Number(row.id), slug: row.slug, status: row.status, order: row.order_num, createdAt: row.data?.createdAt || row.created_at, updatedAt: row.updated_at }));
  }
  if (name === 'enquiries') {
    const { data, error } = await db.from('cms_enquiries').select('id,data,created_at,updated_at').order('id', { ascending: false });
    if (error) throw error;
    return (data || []).map((row) => ({ ...(row.data || {}), id: Number(row.id), createdAt: row.data?.createdAt || row.created_at, updatedAt: row.updated_at || row.data?.updatedAt }));
  }
  if (name === 'media') {
    const { data, error } = await db.from('cms_media').select('id,data,created_at,updated_at').order('id', { ascending: false });
    if (error) throw error;
    return (data || []).map((row) => ({ ...(row.data || {}), id: Number(row.id), createdAt: row.data?.createdAt || row.created_at, updatedAt: row.updated_at || row.data?.updatedAt }));
  }
  if (name === 'revisions') {
    const { data, error } = await db.from('cms_revisions').select('id,page_id,snapshot,created_at,created_by').order('created_at', { ascending: false });
    if (error) throw error;
    const grouped = {};
    for (const row of data || []) {
      const key = String(row.page_id);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ id: row.id, ...(row.snapshot || {}), savedAt: row.snapshot?.savedAt || row.created_at, savedBy: row.snapshot?.savedBy || row.created_by || '' });
    }
    return grouped;
  }
  return null;
}

async function dbWrite(name, value) {
  const db = supabaseAdmin();
  if (!db) return null;
  await ensureSeed();
  const now = new Date().toISOString();
  if (name === 'settings' || name === 'menus') {
    const table = name === 'settings' ? 'cms_settings' : 'cms_menus';
    const { error } = await db.from(table).upsert({ id: 1, data: value, updated_at: now });
    if (error) throw error;
    return value;
  }
  if (name === 'pages') {
    const rows = (Array.isArray(value) ? value : []).map((page) => ({ id: Number(page.id), slug: page.slug, status: page.status || 'draft', order_num: Number(page.order || 99), data: page, created_at: page.createdAt || now, updated_at: page.updatedAt || now }));
    if (rows.length) { const { error } = await db.from('cms_pages').upsert(rows); if (error) throw error; }
    const keep = rows.map((r) => r.id);
    const { data: existing, error: readError } = await db.from('cms_pages').select('id');
    if (readError) throw readError;
    const remove = (existing || []).map((r) => Number(r.id)).filter((id) => !keep.includes(id));
    if (remove.length) { const { error } = await db.from('cms_pages').delete().in('id', remove); if (error) throw error; }
    return value;
  }
  if (name === 'enquiries' || name === 'media') {
    const table = name === 'enquiries' ? 'cms_enquiries' : 'cms_media';
    const list = Array.isArray(value) ? value : [];
    const rows = list.map((item) => ({ id: Number(item.id), data: item, created_at: item.createdAt || now, updated_at: item.updatedAt || now }));
    if (rows.length) { const { error } = await db.from(table).upsert(rows); if (error) throw error; }
    const keep = rows.map((r) => r.id);
    const { data: existing, error: readError } = await db.from(table).select('id');
    if (readError) throw readError;
    const remove = (existing || []).map((r) => Number(r.id)).filter((id) => !keep.includes(id));
    if (remove.length) { const { error } = await db.from(table).delete().in('id', remove); if (error) throw error; }
    return value;
  }
  if (name === 'revisions') {
    const grouped = value && typeof value === 'object' ? value : {};
    const rows = [];
    for (const [pageId, revisions] of Object.entries(grouped)) {
      for (const revision of Array.isArray(revisions) ? revisions : []) rows.push({ id: revision.id || crypto.randomUUID?.() || `${pageId}-${Date.now()}-${rows.length}`, page_id: Number(pageId), snapshot: revision, created_at: revision.savedAt || revision.createdAt || now, created_by: revision.savedBy || revision.createdBy || '' });
    }
    await db.from('cms_revisions').delete().gte('created_at', '1900-01-01T00:00:00Z');
    if (rows.length) { const { error } = await db.from('cms_revisions').insert(rows); if (error) throw error; }
    return value;
  }
  return value;
}

async function readCollection(name) {
  const dbValue = await dbRead(name);
  if (dbValue !== null) return dbValue;
  const data = isProduction() ? await getSeed() : await readLocal();
  return data[name];
}
async function writeCollection(name, value) {
  if (supabaseAdmin()) return dbWrite(name, value);
  if (!isProduction()) { const data = await readLocal(); data[name] = value; data.updatedAt = new Date().toISOString(); await writeLocal(data); return value; }
  throw Object.assign(new Error('Persistent storage is not configured. Connect Supabase, run the included SQL schema, and redeploy.'), { code: 'STORAGE_NOT_CONFIGURED', status: 503 });
}

export function getStorageStatus() {
  const status = getSupabaseStatus();
  return {
    persistent: status.configured,
    provider: status.configured ? 'supabase-postgres' : (isProduction() ? 'seed-read-only' : 'local-file'),
    schemaVersion: 6,
    message: status.configured ? 'Supabase PostgreSQL is connected.' : isProduction() ? 'Public pages use bundled seed content. Connect Supabase before using admin edits or enquiries.' : 'Using local development file storage.'
  };
}
export const getSettings = cache(async () => (await readCollection('settings')) || {});
export const getMenus = cache(async () => (await readCollection('menus')) || { header: [], footer: [] });
export const getPages = cache(async () => (await readCollection('pages')) || []);
export async function getEnquiries() { return (await readCollection('enquiries')) || []; }
export async function getMedia() { return (await readCollection('media')) || []; }
export async function getRevisions() { return (await readCollection('revisions')) || {}; }
export async function saveSettings(value) { return writeCollection('settings', value || {}); }
export async function saveMenus(value) { return writeCollection('menus', value || { header: [], footer: [] }); }
export async function savePages(value) { return writeCollection('pages', Array.isArray(value) ? value : []); }
export async function saveEnquiries(value) { return writeCollection('enquiries', Array.isArray(value) ? value : []); }
export async function saveMedia(value) { return writeCollection('media', Array.isArray(value) ? value : []); }
export async function saveRevisions(value) { return writeCollection('revisions', value && typeof value === 'object' ? value : {}); }
export async function getData() { const [settings, menus, pages, enquiries, media, revisions] = await Promise.all([getSettings(), getMenus(), getPages(), getEnquiries(), getMedia(), getRevisions()]); return { settings, menus, pages, enquiries, media, revisions, updatedAt: new Date().toISOString(), schemaVersion: 6 }; }
export async function saveData(data) { const normalized = normalizeData(data); await Promise.all([saveSettings(normalized.settings), saveMenus(normalized.menus), savePages(normalized.pages), saveEnquiries(normalized.enquiries), saveMedia(normalized.media), saveRevisions(normalized.revisions)]); return { ...normalized, updatedAt: new Date().toISOString(), schemaVersion: 6 }; }
export async function replaceData(data) { return saveData(data); }
export async function listPages(includeDrafts = false) { const pages = await getPages(); return pages.filter((page) => includeDrafts || isPublicPage(page)).sort((a, b) => (a.order || 999) - (b.order || 999)); }
export async function getPageBySlug(slug, includeDrafts = false) { const pages = await listPages(includeDrafts); const cleanSlug = slug === '/' ? 'home' : String(slug || 'home').replace(/^\//, '').replace(/\/$/, '') || 'home'; return pages.find((page) => page.slug === cleanSlug) || null; }
export function nextId(items = []) { return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1; }
