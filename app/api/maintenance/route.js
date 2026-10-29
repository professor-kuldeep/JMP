import crypto from 'node:crypto';
import {NextResponse} from 'next/server';
import {runMaintenance} from '../../lib/operations';
import {apiError} from '../../lib/api-error';
export const maxDuration=60;
export async function GET(request){const expected=process.env.CRON_SECRET||'',given=(request.headers.get('authorization')||'').replace(/^Bearer /,'');if(expected.length<32||!crypto.timingSafeEqual(crypto.createHash('sha256').update(given).digest(),crypto.createHash('sha256').update(expected).digest()))return NextResponse.json({message:'Unauthorized'},{status:401});try{return NextResponse.json(await runMaintenance(),{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error,'Maintenance could not finish.');}}
