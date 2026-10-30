import {NextResponse} from 'next/server';
export function insightsJson(data,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});}
export function insightsFailure(error){const status=Number(error?.status)||500;const trusted=['ANALYTICS_ERROR','ANALYTICS_STORAGE','GOOGLE_REPORT','FORBIDDEN'].includes(error?.code)||[401,403,429].includes(status);return insightsJson({message:trusted?error.message:'Unable to complete this analytics request. Check the connection settings.'},status);}
