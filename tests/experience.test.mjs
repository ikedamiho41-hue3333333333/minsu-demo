import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace} from '../src/catalog.mjs';
const api=await import('../src/experience.mjs').catch(()=>({}));
test('v0.5 migration adds scoped empty experience without replacing drafts, threads or published facts',()=>{
 assert.equal(typeof api.upgradeExperience,'function');
 const original=createWorkspace(),before=structuredClone(original);const next=api.upgradeExperience(original);
 assert.deepEqual(original,before);assert.notEqual(next,original);
 for(const [pid,p] of Object.entries(next.properties)){
  assert.equal(p.state.draft.experience.propertyId,pid);
  assert.deepEqual(p.state.threads,before.properties[pid].state.threads);
  assert.deepEqual(p.state.published.facts,before.properties[pid].state.published.facts);
 }
 assert.deepEqual(api.upgradeExperience(next),next);
});
test('public records reject unconfirmed, private, expired, cancelled and wrong-property facts',()=>{
 assert.equal(typeof api.publicRecord,'function');
 const now=Date.parse('2026-10-23T00:00:00Z');
 const r={id:'test-point',propertyId:'test-house',enabled:true,visibility:'public',confirmation:{status:'confirmed',by:'演示操作者（测试）',at:'2026-10-22'},sourceLabel:'独立测试资料'};
 assert.equal(api.publicRecord(r,'test-house',null,now),true);
 for(const patch of [{confirmation:{status:'pending'}},{visibility:'internal'},{validUntil:'2026-10-20'},{cancelled:true},{enabled:false},{propertyId:'other'},{unitId:'another-room'}])assert.equal(api.publicRecord({...r,...patch},'test-house',null,now),false);
});
