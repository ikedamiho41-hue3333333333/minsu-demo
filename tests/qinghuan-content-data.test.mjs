import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const dataPath = new URL('../src/qinghuan-content.json', import.meta.url);
function content() {
  assert.ok(existsSync(dataPath), '清欢来源资料JSON尚未整理');
  return JSON.parse(readFileSync(dataPath, 'utf8'));
}

// Independently checked against 全部点位!C2:C67, in original row order.
const GUIDE_NAMES = [
  '村民食堂（小院子店）','万食·蕃秀','寨门往事非遗主题餐厅','瑞丰园庭院餐厅','杨记白族饭店',
  '大理荷花园餐厅','观音塘美食一条街','清真美食一条街','Compound6 柴窑火食','大意意大利餐厅（左岸高地店）',
  '一乐厨房·粤菜餐厅','向月球飞去（左岸店）','放松嘎·泰食餐厅（左岸高地店）','小院私厨（苍海一墅店）','大理苍绿苑白族餐厅',
  '山那边咖啡家具馆','小满空间','WonderWander Coffee 玩豆咖啡（苍山店）','印象庄园 veltro 灰猎犬咖啡烘焙梦工厂','Zen Brew 醍一醐咖啡',
  '观音塘慈咖啡','楸园咖啡 CAFE','有风小院（下午茶）','意乐空间','咖蓝 coffee','iL HAZEL 榛里咖啡（左岸高地店）',
  'Gold 金子咖啡甜品','山下茶院','文鹤茶业','三内可颂 / 胖虎面包','绿马手作（缘马手作）','植白扎染·手创蓝染工作室',
  '蓝续扎染（多店）','星回精酿啤酒工厂','花满楼（Happymiss 鲜花饼）','泡泡去浪俱乐部','苍山公共图书馆','文创空间',
  '小巷子音乐厅','杨丽萍大剧院','大理床单厂艺术区','张家花园','寂照庵','观音塘（观音堂）','感通寺','感通索道',
  '洗马潭索道','网红公路（苍洱大道）','洱海生态廊道','龙龛码头','大理实力希尔顿酒店','观海健身房','小院便利店',
  '观音塘菜场','三月街集市','古城南门绿玉菜场','古城北门菜场','收获咖啡 Harvest Reserve','朴石烘焙 Simple Stone',
  '与山面包','仰苍精酿','以勒餐厅','跳房子咖啡','打酱油农场商店','南五里桥美食一条街','清真一条街（苍洱大道下段）'
];
const EXTRA_NAMES = ['云舟文澜','利舍庄园','凤阳邑','随春醒农场餐厅','清碧溪','周一闭馆书店','左岸高地','塔里唐卡店','了巴空间','三文笔村','菩提唐卡工作室','香格里拉唐卡美术馆','一十岩彩','小路书屋','囍书','六尺咖啡','野鸭塘河谷咖啡','悉隐艺术','利舍花房'];
const THEME_FILE = '大理小院子南区五大主题一日定制游.pptx';

function sourceRefs(value) {
  assert.ok(Array.isArray(value.sourceRefs) && value.sourceRefs.length > 0, value.id);
  for (const ref of value.sourceRefs) {
    assert.deepEqual(Object.keys(ref).sort(), ['file','location']);
    assert.ok(ref.file.length > 0 && ref.location.length > 0, value.id);
    assert.doesNotMatch(ref.file, /\/Users\/|\/private\/|data:|base64/i);
  }
}

test('数据接口、8类与所有候选的状态和来源均完整', () => {
  const d = content();
  assert.deepEqual(Object.keys(d).sort(), ['activityLeads','categories','places','rainPlaceIds','routes','version']);
  assert.equal(d.version, '0.4.3');
  assert.deepEqual(d.categories, [
    {id:'food',label:'餐饮'},{id:'coffee',label:'咖啡'},{id:'craft',label:'手作'},{id:'culture',label:'文化'},
    {id:'nature',label:'山水'},{id:'community',label:'酒店配套'},{id:'market',label:'市场'},{id:'university',label:'大学周边'}
  ]);
  assert.equal(d.places.length, 85, '来源记录与候选数，不等于独立商户数');
  assert.equal(new Set(d.places.map(x=>x.id)).size, d.places.length);
  for (const p of d.places) {
    for (const key of ['id','name','aliases','category','summary','locationText','sourceRefs','status','origin','notes']) assert.ok(key in p, `${p.id}:${key}`);
    assert.ok(d.categories.some(x=>x.id===p.category), p.id);
    assert.equal(p.status, 'pending', p.id);
    assert.ok(['guide','theme','radar','rain'].includes(p.origin), p.id);
    assert.ok(Array.isArray(p.aliases) && Array.isArray(p.notes), p.id);
    assert.ok(p.name && p.summary && p.locationText, p.id);
    sourceRefs(p);
    assert.ok(!('lat' in p) && !('lng' in p) && !('coordinates' in p), p.id);
  }
});

test('攻略保留全部66行原名与行号，引用可回到原始单元格', () => {
  const places = content().places.filter(x=>x.origin==='guide').sort((a,b)=>a.sourceRow-b.sourceRow);
  assert.deepEqual(places.map(x=>x.name), GUIDE_NAMES);
  assert.deepEqual(places.map(x=>x.sourceRow), Array.from({length:66},(_,i)=>i+2));
  for (const p of places) assert.ok(p.sourceRefs.some(x=>x.file==='大理小院子南区周边吃喝玩乐游攻略.xlsx' && x.location===`全部点位!A${p.sourceRow}:J${p.sourceRow}`), p.name);
  assert.deepEqual(places.map(x=>x.category).reduce((o,x)=>(o[x]=(o[x]||0)+1,o),{}), {food:15,coffee:15,craft:6,culture:6,nature:8,community:3,market:4,university:9});
});

test('66行的介绍、地址、原营业、原价格、联系方式、预约与贴士逐字保留', () => {
  // SHA256 of source XML rows 2–67: [row,C,D,E,F,H,G,I,J], UTF-8 compact JSON.
  // This fixture was extracted independently from the source XLSX, not production JSON.
  const original=content().places.filter(x=>x.origin==='guide').sort((a,b)=>a.sourceRow-b.sourceRow).map(x=>[
    x.sourceRow,x.name,x.summary,x.locationText,x.hoursOriginal,x.priceOriginal,x.contactOriginal,x.reservationOriginal,
    x.notes.find(n=>n.startsWith('原表贴士：'))?.slice('原表贴士：'.length)
  ]);
  assert.equal(createHash('sha256').update(JSON.stringify(original)).digest('hex'),'fff5d8059fef188b2105b8a0e2cd3d582696af5d3c132fbcb72049d6d12a2f1a');
});

test('清真街疑似重复和多店、复合名称保留来源粒度', () => {
  const p=content().places;
  const first=p.find(x=>x.sourceRow===9), last=p.find(x=>x.sourceRow===67);
  assert.notEqual(first.id,last.id);
  assert.ok(first.duplicateGroup && first.duplicateGroup===last.duplicateGroup);
  for (const x of [first,last]) assert.match(x.notes.join(' '), /疑似重复|待确认/);
  assert.match(p.find(x=>x.sourceRow===34).notes.join(' '), /多店/);
  assert.match(p.find(x=>x.sourceRow===31).notes.join(' '), /复合|组合|多店/);
  assert.equal(p.find(x=>x.sourceRow===4).priceOriginal, '火塘体验');
  assert.equal(p.find(x=>x.sourceRow===7).priceOriginal, '只做午餐');
});

test('补齐9个主题主线、可选区域、8个新增雷达与雨天花房，唐卡命名不重复建店', () => {
  const p=content().places.filter(x=>x.origin!=='guide');
  assert.deepEqual(p.map(x=>x.name).sort(), [...EXTRA_NAMES].sort());
  assert.equal(p.filter(x=>x.origin==='theme').length,10);
  assert.equal(p.filter(x=>x.origin==='radar').length,8);
  assert.equal(p.filter(x=>x.origin==='rain').length,1);
  const tangka=p.find(x=>x.name==='塔里唐卡店');
  assert.ok(tangka.aliases.includes('塔理唐卡店'));
  assert.ok(tangka.sourceRefs.some(x=>x.file===THEME_FILE && x.location==='第19页·特色店雷达'));
  assert.match(p.find(x=>x.name==='利舍花房').notes.join(' '), /利舍庄园|内部空间/);
});

test('5条路线忠实保留原幻灯片15段时间轴，了巴复用地点且尾站可选', () => {
  const d=content(), byId=new Map(d.places.map(x=>[x.id,x]));
  assert.equal(d.routes.length,5);
  assert.equal(new Set(d.routes.map(x=>x.id)).size,5);
  const expected=[
    ['人文大理·佛国烟火',6,[['寂照庵','09:00','约2.5小时'],['云舟文澜','13:30','约1.5小时'],['利舍庄园','16:00','约2小时']]],
    ['非遗大理·指尖传承',9,[['凤阳邑','09:30','约2.5小时'],['植白扎染·手创蓝染工作室','13:00','约2小时'],['随春醒农场餐厅','17:00','约1.5小时']]],
    ['苍洱自然·山海之间',12,[['龙龛码头','06:30','约2小时'],['清碧溪','09:30','约3小时'],['洱海生态廊道','15:30','约2.5小时']]],
    ['社交交友·同频相遇',15,[['周一闭馆书店','10:00','约2小时'],['村民食堂（小院子店）','12:00','约1.5小时'],['左岸高地','17:00','约3小时']]],
    ['人文大理游·一日人文生活家',17,[['塔里唐卡店','09:30','约2.5小时'],['了巴空间','12:30','约1.5小时'],['了巴空间','14:30','约2小时']]]
  ];
  for (const [title,page,stops] of expected) {
    const route=d.routes.find(x=>x.title===title);
    assert.ok(route,title); assert.equal(route.status,'pending');
    assert.ok(route.audience.length && route.summary && Array.isArray(route.notes)); sourceRefs(route);
    assert.ok(route.sourceRefs.some(x=>x.file===THEME_FILE && x.location===`第${page}页·时间轴`));
    assert.deepEqual(route.stops.filter(x=>!x.optional).map(x=>[byId.get(x.placeId)?.name,x.arrival,x.duration]),stops);
    assert.match(route.notes.join(' '), /建议到达|集合|发车/);
    for (const s of route.stops) { assert.ok(byId.has(s.placeId)); assert.equal(typeof s.optional,'boolean'); assert.ok(s.label); }
  }
  const final=d.routes.at(-1);
  assert.equal(final.stops[1].placeId,final.stops[2].placeId);
  assert.equal(final.stops.at(-1).optional,true);
  assert.equal(byId.get(final.stops.at(-1).placeId).name,'三文笔村');
  assert.equal(final.stops.at(-1).arrival,'17:00后');
  assert.equal(d.routes.flatMap(x=>x.stops).filter(x=>!x.optional).length,15);
});

test('三处雨天候选来源清晰，不为五条线路造完整雨天替代', () => {
  const d=content(); assert.equal(d.rainPlaceIds.length,3);
  const rain=d.rainPlaceIds.map(id=>d.places.find(x=>x.id===id));
  assert.deepEqual(rain.map(x=>x.name),['云舟文澜','苍山公共图书馆','利舍花房']);
  for (const p of rain) assert.ok(p.sourceRefs.some(x=>x.file===THEME_FILE && x.location==='第13页·雨天备选'));
});

test('9条活动来源保留周期含不定期，不伪造具体场次、当期日期或报名状态', () => {
  const leads=content().activityLeads;
  assert.equal(leads.length,9);
  assert.deepEqual(leads.map(x=>x.title),['匠志集市','天外喜剧·脱口秀','灵感食堂','洋人街市集','寻光农场面包市集','柴多米市集','三月街','白族火把节','凤阳邑“心”市集']);
  assert.equal(new Set(leads.map(x=>x.id)).size,9);
  for (const x of leads) {
    assert.deepEqual(Object.keys(x).sort(),['frequency','id','locationText','sourceRefs','status','summary','title']);
    assert.equal(x.status,'pending'); assert.ok(x.frequency && x.locationText && x.summary); sourceRefs(x);
    assert.ok(x.sourceRefs.some(s=>s.file===THEME_FILE && s.location==='第21页·大理每周活动日历'));
    assert.doesNotMatch(JSON.stringify(x),/20\d{2}-\d{2}-\d{2}|"active"|"startAt"|"startsAt"|"eventDate"/);
  }
  assert.ok(leads.some(x=>/不定期/.test(x.frequency)));
  assert.match(leads.find(x=>x.title==='三月街').summary,/冲突|不一致|待核实/);
});

test('重要冲突保留多版本与待确认说明，不从原稿选择确定经营值', () => {
  const d=content(), p=d.places;
  const laba=p.find(x=>x.name==='了巴空间');
  assert.match(laba.priceOriginal,/88/); assert.match(laba.priceOriginal,/48.*68.*108/);
  assert.match(laba.notes.join(' '), /98/); assert.match(laba.notes.join(' '), /双人|计价单位/);
  assert.match(laba.notes.join(' '), /摄影/); assert.match(laba.notes.join(' '), /冲突|不一致/);
  assert.match(p.find(x=>x.name==='寂照庵').notes.join(' '), /预约.*冲突|冲突.*预约/);
  assert.match(p.find(x=>x.name==='三月街集市').notes.join(' '), /初二.*初九.*十六.*二十三/);
  assert.match(p.find(x=>x.name==='三月街集市').notes.join(' '), /二七|逢二.*七/);
  assert.match(p.find(x=>x.name==='小院便利店').notes.join(' '), /08:00-22:00/);
  assert.match(p.find(x=>x.name==='小院便利店').notes.join(' '), /24小时|24 小时/);
  assert.match(p.find(x=>x.name==='有风小院（下午茶）').notes.join(' '), /9.*免排队|09:00.*免排队/);
  assert.match(d.routes.find(x=>x.title==='苍洱自然·山海之间').notes.join(' '), /零门票/);
  for (const r of d.routes) assert.match(r.notes.join(' '), /20分钟|20 分钟/);
  for (const name of ['大理实力希尔顿酒店','观海健身房','村民食堂（小院子店）']) assert.match(p.find(x=>x.name===name).notes.join(' '), /第三方|房费|权益/);
});
