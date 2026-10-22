import test from 'node:test';
import assert from 'node:assert/strict';
import * as catalog from '../src/catalog.mjs';
import {dispatch,guestThreads} from '../src/model.mjs';

function consultation(w,pid,owner='separate-guest'){
 let state=w.properties[pid].state;
 state=dispatch(state,{type:'ASK',body:'可以带宠物吗',context:{unitId:'whole'}},{role:'guest',sessionId:owner});
 const thread=guestThreads(state,owner)[0];
 state=dispatch(state,{type:'HANDOFF',threadId:thread.id,messageId:thread.messages.at(-1).id},{role:'guest',sessionId:owner});
 return catalog.replaceProperty(w,pid,state);
}
test('独立商家会话只读回看原客人问题与人工回复，不替换任何身份',()=>{
 let w=consultation(catalog.createWorkspace(),'flower-yard');
 const s=w.properties['flower-yard'].state,ticket=Object.values(s.tickets)[0];
 w=catalog.replaceProperty(w,'flower-yard',dispatch(s,{type:'REPLY',ticketId:ticket.id,body:'只给这位客人的人工确认答复。'},{role:'merchant',sessionId:'separate-merchant'}));
 const before=JSON.stringify(w);
 const preview=catalog.ticketPreview?.(w,{merchantId:'mountain',propertyId:'flower-yard',ticketId:ticket.id});
 assert.equal(preview?.thread?.messages.at(-1).body,'只给这位客人的人工确认答复。');
 assert.equal(preview.thread.messages[0].body,'可以带宠物吗');
 assert.equal(preview.thread.owner,'separate-guest');
 assert.equal(guestThreads(w.properties['flower-yard'].state,'separate-merchant').length,0);
 assert.equal(JSON.stringify(w),before);
 preview.thread.messages[0].body='尝试修改';
 assert.equal(JSON.stringify(w),before);
 assert.throws(()=>catalog.ticketPreview(w,{merchantId:'lake',propertyId:'flower-yard',ticketId:ticket.id}),/商家|权限/);
 const broken=structuredClone(w);broken.properties['flower-yard'].state.threads[ticket.threadId].propertyId='lake-inn';
 assert.throws(()=>catalog.ticketPreview(broken,{merchantId:'mountain',propertyId:'flower-yard',ticketId:ticket.id}),/会话/);
});
test('多房源待办汇总包括暂停展示和处理中，排除其他商家，回复后归零',()=>{
 let w=consultation(catalog.createWorkspace(),'flower-yard');
 w=consultation(w,'lake-inn','another-guest');
 w.properties['flower-yard'].state.visible=false;
 const result=catalog.merchantPendingSummary?.(w,'mountain');
 assert.equal(result?.total,1);
 assert.equal(result.properties.find(x=>x.propertyId==='flower-yard').pending,1);
 assert.equal(result.properties.find(x=>x.propertyId==='mountain-yard').pending,0);
 assert.equal(result.properties.length,2);
 let s=w.properties['flower-yard'].state,ticket=Object.values(s.tickets)[0];
 s=dispatch(s,{type:'ACCEPT',ticketId:ticket.id},{role:'merchant',sessionId:'merchant'});
 w=catalog.replaceProperty(w,'flower-yard',s);
 assert.equal(catalog.merchantPendingSummary(w,'mountain').total,1);
 s=dispatch(s,{type:'REPLY',ticketId:ticket.id,body:'已回复这条咨询。'},{role:'merchant',sessionId:'merchant'});
 w=catalog.replaceProperty(w,'flower-yard',s);
 assert.equal(catalog.merchantPendingSummary(w,'mountain').total,0);
 assert.equal(catalog.merchantPendingSummary(w,'lake').total,1);
});
