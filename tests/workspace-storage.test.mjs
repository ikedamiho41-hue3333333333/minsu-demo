import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace,ensureQinghuanWorkspace} from '../src/catalog.mjs';
import {createSeed,dispatch,guestThreads} from '../src/model.mjs';
import {upgradeExperience} from '../src/experience.mjs';
const api=await import('../src/workspace-storage.mjs').catch(()=>({}));
const current='minsu-mini-v050',legacy='minsu-mini-v040',oldest='minsu-mini-v030';
const options={createWorkspace,upgradeWorkspace:w=>upgradeExperience(ensureQinghuanWorkspace(w))};
function storage(entries={},fail=()=>false){
 const data=new Map(Object.entries(entries)),writes=[];
 return {data,writes,get length(){return data.size;},key(index){return [...data.keys()][index]??null;},getItem(key){return data.has(key)?data.get(key):null;},setItem(key,value){writes.push([key,String(value)]);if(fail(key,String(value),writes.length)){const error=Error('独立测试配额不足');error.name='QuotaExceededError';throw error;}data.set(key,String(value));},removeItem(key){data.delete(key);}};
}
function populated(){
 const guest={role:'guest',sessionId:'storage-test-guest'};let s=dispatch(createSeed(),{type:'ASK',body:'宠物可以带吗',operation:'original-operation'},guest);const t=guestThreads(s,guest.sessionId)[0];s=dispatch(s,{type:'HANDOFF',threadId:t.id,messageId:t.messages.at(-1).id},guest);
 const w=createWorkspace(s);w.properties['lake-inn'].state.draft.name='未发布的独立测试草稿';w.properties['lake-inn'].state.draftDirty=true;w.lifeChats['old-session:dali']=[{id:'old-life-message',role:'guest',body:'保留旧周边原问',contextLabel:'旧对象'}];return w;
}
function customOnly(){const full=createWorkspace(),p=full.properties['lake-inn'];return {schema:2,revision:8,merchants:{lake:full.merchants.lake},properties:{'custom-only':p},life:full.life,lifeChats:{}};}
const nextOf=w=>{const next=structuredClone(w);next.revision++;next.properties[Object.keys(next.properties)[0]].state.draft.name='新的独立测试草稿';return next;};

test('inspection accepts a usable custom schema2 workspace without requiring default property keys',()=>{
 assert.equal(typeof api.inspectWorkspace,'function');const w=customOnly(),before=structuredClone(w),r=api.inspectWorkspace(JSON.stringify(w));assert.equal(r.ok,true);assert.deepEqual(r.workspace,w);assert.deepEqual(w,before);assert.equal(r.workspace.properties['lake-inn'],undefined);
});

test('inspection rejects unsupported schemas and deeply broken operable structures rather than repairing them with samples',()=>{
 assert.equal(typeof api.inspectWorkspace,'function');const original=populated();
 const cases=[w=>w.schema=99,w=>w.revision='2',w=>w.properties['lake-inn'].state=null,w=>w.properties['lake-inn'].state.published.facts=[],w=>w.properties['lake-inn'].state.published.rooms[0].facilities='空调',w=>w.properties['qinghuan-dali'].state.published.knowledge[0].aliases='问法',w=>w.life.events=[],w=>w.lifeChats=[]];
 for(const mutate of cases){const w=structuredClone(original);mutate(w);const raw=JSON.stringify(w),r=api.inspectWorkspace(raw);assert.equal(r.ok,false);assert.ok(r.error);assert.equal(JSON.stringify(w),raw);}
 const w=structuredClone(original),thread=Object.values(w.properties.legacy.state.threads)[0];thread.messages[0].body={invalid:true};assert.equal(api.inspectWorkspace(JSON.stringify(w)).ok,false);
 const badTicket=structuredClone(original);Object.values(badTicket.properties.legacy.state.tickets)[0].threadId='another-thread';assert.equal(api.inspectWorkspace(JSON.stringify(badTicket)).ok,false);
});

test('unsupported v040 JSON blocks load without invoking sample creation or overwriting any source',()=>{
 assert.equal(typeof api.loadWorkspaceStorage,'function');const raw='{ "schema": 99, "keep": "原文必须保留" }',s=storage({[legacy]:raw}),before=new Map(s.data);let calls=0;
 const r=api.loadWorkspaceStorage(s,{...options,createWorkspace:()=>{calls++;return createWorkspace();}});assert.equal(r.blocked,true);assert.equal(r.workspace,null);assert.equal(r.raw,raw);assert.equal(r.sourceKey,legacy);assert.equal(calls,0);assert.deepEqual(s.data,before);
});

test('a damaged current namespace blocks even when a valid legacy workspace exists',()=>{
 assert.equal(typeof api.loadWorkspaceStorage,'function');const raw='{ damaged current',s=storage({[current]:raw,[legacy]:JSON.stringify(populated())}),before=new Map(s.data),r=api.loadWorkspaceStorage(s,options);assert.equal(r.blocked,true);assert.equal(r.raw,raw);assert.equal(r.sourceKey,current);assert.deepEqual(s.data,before);
});

test('v040 migration copies the exact old raw text to backup, writes a receipt and preserves all user state',()=>{
 assert.equal(typeof api.loadWorkspaceStorage,'function');const w=populated(),raw=JSON.stringify(w,null,3)+'\n',s=storage({[legacy]:raw}),r=api.loadWorkspaceStorage(s,options);
 assert.equal(r.blocked,false);assert.equal(r.migrated,true);assert.equal(r.sourceKey,legacy);assert.equal(s.getItem(legacy),raw);assert.equal(api.inspectWorkspace(s.getItem(current)).ok,true);assert.ok(r.receipt.backupKeys.length);assert.equal(r.receipt.targetKey,current);
 for(const [pid,p]of Object.entries(w.properties)){const actual=r.workspace.properties[pid];assert.equal(actual.state.propertyId,p.state.propertyId);for(const key of ['threads','tickets','operations','draftDirty'])assert.deepEqual(actual.state[key],p.state[key]);assert.equal(actual.state.draft.name,p.state.draft.name);assert.deepEqual(actual.state.draft.knowledge,p.state.draft.knowledge);}
 assert.deepEqual(r.workspace.lifeChats,w.lifeChats);const backups=api.listWorkspaceBackups(s);assert.ok(backups.some(item=>item.sourceKey===legacy));const backup=api.readWorkspaceBackup(s,backups.find(item=>item.sourceKey===legacy).key);assert.equal(backup.ok,true);assert.equal(backup.raw,raw);
 const writes=s.writes.map(([key])=>key);assert.equal(writes.at(-1),current);assert.ok(writes.some(key=>key.startsWith(api.RECEIPT_PREFIX)));
});

test('legacy v030 state migration retains its physical property and old original thread IDs under the logical legacy key',()=>{
 assert.equal(typeof api.loadWorkspaceStorage,'function');const w=populated(),old=w.properties.legacy.state,raw=JSON.stringify(old),s=storage({[oldest]:raw}),r=api.loadWorkspaceStorage(s,options);
 assert.equal(r.blocked,false);assert.equal(r.migrated,true);assert.equal(r.sourceKey,oldest);assert.equal(r.workspace.properties.legacy.state.propertyId,'songjian-demo');assert.equal(r.workspace.properties.legacy.state.published.experience.propertyId,'legacy');assert.deepEqual(r.workspace.properties.legacy.state.threads,old.threads);assert.equal(s.getItem(oldest),raw);
});

test('initializing an empty namespace persists a validated independent workspace and future loads do not rewrite it',()=>{
 assert.equal(typeof api.loadWorkspaceStorage,'function');const s=storage(),first=api.loadWorkspaceStorage(s,options);assert.equal(first.blocked,false);assert.equal(api.inspectWorkspace(s.getItem(current)).ok,true);const before=new Map(s.data),second=api.loadWorkspaceStorage(s,options);assert.equal(second.blocked,false);assert.equal(second.migrated,false);assert.deepEqual(second.workspace,first.workspace);assert.deepEqual(s.data,before);
});

test('validated CAS writes only v050 and refuses stale revisions without losing the newer workspace',()=>{
 assert.equal(typeof api.saveWorkspaceStorage,'function');const s=storage({[legacy]:'旧命名空间完全不写'}),w=upgradeExperience(populated());s.data.set(current,JSON.stringify(w));
 const first=api.saveWorkspaceStorage(s,nextOf(w),{expectedRevision:w.revision});assert.equal(first.ok,true);assert.equal(s.getItem(legacy),'旧命名空间完全不写');const newer=s.getItem(current),stale=api.saveWorkspaceStorage(s,nextOf(w),{expectedRevision:w.revision});assert.equal(stale.ok,false);assert.equal(stale.conflict,true);assert.equal(stale.workspace.revision,w.revision+1);assert.equal(s.getItem(current),newer);
});

test('save cannot overwrite an unsupported current schema or a deeply invalid next workspace',()=>{
 assert.equal(typeof api.saveWorkspaceStorage,'function');const raw='{"schema":99,"keep":"schema99"}',s=storage({[current]:raw}),r=api.saveWorkspaceStorage(s,createWorkspace(),{expectedRevision:0});assert.equal(r.ok,false);assert.equal(r.blocked,true);assert.equal(s.getItem(current),raw);
 const good=upgradeExperience(populated()),valid=storage({[current]:JSON.stringify(good)}),next=nextOf(good);next.properties['lake-inn'].state.published.rooms[0].facilities=null;const before=valid.getItem(current),bad=api.saveWorkspaceStorage(valid,next,{expectedRevision:good.revision});assert.equal(bad.ok,false);assert.equal(valid.getItem(current),before);
});

test('same-revision content changes are rejected while an exact no-op succeeds without a write',()=>{
 assert.equal(typeof api.saveWorkspaceStorage,'function');const w=upgradeExperience(populated()),s=storage({[current]:JSON.stringify(w)}),changed=structuredClone(w);changed.properties['lake-inn'].state.draft.name='不能偷写同版本';assert.equal(api.saveWorkspaceStorage(s,changed,{expectedRevision:w.revision}).ok,false);const before=s.writes.length;assert.equal(api.saveWorkspaceStorage(s,w,{expectedRevision:w.revision}).ok,true);assert.equal(s.writes.length,before);
});

test('explicit recovery of valid schema2 data backs up current and legacy originals before replacing only v050',()=>{
 assert.equal(typeof api.recoverWorkspaceStorage,'function');const currentRaw='{"schema":99,"original":"当前原文"}',legacyRaw='{broken legacy',s=storage({[current]:currentRaw,[legacy]:legacyRaw}),restored=populated(),r=api.recoverWorkspaceStorage(s,JSON.stringify(restored),options);
 assert.equal(r.blocked,false);assert.equal(api.inspectWorkspace(s.getItem(current)).ok,true);assert.equal(s.getItem(legacy),legacyRaw);assert.equal(r.workspace.properties['lake-inn'].state.draft.name,'未发布的独立测试草稿');const backups=api.listWorkspaceBackups(s).map(item=>api.readWorkspaceBackup(s,item.key));assert.ok(backups.some(b=>b.raw===currentRaw&&b.sourceKey===current));assert.ok(backups.some(b=>b.raw===legacyRaw&&b.sourceKey===legacy));assert.equal(s.writes.at(-1)[0],current);
});

test('explicit new-sample recovery is usable, independent of old data and still retains all old raw backups',()=>{
 assert.equal(typeof api.recoverWorkspaceStorage,'function');const oldRaw=JSON.stringify(populated()),s=storage({[current]:'bad current',[legacy]:oldRaw}),r=api.recoverWorkspaceStorage(s,null,options);assert.equal(r.blocked,false);assert.notEqual(r.workspace.properties['lake-inn'].state.draft.name,'未发布的独立测试草稿');assert.equal(r.workspace.properties.legacy,undefined);assert.equal(s.getItem(legacy),oldRaw);assert.ok(api.listWorkspaceBackups(s).length>=2);
});

test('invalid recovery input cannot replace current data or create misleading migration artifacts',()=>{
 assert.equal(typeof api.recoverWorkspaceStorage,'function');const s=storage({[current]:'damaged raw',[legacy]:'legacy raw'}),before=new Map(s.data),r=api.recoverWorkspaceStorage(s,'{"schema":99}',options);assert.equal(r.blocked,true);assert.deepEqual(s.data,before);
});

test('quota failures during any migration stage keep old raw untouched and do not initialize v050',()=>{
 assert.equal(typeof api.loadWorkspaceStorage,'function');const raw=JSON.stringify(populated());
 for(const stage of ['backup','receipt','current']){
  const s=storage({[legacy]:raw},key=>stage==='current'?key===current:key.includes(':'+stage+':')),before=new Map(s.data),r=api.loadWorkspaceStorage(s,options);assert.equal(r.blocked,true,stage);assert.equal(r.workspace,null);assert.match(r.error,/配额|空间|保存|写入/);assert.deepEqual(s.data,before,stage);
 }
});

test('quota failure when saving or restoring keeps the complete prior current and legacy originals',()=>{
 assert.equal(typeof api.saveWorkspaceStorage,'function');const good=upgradeExperience(populated()),raw=JSON.stringify(good),s=storage({[current]:raw,[legacy]:'legacy raw'},key=>key===current),before=new Map(s.data),save=api.saveWorkspaceStorage(s,nextOf(good),{expectedRevision:good.revision});assert.equal(save.ok,false);assert.deepEqual(s.data,before);const restore=api.recoverWorkspaceStorage(s,null,options);assert.equal(restore.blocked,true);assert.deepEqual(s.data,before);
});

test('an upgrade that drops old drafts, tickets or life history is blocked before any write',()=>{
 assert.equal(typeof api.loadWorkspaceStorage,'function');const raw=JSON.stringify(populated()),s=storage({[legacy]:raw}),before=new Map(s.data),r=api.loadWorkspaceStorage(s,{createWorkspace,upgradeWorkspace:w=>{w.properties['lake-inn'].state.draft.name='错误覆盖草稿';w.lifeChats={};return w;}});assert.equal(r.blocked,true);assert.deepEqual(s.data,before);
});

test('reading a preserved backup yields the exact original string and can drive a later real recovery',()=>{
 assert.equal(typeof api.readWorkspaceBackup,'function');const old=populated(),raw=JSON.stringify(old,null,2),s=storage({[legacy]:raw});api.loadWorkspaceStorage(s,options);const key=api.listWorkspaceBackups(s).find(b=>b.sourceKey===legacy).key,backup=api.readWorkspaceBackup(s,key);assert.equal(backup.raw,raw);const r=api.recoverWorkspaceStorage(s,backup.raw,options);assert.equal(r.blocked,false);assert.deepEqual(r.workspace.lifeChats,old.lifeChats);assert.equal(api.readWorkspaceBackup(s,legacy).ok,false);
});

test('a concurrent current write detected while migration stages backups cannot be overwritten',()=>{
 assert.equal(typeof api.loadWorkspaceStorage,'function');const raw=JSON.stringify(populated()),s=storage({[legacy]:raw}),newer=upgradeExperience(populated());newer.revision=100;const normal=s.setItem.bind(s);let changed=false;s.setItem=(key,value)=>{normal(key,value);if(!changed&&key.startsWith(api.RECEIPT_PREFIX)){changed=true;s.data.set(current,JSON.stringify(newer));}};
 const r=api.loadWorkspaceStorage(s,options);assert.equal(r.blocked,true);assert.equal(JSON.parse(s.getItem(current)).revision,100);assert.equal(s.getItem(legacy),raw);
});

test('unavailable storage returns a concrete blocker and never creates a writable sample fallback',()=>{
 assert.equal(typeof api.loadWorkspaceStorage,'function');let called=false;const r=api.loadWorkspaceStorage({getItem(){throw Error('SecurityError: disabled storage');}},{...options,createWorkspace(){called=true;return createWorkspace();}});assert.equal(r.blocked,true);assert.equal(r.workspace,null);assert.equal(called,false);assert.ok(r.error);
});

test('a late CAS conflict returns the newly validated workspace or blocks an unsupported replacement',()=>{
 assert.equal(typeof api.saveWorkspaceStorage,'function');const w=upgradeExperience(populated());
 for(const unsupported of [false,true]){
  const newer=nextOf(w);newer.revision=50;const latestRaw=unsupported?' {"schema":99,"keep":"late original"} ':JSON.stringify(newer),s=storage({[current]:JSON.stringify(w)}),normal=s.getItem.bind(s);let reads=0;
  s.getItem=key=>{if(key===current&&++reads===2)s.data.set(current,latestRaw);return normal(key);};
  const r=api.saveWorkspaceStorage(s,nextOf(w),{expectedRevision:w.revision});assert.equal(r.ok,false);assert.equal(s.getItem(current),latestRaw);assert.equal(s.writes.length,0);
  if(unsupported){assert.equal(r.blocked,true);assert.equal(r.workspace,null);assert.equal(r.raw,latestRaw);}else {assert.equal(r.blocked,false);assert.equal(r.conflict,true);assert.ok(r.workspace);assert.equal(r.workspace.revision,50);}
 }
});

test('failed explicit fresh recovery still returns the exact blocking legacy raw when v050 is absent',()=>{
 assert.equal(typeof api.recoverWorkspaceStorage,'function');const raw=' {"schema":99,"keep":"旧版阻塞原文"} ',s=storage({[legacy]:raw},key=>key.startsWith(api.BACKUP_PREFIX)),before=new Map(s.data),r=api.recoverWorkspaceStorage(s,null,options);
 assert.equal(r.blocked,true);assert.equal(r.raw,raw);assert.equal(r.sourceKey,legacy);assert.deepEqual(s.data,before);
});

test('save restores the original raw if a storage adapter throws after its own write or corrupts the readback',()=>{
 assert.equal(typeof api.saveWorkspaceStorage,'function');const w=upgradeExperience(populated()),raw=JSON.stringify(w),next=nextOf(w);
 for(const kind of ['throw-after-write','corrupt-readback']){
  const s=storage({[current]:raw}),normal=s.setItem.bind(s);let first=true;
  s.setItem=(key,value)=>{normal(key,value);if(key===current&&first){first=false;if(kind==='throw-after-write')throw Error('独立测试写入后异常');s.data.set(current,'{"schema":99,"mock":"adapter mutation"}');}};
  const r=api.saveWorkspaceStorage(s,next,{expectedRevision:w.revision});assert.equal(r.ok,false);assert.equal(s.getItem(current),raw,kind);assert.equal(r.raw,raw);
 }
});
