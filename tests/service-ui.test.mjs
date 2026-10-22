import test from 'node:test';
import assert from 'node:assert/strict';
import {QINGHUAN_QUESTIONS} from '../src/qinghuan.mjs';

const {serviceKnowledge, serviceDeskMarkup, ticketServiceMarkup, guestHandbookMarkup} =
  await import('../src/service-ui.mjs').catch(error => {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    return {serviceKnowledge: [], serviceDeskMarkup: () => '', ticketServiceMarkup: () => '', guestHandbookMarkup: () => ''};
  });
const propertyId = 'qinghuan-dali';
const knowledge = structuredClone(QINGHUAN_QUESTIONS);

test('merchant service material covers all 30 source questions with internal candidate fields', () => {
  assert.equal(serviceKnowledge.length, 30);
  assert.deepEqual(serviceKnowledge.map(item => item.id), Array.from({length: 30}, (_, i) => `Q${String(i + 1).padStart(2, '0')}`));
  for (const item of serviceKnowledge) {
    assert.ok(item.internalActionSummary?.trim(), item.id);
    assert.ok(item.roleCandidate?.trim(), item.id);
    assert.match(item.priority, /^P[012]$/);
    assert.ok(item.confirmationChecklist?.trim(), item.id);
    assert.equal(item.status, 'pending_confirmation');
    assert.equal(item.sourceRef?.file, '大理小院子南区民宿管家服务30问.xlsx');
    assert.equal(item.sourceRef?.location, `30问总表!A${Number(item.id.slice(1)) + 3}:O${Number(item.id.slice(1)) + 3}`);
  }
  assert.equal(serviceKnowledge.find(item => item.id === 'Q08')?.roleCandidate, '运营');
  assert.equal(serviceKnowledge.find(item => item.id === 'Q27')?.priority, 'P0');
});

test('merchant service desk groups material into three progressively disclosed phases', () => {
  const html = serviceDeskMarkup(propertyId, knowledge);
  for (const phase of ['入住前', '入住中', '退房后']) assert.ok(html.includes(phase));
  assert.equal((html.match(/data-service-id="Q\d\d"/g) ?? []).length, 30);
  assert.equal((html.match(/<details\b/g) ?? []).length, 30);
  assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
  assert.match(html, /待店方确认/);
  assert.match(html, /责任岗位候选/);
  assert.match(html, /整改优先级/);
  assert.match(html, /30问总表!A30:O30/);
});

test('merchant ticket cards show matching checklist, internal proposal, candidate role and source', () => {
  const html = ticketServiceMarkup(propertyId, {knowledgeIds: ['Q27']}, knowledge);
  assert.match(html, /Q27/);
  assert.match(html, /确认清单/);
  assert.match(html, /内部动作建议/);
  assert.match(html, /管家\/主理人/);
  assert.match(html, /待店方确认/);
  assert.match(html, /策划/);
  assert.match(html, /50元/);
  assert.match(html, /不代表已开通/);
  assert.match(html, /30问总表!A30:O30/);
  assert.doesNotMatch(html, /data-service-id="Q26"/);
});

test('mixed ticket questions are deduplicated in workbook order and unrelated ids are ignored', () => {
  const html = ticketServiceMarkup(propertyId, {knowledgeIds: ['Q27', 'Q03', 'Q27', 'other', 'Q01']}, knowledge);
  assert.deepEqual([...html.matchAll(/data-service-id="(Q\d\d)"/g)].map(match => match[1]), ['Q01', 'Q03', 'Q27']);
  assert.equal(ticketServiceMarkup(propertyId, {knowledgeIds: []}, knowledge), '');
  assert.equal(ticketServiceMarkup(propertyId, {}, knowledge), '');
});

test('all service surfaces isolate Qinghuan from other properties even with matching question ids', () => {
  for (const id of ['moganshan', 'other-dali', '', undefined]) {
    assert.equal(serviceDeskMarkup(id, knowledge), '');
    assert.equal(ticketServiceMarkup(id, {knowledgeIds: ['Q27']}, knowledge), '');
    assert.equal(guestHandbookMarkup(id, knowledge), '');
  }
});

test('guest handbook groups 30 questions and offers one question prefill action per question', () => {
  const html = guestHandbookMarkup(propertyId, knowledge);
  for (const phase of ['入住前', '入住中', '退房后']) assert.ok(html.includes(phase));
  assert.equal((html.match(/data-action="select-guide"/g) ?? []).length, 30);
  assert.match(html, /data-knowledge="Q01"/);
  assert.match(html, /data-knowledge="Q30"/);
  assert.match(html, /待商家确认/);
  assert.match(html, /30问总表!A4:O4/);
  assert.match(html, /订单平台/);
});

test('guest handbook never exposes internal actions, candidate roles or compensation planning', () => {
  const html = guestHandbookMarkup(propertyId, knowledge);
  for (const forbidden of ['责任岗位候选', '整改优先级', '内部动作建议', '管家/主理人', '50元', '每日3次', '垃圾不超2/3', '差评24小时', '补偿授权', '补偿权限与记录方式', '月度客诉复盘会']) {
    assert.ok(!html.includes(forbidden), forbidden);
  }
});

test('guest handbook does not consult merchant-only service fields', () => {
  const internal = serviceKnowledge.find(item => item.id === 'Q01');
  assert.ok(internal, 'Q01 service material exists');
  const original = {...internal};
  try {
    Object.assign(internal, {question: '私密标题哨兵', phase: '私密阶段哨兵', confirmationChecklist: '私密清单哨兵', internalActionSummary: '私密动作哨兵', roleCandidate: '私密岗位哨兵'});
    const html = guestHandbookMarkup(propertyId, knowledge);
    assert.ok(html.includes('从机场/高铁站怎么到院子'));
    assert.doesNotMatch(html, /私密.*哨兵/);
  } finally { Object.assign(internal, original); }
});

test('published confirmed replies use the currently supplied answer and do not resurrect old pending text', () => {
  const current = knowledge.map(item => item.id === 'Q03'
    ? {...item, requiresHuman: false, text: '当前公开版本：本单元仅指定车位可用，请先联系确认。'} : item);
  const html = guestHandbookMarkup(propertyId, current);
  assert.match(html, /当前公开版本：本单元仅指定车位可用，请先联系确认。/);
  assert.match(html, /已确认公开答复/);
  assert.ok(!html.includes(knowledge.find(item => item.id === 'Q03').text));
  const merchant = ticketServiceMarkup(propertyId, {knowledgeIds: ['Q03']}, current);
  assert.match(merchant, /当前公开版本：本单元仅指定车位可用，请先联系确认。/);
  assert.match(merchant, /内部建议仍待店方确认/);
});

test('handbook uses current public collection without restoring a removed guide', () => {
  const html = guestHandbookMarkup(propertyId, knowledge.filter(item => item.id !== 'Q03'));
  assert.doesNotMatch(html, /data-knowledge="Q03"/);
  assert.equal((html.match(/data-action="select-guide"/g) ?? []).length, 29);
  assert.match(guestHandbookMarkup(propertyId, []), /暂无/);
});

test('unrelated public entries are excluded from the scoped 30-question handbook', () => {
  const html = guestHandbookMarkup(propertyId, [...knowledge, {id: 'Q99', phase: '入住中', kind: 'confirmation_guide', question: '无关条目哨兵', text: '无关内容哨兵'}]);
  assert.doesNotMatch(html, /无关.*哨兵/);
});

test('current public answer fields are escaped in guest and merchant markup', () => {
  const unsafe = knowledge.map(item => item.id === 'Q01' ? {...item,
    question: '<img src=x onerror="bad()">', text: '<script>bad()</script> & "unsafe"',
    sourceLabel: '<svg onload="bad()">', sourceRange: '" onclick="bad()', confirmationChecklist: '<iframe>private</iframe>'} : item);
  for (const html of [guestHandbookMarkup(propertyId, unsafe), serviceDeskMarkup(propertyId, unsafe), ticketServiceMarkup(propertyId, {knowledgeIds: ['Q01']}, unsafe)]) {
    assert.doesNotMatch(html, /<(?:img|script|svg|iframe)\b/);
    assert.match(html, /&lt;img/);
    assert.match(html, /&lt;script/);
    assert.match(html, /&quot;/);
  }
});

test('merchant-only source fields are escaped before rendering', () => {
  const internal = serviceKnowledge.find(item => item.id === 'Q01');
  assert.ok(internal, 'Q01 service material exists');
  const original = {...internal};
  try {
    Object.assign(internal, {internalActionSummary: '<script>private()</script>', roleCandidate: '<img src=x>', priority: '<svg>', sourceRef: {file: '<iframe>', location: '" onmouseover="private()'}});
    const html = ticketServiceMarkup(propertyId, {knowledgeIds: ['Q01']}, knowledge);
    assert.doesNotMatch(html, /<(?:img|script|svg|iframe)\b/);
    assert.match(html, /&lt;script/);
    assert.match(html, /&lt;img/);
    assert.match(html, /&lt;iframe/);
  } finally { Object.assign(internal, original); }
});
