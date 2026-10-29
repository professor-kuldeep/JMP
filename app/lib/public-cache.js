import {revalidateTag} from 'next/cache';
export function invalidatePublicContent(){revalidateTag('public-content',{expire:0});}
