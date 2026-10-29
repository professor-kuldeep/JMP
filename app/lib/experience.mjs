import {isPublicPage} from './publishing.mjs';
export const SERVICE_GUIDES = [
 {id:'tax',title:'Income tax',description:'Returns, tax questions and support with notices.',slug:'income-tax-services',service:'Income Tax',icon:'document',audiences:['individual','business'],documents:['PAN and relevant identification details','Previous return and acknowledgement, if available','Form 16 / 16A and income statements relevant to your query','The notice or communication, if your enquiry concerns one']},
 {id:'gst',title:'GST & indirect tax',description:'Registration, returns and GST compliance queries.',slug:'gst-services',service:'GST Compliance',icon:'briefcase',audiences:['business'],documents:['GST registration details, if already registered','Relevant sales and purchase records','Recent returns and reconciliation records, if available','A copy of any notice or specific communication']},
 {id:'accounts',title:'Accounting & bookkeeping',description:'Organised books, reconciliations and reporting.',slug:'accounting-bookkeeping',service:'Accounting / Bookkeeping',icon:'chart',audiences:['business'],documents:['Your current accounting software or records format','Recent bank statements and reconciliation status','Sales, purchase and expense records for the relevant period','Existing reports and the reporting support you need']},
 {id:'audit',title:'Audit & assurance',description:'Discuss the scope and records for your audit requirement.',slug:'audit-assurance',service:'Audit & Assurance',icon:'shield',audiences:['business'],documents:['Entity details and the audit period under discussion','Recent financial statements and trial balance, if available','An outline of accounting systems and internal controls','Relevant prior reports and correspondence']},
 {id:'setup',title:'Starting or managing a business',description:'Entity compliance and business setup coordination.',slug:'corporate-compliance',service:'Corporate Compliance',icon:'people',audiences:['business'],documents:['Existing entity details, or the business you intend to establish','Ownership and authorised representative details','Relevant registration and compliance records, if available','Your specific requirement and any known deadline']},
 {id:'advisory',title:'Business & financial advisory',description:'Reporting, planning and support for business decisions.',slug:'financial-advisory',service:'Business Advisory',icon:'chart',audiences:['individual','business'],documents:['A short outline of the decision or reporting requirement','Recent management accounts or financial statements','Relevant forecasts or business plans, if available','The outcome you want and your preferred discussion timeline']}
];
export function normalizedMenus(menus={}) {
 const map=items=>(items||[]).map(item=>['Other Services','CoreTax Services'].includes(item.label)&&item.url==='/other-services'?{...item,label:'CoreTax Services',children:item.children?.filter(c=>!['/gst-services','/income-tax-services'].includes(c.url))}:item);
 return {...menus,header:map(menus.header),footer:map(menus.footer)};
}
export function sectionAnchors(page) {
 const used=new Set(['overview']);return (page.sections||[]).map((s,index)=>{
  const base=s.type==='faq'?'faqs':s.type==='process'?'process':s.type==='cta'||s.type==='contact'?'contact':/documents|information to have ready/i.test(s.title||'')?'documents':String(s.title||s.type||'section').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64)||'section';
  let id=base;if(used.has(id))id+='-'+(index+1);used.add(id);return {id,label:base==='documents'?'Documents required':base==='faqs'?'FAQs':base==='process'?'Our process':base==='contact'?'Get in touch':s.title||'Overview',section:s};
 });
}
export function resourceCatalog(pages=[]) {
 pages=pages.filter(p=>!p.status||isPublicPage(p));
 const items=[
  {id:'first-discussion',title:'Prepare for your first discussion',text:'A practical checklist for your initial conversation with our team.',category:'Getting started',kind:'Checklist',url:'/downloads/first-discussion-checklist.txt',download:true},
  {id:'business-records',title:'Organise your business records',text:'A starting list for gathering accounting and compliance records.',category:'Business records',kind:'Checklist',url:'/downloads/business-records-checklist.txt',download:true},
  {id:'month-end',title:'Month-end preparation',text:'A simple checklist to support a consistent month-end routine.',category:'Accounting',kind:'Checklist',url:'/downloads/month-end-checklist.txt',download:true}
 ];
 for(const p of pages)if(p.template==='blog'&&!p.noIndex)items.push({id:'article-'+p.id,title:p.title,text:p.metaDescription||p.heroText||'',category:p.blogCategory||'Insights',kind:'Article',url:'/'+p.slug});
 for(const g of SERVICE_GUIDES)if(pages.some(p=>p.slug===g.slug))items.push({id:g.id,title:g.title,text:g.description,category:g.title,kind:'Service guide',url:'/'+g.slug+'#documents'});
 return items;
}
export function imagePosition(value) {const x=Number(value?.x),y=Number(value?.y);return `${Number.isFinite(x)?Math.min(100,Math.max(0,x)):50}% ${Number.isFinite(y)?Math.min(100,Math.max(0,y)):50}%`;}
export function refinePublicPage(page){
 if(page.slug!=='home')return page;
 return {...page,sections:(page.sections||[]).map(s=>s.type==='cards'?{...s,items:(s.items||[]).map(item=>item.url==='/our-services'&&['Audit & Assurance','Taxation'].includes(item.title)?{...item,url:item.title==='Taxation'?'/income-tax-services':'/audit-assurance'}:item)}:s)};
}
