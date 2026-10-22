import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeed,answer,dispatch,guestThreads} from '../src/model.mjs';

const merchant={role:'merchant',sessionId:'faq-merchant'};
const guest={role:'guest',sessionId:'faq-guest'};
const bedFAQ={knowledgeId:'extra-bed',question:'可以加床吗',aliases:['能加床吗'],text:'本店可以加一张折叠床，请提前一天联系管家预约。'};
const saveFAQ=(state,faq=bedFAQ)=>dispatch(state,{type:'SAVE_KNOWLEDGE',...faq},merchant);
const publish=state=>dispatch(state,{type:'PUBLISH'},merchant);

for(const [label,context] of [['没有房间上下文',null],['带房间上下文',{roomId:'mountain'}]]){
 for(const question of ['可以加床吗','能加床吗']){
  test(`已发布加床FAQ优先于泛床型匹配：${label}，${question}`,()=>{
   const state=publish(saveFAQ(createSeed()));
   const reply=answer(state,question,context);
   assert.equal(reply.status,'answered');
   assert.equal(reply.body,'本店可以加一张折叠床，请提前一天联系管家预约。');
   assert.deepEqual(reply.sources,[{key:'knowledge:extra-bed',label:'可以加床吗',text:'本店可以加一张折叠床，请提前一天联系管家预约。',version:2}]);
  });
 }
}

test('加床FAQ只保存草稿时不会进入客人答案',()=>{
 const state=saveFAQ(createSeed());
 for(const context of [null,{roomId:'mountain'}]){
  for(const question of ['可以加床吗','能加床吗']){
   const reply=answer(state,question,context);
   assert.doesNotMatch(reply.body,/折叠床|提前一天/);
   assert.ok(reply.sources.every(source=>!source.key.startsWith('knowledge:')));
  }
 }
 assert.equal(state.published.knowledge.length,0);
});

test('精确FAQ可以补充未记录主题，不附带无关房型澄清',()=>{
 const state=publish(saveFAQ(createSeed(),{knowledgeId:'pet-bed',question:'宠物能上床吗',aliases:[],text:'宠物不能上床，请使用自带宠物垫。'}));
 const reply=answer(state,'宠物能上床吗');
 assert.equal(reply.status,'answered');
 assert.equal(reply.body,'宠物不能上床，请使用自带宠物垫。');
 assert.deepEqual(reply.sources.map(source=>source.key),['knowledge:pet-bed']);
});

for(const question of ['有免费停车位吗','能免费停车吗']){
 test(`已发布FAQ不能覆盖结构化停车规则：${question}`,()=>{
  let state=createSeed();
  const draft=structuredClone(state.draft);
  draft.facts.parking.text='本店没有免费停车位，请使用镇上公共付费停车场。';
  state=dispatch(state,{type:'SAVE_DRAFT',draft},merchant);
  state=publish(saveFAQ(state,{knowledgeId:'parking-conflict',question:'有免费停车位吗',aliases:['能免费停车吗'],text:'停车完全免费，无需确认。'}));
  const reply=answer(state,question,{roomId:'mountain'});
  assert.equal(reply.status,'answered');
  assert.equal(reply.body,'本店没有免费停车位，请使用镇上公共付费停车场。');
  assert.deepEqual(reply.sources,[{key:'parking',label:'停车说明',text:'本店没有免费停车位，请使用镇上公共付费停车场。',version:2}]);
 });
}

test('精确FAQ不能覆盖已记录的整院经营配置',()=>{
 let state=createSeed();
 const draft=structuredClone(state.draft);
 draft.rentalMode='whole';draft.wholeCapacity='建议4人入住';
 state=dispatch(state,{type:'SAVE_DRAFT',draft},merchant);
 state=publish(saveFAQ(state,{knowledgeId:'whole-conflict',question:'整院有几间卧室',aliases:[],text:'整院只有一间卧室。'}));
 const reply=answer(state,'整院有几间卧室');
 assert.equal(reply.status,'answered');
 assert.match(reply.body,/包含2间卧室/);
 assert.doesNotMatch(reply.body,/只有一间/);
 assert.deepEqual(reply.sources.map(source=>source.key),['whole']);
});

test('发布加床FAQ只影响新答复，历史消息与当时房型依据保持不变',()=>{
 let state=dispatch(createSeed(),{type:'ASK',body:'可以加床吗',context:{roomId:'mountain'}},guest);
 const thread=guestThreads(state,guest.sessionId)[0];
 const history=structuredClone(thread.messages);
 assert.equal(history[1].sources[0].key,'room:mountain');
 assert.equal(history[1].sources[0].version,1);
 state=publish(saveFAQ(state));
 state=dispatch(state,{type:'ASK',threadId:thread.id,body:'能加床吗',context:{roomId:'mountain'}},guest);
 const messages=guestThreads(state,guest.sessionId)[0].messages;
 assert.deepEqual(messages.slice(0,2),history);
 assert.equal(messages.at(-1).body,'本店可以加一张折叠床，请提前一天联系管家预约。');
 assert.equal(messages.at(-1).sources[0].key,'knowledge:extra-bed');
 assert.equal(messages.at(-1).sources[0].version,2);
});

test('无精确FAQ匹配时床型咨询继续使用所选房间资料',()=>{
 const state=publish(saveFAQ(createSeed()));
 const reply=answer(state,'床有多大',{roomId:'mountain'});
 assert.equal(reply.status,'answered');
 assert.match(reply.body,/1张1.8米大床/);
 assert.deepEqual(reply.sources.map(source=>source.key),['room:mountain']);
 assert.equal(answer(state,'能不能加床').status,'needs_clarification');
});

test('精确FAQ不会绕过无效房间或暂停展示检查',()=>{
 let state=publish(saveFAQ(createSeed()));
 const invalid=answer(state,'能加床吗',{roomId:'other-property'});
 assert.equal(invalid.status,'needs_clarification');
 assert.deepEqual(invalid.sources,[]);
 state=dispatch(state,{type:'SET_VISIBLE',visible:false},{role:'platform',sessionId:'faq-platform'});
 assert.equal(answer(state,'可以加床吗').status,'unavailable');
});
