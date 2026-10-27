import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../lib/auth';
import { getMenus, getSettings, saveMenus, saveSettings } from '../../../lib/store';
import { apiError } from '../../../lib/api-error';
import { writeSecurityAudit } from '../../../lib/security';
import { sanitizeCmsValue } from '../../../lib/validation';
import { hasPermission } from '../../../lib/permissions';

const FORM_KEYS = new Set(['formHeading','formSuccessMessage','formServices','enquiryRetentionDays']);
const APPEARANCE_KEYS = new Set(['logo','footerLogo','primaryColor','accentColor','footerText','favicon','headingColor','textColor','backgroundColor','surfaceColor','linkColor','footerBackgroundColor','customCss']);

function isAllowedAppearanceCss(value) {
  if (typeof value !== 'string' || value.length > 20000) return false;
  // This is a restricted CSS editor rather than a full arbitrary CSS execution facility.
  return !/@import|@charset|@namespace|@font-face|url\s*\(|expression\s*\(|javascript\s*:|behavior\s*:|<\s*\/\s*style|<\s*script|\\[0-9a-f]{1,6}\s*(?:6a|75|72|6c)/i.test(value);
}

function changedKeys(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

export async function GET(request) {
  try {
    const session = await requireAdmin(request);
    const canRead = ['settings:read','menus:read','forms:read','appearance:read'].some((permission) => hasPermission(session.role, permission));
    if (!canRead) return NextResponse.json({ message: 'You do not have permission to view site configuration.' }, { status: 403 });
    const [settings, menus] = await Promise.all([getSettings(), getMenus()]);
    return NextResponse.json({ settings, menus });
  } catch (error) { return apiError(error); }
}

export async function PUT(request) {
  try {
    const session = await requireAdmin(request, { csrf: true });
    const payload = sanitizeCmsValue(await request.json());
    const [currentSettings, currentMenus] = await Promise.all([getSettings(), getMenus()]);
    const requestedSettings = { ...currentSettings, ...(payload.settings || {}) };
    const keys = changedKeys(currentSettings, requestedSettings);

    for (const key of keys) {
      const required = FORM_KEYS.has(key) ? 'forms:write' : APPEARANCE_KEYS.has(key) ? 'appearance:write' : 'settings:write';
      if (!hasPermission(session.role, required)) return NextResponse.json({ message: `You do not have permission to change ${key}.` }, { status: 403 });
    }

    // Never trust CSS or theme values supplied by a browser client.
    const colorKeys = ['primaryColor','accentColor','headingColor','textColor','backgroundColor','surfaceColor','linkColor','footerBackgroundColor'];
    for (const key of colorKeys) {
      if (requestedSettings[key] != null && !/^#[0-9a-fA-F]{6}$/.test(requestedSettings[key])) {
        return NextResponse.json({ message: `Invalid HEX color for ${key}. Use #RRGGBB.` }, { status: 400 });
      }
    }
    if (requestedSettings.favicon && (!/^\/(?!\/)[^\s"'<>]*$/i.test(requestedSettings.favicon) && !/^https:\/\/[^\s"'<>]+$/i.test(requestedSettings.favicon))) {
      return NextResponse.json({ message: 'Favicon must use a relative path or HTTPS URL.' }, { status: 400 });
    }
    if (!isAllowedAppearanceCss(requestedSettings.customCss || '')) {
      return NextResponse.json({ message: 'Custom CSS contains unsupported directives, external resources or exceeds 20,000 characters.' }, { status: 400 });
    }

    const requestedMenus = payload.menus || currentMenus;
    const menusChanged = JSON.stringify(requestedMenus) !== JSON.stringify(currentMenus);
    if (menusChanged && !hasPermission(session.role, 'menus:write')) return NextResponse.json({ message: 'You do not have permission to change navigation.' }, { status: 403 });

    await Promise.all([saveSettings(requestedSettings), saveMenus(requestedMenus)]);
    await writeSecurityAudit(request, session, 'site_configuration_updated', 'settings', { changedSettings: keys.join(','), menusChanged });
    return NextResponse.json({ settings: requestedSettings, menus: requestedMenus });
  } catch (error) { return apiError(error); }
}
