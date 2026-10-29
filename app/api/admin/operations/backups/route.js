import {NextResponse} from 'next/server';
import {requirePermission} from '../../../../lib/auth';
import {listBackups,startBackup,continueBackup,inspectBackup,restoreBackup} from '../../../../lib/backups';
import {apiError} from '../../../../lib/api-error';
import {writeSecurityAudit} from '../../../../lib/security';
import {invalidatePublicContent} from '../../../../lib/public-cache';
export const maxDuration=60;
export async function GET(request){try{await requirePermission(request,'backup:export');return NextResponse.json({backups:await listBackups()});}catch(error){return apiError(error);}}
export async function POST(request){try{const session=await requirePermission(request,'operations:manage',{csrf:true}),payload=await request.json();let result;
 if(payload.action==='start')result=await startBackup();else if(payload.action==='continue')result=await continueBackup(payload.id);
 else if(payload.action==='inspect'){await requirePermission(request,'*',{csrf:true});result=await inspectBackup(payload.id);}
 else if(payload.action==='restore'){await requirePermission(request,'*',{csrf:true});if(payload.confirm!=='RESTORE')return NextResponse.json({message:'Type RESTORE to confirm.'},{status:400});result=await restoreBackup(payload.id);invalidatePublicContent();}
 else return NextResponse.json({message:'Invalid backup action.'},{status:400});
 await writeSecurityAudit(request,session,'backup_'+payload.action,'backup:'+String(payload.id||result.id||''));return NextResponse.json(result);
}catch(error){return apiError(error,'The backup operation could not finish.');}}
