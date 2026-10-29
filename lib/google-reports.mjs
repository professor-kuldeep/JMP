import {analyticsError} from './traffic.mjs';
function number(value){const n=Number(value);return Number.isFinite(n)?n:0;}
function rows(report){const dimensions=report?.dimensionHeaders||[],metrics=report?.metricHeaders||[];return (report?.rows||[]).map(row=>({...Object.fromEntries(dimensions.map((header,i)=>[header.name,row.dimensionValues?.[i]?.value||''])),...Object.fromEntries(metrics.map((header,i)=>[header.name,number(row.metricValues?.[i]?.value)]))}));}
export function ga4Requests(range){
 const dateRanges=[{startDate:range.startDate,endDate:range.endDate}];
 const request=(dimensions,metrics,limit='10')=>({dateRanges,dimensions:dimensions.map(name=>({name})),metrics:metrics.map(name=>({name})),limit,orderBys:dimensions[0]==='date'?[{dimension:{dimensionName:'date'}}]:[{metric:{metricName:metrics[0]},desc:true}]});
 return {requests:[request([],['activeUsers','sessions','screenPageViews','engagedSessions','userEngagementDuration','keyEvents'],'1'),request(['date'],['sessions','screenPageViews','activeUsers'],'366'),request(['pagePath'],['screenPageViews','sessions']),request(['sessionDefaultChannelGroup','sessionSourceMedium'],['sessions','activeUsers']),request(['deviceCategory'],['sessions'])]};
}
export function parseGa4(response){
 const reports=response.reports||[];if(reports.length!==5)throw analyticsError('Google returned an incomplete GA4 report.',502);
 const summary=rows(reports[0])[0]||{};
 return {summary:{activeUsers:summary.activeUsers||0,sessions:summary.sessions||0,pageViews:summary.screenPageViews||0,engagedSessions:summary.engagedSessions||0,keyEvents:summary.keyEvents||0,engagementRate:summary.sessions?summary.engagedSessions/summary.sessions*100:0,averageEngagementSeconds:summary.sessions?summary.userEngagementDuration/summary.sessions:0},daily:rows(reports[1]).map(r=>({date:r.date.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),visits:r.sessions,views:r.screenPageViews,users:r.activeUsers})),pages:rows(reports[2]),sources:rows(reports[3]),devices:rows(reports[4]),timeZone:reports[0]?.metadata?.timeZone||'GA4 property time zone',thresholded:reports.some(r=>r.metadata?.subjectToThresholding)};
}
export async function googleJson(url,token,body,fetcher=fetch){
 const response=await fetcher(url,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(12000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const status=response.status;throw analyticsError(status===401?'Google authorization expired. Reconnect your account.':status===403?'Google denied access. Enable the API and grant access to this property.':status===429?'Google reporting quota reached. Try again later.':'Google could not read the selected property. Check the Property ID and access.',status===401?401:502,'GOOGLE_REPORT');}
 return data;
}
export async function fetchGa4Report(property,range,token,fetcher=fetch){if(!/^[1-9]\d{0,14}$/.test(String(property)))throw analyticsError('Enter the numeric GA4 Property ID.');return parseGa4(await googleJson('https://analyticsdata.googleapis.com/v1beta/properties/'+property+':batchRunReports',token,ga4Requests(range),fetcher));}
export async function fetchGscReport(property,range,token,fetcher=fetch){
 const url='https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(property)+'/searchAnalytics/query';
 const dimensions=[[],['date'],['query'],['page'],['device']];
 const reports=await Promise.all(dimensions.map(d=>googleJson(url,token,{startDate:range.startDate,endDate:range.endDate,dimensions:d,type:'web',dataState:'final',rowLimit:d[0]==='date'?366:d.length?20:1},fetcher)));
 const value=row=>({clicks:number(row?.clicks),impressions:number(row?.impressions),ctr:number(row?.ctr)*100,position:number(row?.position)});
 const group=index=>(reports[index].rows||[]).map(row=>({label:row.keys?.[0]||'',...value(row)}));
 return {summary:value(reports[0].rows?.[0]),daily:group(1).sort((a,b)=>a.label.localeCompare(b.label)).map(r=>({...r,date:r.label})),queries:group(2),pages:group(3),devices:group(4),timeZone:'America/Los_Angeles',dataState:'final'};
}
