import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { supabaseAdmin } from './supabase';
import { isProduction, localRead, localMutate, storageRequired } from './runtime-store';
import { crmError, filterEnquiries, summarizeEnquiries, stageOf } from './crm.mjs';
export const fingerprint=value=>crypto.createHash('sha256').update(JSON.stringify([value.name,value.email,value.phone,value.service,value.message])).digest('hex');
const rowEnquiry = row => ({ ...row.data, id: Number(row.id), updatedAt: row.updated_at });
async function seed() { return JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'seed.json'), 'utf8')); }
export async function crmLocalRead() { return localRead('local-store.json', await seed()); }
export async function crmLocalMutate(fn) { return localMutate('local-store.json', await seed(), fn); }
function dbError(error) {
 if(error?.code==='23505')return crmError('This submission key was already used for different details. Start a fresh enquiry.',409);
 if(error?.code==='40001')return crmError('Someone updated this enquiry. Reload it before saving your changes.',409);
 if(error?.code==='P0002')return crmError('Enquiry not found.',404);
 return storageRequired(error);
}
export async function createEnquiry(value,requestKey,plans=[]) {
 const db=supabaseAdmin(),hash=fingerprint(value);
 if(db){const {data,error}=await db.rpc('coretax_create_enquiry',{p_data:value,p_key:requestKey,p_fingerprint:hash,p_jobs:plans});if(error)throw dbError(error);return data;}
 if(isProduction())throw storageRequired();
 return crmLocalMutate(data=>{
  data.enquiries||=[];data.jobs||=[];const previous=data.enquiries.find(i=>i._requestKey===requestKey);
  if(previous){if(previous._fingerprint!==hash)throw dbError({code:'23505'});return {enquiry:previous,duplicate:true};}
  const id=data.enquiries.reduce((n,i)=>Math.max(n,Number(i.id)||0),0)+1;
  const enquiry={...value,id,reference:'JMP-'+String(id).padStart(6,'0'),updatedAt:new Date().toISOString(),_requestKey:requestKey,_fingerprint:hash};data.enquiries.unshift(enquiry);
  for(const plan of plans)if(!data.jobs.some(j=>j.id===plan.key))data.jobs.push({id:plan.key,payload:plan.message,kind:'email',state:'pending',attempts:0,next_attempt_at:new Date().toISOString(),created_at:new Date().toISOString()});
  return {enquiry,duplicate:false};
 });
}
export async function queryEnquiries(filters,hours=48) {
 const db=supabaseAdmin();if(db){const {data,error}=await db.rpc('coretax_query_enquiries',{p_filter:filters,p_hours:Number(hours),p_now:new Date().toISOString()});if(error)throw dbError(error);return data;}
 if(isProduction())throw storageRequired();
 const {enquiries=[]}=await crmLocalRead(),items=filterEnquiries(enquiries,filters,hours).sort((a,b)=>b.id-a.id),start=(filters.page-1)*filters.pageSize;
 return {enquiries:items.slice(start,start+filters.pageSize).map(i=>{const {_requestKey,_fingerprint,...item}=i;return {...item,status:stageOf(i)};}),total:items.length,page:filters.page,pageSize:filters.pageSize,summary:summarizeEnquiries(enquiries,hours,new Date(),filters.timeZone)};
}
export async function readEnquiry(id) {
 const db=supabaseAdmin();if(db){const {data,error}=await db.from('cms_enquiries').select('id,data,updated_at').eq('id',id).maybeSingle();if(error)throw dbError(error);if(!data)throw crmError('Enquiry not found.',404);return rowEnquiry(data);}
 if(isProduction())throw storageRequired();const item=(await crmLocalRead()).enquiries?.find(i=>String(i.id)===String(id));if(!item)throw crmError('Enquiry not found.',404);return item;
}
export async function updateEnquiry(id,changes,expected,actor) {
 if(!expected||!Number.isFinite(Date.parse(expected)))throw crmError('Reload the enquiry before saving changes.',409);
 const db=supabaseAdmin();if(db){const {data,error}=await db.rpc('coretax_update_enquiry',{p_id:id,p_changes:changes,p_expected:expected,p_actor:actor});if(error)throw dbError(error);return data;}
 if(isProduction())throw storageRequired();
 return crmLocalMutate(data=>{
  const index=(data.enquiries||[]).findIndex(i=>String(i.id)===String(id));if(index<0)throw crmError('Enquiry not found.',404);
  const previous=data.enquiries[index];if(previous.updatedAt!==expected)throw dbError({code:'40001'});
  return data.enquiries[index]={...previous,...changes,activity:[{at:new Date().toISOString(),by:actor,action:'Updated '+Object.keys(changes).join(', ')},...(previous.activity||[])].slice(0,100),updatedBy:actor,updatedAt:new Date(Math.max(Date.now(),Date.parse(expected)+1)).toISOString()};
 });
}
export async function deleteEnquiry(id) {
 const db=supabaseAdmin();if(db){const {error}=await db.from('cms_enquiries').delete().eq('id',id);if(error)throw dbError(error);return;}if(isProduction())throw storageRequired();
 return crmLocalMutate(data=>{data.enquiries=(data.enquiries||[]).filter(i=>String(i.id)!==String(id));});
}
