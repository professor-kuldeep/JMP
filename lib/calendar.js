import {GoogleAuth,OAuth2Client} from 'google-auth-library';
import {crmError} from './crm.mjs';
import {recordOperation} from './monitoring';
const SCOPES=['https://www.googleapis.com/auth/calendar.events','https://www.googleapis.com/auth/calendar.freebusy'];
export function calendarEnvironment(environment=process.env){let serviceEmail='',configured=false;try{const c=JSON.parse(environment.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON||'{}');serviceEmail=c.client_email||'';configured=Boolean(serviceEmail&&c.private_key);}catch{}return {configured,serviceEmail,mode:'service_account'};}
async function accessToken(){try{const credentials=JSON.parse(process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON||'{}');if(!credentials.client_email||!credentials.private_key)throw new Error();const auth=new GoogleAuth({credentials,scopes:SCOPES}),client=await auth.getClient(),result=await client.getAccessToken();if(!result.token)throw new Error();return result.token;}catch{throw crmError('The team calendar is not connected. Please send an enquiry instead.',503);}}
async function calendarRequest(path,{method='GET',body,allowMissing=false}={}){
 try{const response=await fetch('https://www.googleapis.com/calendar/v3'+path,{method,headers:{Authorization:'Bearer '+await accessToken(),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000),cache:'no-store'});if(allowMissing&&[404,410].includes(response.status))return null;if(response.status===409)return {conflict:true};if(!response.ok)throw new Error();if(response.status===204)return {};return await response.json();}catch(error){await recordOperation('calendar','CALENDAR_REQUEST_FAILED');throw crmError('The team calendar is temporarily unavailable. Please try again or send an enquiry.',503);}
}
export async function calendarBusy(calendarId,start,end){const data=await calendarRequest('/freeBusy',{method:'POST',body:{timeMin:start,timeMax:end,items:[{id:calendarId}]}}),calendar=data.calendars?.[calendarId];if(!calendar||calendar.errors?.length)throw crmError('The team calendar could not be checked. Please send an enquiry instead.',503);return calendar.busy||[];}
const eventPath=row=>'/calendars/'+encodeURIComponent(row.calendar_id)+'/events/'+encodeURIComponent(row.calendar_event_id);
export async function findCalendarEvent(row){return calendarRequest(eventPath(row),{allowMissing:true});}
export async function writeCalendarBooking(row,reschedule=false){
 const body={summary:'Consultation | '+(row.data.service||'JMP'),description:`Website consultation\nName: ${row.data.name}\nEmail: ${row.data.email}\nPhone: ${row.data.phone||'Not provided'}\nEnquiry: JMP-${String(row.enquiry_id).padStart(6,'0')}`,location:row.data.location||'',start:{dateTime:row.start_at,timeZone:row.data.timeZone},end:{dateTime:row.end_at,timeZone:row.data.timeZone},visibility:'private',transparency:'opaque'};
 if(reschedule)return calendarRequest(eventPath(row),{method:'PATCH',body});
 const response=await calendarRequest('/calendars/'+encodeURIComponent(row.calendar_id)+'/events',{method:'POST',body:{...body,id:row.calendar_event_id}});
 if(response.conflict){const existing=await findCalendarEvent(row);if(!existing||Date.parse(existing.start?.dateTime)!==Date.parse(row.start_at))throw crmError('This booking needs a team review. Please contact us.',409);return existing;}return response;
}
export async function removeCalendarBooking(row){return calendarRequest(eventPath(row),{method:'DELETE',allowMissing:true});}
