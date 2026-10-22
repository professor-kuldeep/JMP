import { NextResponse } from 'next/server';
import { requirePermission } from '../../../../lib/auth';
import { getSecurityConfigStatus } from '../../../../lib/security';
import { listUsers } from '../../../../lib/users';
import { apiError } from '../../../../lib/api-error';
export async function GET(request){
  try{
    await requirePermission(request,'security:read');
    const base=getSecurityConfigStatus();
    const users=base.supabase?await listUsers():[];
    const active=users.filter((user)=>!user.disabled);
    const twoFactorConfigured=active.length?active.every((user)=>Boolean(user.twoFactorEnabled&&user.totpSecret)):false;
    return NextResponse.json({security:{...base,passwordHash:base.supabaseAuth,twoFactorConfigured,userCount:users.length,activeUserCount:active.length}});
  }catch(error){return apiError(error);}
}
