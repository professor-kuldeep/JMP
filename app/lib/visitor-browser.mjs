import {normalizeAttribution,publicPath,safeCampaign,referrerHost} from './traffic.mjs';
const VISITOR_KEY='jmp-visitor-v1',SESSION_KEY='jmp-visit-v1';
let memoryVisitor=null,memorySession=null;
function read(storage,key){try{return JSON.parse(storage.getItem(key));}catch{return null;}}
function write(storage,key,value){try{storage.setItem(key,JSON.stringify(value));}catch{}}
export function clearVisitorContext(){memoryVisitor=null;memorySession=null;try{window.localStorage.removeItem(VISITOR_KEY);window.sessionStorage.removeItem(SESSION_KEY);}catch{}}
export function visitorContext(now=Date.now()){
  if(typeof window==='undefined'||!window.__jmpVisitTrackingReady||!window.crypto?.randomUUID||window.navigator.globalPrivacyControl===true||window.navigator.doNotTrack==='1')return null;
  const path=publicPath(window.location.pathname);if(!path)return null;
  let local,session;try{local=window.localStorage;session=window.sessionStorage;}catch{}
  let visitor=read(local,VISITOR_KEY)||memoryVisitor;if(!visitor||visitor.expiresAt<now)visitor={id:window.crypto.randomUUID(),expiresAt:now+90*86400000};memoryVisitor=visitor;write(local,VISITOR_KEY,visitor);
  let visit=read(session,SESSION_KEY)||memorySession;
  if(!visit||now-visit.lastActive>30*60000){const params=new URLSearchParams(window.location.search),host=referrerHost(document.referrer||''),external=host&&host!==window.location.hostname;visit={id:window.crypto.randomUUID(),landingPage:path,source:safeCampaign(params.get('utm_source'),external?host:'direct'),medium:safeCampaign(params.get('utm_medium'),external?'referral':'none'),campaign:safeCampaign(params.get('utm_campaign')),referrer:external?host:'',lastActive:now};}
  visit.lastActive=now;memorySession=visit;write(session,SESSION_KEY,visit);
  return normalizeAttribution({consented:true,visitorId:visitor.id,sessionId:visit.id,path,...visit,device:window.innerWidth<=560?'mobile':window.innerWidth<=1100?'tablet':'desktop'});
}
export function sendVisit(name){const context=visitorContext();if(!context)return;const body=JSON.stringify({...context,id:window.crypto.randomUUID(),name});fetch('/api/analytics/collect',{method:'POST',headers:{'Content-Type':'application/json'},body,credentials:'omit',keepalive:true}).catch(()=>{});}
