'use client';
import {useEffect,useState} from 'react';
export default function ServiceNavigation({items=[]}) {
 const [active,setActive]=useState('overview');
 useEffect(()=>{const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)setActive(entry.target.id);},{rootMargin:'-20% 0px -60% 0px'});for(const item of [{id:'overview'},...items]){const el=document.getElementById(item.id);if(el)observer.observe(el);}return()=>observer.disconnect();},[items]);
 return <nav className="service-section-nav" aria-label="On this page"><div className="container"><span>On this page</span><div>{[{id:'overview',label:'Overview'},...items].map(item=><a key={item.id} href={'#'+item.id} aria-current={active===item.id?'location':undefined} onClick={()=>setActive(item.id)}>{item.label}</a>)}</div></div></nav>;
}
