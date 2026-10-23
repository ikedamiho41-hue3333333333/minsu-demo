import test from 'node:test';
import assert from 'node:assert/strict';
let api={};
try { api=await import('../src/content.mjs'); } catch(e) { if(e.code!=='ERR_MODULE_NOT_FOUND')throw e; }
const scope={propertyId:'qinghuan-dali',cityId:'dali'};
const answer=(q,context=null)=>api.answerContent?.(q,{...scope,context});

test('清欢来源资料只在清欢大理范围可用，其他民宿不混入',()=>{
 assert.ok(api.contentFor?.('qinghuan-dali','dali')?.places?.length>=66);
 assert.equal(api.contentFor('lake-inn','dali'),null);
 assert.equal(api.contentFor('qinghuan-dali','moganshan'),null);
});
test('地点搜索支持八类和文字，空结果不回落成通用推荐',()=>{
 assert.ok(api.findPlaces?.({...scope,query:'寂照庵'}).some(p=>p.name.includes('寂照庵')));
 assert.ok(api.findPlaces({...scope,category:'coffee'}).every(p=>p.category==='coffee'));
 assert.deepEqual(api.findPlaces({...scope,query:'不存在的门店XYZ'}),[]);
 assert.deepEqual(api.findPlaces({propertyId:'lake-inn',cityId:'dali'}),[]);
});
test('五路线站点与雨天备选均引用现有地点，了巴两个体验段复用同一地点',()=>{
 const c=api.contentFor?.('qinghuan-dali','dali');assert.equal(c?.routes?.length,5);
 for(const r of c.routes)for(const s of r.stops)assert.ok(api.placeById(s.placeId,scope),r.title);
 const r=c.routes.find(r=>r.title.includes('生活家'));
 const labas=r.stops.filter(s=>api.placeById(s.placeId,scope).name.includes('了巴'));
 assert.equal(labas.length,2);assert.equal(labas[0].placeId,labas[1].placeId);
 assert.equal(c.rainPlaceIds.length,3);
});
test('地点上下文回答当前对象，价格和预约合问均保留未知，不抄原稿金额',()=>{
 const p=api.findPlaces?.({...scope,query:'了巴'})?.[0];assert.ok(p);
 const context=api.makeContentContext('place',p.id,scope),a=answer('多少钱，需要预约吗？',context);
 assert.match(a.body,/了巴/);assert.match(a.body,/价格|费用/);assert.match(a.body,/预约/);assert.match(a.body,/待确认|待核验|未核实/);
 assert.doesNotMatch(a.body,/(?:88|98|168|368)\s*元/);assert.ok(a.refs.every(r=>r.source));
});
test('半天亲子问题不把完整一日路线声称适合半天完成',()=>{
 const a=answer('带孩子只有半天怎么玩？');assert.ok(a);
 assert.match(a.body,/亲子|非遗|指尖/);assert.match(a.body,/半天/);assert.match(a.body,/完整一天|一日|整天/);
 assert.match(a.body,/一站|部分|缩减|不能/);assert.doesNotMatch(a.body,/半天.*(?:走完|全部完成)/);
});
test('雨天自然出游不承诺照常走完整户外路线，给出三处备选来源',()=>{
 const a=answer('下雨了，不想爬山，去哪玩？');assert.ok(a);
 assert.match(a.body,/云舟/);assert.match(a.body,/图书馆/);assert.match(a.body,/花房/);
 assert.match(a.body,/核实|确认/);assert.doesNotMatch(a.body,/不受天气影响|雨天照常/);
});
test('活动日历查询可看九条来源线索，但今天实际场次不能由周期推算',()=>{
 const a=answer('今天三月街有什么活动，几点报名？');assert.ok(a);
 assert.match(a.body,/三月街/);assert.match(a.body,/场次|当期|日期/);assert.match(a.body,/未核实|待确认|待核验/);
 assert.doesNotMatch(a.body,/今天\d|已报名|已预约|报名成功/);
 const c=api.contentFor('qinghuan-dali','dali');assert.equal(c.activityLeads.length,9);
});
test('过期或跨房源的上下文不可引用清欢对象',()=>{
 assert.equal(api.makeContentContext?.('place','missing',scope),null);
 assert.equal(api.makeContentContext('place','missing',{propertyId:'lake-inn',cityId:'dali'}),null);
 const p=api.findPlaces({...scope,query:'寂照庵'})[0];const ctx=api.makeContentContext('place',p.id,scope);
 assert.equal(api.answerContent('这家怎么样',{propertyId:'lake-inn',cityId:'dali',context:ctx}),null);
 assert.equal(api.answerContent('这家怎么样',{propertyId:'qinghuan-dali',cityId:'moganshan',context:ctx}),null);
});
test('问题具名新地点时采用新对象，原来对象不能覆盖明确提问',()=>{
 const p=api.findPlaces?.({...scope,query:'寂照庵'})?.[0];assert.ok(p);
 const a=answer('了巴空间课程多少钱？',api.makeContentContext('place',p.id,scope));
 assert.match(a.body,/了巴/);assert.doesNotMatch(a.body,/寂照庵.*课程/);assert.match(a.body,/待确认|待核验|未核实/);
});
test('清欢资料问答不把店规问题或未知店名编成攻略，内部处置信息不参与',()=>{
 const a=answer('这家民宿能带宠物吗，门锁密码多少？');assert.ok(a);
 assert.match(a.body,/民宿管家|入住规则/);assert.doesNotMatch(a.body,/50元|补偿授权|每日3次|门锁密码是/);
 const missing=answer('不存在的门店XYZ几点开门？');assert.match(missing.body,/没有|未找到|未收录/);
});
test('本地生活会话按房源隔离，旧示例会话键保留兼容',()=>{
 assert.equal(api.lifeChatKey?.('session','dali','lake-inn'),'session:dali:lake-inn');
 assert.equal(api.lifeChatKey('session','dali','qinghuan-dali'),'session:dali:qinghuan-dali');
 assert.notEqual(api.lifeChatKey('session','dali','lake-inn'),api.lifeChatKey('session','dali','qinghuan-dali'));
});
test('选中地点后改问未收录咖啡馆，不沿用旧对象或推荐其他店冒充答案',()=>{
 const ctx=api.makeContentContext('place','qh-laba-space',scope);
 for(const context of [ctx,null]){
  const a=answer('不存在的XYZ咖啡馆几点开门？',context);
  assert.match(a.body,/没有|未找到|未收录/);assert.doesNotMatch(a.body,/了巴|山那边/);assert.equal(a.context,null);
 }
 const a=answer('蓝瓶咖啡几点关门？');assert.match(a.body,/没有|未找到|未收录/);assert.equal(a.refs.length,0);
});
test('否定旧地点并改问咖啡方向时清除原对象，仍能给来源候选',()=>{
 const a=answer('不问了巴了，附近还有什么咖啡？',api.makeContentContext('place','qh-laba-space',scope));
 assert.doesNotMatch(a.body,/了巴/);assert.match(a.body,/咖啡/);assert.ok(a.refs.length>0);assert.equal(a.context,null);
});
test('有自然路线上下文的雨天不爬山追问给备选，不继续列户外全线',()=>{
 const route=api.contentFor('qinghuan-dali','dali').routes.find(r=>r.title.includes('苍洱自然'));
 const a=answer('下雨了，不想爬山，去哪玩？',api.makeContentContext('route',route.id,scope));
 assert.match(a.body,/云舟/);assert.match(a.body,/图书馆/);assert.match(a.body,/花房/);assert.doesNotMatch(a.body,/06:30|09:30|15:30/);
});
test('具名地点仍保留雨天、半天和带孩子三个条件',()=>{
 const a=answer('我要带孩子半天去寂照庵，下雨的话怎么办？');
 assert.match(a.body,/寂照庵/);assert.match(a.body,/雨天|下雨/);assert.match(a.body,/云舟/);assert.match(a.body,/半天/);assert.match(a.body,/孩子|儿童|亲子/);
});
test('跨地点与活动的合问逐项覆盖，不任取一种实体并污染下次上下文',()=>{
 const a=answer('寂照庵和了巴空间有哪些要留意的，三月街今天有活动吗？');
 assert.match(a.body,/寂照庵/);assert.match(a.body,/了巴/);assert.match(a.body,/三月街/);assert.equal(a.context,null);
 assert.ok(a.refs.some(r=>r.label.includes('寂照庵')));assert.ok(a.refs.some(r=>r.label.includes('了巴')));
});
test('今天的亲子半天出游不是泛活动日历问题',()=>{
 const a=answer('今天带孩子只有半天，怎么玩？');
 assert.match(a.body,/非遗|亲子|指尖/);assert.match(a.body,/半天/);assert.doesNotMatch(a.body,/以下9条/);
});
for(const q of ['这家多少钱？','这家怎么样？','这个地方怎么去？','那怎么去？','预约呢？','要提前预约吗？'])test(`所选地点的常用短追问保持对象：${q}`,()=>{
 const a=answer(q,api.makeContentContext('place','qh-laba-space',scope));
 assert.match(a.body,/了巴/);assert.ok(a.refs.length);assert.equal(a.context?.id,'qh-laba-space');
});
test('从亲子路线追问半天雨天条件时仍标明所选路线',()=>{
 const route=api.contentFor('qinghuan-dali','dali').routes.find(r=>r.title.includes('指尖传承'));
 const a=answer('带孩子只有半天，下雨了不想爬山，怎么安排？',api.makeContentContext('route',route.id,scope));
 assert.match(a.body,/指尖传承/);assert.match(a.body,/半天/);assert.match(a.body,/花房/);assert.equal(a.context?.id,route.id);
});
test('同名市场地点和活动线索只保留本次活动对象，后续刷新可延续',()=>{
 const a=answer('今天三月街几点报名？',api.makeContentContext('activity-lead','qh-lead-sanyuejie',scope));
 assert.equal(a.context?.id,'qh-lead-sanyuejie');assert.equal(a.refs.length,1);assert.match(a.body,/未核实/);
});
