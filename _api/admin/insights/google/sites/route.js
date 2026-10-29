import {requirePermission} from '../../../../../lib/auth';
import {googleSites} from '../../../../../lib/google-integration';
import {getSettings} from '../../../../../lib/store';
import {insightsJson,insightsFailure} from '../../../../../lib/insights-http';
export async function GET(request){try{await requirePermission(request,'analytics:manage');return insightsJson({sites:await googleSites((await getSettings()).googleConnectionMode||'oauth')});}catch(error){return insightsFailure(error);}}
