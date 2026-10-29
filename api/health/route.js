import {NextResponse} from 'next/server';
import {supabaseAdmin,mediaBucket} from '../../lib/supabase';
export const dynamic='force-dynamic';
export async function GET(){let database=false,media=false;try{const db=supabaseAdmin();if(db){const [probe,bucket]=await Promise.all([db.from('cms_settings').select('id',{head:true}).limit(1),db.storage.getBucket(mediaBucket())]);database=!probe.error;media=!bucket.error;}}catch{}return NextResponse.json({ok:database&&media,version:'9.0.0',checks:{database,media},checkedAt:new Date().toISOString()},{status:database&&media?200:503,headers:{'Cache-Control':'no-store'}});}
