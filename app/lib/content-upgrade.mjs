import { createHash, randomUUID } from 'node:crypto';
import pack from '../../data/content-upgrade.json' with {type:'json'};
const placeholders = {resources:/Add monthly due dates|Upload document checklists|Publish practical guides/,careers:/This page can be used to add/};
export function contentPlan(pages) {
  const changes=[];
  for (const page of pack.pages) if (!pages.some(current=>current.slug===page.slug)) changes.push({slug:page.slug,title:page.title,action:'create',status:'draft'});
  for (const update of pack.updates) {
    const current=pages.find(page=>page.slug===update.slug);
    if (current && placeholders[update.slug].test(JSON.stringify(current.sections || []))) changes.push({slug:update.slug,title:current.title,action:'replace-placeholder',status:current.status});
  }
  return {fingerprint:createHash('sha256').update(JSON.stringify(pages)).digest('hex'),changes};
}
export function applyContentPlan(pages,revisions,username,now=new Date().toISOString()) {
  const plan=contentPlan(pages), next=structuredClone(pages), history=structuredClone(revisions);
  let id=next.reduce((max,page)=>Math.max(max,Number(page.id)||0),0);
  for (const change of plan.changes) {
    if (change.action==='create') next.push({...structuredClone(pack.pages.find(page=>page.slug===change.slug)),id:++id,status:'draft',createdAt:now,updatedAt:now,updatedBy:username});
    else {
      const index=next.findIndex(page=>page.slug===change.slug), current=next[index], key=String(current.id);
      history[key]=[{id:randomUUID(),savedAt:now,savedBy:username,page:structuredClone(current)},...(history[key] || [])].slice(0,30);
      next[index]={...current,...structuredClone(pack.updates.find(page=>page.slug===change.slug)),updatedAt:now,updatedBy:username};
    }
  }
  return {pages:next,revisions:history,changes:plan.changes};
}
