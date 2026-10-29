import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {optimizeUpload} from '../app/lib/media-processing.mjs';
test('uploaded photos are resized, metadata is removed and a responsive WebP source is produced',async()=>{const original=await sharp({create:{width:3000,height:2250,channels:3,background:'#27445b'}}).jpeg().withMetadata().toBuffer(),result=await optimizeUpload(original,'image/jpeg','photo.jpg'),info=await sharp(result.bytes).metadata();assert.equal(result.type,'image/webp');assert.equal(result.name,'photo.webp');assert.equal(result.width,2400);assert.equal(result.height,1800);assert.equal(info.exif,undefined);assert.ok(result.bytes.length<original.length);});
test('PDF and animated GIF uploads retain their bytes and corrupt images are rejected',async()=>{const pdf=Buffer.from('%PDF-1.4 test'),gif=Buffer.from('GIF89a test');assert.deepEqual((await optimizeUpload(pdf,'application/pdf','test.pdf')).bytes,pdf);assert.deepEqual((await optimizeUpload(gif,'image/gif','test.gif')).bytes,gif);await assert.rejects(()=>optimizeUpload(Buffer.from('invalid'),'image/jpeg','bad.jpg'),/could not be processed/);});
