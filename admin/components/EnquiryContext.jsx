'use client';
import {useEffect,useId,useState} from 'react';
export default function EnquiryContext({item,onUpdate}){
 const id=useId(),[owner,setOwner]=useState(item.assignedTo||''),[followUp,setFollowUp]=useState(localValue(item.followUpAt));
 useEffect(()=>setOwner(item.assignedTo||''),[item.assignedTo]);
 useEffect(()=>setFollowUp(localValue(item.followUpAt)),[item.followUpAt]);
 function localValue(value){if(!value)return '';const date=new Date(value);return Number.isFinite(date.getTime())?new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16):'';}
 return <div className="enquiry-attribution"><strong>{item.attribution?`${item.attribution.source} / ${item.attribution.medium}`:'Not attributed'}</strong>{item.attribution&&<><small className="small" title={item.attribution.landingPage}>Entry: {item.attribution.landingPage}</small>{item.attribution.campaign&&<small className="small">Campaign: {item.attribution.campaign}</small>}</>}<label htmlFor={id+'owner'}>Assigned team member</label><input id={id+'owner'} value={owner} maxLength={120} placeholder="Assign a team member" onChange={e=>setOwner(e.target.value)} onBlur={()=>{if(owner!==(item.assignedTo||''))onUpdate({assignedTo:owner});}}/><label htmlFor={id+'follow'}>Next follow-up</label><input id={id+'follow'} type="datetime-local" value={followUp} onChange={e=>setFollowUp(e.target.value)} onBlur={()=>{const next=followUp?new Date(followUp).toISOString():'';if(next!==(item.followUpAt||''))onUpdate({followUpAt:next});}}/>{item.activity?.length>0&&<details><summary className="small">Activity ({item.activity.length})</summary>{item.activity.slice(0,5).map((event,i)=><p key={i} className="small">{event.action} · {event.by} · {new Date(event.at).toLocaleString()}</p>)}</details>}</div>;
}
