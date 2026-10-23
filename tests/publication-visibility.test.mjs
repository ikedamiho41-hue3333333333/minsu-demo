import test from 'node:test';
import assert from 'node:assert/strict';
import * as catalog from '../src/catalog.mjs';

function workspace(){
 const w=catalog.createWorkspace(),s=w.properties['mountain-yard'].state;
 s.draft.name='商家尚未发布的整院草稿';s.draftDirty=true;
 s.threads['old-thread']={id:'old-thread',owner:'original-guest',propertyId:s.propertyId,messages:[{id:'old-message',role:'guest',body:'保留原咨询'}]};
 s.tickets['old-ticket']={id:'old-ticket',threadId:'old-thread',status:'processing',question:'保留原咨询'};
 return w;
}
const share=w=>catalog.shareUrl(w,{merchantId:'mountain',propertyId:'mountain-yard',unitId:'whole',baseUrl:'https://example.test/'});

test('a merchant can pause its whole property and invalidate its share without disabling a bedroom',()=>{
 assert.equal(typeof catalog.setPropertyVisibility,'function');
 const w=workspace(),before=structuredClone(w),link=share(w),next=catalog.setPropertyVisibility(w,'mountain','mountain-yard',false);
 assert.equal(next.properties['mountain-yard'].state.visible,false);assert.equal(catalog.resolveTarget(next,new URL(link).search).ok,false);assert.throws(()=>share(next),/暂停/);
 assert.deepEqual(next.properties['mountain-yard'].state.published.rooms,before.properties['mountain-yard'].state.published.rooms);assert.equal(next.properties['mountain-yard'].state.published.version,before.properties['mountain-yard'].state.published.version);
 assert.equal(next.revision,before.revision+1);assert.equal(next.properties['mountain-yard'].state.revision,before.properties['mountain-yard'].state.revision+1);assert.deepEqual(w,before);assert.deepEqual(next.properties['flower-yard'],before.properties['flower-yard']);
});

test('restoring a paused property preserves all drafts, original conversations and pending records',()=>{
 assert.equal(typeof catalog.setPropertyVisibility,'function');
 const w=workspace(),original=structuredClone(w.properties['mountain-yard'].state),link=share(w),paused=catalog.setPropertyVisibility(w,'mountain','mountain-yard',false),restored=catalog.setPropertyVisibility(paused,'mountain','mountain-yard',true),s=restored.properties['mountain-yard'].state;
 assert.equal(s.visible,true);assert.equal(catalog.resolveTarget(restored,new URL(link).search).ok,true);assert.equal(share(restored),link);
 for(const key of ['draft','published','threads','tickets','operations','draftDirty'])assert.deepEqual(s[key],original[key],key);
 assert.equal(s.revision,original.revision+2);assert.equal(restored.revision,w.revision+2);
 const repeated=catalog.setPropertyVisibility(restored,'mountain','mountain-yard',true);assert.equal(repeated.revision,restored.revision);
});

test('another merchant and nonboolean visibility cannot alter the current property',()=>{
 assert.equal(typeof catalog.setPropertyVisibility,'function');
 const w=workspace(),before=structuredClone(w);assert.throws(()=>catalog.setPropertyVisibility(w,'lake','mountain-yard',false),/商家/);assert.throws(()=>catalog.setPropertyVisibility(w,'mountain','missing',false),/房源/);
 for(const value of ['false',0,null,undefined])assert.throws(()=>catalog.setPropertyVisibility(w,'mountain','mountain-yard',value),/启用|展示|状态|布尔/);
 assert.deepEqual(w,before);
});
