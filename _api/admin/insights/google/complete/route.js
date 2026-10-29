import {NextResponse} from 'next/server';
import {requirePermission} from '../../../../../lib/auth';
import {openGoogle,validateOAuthState} from '../../../../../lib/google-secrets.mjs';
import {oauthClient,saveGoogleTokens} from '../../../../../lib/google-integration';
import {writeSecurityAudit} from '../../../../../lib/security';
export async function GET(request){let outcome='failed';
 try{
  const session=await requirePermission(request,'analytics:manage'),pending=openGoogle(request.cookies.get('jmp-google-pending')?.value);
  if(!Number.isFinite(pending.createdAt)||Date.now()-pending.createdAt>120000||Date.now()<pending.createdAt)throw new Error();
  const state=validateOAuthState(request.cookies.get('jmp-google-state')?.value,pending.state,session.username);
  if(!pending.error&&pending.code){const {tokens}=await oauthClient().getToken({code:pending.code,codeVerifier:state.verifier});await saveGoogleTokens(tokens,session.username);await writeSecurityAudit(request,session,'google_reporting_connected','analytics');outcome='connected';}else outcome='cancelled';
 }catch{}
 const response=NextResponse.redirect(new URL('/admin?insights='+outcome,request.url));
 for(const name of ['jmp-google-state','jmp-google-pending'])response.cookies.set(name,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:name==='jmp-google-state'?'lax':'strict',maxAge:0,path:'/api/admin/insights/google'});
 response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
}
