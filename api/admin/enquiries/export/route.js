import { requirePermission } from '../../../../lib/auth';
import { getEnquiries } from '../../../../lib/store';
import { apiError } from '../../../../lib/api-error';
function csvEscape(value){const text=String(value??'');const safe=/^[=+\-@]/.test(text)?`'${text}`:text;return `"${safe.replace(/"/g,'""')}"`;}
export async function GET(request){
  try{await requirePermission(request,'enquiries:export');const enquiries=await getEnquiries();const headers=['Date','Name','Email','Phone','Service','Message','Status','Internal Notes','Assigned To','Follow-up At','Traffic Source','Medium','Landing Page','Campaign'];const rows=enquiries.map((item)=>[item.createdAt,item.name,item.email,item.phone,item.service,item.message,item.status||'new',item.notes||'',item.assignedTo||'',item.followUpAt||'',item.attribution?.source||'',item.attribution?.medium||'',item.attribution?.landingPage||'',item.attribution?.campaign||'']);const csv=[headers,...rows].map((row)=>row.map(csvEscape).join(',')).join('\n');return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="coretax-enquiries.csv"','Cache-Control':'private, no-store'}});}catch(error){return apiError(error);}
}
