import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createWorkspace,resolveTarget,shareUrl} from '../src/catalog.mjs';
import jsQR from './vendor/jsQR.cjs';

const api=await import('../src/share-artifacts.mjs').catch(()=>({}));
const baseUrl='https://example.com/minsu/?mobile=1#/merchant/home';
const roomTarget={merchantId:'lake',propertyId:'lake-inn',unitId:'sea-king',baseUrl};
const coverDataUrl='data:image/png;base64,'+(await readFile(new URL('../assets/scene.png',import.meta.url))).toString('base64');
function decode(artifact){
 const image=api.rasterizeQr(artifact.qrMatrix);
 assert.equal(image.data.length,image.width*image.height*4);
 const decoded=jsQR(image.data,image.width,image.height,{inversionAttempts:'dontInvert'});
 assert.ok(decoded,'the actual QR RGBA pixels must decode');
 return decoded.data;
}

test('room QR pixels genuinely decode to the exact current share URL and preserve the selected published unit',()=>{
 assert.equal(typeof api.buildShareArtifact,'function');assert.equal(typeof api.rasterizeQr,'function');
 const w=createWorkspace(),before=structuredClone(w),a=api.buildShareArtifact(w,roomTarget);
 assert.equal(decode(a),a.url);assert.equal(a.url,shareUrl(w,roomTarget));
 const url=new URL(a.url);assert.equal(url.searchParams.get('property'),'lake-inn');assert.equal(url.searchParams.get('unit'),'sea-king');assert.equal(url.searchParams.get('share'),'1');assert.equal(url.searchParams.get('mobile'),'1');assert.equal(url.hash,'#/guest/home');
 assert.equal(resolveTarget(w,url.search).unitId,'sea-king');assert.equal(a.name,'听海 · 大床房');assert.equal(a.version,1);
 assert.equal(a.propertyId,'lake-inn');assert.equal(a.unitId,'sea-king');assert.deepEqual(w,before);
 assert.ok(a.qrMatrix.length>=21);assert.ok(a.qrMatrix.every(row=>row.length===a.qrMatrix.length&&row.every(value=>typeof value==='boolean')));
 assert.equal(a.quietZone,4);assert.match(a.qrSvg,/viewBox=/);assert.match(a.qrSvg,/shape-rendering="crispEdges"/);
});

test('whole-property QR genuinely decodes as whole and never links an individual bedroom or merchant entry',()=>{
 assert.equal(typeof api.buildShareArtifact,'function');
 const a=api.buildShareArtifact(createWorkspace(),{merchantId:'mountain',propertyId:'mountain-yard',unitId:'whole',baseUrl});
 assert.equal(decode(a),a.url);assert.equal(new URL(a.url).searchParams.get('unit'),'whole');assert.doesNotMatch(a.url,/merchant/);
 assert.equal(a.name,'苍山慢住 · 松风院');assert.equal(a.coverScene,'courtyard');assert.match(a.posterSvg,/整院/);
});

test('poster reads only published descriptions and omits draft, unconfirmed perks, events and VR photography claims',()=>{
 assert.equal(typeof api.buildShareArtifact,'function');
 const w=createWorkspace(),state=w.properties['lake-inn'].state;
 state.draft.name='不应出现的草稿房源';state.draft.rooms[0].name='不应出现的草稿房间';state.draft.rooms[0].description='草稿专属承诺';
 state.published.rooms[0].description='当前公开的单间基础介绍';
 state.published.experience={recommendations:{benefits:[{name:'未确认免费早餐'}],places:[{name:'过期演出活动'}]}};
 state.published.vrLabel='不能引用的实拍宣传';
 const a=api.buildShareArtifact(w,roomTarget);
 assert.match(a.posterSvg,/当前公开的单间基础介绍/);assert.match(a.posterSvg,/V1/);
 assert.doesNotMatch(a.posterSvg,/不应出现|草稿专属|未确认免费早餐|过期演出活动|不能引用的实拍宣传|本店实拍/);
});

test('poster embeds the requested 2x2 example sprite crop and clearly labels its image identity',()=>{
 assert.equal(typeof api.buildShareArtifact,'function');
 const w=createWorkspace(),a=api.buildShareArtifact(w,{...roomTarget,coverDataUrl});
 assert.equal(a.hasCover,true);assert.equal(a.coverScene,'bedroom');assert.match(a.posterSvg,/viewBox="724 0 724 543"/);assert.match(a.posterSvg,/AI示例图|示例氛围图/);
 assert.ok(a.posterSvg.includes(coverDataUrl));assert.match(a.posterSvg,/<image[^>]+width="1448"[^>]+height="1086"/);
 assert.ok(a.posterWidth>0&&a.posterHeight>a.posterWidth);
 w.properties['lake-inn'].state.published.rooms[0].photo='kitchen';
 const kitchen=api.buildShareArtifact(w,{...roomTarget,coverDataUrl});assert.equal(kitchen.coverScene,'kitchen');assert.match(kitchen.posterSvg,/viewBox="0 543 724 543"/);
});

test('missing cover gives an explicit text fallback and unsafe or non-PNG cover URLs are rejected',()=>{
 assert.equal(typeof api.buildShareArtifact,'function');
 const w=createWorkspace(),a=api.buildShareArtifact(w,roomTarget);
 assert.equal(a.hasCover,false);assert.doesNotMatch(a.posterSvg,/<image\b/);assert.match(a.posterSvg,/封面待补充|暂无封面/);
 for(const cover of ['javascript:alert(1)','https://example.com/private.png','data:image/svg+xml,<svg onload=alert(1)>','data:image/png;base64,not-a-png'])assert.throws(()=>api.buildShareArtifact(w,{...roomTarget,coverDataUrl:cover}),/封面|PNG/);
});

test('all poster text is escaped, long text stays inside bounded lines and filenames cannot contain path separators',()=>{
 assert.equal(typeof api.buildShareArtifact,'function');
 const w=createWorkspace(),p=w.properties['lake-inn'].state.published;
 p.name='<script>property()</script>';p.rooms[0].name='../../<img onerror="bad()">测试房间'.repeat(5);p.rooms[0].description='公开介绍<&>"'.repeat(100);p.location='</text><script>alert(1)</script>';
 const a=api.buildShareArtifact(w,roomTarget);
 assert.doesNotMatch(a.posterSvg,/<script\b|<foreignObject\b|<img\b/i);
 const executableMarkup=(a.posterSvg.match(/<[^>]*>/g)||[]).map(tag=>tag.replace(/="[^"]*"/g,'=""')).join('');
 assert.doesNotMatch(executableMarkup,/\sonload=|\sonerror=/i);
 assert.match(a.posterSvg,/&lt;|&amp;/);assert.doesNotMatch(a.filename,/[\\/<>:"|?*\u0000-\u001f]/);
 assert.match(a.filename,/\.png$/);assert.ok(a.posterSvg.length<100000);
});

test('hidden, disabled, foreign and unresolved targets cannot generate share assets or mutate the workspace',()=>{
 assert.equal(typeof api.buildShareArtifact,'function');
 const w=createWorkspace(),before=structuredClone(w);
 assert.throws(()=>api.buildShareArtifact(w,{...roomTarget,merchantId:'mountain'}),/商家/);
 assert.throws(()=>api.buildShareArtifact(w,{...roomTarget,unitId:'pine-king'}),/单元|房间/);
 assert.throws(()=>api.buildShareArtifact(w,{merchantId:'qinghuan',propertyId:'qinghuan-dali',unitId:'whole',baseUrl}),/单元|房间|方式/);
 assert.deepEqual(w,before);
 w.properties['lake-inn'].state.visible=false;assert.throws(()=>api.buildShareArtifact(w,roomTarget),/暂停|展示/);
 w.properties['lake-inn'].state.visible=true;w.properties['lake-inn'].state.published.rooms[0].enabled=false;assert.throws(()=>api.buildShareArtifact(w,roomTarget),/单元|房间/);
});

test('long encoded URLs use automatic QR capacity and their pixels still decode exactly',()=>{
 assert.equal(typeof api.buildShareArtifact,'function');
 const longBase='https://example.com/'+('published-demo-'.repeat(35))+'/?mobile=1';
 const a=api.buildShareArtifact(createWorkspace(),{...roomTarget,baseUrl:longBase});
 assert.equal(decode(a),a.url);assert.ok(a.qrMatrix.length>41);assert.equal(a.quietZone,4);
 assert.throws(()=>api.rasterizeQr([[true,false],[true]]),/矩阵/);
});

test('a valid unit cannot turn an executable or local-file base URL into a shareable QR',()=>{
 const w=createWorkspace();
 for(const base of ['javascript:alert(1)','data:text/html,<script>alert(1)</script>','file:///Users/mac/private.html'])assert.throws(()=>api.buildShareArtifact(w,{...roomTarget,baseUrl:base}),/网址|链接|HTTP/);
});

test('vendored generator and test decoder retain the verified original bytes and associated licenses',async()=>{
 const files=[
  ['../src/vendor/qrcode.mjs','ea91d7118a5395289170da848b7c6758b996163bfbccf312591ab65a4911b7c0'],
  ['./vendor/jsQR.cjs','3325b0888fa4745c4e6940897d8c4f426fbaae76901fcbfe1871a04e90a51655'],
  ['../src/vendor/qrcode.LICENSE','3a850fa5f08101db6f40676c2786e10bd2cd5fff7b12ffdf1e0c434d4e49d90c'],
  ['./vendor/jsQR.LICENSE','c6596eb7be8581c18be736c846fb9173b69eccf6ef94c5135893ec56bd92ba08']
 ];
 for(const [path,hash] of files)assert.equal(createHash('sha256').update(await readFile(new URL(path,import.meta.url))).digest('hex'),hash);
});
