import { NextResponse } from 'next/server';
import { requirePermission } from '../../../lib/auth';
import { getEnquiries } from '../../../lib/store';
import { apiError } from '../../../lib/api-error';
export async function GET(request) {
  try { await requirePermission(request, 'enquiries:read'); return NextResponse.json({ enquiries: await getEnquiries() }); }
  catch (error) { return apiError(error); }
}
