import test from 'node:test';
import assert from 'node:assert/strict';
import {isPublicPage,publicationLabel,normalizePublication,isEnquiryOverdue} from '../app/lib/publishing.mjs';
import {siteOrigin,pageMetadata,structuredData,safeJson} from '../app/lib/seo.mjs';
import {selectPosts,blogHref} from '../app/lib/blog.mjs';
import {contentPlan,applyContentPlan} from '../app/lib/content-upgrade.mjs';
import {enquiryMailPlans,sendEnquiryEmails} from '../app/lib/enquiry-mail.mjs';
const now=Date.parse('2026-10-27T12:00:00Z');
test('scheduled content stays private before the time and becomes public at the boundary',()=>{
 const page={status:'published',publishAt:'2026-10-27T13:00:00Z'};
 assert.equal(isPublicPage(page,now),false);assert.equal(publicationLabel(page,now),'scheduled');
 assert.equal(isPublicPage(page,now+3600000),true);
 assert.equal(isPublicPage({...page,status:'draft'},now+7200000),false);
 assert.equal(isPublicPage({...page,publishAt:'invalid'},now),false);
});
test('publication validation rejects invalid time and status',()=>{
 assert.throws(()=>normalizePublication({status:'scheduled'}));assert.throws(()=>normalizePublication({publishAt:'not a date'}));
 assert.equal(normalizePublication({status:'draft'}).publishAt,'');
});
test('follow-up reminders exclude closed and contacted enquiries',()=>{
 const old={createdAt:new Date(now-72*3600000).toISOString()};
 assert.equal(isEnquiryOverdue(old,48,now),true);
 for(const status of ['closed','contacted'])assert.equal(isEnquiryOverdue({...old,status},48,now),false);
 assert.equal(isEnquiryOverdue({...old,createdAt:'invalid'},48,now),false);
});
test('canonical URL derives from configured origin and respects overrides',()=>{
 const page={slug:'gst-services',title:'GST Services'};
 assert.equal(pageMetadata(page,{siteUrl:'https://firm.example/'}).alternates.canonical,'https://firm.example/gst-services');
 assert.equal(pageMetadata({...page,canonicalUrl:'https://firm.example/custom'}, {siteUrl:'https://firm.example'}).alternates.canonical,'https://firm.example/custom');
 assert.equal(pageMetadata(page,{}).alternates,undefined);
 assert.equal(siteOrigin({siteUrl:'javascript:alert(1)'}),'');
 assert.equal(siteOrigin({siteUrl:'https://user:secret@example.com'}),'');
});
test('structured data contains actual firm and page information and safe JSON cannot close a script',()=>{
 const data=structuredData({slug:'article',title:'A guide',template:'blog',blogAuthor:'Firm Team'},{siteUrl:'https://firm.example',siteName:'Example Firm',phone:'123'});
 assert.equal(data[0]['@type'],'AccountingService');assert.equal(data[1].itemListElement[1].item,'https://firm.example/article');assert.equal(data[2].author['@type'],'Organization');
 assert.equal(safeJson({name:'</script><script>alert(1)</script>'}).includes('</script>'),false);
});
test('blog search, author/category filters and pagination combine and clamp safely',()=>{
 const posts=Array.from({length:23},(_,i)=>({title:'GST '+i,blogCategory:i%2?'Tax':'Accounts',blogAuthor:i%3?'Team':'Partner'}));
 assert.equal(selectPosts(posts,{page:'2'}).items.length,9);assert.equal(selectPosts(posts,{page:'999'}).page,3);
 assert.equal(selectPosts(posts,{q:'GST',category:'Tax',author:'Partner'}).total,4);
 assert.equal(selectPosts(posts,{q:'no such topic'}).total,0);assert.equal(selectPosts(posts,{page:'bad'}).page,1);
 assert.equal(blogHref({q:'tax & audit',page:2}),'/blog?q=tax+%26+audit&page=2');
});
test('content upgrade preserves custom pages and only replaces recognised placeholders',()=>{
 const pages=[{id:1,slug:'resources',title:'Resources',status:'published',sections:[{text:'Our custom resource library'}]},{id:2,slug:'careers',title:'Careers',status:'published',sections:[{text:'This page can be used to add internship openings'}]}];
 const plan=contentPlan(pages);assert.equal(plan.changes.length,7);
 const result=applyContentPlan(pages,{},'admin','2026-10-27T12:00:00Z');
 assert.deepEqual(result.pages[0],pages[0]);assert.equal(result.pages.filter(p=>p.status==='draft').length,6);
 assert.deepEqual(result.revisions['2'][0].page,pages[1]);assert.equal(contentPlan(result.pages).changes.length,0);
 assert.equal(pages.length,2);
});
const enquiry={id:3,createdAt:'2026-10-27T12:00:00Z',name:'Sample',email:'person@example.test',message:'Test enquiry',service:'Accounting'};
const environment={RESEND_API_KEY:'test-key',ENQUIRY_EMAIL_FROM:'Website <web@example.test>'};
const settings={siteName:'Example Firm',email:'team@example.test',enquiryNotificationsEnabled:true,enquiryAcknowledgementEnabled:true};
test('email plans use separate recipients and stable idempotency keys',()=>{
 const plans=enquiryMailPlans(enquiry,settings,environment);assert.equal(plans.length,2);
 assert.deepEqual(plans[0].message.to,['team@example.test']);assert.deepEqual(plans[1].message.to,['person@example.test']);
 assert.equal(plans[0].key,enquiryMailPlans(enquiry,settings,environment)[0].key);
 assert.deepEqual(enquiryMailPlans(enquiry,{},environment),[]);
});
test('email is disabled without credentials and delivery failures are contained',async()=>{
 let calls=0;
 const disabled=await sendEnquiryEmails(enquiry,settings,{},async()=>{calls++;});assert.equal(disabled.enabled,false);assert.equal(calls,0);
 const result=await sendEnquiryEmails(enquiry,settings,environment,async()=>({ok:false}));assert.equal(result.failed,2);assert.equal(result.sent,0);
 const ok=await sendEnquiryEmails(enquiry,settings,environment,async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');assert.ok(options.headers['Idempotency-Key']);return {ok:true};});assert.equal(ok.sent,2);
});
