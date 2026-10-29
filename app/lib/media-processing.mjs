import sharp from 'sharp';
export async function optimizeUpload(bytes,type,name) {
 const input=Buffer.from(bytes);
 if(type==='application/pdf'||type==='image/gif')return {bytes:input,type,name,width:null,height:null};
 try {
  const pipeline=sharp(input,{limitInputPixels:40_000_000,failOn:'error'}).rotate(),metadata=await pipeline.metadata();
  const {data,info}=await pipeline.resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:84,effort:4}).toBuffer({resolveWithObject:true});
  return {bytes:data,type:'image/webp',name:name.replace(/\.[^.]+$/,'')+'.webp',width:info.width||metadata.width,height:info.height||metadata.height};
 }catch{throw Object.assign(new Error('The image could not be processed. Use a valid image under 40 megapixels.'),{status:400});}
}
