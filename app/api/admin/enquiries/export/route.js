import {requirePermission} from '../../../../lib/auth';
import {queryEnquiries} from '../../../../lib/crm-store';
import {crmFilters} from '../../../../lib/crm.mjs';
import {getSettings} from '../../../../lib/store';
import {apiError} from '../../../../lib/api-error';
import {csvCell} from '../../../../lib/traffic.mjs';
export async function GET(request){
 try{
  await requirePermission(request,'enquiries:export');const filters={...crmFilters(new URL(request.url).searchParams),page:1,pageSize:100},settings=await getSettings(),first=await queryEnquiries(filters,settings.followUpHours||48),encoder=new TextEncoder();let page=1,cancelled=false;
  const columns=['Reference','Date','Name','Email','Phone','Service','Message','Status','Internal Notes','Assigned To','Follow-up At','Traffic Source','Medium','Landing Page','Campaign'];
  const csv=items=>items.map(i=>[i.reference,i.createdAt,i.name,i.email,i.phone,i.service,i.message,i.status,i.notes,i.assignedTo,i.followUpAt,i.attribution?.source,i.attribution?.medium,i.attribution?.landingPage,i.attribution?.campaign].map(csvCell).join(',')).join('\r\n');
  const stream=new ReadableStream({start(controller){controller.enqueue(encoder.encode('\ufeff'+columns.map(csvCell).join(',')+'\r\n'));},async pull(controller){if(cancelled)return;try{const batch=page===1?first:await queryEnquiries({...filters,page},settings.followUpHours||48);if(batch.enquiries.length)controller.enqueue(encoder.encode(csv(batch.enquiries)+'\r\n'));if(page*100>=first.total||!batch.enquiries.length)controller.close();else page++;}catch(error){controller.error(new Error('The export could not finish. Please retry.'));}},cancel(){cancelled=true;}});
  return new Response(stream,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="jmp-enquiries.csv"','Cache-Control':'private, no-store'}});
 }catch(error){return apiError(error);}
}
