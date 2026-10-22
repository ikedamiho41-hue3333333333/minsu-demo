import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace,shareUnits,shareUrl,resolveTarget,replaceProperty,updateRentalMode} from '../src/catalog.mjs';
import {createSeed,answer} from '../src/model.mjs';
test('按间经营分别生成房间单元，整院经营只分享整院',()=>{
 const w=createWorkspace();
 assert.deepEqual(shareUnits(w,'lake-inn').map(u=>u.id),['sea-king','sea-twin']);
 assert.deepEqual(shareUnits(w,'mountain-yard').map(u=>u.id),['whole']);
 assert.match(shareUnits(w,'mountain-yard')[0].description,/2间卧室/);
});
test('房间分享链接直接指向该房间客户端，不带商家后台路由',()=>{
 const w=createWorkspace(),s=shareUrl(w,{merchantId:'lake',propertyId:'lake-inn',unitId:'sea-twin',baseUrl:'http://127.0.0.1:5290/?old=1#/merchant/home'});
 const u=new URL(s);assert.equal(u.searchParams.get('property'),'lake-inn');assert.equal(u.searchParams.get('unit'),'sea-twin');assert.equal(u.searchParams.get('share'),'1');assert.equal(u.hash,'#/guest/home');
 assert.equal(resolveTarget(w,u.search).unitId,'sea-twin');
});
test('不能替其他商家生成链接，也不生成已隐藏房源的链接',()=>{
 const w=createWorkspace();assert.throws(()=>shareUrl(w,{merchantId:'mountain',propertyId:'lake-inn',unitId:'sea-twin',baseUrl:'http://localhost/'}),/商家/);
 w.properties['lake-inn'].state.visible=false;
 assert.throws(()=>shareUrl(w,{merchantId:'lake',propertyId:'lake-inn',unitId:'sea-twin',baseUrl:'http://localhost/'}),/暂停/);
});
test('错误房源或已不匹配的出租单元不会偷偷切到其他房源',()=>{
 const w=createWorkspace();
 assert.equal(resolveTarget(w,'?property=missing&unit=whole&share=1').ok,false);
 assert.equal(resolveTarget(w,'?property=mountain-yard&unit=sea-twin&share=1').ok,false);
});
test('修改当前房源不会覆盖其他商家资料，也不修改输入状态',()=>{
 const w=createWorkspace(),before=JSON.stringify(w),next=structuredClone(w.properties['lake-inn'].state);next.draft.name='新名称';next.revision++;
 const result=replaceProperty(w,'lake-inn',next);
 assert.equal(result.properties['lake-inn'].state.draft.name,'新名称');assert.equal(result.properties['mountain-yard'].state.draft.name,'苍山慢住 · 松风院');
 assert.equal(JSON.stringify(w),before);
});
test('旧版资料单独保留，不写回旧数据，不与大理示例混用',()=>{
 const legacy=createSeed(),before=JSON.stringify(legacy),w=createWorkspace(legacy);
 assert.equal(w.properties['legacy'].state.propertyId,'songjian-demo');
 assert.equal(w.properties['legacy'].city.id,'moganshan');
 assert.equal(JSON.stringify(legacy),before);
});
test('经营方式按房源配置，切换成整院后旧房间分享链接明确失效',()=>{
 const w=updateRentalMode(createWorkspace(),'lake','lake-inn','whole');
 assert.deepEqual(shareUnits(w,'lake-inn').map(u=>u.id),['whole']);
 assert.equal(resolveTarget(w,'?property=lake-inn&unit=sea-twin&share=1').ok,false);
 assert.throws(()=>updateRentalMode(w,'mountain','lake-inn','room'),/商家/);
});
test('整院咨询依据整院配置回答卧室数量和入住建议',()=>{
 const s=createWorkspace().properties['mountain-yard'].state;
 const a=answer(s,'整院有几间卧室，可以住几个人');
 assert.equal(a.status,'answered');assert.match(a.body,/2间卧室/);assert.match(a.body,/4人/);
 assert.equal(a.sources[0].key,'whole');
});
