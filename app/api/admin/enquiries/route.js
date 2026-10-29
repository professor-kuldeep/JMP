import {NextResponse} from 'next/server';
import {requirePermission} from '../../../lib/auth';
import {getSettings} from '../../../lib/store';
import {queryEnquiries} from '../../../lib/crm-store';
import {crmFilters} from '../../../lib/crm.mjs';
import {apiError} from '../../../lib/api-error';
export async function GET(request){try{await requirePermission(request,'enquiries:read');const settings=await getSettings();return NextResponse.json(await queryEnquiries(crmFilters(new URL(request.url).searchParams),settings.followUpHours||48),{headers:{'Cache-Control':'private, no-store'}});}catch(error){return apiError(error);}}
