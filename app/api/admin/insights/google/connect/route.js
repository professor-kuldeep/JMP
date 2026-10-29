import crypto from 'node:crypto';
import {NextResponse} from 'next/server';
import {requirePermission} from '../../../../../lib/auth';
import {oauthClient} from '../../../../../lib/google-integration';
import {readGoogleConnection} from '../../../../../lib/insights-store';
import {getStorageStatus} from '../../../../../lib/store';
import {GOOGLE_SCOPES,sealGoogle} from '../../../../../lib/google-secrets.mjs';
import {analyticsError} from '../../../../../lib/traffic.mjs';
import {insightsFailure} from '../../../../../lib/insights-http';
export async function POST(request){try{const session=await requirePermission(request,'analytics:manage',{csrf:true});if(process.env.NODE_ENV==='production'&&!getStorageStatus().persistent)throw analyticsError('Connect Supabase and run the analytics migration before connecting Google.',503);await readGoogleConnection();const client=oauthClient();const state=crypto.randomBytes(32).toString('hex'),pkce=await client.generateCodeVerifierAsync();const url=client.generateAuthUrl({access_type:'offline',prompt:'consent',scope:GOOGLE_SCOPES,state,code_challenge:pkce.codeChallenge,code_challenge_method:'S256'});const response=NextResponse.json({url},{headers:{'Cache-Control':'private, no-store'}});response.cookies.set('jmp-google-state',sealGoogle({state,verifier:pkce.codeVerifier,username:session.username,createdAt:Date.now()}),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:600,path:'/api/admin/insights/google'});return response;}catch(error){return insightsFailure(error);}}
