import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../lib/auth';
import { getMenus, getSettings, saveMenus, saveSettings } from '../../../lib/store';
import { apiError } from '../../../lib/api-error';
import { writeSecurityAudit } from '../../../lib/security';
import { sanitizeCmsValue } from '../../../lib/validation';
import { siteOrigin } from '../../../lib/seo.mjs';
import {ANALYTICS_KEYS,validateAnalyticsSettings} from '../../../lib/traffic.mjs';
import {clearGoogleCache} from '../../../lib/google-integration';
import { hasPermission } from '../../../lib/permissions';
import { BOOKING_KEYS,validateBookingSettings } from '../../../lib/booking.mjs';
import { calendarEnvironment } from '../../../lib/calendar';
import {validateWorkflowRules} from '../../../lib/practice.mjs';
import {checkOwner, assertPortalReady} from '../../../lib/practice-store';

const FORM_KEYS = new Set(['formHeading','formSuccessMessage','formServices','enquiryRetentionDays','notificationEmail','enquiryNotificationsEnabled','enquiryAcknowledgementEnabled','followUpHours']);
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
      const required = ['practiceWorkflowRules','practiceRemindersEnabled','clientPortalEnabled'].includes(key) ? 'practice:manage' : key==='contentApprovalRequired' ? 'pages:approve' : BOOKING_KEYS.includes(key) ? 'booking:manage' : ANALYTICS_KEYS.includes(key) ? 'analytics:manage' : FORM_KEYS.has(key) ? 'forms:write' : APPEARANCE_KEYS.has(key) ? 'appearance:write' : 'settings:write';
      if (!hasPermission(session.role, required)) return NextResponse.json({ message: `You do not have permission to change ${key}.` }, { status: 403 });
    }

    if (requestedSettings.siteUrl && (!siteOrigin(requestedSettings) || !/^https?:\/\/[^\s/?#]+(?::[0-9]+)?\/?$/.test(requestedSettings.siteUrl))) return NextResponse.json({message:'Site URL must be an absolute website origin, such as https://example.com.'},{status:400});
    for (const key of ['analyticsEnabled','enquiryNotificationsEnabled','enquiryAcknowledgementEnabled']) if (requestedSettings[key] != null && typeof requestedSettings[key] !== 'boolean') return NextResponse.json({message:`Invalid on/off value for ${key}.`},{status:400});
    if (requestedSettings.analyticsEnabled && !/^G-[A-Z0-9]{4,20}$/.test(requestedSettings.gaMeasurementId || '')) return NextResponse.json({message:'Add a valid GA4 measurement ID before enabling analytics.'},{status:400});
    if (requestedSettings.gaMeasurementId && !/^G-[A-Z0-9]{4,20}$/.test(requestedSettings.gaMeasurementId)) return NextResponse.json({message:'Enter a valid GA4 measurement ID (G-...).'}, {status:400});
    if (requestedSettings.notificationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedSettings.notificationEmail)) return NextResponse.json({message:'Enter a valid enquiry notification email.'},{status:400});
    if (requestedSettings.followUpHours != null && (!Number.isFinite(Number(requestedSettings.followUpHours)) || Number(requestedSettings.followUpHours) < 1 || Number(requestedSettings.followUpHours) > 720)) return NextResponse.json({message:'Follow-up reminders must be between 1 and 720 hours.'},{status:400});
    for(const key of ['clientPortalEnabled','practiceRemindersEnabled','contentApprovalRequired'])if(requestedSettings[key]!=null&&typeof requestedSettings[key]!=='boolean')return NextResponse.json({message:'Choose valid client workspace and publishing settings.'},{status:400});
    if(keys.includes('practiceWorkflowRules')){const rules=validateWorkflowRules(requestedSettings.practiceWorkflowRules);for(const rule of rules){const user=await checkOwner(rule.ownerId);rule.ownerName=user?.displayName||user?.username||'';}requestedSettings.practiceWorkflowRules=rules;}
    if(keys.includes('clientPortalEnabled')&&requestedSettings.clientPortalEnabled)await assertPortalReady(requestedSettings);
    try {validateAnalyticsSettings(requestedSettings);} catch(error) {return NextResponse.json({message:error.message},{status:400});}
    if(keys.some(key=>ANALYTICS_KEYS.includes(key)))clearGoogleCache();
    try { validateBookingSettings(requestedSettings); } catch(error) { return NextResponse.json({message:error.message},{status:400}); }
    if(requestedSettings.bookingEnabled && !calendarEnvironment().configured) return NextResponse.json({message:'Connect the team calendar in the hosting environment before enabling online booking.'},{status:400});
    if(requestedSettings.enquiryRetentionDays!=null&&(!Number.isInteger(Number(requestedSettings.enquiryRetentionDays))||Number(requestedSettings.enquiryRetentionDays)<30||Number(requestedSettings.enquiryRetentionDays)>3650))return NextResponse.json({message:'Enquiry retention must be between 30 and 3650 days.'},{status:400});
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
