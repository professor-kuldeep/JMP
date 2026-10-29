import {NextResponse} from 'next/server';
import {requirePermission} from '../../../lib/auth';
import {supabaseAdmin} from '../../../lib/supabase';
import {apiError} from '../../../lib/api-error';
import {cancelBooking} from '../../../lib/booking-service';
import {readBooking} from '../../../lib/booking-store';
import {getSettings} from '../../../lib/store';
import {writeSecurityAudit} from '../../../lib/security';
export async function GET(request){try{await requirePermission(request,'booking:read');const db=supabaseAdmin();if(!db)return NextResponse.json({bookings:[],setupRequired:true});const {data,error}=await db.from('cms_bookings').select('id,status,start_at,end_at,enquiry_id,data').gte('start_at',new Date(Date.now()-7*86400000).toISOString()).order('start_at').limit(100);if(error)throw error;return NextResponse.json({bookings:(data||[]).map(b=>({id:b.id,status:b.status,start:b.start_at,name:b.data?.name,service:b.data?.service,reference:'JMP-'+String(b.enquiry_id||0).padStart(6,'0')}))});}catch(error){return apiError(error);}}
export async function POST(request){try{const session=await requirePermission(request,'booking:manage',{csrf:true}),payload=await request.json();if(payload.action!=='cancel')return NextResponse.json({message:'Invalid action.'},{status:400});const row=await readBooking(payload.id,'',true);await cancelBooking(await getSettings(),row);await writeSecurityAudit(request,session,'booking_cancelled','booking:'+row.id);return NextResponse.json({cancelled:true});}catch(error){return apiError(error,'The appointment could not be cancelled.');}}
