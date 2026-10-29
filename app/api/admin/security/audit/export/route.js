import { requirePermission } from '../../../../../lib/auth';
import { listSecurityAudit } from '../../../../../lib/security';
import { apiError } from '../../../../../lib/api-error';
function csvEscape(value){const text=String(value??'');const safe=/^[=+\-@]/.test(text)?`'${text}`:text;return `"${safe.replace(/"/g,'""')}"`;}
export async function GET(request){try{await requirePermission(request,'security:read');const events=await listSecurityAudit(500);const headers=['Time','Username','Role','Action','Target','IP','User Agent','Details'];const rows=events.map((e)=>[e.at,e.username,e.role,e.action,e.target,e.ip,e.userAgent,JSON.stringify(e.details||{})]);const csv=[headers,...rows].map((row)=>row.map(csvEscape).join(',')).join('\n');return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="coretax-security-audit.csv"','Cache-Control':'private, no-store'}});}catch(error){return apiError(error);}}
