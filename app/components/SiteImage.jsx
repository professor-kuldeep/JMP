import Image from 'next/image';
export default function SiteImage({src,alt='',width=1200,height=900,priority=false,style,sizes='(max-width: 768px) 100vw, 50vw',...rest}) {
 // CMS images on arbitrary third-party hosts keep a safe native fallback. Trusted uploads are optimized.
 let trusted=String(src||'').startsWith('/')&&!String(src).startsWith('//');
 try{if(!trusted&&process.env.NEXT_PUBLIC_SUPABASE_URL)trusted=new URL(src).origin===new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;}catch{}
 return <Image {...rest} src={src} alt={alt} width={width} height={height} sizes={sizes} preload={priority} unoptimized={!trusted||/\.gif(?:\?|$)/i.test(src||'')} style={style}/>;
}
