import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../lib/auth';
import { getStorageStatus } from '../../../lib/store';
import { getSupabaseStatus } from '../../../lib/supabase';
import { apiError } from '../../../lib/api-error';
export async function GET(request){try{await requireAdmin(request);const supabase=getSupabaseStatus();return NextResponse.json({storage:getStorageStatus(),blob:supabase.configured,mediaProvider:supabase.configured?'supabase-storage':'not-configured',authProvider:supabase.authConfigured?'supabase-auth':'not-configured'});}catch(error){return apiError(error);}}
