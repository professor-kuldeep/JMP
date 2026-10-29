import { NextResponse } from 'next/server';
import { clearSessionCookie, requireAdmin, revokeUserSessions } from '../../../../lib/auth';
import { authenticateUser, getUserById, updateUser } from '../../../../lib/users';
import { apiError } from '../../../../lib/api-error';
import { writeSecurityAudit, sendSecurityAlert } from '../../../../lib/security';
export async function POST(request){
  try{
    const session=await requireAdmin(request,{csrf:true});
    const body=await request.json();
    const user=await getUserById(session.userId);
    if(!user)return NextResponse.json({message:'User account not found.'},{status:404});
    const auth=await authenticateUser(user,String(body.currentPassword||''));
    if(!auth.ok)return NextResponse.json({message:'Current password is incorrect.'},{status:400});
    const next=String(body.newPassword||'');
    if(next.length<12)return NextResponse.json({message:'New password must be at least 12 characters.'},{status:400});
    if(next===String(body.currentPassword||''))return NextResponse.json({message:'Choose a different password.'},{status:400});
    await updateUser(user.id,{password:next,mustChangePassword:false});
    await writeSecurityAudit(request,session,'password_changed',`user:${user.id}`);
    await sendSecurityAlert({type:'password_changed',username:user.username,at:new Date().toISOString()});
    await revokeUserSessions(user.id);
    const response=NextResponse.json({success:true,message:'Password changed. Please sign in again.'});
    clearSessionCookie(response);
    return response;
  }catch(error){return apiError(error);}
}
