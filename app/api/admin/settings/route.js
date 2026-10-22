import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../lib/auth';
import { getMenus, getSettings, saveMenus, saveSettings } from '../../../lib/store';
import { apiError } from '../../../lib/api-error';
import { writeSecurityAudit } from '../../../lib/security';
import { sanitizeCmsValue } from '../../../lib/validation';
import { hasPermission } from '../../../lib/permissions';

const FORM_KEYS = new Set(['formHeading','formSuccessMessage','formServices','enquiryRetentionDays']);
const APPEARANCE_KEYS = new Set(['logo','footerLogo','primaryColor','accentColor','footerText']);

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

    const requestedMenus = payload.menus || currentMenus;
    const menusChanged = JSON.stringify(requestedMenus) !== JSON.stringify(currentMenus);
    if (menusChanged && !hasPermission(session.role, 'menus:write')) return NextResponse.json({ message: 'You do not have permission to change navigation.' }, { status: 403 });

    await Promise.all([saveSettings(requestedSettings), saveMenus(requestedMenus)]);
    await writeSecurityAudit(request, session, 'site_configuration_updated', 'settings', { changedSettings: keys.join(','), menusChanged });
    return NextResponse.json({ settings: requestedSettings, menus: requestedMenus });
  } catch (error) { return apiError(error); }
}
