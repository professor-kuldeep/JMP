import {NextResponse} from 'next/server';
import {openGoogle,sealGoogle,validateOAuthState} from '../../../../../lib/google-secrets.mjs';
// The admin session uses SameSite=Strict. Complete the exchange only after
// this same-origin document initiates a second navigation with that session.
export async function GET(request){
 try{
  const params=new URL(request.url).searchParams,cookie=request.cookies.get('jmp-google-state')?.value;
  const initial=openGoogle(cookie);validateOAuthState(cookie,params.get('state'),initial.username);
  const pending=sealGoogle({state:params.get('state'),code:params.get('code')||'',error:params.get('error')||'',createdAt:Date.now()});
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connecting Google</title></head><body style="font-family:Arial,sans-serif;background:#f4f6f9;color:#153e64;padding:60px"><h1 style="font-size:24px">Finishing your Google connection…</h1><p><a href="/api/admin/insights/google/complete">Continue to your CRM</a></p><script>window.location.replace("/api/admin/insights/google/complete");</script></body></html>';
  const response=new NextResponse(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}});
  response.cookies.set('jmp-google-pending',pending,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:120,path:'/api/admin/insights/google'});return response;
 }catch{const response=NextResponse.redirect(new URL('/admin?insights=failed',request.url));response.headers.set('Cache-Control','private, no-store');return response;}
}
