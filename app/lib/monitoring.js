import crypto from 'node:crypto';
import {supabaseAdmin} from './supabase';
import {isProduction,localMutate} from './runtime-store';
// Operational codes only. Never store request bodies, tokens or upstream error text.
export async function recordOperation(area,code,level='error',reference='') {
 const event={id:crypto.randomUUID(),area:String(area).replace(/[^a-z_-]/gi,'').slice(0,32),code:String(code).replace(/[^a-z0-9_-]/gi,'').slice(0,64),level:['error','warning','info'].includes(level)?level:'error',reference:/^[a-z0-9-]{0,64}$/i.test(reference)?reference:'',at:new Date().toISOString()};
 console[level==='error'?'error':'info'](JSON.stringify({event:event.code,area:event.area,reference:event.reference}));
 try{const db=supabaseAdmin();if(db)await db.from('cms_operations_events').insert(event);else if(!isProduction())await localMutate('operations-events.json',[],data=>{data.unshift(event);data.splice(1000);});}catch{}
 return event.id;
}
