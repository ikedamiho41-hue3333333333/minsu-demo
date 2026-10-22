import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeed, answer, dispatch} from '../src/model.mjs';
import {createWorkspace} from '../src/catalog.mjs';

const merchant = {role: 'merchant', sessionId: 'answer-neighbors-merchant'};
const run = (state, type, payload = {}) => dispatch(state, {type, ...payload}, merchant);
const property = id => createWorkspace().properties[id].state;
const publish = state => run(state, 'PUBLISH');
const saveFAQ = (state, knowledgeId, question, text, aliases = []) => run(state, 'SAVE_KNOWLEDGE', {
  knowledgeId, question, text, aliases
});
function saveFacts(state, facts) {
  const draft = structuredClone(state.draft);
  Object.assign(draft.facts, facts);
  return run(state, 'SAVE_DRAFT', {draft});
}

// A field's label supplies its subject even when its value does not repeat it.
test('C邻近：停车字段省略主题词仍优先于混合免费FAQ，早餐仍未知', () => {
  const parkingText = '院外3个，先到先停，每晚收费10元。';
  let state = saveFacts(property('lake-inn'), {parking: {text: parkingText}, breakfast: {text: ''}});
  state = publish(saveFAQ(state, 'mixed-free', '停车和早餐都免费吗', '停车和早餐均免费，无需另付费。'));
  const reply = answer(state, '停车和早餐都免费吗');

  assert.equal(reply.status, 'needs_human');
  assert.ok(reply.body.includes(parkingText));
  assert.match(reply.body, /早餐/);
  assert.match(reply.body, /未记录|待.*确认|无法确认|不能确认/);
  assert.doesNotMatch(reply.body, /停车和早餐均免费|无需另付费/);
  assert.deepEqual(reply.sources.map(source => source.key), ['parking']);
});

// Existing room configuration must also win for bed type, not just metric widths.
test('R1邻近：所选大床房的结构化床型不能被精确双床FAQ覆盖', () => {
  const state = publish(saveFAQ(createSeed(), 'wrong-bed-type', '这间房是双床吗', '这间房配有两张单人床。'));
  const reply = answer(state, '这间房是双床吗', {roomId: 'mountain'});

  assert.equal(reply.status, 'answered');
  assert.match(reply.body, /1张1\.8米大床/);
  assert.doesNotMatch(reply.body, /两张单人床/);
  assert.deepEqual(reply.sources.map(source => source.key), ['room:mountain']);
});

// A size describing an extra bed is a service detail, not a claim about existing beds.
test('D邻近：整院精确加床FAQ含折叠床尺寸时仍回答加床服务', () => {
  const text = '本店允许加一张1.2米折叠床，须提前一天预约。';
  const state = publish(saveFAQ(property('mountain-yard'), 'sized-extra-bed', '可以加床吗', text, ['整院可以加床吗']));
  const reply = answer(state, '整院可以加床吗');

  assert.equal(reply.status, 'answered');
  assert.equal(reply.body, text);
  assert.deepEqual(reply.sources.map(source => source.key), ['knowledge:sized-extra-bed']);
});

// Device presence does not supply the confirmed instructions for operating it.
test('A邻近：空调存在说明不能吞掉已确认的空调操作指引', () => {
  const acText = '空调遥控器放在床头柜，使用制热模式前请核对设备说明。';
  let state = property('qinghuan-dali');
  const guide = state.draft.knowledge.find(item => item.id === 'Q09');
  state = run(state, 'SAVE_KNOWLEDGE', {
    knowledgeId: 'Q09', question: guide.question, aliases: guide.aliases, text: acText, requiresHuman: false
  });
  state = publish(saveFacts(state, {wifi: {text: '客房与客厅提供Wi-Fi；客房配有空调。Wi-Fi密码到店后向管家获取。'}}));
  const reply = answer(state, '空调和取暖器怎么开？');

  assert.equal(reply.status, 'answered');
  assert.ok(reply.body.includes(acText));
  assert.ok(reply.sources.some(source => source.key === 'knowledge:Q09' && source.requiresHuman === false));
});

for (const {key, text, question} of [
  {key: 'kitchen', text: '开放时间为10:00—20:00，需提前向管家预约。', question: '厨房几点开放？'},
  {key: 'pets', text: '不接待。', question: '可以带狗吗？'}
]) {
  // Prevents subject detection from discarding normal values in a narrowly named field.
  test(`窄字段「${key}」的公开规则不必重复字段名称`, () => {
    const state = publish(saveFacts(createSeed(), {[key]: {text}}));
    const reply = answer(state, question);

    assert.equal(reply.status, 'answered');
    assert.equal(reply.body, text);
    assert.deepEqual(reply.sources.map(source => source.key), [key]);
    assert.equal(reply.sources[0].version, 2);
  });
}

// Resolving a room from its name must grant the same factual priority as a roomId.
test('R1邻近：无context但问题具名听山房时，结构化床宽仍优先', () => {
  const question = '听山这间房床有多大';
  const state = publish(saveFAQ(createSeed(), 'named-wrong-width', question, '这间房配有一张3米宽的大床。'));
  const reply = answer(state, question);

  assert.equal(reply.status, 'answered');
  assert.match(reply.body, /1张1\.8米大床/);
  assert.doesNotMatch(reply.body, /3米/);
  assert.deepEqual(reply.sources.map(source => source.key), ['room:mountain']);
});

// Words owned by the navigation guide must not swallow a separate area request.
test('B邻近：Q02导航原题合问房间面积，仍明确面积资料未知', () => {
  const reply = answer(property('qinghuan-dali'), '小区楼栋多、路复杂，到了怎么找到房间？另外房间面积有多大？');

  assert.equal(reply.status, 'needs_human');
  assert.match(reply.body, /订单平台的商家联系入口/);
  assert.match(reply.body, /尚未记录[^。]*面积|面积[^。]*(?:未记录|待确认|待录入)|房间配置与面积（房源资料待录入）/);
  assert.deepEqual(reply.sources.map(source => source.key), ['knowledge:Q02']);
});

// A legitimate added-bed size must not exempt an explicit existing-bed claim.
test('R1邻近：同句声明原有床宽及加床尺寸时，仍阻止冲突的既有床声明',()=>{
 const merchant={role:'merchant',sessionId:'mixed-bed-policy'};
 let state=createSeed();
 state=dispatch(state,{type:'SAVE_KNOWLEDGE',knowledgeId:'mixed-bed',question:'可以加床吗',aliases:[],text:'本房原有3米大床并可加一张0.9米宽的折叠床。'},merchant);
 state=dispatch(state,{type:'PUBLISH'},merchant);
 const reply=answer(state,'可以加床吗',{roomId:'mountain'});
 assert.equal(reply.status,'needs_human');
 assert.match(reply.body,/加床服务/);
 assert.match(reply.body,/1\.8米/);
 assert.doesNotMatch(reply.body,/3米/);
 assert.deepEqual(reply.sources.map(source=>source.key),['room:mountain']);
});
