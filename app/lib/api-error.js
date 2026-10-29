import { after, NextResponse } from 'next/server';
import { recordOperation } from './monitoring';

export function apiError(error, fallback = 'Request failed.', options = {}) {
  if (!error?.status || error.status >= 500) {try{after(()=>recordOperation('api','REQUEST_FAILED'));}catch{void recordOperation('api','REQUEST_FAILED');}}
  if (error?.code === 'STORAGE_NOT_CONFIGURED') {
    if(options.public)return NextResponse.json({message:fallback},{status:503});
    return NextResponse.json({ message: error.message, code: error.code }, { status: 503 });
  }
  if (error?.code === 'CRM_ERROR') return NextResponse.json({message:error.message},{status:error.status||400});
  if (error?.status === 401) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (error?.status === 403) return NextResponse.json({ message: error.message || 'Forbidden' }, { status: 403 });
  if (error?.status === 429) return NextResponse.json({ message: error.message || 'Too many requests.' }, { status: 429, headers: error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : undefined });
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) return NextResponse.json({ message: error.message || fallback }, { status: error.status });
  return NextResponse.json({ message: fallback }, { status: 500 });
}
