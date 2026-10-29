export const ANALYTICS_KEYS=['visitorTrackingEnabled','visitorRetentionDays','gaMeasurementId','analyticsEnabled','ga4PropertyId','gscProperty','googleConnectionMode'];
export const CLIENT_EVENTS=['page_view','consultation_click','telephone_click','email_click','resource_download'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function analyticsError(message,status=400,code='ANALYTICS_ERROR'){return Object.assign(new Error(message),{status,code});}
export function safeCampaign(value,fallback=''){const text=String(value||'').trim().slice(0,100);return !text||/@|[\u0000-\u001f<>]|\d{9,}/.test(text)?fallback:text;}
export function publicPath(value){
  const raw=String(value||'').split(/[?#]/)[0];if(!raw.startsWith('/')||raw.startsWith('//')||raw.length>240)return '';
  let decoded;try{decoded=decodeURIComponent(raw);}catch{return '';}
  return /^\/(admin|api|reset-password)(\/|$)/i.test(decoded)||/[@<>\\\u0000-\u0020]|\d{12,}/.test(decoded)?'':raw;
}
export function referrerHost(value){try{const url=new URL(value.includes('://')?value:'https://'+value);return /^https?:$/.test(url.protocol)&&!url.username&&!url.password?url.hostname.slice(0,160):'';}catch{return '';}}
export function normalizeAttribution(value){
  if(!value||value.consented!==true||!UUID.test(value.visitorId||'')||!UUID.test(value.sessionId||''))return null;
  const path=publicPath(value.path),landingPage=publicPath(value.landingPage);if(!path||!landingPage)return null;
  return {consented:true,visitorId:value.visitorId,sessionId:value.sessionId,path,landingPage,source:safeCampaign(value.source,'direct'),medium:safeCampaign(value.medium,'none'),campaign:safeCampaign(value.campaign),referrer:referrerHost(String(value.referrer||'')),device:['mobile','tablet','desktop'].includes(value.device)?value.device:'desktop'};
}
export function normalizeVisitEvent(payload,now=new Date(),allowLead=false){
  const attribution=normalizeAttribution(payload);
  if(!attribution||!UUID.test(payload.id||'')||![...CLIENT_EVENTS,...(allowLead?['generate_lead']:[])].includes(payload.name))throw analyticsError('Invalid analytics event.');
  const {consented,...data}=attribution;return {id:payload.id,name:payload.name,occurredAt:now.toISOString(),...data};
}
export function analyticsConfig(settings={}){return {visitorTrackingEnabled:settings.visitorTrackingEnabled!==false,visitorRetentionDays:Number(settings.visitorRetentionDays)||90,analyticsEnabled:Boolean(settings.analyticsEnabled),gaMeasurementId:settings.gaMeasurementId||'',ga4PropertyId:settings.ga4PropertyId||'',gscProperty:settings.gscProperty||'',googleConnectionMode:settings.googleConnectionMode||'oauth'};}
export function validateAnalyticsSettings(settings){
  for(const key of ['visitorTrackingEnabled','analyticsEnabled'])if(settings[key]!=null&&typeof settings[key]!=='boolean')throw analyticsError('Tracking must be enabled or disabled.');
  if(settings.visitorRetentionDays!=null&&(!Number.isInteger(Number(settings.visitorRetentionDays))||Number(settings.visitorRetentionDays)<30||Number(settings.visitorRetentionDays)>365))throw analyticsError('Visitor retention must be between 30 and 365 days.');
  if((settings.analyticsEnabled||settings.gaMeasurementId)&&!/^G-[A-Z0-9]{4,20}$/.test(settings.gaMeasurementId||''))throw analyticsError('Enter a valid GA4 measurement ID, such as G-XXXXXXXXXX.');
  if(settings.ga4PropertyId&&!/^[1-9]\d{0,14}$/.test(String(settings.ga4PropertyId)))throw analyticsError('GA4 reporting requires the numeric Property ID, not the G- measurement ID.');
  if(settings.googleConnectionMode&&!['oauth','service_account'].includes(settings.googleConnectionMode))throw analyticsError('Choose a supported Google connection method.');
  if(settings.gscProperty){const property=String(settings.gscProperty);if(!/^sc-domain:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(property)){let url;try{url=new URL(property);}catch{throw analyticsError('Use the exact GSC property: sc-domain:example.com or https://example.com/.');}if(!/^https?:$/.test(url.protocol)||url.username||url.password||url.search||url.hash||property.length>1000)throw analyticsError('Enter a valid GSC domain or URL-prefix property.');}}
  return settings;
}
export function reportRange(input={},now=new Date()){
  const today=now.toISOString().slice(0,10),defaultStart=new Date(Date.parse(today)-27*86400000).toISOString().slice(0,10),startDate=String(input.start||defaultStart),endDate=String(input.end||today);
  const valid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  if(!valid(startDate)||!valid(endDate)||startDate>endDate||endDate>today||Date.parse(endDate)-Date.parse(startDate)>365*86400000)throw analyticsError('Choose a valid date range of up to 366 days ending today or earlier.');
  return {startDate,endDate,start:startDate+'T00:00:00.000Z',end:new Date(Date.parse(endDate)+86400000).toISOString()};
}
export function summarizeVisits(events,range){
  const unique=new Set(),views=[],leads=[],clicks={consultation_click:0,telephone_click:0,email_click:0,resource_download:0};
  for(const event of events){if(unique.has(event.id)||event.occurredAt<range.start||event.occurredAt>=range.end)continue;unique.add(event.id);if(event.name==='page_view')views.push(event);else if(event.name==='generate_lead')leads.push(event);else if(event.name in clicks)clicks[event.name]++;}
  const sessions=new Set(views.map(e=>e.sessionId)),visitors=new Set(views.map(e=>e.visitorId)),converted=new Set(leads.filter(e=>sessions.has(e.sessionId)).map(e=>e.sessionId));
  function group(key){const rows=new Map();function row(event){const label=key(event);if(!rows.has(label))rows.set(label,{label,views:0,sessions:new Set(),enquiries:0});return rows.get(label);}for(const event of views){const item=row(event);item.views++;item.sessions.add(event.sessionId);}for(const event of leads)row(event).enquiries++;return [...rows.values()].map(({sessions,...item})=>({...item,visits:sessions.size})).sort((a,b)=>b.views-a.views||b.enquiries-a.enquiries).slice(0,20);}
  const daily=new Map();for(let day=Date.parse(range.startDate);day<Date.parse(range.end);day+=86400000){const date=new Date(day).toISOString().slice(0,10);daily.set(date,{date,views:0,sessions:new Set(),enquiries:0});}
  for(const event of views){const day=daily.get(event.occurredAt.slice(0,10));if(day){day.views++;day.sessions.add(event.sessionId);}}for(const event of leads){const day=daily.get(event.occurredAt.slice(0,10));if(day)day.enquiries++;}
  return {stats:{pageViews:views.length,visits:sessions.size,visitors:visitors.size,enquiries:leads.length,convertedVisits:converted.size,conversionRate:sessions.size?converted.size/sessions.size*100:0,...clicks},daily:[...daily.values()].map(({sessions,...day})=>({...day,visits:sessions.size})),pages:group(e=>e.path),landingPages:group(e=>e.landingPage),sources:group(e=>e.source+' / '+e.medium),campaigns:group(e=>e.campaign||'(no campaign)'),devices:group(e=>e.device),recent:views.slice().sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)).slice(0,15).map(({path,occurredAt,source,device})=>({path,occurredAt,source,device}))};
}
export function csvCell(value){const text=String(value??'');return '"'+(/^[=+\-@\t\r]/.test(text)?"'"+text:text).replace(/"/g,'""')+'"';}
export function trafficCsv(report){const rows=[['Section','Label','Visits','Page views','Enquiries'],...report.daily.map(r=>['Daily',r.date,r.visits,r.views,r.enquiries]),...report.sources.map(r=>['Source',r.label,r.visits,r.views,r.enquiries]),...report.landingPages.map(r=>['Landing page',r.label,r.visits,r.views,r.enquiries])];return '\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');}
