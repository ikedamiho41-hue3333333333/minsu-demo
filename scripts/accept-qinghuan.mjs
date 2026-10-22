import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createWorkspace} from '../src/catalog.mjs';
import {dispatch,guestThreads} from '../src/model.mjs';

const initial=createWorkspace().properties['qinghuan-dali'].state;
const results=[];
for(let i=1;i<=30;i++){
 const qid='Q'+String(i).padStart(2,'0'),entry=initial.published.knowledge.find(k=>k.id===qid);
 const guest={role:'guest',sessionId:'accept-'+qid},merchant={role:'merchant',sessionId:'independent-merchant'};
 let state=dispatch(initial,{type:'ASK',body:entry.question},guest);
 const thread=guestThreads(state,guest.sessionId)[0],reply=thread.messages.at(-1);
 assert.equal(reply.status,'needs_human');assert.deepEqual(reply.knowledgeIds,[qid]);
 assert.ok(reply.sources.some(s=>s.key==='knowledge:'+qid&&s.version===1&&s.requiresHuman));
 assert.doesNotMatch(reply.body,/1张1\.8米大床|建议2人入住|松间小院|你想了解哪一间房/);
 state=dispatch(state,{type:'HANDOFF',threadId:thread.id,messageId:reply.id},guest);
 const ticket=Object.values(state.tickets)[0];assert.equal(ticket.question,entry.question);assert.deepEqual(ticket.knowledgeIds,[qid]);
 state=dispatch(state,{type:'ACCEPT',ticketId:ticket.id},merchant);assert.equal(state.tickets[ticket.id].status,'processing');
 const published=JSON.stringify(state.published);
 state=dispatch(state,{type:'REPLY',ticketId:ticket.id,body:'逐题验收演示回复；实际安排仍由店方确认。'},merchant);
 assert.equal(state.threads[thread.id].messages.at(-1).role,'merchant');assert.equal(state.tickets[ticket.id].status,'replied');
 assert.equal(JSON.stringify(state.published),published);
 assert.equal(guestThreads(state,merchant.sessionId).length,0);
 results.push({id:qid,question:entry.question,source:entry.sourceRange,answer:reply.body,answerStatus:reply.status,knowledgeIds:reply.knowledgeIds,sources:reply.sources,
  checks:{questionMatched:true,publishedSource:true,unknownFactsNotPromised:true,handoff:true,accepted:true,replyInOriginalThread:true,noAutomaticPublication:true,separateIdentity:true},result:'passed',businessFacts:'pending_property_confirmation'});
}
await mkdir(new URL('../output/',import.meta.url),{recursive:true});
const result={executedAt:new Date().toISOString(),mode:'real_domain_functions_without_model_or_backend',questions:30,passed:30,businessFactsVerified:false,results};
await writeFile(new URL('../output/qinghuan-30q-acceptance.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log('清欢30问：30/30 问答—交接—接手—回复通过；真实店规仍待店方确认。');
