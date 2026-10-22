import test from 'node:test';
import assert from 'node:assert/strict';
import * as catalog from '../src/catalog.mjs';

test('清欢独立资料入口含30条接待指引，不复制虚构房间和店规',()=>{
 const w=catalog.createWorkspace(),p=w.properties['qinghuan-dali'];
 assert.equal(p?.state.published.knowledge.length,30);
 assert.equal(p.rentalMode,'pending');
 assert.deepEqual(p.state.published.rooms,[]);
 assert.deepEqual(p.state.published.facts,{});
 assert.deepEqual(catalog.shareUnits(w,'qinghuan-dali'),[]);
 assert.match(p.state.published.name,/清欢/);
 assert.ok(p.state.published.knowledge.every(k=>k.requiresHuman===true));
 assert.equal(catalog.resolveTarget(w,'?property=qinghuan-dali').ok,true);
 assert.equal(catalog.resolveTarget(w,'?property=qinghuan-dali&unit=whole&share=1').ok,false);
 assert.throws(()=>catalog.updateRentalMode(w,'qinghuan','qinghuan-dali','whole'),/房间资料|房源配置/);
});
test('旧浏览器补入清欢资料时不覆盖任何旧房源、问答、会话；重复加载不重新导入',()=>{
 const old=catalog.createWorkspace();delete old.properties['qinghuan-dali'];delete old.merchants.qinghuan;
 old.properties['lake-inn'].state.draft.name='用户原有的草稿名字';
 const prior=JSON.stringify(old.properties);
 const upgraded=catalog.ensureQinghuanWorkspace?.(old);
 assert.equal(upgraded?.properties['qinghuan-dali']?.state.published.knowledge.length,30);
 const rest=structuredClone(upgraded.properties);delete rest['qinghuan-dali'];
 assert.equal(JSON.stringify(rest),prior);
 assert.equal(old.properties['qinghuan-dali'],undefined);
 upgraded.properties['qinghuan-dali'].state.draft.knowledge[0].text='商家尚未发布的新草稿';
 assert.strictEqual(catalog.ensureQinghuanWorkspace(upgraded),upgraded);
});
