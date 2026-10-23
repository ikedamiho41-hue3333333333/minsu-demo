import {icon} from './icons.mjs';
import {experienceOf,safeExternalUrl} from './experience.mjs';
import {selectRecommendations,recommendedPlaceById,recommendedRouteById,recommendationNavigation,recommendationReason,recommendationTransport,recommendationBenefits} from './recommendations.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const periods=[['all','时间不限'],['half','半天'],['day','一天']];
const parties=[['all','同行不限'],['family','亲子同行'],['couple','两人同行'],['senior','长辈同行'],['solo','独自出行']];
const kinds={place:'地点',route:'路线',benefit:'权益说明'};
const libraryButton=()=>'<button class="btn secondary wide" data-action="show-content-library">完整资料搜索 · 85条记录与5条主题路线</button>';
const duration=item=>Number.isFinite(item.durationMinutes)&&item.durationMinutes>0?`建议${item.durationMinutes}分钟`:'建议时长待补充';
const identity=(snapshot,item={})=>{
 const label=item.dataIdentity||snapshot.experience?.dataIdentity||'资料身份待确认';
 return `<span class="tag">${esc(label)}${/测试|原型/.test(label)||/测试/.test(item.confirmation?.by||'')?' · 演示确认':''}</span>`;
};
const unavailable=()=>`<div class="page-pad empty-state"><h1 class="page-title">这条推荐暂不可用</h1><p>未找到当前房源范围内已确认且仍有效的资料，请返回周边推荐重新选择。</p><button class="btn secondary wide" data-action="nav" data-route="guest/life">返回周边推荐</button></div>`;
function sourceMarkup(item,snapshot){
 const url=safeExternalUrl(item.sourceUrl);
 return `<section class="content-section"><h2>资料来源</h2><p>${esc(item.sourceLabel||'来源待补充')}</p>${url?`<a class="text-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">查看原始来源 ${icon('external')}</a>`:''}<p class="small muted">${esc(item.confirmation?.by||'确认人待补充')} · ${esc(item.confirmation?.at||'确认日期待补充')} · 公开资料 V${esc(snapshot.version??0)}</p></section>`;
}
function navigationMarkup(item,scope){
 const nav=recommendationNavigation(item,scope);
 return `<section class="content-section"><h2>位置与导航</h2><p>${esc(nav.address||'具体地址待补充，请向管家确认。')}</p>${nav.available&&nav.url?`<a class="btn secondary wide" href="${esc(nav.url)}" target="_blank" rel="noopener noreferrer">打开已确认地点导航 ${icon('external')}</a>`:'<p class="notice">定位尚待核验，暂不提供导航入口。</p>'}${nav.address?`<label class="field">地址可复制<input readonly aria-label="可复制的推荐地址" value="${esc(nav.address)}"></label><button class="text-btn" data-action="copy-recommendation-address" data-address="${esc(nav.address)}">复制地址</button>`:''}<p class="small muted">导航无法打开时，可复制地址到地图中查询；实际出行前请确认开放及交通情况。</p></section>`;
}
function factsMarkup(item,snapshot,scope){
 return `<dl class="detail-grid"><div><dt>建议时长</dt><dd>${esc(duration(item))}</dd></div><div><dt>适用安排</dt><dd>${esc(periods.find(([id])=>id===item.period)?.[1]||'适用时段待确认')}</dd></div><div><dt>交通</dt><dd>${esc(recommendationTransport(item,snapshot,scope))}</dd></div><div><dt>预约</dt><dd>${esc(item.bookingConfirmed===true?(item.booking||'已核验，详细预约说明待补充'):'预约方式待核验，请出行前向场所确认。')}</dd></div><div><dt>费用</dt><dd>${esc(item.feeConfirmed===true?(item.fee||'费用已核验，详细价目待补充'):'费用待核验，原稿价格不作为当前报价。')}</dd></div></dl>`;
}
const askButton=(kind,id)=>`<button class="btn wide" data-action="recommendation-ask" data-kind="${kind}" data-id="${esc(id)}">${icon('spark')} 带着这${kind==='route'?'条路线':'个地点'}问管家</button>`;
function recommendationRow(item,kind,snapshot,filters){
 return `<button class="content-row" data-action="recommendation-${kind}" data-id="${esc(item.id)}"><span>${identity(snapshot,item)}<strong>${esc(item.name)}</strong><span>${esc(recommendationReason(item,filters))}</span><small>${esc(duration(item))} · ${esc(item.address||'位置待补充')}</small><small>费用${item.feeConfirmed===true?'已核验':'待核验'} · 预约${item.bookingConfirmed===true?'已核验':'待核验'}</small></span>${icon('chevron')}</button>`;
}
export function recommendationsMarkup(snapshot,scope,filters={}){
 const selected=selectRecommendations(snapshot,scope,filters),current=selected.filters||filters;
 const picks=selected.places.length||selected.routes.length;
 return `<div class="page-pad recommendations-page"><h1 class="page-title">周边推荐</h1><form id="recommendation-filter" class="content-search"><label class="field">可以安排多久<select name="period">${periods.map(([id,label])=>`<option value="${id}" ${current.period===id?'selected':''}>${label}</option>`).join('')}</select></label><label class="field">和谁一起去<select name="party">${parties.map(([id,label])=>`<option value="${id}" ${current.party===id?'selected':''}>${label}</option>`).join('')}</select></label><button class="btn secondary wide" type="submit">看看适合的安排</button></form>${picks?`${selected.places.length?`<section class="content-section"><h2>精选地点</h2><div class="content-list">${selected.places.map(item=>recommendationRow(item,'place',snapshot,current)).join('')}</div></section>`:''}${selected.routes.length?`<section class="content-section"><h2>适合这次出行的路线</h2><div class="content-list">${selected.routes.map(item=>recommendationRow(item,'route',snapshot,current)).join('')}</div></section>`:''}`:`<div class="empty-state"><h2>暂无已核实推荐</h2><p>${esc(selected.emptyReason||'当前没有符合时间与同行偏好的已确认公开资料，管家补充并发布后会显示在这里。')}</p></div>`}${libraryButton()}<p class="small muted">原稿资料保留来源与待核验说明；原稿中的价格、营业与预约线索需另行确认。</p></div>`;
}
export function recommendedPlaceMarkup(id,snapshot,scope){
 const place=recommendedPlaceById(id,snapshot,scope);if(!place)return unavailable();
 const benefits=recommendationBenefits(snapshot,scope,place.id);
 return `<div class="page-pad content-detail"><h1 class="page-title">${esc(place.name)}</h1>${identity(snapshot,place)}<p>${esc(place.description||'地点介绍待补充。')}</p>${place.parentPlaceId?'<p class="notice">此条为场所内的子空间，开放范围与使用资格以该空间说明为准。</p>':''}${factsMarkup(place,snapshot,scope)}${navigationMarkup(place,scope)}${benefits.length?`<section class="content-section"><h2>相关权益说明</h2>${benefits.map(item=>`<article class="knowledge-item"><h3>${esc(item.name)}</h3><p>${esc(item.description||'使用条件请向场所确认。')}</p>${identity(snapshot,item)}<p class="small muted">来源：${esc(item.sourceLabel||'来源待补充')}</p></article>`).join('')}</section>`:''}${askButton('place',place.id)}${sourceMarkup(place,snapshot)}<p class="content-disclaimer">本页只说明资料，没有发起预约或服务申请。</p></div>`;
}
export function recommendedRouteMarkup(id,snapshot,scope){
 const route=recommendedRouteById(id,snapshot,scope);if(!route)return unavailable();
 const stops=route.placeIds.map(placeId=>recommendedPlaceById(placeId,snapshot,scope));
 return `<div class="page-pad content-detail"><h1 class="page-title">${esc(route.name)}</h1>${identity(snapshot,route)}<p>${esc(route.description||'路线说明待补充。')}</p><p class="notice">此路线按自身${route.period==='half'?'半天':route.period==='day'?'一天':'已确认'}安排展示，请结合往返交通和同行体力核实。</p>${factsMarkup(route,snapshot,scope)}<section class="content-section"><h2>路线中的地点</h2><ol class="content-itinerary">${stops.map(place=>`<li><button class="content-stop" data-action="recommendation-place" data-id="${esc(place.id)}"><strong>${esc(place.name)}</strong>${icon('chevron')}</button><p>${esc(place.address||'地点地址待补充')} · ${esc(duration(place))}</p></li>`).join('')}</ol></section>${navigationMarkup(route,scope)}${askButton('route',route.id)}${sourceMarkup(route,snapshot)}<p class="content-disclaimer">路线建议不代表各站已预约；未核实的费用与开放条件仍需出行前确认。</p></div>`;
}
const localDateValue=value=>{
 if(!value)return '';
 const date=new Date(value);
 return Number.isFinite(+date)?new Date(+date-date.getTimezoneOffset()*60000).toISOString().slice(0,16):'';
};
const textField=(name,label,value='',type='text')=>`<label class="field">${label}<input name="${name}" type="${type}" value="${esc(type==='datetime-local'?localDateValue(value):value)}" ${type==='number'?'step="any"':''}></label>`;
const checkField=(name,label,checked)=>`<label class="field"><span><input type="checkbox" name="${name}" ${checked?'checked':''}> ${label}</span></label>`;
export function recommendationEditorMarkup(snapshot,pid,{kind='place',id=null}={}){
 if(!Object.hasOwn(kinds,kind))kind='place';
 const content=experienceOf(snapshot,pid).recommendations,collection=kind==='place'?'places':kind==='route'?'routes':'benefits';
 const record=id?content[collection].find(item=>item.id===id&&item.propertyId===pid):null;
 if(id&&!record)return '<div class="empty-state"><h2>这条维护资料不存在</h2><p>请返回当前房源的推荐清单重新选择。</p></div>';
 const r=record||{enabled:true,visibility:'public',party:[],period:'half'};
 const listing=Object.entries(kinds).map(([itemKind,label])=>{
  const key=itemKind==='place'?'places':itemKind==='route'?'routes':'benefits';
  return `<section class="editor-group"><h2>${label}资料</h2>${(content[key]||[]).filter(item=>item.propertyId===pid).map(item=>`<button class="fact-row" data-action="edit-recommendation" data-kind="${itemKind}" data-id="${esc(item.id)}"><span>${esc(item.name||'名称待补充')} · ${item.enabled===false?'已停用':item.confirmation?.status==='confirmed'?'已确认草稿':'待确认'}</span>${icon('chevron')}</button>`).join('')}<button class="text-btn" data-action="new-recommendation" data-kind="${itemKind}">${icon('plus')} 新增${label}</button></section>`;
 }).join('');
 return `<section class="recommendation-editor"><h2>精选与来源维护</h2><p class="notice">保存后成为待确认草稿；测试确认不会代表真实经营方核验，公开发布另行操作。</p>${listing}<form id="recommendation-form"><input type="hidden" name="id" value="${esc(r.id||'')}"><label class="field">资料类型<select name="kind">${Object.entries(kinds).map(([key,label])=>`<option value="${key}" ${key===kind?'selected':''}>${label}</option>`).join('')}</select></label>${textField('name','名称',r.name)}<label class="field">介绍与适用条件<textarea name="description" maxlength="1000">${esc(r.description||'')}</textarea></label>${textField('address','地点或路线位置',r.address)}${textField('lat','已核实定位纬度（未核留空）',r.lat??'','number')}${textField('lng','已核实定位经度（未核留空）',r.lng??'','number')}${textField('durationMinutes','建议时长（分钟）',r.durationMinutes??'','number')}<label class="field">适用时长<select name="period">${periods.filter(([key])=>key!=='all').map(([key,label])=>`<option value="${key}" ${key===r.period?'selected':''}>${label}</option>`).join('')}</select></label><fieldset class="editor-group"><legend>适合同伴（只勾选已了解的条件）</legend>${parties.filter(([key])=>key!=='all').map(([key,label])=>`<label><input type="checkbox" name="party" value="${key}" ${(r.party||[]).includes(key)?'checked':''}> ${label}</label>`).join('')}</fieldset>${textField('transport','交通说明',r.transport)}${checkField('transportConfirmed','交通说明已逐项核验',r.transportConfirmed===true)}${textField('booking','预约方式',r.booking)}${checkField('bookingConfirmed','预约方式已逐项核验',r.bookingConfirmed===true)}${textField('fee','费用及计价条件',r.fee)}${checkField('feeConfirmed','费用及单位已逐项核验',r.feeConfirmed===true)}${textField('sourceLabel','资料来源',r.sourceLabel)}${textField('sourceUrl','原始来源网址（选填）',r.sourceUrl,'url')}${textField('unitId','仅适用出租单元ID（留空为本房源）',r.unitId)}${textField('placeIds','路线站点或权益适用地点ID（逗号分隔）',(r.placeIds||[r.placeId].filter(Boolean)).join(','))}${textField('parentPlaceId','所属场所ID（子空间选填）',r.parentPlaceId)}<label class="field">可公开范围<select name="visibility">${[['public','公开资料'],['resident','入住专属'],['internal','内部资料']].map(([key,label])=>`<option value="${key}" ${key===r.visibility?'selected':''}>${label}</option>`).join('')}</select></label>${textField('validFrom','生效时间（选填）',r.validFrom||'','datetime-local')}${textField('validUntil','失效时间（选填）',r.validUntil||'','datetime-local')}${checkField('enabled','启用此条资料',r.enabled!==false)}${checkField('cancelled','活动已取消／权益已取消',r.cancelled===true)}<button class="btn secondary wide" type="submit">保存推荐草稿</button></form></section>`;
}
