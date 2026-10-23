import test from 'node:test';
import assert from 'node:assert/strict';
import {contentRecord,emptyExperience} from '../src/experience.mjs';
import {createWorkspace} from '../src/catalog.mjs';
const guide=await import('../src/guide.mjs').catch(()=>({}));
const ui=await import('../src/guide-ui.mjs').catch(()=>({}));
const pid='guide-test-house';
const confirmed=(id,values={})=>contentRecord(id,pid,{sourceLabel:'独立测试资料，不代表真实门店',confirmation:{status:'confirmed',by:'演示操作者（测试）',at:'2026-10-23'},...values});
function snapshot(){return {name:'测试小院',version:2,dataIdentity:'独立测试资料',facts:{},knowledge:[],rooms:[],experience:emptyExperience(pid)};}
function form(values){const f=new FormData();for(const [k,v]of Object.entries(values))f.set(k,String(v));return f;}
function urls(html){return [...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'));}

test('arrival reads the published guide and keeps property, parking and entrance destinations distinct',()=>{
 assert.equal(typeof ui.arrivalMarkup,'function');
 const p=snapshot();p.experience.guide.points={property:confirmed('property-location',{address:'测试民宿公开地址',lat:1,lng:2}),parking:confirmed('parking',{address:'测试停车入口',lat:3,lng:4}),entrance:confirmed('entrance',{address:'测试步行入口',lat:5,lng:6})};
 const draft=structuredClone(p);draft.experience.guide.points.property.address='不应公开的草稿地址';
 const html=ui.arrivalMarkup({published:p,draft},pid);
 assert.doesNotMatch(html,/不应公开的草稿地址/);
 const destinations=urls(html).filter(s=>s.startsWith('https://uri.amap.com/')).map(s=>new URL(s).searchParams.get('position'));
 assert.deepEqual(destinations,['2,1','4,3','6,5']);
 for(const id of ['property','parking','entrance'])assert.match(html,new RegExp('data-guide-point="'+id+'"'));
 assert.match(html,/data-action="guide-copy-address"/);assert.match(html,/data-action="guide-ask"/);
});

test('unconfirmed/private/expired/wrong-unit records never expose navigation, addresses or media',()=>{
 assert.equal(typeof ui.arrivalMarkup,'function');
 for(const patch of [{confirmation:{status:'pending'}},{visibility:'internal'},{visibility:'stay'},{enabled:false},{cancelled:true},{validUntil:'2000-01-01'},{propertyId:'another-house'},{unitId:'private-room'}]){
  const p=snapshot();p.experience.guide.points.parking=confirmed('parking',{address:'禁止泄漏的位置',lat:1,lng:2,...patch});p.experience.guide.media=[confirmed('clip',{type:'video',url:'https://example.invalid/secret.mp4',text:'禁止泄漏的媒体',...patch})];
  const html=ui.arrivalMarkup(p,pid,'public-room');assert.doesNotMatch(html,/禁止泄漏|secret\.mp4|uri\.amap/);
 }
});

test('a public address without valid coordinates can be copied without borrowing another point',()=>{
 assert.equal(typeof ui.arrivalMarkup,'function');
 const p=snapshot();p.experience.guide.points.property=confirmed('property-location',{address:'测试社区地址',lat:1,lng:2});p.experience.guide.points.parking=confirmed('parking',{address:'测试停车文字说明',lat:null,lng:null});
 const html=ui.arrivalMarkup(p,pid),parking=html.split('data-guide-point="parking"')[1].split('</article>')[0];
 assert.match(parking,/测试停车文字说明/);assert.match(parking,/guide-copy-address/);assert.doesNotMatch(parking,/uri\.amap/);
 for(const coordinates of [{lat:91,lng:2},{lat:1,lng:181},{lat:'1',lng:2},{lat:NaN,lng:2}]){
  p.experience.guide.points.property={...p.experience.guide.points.property,...coordinates};assert.equal(urls(ui.arrivalMarkup(p,pid)).filter(s=>s.startsWith('https://uri.amap.com/')).length,0);
 }
});

test('last-mile text and contact remain visible with missing, unsafe or failed video sources',()=>{
 assert.equal(typeof ui.arrivalMarkup,'function');
 const p=snapshot();p.experience.guide.steps=[confirmed('turn',{phase:'arrival',text:'测试图文：从入口沿标识步行'})];p.experience.guide.contact=confirmed('contact',{text:'测试联系出口：原订单平台商家入口',url:'https://example.invalid/contact'});
 p.experience.guide.media=[confirmed('broken',{type:'video',url:'https://example.invalid/missing.mp4',text:'测试视频加载失败时看上方图文'}),confirmed('unsafe',{type:'link',url:'javascript:alert(1)',text:'测试失效外链'})];
 const html=ui.arrivalMarkup(p,pid);assert.match(html,/<video[^>]*controls/);assert.doesNotMatch(html,/<video[^>]*autoplay|javascript:|播放成功|已通知|已收到/);
 assert.match(html,/data-guide-media/);assert.match(html,/测试图文：从入口沿标识步行/);assert.match(html,/测试联系出口/);assert.match(html,/加载失败|无法播放/);
});

test('unknown guide has a useful missing-media, missing-navigation and contact fallback without false services',()=>{
 assert.equal(typeof ui.arrivalMarkup,'function');
 const html=ui.arrivalMarkup(snapshot(),pid);assert.doesNotMatch(html,/uri\.amap|<video|<iframe|tel:/);assert.match(html,/待确认|待补/);assert.match(html,/订单平台/);assert.match(html,/guide-ask/);
});

test('Qinghuan handbook preserves all original question IDs, questions and phases using published content',()=>{
 assert.equal(typeof ui.handbookMarkup,'function');
 const state=createWorkspace().properties['qinghuan-dali'].state,html=ui.handbookMarkup('qinghuan-dali',state);
 for(const k of state.published.knowledge){assert.match(html,new RegExp('data-id="'+k.id+'"'));assert.ok(html.includes(k.question.replaceAll('&','&amp;').replaceAll('"','&quot;')));}
 assert.equal((html.match(/data-kind="guide"/g)||[]).length,30);
 for(const phase of ['入住前','入住中','退房后'])assert.match(html,new RegExp(phase));
 assert.doesNotMatch(html,/内部动作建议|责任岗位候选|整改优先级|data-action="select-guide"/);
 const draft=structuredClone(state.published);draft.knowledge[0].text='草稿不可进入手册';assert.doesNotMatch(ui.handbookMarkup('qinghuan-dali',{published:state.published,draft}),/草稿不可进入手册/);
});

test('other properties use only their published rules and guides, excluding private and internal content',()=>{
 assert.equal(typeof ui.handbookMarkup,'function');
 const p=snapshot();p.facts={parking:{text:'测试公开停车规则'},wifi:{text:'私密网络凭据',visibility:'stay'},kitchen:{text:'内部厨房SOP',visibility:'internal'}};p.knowledge=[{id:'local',question:'测试本店问题',text:'测试本店公开答案',aliases:[],phase:'退房后'},{id:'hidden',question:'内部问题',text:'内部处理赔付',visibility:'internal'}];
 const html=ui.handbookMarkup(pid,p);assert.match(html,/测试公开停车规则|测试本店公开答案/);assert.doesNotMatch(html,/私密网络凭据|内部厨房SOP|内部处理赔付|Q01|清欢/);
 for(const phase of ['入住前','入住中','退房后'])assert.match(html,new RegExp(phase));
});

test('editing a guide preserves stable IDs and unchanged confirmations but changed metadata returns to pending',()=>{
 assert.equal(typeof guide.readGuideForm,'function');
 const previous=emptyExperience(pid).guide;previous.points.parking=confirmed('stable-parking',{address:'测试旧地址',lat:1,lng:2});const original=structuredClone(previous);
 const next=guide.readGuideForm(form({'point.parking.address':'测试新地址','point.parking.sourceLabel':'测试新来源'}),previous,pid);
 assert.equal(next.points.parking.id,'stable-parking');assert.equal(next.points.parking.address,'测试新地址');assert.equal(next.points.parking.confirmation.status,'pending');assert.equal(next.points.parking.confirmation.by,'');assert.deepEqual(previous,original);
 const unchanged=guide.readGuideForm(form({'point.parking.address':'测试旧地址'}),previous,pid);assert.equal(unchanged.points.parking.confirmation.status,'confirmed');
});

test('guide editing validates coordinates and URL schemes without publishing or changing source ownership',()=>{
 assert.equal(typeof guide.readGuideForm,'function');const previous=emptyExperience(pid).guide;
 assert.throws(()=>guide.readGuideForm(form({'point.parking.lat':'91'}),previous,pid),/纬度/);
 assert.throws(()=>guide.readGuideForm(form({'point.parking.lng':'not-a-number'}),previous,pid),/经度/);
 assert.throws(()=>guide.readGuideForm(form({'media.count':'1','media.0.type':'video','media.0.url':'javascript:alert(1)'}),previous,pid),/链接/);
 const next=guide.readGuideForm(form({'steps.count':'1','step.0.text':'测试新指引','step.0.phase':'arrival','contact.text':'测试联系获取方式'}),previous,pid);
 assert.equal(next.steps[0].propertyId,pid);assert.equal(next.steps[0].confirmation.status,'pending');assert.equal(next.contact.confirmation.status,'pending');assert.equal(next.published,undefined);
});

test('guide editor exposes separate address and media/contact fields with a draft-only action',()=>{
 assert.equal(typeof ui.guideEditorMarkup,'function');const html=ui.guideEditorMarkup(snapshot(),pid);
 assert.match(html,/id="guide-editor-form"/);
 for(const key of ['point.property.address','point.parking.address','point.entrance.address','media.0.type','media.0.url','step.0.text','contact.text'])assert.ok(html.includes('name="'+key+'"'));
 assert.match(html,/保存.*草稿/);assert.match(html,/不.*密码|请勿.*密码/);assert.doesNotMatch(html,/data-action="publish"/);
});

test('Qinghuan published parking rule appears in its handbook just as it does in the current public answer',()=>{
 const state=createWorkspace().properties['qinghuan-dali'].state;state.published.facts.parking={text:'独立测试停车规则：每次9元，不提供免费车位。'};
 state.draft.facts.parking={text:'未发布的停车免费承诺'};
 const html=ui.handbookMarkup('qinghuan-dali',state);assert.match(html,/独立测试停车规则：每次9元/);assert.doesNotMatch(html,/未发布的停车免费承诺/);
});

test('explicitly unconfirmed Qinghuan answer retains the original question with safe pending text',()=>{
 const state=createWorkspace().properties['qinghuan-dali'].state,item=state.published.knowledge.find(k=>k.id==='Q03');
 Object.assign(item,{requiresHuman:false,text:'尚未确认的免费代客泊车承诺',confirmation:{status:'pending',by:'',at:''}});
 const html=ui.handbookMarkup('qinghuan-dali',state);assert.match(html,/data-id="Q03"/);assert.doesNotMatch(html,/尚未确认的免费代客泊车承诺/);assert.match(html,/待商家确认/);
});
