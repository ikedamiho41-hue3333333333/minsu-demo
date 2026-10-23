import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeed,dispatch,answer} from '../src/model.mjs';
import {createWorkspace,replaceProperty,setDraftRentalMode,shareUrl,resolveTarget,updateRentalMode} from '../src/catalog.mjs';
import {emptyExperience,upgradeExperience,contentRecord,publicRecord} from '../src/experience.mjs';
const publication=await import('../src/publication.mjs').catch(()=>({}));
const merchant={role:'merchant',sessionId:'publication-test-merchant'},pid='songjian-demo';
const act=(s,type,payload={},ctx=merchant)=>dispatch(s,{type,...payload},ctx);
const confirm=(s,more={})=>act(s,'CONFIRM_DRAFT',{by:'Codex（独立测试操作者）',sourceLabel:'独立测试资料及本次人工检查',confirmTestContent:true,...more});
function state(){const s=createSeed();s.draft.experience=emptyExperience(pid);s.published.experience=emptyExperience(pid);return s;}
const record=(id,values={})=>contentRecord(id,pid,{sourceLabel:'独立测试资料',...values});
function sourceState(){const s=state();s.draft.experience.guide.points.parking=record('parking',{address:'独立测试停车入口',lat:1,lng:2});return s;}

test('v0.5 cannot publish before an explicit merchant test confirmation with actual by and source',()=>{
 const s=state(),before=structuredClone(s);assert.throws(()=>act(s,'PUBLISH'),/确认/);
 for(const patch of [{by:''},{sourceLabel:''},{confirmTestContent:false},{confirmTestContent:'true'}])assert.throws(()=>confirm(s,patch),/确认|来源|姓名|操作者/);
 assert.throws(()=>act(s,'CONFIRM_DRAFT',{by:'测试客人',sourceLabel:'测试资料',confirmTestContent:true},{role:'guest',sessionId:'guest'}),/商家/);assert.deepEqual(s,before);
});

test('confirmation is a separate snapshot action and records test identity, scope, source and unchanged public state',()=>{
 assert.equal(typeof publication.publicationStatus,'function');const s=sourceState(),before=structuredClone(s),next=confirm(s),c=next.draft.experience.confirmation;
 assert.equal(c.status,'confirmed');assert.equal(c.by,'Codex（独立测试操作者）');assert.equal(c.identity,'test');assert.equal(c.businessConfirmed,false);assert.equal(c.scope.propertyId,pid);assert.equal(c.scope.visibility,'public');assert.equal(c.sourceLabel,'独立测试资料及本次人工检查');assert.ok(Number.isFinite(Date.parse(c.at)));
 assert.deepEqual(next.published,before.published);assert.deepEqual(s,before);assert.equal(publication.publicationStatus(next).confirmed,true);
 const recordConfirmation=next.draft.experience.guide.points.parking.confirmation;assert.equal(recordConfirmation.identity,'test');assert.equal(recordConfirmation.by,c.by);assert.equal(publicRecord(next.draft.experience.guide.points.parking,pid),true);
 const published=act(next,'PUBLISH');assert.equal(published.published.version,2);assert.equal(published.published.experience.confirmation.fingerprint,c.fingerprint);assert.equal(published.published.experience.guide.points.parking.address,'独立测试停车入口');
});

test('save draft, save FAQ and delete FAQ invalidate global confirmation and require another explicit confirmation',()=>{
 for(const operation of ['SAVE_DRAFT','SAVE_KNOWLEDGE','DELETE_KNOWLEDGE']){
  let s=state();s.draft.knowledge=[{id:'faq',question:'测试问题',text:'测试通用答复',aliases:[]}];s=confirm(s);
  if(operation==='SAVE_DRAFT'){const draft=structuredClone(s.draft);draft.subtitle='新的测试短句';s=act(s,operation,{draft});}
  if(operation==='SAVE_KNOWLEDGE')s=act(s,operation,{knowledgeId:'faq',question:'测试问题',text:'新的测试通用答复',aliases:[]});
  if(operation==='DELETE_KNOWLEDGE')s=act(s,operation,{knowledgeId:'faq'});
  assert.equal(s.draft.experience.confirmation.status,'pending');assert.equal(publication.publicationStatus(s).confirmed,false);assert.throws(()=>act(s,'PUBLISH'),/确认/);
  assert.doesNotThrow(()=>act(confirm(s),'PUBLISH'));
 }
});

test('confirmation fingerprint detects edits made after confirmation even without a save command',()=>{
 assert.equal(typeof publication.draftFingerprint,'function');const s=confirm(sourceState()),fingerprint=s.draft.experience.confirmation.fingerprint;
 s.draft.experience.guide.points.parking.address='确认后擅改的测试地址';assert.notEqual(publication.draftFingerprint(s.draft),fingerprint);assert.equal(publication.publicationStatus(s).confirmed,false);assert.throws(()=>act(s,'PUBLISH'),/确认|变更/);
});

test('empty, unknown, private, expired and missing-source candidates remain unconfirmed while partial drafts may publish',()=>{
 const s=sourceState();s.draft.experience.guide.steps=[record('unknown',{text:'待确认'}),record('private',{text:'内部测试SOP',visibility:'internal'}),record('expired',{text:'已过期的测试指引',validUntil:'2000-01-01'}),record('no-source',{text:'资料来源未补的测试步骤',sourceLabel:'待补来源'})];
 s.draft.experience.recommendations.places=[record('preview',{name:'测试原稿地点',description:'仅原稿预览',status:'pending'})];
 const next=confirm(s),status=publication.publicationStatus(next);assert.equal(status.confirmed,true);assert.ok(status.missing.length>=5);
 for(const r of next.draft.experience.guide.steps)assert.notEqual(r.confirmation?.status,'confirmed');assert.notEqual(next.draft.experience.recommendations.places[0].confirmation?.status,'confirmed');
 const p=act(next,'PUBLISH').published;assert.equal(p.experience.guide.steps[1].visibility,'internal');assert.equal(publicRecord(p.experience.guide.steps[0],pid),false);assert.equal(publicRecord(p.experience.guide.steps[1],pid),false);
});

test('unselected new FAQ remains a candidate and confirmation never automatically clears requiresHuman',()=>{
 let s=upgradeExperience(createWorkspace()).properties['qinghuan-dali'].state;s=confirm(s);assert.ok(s.draft.knowledge.every(item=>item.requiresHuman===true));
 s=act(s,'PUBLISH');assert.equal(answer(s,s.published.knowledge[0].question).status,'needs_human');
 let ordinary=state();ordinary=act(ordinary,'SAVE_KNOWLEDGE',{knowledgeId:'new-faq',question:'测试泊车服务可用吗',text:'不应未经确认成为事实的测试承诺',aliases:[]});ordinary=confirm(ordinary,{recordIds:[]});ordinary=act(ordinary,'PUBLISH');assert.equal(answer(ordinary,'测试泊车服务可用吗').status,'needs_human');assert.doesNotMatch(answer(ordinary,'测试泊车服务可用吗').body,/不应未经确认成为事实/);
});

test('publication inspection is read only and tolerates a missing or malformed state',()=>{
 assert.equal(typeof publication.publicationStatus,'function');for(const s of [{},null,{draft:{}},{draft:{experience:{propertyId:'test',confirmation:{status:'confirmed'}}}}])assert.doesNotThrow(()=>publication.publicationStatus(s));
 const s=sourceState(),before=structuredClone(s);publication.publicationStatus(s);assert.deepEqual(s,before);
});

test('legacy states without experience preserve direct publication while migrated legacy confirmation uses logical content scope',()=>{
 assert.doesNotThrow(()=>act(createSeed(),'PUBLISH'));
 const s=upgradeExperience(createWorkspace(createSeed())).properties.legacy.state,next=confirm(s);assert.equal(next.propertyId,'songjian-demo');assert.equal(next.draft.experience.confirmation.scope.propertyId,'legacy');assert.doesNotThrow(()=>act(next,'PUBLISH'));
});

test('publishing rental mode changes increments share generation while draft edits and same-mode publication do not',()=>{
 let w=upgradeExperience(createWorkspace()),entry=w.properties['lake-inn'];const initial=shareUrl(w,{merchantId:'lake',propertyId:'lake-inn',unitId:'sea-king',baseUrl:'https://example.test/'}),oldNoGeneration='?property=lake-inn&unit=sea-king&share=1';
 assert.equal(new URL(initial).searchParams.get('generation'),'0');assert.equal(resolveTarget(w,oldNoGeneration).ok,true);
 w=setDraftRentalMode(w,'lake','lake-inn','whole');assert.equal(w.properties['lake-inn'].shareGeneration??0,0);assert.equal(resolveTarget(w,new URL(initial).search).ok,true);
 let s=confirm(w.properties['lake-inn'].state);s=act(s,'PUBLISH');w=replaceProperty(w,'lake-inn',s);assert.equal(w.properties['lake-inn'].shareGeneration,1);assert.equal(resolveTarget(w,new URL(initial).search).ok,false);assert.equal(resolveTarget(w,oldNoGeneration).ok,false);
 const whole=shareUrl(w,{merchantId:'lake',propertyId:'lake-inn',unitId:'whole',baseUrl:'https://example.test/'});assert.equal(resolveTarget(w,new URL(whole).search).ok,true);
 w=setDraftRentalMode(w,'lake','lake-inn','room');w=replaceProperty(w,'lake-inn',act(confirm(w.properties['lake-inn'].state),'PUBLISH'));assert.equal(w.properties['lake-inn'].shareGeneration,2);assert.equal(resolveTarget(w,new URL(initial).search).ok,false);assert.equal(resolveTarget(w,new URL(whole).search).ok,false);assert.equal(resolveTarget(w,oldNoGeneration).ok,false);
 const current=shareUrl(w,{merchantId:'lake',propertyId:'lake-inn',unitId:'sea-king',baseUrl:'https://example.test/'});assert.equal(resolveTarget(w,new URL(current).search).ok,true);
 const unchanged=replaceProperty(w,'lake-inn',act(confirm(w.properties['lake-inn'].state),'PUBLISH'));assert.equal(unchanged.properties['lake-inn'].shareGeneration,2);assert.equal(resolveTarget(unchanged,new URL(current).search).ok,true);assert.equal(unchanged.properties['mountain-yard'].shareGeneration??0,0);
});

test('invalid generation values and disabled units cannot resolve, while legacy updateRentalMode also retires older links',()=>{
 let w=createWorkspace();const initial=shareUrl(w,{merchantId:'lake',propertyId:'lake-inn',unitId:'sea-king',baseUrl:'https://example.test/'});
 for(const generation of ['-1','NaN','1.5','999',''])assert.equal(resolveTarget(w,'?property=lake-inn&unit=sea-king&share=1&generation='+generation).ok,false);
 w=updateRentalMode(w,'lake','lake-inn','whole');assert.equal(w.properties['lake-inn'].shareGeneration,1);w=updateRentalMode(w,'lake','lake-inn','room');assert.equal(w.properties['lake-inn'].shareGeneration,2);assert.equal(resolveTarget(w,new URL(initial).search).ok,false);
 const current=shareUrl(w,{merchantId:'lake',propertyId:'lake-inn',unitId:'sea-king',baseUrl:'https://example.test/'});w.properties['lake-inn'].state.published.rooms[0].enabled=false;assert.equal(resolveTarget(w,new URL(current).search).ok,false);
});

test('saving a downgraded or foreign experience cannot bypass the v0.5 confirmation gate',()=>{
 const s=confirm(state()),draft=structuredClone(s.draft);delete draft.experience;
 assert.throws(()=>act(s,'SAVE_DRAFT',{draft}),/结构|归属/);
 const foreign=structuredClone(s.draft);foreign.experience.propertyId='another-house';assert.throws(()=>act(s,'SAVE_DRAFT',{draft:foreign}),/结构|归属/);
});

test('inspection lists eligible but unselected records as pending and media confirmation accepts a valid titled URL',()=>{
 const s=sourceState();s.draft.experience.guide.media=[record('video',{type:'video',title:'独立测试到店视频',url:'https://example.test/arrival.mp4',text:''})];
 const selected=confirm(s,{recordIds:['guide.points.parking']});assert.ok(publication.publicationStatus(selected).missing.some(item=>item.id==='video'&&/确认/.test(item.reason)));
 const all=confirm(s);assert.equal(all.draft.experience.guide.media[0].confirmation.status,'confirmed');
});

test('test confirmation leaves a 180-minute half-day route pending when a selected day project already needs 360 minutes',()=>{
 const s=state();s.draft.experience.recommendations.places=[record('tea',{name:'独立测试茶馆',description:'独立测试半日地点',period:'half',durationMinutes:60}),record('gallery',{name:'独立测试全天展馆',description:'独立测试全天项目',period:'day',durationMinutes:360})];
 s.draft.experience.recommendations.routes=[record('bad-half',{name:'独立测试矛盾半日安排',period:'half',durationMinutes:180,placeIds:['tea','gallery']})];
 const next=confirm(s),route=next.draft.experience.recommendations.routes[0];
 assert.ok(next.draft.experience.recommendations.places.every(place=>place.confirmation.status==='confirmed'));
 assert.notEqual(route.confirmation.status,'confirmed');assert.ok(publication.publicationStatus(next).missing.some(item=>item.id==='bad-half'&&/半天|半日|时长|一天|全天/.test(item.reason)));
});
