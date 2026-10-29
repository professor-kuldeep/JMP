import {requirePermission} from '../../../../../lib/auth';
import {disconnectGoogle} from '../../../../../lib/google-integration';
import {insightsJson,insightsFailure} from '../../../../../lib/insights-http';
import {writeSecurityAudit} from '../../../../../lib/security';
export async function POST(request){try{const session=await requirePermission(request,'analytics:manage',{csrf:true});const result=await disconnectGoogle();await writeSecurityAudit(request,session,'google_reporting_disconnected','analytics');return insightsJson({success:true,...result});}catch(error){return insightsFailure(error);}}
