import {writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createWorkspace} from '../src/catalog.mjs';
import {upgradeExperience} from '../src/experience.mjs';
import {answer,dispatch,guestThreads} from '../src/model.mjs';
import {contentFor,makeContentContext} from '../src/content.mjs';

// Technical acceptance only: every response and state transition below is
// produced by the same domain functions used by the UI, in independent memory.
const started=new Date().toISOString(),initial=upgradeExperience(createWorkspace()).properties['qinghuan-dali'].state;
const merchant={role:'merchant',sessionId:'v05-acceptance-merchant'},questions=[],counterexamples=[],failures=[];
const actualReply=reply=>({status:reply.status,body:reply.body,knowledgeIds:reply.knowledgeIds??[],sources:reply.sources??[],mode:reply.mode,resolvedContext:reply.resolvedContext??reply.context??null});
const outputDir=new URL('../output/',import.meta.url);await mkdir(outputDir,{recursive:true});
let utterances=0,utterancesPassed=0;
for(const entry of initial.published.knowledge){
 const rows=[];
 for(const [index,question]of [entry.question,...entry.aliases].entries()){
  utterances++;const guest={role:'guest',sessionId:`v05-${entry.id}-${index}`};
  const row={question,type:index===0?'original':'alias',dataState:'original_pending_confirmation_guide',expected:{status:'needs_human',knowledgeIds:[entry.id],publicVersion:1,body:entry.text,handoff:'pending → processing → replied in original thread'},actual:null,checks:{},result:'failed'};
  try{
   let state=dispatch(initial,{type:'ASK',body:question,context:{kind:'guide',id:entry.id,propertyId:'qinghuan-dali',unitId:null,version:1},operation:`ask-${entry.id}-${index}`},guest);
   const thread=guestThreads(state,guest.sessionId)[0],reply=thread.messages.at(-1);row.actual=actualReply(reply);
   assert.equal(reply.status,'needs_human');assert.deepEqual(reply.knowledgeIds,[entry.id]);assert.equal(reply.body,entry.text);
   assert.ok(reply.sources.some(source=>source.key==='knowledge:'+entry.id&&source.version===1&&source.requiresHuman));
   assert.doesNotMatch(reply.body,/1张1\.8米大床|建议2人入住|松间小院|你想了解哪一间房/);
   state=dispatch(state,{type:'HANDOFF',threadId:thread.id,messageId:reply.id},guest);
   state=dispatch(state,{type:'HANDOFF',threadId:thread.id,messageId:reply.id},guest);
   const tickets=Object.values(state.tickets);assert.equal(tickets.length,1);const ticket=tickets[0];assert.equal(ticket.question,question);assert.deepEqual(ticket.knowledgeIds,[entry.id]);assert.equal(ticket.status,'pending');
   const pendingSnapshot=structuredClone(state);
   assert.throws(()=>dispatch(state,{type:'REPLY',ticketId:ticket.id,body:'此条不应提前发出。'},merchant),/先.*接手/);assert.deepEqual(state,pendingSnapshot);
   assert.throws(()=>dispatch(state,{type:'HANDOFF',threadId:thread.id,messageId:reply.id},{role:'guest',sessionId:'another-session'}),/本人/);
   state=dispatch(state,{type:'ACCEPT',ticketId:ticket.id},merchant);assert.equal(state.tickets[ticket.id].status,'processing');
   const published=structuredClone(state.published);
   state=dispatch(state,{type:'REPLY',ticketId:ticket.id,body:'逐题验收的测试人工回复；实际服务仍需店方确认。'},merchant);
   assert.equal(state.threads[thread.id].messages.at(-1).role,'merchant');assert.equal(state.tickets[ticket.id].status,'replied');assert.deepEqual(state.published,published);assert.equal(guestThreads(state,merchant.sessionId).length,0);
   row.actual.handoff={ticketId:ticket.id,threadId:thread.id,question:ticket.question,knowledgeIds:ticket.knowledgeIds,status:'replied',replyBody:state.tickets[ticket.id].reply.body};
   row.checks={originalOrAliasMatched:true,sourceAndPublicVersion:true,unknownFactsNotPromised:true,handoffIdempotent:true,acceptRequired:true,separateGuestSession:true,replyInOriginalThread:true,noAutomaticPublication:true};row.result='passed';utterancesPassed++;
  }catch(error){row.error=String(error.message);failures.push({id:entry.id,question,error:row.error});}
  rows.push(row);
 }
 questions.push({id:entry.id,originalQuestion:entry.question,phase:entry.phase,sourceLabel:entry.sourceLabel,sourceRange:entry.sourceRange,businessState:'pending_property_confirmation',expectedBehavior:'safe_pending_guide_and_human_handoff',result:rows.every(row=>row.result==='passed')?'passed':'failed',utterances:rows});
}
function recordCounterexample(id,question,state,context,expected,verify){
 const row={id,question,dataState:'independent_acceptance_state',expected,actual:null,result:'failed'};
 try{const reply=answer(state,question,context);row.actual=actualReply(reply);verify(reply);row.result='passed';}catch(error){row.error=String(error.message);failures.push({id,error:row.error});}
 counterexamples.push(row);
}
const qid=id=>initial.published.knowledge.find(entry=>entry.id===id);
recordCounterexample('combined-two-questions',qid('Q03').question+'；'+qid('Q06').question,initial,null,{status:'needs_human',knowledgeIds:['Q03','Q06']},reply=>{assert.equal(reply.status,'needs_human');assert.deepEqual(reply.knowledgeIds,['Q03','Q06']);assert.ok(reply.body.includes(qid('Q03').text));assert.ok(reply.body.includes(qid('Q06').text));});
recordCounterexample('unknown-extra-request',qid('Q06').question+'；另外能烧烤吗？',initial,null,{status:'needs_human',unknown:'烧烤规则'},reply=>{assert.equal(reply.status,'needs_human');assert.match(reply.body,/烧烤规则/);assert.deepEqual(reply.knowledgeIds,['Q06']);});
const conflicting=structuredClone(initial);conflicting.published.facts.parking={text:'独立测试：本店没有免费车位。'};Object.assign(conflicting.published.knowledge.find(item=>item.id==='Q03'),{requiresHuman:false,text:'冲突旧答：停车全部免费。'});
recordCounterexample('published-rule-conflict',qid('Q03').question,conflicting,null,{uses:'current_published_parking_fact',rejects:'conflicting_old_FAQ'},reply=>{assert.match(reply.body,/本店没有免费车位/);assert.doesNotMatch(reply.body,/停车全部免费/);assert.ok(reply.sources.some(source=>source.key==='parking'));});
const scope={propertyId:'qinghuan-dali',cityId:'dali'},place=contentFor(scope.propertyId,scope.cityId).places[0],context={...makeContentContext('place',place.id,scope),scope:'local',unitId:null};
recordCounterexample('source-preview-follow-up','这家多少钱？',initial,context,{mode:'source_preview',contextId:place.id,prices:'unverified'},reply=>{assert.equal(reply.mode,'source_preview');assert.equal(reply.context?.id,place.id);assert.match(reply.body,/费用.*核实|费用.*确认/);assert.ok(reply.sources.every(source=>source.version===1&&source.sourceVersion==='0.4.3'));});
recordCounterexample('negation-and-unknown-replacement',`不去${place.name}，改问星光未知咖啡几点开门？`,initial,context,{context:null,status:'needs_human',substitute:false},reply=>{assert.equal(reply.context,null);assert.equal(reply.status,'needs_human');assert.equal(reply.sources.length,0);});
recordCounterexample('foreign-object','厨房可以做饭吗？',initial,{kind:'arrival',id:'entrance',propertyId:'other-house'},{status:'unavailable',sources:[]},reply=>{assert.equal(reply.status,'unavailable');assert.deepEqual(reply.sources,[]);});

const regressionFiles=['tests/answer-boundaries.test.mjs','tests/answer-neighbors.test.mjs','tests/qinghuan-model.test.mjs','tests/content.test.mjs','tests/experience-answer.test.mjs'];
const regression=spawnSync(process.execPath,['--test',...regressionFiles],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8'});
const regressionLog=String(regression.stdout??'')+String(regression.stderr??'');await writeFile(new URL('v05-regression.log',outputDir),regressionLog);
if(regression.status!==0)failures.push({id:'existing-and-new-regressions',error:'node --test returned '+regression.status});
const result={executedAt:started,finishedAt:new Date().toISOString(),mode:'same_domain_functions_in_independent_memory_no_model_or_backend',publicVersion:initial.published.version,questions:questions.length,utterances,utterancesPassed,originalsPassed:questions.filter(row=>row.utterances[0].result==='passed').length,counterexamplesPassed:counterexamples.filter(row=>row.result==='passed').length,counterexamplesTotal:counterexamples.length,passed:failures.length===0,businessFactsVerified:false,realDeviceVerified:false,wechatVerified:false,questionsResults:questions,counterexamples,regressions:{command:[process.execPath,'--test',...regressionFiles],exitCode:regression.status,log:'v05-regression.log',summary:regressionLog.split('\n').filter(line=>/^ℹ (?:tests|pass|fail|skipped)/.test(line))},failures};
await writeFile(new URL('v05-acceptance.json',outputDir),JSON.stringify(result,null,2)+'\n');
console.log(`v0.5：${result.originalsPassed}/30原题，${utterancesPassed}/${utterances}原题及全部别名，${result.counterexamplesPassed}/${counterexamples.length}关键反例；回归exit=${regression.status}。真实资料、真机和微信仍待独立验收。`);
if(!result.passed)process.exitCode=1;
