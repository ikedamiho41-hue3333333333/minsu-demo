import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeed, answer, dispatch, guestThreads} from '../src/model.mjs';
import {createWorkspace} from '../src/catalog.mjs';

const merchant = {role: 'merchant', sessionId: 'answer-boundaries-merchant'};
const guest = {role: 'guest', sessionId: 'answer-boundaries-guest'};
const run = (state, type, payload = {}, actor = merchant) => dispatch(state, {type, ...payload}, actor);
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
function confirmGuide(state, knowledgeId, text) {
  const guide = state.draft.knowledge.find(item => item.id === knowledgeId);
  return run(state, 'SAVE_KNOWLEDGE', {
    knowledgeId, question: guide.question, aliases: guide.aliases, text, requiresHuman: false
  });
}
const networkText = '本店提供住客WiFi，密码通过核验身份后的受控渠道获取。';
const extraBedText = '本店允许加一张折叠床，须提前一天预约。';

// Catches using a broad facility topic as proof that an emergency guide was answered.
test('A：仅发布WiFi说明后，漏水用电仍保留避险、勿拆修和紧急联系指南', () => {
  const state = publish(saveFacts(property('qinghuan-dali'), {wifi: {text: networkText}}));
  const reply = answer(state, '漏水了还能用电吗？');

  assert.equal(reply.status, 'needs_human');
  assert.match(reply.body, /远离危险处/);
  assert.match(reply.body, /不要自行拆修/);
  assert.match(reply.body, /联系当地紧急救援/);
  assert.match(reply.body, /订单平台的现有联系入口/);
  assert.doesNotMatch(reply.body, /住客WiFi|核验身份/);
  assert.deepEqual(reply.sources.map(source => source.key), ['knowledge:Q11']);
  assert.equal(reply.sources[0].version, 2);
});

// Catches an unrelated WiFi rule replacing the published, confirmed AC instructions.
test('A：WiFi规则不吞掉已确认并发布的Q09空调专属答复', () => {
  const acText = '本房空调遥控器放在床头柜；使用制热模式前请联系管家核对设备说明。';
  let state = confirmGuide(property('qinghuan-dali'), 'Q09', acText);
  state = publish(saveFacts(state, {wifi: {text: networkText}}));
  const reply = answer(state, '空调和取暖器怎么开？');

  assert.equal(reply.status, 'answered');
  assert.equal(reply.body, acText);
  assert.deepEqual(reply.sources.map(source => source.key), ['knowledge:Q09']);
  assert.equal(reply.sources[0].requiresHuman, false);
  assert.equal(reply.sources[0].version, 2);
});

// Catches an early guide return dropping an unresolved room-service request.
test('B：已确认停车与未知婴儿床合问仍需人工，交接保留完整原问题', () => {
  const parkingText = '本店不提供院内停车，请按订单说明使用公共停车场。';
  const question = '停车怎么安排？另外可以提供婴儿床吗？';
  let state = publish(confirmGuide(property('qinghuan-dali'), 'Q03', parkingText));
  state = run(state, 'ASK', {body: question}, guest);
  const thread = guestThreads(state, guest.sessionId)[0];
  const reply = thread.messages.at(-1);
  state = run(state, 'HANDOFF', {threadId: thread.id, messageId: reply.id}, guest);
  const ticket = Object.values(state.tickets)[0];

  assert.equal(reply.status, 'needs_human');
  assert.ok(reply.body.includes(parkingText));
  assert.match(reply.body, /婴儿床/);
  assert.match(reply.body, /尚未记录|未记录|待.*确认|无法确认|不能确认/);
  assert.deepEqual(reply.sources.map(source => source.key), ['knowledge:Q03']);
  assert.equal(reply.sources[0].version, 2);
  assert.equal(ticket.question, question);
  assert.equal(ticket.status, 'pending');
  assert.deepEqual(ticket.knowledgeIds, ['Q03']);
});

// Catches reintroducing an entire contradictory FAQ while filling its unknown topic.
test('C：停车已知收费、早餐未知时，混合FAQ不能重新承诺两项均免费', () => {
  const parkingText = '本店没有免费停车位，请使用镇上公共付费停车场。';
  let state = saveFacts(property('lake-inn'), {parking: {text: parkingText}, breakfast: {text: ''}});
  state = publish(saveFAQ(state, 'mixed-free', '停车和早餐都免费吗', '停车和早餐均免费，无需另付费。'));
  const reply = answer(state, '停车和早餐都免费吗');

  assert.equal(reply.status, 'needs_human');
  assert.ok(reply.body.includes(parkingText));
  assert.match(reply.body, /早餐/);
  assert.match(reply.body, /尚未记录|未记录|待.*确认|无法确认|不能确认/);
  assert.doesNotMatch(reply.body, /停车和早餐均免费|无需另付费/);
  assert.deepEqual(reply.sources.map(source => source.key), ['parking']);
  assert.equal(reply.sources[0].version, 2);
});

for (const question of ['可以加床吗', '整院可以加床吗', '包栋可以加床吗']) {
  // Catches treating a rental-mode qualifier as a configuration question.
  test(`D：整院房源的已发布加床政策用于精确问法「${question}」`, () => {
    const state = publish(saveFAQ(property('mountain-yard'), 'extra-bed', '可以加床吗', extraBedText,
      ['整院可以加床吗', '包栋可以加床吗']));
    const reply = answer(state, question);

    assert.equal(reply.status, 'answered');
    assert.equal(reply.body, extraBedText);
    assert.deepEqual(reply.sources.map(source => source.key), ['knowledge:extra-bed']);
    assert.equal(reply.sources[0].version, 2);
  });
}

// Catches precise FAQ text overriding the selected room's recorded bed width.
test('R1：精确床宽FAQ与所选房间冲突时，使用结构化1.8米床宽', () => {
  const state = publish(saveFAQ(createSeed(), 'wrong-bed-width', '这间房床有多大', '这间房配有一张3米宽的大床。'));
  const reply = answer(state, '这间房床有多大', {roomId: 'mountain'});

  assert.equal(reply.status, 'answered');
  assert.match(reply.body, /1\.8米/);
  assert.doesNotMatch(reply.body, /3米/);
  assert.deepEqual(reply.sources.map(source => source.key), ['room:mountain']);
  assert.equal(reply.sources[0].version, 2);
});

// Guards against fixing bed-width priority by suppressing every FAQ that mentions beds.
test('R1：所选房间已有床宽，仍可使用不冲突的精确加床服务FAQ', () => {
  const state = publish(saveFAQ(createSeed(), 'extra-bed', '可以加床吗', extraBedText, ['这间房可以加床吗']));
  const reply = answer(state, '这间房可以加床吗', {roomId: 'mountain'});

  assert.equal(reply.status, 'answered');
  assert.equal(reply.body, extraBedText);
  assert.deepEqual(reply.sources.map(source => source.key), ['knowledge:extra-bed']);
  assert.equal(reply.sources[0].version, 2);
});
