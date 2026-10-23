import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeed,answer,dispatch,guestThreads} from '../src/model.mjs';
import {createWorkspace} from '../src/catalog.mjs';
import {contentRecord,emptyExperience,upgradeExperience} from '../src/experience.mjs';
import {recommendationContext} from '../src/recommendations.mjs';
import {makeContentContext} from '../src/content.mjs';
const pid='songjian-demo',guest={role:'guest',sessionId:'s4-guest'},merchant={role:'merchant',sessionId:'s4-merchant'};
const confirmed=(id,values={},propertyId=pid)=>contentRecord(id,propertyId,{sourceLabel:'独立测试来源',confirmation:{status:'confirmed',by:'演示操作者（测试）',at:'2026-10-23'},...values});
function state(){const s=createSeed();s.published.experience=emptyExperience(pid);s.draft.experience=emptyExperience(pid);return s;}
function placeState(){const s=state();s.published.version=4;s.published.experience.recommendations.places=[confirmed('tea',{kind:'place',name:'测试茶馆',description:'测试室内喝茶休息',address:'测试地址',lat:1,lng:2,durationMinutes:90,period:'half',party:['family'],fee:'独立测试30元/人',feeConfirmed:true,booking:'测试需提前一天确认',bookingConfirmed:true,transport:'自驾12分钟',transportConfirmed:true})];return s;}
const placeContext=s=>({...recommendationContext('place','tea',s.published,{propertyId:pid,unitId:null}),scope:'local',cityId:'dali'});
const arrivalContext=(id='entrance')=>({kind:'arrival',id,propertyId:pid,unitId:null,label:'伪造的外来标签'});
const latest=s=>guestThreads(s,guest.sessionId)[0].messages.at(-1);
const run=(s,type,payload={},ctx=guest)=>dispatch(s,{type,...payload},ctx);

test('arrival object reads published scoped steps and stores the exact public text and version as a source',()=>{
 const s=state();s.published.version=4;s.published.experience.guide.steps=[confirmed('turn',{title:'测试路书步骤',phase:'arrival',text:'从测试标识向右步行，按指示找入口。'})];s.draft.experience.guide.steps=[confirmed('turn',{text:'不应进入答复的草稿'})];
 const r=answer(s,'这一步怎么走？',arrivalContext('turn'));assert.match(r.body,/从测试标识向右步行/);assert.doesNotMatch(r.body,/草稿|伪造/);assert.equal(r.sources[0].version,4);assert.match(r.sources[0].text,/从测试标识向右步行/);assert.equal(r.context.id,'turn');assert.equal(r.context.label,'测试路书步骤');
});

test('foreign, expired, private, disabled or mismatched-unit arrival objects are unavailable without fallback',()=>{
 for(const patch of [{propertyId:'another'},{unitId:'private-room'},{confirmation:{status:'pending'}},{visibility:'stay'},{enabled:false},{validUntil:'2000-01-01'}]){
  const s=state();s.published.experience.guide.steps=[confirmed('turn',{text:'不能泄漏的到店内容',...patch})];const r=answer(s,'停车是免费的吗？',arrivalContext('turn'));
  assert.equal(r.status,'unavailable');assert.doesNotMatch(r.body,/不能泄漏|3个免费/);assert.deepEqual(r.sources,[]);assert.equal(r.context,null);
 }
});

test('explicit property and rental-unit mismatches are rejected before either core facts or local preview',()=>{
 const s=state();for(const c of [{propertyId:'other'},{propertyId:pid,unitId:'missing'},{propertyId:pid,unitId:'mountain',roomId:'courtyard'}]){
  const r=answer(s,'厨房可以做饭吗？',c);assert.equal(r.status,'unavailable');assert.doesNotMatch(r.body,/10:00|20:00/);
 }
 const qinghuan=upgradeExperience(createWorkspace()).properties['qinghuan-dali'].state;
 const r=answer(qinghuan,'附近推荐咖啡',{scope:'local',kind:'place',id:'made-up',propertyId:'another',cityId:'dali'});assert.equal(r.status,'unavailable');assert.deepEqual(r.sources,[]);
});

test('explicit metadata stops pending/private/expired facts and ordinary FAQ from becoming definite replies',()=>{
 for(const patch of [{confirmation:{status:'pending'}},{visibility:'internal'},{enabled:false},{validUntil:'2000-01-01'},{propertyId:'other'},{unitId:'private-room'}]){
  const s=state();s.published.facts.kitchen={text:'未获准的免费私人厨房',...patch};s.published.knowledge=[{id:'pet',question:'允许带猫吗',aliases:[],text:'未获准的宠物免费承诺',...patch}];
  for(const q of ['厨房可以做饭吗','允许带猫吗']){const r=answer(s,q);assert.equal(r.status,'needs_human');assert.doesNotMatch(r.body,/未获准/);}
 }
 assert.match(answer(createSeed(),'厨房可以做饭吗').body,/10:00/);
});

test('an unconfirmed edited Q03 keeps its question ID and safe pending guide without leaking the edited promise',()=>{
 const s=upgradeExperience(createWorkspace()).properties['qinghuan-dali'].state,k=s.published.knowledge.find(x=>x.id==='Q03');Object.assign(k,{requiresHuman:false,text:'未经确认的全天免费代客泊车',confirmation:{status:'pending'}});
 const r=answer(s,k.question);assert.equal(r.status,'needs_human');assert.deepEqual(r.knowledgeIds,['Q03']);assert.doesNotMatch(r.body,/未经确认的全天免费代客泊车/);assert.match(r.body,/确认/);
});

test('all original Qinghuan questions and aliases retain their core IDs and text even with a guide or local context',()=>{
 const s=upgradeExperience(createWorkspace()).properties['qinghuan-dali'].state;
 for(const k of s.published.knowledge)for(const q of [k.question,...k.aliases]){
  const r=answer(s,q,{scope:'local',propertyId:'qinghuan-dali',cityId:'dali',kind:'guide',id:k.id,unitId:null});
  assert.deepEqual(r.knowledgeIds,[k.id]);assert.equal(r.body,k.text);assert.equal(r.status,'needs_human');
 }
});

test('verified recommendation replies suppress unverified fee/booking and precise transport without a confirmed origin',()=>{
 const s=placeState();const r=answer(s,'这家多少钱，预约呢，怎么去？',placeContext(s));assert.match(r.body,/独立测试30元\/人|测试需提前一天确认/);assert.doesNotMatch(r.body,/12分钟/);assert.match(r.body,/出发点.*确认|车程.*核实/);assert.equal(r.context.label,'测试茶馆');assert.equal(r.sources[0].version,4);
 s.published.experience.recommendations.places[0].feeConfirmed=false;s.published.experience.recommendations.places[0].bookingConfirmed=false;
 const missing=answer(s,'这家多少钱，预约呢？',placeContext(s));assert.equal(missing.status,'needs_human');assert.doesNotMatch(missing.body,/独立测试30元|测试需提前一天/);assert.match(missing.body,/费用.*核|预约.*核/);
});

test('unavailable recommendation context never falls back to another object or the Qinghuan source preview',()=>{
 const s=placeState(),c=placeContext(s);s.published.experience.recommendations.places[0].enabled=false;
 const r=answer(s,'附近还有什么推荐？',c);assert.equal(r.status,'unavailable');assert.equal(r.context,null);assert.deepEqual(r.sources,[]);assert.doesNotMatch(r.body,/测试室内喝茶/);
});

test('a short local follow-up keeps the stable object while a negation or unknown named replacement clears it',()=>{
 const s=placeState(),c=placeContext(s);assert.equal(answer(s,'预约呢？',c).context?.id,'tea');
 for(const q of ['不去测试茶馆，改问另一家星光咖啡几点开门？','星光咖啡几点开门？']){const r=answer(s,q,c);assert.equal(r.context,null);assert.doesNotMatch(r.body,/独立测试30元|测试需提前一天/);assert.equal(r.status,'needs_human');}
});

test('guide information does not swallow an extra unknown request or manufacture an operation/service success',()=>{
 const s=state();s.published.experience.guide.steps=[confirmed('water',{title:'测试热水操作说明',text:'请查看设备旁的公开操作图，未知开关请管家确认。'})];
 const r=answer(s,'这一步怎么操作，另外能提供婴儿床吗？',arrivalContext('water'));assert.equal(r.status,'needs_human');assert.match(r.body,/婴儿床/);assert.doesNotMatch(r.body,/已安排|已派修|已预约|服务已完成/);
 const request=answer(s,'热水器坏了，帮我安排维修。',arrivalContext('water'));assert.equal(request.status,'needs_human');assert.match(request.body,/管家|人工/);
});

test('local merchant information cannot become a fact about this property kitchen',()=>{
 const s=placeState();const r=answer(s,'本店厨房可以做饭吗？',placeContext(s));assert.doesNotMatch(r.body,/本店厨房.*(?:可以|免费)|10:00/);assert.match(r.body,/本店|民宿/);assert.match(r.body,/切换|回到|另行|范围/);
});

test('source previews preserve original reference versions separately from the current public snapshot version',()=>{
 const s=upgradeExperience(createWorkspace()).properties['qinghuan-dali'].state;s.published.version=7;const c=makeContentContext('place','qh-xlsx-01',{propertyId:'qinghuan-dali',cityId:'dali'});
 const r=answer(s,'附近有哪些咖啡推荐？',{scope:'local',propertyId:'qinghuan-dali',cityId:'dali'});assert.equal(r.mode,'source_preview');assert.match(r.body,/原稿.*预览|待核验/);assert.ok(r.sources.length);assert.equal(r.sources[0].version,7);assert.equal(r.sources[0].sourceVersion,'0.4.3');assert.equal(r.sources[0].reference.version,'0.4.3');
});

test('ASK keeps canonical mode/context/text/version snapshots and publish changes affect later replies only',()=>{
 let s=placeState(),c=placeContext(s);s=run(s,'ASK',{body:'这家多少钱？',context:{...c,label:'不能信任的伪造标签'}});const thread=guestThreads(s,guest.sessionId)[0],before=structuredClone(thread.messages),m=thread.messages.at(-1);
 assert.equal(m.mode,'recommendations');assert.equal(m.resolvedContext.id,'tea');assert.equal(m.contextLabel,'测试茶馆');assert.equal(m.propertyId,pid);assert.equal(m.version,4);
 s.published.version=5;s.published.experience.recommendations.places[0].name='测试茶馆新名称';s.published.experience.recommendations.places[0].fee='独立测试40元/人';
 s=run(s,'ASK',{body:'这家多少钱？',threadId:thread.id,context:c});assert.deepEqual(s.threads[thread.id].messages.slice(0,2),before);assert.match(latest(s).body,/独立测试40元/);assert.equal(latest(s).sources[0].version,5);
});

test('v0.5 requires accept before reply and keeps local handoff idempotent in the original guest thread',()=>{
 let s=run(placeState(),'ASK',{body:'帮我预约这家茶馆。',context:placeContext(placeState())}),t=guestThreads(s,guest.sessionId)[0],a=t.messages.at(-1);s=run(s,'HANDOFF',{threadId:t.id,messageId:a.id});s=run(s,'HANDOFF',{threadId:t.id,messageId:a.id});assert.equal(Object.keys(s.tickets).length,1);const ticket=Object.values(s.tickets)[0];assert.equal(ticket.context.scope,'local');
 assert.throws(()=>run(s,'REPLY',{ticketId:ticket.id,body:'测试人工回复'},merchant),/先.*接手/);
 assert.throws(()=>run(s,'HANDOFF',{threadId:t.id,messageId:a.id},{role:'guest',sessionId:'another-guest'}),/本人/);
 s=run(s,'ACCEPT',{ticketId:ticket.id},merchant);s=run(s,'REPLY',{ticketId:ticket.id,body:'测试人工回复，具体预约仍需确认。'},merchant);assert.equal(s.threads[t.id].messages.at(-1).role,'merchant');assert.equal(s.tickets[ticket.id].status,'replied');
 assert.throws(()=>run(s,'REPLY',{ticketId:ticket.id,body:'重复回复'},merchant),/已回复/);
});

test('legacy states without experience preserve the existing pending-to-reply compatibility',()=>{
 let s=run(createSeed(),'ASK',{body:'宠物能带吗？'}),t=guestThreads(s,guest.sessionId)[0];s=run(s,'HANDOFF',{threadId:t.id,messageId:t.messages.at(-1).id});const ticket=Object.values(s.tickets)[0];assert.doesNotThrow(()=>run(s,'REPLY',{ticketId:ticket.id,body:'旧版兼容回复'},merchant));
});

test('a stale explicit object is rejected before the original-question fallback can cite unrelated facts',()=>{
 const s=upgradeExperience(createWorkspace()).properties['qinghuan-dali'].state,q=s.published.knowledge.find(k=>k.id==='Q03').question;
 const r=answer(s,q,{kind:'place',id:'missing',collection:'recommendations',scope:'local',propertyId:'qinghuan-dali',cityId:'dali'});assert.equal(r.status,'unavailable');assert.deepEqual(r.sources,[]);
});

test('service requests keep the current recommendation object while remaining an unfulfilled human request',()=>{
 const s=placeState(),r=answer(s,'帮我预约这里。',placeContext(s));assert.equal(r.context?.id,'tea');assert.equal(r.status,'needs_human');assert.match(r.body,/没有发起|尚未/);
});

test('a guide cannot reintroduce a conflicting rule or turn a booking request into an answered success',()=>{
 const s=state();s.published.facts.parking={text:'本店没有免费车位，测试停车按次收费。'};s.published.experience.guide.steps=[confirmed('parking-rule',{title:'测试停车指引',text:'错误旧指引：停车全部免费。'})];
 const r=answer(s,'停车免费吗？',arrivalContext('parking-rule'));assert.match(r.body,/测试停车按次收费/);assert.doesNotMatch(r.body,/停车全部免费/);
 const request=answer(s,'请安排厨房预约。',arrivalContext('parking-rule'));assert.equal(request.status,'needs_human');assert.match(request.body,/人工|管家/);
});

test('a known recommendation does not swallow an unrecognized extra service need',()=>{
 const s=placeState(),r=answer(s,'想了解测试茶馆，另外能提供婴儿推车吗？',placeContext(s));assert.equal(r.status,'needs_human');assert.match(r.body,/婴儿推车/);assert.equal(r.context.id,'tea');
});

test('a published equipment description cannot turn reported malfunction into a completed operation',()=>{
 const s=state();s.published.facts.wifi={text:'测试空调有制冷模式，遥控器在桌面。'};
 const r=answer(s,'空调不制冷，怎么办？');assert.equal(r.status,'needs_human');assert.equal(r.answerKind,'request');assert.match(r.body,/人工|管家/);assert.doesNotMatch(r.body,/已派修|已修好/);
});

test('legacy content uses its workspace key while old state and thread identities remain unchanged',()=>{
 let old=run(createSeed(),'ASK',{body:'厨房可以做饭吗？'}),oldThread=guestThreads(old,guest.sessionId)[0];
 const s=upgradeExperience(createWorkspace(old)).properties.legacy.state;
 assert.equal(s.propertyId,'songjian-demo');assert.equal(s.published.experience.propertyId,'legacy');
 const room=answer(s,'这间床多宽？',{propertyId:'legacy',roomId:'mountain',unitId:'mountain'});assert.equal(room.status,'answered');assert.match(room.body,/1.8/);
 s.published.experience.guide.steps=[confirmed('legacy-turn',{title:'测试旧房源路书',text:'旧房源逻辑key下的测试指引'},'legacy')];
 const guide=answer(s,'这一步怎么走？',{kind:'arrival',id:'legacy-turn',propertyId:'legacy'});assert.match(guide.body,/逻辑key下的测试指引/);assert.equal(guide.context.propertyId,'legacy');
 s.published.experience.recommendations.places=[confirmed('legacy-tea',{name:'测试旧房源茶馆',description:'独立测试资料',address:'测试地址',durationMinutes:60,period:'half',party:['solo'],fee:'测试10元',feeConfirmed:true},'legacy')];
 const recContext={...recommendationContext('place','legacy-tea',s.published,{propertyId:'legacy'}),scope:'local'};
 const rec=answer(s,'这家多少钱？',recContext);assert.match(rec.body,/测试10元/);assert.equal(rec.context.propertyId,'legacy');
 const next=run(s,'ASK',{threadId:oldThread.id,body:'这家多少钱？',context:recContext});assert.equal(next.propertyId,'songjian-demo');assert.equal(guestThreads(next,guest.sessionId)[0].id,oldThread.id);assert.equal(next.threads[oldThread.id].propertyId,'songjian-demo');assert.deepEqual(next.threads[oldThread.id].messages.slice(0,2),oldThread.messages);
 for(const propertyId of ['songjian-demo','other']){const r=answer(s,'厨房可以做饭吗？',{propertyId,roomId:'mountain'});assert.equal(r.status,'unavailable');}
});
