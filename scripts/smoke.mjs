import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url),port=4177,origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production'}});
let logs='';server.stdout.on('data',chunk=>logs+=chunk);server.stderr.on('data',chunk=>logs+=chunk);
try{
 let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw new Error(logs);try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'Production server did not start.');
 for(const [path,text] of [['/','What can we help you with?'],['/resources','Search resources'],['/gst-services','On this page'],['/contact','Submit Enquiry'],['/book-consultation','Book a consultation.'],['/booking/manage','Manage your appointment.']]){const response=await fetch(origin+path);assert.equal(response.status,200,path);assert.ok((await response.text()).includes(text),path);}
 const footerBrand=await fetch(origin+'/assets/img/footer-brand.svg');assert.equal(footerBrand.status,200);assert.ok(footerBrand.headers.get('content-type').includes('image/svg+xml'));
 const image=await fetch(origin+'/_next/image?url=%2Fassets%2Fimg%2Fhero-desk.webp&w=640&q=75',{headers:{accept:'image/webp'}});assert.equal(image.status,200,'Image optimizer');assert.ok(image.headers.get('content-type').startsWith('image/'));
 for(const path of ['/api/admin/enquiries','/api/admin/operations','/api/admin/bookings'])assert.equal((await fetch(origin+path)).status,401,path);
 const apiRoutes=JSON.parse(await fs.readFile(new URL('./api-routes.json',import.meta.url),'utf8'));
 for(const route of apiRoutes.filter(route=>route.path.startsWith('/admin/')&&!['/admin/login','/admin/insights/google/callback','/admin/insights/google/complete'].includes(route.path))){const pathname='/api'+route.path.replace(/:id\b/g,'42');for(const method of route.methods){const response=await fetch(origin+pathname,{method,headers:{origin,'Content-Type':'application/json'},...(!['GET','HEAD'].includes(method)?{body:'{}'}:{})});assert.equal(response.status,401,`${method} ${pathname}`);}}
 assert.equal((await fetch(origin+'/api/admin/enquiries/export',{method:'DELETE'})).status,405);
 assert.equal((await fetch(origin+'/api/contact')).status,405);
 assert.equal((await fetch(origin+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
 const options=await fetch(origin+'/api/contact',{method:'OPTIONS'});assert.equal(options.status,204);assert.ok(options.headers.get('allow').includes('POST'));
 assert.equal((await fetch(origin+'/api/no-such-endpoint')).status,404);
 assert.equal((await fetch(origin+'/_api/admin/me')).status,404);
 const head=await fetch(origin+'/api/health',{method:'HEAD'});assert.ok([200,503].includes(head.status));assert.equal(await head.text(),'');
 const callback=await fetch(origin+'/api/admin/insights/google/callback?error=access_denied',{redirect:'manual'});assert.ok([302,303,307].includes(callback.status));assert.equal(new URL(callback.headers.get('location')).pathname,'/admin');
 const complete=await fetch(origin+'/api/admin/insights/google/complete',{redirect:'manual'});assert.ok([302,303,307].includes(complete.status));assert.equal(new URL(complete.headers.get('location')).pathname,'/admin');
 assert.equal((await fetch(origin+'/api/maintenance')).status,401);
 console.log('Production pages, all protected API methods, route precedence, HEAD/OPTIONS, OAuth redirects and image optimization passed.');
}finally{server.kill('SIGTERM');await new Promise(resolve=>{server.once('exit',resolve);setTimeout(()=>{server.kill('SIGKILL');resolve();},3000).unref();});}
