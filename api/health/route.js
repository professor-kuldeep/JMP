import { NextResponse } from 'next/server';
import { getStorageStatus } from '../../lib/store';
import { getSupabaseStatus, supabaseAdmin, mediaBucket } from '../../lib/supabase';
export async function GET(){
  const supabase=getSupabaseStatus();
  let databaseConnected=false; let storageConnected=false; let databaseError=''; let storageError='';
  const db=supabaseAdmin();
  if(db){
    const probe=await db.from('cms_settings').select('id',{head:true, count:'exact'}).limit(1);
    databaseConnected=!probe.error; databaseError=probe.error?.message||'';
    const bucket=await db.storage.getBucket(mediaBucket());
    storageConnected=!bucket.error; storageError=bucket.error?.message||'';
  }
  return NextResponse.json({
    ok:databaseConnected,
    app:'CoreTax CMS',version:'6.0.0-supabase',
    storage:{...getStorageStatus(),persistent:databaseConnected,provider:databaseConnected?'supabase-postgres':'not-ready'},
    auth:supabase.authConfigured?'supabase-auth':'not-configured',
    media:storageConnected?'supabase-storage':'not-ready',
    turnstile:Boolean(process.env.TURNSTILE_SECRET_KEY&&process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    diagnostics:{databaseError,storageError}
  },{status:databaseConnected?200:503});
}
