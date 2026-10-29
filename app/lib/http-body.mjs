import {crmError} from './crm.mjs';
export async function readJsonBody(request,maxBytes=16000){
 if(!String(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))throw crmError('Use a JSON request.',415);
 if(Number(request.headers.get('content-length'))>maxBytes)throw crmError('This request is too large.',413);
 const reader=request.body?.getReader();if(!reader)throw crmError('The request is empty.');
 const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw crmError('This request is too large.',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{throw crmError('The request could not be read. Please try again.');}
}
