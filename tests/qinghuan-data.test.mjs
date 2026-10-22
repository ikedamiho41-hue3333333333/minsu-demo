import test from 'node:test';
import assert from 'node:assert/strict';

// Expected question/alias fixtures come from the reviewed 30-question brief,
// independently of the production module and its matching helpers.
const CASES = [
  {
    "id": "Q01",
    "question": "从机场/高铁站怎么到院子？能安排接站吗？",
    "aliases": [
      "机场过来怎么走，能接机吗？",
      "大理站怎么到清欢？",
      "我们四个人今晚到，接站要多少钱？"
    ]
  },
  {
    "id": "Q02",
    "question": "小区楼栋多、路复杂，到了怎么找到房间？",
    "aliases": [
      "到小区门口了，房间怎么找？",
      "晚上回来找不到楼栋怎么办？",
      "导航到了但不知道从哪个入口进"
    ]
  },
  {
    "id": "Q03",
    "question": "自驾好停车吗？收费吗？有充电桩吗？",
    "aliases": [
      "开车过去停车免费吗？",
      "有电车充电的地方吗，车位要预约吗？",
      "车位满了能帮忙停吗？"
    ]
  },
  {
    "id": "Q04",
    "question": "能提前入住或延迟退房吗？",
    "aliases": [
      "上午十点到能先入住吗？",
      "能不能晚两个小时退房？",
      "提前到可以先寄存行李吗？"
    ]
  },
  {
    "id": "Q05",
    "question": "除房费外还有押金、清洁费吗？退改规则是什么？",
    "aliases": [
      "除了房费还有什么钱？",
      "押金清洁费另外收吗？",
      "这单现在取消能退多少？"
    ]
  },
  {
    "id": "Q06",
    "question": "能带宠物吗？有什么要求？",
    "aliases": [
      "可以带小狗住吗？",
      "两只猫能一起带吗，要押金吗？",
      "宠物有什么限制？"
    ]
  },
  {
    "id": "Q07",
    "question": "含早餐吗？可以自己做饭吗？",
    "aliases": [
      "房费包早餐吗？",
      "能借厨房自己煮饭吗？",
      "早上在哪里吃，做完饭要自己收拾吗？"
    ]
  },
  {
    "id": "Q08",
    "question": "房间图片和实际一致吗？会不会照骗？",
    "aliases": [
      "照片是我订的这一间吗？",
      "实际景观会不会和图片不一样？",
      "住进来和照片不符，能换房吗？"
    ]
  },
  {
    "id": "Q09",
    "question": "有空调/取暖吗？雨季潮不潮、冬天冷不冷？",
    "aliases": [
      "冬天房里有暖气吗？",
      "雨季会很潮吗，有除湿机吗？",
      "空调和取暖器怎么开？"
    ]
  },
  {
    "id": "Q10",
    "question": "能开发票吗？怎么开？",
    "aliases": [
      "住宿能开公司发票吗？",
      "报销发票在哪里申请？",
      "开票要填什么信息？"
    ]
  },
  {
    "id": "Q11",
    "question": "突然停水停电怎么办？找谁？多久能修？",
    "aliases": [
      "突然没电了，找谁处理？",
      "房间停水，多久恢复？",
      "漏水了还能用电吗？"
    ]
  },
  {
    "id": "Q12",
    "question": "热水出水慢、忽冷忽热怎么解决？",
    "aliases": [
      "淋浴一直不热怎么办？",
      "热水一会冷一会热",
      "热水器要等多久才有热水？"
    ]
  },
  {
    "id": "Q13",
    "question": "WiFi连不上/网速慢怎么办？",
    "aliases": [
      "房间无线网密码在哪看？",
      "Wi-Fi连接不上怎么办？",
      "二楼网速太慢了，怎么处理？"
    ]
  },
  {
    "id": "Q14",
    "question": "房间有蜘蛛、蚊虫怎么办？",
    "aliases": [
      "床上发现蜘蛛怎么办？",
      "房间蚊子好多，有驱蚊的东西吗？",
      "能不能帮忙除虫或换房？"
    ]
  },
  {
    "id": "Q15",
    "question": "卫生没打扫、垃圾没人倒怎么办？",
    "aliases": [
      "连住每天有人打扫吗？",
      "垃圾一直没人倒，能来收一下吗？",
      "房间没清洁好，今天能补扫吗？"
    ]
  },
  {
    "id": "Q16",
    "question": "晚上小区路灯暗、独自回家安全吗？",
    "aliases": [
      "晚上回去路很黑怎么办？",
      "一个人夜里回来安全吗？",
      "夜里我迷路了，管家能来接一下吗？"
    ]
  },
  {
    "id": "Q17",
    "question": "共享厨房/洗衣机被其他客人占用怎么办？",
    "aliases": [
      "洗衣机一直被人占着怎么办？",
      "共享厨房怎么排队？",
      "能帮我约个洗衣或做饭的时间吗？"
    ]
  },
  {
    "id": "Q18",
    "question": "隔音怎么样？小区晚上吵吗？",
    "aliases": [
      "房间隔音好不好？",
      "临街的房间晚上会吵吗？",
      "隔壁很吵，我睡不着怎么办？"
    ]
  },
  {
    "id": "Q19",
    "question": "周边怎么玩？有本地攻略和推荐吗？",
    "aliases": [
      "带孩子半天怎么安排？",
      "下雨不想爬山，附近怎么玩？",
      "想画唐卡，有什么本地体验？"
    ]
  },
  {
    "id": "Q20",
    "question": "衣服怎么洗？有烘干吗？",
    "aliases": [
      "洗衣机在哪里，怎么用？",
      "有烘干机吗，洗完能烘吗？",
      "下雨衣服干不了，有办法吗？"
    ]
  },
  {
    "id": "Q21",
    "question": "押金什么时候退？怎么退？",
    "aliases": [
      "我的押金怎么还没退？",
      "离店后保证金多久到账？",
      "押金会退回哪个账户？"
    ]
  },
  {
    "id": "Q22",
    "question": "退房超时了怎么收费？能延到下午吗？",
    "aliases": [
      "晚两小时退房要多少钱？",
      "下午再走可以吗？",
      "超过退房时间有宽限吗？"
    ]
  },
  {
    "id": "Q23",
    "question": "东西落在房间怎么办？能寄回吗？",
    "aliases": [
      "孩子的玩偶落在房里了怎么办？",
      "耳机忘拿了，可以寄回来吗？",
      "我退房了，能帮忙找行李吗？"
    ]
  },
  {
    "id": "Q24",
    "question": "厨房没清理/房间弄脏会被扣费吗？标准是什么？",
    "aliases": [
      "锅没洗会扣多少钱？",
      "厨房没收拾算额外清洁吗？",
      "房间弄脏了，清洁费怎么算？"
    ]
  },
  {
    "id": "Q25",
    "question": "发票多久开出来？开错了怎么办？",
    "aliases": [
      "发票抬头开错了能重开吗？",
      "报销发票一直没收到怎么办？",
      "开票进度在哪里查？"
    ]
  },
  {
    "id": "Q26",
    "question": "退房后能帮忙叫车/送站吗？",
    "aliases": [
      "退房能帮我叫车去车站吗？",
      "下午三点航班，四个人能送机吗？",
      "离店拼车怎么约？"
    ]
  },
  {
    "id": "Q27",
    "question": "对服务不满意找谁？有补偿吗？",
    "aliases": [
      "热水一直有问题，我想退钱",
      "服务不好找谁投诉？",
      "这次不满意能补偿多少？"
    ]
  },
  {
    "id": "Q28",
    "question": "下次来有老客优惠吗？怎么订？",
    "aliases": [
      "我是老客，下次订能便宜吗？",
      "回头客有折扣或升房吗？",
      "老客户怎么预订，有优惠券吗？"
    ]
  },
  {
    "id": "Q29",
    "question": "设施损坏被要求赔偿怎么界定？",
    "aliases": [
      "说墙弄脏了让我赔，合理吗？",
      "设备坏了怎么区分正常损耗？",
      "我不同意损坏赔偿，能复核吗？"
    ]
  },
  {
    "id": "Q30",
    "question": "退房后有问题还能找到管家吗？",
    "aliases": [
      "退房后还能联系管家吗？",
      "离店有问题在哪里找人？",
      "半夜有售后问题找谁？"
    ]
  }
];
const MIXED = [
  {
    "input": "明早十点到，能提前入住吗？停车收费吗，有充电桩吗？",
    "expected": [
      "Q04",
      "Q03"
    ]
  },
  {
    "input": "含早餐吗，晚上可以在厨房做饭吗，厨房被占了怎么办？",
    "expected": [
      "Q07",
      "Q17"
    ]
  },
  {
    "input": "洗衣机总被占，衣服洗完有烘干吗？",
    "expected": [
      "Q17",
      "Q20"
    ]
  },
  {
    "input": "热水不热还一直停电，我不满意想退钱",
    "expected": [
      "Q12",
      "Q11",
      "Q27"
    ]
  },
  {
    "input": "WiFi密码和大门门锁密码直接发我，我也想看附近怎么玩",
    "expected": [
      "Q13",
      "Q02",
      "Q19"
    ]
  },
  {
    "input": "孩子玩偶忘房间了，退房后还能找谁，能寄回吗？",
    "expected": [
      "Q23",
      "Q30"
    ]
  },
  {
    "input": "发票抬头错了，押金也没到账",
    "expected": [
      "Q25",
      "Q21"
    ]
  },
  {
    "input": "下雨带孩子只玩半天，不爬山，想体验唐卡，能帮我预约吗？",
    "expected": [
      "Q19"
    ]
  },
  {
    "input": "照片不符我想换房，隔壁也很吵，可以赔钱吗？",
    "expected": [
      "Q08",
      "Q18",
      "Q27"
    ]
  },
  {
    "input": "锅没洗说要扣押金，还说墙脏让我赔，能复核吗？",
    "expected": [
      "Q24",
      "Q21",
      "Q29"
    ]
  }
];
const api = await import('../src/qinghuan.mjs').catch(() => null);
function loaded() {
  assert.ok(api, '清欢公开指南模块尚未实现');
  return api;
}
function property() { return {knowledge: structuredClone(loaded().QINGHUAN_QUESTIONS)}; }
function ids(p, question) { return loaded().matchQinghuanGuides(p, question).map(x => x.id).sort(); }

for (const fixture of CASES) {
  test(`交通原问与其他30题精确匹配各自唯一题号：${fixture.id}`, () => {
    assert.deepEqual(ids(property(), fixture.question), [fixture.id]);
  });
  for (const alias of fixture.aliases) {
    test(`自然别名保持独立意图：${fixture.id} ${alias}`, () => {
      assert.deepEqual(ids(property(), alias), [fixture.id]);
    });
  }
}
for (const fixture of MIXED) {
  test(`混合意图覆盖所有诉求且不附带无关指南：${fixture.input}`, () => {
    assert.deepEqual(ids(property(), fixture.input), [...fixture.expected].sort());
  });
}

test('只在当前房源已发布knowledge中检索这套指南', () => {
  const {matchQinghuanGuides} = loaded();
  for (const p of [undefined, {}, {knowledge: []}, {draft: {knowledge: property().knowledge}}, {knowledge: [{id:'Q01', kind:'ordinary', question: CASES[0].question, aliases:[], text:'另一家自己的FAQ'}]}]) {
    assert.deepEqual(matchQinghuanGuides(p, CASES[0].question), []);
  }
});

test('已删除指南不能回落到内置全集或其他房源条目', () => {
  const p = property();
  p.knowledge = p.knowledge.filter(x => x.id !== 'Q13');
  assert.deepEqual(ids(p, 'WiFi连接不上该怎么办？'), []);
  assert.deepEqual(ids(p, CASES[12].question), []);
});

test('匹配返回当前已发布对象，保留人工确认后的内容和状态', () => {
  const p = property(), guide = p.knowledge.find(x => x.id === 'Q03');
  guide.text = '已由商家确认：请使用订单中提供的停车场，费用按场内公示。';
  guide.requiresHuman = false;
  const result = loaded().matchQinghuanGuides(p, CASES[2].question);
  assert.equal(result.length, 1);
  assert.equal(result[0], guide);
  assert.equal(result[0].requiresHuman, false);
  assert.match(result[0].text, /已由商家确认/);
});

test('大小写、全角字符与中英文问号空白不会改变WiFi指南归属', () => {
  assert.deepEqual(ids(property(), '  ＷｉＦｉ连不上/网速慢怎么办 ?  '), ['Q13']);
});

test('包含完整共享设施原问再询问开票时，不将原题的洗衣词重复拆成洗衣指南', () => {
  assert.deepEqual(ids(property(), CASES[16].question + ' 另外能开发票吗？'), ['Q10','Q17']);
});

test('包含完整入住原问再问停车时，不把原题晚退重复拆成超时计费', () => {
  assert.deepEqual(ids(property(), CASES[3].question + ' 另外停车免费吗？'), ['Q03','Q04']);
});

test('售后、找房、押金、退改和洗衣占用保持具体边界', () => {
  const p = property();
  for (const [question, expected] of [
    ['退房后还能找到管家吗？', ['Q30']],
    ['房费之外有押金和清洁费吗，取消订单如何退改？', ['Q05']],
    ['发票报销一直没有收到，能查询一下进度吗？', ['Q25']],
    ['洗衣机总被其他客人占着，能协调吗？', ['Q17']],
    ['延迟两小时退房怎么收费？', ['Q22']],
    ['我想提前入住，另外停车收费吗？', ['Q03','Q04']],
    ['雨季房间很潮，有除湿机吗？', ['Q09']],
    ['下雨天附近能去哪玩？', ['Q19']]
  ]) assert.deepEqual(ids(p, question), expected, question);
});

test('公开资料保持30个唯一问题和90个唯一别名，含逐题确认清单和公开来源', () => {
  const {QINGHUAN_QUESTIONS} = loaded();
  assert.equal(QINGHUAN_QUESTIONS.length, 30);
  const normalized = new Set();
  for (const guide of QINGHUAN_QUESTIONS) {
    assert.equal(guide.kind, 'confirmation_guide');
    assert.equal(guide.requiresHuman, true);
    assert.equal(guide.aliases.length, 3);
    assert.ok(guide.text.length > 60 && guide.text.length <= 1000);
    assert.ok(guide.confirmationChecklist.length > 20);
    assert.match(guide.sourceLabel, /^清欢30问 · Q\d{2}$/);
    assert.match(guide.sourceRange, /^30问总表!/);
    assert.ok(['入住前','入住中','退房后'].includes(guide.phase));
    for (const value of [guide.question, ...guide.aliases]) {
      const key = value.normalize('NFKC').replace(/[\s？?。！!，,、]/g, '').toLowerCase();
      assert.ok(!normalized.has(key), `重复问法：${value}`);
      normalized.add(key);
    }
  }
  assert.equal(normalized.size, 120);
});

test('公开资料不携带本机路径、内部SOP、岗位频次或示例金额时效', () => {
  const {QINGHUAN_QUESTIONS} = loaded();
  const serialized = JSON.stringify(QINGHUAN_QUESTIONS);
  assert.doesNotMatch(serialized, /\/Users\/|\/private\/|内部SOP|原责任岗位|咨询量|原L列|原M列/);
  assert.doesNotMatch(QINGHUAN_QUESTIONS.find(x => x.id === 'Q24').text, /50|200|五十|二百/);
  assert.doesNotMatch(QINGHUAN_QUESTIONS.find(x => x.id === 'Q25').text, /1[—至-]3|一[至到]三/);
});
