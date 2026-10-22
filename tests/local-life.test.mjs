import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,eventsFor,lifeAnswer,saveEvent,syncDemo} from '../src/local-life.mjs';
const now=new Date('2026-10-17T08:00:00+08:00').getTime();
test('大理活动保留来源和时间，默认不推荐取消或过期活动',()=>{
 const l=createLife(now),events=eventsFor(l,'dali',{now});
 assert.ok(events.length>=2);assert.ok(events.every(e=>e.end>now&&e.status!=='cancelled'&&e.sourceName));
 assert.ok(events.every(e=>e.isDemo));
});
test('本地生活不会将大理活动推荐给其他城市房源',()=>{
 const a=lifeAnswer(createLife(now),'附近有什么活动','moganshan',{now});
 assert.equal(a.status,'no_data');assert.doesNotMatch(a.body,/推荐.*市集/);
});
test('活动AI依据可用活动回答，并明确本地演示未接真实AI',()=>{
 const a=lifeAnswer(createLife(now),'有什么本地活动','dali',{now});
 assert.equal(a.mode,'demo');assert.ok(a.refs.length);assert.match(a.body,/示例/);assert.doesNotMatch(a.body,/取消的日落音乐会/);
});
test('保存活动校验起止时间，人工录入不冒充外部同步成功',()=>{
 const l=createLife(now);
 assert.throws(()=>saveEvent(l,{title:'市集',cityId:'dali',start:now+200,end:now+100,location:'场地',sourceName:'某小程序',status:'active'}),/结束时间/);
 const r=saveEvent(l,{title:'手工活动',cityId:'dali',start:now+100,end:now+200,location:'测试地点',sourceName:'待核验小程序',status:'active'});
 const e=Object.values(r.events).find(e=>e.title==='手工活动');assert.equal(e.provenance,'manual');assert.equal(e.verified,false);
});
test('模拟更新只更新示例资料，不覆盖人工录入活动',()=>{
 let l=saveEvent(createLife(now),{title:'保留的手工活动',cityId:'dali',start:now+100,end:now+200,location:'测试地点',sourceName:'手动来源',status:'active'});
 l=syncDemo(l,now+20);assert.ok(Object.values(l.events).some(e=>e.title==='保留的手工活动'));assert.equal(l.feedMode,'demo');assert.equal(l.syncedAt,now+20);
});
test('将示例条目手动编辑为自有活动后，模拟更新也不覆盖编辑',()=>{
 const initial=createLife(now),original=initial.events['demo-market'];
 const edited=saveEvent(initial,{...original,title:'已人工编辑的市集',sourceName:'人工提供的来源'},now);
 const next=syncDemo(edited,now+20);
 assert.equal(next.events['demo-market'].title,'已人工编辑的市集');
 assert.equal(next.events['demo-market'].provenance,'manual');
});
