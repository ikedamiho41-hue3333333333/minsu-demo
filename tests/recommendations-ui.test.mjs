import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyExperience,contentRecord} from '../src/experience.mjs';
import {readRecommendationForm} from '../src/recommendations.mjs';

const ui=await import('../src/recommendations-ui.mjs').catch(()=>({}));
const scope={propertyId:'test-property',unitId:'test-room'};
const confirmed={status:'confirmed',by:'演示操作者（测试资料）',at:'2026-10-23'};
function fixture(){
 const experience=emptyExperience('test-property');experience.dataIdentity='测试资料';
 const p=contentRecord('tea','test-property',{name:'测试茶室',description:'室内休息体验',address:'独立测试地址',lat:25.7,lng:100.2,durationMinutes:90,party:['family','senior'],period:'half',transport:'打车10分钟到达',booking:'请提前联系场所',fee:'每人100元（测试）',sourceLabel:'店方提供的独立测试材料',confirmation:confirmed});
 const other=contentRecord('gallery','test-property',{name:'测试画廊',address:'测试画廊地址',durationMinutes:120,party:['couple'],period:'day',sourceLabel:'独立测试来源',confirmation:confirmed});
 const pending=contentRecord('pending','test-property',{name:'不能公开的待核茶室',party:['family'],period:'half'});
 const route=contentRecord('route-half','test-property',{name:'测试亲子半日路线',address:'测试路线区域',description:'两站轻松走走',durationMinutes:180,period:'half',party:['family'],placeIds:['tea'],sourceLabel:'测试路线材料',confirmation:confirmed});
 experience.recommendations.places=[p,other,pending];experience.recommendations.routes=[route];
 return {name:'测试房源',version:4,experience};
}

test('recommendation home begins with verified picks or the clear empty state and preserves full source-library access',()=>{
 assert.equal(typeof ui.recommendationsMarkup,'function');
 const html=ui.recommendationsMarkup({version:0,experience:emptyExperience('test-property')},scope,{});
 assert.match(html,/暂无已核实推荐/);assert.match(html,/data-action="show-content-library"/);assert.match(html,/85|完整资料/);assert.match(html,/5|五条主题/);
 assert.match(html,/<form[^>]+id="recommendation-filter"/);assert.match(html,/name="period"/);assert.match(html,/name="party"/);
 assert.doesNotMatch(html,/data-action="recommendation-place"/);
});

test('time and party filters show applicable confirmed objects with a reason and retain stable detail ids',()=>{
 assert.equal(typeof ui.recommendationsMarkup,'function');
 const html=ui.recommendationsMarkup(fixture(),scope,{period:'half',party:'family'});
 assert.match(html,/测试茶室/);assert.match(html,/测试亲子半日路线/);assert.doesNotMatch(html,/测试画廊|不能公开的待核茶室/);
 assert.match(html,/data-action="recommendation-place"[^>]+data-id="tea"/);assert.match(html,/data-action="recommendation-route"[^>]+data-id="route-half"/);
 assert.match(html,/半天|半日/);assert.match(html,/亲子|带孩子|家庭/);assert.match(html,/测试资料/);
});

test('place detail provides audited status, scoped ask context, address fallback and no exact car time without an origin',()=>{
 assert.equal(typeof ui.recommendedPlaceMarkup,'function');
 const html=ui.recommendedPlaceMarkup('tea',fixture(),scope);
 assert.match(html,/测试茶室/);assert.match(html,/独立测试地址/);assert.match(html,/90分钟|1小时30分钟|1\.5小时/);
 assert.match(html,/费用.*待核|待核.*费用/s);assert.match(html,/预约.*待核|待核.*预约/s);
 assert.match(html,/data-action="recommendation-ask"[^>]+data-kind="place"[^>]+data-id="tea"/);
 assert.match(html,/店方提供的独立测试材料/);assert.match(html,/导航/);assert.match(html,/复制地址|地址可复制|复制下方地址/);
 assert.match(html,/车程.*待|出发点/);assert.doesNotMatch(html,/打车10分钟到达/);
});

test('invalid or foreign place detail cannot expose another property and never creates a navigation button',()=>{
 assert.equal(typeof ui.recommendedPlaceMarkup,'function');
 const html=ui.recommendedPlaceMarkup('tea',fixture(),{propertyId:'another-property'});
 assert.doesNotMatch(html,/测试茶室|独立测试地址|recommendation-ask/);assert.match(html,/未找到|不可用|不属于/);
 const snapshot=fixture();snapshot.experience.recommendations.places[0].lat=null;
 const missing=ui.recommendedPlaceMarkup('tea',snapshot,scope);assert.match(missing,/定位.*待|暂.*导航|无.*导航|导航.*待/);assert.doesNotMatch(missing,/<a[^>]+href="https:\/\/uri\.amap/);
});

test('route stops link to the same place identity and half-day routes do not borrow a full-day timeline',()=>{
 assert.equal(typeof ui.recommendedRouteMarkup,'function');
 const html=ui.recommendedRouteMarkup('route-half',fixture(),scope);
 assert.match(html,/测试亲子半日路线/);assert.match(html,/测试茶室/);assert.match(html,/data-action="recommendation-place"[^>]+data-id="tea"/);
 assert.match(html,/data-action="recommendation-ask"[^>]+data-kind="route"[^>]+data-id="route-half"/);
 assert.match(html,/180分钟|3小时/);assert.doesNotMatch(html,/09:00|18:00|全程零门票/);
});

test('unknown, expired and unconfirmed benefits never become claim controls or current entitlement',()=>{
 assert.equal(typeof ui.recommendedPlaceMarkup,'function');
 const snapshot=fixture();snapshot.experience.recommendations.benefits=[
  contentRecord('pending-benefit','test-property',{name:'未核免费早餐',placeId:'tea'}),
  contentRecord('expired-benefit','test-property',{name:'已过期折扣',placeId:'tea',confirmation:confirmed,validUntil:'2020-01-01'}),
  contentRecord('active-benefit','test-property',{name:'测试茶饮说明',description:'仅测试资料，实际使用前联系场所',placeId:'tea',sourceLabel:'独立测试权益来源',confirmation:confirmed})
 ];
 const html=ui.recommendedPlaceMarkup('tea',snapshot,scope);
 assert.doesNotMatch(html,/未核免费早餐|已过期折扣|领取|已享有|核销/);assert.match(html,/测试茶饮说明/);
});

test('recommendation editor exposes editable records and source/scope fields without publishing or auto-confirming',()=>{
 assert.equal(typeof ui.recommendationEditorMarkup,'function');
 const snapshot=fixture(),html=ui.recommendationEditorMarkup(snapshot,'test-property',{kind:'place',id:'tea'});
 assert.match(html,/<form[^>]+id="recommendation-form"/);assert.match(html,/value="测试茶室"/);assert.match(html,/name="kind"/);assert.match(html,/name="id"/);
 for(const name of ['sourceLabel','sourceUrl','unitId','visibility','enabled','cancelled','validFrom','validUntil','address','lat','lng','durationMinutes','period','party','placeIds','parentPlaceId','transport','booking','fee','transportConfirmed','bookingConfirmed','feeConfirmed'])assert.match(html,new RegExp(`name="${name}"`));
 assert.match(html,/保存.*草稿|待确认/);assert.doesNotMatch(html,/确认并发布|已自动发布/);assert.match(html,/data-action="new-recommendation"/);
});

test('all recommendation surfaces escape user-authored names, sources and values',()=>{
 assert.equal(typeof ui.recommendedPlaceMarkup,'function');
 const snapshot=fixture();snapshot.experience.recommendations.places[0].name='<img src=x onerror=alert(1)>';
 snapshot.experience.recommendations.places[0].sourceLabel='"><script>bad()</script>';
 const html=ui.recommendedPlaceMarkup('tea',snapshot,scope)+ui.recommendationEditorMarkup(snapshot,'test-property',{kind:'place',id:'tea'});
 assert.doesNotMatch(html,/<script>|<img src=x|onerror=alert\(1\)>/);assert.match(html,/&lt;img/);assert.match(html,/&lt;script&gt;/);
});

test('reopening ISO validity dates keeps a valid local datetime input that preserves the same instant',()=>{
 assert.equal(typeof ui.recommendationEditorMarkup,'function');
 const snapshot=fixture(),iso='2026-10-23T12:30:00Z';snapshot.experience.recommendations.places[0].validUntil=iso;
 const html=ui.recommendationEditorMarkup(snapshot,'test-property',{kind:'place',id:'tea'});
 const value=html.match(/name="validUntil"[^>]+value="([^"]*)"/)?.[1];
 assert.match(value,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);assert.equal(Date.parse(value),Date.parse(iso));
});

test('recommendation scope uses room names and only offers the current property units with stable selections',()=>{
 const snapshot=fixture();snapshot.rentalMode='room';snapshot.rooms=[{id:'room-a',name:'听雨大床房'},{id:'room-b',name:'望庭双床房',enabled:false},{id:'foreign-room',propertyId:'other-property',name:'不该展示的外店房间'}];
 snapshot.experience.recommendations.places[0].unitId='room-b';
 const html=ui.recommendationEditorMarkup(snapshot,'test-property',{kind:'place',id:'tea'}),unit=html.match(/<select name="unitId">([\s\S]*?)<\/select>/)?.[1];
 assert.ok(unit,'unit scope must be selected by room name');assert.match(unit,/<option value=""[^>]*>本房源全部单元/);
 assert.match(unit,/<option value="room-a"[^>]*>听雨大床房/);assert.match(unit,/<option value="room-b"[^>]*selected[^>]*>望庭双床房.*停用/);
 assert.doesNotMatch(unit,/foreign-room|不该展示的外店房间|value="whole"/);
 snapshot.rentalMode='whole';const whole=ui.recommendationEditorMarkup(snapshot,'test-property',{kind:'place',id:'tea'});
 assert.match(whole,/<option value="whole"[^>]*>整院/);
});

test('place associations use named distinct checkboxes even for duplicates and parent names exclude self and foreign records',()=>{
 const snapshot=fixture();snapshot.experience.recommendations.places[1].name='测试茶室';snapshot.experience.recommendations.places[1].enabled=false;
 snapshot.experience.recommendations.places.push(contentRecord('foreign-place','other-property',{name:'不该展示的外店地点'}));
 const routeHtml=ui.recommendationEditorMarkup(snapshot,'test-property',{kind:'route',id:'route-half'});
 assert.match(routeHtml,/<input type="hidden" name="placeIds" value="">/);
 assert.match(routeHtml,/<input type="checkbox" name="placeIds" value="tea"[^>]*checked[^>]*>[^<]*测试茶室[^<]*已确认/);
 assert.match(routeHtml,/<input type="checkbox" name="placeIds" value="gallery"[^>]*>[^<]*测试茶室[^<]*停用/);
 assert.match(routeHtml,/<input type="checkbox" name="placeIds" value="pending"[^>]*>[^<]*待确认/);
 assert.doesNotMatch(routeHtml,/name="placeIds" value="foreign-place"|不该展示的外店地点/);
 snapshot.experience.recommendations.places[0].parentPlaceId='gallery';
 const placeHtml=ui.recommendationEditorMarkup(snapshot,'test-property',{kind:'place',id:'tea'}),parents=placeHtml.match(/<select name="parentPlaceId">([\s\S]*?)<\/select>/)?.[1];
 assert.ok(parents);assert.match(parents,/<option value=""[^>]*>无父场所/);assert.match(parents,/<option value="gallery"[^>]*selected[^>]*>测试茶室/);
 assert.doesNotMatch(parents,/value="tea"|foreign-place/);
});

test('multiple named route selections survive save and reopen with both stable ids checked',()=>{
 const snapshot=fixture(),previous=snapshot.experience.recommendations.routes[0],form=new FormData();
 for(const [key,value] of [['kind','route'],['id','route-half'],['name','两站测试路线'],['placeIds',''],['placeIds','tea'],['placeIds','gallery']])form.append(key,value);
 const saved=readRecommendationForm(form,previous,'test-property');assert.deepEqual(saved.placeIds,['tea','gallery']);
 snapshot.experience.recommendations.routes[0]=saved;
 const html=ui.recommendationEditorMarkup(snapshot,'test-property',{kind:'route',id:'route-half'});
 for(const id of ['tea','gallery'])assert.match(html,new RegExp(`<input type="checkbox" name="placeIds" value="${id}"[^>]*checked`));
 assert.match(html,/测试茶室/);assert.match(html,/测试画廊/);
});

test('missing saved relationships remain explicit unknown choices rather than silently selecting another record',()=>{
 const snapshot=fixture(),place=snapshot.experience.recommendations.places[0];place.unitId='removed-room';place.parentPlaceId='removed-parent';
 const route=snapshot.experience.recommendations.routes[0];route.placeIds=['tea','removed-stop'];
 const placeHtml=ui.recommendationEditorMarkup(snapshot,'test-property',{kind:'place',id:'tea'});
 assert.match(placeHtml,/<option value="removed-room"[^>]*selected[^>]*>[^<]*缺失|<option value="removed-room"[^>]*selected[^>]*>[^<]*未知/);
 assert.match(placeHtml,/<option value="removed-parent"[^>]*selected[^>]*>[^<]*缺失|<option value="removed-parent"[^>]*selected[^>]*>[^<]*未知/);
 const routeHtml=ui.recommendationEditorMarkup(snapshot,'test-property',{kind:'route',id:'route-half'});
 assert.match(routeHtml,/<input type="checkbox" name="placeIds" value="removed-stop"[^>]*checked[^>]*>[^<]*(缺失|未知)/);
});

test('reopening an existing route preserves its chosen stop order during an unchanged checkbox submission',()=>{
 const snapshot=fixture(),previous=snapshot.experience.recommendations.routes[0];previous.placeIds=['gallery','tea'];
 const html=ui.recommendationEditorMarkup(snapshot,'test-property',{kind:'route',id:'route-half'});
 const selected=[...html.matchAll(/<input type="checkbox" name="placeIds" value="([^"]*)"[^>]*checked/g)].map(match=>match[1]);
 assert.deepEqual(selected,['gallery','tea']);
 const form=new FormData();form.append('kind','route');form.append('id','route-half');form.append('placeIds','');for(const id of selected)form.append('placeIds',id);
 assert.deepEqual(readRecommendationForm(form,previous,'test-property').placeIds,['gallery','tea']);
});

test('an invalid saved self-parent is explained instead of reintroduced as a parent choice',()=>{
 const snapshot=fixture();snapshot.experience.recommendations.places[0].parentPlaceId='tea';
 const html=ui.recommendationEditorMarkup(snapshot,'test-property',{kind:'place',id:'tea'}),parents=html.match(/<select name="parentPlaceId">([\s\S]*?)<\/select>/)?.[1];
 assert.doesNotMatch(parents,/value="tea"/);assert.match(parents,/<option value=""[^>]*selected/);assert.match(html,/自身|自己/);
});
