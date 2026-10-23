import test from 'node:test';
import assert from 'node:assert/strict';
import * as catalog from '../src/catalog.mjs';
import {dispatch} from '../src/model.mjs';
import {upgradeExperience} from '../src/experience.mjs';

const roomInput={name:'试点一号房',type:'大床房',floor:'一楼',area:'约26㎡',beds:'1张1.8米床',capacity:'建议2人',bath:'独立卫浴',photo:'bedroom',description:'独立测试房间',facilities:['空调','独立卫浴'],enabled:true};
const marked=()=>{
 const w=upgradeExperience(catalog.createWorkspace());
 w.properties['lake-inn'].state.draft.experience.confirmation={status:'confirmed',by:'演示操作者（测试）',at:'2026-10-23'};
 return w;
};

test('v0.5 empty property creation keeps entered facts in draft and leaves a non-shareable public empty state',()=>{
 assert.equal(typeof catalog.createProperty,'function');
 const w=marked(),before=structuredClone(w);
 const next=catalog.createProperty(w,'qinghuan',{name:'独立测试试点',location:'待确认的测试地址',rentalMode:'whole'});
 const pid=next.lastCreatedPropertyId,p=next.properties[pid];
 assert.match(pid,/^[0-9a-f-]{36}$/i);assert.equal(p.merchantId,'qinghuan');
 assert.equal(p.state.propertyId,pid);assert.equal(p.state.draft.name,'独立测试试点');assert.equal(p.state.draft.location,'待确认的测试地址');
 assert.equal(p.state.draft.rentalMode,'whole');assert.equal(p.state.draft.experience.dataIdentity,'测试资料');
 assert.deepEqual(p.state.draft.rooms,[]);assert.deepEqual(p.state.draft.spaces,[]);assert.deepEqual(p.state.draft.facts,{});
 assert.equal(p.state.draft.vrKind,'reference');assert.match(p.state.draft.vrDescription,/参考|待/);
 assert.equal(p.rentalMode,'pending');assert.equal(p.state.published.profilePending,true);assert.equal(p.state.published.version,0);
 assert.notEqual(p.state.published.name,'独立测试试点');assert.notEqual(p.state.published.location,'待确认的测试地址');
 assert.deepEqual(p.state.published.rooms,[]);assert.deepEqual(p.state.published.facts,{});
 assert.deepEqual(catalog.shareUnits(next,pid),[]);assert.equal(p.state.draftDirty,true);
 assert.deepEqual(w,before);assert.deepEqual(next.properties['qinghuan-dali'],before.properties['qinghuan-dali']);
});

test('new property rejects missing ownership and invalid identity fields without changing existing data',()=>{
 assert.equal(typeof catalog.createProperty,'function');
 const w=marked(),before=structuredClone(w);
 for(const [merchantId,input] of [['missing',{name:'新房源',location:'测试地址'}],['lake',{name:' ',location:'测试地址'}],['lake',{name:'新房源',location:' '}],['lake',{name:'新房源',location:'测试地址',rentalMode:'shared'}]])assert.throws(()=>catalog.createProperty(w,merchantId,input));
 assert.deepEqual(w,before);
});

test('adding rooms gives independent stable identities and invalidates only the edited property draft confirmation',()=>{
 assert.equal(typeof catalog.createRoom,'function');
 const w=marked(),before=structuredClone(w),first=catalog.createRoom(w,'lake','lake-inn',{...roomInput,id:'sea-twin'});
 const created=first.properties['lake-inn'].state.draft.rooms.at(-1),second=catalog.createRoom(first,'lake','lake-inn',roomInput);
 assert.match(created.id,/^[0-9a-f-]{36}$/i);assert.notEqual(created.id,'sea-twin');assert.notEqual(created.id,second.properties['lake-inn'].state.draft.rooms.at(-1).id);
 assert.equal(first.lastCreatedRoomId,created.id);assert.deepEqual(created.facilities,['空调','独立卫浴']);
 assert.equal(first.properties['lake-inn'].state.draft.experience.confirmation.status,'pending');assert.equal(first.properties['lake-inn'].state.draftDirty,true);
 assert.deepEqual(first.properties['lake-inn'].state.published,before.properties['lake-inn'].state.published);
 assert.deepEqual(first.properties['mountain-yard'],before.properties['mountain-yard']);assert.deepEqual(w,before);
});

test('room edits preserve id, retain unspecified details and cannot modify another merchant or unknown room',()=>{
 assert.equal(typeof catalog.saveRoom,'function');
 const w=marked(),before=structuredClone(w),next=catalog.saveRoom(w,'lake','lake-inn','sea-king',{name:'改名测试房',enabled:false,id:'overwrite'});
 const room=next.properties['lake-inn'].state.draft.rooms.find(r=>r.id==='sea-king');
 assert.equal(room.name,'改名测试房');assert.equal(room.enabled,false);assert.equal(room.beds,before.properties['lake-inn'].state.draft.rooms[0].beds);
 assert.equal(next.properties['lake-inn'].state.draft.experience.confirmation.status,'pending');
 assert.deepEqual(next.properties['lake-inn'].state.published,before.properties['lake-inn'].state.published);
 assert.throws(()=>catalog.saveRoom(w,'mountain','lake-inn','sea-king',{name:'错商家'}),/商家/);
 assert.throws(()=>catalog.saveRoom(w,'lake','lake-inn','pine-king',{name:'错房间'}),/房间/);
 assert.throws(()=>catalog.saveRoom(w,'lake','lake-inn','sea-king',{name:' '}));assert.deepEqual(w,before);
});

test('spaces are created from an empty draft and updates cannot invent or reuse a foreign id',()=>{
 assert.equal(typeof catalog.saveSpace,'function');
 const w=marked(),before=structuredClone(w),first=catalog.saveSpace(w,'lake','lake-inn',null,{name:'测试茶室',key:'environment',description:'先确认可用时间',enabled:true,id:'reused'});
 const space=first.properties['lake-inn'].state.draft.spaces[0];
 assert.match(space.id,/^[0-9a-f-]{36}$/i);assert.equal(first.lastCreatedSpaceId,space.id);assert.notEqual(space.id,'reused');
 const next=catalog.saveSpace(first,'lake','lake-inn',space.id,{name:'测试茶室改名',enabled:false});
 assert.equal(next.properties['lake-inn'].state.draft.spaces[0].id,space.id);assert.equal(next.properties['lake-inn'].state.draft.spaces[0].enabled,false);
 assert.equal(next.properties['lake-inn'].state.draft.spaces[0].description,'先确认可用时间');
 assert.deepEqual(next.properties['lake-inn'].state.published,before.properties['lake-inn'].state.published);
 assert.throws(()=>catalog.saveSpace(first,'lake','lake-inn','missing',{name:'错空间'}),/空间/);
 assert.throws(()=>catalog.saveSpace(first,'mountain','lake-inn',space.id,{name:'错商家'}),/商家/);
 assert.deepEqual(w,before);
});

test('draft rental mode changes do not invalidate a currently published share until publication',()=>{
 assert.equal(typeof catalog.setDraftRentalMode,'function');
 const w=marked(),before=structuredClone(w),next=catalog.setDraftRentalMode(w,'lake','lake-inn','whole');
 assert.equal(next.properties['lake-inn'].state.draft.rentalMode,'whole');assert.equal(next.properties['lake-inn'].rentalMode,'room');
 assert.equal(next.properties['lake-inn'].state.draftDirty,true);assert.equal(next.properties['lake-inn'].state.draft.experience.confirmation.status,'pending');
 assert.equal(catalog.resolveTarget(next,'?property=lake-inn&unit=sea-king&share=1').ok,true);
 assert.deepEqual(next.properties['lake-inn'].state.published,before.properties['lake-inn'].state.published);
 assert.throws(()=>catalog.setDraftRentalMode(w,'mountain','lake-inn','whole'),/商家/);
 assert.throws(()=>catalog.setDraftRentalMode(w,'lake','lake-inn','unknown'));assert.deepEqual(w,before);
 const pending=catalog.setDraftRentalMode(next,'lake','lake-inn','pending');assert.equal(pending.properties['lake-inn'].state.draft.rentalMode,'pending');
});

test('replacing a published state switches share scope atomically and rejects the previous unit',()=>{
 const w=marked(),nextState=structuredClone(w.properties['lake-inn'].state);
 nextState.draft.rentalMode='whole';nextState.draft.wholeCapacity='建议4人入住';
 const ctx={role:'merchant',sessionId:'catalog-publish-test'};
 const confirmed=dispatch(nextState,{type:'CONFIRM_DRAFT',by:'Codex（独立测试操作者）',sourceLabel:'catalog-v05独立测试资料',confirmTestContent:true},ctx);
 const published=dispatch(confirmed,{type:'PUBLISH'},ctx),next=catalog.replaceProperty(w,'lake-inn',published);
 assert.equal(next.properties['lake-inn'].rentalMode,'whole');assert.deepEqual(catalog.shareUnits(next,'lake-inn').map(unit=>unit.id),['whole']);
 assert.equal(catalog.resolveTarget(next,'?property=lake-inn&unit=sea-king&share=1').ok,false);
 assert.equal(catalog.resolveTarget(next,'?property=lake-inn&unit=whole&share=1').ok,false);
 const currentLink=catalog.shareUrl(next,{merchantId:'lake',propertyId:'lake-inn',unitId:'whole',baseUrl:'https://example.test/'});
 assert.equal(catalog.resolveTarget(next,new URL(currentLink).search).ok,true);
});

test('disabled rooms stop resolving after publication and never fall back to a different property',()=>{
 const w=marked();w.properties['lake-inn'].state.published.rooms[0].enabled=false;
 assert.deepEqual(catalog.shareUnits(w,'lake-inn').map(unit=>unit.id),['sea-twin']);
 const target=catalog.resolveTarget(w,'?property=lake-inn&unit=sea-king&share=1');
 assert.equal(target.ok,false);assert.equal(target.propertyId,'lake-inn');assert.match(target.message,/停用|失效/);
 w.properties['mountain-yard'].state.published.rooms[0].enabled=false;
 assert.match(catalog.shareUnits(w,'mountain-yard')[0].description,/1间卧室/);
});

test('hidden property targets are invalid even when the old unit still exists',()=>{
 const w=marked();w.properties['lake-inn'].state.visible=false;
 const target=catalog.resolveTarget(w,'?property=lake-inn&unit=sea-king&share=1');
 assert.equal(target.ok,false);assert.equal(target.propertyId,'lake-inn');assert.match(target.message,/暂停|停用/);
});
