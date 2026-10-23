import test from 'node:test';
import assert from 'node:assert/strict';
import {contentRecord,emptyExperience} from '../src/experience.mjs';
import {contentFor} from '../src/content.mjs';

const api=await import('../src/recommendations.mjs').catch(()=>({}));
const now=Date.now(),scope={propertyId:'pilot',unitId:null};
const record=(id,values={})=>contentRecord(id,'pilot',{name:'测试茶馆',address:'测试路1号',lat:25.7,lng:100.1,durationMinutes:90,period:'half',party:['family'],sourceLabel:'独立测试资料',confirmation:{status:'confirmed',by:'演示操作者（测试）',at:new Date(now-1000).toISOString()},...values});
function snapshot(){const experience=emptyExperience('pilot');experience.dataIdentity='测试资料';return {name:'测试房源',version:3,experience};}
function populated(){
 const s=snapshot();s.experience.recommendations.places=[record('tea')];
 s.experience.recommendations.routes=[record('half-route',{name:'测试亲子半日安排',placeIds:['tea'],durationMinutes:150})];
 return s;
}

test('recommendation first screen reads published collection without promoting existing source previews into confirmed picks',()=>{
 assert.equal(typeof api.selectRecommendations,'function');
 const original=contentFor('qinghuan-dali','dali'),before=structuredClone(original);
 const result=api.selectRecommendations(snapshot(),scope,{now});
 assert.deepEqual(result.places,[]);assert.deepEqual(result.routes,[]);assert.match(result.emptyReason,/暂无已核实推荐/);
 assert.equal(original.places.length,85);assert.deepEqual(original,before);
});

test('selection excludes unconfirmed, expired, cancelled, hidden and foreign-property records rather than offering a substitute',()=>{
 assert.equal(typeof api.selectRecommendations,'function');
 const s=snapshot();s.experience.recommendations.places=[
  record('valid'),record('pending',{confirmation:{status:'pending',by:'',at:''}}),record('expired',{validUntil:new Date(now-1).toISOString()}),
  record('future',{validFrom:new Date(now+60000).toISOString()}),record('cancelled',{cancelled:true}),record('disabled',{enabled:false}),
  record('internal',{visibility:'internal'}),record('foreign',{propertyId:'other'}),record('resident',{visibility:'resident'}),record('unit',{unitId:'private-room'}),
  record('no-source',{sourceLabel:''}),record('default-source',{sourceLabel:'待补来源'}),record('invalid-date',{validUntil:'not-a-date'})
 ];
 assert.deepEqual(api.selectRecommendations(s,scope,{now}).places.map(place=>place.id),['valid']);
 assert.equal(api.recommendedPlaceById('foreign',s,scope,{now}),null);
 assert.equal(api.recommendedPlaceById('unit',s,scope,{now}),null);
 assert.equal(api.recommendedPlaceById('unit',s,{...scope,unitId:'private-room'},{now}).id,'unit');
 assert.deepEqual(api.selectRecommendations(s,{propertyId:'another'},{now}).places,[]);
});

test('period and party match the selected records and unmatched preferences leave an explicit gap',()=>{
 assert.equal(typeof api.selectRecommendations,'function');
 const s=populated();s.experience.recommendations.places.push(record('day',{name:'测试全天工作坊',period:'day',durationMinutes:420,party:['solo']}));
 const half=api.selectRecommendations(s,scope,{period:'half',party:'family',now});
 assert.deepEqual(half.places.map(p=>p.id),['tea']);assert.deepEqual(half.routes.map(r=>r.id),['half-route']);
 assert.match(api.recommendationReason(half.places[0],half.filters),/半天/);assert.match(api.recommendationReason(half.places[0],half.filters),/亲子/);
 const missing=api.selectRecommendations(s,scope,{period:'day',party:'senior',now});
 assert.deepEqual(missing.places,[]);assert.deepEqual(missing.routes,[]);assert.match(missing.emptyReason,/一天|长辈/);assert.match(missing.emptyReason,/补充|核实|暂无/);
});

test('a full day route cannot become a half day plan and invalid stops invalidate the entire route',()=>{
 assert.equal(typeof api.selectRecommendations,'function');
 const s=populated();s.experience.recommendations.routes.push(
  record('full',{period:'day',durationMinutes:480,placeIds:['tea']}),
  record('mislabelled',{period:'half',durationMinutes:480,placeIds:['tea']}),
  record('missing-stop',{placeIds:['unknown'],durationMinutes:120}),
  record('no-duration',{placeIds:['tea'],durationMinutes:null}),
  record('empty-route',{placeIds:[],durationMinutes:120})
 );
 assert.deepEqual(api.selectRecommendations(s,scope,{period:'half',now}).routes.map(r=>r.id),['half-route']);
 assert.equal(api.recommendedRouteById('missing-stop',s,scope,{now}),null);
 s.experience.recommendations.places[0].enabled=false;
 assert.equal(api.recommendedRouteById('half-route',s,scope,{now}),null);
});

test('first screen remains small and expired or unconfirmed benefits cannot become effective entitlements',()=>{
 assert.equal(typeof api.selectRecommendations,'function');
 const s=snapshot();s.experience.recommendations.places=Array.from({length:8},(_,i)=>record('p'+i));
 s.experience.recommendations.benefits=[
  record('benefit',{name:'测试住客茶饮说明',placeId:'p0'}),record('pending-benefit',{placeId:'p0',confirmation:{status:'pending'}}),
  record('expired-benefit',{placeId:'p0',validUntil:new Date(now-1).toISOString()}),record('orphan-benefit',{placeId:'missing'})
 ];
 const result=api.selectRecommendations(s,scope,{now});assert.equal(result.places.length,5);assert.deepEqual(result.benefits.map(b=>b.id),['benefit']);
});

test('navigation requires a confirmed destination and unsafe source URLs never become navigable links',()=>{
 assert.equal(typeof api.recommendationNavigation,'function');
 const p=record('tea'),nav=api.recommendationNavigation(p,scope);
 assert.equal(nav.available,true);const u=new URL(nav.url);assert.equal(u.protocol,'https:');assert.match(u.href,/100\.1/);assert.match(u.href,/25\.7/);
 for(const patch of [{lat:null},{lat:100},{confirmation:{status:'pending'}},{propertyId:'other'},{unitId:'private-room'},{enabled:false}]){
  const unavailable=api.recommendationNavigation({...p,...patch},scope);assert.equal(unavailable.available,false);assert.equal(unavailable.url,'');
 }
 assert.equal(api.recommendationSourceUrl({...p,sourceUrl:'javascript:alert(1)'}),'');
 assert.equal(api.recommendationSourceUrl({...p,sourceUrl:'https://example.com/source'}),'https://example.com/source');
});

test('transport does not assert accurate driving time when the property departure point is missing or unconfirmed',()=>{
 assert.equal(typeof api.recommendationTransport,'function');
 const s=snapshot(),p=record('tea',{transport:'自驾12分钟，约3公里',transportConfirmed:true});
 const missing=api.recommendationTransport(p,s,scope);assert.doesNotMatch(missing,/12分钟|3公里/);assert.match(missing,/出发点|车程.*待/);
 s.experience.guide.points.property=record('property-location',{address:'测试出发点'});
 assert.match(api.recommendationTransport(p,s,scope),/12分钟/);
 p.transportConfirmed=false;assert.doesNotMatch(api.recommendationTransport(p,s,scope),/12分钟/);
});

test('recommendation contexts re-resolve stable identities and cannot reference an unavailable or foreign object',()=>{
 assert.equal(typeof api.recommendationContext,'function');
 const s=populated(),before=structuredClone(s),context=api.recommendationContext('place','tea',s,scope);
 assert.deepEqual(context,{kind:'place',id:'tea',label:'测试茶馆',propertyId:'pilot',unitId:null,version:3,collection:'recommendations'});
 assert.equal(api.recommendationContext('route','half-route',s,scope).id,'half-route');
 assert.equal(api.recommendationContext('place','tea',s,{propertyId:'other'}),null);assert.equal(api.recommendationContext('place','missing',s,scope),null);
 assert.deepEqual(s,before);
});

test('form reading creates maintainable scoped records while clearing confirmation and keeping entered uncertain fields unverified',()=>{
 assert.equal(typeof api.readRecommendationForm,'function');
 const form=new FormData();for(const [key,value] of Object.entries({kind:'place',name:' 新测试地点 ',address:'测试地址',lat:'0',lng:'100',durationMinutes:'90',period:'half',sourceLabel:'授权测试来源',enabled:'on',fee:'原稿30元/人',booking:'预约待核',transport:'步行前往'}))form.set(key,value);
 form.append('party','family');form.append('party','senior');
 const p=api.readRecommendationForm(form,null,'pilot');
 assert.match(p.id,/^[0-9a-f-]{36}$/i);assert.equal(p.kind,'place');assert.equal(p.propertyId,'pilot');assert.equal(p.name,'新测试地点');
 assert.equal(p.lat,0);assert.equal(p.lng,100);assert.equal(p.durationMinutes,90);assert.deepEqual(p.party,['family','senior']);
 assert.equal(p.confirmation.status,'pending');assert.equal(p.feeConfirmed,false);assert.equal(p.bookingConfirmed,false);assert.equal(p.visibility,'public');
 assert.equal(api.selectRecommendations({...snapshot(),experience:{...snapshot().experience,recommendations:{places:[p],routes:[],benefits:[]}}},scope,{now}).places.length,0);
});

test('form edits retain stable identity and source conflict metadata but cannot edit another property or steal an id',()=>{
 assert.equal(typeof api.readRecommendationForm,'function');
 const previous=record('tea',{kind:'place',sourceRefs:[{file:'原稿.xlsx',location:'A2'}],conflicts:['原稿费用单位冲突'],feeConfirmed:true}),before=structuredClone(previous),form=new FormData();
 for(const [key,value] of Object.entries({kind:'place',id:'tea',name:'修改后的地点',sourceLabel:'原资料',enabled:'on'}))form.set(key,value);
 const next=api.readRecommendationForm(form,previous,'pilot');
 assert.equal(next.id,'tea');assert.deepEqual(next.sourceRefs,[{file:'原稿.xlsx',location:'A2'}]);assert.deepEqual(next.conflicts,['原稿费用单位冲突']);
 assert.equal(next.confirmation.status,'pending');assert.equal(next.feeConfirmed,false);assert.deepEqual(previous,before);
 assert.throws(()=>api.readRecommendationForm(form,previous,'other'),/房源/);
 form.set('id','another');assert.throws(()=>api.readRecommendationForm(form,previous,'pilot'),/身份|资料|编号/);
});

test('route forms preserve explicit stops and own duration, reject unsafe input and cannot claim half a day for an entire day timeline',()=>{
 assert.equal(typeof api.readRecommendationForm,'function');
 const form=new FormData();for(const [key,value] of Object.entries({kind:'route',name:'测试路线',placeIds:'tea, garden,tea',period:'half',durationMinutes:'180',sourceLabel:'独立测试资料',enabled:'on'}))form.set(key,value);
 const r=api.readRecommendationForm(form,null,'pilot');assert.deepEqual(r.placeIds,['tea','garden']);assert.equal(r.durationMinutes,180);
 form.set('durationMinutes','480');assert.throws(()=>api.readRecommendationForm(form,null,'pilot'),/半天|时长/);
 form.set('durationMinutes','180');form.set('sourceUrl','javascript:alert(1)');assert.throws(()=>api.readRecommendationForm(form,null,'pilot'),/链接|网址/);
 form.set('sourceUrl','');form.set('lat','NaN');assert.throws(()=>api.readRecommendationForm(form,null,'pilot'),/纬度|坐标/);
});

test('benefit maintenance preserves all explicitly linked places and an unavailable linked place prevents entitlement display',()=>{
 const form=new FormData();for(const [key,value] of Object.entries({kind:'benefit',name:'测试双场所权益说明',placeIds:'tea,garden,tea',sourceLabel:'独立测试权益来源',enabled:'on'}))form.set(key,value);
 const b=api.readRecommendationForm(form,null,'pilot');assert.deepEqual(b.placeIds,['tea','garden']);assert.equal(b.placeId,'tea');
 const s=populated();s.experience.recommendations.benefits=[{...b,confirmation:record('confirmation').confirmation}];
 assert.deepEqual(api.recommendationBenefits(s,scope,'tea'),[]);
 s.experience.recommendations.places.push(record('garden'));
 assert.equal(api.recommendationBenefits(s,scope,'tea')[0].id,b.id);assert.equal(api.recommendationBenefits(s,scope,'garden')[0].id,b.id);
 form.set('id',b.id);form.set('placeIds','garden');
 const edited=api.readRecommendationForm(form,b,'pilot');assert.equal(edited.placeId,'garden');assert.deepEqual(edited.placeIds,['garden']);
});
