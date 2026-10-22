import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeed,answer,dispatch,guestThreads} from '../src/model.mjs';
import {QINGHUAN_QUESTIONS} from '../src/qinghuan.mjs';

const merchant={role:'merchant',sessionId:'qinghuan-merchant'};
const guest={role:'guest',sessionId:'qinghuan-guest'};
const run=(state,type,payload={},ctx=merchant)=>dispatch(state,{type,...payload},ctx);
function pendingState(){
 const state=createSeed();state.propertyId='qinghuan-dali';
 state.draft={...state.draft,name:'清欢民宿',subtitle:'清欢民宿资料待商家确认',location:'大理（具体位置待确认）',description:'本房源正在确认经营资料。',facts:{},rooms:[],rentalMode:'pending',profilePending:true,knowledge:structuredClone(QINGHUAN_QUESTIONS)};
 state.published={...structuredClone(state.draft),version:1,publishedAt:Date.now()};
 return state;
}
const guide=id=>QINGHUAN_QUESTIONS.find(item=>item.id===id);
const editGuide=(state,item,text,options={})=>run(state,'SAVE_KNOWLEDGE',{knowledgeId:item.id,question:item.question,aliases:item.aliases,text,...options});

for(const item of QINGHUAN_QUESTIONS){
 test(`${item.id} 原题通过真实问答、转人工和回复，保存题号与待确认来源`,()=>{
  let state=run(pendingState(),'ASK',{body:item.question},guest);
  const thread=guestThreads(state,guest.sessionId)[0],message=thread.messages.at(-1);
  assert.equal(message.status,'needs_human');
  assert.deepEqual(message.knowledgeIds,[item.id]);
  assert.ok(message.body.includes(item.text));
  assert.doesNotMatch(message.body,/你想了解哪一间房|1张1\.8米大床|建议2人入住|松间小院/);
  assert.equal(message.sources.length,1);
  assert.equal(message.sources[0].key,'knowledge:'+item.id);
  assert.equal(message.sources[0].version,1);
  assert.equal(message.sources[0].sourceLabel,item.sourceLabel);
  assert.equal(message.sources[0].sourceRange,item.sourceRange);
  assert.match(message.sources[0].label,/待确认/);
  state=run(state,'HANDOFF',{threadId:thread.id,messageId:message.id},guest);
  const ticket=Object.values(state.tickets)[0];
  assert.deepEqual(ticket.knowledgeIds,[item.id]);
  assert.equal(ticket.question,item.question);
  const published=structuredClone(state.published);
  state=run(state,'REPLY',{ticketId:ticket.id,body:'这是这位客人的人工确认答复。'});
  assert.equal(state.tickets[ticket.id].status,'replied');
  assert.equal(state.threads[thread.id].messages.at(-1).body,'这是这位客人的人工确认答复。');
  assert.deepEqual(state.published,published);
 });
}

test('多个原题合问保留每项安全答复、来源和转人工题号',()=>{
 const first=guide('Q03'),second=guide('Q06');
 let state=run(pendingState(),'ASK',{body:first.question+'；'+second.question},guest);
 const thread=guestThreads(state,guest.sessionId)[0],message=thread.messages.at(-1);
 assert.equal(message.status,'needs_human');
 assert.deepEqual(message.knowledgeIds,['Q03','Q06']);
 assert.ok(message.body.includes(first.text));assert.ok(message.body.includes(second.text));
 assert.deepEqual(message.sources.map(source=>source.key),['knowledge:Q03','knowledge:Q06']);
 state=run(state,'HANDOFF',{threadId:thread.id,messageId:message.id},guest);
 assert.deepEqual(Object.values(state.tickets)[0].knowledgeIds,['Q03','Q06']);
});

test('公开指南的相关事实已有记录时先给已知规则，仅其余清单交人工',()=>{
 const item=guide('Q03'),state=pendingState();
 state.published.facts.parking={text:'院内不提供停车；300米外公共停车场按小时收费。'};
 const reply=answer(state,item.question);
 assert.equal(reply.status,'needs_human');
 assert.ok(reply.body.includes('院内不提供停车；300米外公共停车场按小时收费。'));
 assert.ok(reply.body.includes(item.confirmationChecklist));
 assert.match(reply.body,/已明确.*除外|除.*已明确|其余|未明确/);
 assert.ok(!reply.body.includes(item.text),'不应再把该题的所有信息笼统称作未知');
 assert.deepEqual(reply.knowledgeIds,['Q03']);
 assert.ok(reply.sources.some(source=>source.key==='parking'));
 assert.ok(reply.sources.some(source=>source.key==='knowledge:Q03'));
});

test('复合问题中已知停车规则和仍未知的宠物指南同时保留',()=>{
 const state=pendingState(),parking=guide('Q03'),pets=guide('Q06');
 state.published.facts.parking={text:'本店没有免费停车位。'};
 const reply=answer(state,parking.question+'；'+pets.question);
 assert.equal(reply.status,'needs_human');
 assert.ok(reply.body.includes('本店没有免费停车位。'));
 assert.ok(reply.body.includes(parking.confirmationChecklist));
 assert.ok(reply.body.includes(pets.text));
 assert.ok(!reply.body.includes(parking.text));
 assert.deepEqual(reply.knowledgeIds,['Q03','Q06']);
});

test('指南只来自当前房源公开版本，不读取草稿或其他房源题库',()=>{
 const state=pendingState(),item=guide('Q03');
 state.published.knowledge=[];
 const reply=answer(state,item.question);
 assert.ok(!reply.body.includes(item.text));
 assert.ok(!reply.sources.some(source=>source.key==='knowledge:Q03'));
 const other=answer(createSeed(),item.question);
 assert.ok(!other.body.includes(item.text));
 assert.ok(!other.sources.some(source=>source.key==='knowledge:Q03'));
});

test('指南不会绕过隐藏房源和无效房间上下文校验',()=>{
 const state=pendingState(),item=guide('Q03');
 assert.equal(answer(state,item.question,{roomId:'invented-room'}).status,'needs_clarification');
 state.visible=false;
 const hidden=answer(state,item.question);
 assert.equal(hidden.status,'unavailable');assert.deepEqual(hidden.sources,[]);
});

test('编辑指南默认仍需确认，保留元信息，发布后仅新答案使用新版本',()=>{
 const item=guide('Q03');let state=run(pendingState(),'ASK',{body:item.question},guest);
 const thread=guestThreads(state,guest.sessionId)[0],history=structuredClone(thread.messages);
 state=editGuide(state,item,'停车资料仍需管家核实；请确认当日空位与收费。');
 const saved=state.draft.knowledge.find(entry=>entry.id==='Q03');
 for(const key of ['kind','topics','sourceLabel','sourceRange','intentPatterns','confirmationChecklist','requiresHuman'])assert.deepEqual(saved[key],item[key],key);
 assert.ok(answer(state,item.question).body.includes(item.text));
 state=run(state,'PUBLISH');
 state=run(state,'ASK',{threadId:thread.id,body:item.question},guest);
 const messages=state.threads[thread.id].messages;
 assert.deepEqual(messages.slice(0,2),history);
 assert.equal(messages.at(-1).status,'needs_human');
 assert.ok(messages.at(-1).body.includes('停车资料仍需管家核实；请确认当日空位与收费。'));
 assert.equal(messages.at(-1).sources.find(source=>source.key==='knowledge:Q03').version,2);
 assert.equal(history[1].sources[0].version,1);
});

test('商家显式确认并发布指南后，精确公开答复覆盖同题指南且不重复',()=>{
 const item=guide('Q03');let state=pendingState();
 state=editGuide(state,item,'本店没有院内停车位，可使用附近公共收费停车场。',{requiresHuman:false});
 assert.equal(answer(state,item.question).status,'needs_human');
 state=run(state,'PUBLISH');
 const reply=answer(state,item.question);
 assert.equal(reply.status,'answered');
 assert.equal(reply.body,'本店没有院内停车位，可使用附近公共收费停车场。');
 assert.deepEqual(reply.sources.map(source=>source.key),['knowledge:Q03']);
 assert.equal(reply.sources[0].sourceRange,item.sourceRange);
 assert.equal(reply.sources[0].requiresHuman,false);
 assert.deepEqual(reply.knowledgeIds,['Q03']);
 const saved=state.published.knowledge.find(entry=>entry.id==='Q03');
 assert.equal(saved.kind,'confirmation_guide');assert.equal(saved.requiresHuman,false);
 assert.equal(saved.sourceRange,item.sourceRange);
});

test('复合提问同时保留已确认公开答复和仍需人工的指南，不漏掉已确认意图',()=>{
 const pets=guide('Q06'),parking=guide('Q03');let state=pendingState();
 state=editGuide(state,pets,'本店不接待宠物，请勿携宠入住。',{requiresHuman:false});
 state=run(state,'PUBLISH');
 const reply=answer(state,parking.question+'；'+pets.question);
 assert.equal(reply.status,'needs_human');
 assert.ok(reply.body.includes(parking.text));
 assert.ok(reply.body.includes('本店不接待宠物，请勿携宠入住。'));
 assert.ok(!reply.body.includes(pets.text));
 assert.deepEqual(reply.knowledgeIds,['Q03','Q06']);
 assert.deepEqual(reply.sources.map(source=>source.key),['knowledge:Q03','knowledge:Q06']);
 assert.equal(reply.sources[1].requiresHuman,false);
 assert.equal(reply.sources[1].version,2);
});

test('复合问题内已确认指南也不能覆盖已发布的结构化事实',()=>{
 const pets=guide('Q06'),parking=guide('Q03');let state=pendingState();
 state=editGuide(state,pets,'本店允许所有宠物免费入住。',{requiresHuman:false});
 const draft=structuredClone(state.draft);draft.facts.pets={text:'本店不接待宠物，请勿携宠入住。'};
 state=run(state,'SAVE_DRAFT',{draft});state=run(state,'PUBLISH');
 const reply=answer(state,parking.question+'；'+pets.question);
 assert.equal(reply.status,'needs_human');
 assert.ok(reply.body.includes(parking.text));
 assert.ok(reply.body.includes('本店不接待宠物，请勿携宠入住。'));
 assert.doesNotMatch(reply.body,/允许所有宠物免费入住/);
 assert.ok(reply.sources.some(source=>source.key==='pets'));
 assert.deepEqual(reply.knowledgeIds,['Q03','Q06']);
});

test('已确认并发布的指南也回答匹配到该题的变体问法',()=>{
 let state=editGuide(pendingState(),guide('Q03'),'可使用300米外的公共收费停车场。',{requiresHuman:false});
 state=run(state,'PUBLISH');
 state=run(state,'ASK',{body:'请问你们那里停车怎么安排？'},guest);
 const reply=guestThreads(state,guest.sessionId)[0].messages.at(-1);
 assert.equal(reply.status,'answered');
 assert.equal(reply.body,'可使用300米外的公共收费停车场。');
 assert.deepEqual(reply.knowledgeIds,['Q03']);
 assert.deepEqual(reply.sources.map(source=>source.key),['knowledge:Q03']);
 assert.equal(reply.sources[0].requiresHuman,false);
});

test('合问两条已确认指南时逐项输出公开答复而不是退回未知',()=>{
 let state=editGuide(pendingState(),guide('Q03'),'可使用300米外的公共收费停车场。',{requiresHuman:false});
 state=editGuide(state,guide('Q06'),'本店不接待宠物。',{requiresHuman:false});
 state=run(state,'PUBLISH');
 const reply=answer(state,guide('Q03').question+'；'+guide('Q06').question);
 assert.equal(reply.status,'answered');
 assert.ok(reply.body.includes('可使用300米外的公共收费停车场。'));
 assert.ok(reply.body.includes('本店不接待宠物。'));
 assert.deepEqual(reply.sources.map(source=>source.key),['knowledge:Q03','knowledge:Q06']);
 assert.deepEqual(reply.knowledgeIds,['Q03','Q06']);
});

test('已确认指南的变体问法仍以已发布结构化规则为先',()=>{
 let state=editGuide(pendingState(),guide('Q03'),'停车全部免费。',{requiresHuman:false});
 const draft=structuredClone(state.draft);draft.facts.parking={text:'本店没有免费车位。'};
 state=run(state,'SAVE_DRAFT',{draft});state=run(state,'PUBLISH');
 const reply=answer(state,'请问你们那里停车怎么安排？');
 assert.equal(reply.status,'answered');
 assert.equal(reply.body,'本店没有免费车位。');
 assert.deepEqual(reply.sources.map(source=>source.key),['parking']);
 assert.deepEqual(reply.knowledgeIds,['Q03']);
});

test('待确认指南合问普通已知主题时保留额外规则及其来源',()=>{
 const state=pendingState(),pets=guide('Q06');
 state.published.facts.checkin={text:'本店15:00后入住，次日11:00前退房。'};
 const reply=answer(state,pets.question+'；几点入住？');
 assert.equal(reply.status,'needs_human');
 assert.ok(reply.body.includes(pets.text));
 assert.ok(reply.body.includes('本店15:00后入住，次日11:00前退房。'));
 assert.deepEqual(reply.sources.map(source=>source.key),['knowledge:Q06','checkin']);
 assert.deepEqual(reply.knowledgeIds,['Q06']);
});

test('指南范围外的未知主题继续提示人工，原题范围不再重复报未知',()=>{
 const state=pendingState(),pets=guide('Q06');
 const reply=answer(state,pets.question+'；能烧烤吗？');
 assert.equal(reply.status,'needs_human');
 assert.ok(reply.body.includes(pets.text));
 assert.match(reply.body,/未记录烧烤规则/);
 assert.doesNotMatch(reply.body,/未记录宠物规则|未记录价格与预订/);
 assert.deepEqual(reply.sources.map(source=>source.key),['knowledge:Q06']);
});

test('单独原题的待确认范围不会再附加重复泛主题提示',()=>{
 const reply=answer(pendingState(),guide('Q06').question);
 assert.equal(reply.body,guide('Q06').text);
 assert.deepEqual(reply.sources.map(source=>source.key),['knowledge:Q06']);
});

test('30原题及全部别名只输出本题指南，不把题内词语误算成额外主题',()=>{
 const state=pendingState(),mismatches=[];
 for(const item of QINGHUAN_QUESTIONS){
  for(const question of [item.question,...item.aliases]){
   const reply=answer(state,question);
   if(reply.body!==item.text||reply.status!=='needs_human')mismatches.push({id:item.id,question,status:reply.status,unexpectedTail:reply.body.slice(item.text.length)});
  }
 }
 assert.deepEqual(mismatches,[]);
});

test('两个完整原题合问也不会把原题内的退房再变成额外未知主题',()=>{
 const first=guide('Q26'),second=guide('Q30');
 const reply=answer(pendingState(),first.question+'；'+second.question);
 assert.equal(reply.body,first.text+'\n\n'+second.text);
 assert.deepEqual(reply.sources.map(source=>source.key),['knowledge:Q26','knowledge:Q30']);
 assert.deepEqual(reply.knowledgeIds,['Q26','Q30']);
});

test('移除完整原题范围后，真实额外烧烤问题仍保留未知提示',()=>{
 const reply=answer(pendingState(),guide('Q30').question+'；能烧烤吗？');
 assert.ok(reply.body.includes(guide('Q30').text));
 assert.match(reply.body,/未记录烧烤规则/);
 assert.doesNotMatch(reply.body,/未记录入住与退房/);
});

test('资料待录入且没有房间时，面积问题明确交人工而不要求选择空房间',()=>{
 const reply=answer(pendingState(),'房间面积多大？');
 assert.equal(reply.status,'needs_human');
 assert.match(reply.body,/待录入|待商家录入/);
 assert.match(reply.body,/管家确认/);
 assert.doesNotMatch(reply.body,/你想了解哪一间房|先在「房间设施」选择/);
 assert.deepEqual(reply.sources,[]);
});

test('非布尔确认选项不能把待确认指南变成已确认规则',()=>{
 const state=pendingState(),item=guide('Q03'),before=structuredClone(state);
 assert.throws(()=>editGuide(state,item,'停车可以免费。',{requiresHuman:'false'}),/确认/);
 assert.deepEqual(state,before);
});

test('新建完整精确普通FAQ维持既有逻辑，不重复附加同主题指南',()=>{
 let state=pendingState();
 state=run(state,'SAVE_KNOWLEDGE',{knowledgeId:'merchant-parking',question:'停车费用已经确认了吗',aliases:[],text:'公共停车场收费以现场公示为准，本店没有免费车位。'});
 state=run(state,'PUBLISH');
 const reply=answer(state,'停车费用已经确认了吗');
 assert.equal(reply.status,'answered');
 assert.equal(reply.body,'公共停车场收费以现场公示为准，本店没有免费车位。');
 assert.deepEqual(reply.sources.map(source=>source.key),['knowledge:merchant-parking']);
});

test('仅明确标记资料待确认的房源可保存发布空房间列表',()=>{
 const pending=pendingState();
 assert.doesNotThrow(()=>run(pending,'SAVE_DRAFT',{draft:pending.draft}));
 assert.doesNotThrow(()=>run(pending,'PUBLISH'));
 const regular=createSeed(),draft=structuredClone(regular.draft);draft.rooms=[];
 assert.throws(()=>run(regular,'SAVE_DRAFT',{draft}),/1—10/);
 draft.profilePending='true';
 assert.throws(()=>run(regular,'SAVE_DRAFT',{draft}),/1—10/);
});
