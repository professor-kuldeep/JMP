import { NextResponse } from 'next/server';

export function apiError(error, fallback = 'Request failed.') {
  console.error(error);
  if (error?.code === 'STORAGE_NOT_CONFIGURED') {
    return NextResponse.json({ message: error.message, code: error.code }, { status: 503 });
  }
  if (error?.status === 401) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (error?.status === 403) return NextResponse.json({ message: error.message || 'Forbidden' }, { status: 403 });
  if (error?.status === 429) return NextResponse.json({ message: error.message || 'Too many requests.' }, { status: 429, headers: error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : undefined });
  return NextResponse.json({ message: error?.message || fallback }, { status: 500 });
}
