export function cleanText(value, max = 5000) {
  return String(value ?? '')
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/\bon\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, max);
}

export function cleanEmail(value) {
  const email = cleanText(value, 254).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

export function cleanUrl(value, max = 2048) {
  const raw = cleanText(value, max).trim();
  if (!raw) return '';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw;
  return '';
}

export function sanitizeCmsValue(value, depth = 0, keyName = '') {
  if (depth > 8) return null;
  if (typeof value === 'string') {
    const key = String(keyName).toLowerCase();
    if (key.includes('url') || key.includes('image') || key.includes('logo') || key === 'href' || ['linkedin','facebook','instagram','youtube','twitter','x'].includes(key)) return cleanUrl(value);
    return cleanText(value, 10000);
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'boolean' || value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 250).map((item) => sanitizeCmsValue(item, depth + 1, keyName));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value).slice(0, 250)) {
      const safeKey = cleanText(key, 80).replace(/[^a-zA-Z0-9_-]/g, '');
      if (!safeKey || ['__proto__', 'constructor', 'prototype'].includes(safeKey)) continue;
      out[safeKey] = sanitizeCmsValue(child, depth + 1, safeKey);
    }
    return out;
  }
  return null;
}
