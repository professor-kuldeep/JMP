import {requirePermission} from '../../../../lib/auth';
import {getSettings,saveSettings,getStorageStatus} from '../../../../lib/store';
import {ANALYTICS_KEYS,analyticsConfig,validateAnalyticsSettings} from '../../../../lib/traffic.mjs';
import {googleConnectionStatus,clearGoogleCache} from '../../../../lib/google-integration';
import {insightsJson,insightsFailure} from '../../../../lib/insights-http';
import {writeSecurityAudit} from '../../../../lib/security';
export async function GET(request){try{await requirePermission(request,'analytics:read');return insightsJson({config:analyticsConfig(await getSettings()),google:await googleConnectionStatus(),storage:getStorageStatus()});}catch(error){return insightsFailure(error);}}
export async function PUT(request){try{const session=await requirePermission(request,'analytics:manage',{csrf:true});const body=await request.json();const patch=Object.fromEntries(ANALYTICS_KEYS.filter(key=>Object.hasOwn(body,key)).map(key=>[key,typeof body[key]==='string'?body[key].trim():body[key]]));const settings=validateAnalyticsSettings({...await getSettings(),...patch});await saveSettings(settings);clearGoogleCache();await writeSecurityAudit(request,session,'analytics_settings_updated','analytics',{keys:Object.keys(patch).join(',')});return insightsJson({config:analyticsConfig(settings)});}catch(error){return insightsFailure(error);}}
