import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),port=4177,origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production'}});
let logs='';server.stdout.on('data',chunk=>logs+=chunk);server.stderr.on('data',chunk=>logs+=chunk);
try{
 let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw new Error(logs);try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'Production server did not start.');
 for(const [path,text] of [['/','What can we help you with?'],['/resources','Search resources'],['/gst-services','On this page'],['/contact','Submit Enquiry'],['/book-consultation','Book a consultation.'],['/booking/manage','Manage your appointment.']]){const response=await fetch(origin+path);assert.equal(response.status,200,path);assert.ok((await response.text()).includes(text),path);}
 const image=await fetch(origin+'/_next/image?url=%2Fassets%2Fimg%2Fhero-desk.webp&w=640&q=75',{headers:{accept:'image/webp'}});assert.equal(image.status,200,'Image optimizer');assert.ok(image.headers.get('content-type').startsWith('image/'));
 for(const path of ['/api/admin/enquiries','/api/admin/operations','/api/admin/bookings'])assert.equal((await fetch(origin+path)).status,401,path);
 assert.equal((await fetch(origin+'/api/maintenance')).status,401);
 console.log('Production routes, critical public content and private API boundaries passed.');
}finally{server.kill('SIGTERM');await new Promise(resolve=>{server.once('exit',resolve);setTimeout(()=>{server.kill('SIGKILL');resolve();},3000).unref();});}
