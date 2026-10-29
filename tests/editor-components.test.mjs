import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire, Module} from 'node:module';
import path from 'node:path';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
const dom=new JSDOM('<!doctype html><html><head><style>.public-main {color: navy}</style></head><body></body></html>',{url:'http://localhost:4173',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','HTMLTextAreaElement','Event','KeyboardEvent','MouseEvent','Node','MutationObserver'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.requestAnimationFrame=callback=>setTimeout(callback,0);
globalThis.cancelAnimationFrame=clearTimeout;
globalThis.ResizeObserver=class {constructor(callback){this.callback=callback;}observe(){this.callback([{contentRect:{width:480,height:500}}]);}disconnect(){}};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(import.meta.url);
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
after(()=>dom.window.close());
async function component(file){
 const result=await build({entryPoints:[file],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react-dom','react-dom/client','react/jsx-runtime'],loader:{'.css':'empty'},plugins:[{name:'next-test-adapter',setup(build){
  build.onResolve({filter:/^next\/(link|navigation)$/},args=>({path:args.path,namespace:'test-next'}));
  build.onLoad({filter:/.*/,namespace:'test-next'},args=>({loader:'js',contents:args.path.endsWith('navigation')?"export const usePathname=()=>'/admin';":"import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{...props,href},children);}"}));
 }}]});
 const filename=path.resolve('tests/.virtual-component.cjs'),module=new Module(filename);module.filename=filename;module.paths=Module._nodeModulePaths(path.dirname(filename));module._compile(result.outputFiles[0].text,filename);return module.exports.default;
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,15));
function select(textarea,start,end){textarea.focus();textarea.setSelectionRange(start,end);textarea.dispatchEvent(new KeyboardEvent('keyup',{key:'Shift',bubbles:true}));}
test('rendered editor toggles bold on/off repeatedly and preserves selected text',async()=>{
 const Editor=await component('app/admin/components/FormattingEditor.jsx');
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 function Harness(){const [value,setValue]=React.useState('Hello');return React.createElement(Editor,{label:'Sample editor',value,onChange:setValue});}
 await act(async()=>root.render(React.createElement(Harness)));
 const textarea=host.querySelector('textarea'),bold=host.querySelector('[aria-label="Bold"]');
 await act(async()=>select(textarea,0,5));
 for(let i=0;i<6;i++){
  await act(async()=>{bold.click();await settle();});
  assert.equal(textarea.value,i%2===0?'**Hello**':'Hello');
  assert.equal(bold.getAttribute('aria-pressed'),i%2===0?'true':'false');
 }
 await act(async()=>{root.unmount();});host.remove();
});
test('rendered editor keyboard shortcuts, undo and redo operate on the same content',async()=>{
 const Editor=await component('app/admin/components/FormattingEditor.jsx');
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 function Harness(){const [value,setValue]=React.useState('Hello');return React.createElement(Editor,{value,onChange:setValue});}
 await act(async()=>root.render(React.createElement(Harness)));
 const textarea=host.querySelector('textarea');await act(async()=>select(textarea,0,5));
 await act(async()=>{textarea.dispatchEvent(new KeyboardEvent('keydown',{key:'b',ctrlKey:true,bubbles:true,cancelable:true}));await settle();});assert.equal(textarea.value,'**Hello**');
 await act(async()=>{host.querySelector('[aria-label="Undo formatting or typing"]').click();await settle();});assert.equal(textarea.value,'Hello');
 await act(async()=>{host.querySelector('[aria-label="Redo formatting or typing"]').click();await settle();});assert.equal(textarea.value,'**Hello**');
 await act(async()=>root.unmount());host.remove();
});
test('actual preview renders all long-page sections and its Bottom control targets the document end',async()=>{
 const Preview=await component('app/admin/components/LivePagePreview.jsx');
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 const page={title:'Long preview',slug:'test',template:'default',heroTitle:'Long preview',sections:Array.from({length:40},(_,i)=>({type:'text',title:`Section ${i+1}`,text:'Content retained in the preview.'}))};
 await act(async()=>root.render(React.createElement(Preview,{page,settings:{siteName:'Preview'},device:'desktop'})));
 const frame=host.querySelector('iframe'),doc=frame.contentDocument;
 // jsdom does not parse srcdoc, so supply the browser's initial document before load.
 doc.body.innerHTML='<div id="preview-root"></div>';
 await act(async()=>{frame.dispatchEvent(new Event('load'));await settle();});
 assert.equal(doc.querySelectorAll('.section-text').length,40);
 assert.ok(doc.body.textContent.includes('Section 40'));
 assert.ok(doc.querySelector('.site-header'));assert.ok(doc.querySelector('.site-footer'));
 assert.ok(doc.head.querySelector('[data-preview-style]'));
 let jump=null;Object.defineProperty(doc.documentElement,'scrollHeight',{configurable:true,value:20000});doc.defaultView.scrollTo=value=>{jump=value;};
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Bottom').click());assert.equal(jump.top,20000);
 await act(async()=>root.render(React.createElement(Preview,{page,settings:{siteName:'Preview'},device:'mobile'})));
 assert.equal(frame.style.width,'390px');assert.equal(doc.querySelectorAll('.section-text').length,40);
 await act(async()=>root.unmount());host.remove();
});
test('rendered rich text preserves mixed bold/italic and heading levels',async()=>{
 const Editor=await component('app/admin/components/FormattingEditor.jsx');
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 function Harness(){const [value,setValue]=React.useState('Hello');return React.createElement(Editor,{value,onChange:setValue});}
 await act(async()=>root.render(React.createElement(Harness)));
 const textarea=host.querySelector('textarea');await act(async()=>select(textarea,0,5));
 for(const label of ['Bold','Italic'])await act(async()=>{host.querySelector(`[aria-label="${label}"]`).click();await settle();});
 assert.equal(textarea.value,'***Hello***');
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Preview').click());
 assert.equal(host.querySelector('.format-preview strong em')?.textContent,'Hello');
 await act(async()=>root.unmount());host.remove();
});
test('rich text renders HTML as text and can suppress nested links inside cards',async()=>{
 const Text=await component('app/components/FormattedText.jsx');
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 await act(async()=>root.render(React.createElement(Text,{text:'# Heading\n\n**Bold** and [more](/resources) <img src=x onerror=alert(1)>',allowLinks:false})));
 assert.equal(host.querySelector('h2')?.textContent,'Heading');
 assert.equal(host.querySelector('strong')?.textContent,'Bold');
 assert.equal(host.querySelector('a'),null);assert.equal(host.querySelector('img'),null);
 assert.ok(host.textContent.includes('more'));
 await act(async()=>root.unmount());host.remove();
});
