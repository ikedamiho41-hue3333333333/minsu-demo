import test from 'node:test';import assert from 'node:assert/strict';
import {lifeChatKey} from '../src/content.mjs';
const api=await import('../src/conversation-drafts.mjs').catch(()=>({}));
test('local guide conversation keys separate all properties and optional rental units',()=>{
 assert.notEqual(lifeChatKey('person','dali','lake-inn'),lifeChatKey('person','dali','mountain-yard'));
 assert.notEqual(lifeChatKey('person','dali','lake-inn','a'),lifeChatKey('person','dali','lake-inn','b'));
});
test('choosing a new object keeps a recoverable copy of unsent text and context',()=>{
 assert.equal(typeof api.selectDraft,'function');
 const before={body:'我还没发送的厨房问题',context:{propertyId:'p',roomId:'room-a'}},copy=structuredClone(before);
 const next=api.selectDraft(before,'怎么到入口',{propertyId:'p',kind:'arrival',id:'entrance'});
 assert.deepEqual(before,copy);assert.equal(next.body,'怎么到入口');assert.deepEqual(next.previous,copy);
 const restored=api.restoreDraft(next);assert.equal(restored.body,before.body);assert.deepEqual(restored.context,before.context);
 assert.equal(api.selectDraft(before,undefined,undefined).body,before.body);
});
