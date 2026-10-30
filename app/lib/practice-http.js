import {NextResponse} from 'next/server';
import {apiError} from './api-error';
export const practiceJson = (value, status = 200) => NextResponse.json(value, {status, headers: {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff'}});
export function practiceApiError(error,publicFacing=false) { const response = apiError(error, publicFacing?'The client workspace is temporarily unavailable. Please contact the team.':'The client workspace request could not be completed.',{public:publicFacing}); response.headers.set('Cache-Control', 'private, no-store'); response.headers.set('Referrer-Policy', 'no-referrer'); return response; }
