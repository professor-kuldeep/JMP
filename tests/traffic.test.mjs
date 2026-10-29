import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {normalizeAttribution,normalizeVisitEvent,publicPath,safeCampaign,reportRange,summarizeVisits,trafficCsv,validateAnalyticsSettings} from '../app/lib/traffic.mjs';
import {sealGoogle,openGoogle,validateOAuthState,googleEnvironment} from '../app/lib/google-secrets.mjs';
import {ga4Requests,fetchGa4Report,fetchGscReport} from '../app/lib/google-reports.mjs';
import {PAGE_SERVICES,serviceContactUrl} from '../app/lib/service-links.mjs';
import {isEnquiryOverdue} from '../app/lib/publishing.mjs';
const now=new Date('2026-10-28T12:00:00Z'),range=reportRange({start:'2026-10-01',end:'2026-10-28'},now);
const context={consented:true,visitorId:crypto.randomUUID(),sessionId:crypto.randomUUID(),path:'/contact',landingPage:'/gst-services',source:'google',medium:'organic',campaign:'october',referrer:'https://www.google.com/search?q=private',device:'mobile'};
const event=(name='page_view',patch={})=>normalizeVisitEvent({...context,id:crypto.randomUUID(),name,...patch},now,true);
test('visitor ingestion excludes form contents, query strings and private pages',()=>{
 const normalized=normalizeVisitEvent({...context,id:crypto.randomUUID(),name:'page_view',email:'person@example.com',ip:'123',message:'private',path:'/contact?email=private#token',occurredAt:'1999-01-01'},now);
 assert.equal(normalized.path,'/contact');assert.equal(normalized.referrer,'www.google.com');assert.equal(normalized.occurredAt,now.toISOString());
 for(const key of ['email','ip','message','consented'])assert.equal(normalized[key],undefined);
 for(const path of ['/admin','/admin/pages','/api/contact','/reset-password','/reset-password?token=secret','//evil.test','/hello%40example.com'])assert.equal(publicPath(path),'');
 assert.equal(safeCampaign('person@example.com'),'');assert.equal(safeCampaign('999999999999'),'');
});
test('consent, valid IDs and successful-server-only enquiry events are required',()=>{
 assert.equal(normalizeAttribution({...context,consented:false}),null);assert.equal(normalizeAttribution({...context,visitorId:'fake'}),null);
 assert.throws(()=>normalizeVisitEvent({...context,id:crypto.randomUUID(),name:'generate_lead'},now));
 assert.equal(event('generate_lead').name,'generate_lead');assert.throws(()=>normalizeVisitEvent({...context,id:'fake',name:'page_view'},now));
});
test('visit summaries deduplicate events, separate visitors from visits and cap visit conversion at 100%',()=>{
 const a=event(),b=event('page_view',{path:'/gst-services'}),c=event('page_view',{sessionId:crypto.randomUUID()}),lead=event('generate_lead');
 const summary=summarizeVisits([a,a,b,c,lead,event('generate_lead'),event('consultation_click'),{...event(),occurredAt:'2026-09-30T12:00:00.000Z'}].slice(0,8),range);
 assert.equal(summary.stats.pageViews,3);assert.equal(summary.stats.visits,2);assert.equal(summary.stats.visitors,1);assert.equal(summary.stats.enquiries,2);assert.equal(summary.stats.convertedVisits,1);assert.equal(summary.stats.conversionRate,50);assert.equal(summary.stats.consultation_click,1);
 assert.equal(summary.daily.length,28);assert.equal(summary.daily.at(-1).views,3);assert.equal(summary.sources[0].label,'google / organic');
});
test('date ranges validate real calendar dates and include the whole end date',()=>{
 assert.throws(()=>reportRange({start:'2026-02-30',end:'2026-03-01'},now));assert.throws(()=>reportRange({start:'2026-10-29'},now));assert.throws(()=>reportRange({start:'2020-01-01'},now));
 assert.equal(reportRange({start:'2026-10-28',end:'2026-10-28'},now).end,'2026-10-29T00:00:00.000Z');
});
test('tracking settings distinguish measurement IDs from reporting Property IDs and accept GSC domain properties',()=>{
 validateAnalyticsSettings({ga4PropertyId:'123456789',gaMeasurementId:'G-TEST1234',gscProperty:'sc-domain:example.com',visitorRetentionDays:90});
 assert.throws(()=>validateAnalyticsSettings({ga4PropertyId:'G-TEST1234'}));assert.throws(()=>validateAnalyticsSettings({gscProperty:'javascript:alert(1)'}));assert.throws(()=>validateAnalyticsSettings({visitorRetentionDays:500}));assert.throws(()=>validateAnalyticsSettings({visitorTrackingEnabled:'yes'}));
});
test('CSV escapes spreadsheet formulas and does not contain visitor identities',()=>{
 const report=summarizeVisits([event('page_view',{source:'=HYPERLINK("bad")'})],range),csv=trafficCsv(report);
 assert.ok(csv.includes("'=HYPERLINK"));assert.ok(!csv.includes(context.visitorId));assert.ok(!csv.includes(context.sessionId));
});
test('OAuth credentials are authenticated ciphertext and state is bound to the initiating administrator and time',()=>{
 const environment={GOOGLE_TOKEN_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex')};
 assert.equal(googleEnvironment({GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:'reporting@example.test'})}).serviceAccountConfigured,false);
 assert.equal(googleEnvironment({GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:'reporting@example.test',private_key:'test-key'})}).serviceAccountConfigured,true);
 const token={refresh_token:'secret-refresh-token',access_token:'secret-access-token'},cipher=sealGoogle(token,environment);
 assert.ok(!cipher.includes(token.refresh_token));assert.deepEqual(openGoogle(cipher,environment),token);
 const parts=cipher.split('.');parts[3]=Buffer.from('tampered').toString('base64url');assert.throws(()=>openGoogle(parts.join('.'),environment));
 const state=sealGoogle({state:'expected',username:'admin',verifier:'pkce',createdAt:now.getTime()},environment);
 assert.equal(validateOAuthState(state,'expected','admin',now.getTime()+100,environment).verifier,'pkce');
 assert.throws(()=>validateOAuthState(state,'wrong','admin',now.getTime(),environment));assert.throws(()=>validateOAuthState(state,'expected','another-admin',now.getTime(),environment));assert.throws(()=>validateOAuthState(state,'expected','admin',now.getTime()+600001,environment));
});
function gaReport(dimensions,metrics,values){return {dimensionHeaders:dimensions.map(name=>({name})),metricHeaders:metrics.map(name=>({name})),rows:values.map(([d,m])=>({dimensionValues:d.map(value=>({value})),metricValues:m.map(value=>({value:String(value)}))})),metadata:{timeZone:'Asia/Kolkata'}};}
test('GA4 reporting uses read-only bearer auth and parses five reports with a separate authoritative total',async()=>{
 const request=ga4Requests(range);assert.equal(request.requests.length,5);
 const reports=[gaReport([],['activeUsers','sessions','screenPageViews','engagedSessions','userEngagementDuration','keyEvents'],[[[],[10,20,30,15,600,2]]]),gaReport(['date'],['sessions','screenPageViews','activeUsers'],[[['20261028'],[5,8,4]]]),gaReport(['pagePath'],['screenPageViews','sessions'],[[['/'],[8,5]]]),gaReport(['sessionDefaultChannelGroup','sessionSourceMedium'],['sessions','activeUsers'],[[['Organic Search','google / organic'],[5,4]]]),gaReport(['deviceCategory'],['sessions'],[[['mobile'],[5]]])];
 const report=await fetchGa4Report('123456789',range,'secret-token',async(url,options)=>{assert.ok(url.endsWith('/properties/123456789:batchRunReports'));assert.equal(options.headers.Authorization,'Bearer secret-token');assert.equal(JSON.parse(options.body).requests.length,5);return {ok:true,json:async()=>({reports})};});
 assert.equal(report.summary.sessions,20);assert.equal(report.summary.engagementRate,75);assert.equal(report.summary.averageEngagementSeconds,30);assert.equal(report.daily[0].date,'2026-10-28');assert.equal(report.timeZone,'Asia/Kolkata');
});
test('GSC uses the exact encoded property, finalized Web data, independent totals and percentage CTR',async()=>{
 let calls=0;const report=await fetchGscReport('sc-domain:example.com',range,'token',async(url,options)=>{calls++;assert.ok(url.includes('sc-domain%3Aexample.com'));const body=JSON.parse(options.body);assert.equal(body.dataState,'final');assert.equal(body.type,'web');return {ok:true,json:async()=>({rows:[{keys:body.dimensions.length?[body.dimensions[0]==='date'?'2026-10-28':'example']:[],clicks:10,impressions:100,ctr:.1,position:4.5}]})};});
 assert.equal(calls,5);assert.equal(report.summary.ctr,10);assert.equal(report.summary.position,4.5);assert.equal(report.daily[0].date,'2026-10-28');
});
test('provider errors expose setup guidance without echoing Google responses or credentials',async()=>{
 await assert.rejects(fetchGa4Report('123',range,'secret-token',async()=>({ok:false,status:403,json:async()=>({error:{message:'secret-token sensitive request'}})})),error=>error.message.includes('grant access')&&!error.message.includes('secret-token'));
});
test('service-specific contact links preserve anchors and leave unrelated destinations alone',()=>{
 assert.equal(serviceContactUrl('/contact#enquiry-form',PAGE_SERVICES['gst-services']),'/contact?service=GST+Compliance#enquiry-form');assert.equal(serviceContactUrl('/resources','GST Compliance'),'/resources');
});
test('explicit CRM follow-ups can be due for contacted enquiries and closed enquiries stay excluded',()=>{
 assert.equal(isEnquiryOverdue({status:'contacted',followUpAt:'2026-10-27T10:00:00Z'},48,now.getTime()),true);assert.equal(isEnquiryOverdue({status:'closed',followUpAt:'2026-10-27T10:00:00Z'},48,now.getTime()),false);
});
