import {NextResponse} from 'next/server';
import {requirePermission} from '../../../lib/auth';
import {operationStatus,runMaintenance} from '../../../lib/operations';
import {apiError} from '../../../lib/api-error';
import {supabaseAdmin} from '../../../lib/supabase';
import {writeSecurityAudit} from '../../../lib/security';
import {calendarBusy} from '../../../lib/calendar';
import {getSettings} from '../../../lib/store';
export const maxDuration=60;
export async function GET(request){try{await requirePermission(request,'operations:read');return NextResponse.json(await operationStatus(),{headers:{'Cache-Control':'private, no-store'}});}catch(error){return apiError(error);}}
export async function POST(request){try{const session=await requirePermission(request,'operations:manage',{csrf:true}),payload=await request.json();let result;
 if(payload.action==='run')result=await runMaintenance();
 else if(payload.action==='retry'){const db=supabaseAdmin();if(!db)throw Object.assign(new Error('Connect Supabase first.'),{status:503,code:'STORAGE_NOT_CONFIGURED'});let retry=db.from('cms_jobs').update({state:'pending',attempts:0,next_attempt_at:new Date().toISOString(),last_error:''}).eq('state','failed');if(payload.id){if(typeof payload.id!=='string'||payload.id.length>200)return NextResponse.json({message:'Invalid email job.'},{status:400});retry=retry.eq('id',payload.id);}const reset=await retry;if(reset.error)throw reset.error;result={queued:true};}
 else if(payload.action==='test-calendar'){const settings=await getSettings();if(!settings.bookingCalendarId)return NextResponse.json({message:'Save the calendar ID first.'},{status:400});await calendarBusy(settings.bookingCalendarId,new Date().toISOString(),new Date(Date.now()+86400000).toISOString());result={connected:true};}
 else return NextResponse.json({message:'Invalid operation.'},{status:400});
 await writeSecurityAudit(request,session,'operations_'+payload.action,'operations');return NextResponse.json(result);
}catch(error){return apiError(error,'The operation could not finish.');}}
