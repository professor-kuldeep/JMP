import {unstable_cache} from 'next/cache';
import {cache} from 'react';
import {getSettings as freshSettings,getMenus as freshMenus,getPages as freshPages} from './store';
import {isPublicPage} from './publishing.mjs';
const cachedSettings=unstable_cache(freshSettings,['public-settings-v9'],{tags:['public-content'],revalidate:60});
const cachedMenus=unstable_cache(freshMenus,['public-menus-v9'],{tags:['public-content'],revalidate:60});
const cachedPages=unstable_cache(freshPages,['public-pages-v9'],{tags:['public-content'],revalidate:60});
const production=()=>process.env.NODE_ENV==='production';
export const getSettings=cache(()=>production()?cachedSettings():freshSettings());
export const getMenus=cache(()=>production()?cachedMenus():freshMenus());
export const listPages=cache(async()=>(await(production()?cachedPages():freshPages())).filter(p=>isPublicPage(p)).sort((a,b)=>(a.order||99)-(b.order||99)));
export async function getPageBySlug(slug){const value=String(slug||'home').replace(/^\/+|\/+$/g,'')||'home';return(await listPages()).find(p=>p.slug===value)||null;}
