import crypto from 'node:crypto';
import {NextResponse} from 'next/server';
import {getSettings} from '../../../lib/store';
import {normalizeVisitEvent} from '../../../lib/traffic.mjs';
import {recordVisitEvent} from '../../../lib/insights-store';
import {verifyRequestOrigin,rateLimit,getClientIp} from '../../../lib/security';
export async function POST(request){
  if(!verifyRequestOrigin(request))return new NextResponse(null,{status:403});
  if(/bot|spider|crawler|slurp|lighthouse/i.test(request.headers.get('user-agent')||'')||request.headers.get('dnt')==='1'||request.headers.get('sec-gpc')==='1')return new NextResponse(null,{status:204});
  try{
    if(Number(request.headers.get('content-length')||0)>3000)return new NextResponse(null,{status:413});
    const text=await request.text();if(text.length>3000)return new NextResponse(null,{status:413});
    const event=normalizeVisitEvent(JSON.parse(text)),settings=await getSettings();
    if(settings.visitorTrackingEnabled===false)return new NextResponse(null,{status:204});
    const ipKey=crypto.createHmac('sha256',process.env.ADMIN_SECRET||'visitor-rate-local').update(getClientIp(request)).digest('hex').slice(0,32);
    const limits=await Promise.all([rateLimit('visitor-ip:'+ipKey,240,60),rateLimit('visitor:'+event.sessionId,120,60)]);if(limits.some(limit=>!limit.allowed))return new NextResponse(null,{status:limits.some(limit=>limit.unavailable)?503:429});
    await recordVisitEvent(event,settings.visitorRetentionDays);
    return new NextResponse(null,{status:204,headers:{'Cache-Control':'no-store'}});
  }catch(error){return NextResponse.json({message:error.status===503?'Visitor storage needs setup.':'Invalid analytics event.'},{status:error.status||400});}
}
