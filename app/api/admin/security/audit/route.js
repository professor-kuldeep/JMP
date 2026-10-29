import { NextResponse } from 'next/server';
import { requirePermission } from '../../../../lib/auth';
import { listSecurityAudit } from '../../../../lib/security';
import { apiError } from '../../../../lib/api-error';
export async function GET(request){try{await requirePermission(request,'security:read');const{searchParams}=new URL(request.url);const limit=Math.min(Number(searchParams.get('limit')||100),500);const q=String(searchParams.get('q')||'').toLowerCase();const action=String(searchParams.get('action')||'');let events=await listSecurityAudit(limit);if(q)events=events.filter((e)=>JSON.stringify(e).toLowerCase().includes(q));if(action)events=events.filter((e)=>e.action===action);return NextResponse.json({events});}catch(error){return apiError(error);}}
