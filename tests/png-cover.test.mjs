import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const api=await import('../src/png-cover.mjs').catch(()=>({}));
const scene=await readFile(new URL('../assets/scene.png',import.meta.url));
const response=(bytes,contentType)=>new Response(bytes,{headers:contentType?{'Content-Type':contentType}:{}});

test('PNG cover normalization exposes the async response-to-Blob API',()=>{
 assert.equal(typeof api.pngCoverBlob,'function');
});

for(const contentType of [undefined,'application/octet-stream','image/png','text/plain']){
 test(`the actual scene PNG survives ${contentType||'missing Content-Type'} with an explicit image/png Blob`,async()=>{
  const cover=await api.pngCoverBlob(response(scene,contentType));
  assert.ok(cover instanceof Blob);
  assert.equal(cover.type,'image/png');
  assert.equal(cover.size,scene.length);
  assert.deepEqual(Buffer.from(await cover.arrayBuffer()),scene);
 });
}

test('failed HTTP responses reject before consuming their purported image body',async()=>{
 for(const status of [404,500]){
  let consumed=false;
  const failed={ok:false,status,arrayBuffer(){consumed=true;throw Error('must not consume error pages');}};
  await assert.rejects(()=>api.pngCoverBlob(failed),new RegExp(`HTTP ${status}`));
  assert.equal(consumed,false);
 }
});

test('an image/png header cannot make HTML, SVG, JPEG or a forged PNG signature valid',async()=>{
 const candidates=[
  Buffer.from('<html>NAS error</html>'),
  Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'),
  Buffer.from([0xff,0xd8,0xff,0xd9]),
  Buffer.concat([scene.subarray(0,8),Buffer.from('<svg/>')])
 ];
 for(const bytes of candidates)await assert.rejects(()=>api.pngCoverBlob(response(bytes,'image/png')),/PNG/);
});

test('empty, signature-only, incomplete IHDR and truncated real PNGs are rejected',async()=>{
 for(const bytes of [Buffer.alloc(0),scene.subarray(0,8),scene.subarray(0,25),scene.subarray(0,scene.length-1),scene.subarray(0,scene.length-12)]){
  await assert.rejects(()=>api.pngCoverBlob(response(bytes,'image/png')),/PNG/);
 }
});

test('a damaged real PNG header or image payload cannot silently become a usable cover',async()=>{
 const header=Buffer.from(scene);header[16]^=1;
 const payload=Buffer.from(scene);
 let offset=8;
 while(offset+12<=payload.length){
  const length=payload.readUInt32BE(offset);
  if(payload.toString('ascii',offset+4,offset+8)==='IDAT'){
   assert.ok(length>0,'the real fixture has image data');
   payload[offset+8]^=1;
   break;
  }
  offset+=length+12;
 }
 assert.ok(offset+12<=payload.length,'the real fixture contains an IDAT chunk');
 for(const bytes of [header,payload])await assert.rejects(()=>api.pngCoverBlob(response(bytes)),/PNG/);
});

test('extra executable-looking content after IEND is rejected instead of preserved in a cover',async()=>{
 const mixed=Buffer.concat([scene,Buffer.from('<svg onload="alert(1)"/>')]);
 await assert.rejects(()=>api.pngCoverBlob(response(mixed,'image/png')),/PNG/);
});

test('body read failures remain actionable errors for the poster status',async()=>{
 const failed={ok:true,status:200,async arrayBuffer(){throw Error('connection interrupted');}};
 await assert.rejects(()=>api.pngCoverBlob(failed),/读取.*封面.*connection interrupted/);
});
