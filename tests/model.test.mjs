import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeed,answer,dispatch,guestThreads} from '../src/model.mjs';
const ctx={role:'guest',sessionId:'guest-a'};
const merchant={role:'merchant',sessionId:'guest-a'};
const run=(s,type,payload={},c=ctx)=>dispatch(s,{type,...payload},c);

test('厨房回答只使用本店已发布规则，包含条件和可追溯依据',()=>{
 const a=answer(createSeed(),'厨房能做饭吗');
 assert.equal(a.status,'answered');
 assert.match(a.body,/10:00/);assert.match(a.body,/预约/);
 assert.equal(a.sources[0].key,'kitchen');assert.equal(a.sources[0].version,1);
});
test('资料未写宠物规则时交给人工，不编造允许或禁止',()=>{
 const a=answer(createSeed(),'可以带宠物吗');
 assert.equal(a.status,'needs_human');assert.equal(a.sources.length,0);
 assert.match(a.body,/未记录|没有/);assert.doesNotMatch(a.body,/允许携带|禁止携带/);
});
test('同时提问多个主题时，已知和缺失部分都保留',()=>{
 const a=answer(createSeed(),'厨房能做饭吗，能带宠物吗');
 assert.equal(a.status,'needs_human');assert.match(a.body,/预约/);assert.match(a.body,/宠物/);
 assert.deepEqual(a.sources.map(x=>x.key),['kitchen']);
});
test('房间上下文必须来自本民宿，不能用同名或伪造对象作答',()=>{
 const s=createSeed();
 const a=answer(s,'床有多大',{roomId:'mountain'});
 assert.equal(a.status,'answered');assert.match(a.body,/1.8/);
 assert.equal(answer(s,'床有多大',{roomId:'other-property'}).status,'needs_clarification');
 assert.equal(answer(s,'床有多大').status,'needs_clarification');
});
test('从庭院详情带入的空间上下文用于回答开放时间',()=>{
 const a=answer(createSeed(),'这里的开放时间是什么？',{spaceName:'独立庭院'});
 assert.equal(a.status,'answered');assert.match(a.body,/22:00/);
 assert.equal(a.sources[0].key,'environment');
});
test('商家保存草稿不会改变客人和AI所见资料，发布才生效',()=>{
 let s=createSeed();const d=structuredClone(s.draft);d.facts.kitchen.text='厨房暂不开放，不能做饭。';
 s=run(s,'SAVE_DRAFT',{draft:d},merchant);
 assert.match(answer(s,'厨房能做饭吗').body,/预约/);
 s=run(s,'PUBLISH',{},merchant);
 assert.match(answer(s,'厨房能做饭吗').body,/暂不开放/);
 assert.equal(s.published.version,2);
});
test('VR展示资料可维护但过长文案拒绝保存，指定参考链接不被替换',()=>{
 const s=createSeed(),d=structuredClone(s.draft);d.vrLabel='看一看小院的全景体验';d.vrDescription='这是本次用于讲解VR看房的参考资料。';
 let next=run(s,'SAVE_DRAFT',{draft:d},merchant);
 assert.notEqual(next.published.vrLabel,d.vrLabel);
 next=run(next,'PUBLISH',{},merchant);assert.equal(next.published.vrLabel,'看一看小院的全景体验');
 d.vrLabel='长'.repeat(81);assert.throws(()=>run(s,'SAVE_DRAFT',{draft:d},merchant),/VR/);
 d.vrLabel='展示说明';d.vrUrl='https://example.com/other';assert.throws(()=>run(s,'SAVE_DRAFT',{draft:d},merchant),/VR/);
});
test('同一个问题的人工交接可重复请求，只有一张待办',()=>{
 let s=run(createSeed(),'ASK',{body:'可以带宠物吗',operation:'ask1'});
 const t=guestThreads(s,'guest-a')[0];const mid=t.messages.at(-1).id;
 s=run(s,'HANDOFF',{threadId:t.id,messageId:mid});
 s=run(s,'HANDOFF',{threadId:t.id,messageId:mid});
 assert.equal(Object.keys(s.tickets).length,1);
 assert.equal(Object.values(s.tickets)[0].status,'pending');
});
test('商家回复回到原客人会话，不会自动变成公开知识',()=>{
 let s=run(createSeed(),'ASK',{body:'可以带宠物吗',operation:'ask1'});
 const t=guestThreads(s,'guest-a')[0];
 s=run(s,'HANDOFF',{threadId:t.id,messageId:t.messages.at(-1).id});
 const ticketId=Object.keys(s.tickets)[0];
 s=run(s,'REPLY',{ticketId,body:'这次可以带一只小型犬，请提前告知。'},merchant);
 assert.equal(s.tickets[ticketId].status,'replied');
 const reply=guestThreads(s,'guest-a')[0].messages.at(-1);
 assert.equal(reply.role,'merchant');assert.match(reply.body,/小型犬/);
 assert.equal(answer(s,'可以带宠物吗').status,'needs_human');
 assert.equal(s.published.knowledge.length,0);
});
test('人工答复经明确编辑和发布后才能作为新客人的公开知识',()=>{
 let s=createSeed();
 s=run(s,'SAVE_KNOWLEDGE',{question:'可以带宠物吗',aliases:['能带狗吗'],text:'本店仅接受提前预约的小型犬，需使用牵引绳。'},merchant);
 assert.equal(answer(s,'可以带宠物吗').status,'needs_human');
 s=run(s,'PUBLISH',{},merchant);
 assert.equal(answer(s,'能带狗吗').status,'answered');
 assert.match(answer(s,'能带狗吗').body,/牵引绳/);
});
test('隔离其他演示客人的会话，越权请求不产生修改',()=>{
 let s=run(createSeed(),'ASK',{body:'厨房能做饭吗',operation:'ask1'});
 const t=guestThreads(s,'guest-a')[0],before=JSON.stringify(s);
 assert.equal(guestThreads(s,'guest-b').length,0);
 assert.throws(()=>run(s,'HANDOFF',{threadId:t.id,messageId:t.messages.at(-1).id},{role:'guest',sessionId:'guest-b'}),/会话/);
 assert.equal(JSON.stringify(s),before);
 assert.throws(()=>run(s,'PUBLISH'),/商家/);
});
test('重复发送操作不会重复写消息，空白输入被拒绝',()=>{
 let s=run(createSeed(),'ASK',{body:'几点入住',operation:'same'});
 s=run(s,'ASK',{body:'几点入住',operation:'same'});
 assert.equal(guestThreads(s,'guest-a')[0].messages.length,2);
 assert.throws(()=>run(s,'ASK',{body:'  ',operation:'empty'}),/问题/);
});
test('历史答复保留当时依据；资料撤回后不再生成肯定答案',()=>{
 let s=run(createSeed(),'ASK',{body:'怎么停车',operation:'ask1'});
 const first=guestThreads(s,'guest-a')[0].messages.at(-1);
 const body=first.body;
 s=run(s,'SET_VISIBLE',{visible:false},{role:'platform',sessionId:'guest-a'});
 assert.equal(answer(s,'怎么停车').status,'unavailable');
 assert.equal(guestThreads(s,'guest-a')[0].messages.at(-1).body,body);
 assert.throws(()=>run(s,'ASK',{body:'怎么停车',operation:'ask2'}),/暂停/);
});
