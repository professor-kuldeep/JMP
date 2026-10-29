import crypto from 'crypto';
import { optimizeUpload } from '../../../lib/media-processing.mjs';
import { NextResponse } from 'next/server';
import { requirePermission } from '../../../lib/auth';
import { getMedia, nextId, saveMedia } from '../../../lib/store';
import { apiError } from '../../../lib/api-error';
import { writeSecurityAudit } from '../../../lib/security';
import { cleanText } from '../../../lib/validation';
import { supabaseAdmin, mediaBucket } from '../../../lib/supabase';
const ALLOWED_TYPES=new Set(['image/jpeg','image/png','image/webp','image/gif','application/pdf']); const MAX_BYTES=4*1024*1024;
function matchesSignature(type,bytes){const b=new Uint8Array(bytes);const ascii=(s,e)=>String.fromCharCode(...b.slice(s,e));if(type==='image/jpeg')return b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;if(type==='image/png')return[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((v,i)=>b[i]===v);if(type==='image/gif')return ascii(0,6)==='GIF87a'||ascii(0,6)==='GIF89a';if(type==='image/webp')return ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP';if(type==='application/pdf')return ascii(0,5)==='%PDF-';return false;}
export async function GET(request){try{await requirePermission(request,'media:read');return NextResponse.json({media:await getMedia()});}catch(error){return apiError(error);}}
export async function POST(request){
  try{
    const session=await requirePermission(request,'media:write',{csrf:true});
    const form=await request.formData(); const file=form.get('file');
    if(!file||typeof file.arrayBuffer!=='function')return NextResponse.json({message:'No file selected.'},{status:400});
    if(!ALLOWED_TYPES.has(file.type))return NextResponse.json({message:'Unsupported file type. Use JPG, PNG, WebP, GIF or PDF.'},{status:400});
    if(Number(file.size||0)>MAX_BYTES)return NextResponse.json({message:'File is too large. Maximum size is 4 MB.'},{status:400});
    const bytes=await file.arrayBuffer(); if(!matchesSignature(file.type,bytes))return NextResponse.json({message:'The file contents do not match the selected file type.'},{status:400});
    const db=supabaseAdmin(); if(!db)return NextResponse.json({message:'Supabase Storage is not configured.'},{status:503});
    const safeName=cleanText(file.name||'upload',180).replace(/[^a-zA-Z0-9._-]/g,'-').replace(/\.{2,}/g,'.');
    const optimized=await optimizeUpload(bytes,file.type,safeName);
    const storagePath=`coretax/${new Date().toISOString().slice(0,10)}/${Date.now()}-${crypto.randomUUID()}-${optimized.name}`;
    const {error:uploadError}=await db.storage.from(mediaBucket()).upload(storagePath,optimized.bytes,{contentType:optimized.type,upsert:false,cacheControl:'3600'});
    if(uploadError)throw uploadError;
    const {data:publicData}=db.storage.from(mediaBucket()).getPublicUrl(storagePath);
    const url=publicData?.publicUrl||'';
    const mediaList=await getMedia();
    const media={id:nextId(mediaList),name:safeName,url,storagePath,bucket:mediaBucket(),type:optimized.type,size:optimized.bytes.length,originalSize:file.size,width:optimized.width,height:optimized.height,alt:'',createdAt:new Date().toISOString(),uploadedBy:session.username};
    await saveMedia([media,...mediaList].slice(0,5000));
    await writeSecurityAudit(request,session,'media_uploaded',`media:${media.id}`,{name:safeName,type:file.type,size:file.size});
    return NextResponse.json({media});
  }catch(error){return apiError(error,'Media upload failed.');}
}
