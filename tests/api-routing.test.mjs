import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createApiDispatcher,matchApiRoute} from '../app/lib/api-routing.mjs';
import {prepareApiRoutes} from '../scripts/prepare-api-routes.mjs';
import {checkFunctionBudget} from '../scripts/check-function-budget.mjs';
const context=parts=>({params:Promise.resolve({path:parts})});
test('every existing public API pattern maps to one preserved module and supported methods',async()=>{
 const manifest=JSON.parse(await fs.readFile(new URL('../scripts/api-routes.json',import.meta.url),'utf8'));
 assert.equal(manifest.length,46);assert.equal(new Set(manifest.map(r=>r.path)).size,46);
 const routes=manifest.map(entry=>({path:entry.path,handlers:Object.fromEntries(entry.methods.map(method=>[method,async(request,{params})=>Response.json({file:entry.file,params:await params,method:request.method})]))})),dispatch=createApiDispatcher(routes);
 for(const entry of manifest){const parts=entry.path.split('/').filter(Boolean).map(v=>v.startsWith(':')?'42':v);for(const method of entry.methods){const response=await dispatch(new Request('https://firm.example/api/'+parts.join('/'),{method}),context(parts));assert.equal(response.status,200);const body=await response.json();assert.equal(body.file,entry.file);assert.equal(body.method,method);if(entry.path.includes(':id'))assert.equal(body.params.id,'42');}}
});
test('static endpoints cannot fall through to a dynamic update or deletion handler',async()=>{
 let deleted=false;const dispatch=createApiDispatcher([{path:'/admin/enquiries/:id',handlers:{DELETE:async()=>{deleted=true;return Response.json({});}}},{path:'/admin/enquiries/export',handlers:{GET:async()=>new Response('CSV')}}]);
 const response=await dispatch(new Request('https://firm.example/api/admin/enquiries/export',{method:'DELETE'}),context(['admin','enquiries','export']));assert.equal(response.status,405);assert.ok(response.headers.get('allow').includes('GET'));assert.equal(deleted,false);assert.equal((await dispatch(new Request('https://firm.example/api/missing'),context(['missing']))).status,404);
});
test('dispatch preserves the original request, multipart bodies, headers and decoded dynamic parameters',async()=>{
 const form=new FormData();form.append('file',new Blob(['test upload'],{type:'text/plain'}),'test.txt');const request=new Request('https://firm.example/api/upload/a%2Fb?test=1',{method:'POST',headers:{'x-csrf-token':'original','cookie':'session=test'},body:form});
 const dispatch=createApiDispatcher([{path:'/upload/:id',handlers:{POST:async(incoming,{params})=>{assert.equal(incoming,request);assert.equal(incoming.headers.get('x-csrf-token'),'original');assert.equal(incoming.headers.get('cookie'),'session=test');assert.equal(new URL(incoming.url).search,'?test=1');const body=await incoming.formData();return Response.json({id:(await params).id,content:await body.get('file').text()});}}}]);
 assert.deepEqual(await(await dispatch(request,context(['upload','a/b']))).json(),{id:'a/b',content:'test upload'});
});
test('OPTIONS is automatic and HEAD preserves status and cookies while omitting the body',async()=>{
 const dispatch=createApiDispatcher([{path:'/session',handlers:{GET:async()=>new Response('private body',{status:200,headers:{'set-cookie':'session=test; HttpOnly; SameSite=Strict; Path=/','cache-control':'private, no-store'}}),POST:async()=>Response.json({})}}]);
 const options=await dispatch(new Request('https://firm.example/api/session',{method:'OPTIONS'}),context(['session']));assert.equal(options.status,204);assert.equal(options.headers.get('allow'),'GET, HEAD, POST, OPTIONS');
 const head=await dispatch(new Request('https://firm.example/api/session',{method:'HEAD'}),context(['session']));assert.equal(head.status,200);assert.equal(await head.text(),'');assert.ok(head.headers.get('set-cookie').includes('HttpOnly'));assert.equal(head.headers.get('cache-control'),'private, no-store');
});
test('API migration preserves known upload leftovers and refuses custom files before moving anything',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'jmp-api-guard-')),code='export async function GET(){return new Response("ok")}\n',sha=crypto.createHash('sha256').update(code).digest('hex');
 await fs.mkdir(path.join(root,'scripts'),{recursive:true});await fs.mkdir(path.join(root,'app/api/health'),{recursive:true});await fs.mkdir(path.join(root,'app/_api/health'),{recursive:true});await fs.writeFile(path.join(root,'scripts/api-routes.json'),JSON.stringify([{path:'/health',file:'health/route.js',legacySha256:sha,methods:['GET']}]));await fs.writeFile(path.join(root,'app/_api/health/route.js'),code);await fs.writeFile(path.join(root,'app/api/health/route.js'),code);
 const result=await prepareApiRoutes(root);assert.equal(result.legacyFilesPreserved,1);await assert.rejects(()=>fs.access(path.join(root,'app/api/health/route.js')));const saved=await fs.readdir(path.join(root,'app/_api-migration-backup/health'));assert.equal(await fs.readFile(path.join(root,'app/_api-migration-backup/health',saved[0]),'utf8'),code);assert.ok((await fs.readFile(path.join(root,'app/_api/registry.js'),'utf8')).includes("'./health/route.js'"));
 await fs.writeFile(path.join(root,'app/api/health/route.js'),code+'// custom change\n');await assert.rejects(()=>prepareApiRoutes(root),/Custom or unknown API/);assert.ok((await fs.readFile(path.join(root,'app/api/health/route.js'),'utf8')).includes('custom change'));assert.equal((await prepareApiRoutes(root).catch(()=>({preserved:true}))).preserved,true);
});
test('build budget rejects extra API routes and excess application entry points',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'jmp-route-budget-')),file=path.join(root,'.next/server/app-paths-manifest.json');await fs.mkdir(path.dirname(file),{recursive:true});
 await fs.writeFile(file,JSON.stringify({'/api/[...path]/route':'api/route.js','/page':'page.js'}));assert.equal((await checkFunctionBudget(root)).appRouterEntries,2);
 await fs.writeFile(file,JSON.stringify({'/api/[...path]/route':'api/route.js','/api/old/route':'old.js'}));await assert.rejects(()=>checkFunctionBudget(root),/exactly one/);
 const tooMany=Object.fromEntries(Array.from({length:12},(_,i)=>['/page-'+i+'/page','page.js']));tooMany['/api/[...path]/route']='api/route.js';await fs.writeFile(file,JSON.stringify(tooMany));await assert.rejects(()=>checkFunctionBudget(root),/budget exceeded/);
});
