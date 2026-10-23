import {contentRecord,experienceOf,publicRecord,confirmedPoint,safeExternalUrl} from './experience.mjs';

const parties={family:'亲子',couple:'两人同行',senior:'长辈同行',solo:'独自出行'};
const periods={half:'半天',day:'一天'};
const collections={place:'places',route:'routes',benefit:'benefits'};
const copy=value=>structuredClone(value);
const own=(value,key)=>Object.hasOwn(value,key);
function collection(snapshot,scope,key){
 const values=experienceOf(snapshot,scope?.propertyId).recommendations?.[key];
 return Array.isArray(values)?values:[];
}
function available(item,scope,now){
 return !!scope?.propertyId&&publicRecord(item,scope.propertyId,scope.unitId??null,now)
  &&typeof item.id==='string'&&!!item.id&&typeof item.name==='string'&&!!item.name.trim()
  &&typeof item.sourceLabel==='string'&&!!item.sourceLabel.trim()&&item.sourceLabel.trim()!=='待补来源'
  &&item.status!=='cancelled'&&item.status!=='ended'&&item.status!=='disabled';
}
function findUnique(items,id){const matches=items.filter(item=>item.id===id);return matches.length===1?matches[0]:null;}
function placesFor(snapshot,scope,now){
 const items=collection(snapshot,scope,'places');
 return items.filter(item=>available(item,scope,now)&&findUnique(items,item.id)===item);
}
export function routeTimingIssue(route,places){
 const candidates=Array.isArray(places)?places:[],ids=Array.isArray(route?.placeIds)?route.placeIds:[];
 const stops=ids.map(id=>candidates.find(place=>place?.id===id&&(!route.propertyId||place.propertyId===route.propertyId))).filter(Boolean);
 const fullDay=route?.period==='half'&&stops.find(place=>place.period==='day');
 if(fullDay)return `半天路线不能包含按一天安排的项目：${fullDay.name||'该地点'}。`;
 const knownMinutes=stops.reduce((sum,place)=>sum+(Number.isFinite(place.durationMinutes)&&place.durationMinutes>0?place.durationMinutes:0),0);
 if(Number.isFinite(route?.durationMinutes)&&route.durationMinutes>0&&knownMinutes-route.durationMinutes>1e-9)return `各站已知停留时长合计${knownMinutes}分钟，超过路线${route.durationMinutes}分钟；请调整站点或路线时长，尚未计入往返交通。`;
 return '';
}
function routeAvailable(route,places,scope,now){
 return available(route,scope,now)&&!!periods[route.period]&&Number.isFinite(route.durationMinutes)&&route.durationMinutes>0
  &&(route.period!=='half'||route.durationMinutes<=240)&&Array.isArray(route.placeIds)&&route.placeIds.length>0
  &&route.placeIds.every(id=>places.some(place=>place.id===id))&&!routeTimingIssue(route,places);
}
export function recommendedPlaceById(id,snapshot,scope,{now=Date.now()}={}){
 const item=findUnique(placesFor(snapshot,scope,now),id);return item?copy(item):null;
}
export function recommendedRouteById(id,snapshot,scope,{now=Date.now()}={}){
 const routes=collection(snapshot,scope,'routes'),route=findUnique(routes,id),places=placesFor(snapshot,scope,now);
 return route&&routeAvailable(route,places,scope,now)?copy(route):null;
}
function benefitPlaceIds(item){return [...new Set([item.placeId,...(Array.isArray(item.placeIds)?item.placeIds:[])].filter(Boolean))];}
export function recommendationBenefits(snapshot,scope,placeId,{now=Date.now()}={}){
 const places=placesFor(snapshot,scope,now),ids=new Set(places.map(place=>place.id));
 return collection(snapshot,scope,'benefits').filter(item=>{
  const linked=benefitPlaceIds(item);
  return available(item,scope,now)&&linked.length>0&&linked.every(id=>ids.has(id))&&(!placeId||linked.includes(placeId));
 }).map(copy);
}
function filtersOf(filters){return {period:periods[filters.period]?filters.period:'all',party:parties[filters.party]?filters.party:'all'};}
function matches(item,filters){
 return (filters.period==='all'||item.period===filters.period&&(filters.period!=='half'||Number.isFinite(item.durationMinutes)&&item.durationMinutes>0&&item.durationMinutes<=240))
  &&(filters.party==='all'||Array.isArray(item.party)&&item.party.includes(filters.party));
}
export function selectRecommendations(snapshot,scope,filters={}){
 const now=filters.now??Date.now(),current=filtersOf(filters),allPlaces=placesFor(snapshot,scope,now),allRoutes=collection(snapshot,scope,'routes');
 const limit=Number.isFinite(Number(filters.limit))?Math.max(1,Math.min(5,Math.floor(Number(filters.limit)))):5;
 const places=allPlaces.filter(item=>matches(item,current)).slice(0,limit);
 const routes=allRoutes.filter(item=>routeAvailable(item,allPlaces,scope,now)&&findUnique(allRoutes,item.id)===item&&matches(item,current)).slice(0,2);
 const selectedIds=new Set([...places.map(item=>item.id),...routes.flatMap(item=>item.placeIds)]);
 const benefits=recommendationBenefits(snapshot,scope,null,{now}).filter(item=>benefitPlaceIds(item).some(id=>selectedIds.has(id)));
 const selection=[periods[current.period],parties[current.party]].filter(Boolean).join(' · ');
 const emptyReason=places.length||routes.length?'':selection?`暂无符合${selection}条件的已核实推荐；需补充对应地点、时长及适合条件。`:'暂无已核实推荐；店方确认并发布后会出现在这里。';
 return {places:places.map(copy),routes:routes.map(copy),benefits,filters:current,emptyReason};
}
export function recommendationReason(record,filters={}){
 const selected=filtersOf(filters),reasons=[];
 if(selected.period!=='all'&&record.period===selected.period)reasons.push(`适合${periods[selected.period]}安排`);
 else if(periods[record.period])reasons.push(`建议按${periods[record.period]}安排`);
 if(selected.party!=='all'&&record.party?.includes(selected.party))reasons.push(`资料标注适合${parties[selected.party]}`);
 else if(record.party?.length)reasons.push(`适合${record.party.map(value=>parties[value]).filter(Boolean).join('、')}`);
 if(Number.isFinite(record.durationMinutes)&&record.durationMinutes>0)reasons.push(`建议停留约${record.durationMinutes}分钟`);
 return reasons.join('；')||'适合条件与停留时间待补充，可先查看详情。';
}
export function recommendationNavigation(record,scope){
 const address=typeof record?.address==='string'?record.address.trim():'';
 if(!scope?.propertyId||!confirmedPoint(record,scope.propertyId,scope.unitId??null))return {url:'',address,available:false};
 const url=new URL('https://uri.amap.com/marker');url.searchParams.set('position',`${record.lng},${record.lat}`);url.searchParams.set('name',record.name||address);url.searchParams.set('coordinate','gaode');url.searchParams.set('callnative','0');
 return {url:safeExternalUrl(url.href),address,available:true};
}
export function recommendationSourceUrl(record){return safeExternalUrl(record?.sourceUrl);}
export function recommendationTransport(record,snapshot,scope){
 if(record?.transportConfirmed!==true)return '交通方式、车程与使用条件待核实。';
 const points=experienceOf(snapshot,scope?.propertyId).guide?.points??{};
 const origin=[points.entrance,points.property].some(point=>confirmedPoint(point,scope?.propertyId,scope?.unitId??null));
 if(!origin)return '本房源准确出发点尚未确认，车程与距离待核实；可先查看目的地位置。';
 return record.transport?.trim()||'交通方式待补充。';
}
export function recommendationContext(kind,id,snapshot,scope){
 const item=kind==='place'?recommendedPlaceById(id,snapshot,scope):kind==='route'?recommendedRouteById(id,snapshot,scope):null;
 return item?{kind,id:item.id,label:item.name,propertyId:scope.propertyId,unitId:scope.unitId??null,version:snapshot.version,collection:'recommendations'}:null;
}

function value(form,key,previous,fallback=''){return form.has(key)?String(form.get(key)??'').trim():String(previous?.[key]??fallback).trim();}
function text(value,label,{required=false,max=1000}={}){
 if(required&&!value||value.length>max)throw Error(`请填写${label}${required?'':'（可留空）'}，最多${max}字`);
 return value;
}
function number(form,key,previous,label,max){
 const raw=value(form,key,previous);if(raw==='')return null;
 const result=Number(raw);if(!Number.isFinite(result)||Math.abs(result)>max)throw Error(`${label}格式不正确`);return result;
}
function checked(form,key){return form.has(key)&&!['false','0','off',''].includes(String(form.get(key)));}
function date(form,key,previous){const raw=value(form,key,previous);if(raw&&!Number.isFinite(Date.parse(raw)))throw Error('有效期日期格式不正确');return raw||null;}
function placeIds(form,previous){
 const values=form.has('placeIds')?form.getAll('placeIds'):Array.isArray(previous?.placeIds)?previous.placeIds:[previous?.placeId].filter(Boolean);
 return [...new Set(values.flatMap(raw=>String(raw).split(/[,，\n]/)).map(id=>id.trim()).filter(Boolean))];
}
export function readRecommendationForm(form,previous,propertyId){
 if(typeof propertyId!=='string'||!propertyId.trim())throw Error('房源身份缺失');
 if(previous&&previous.propertyId!==propertyId)throw Error('资料不属于当前房源');
 const kind=value(form,'kind',previous,'place');if(!own(collections,kind))throw Error('请选择地点、路线或权益说明');
 if(previous?.kind&&previous.kind!==kind)throw Error('不能改变现有资料类型，请另行新增');
 const incomingId=value(form,'id',null);
 if(incomingId&&(!previous||incomingId!==previous.id))throw Error('资料编号与当前编辑对象不一致');
 const id=previous?.id||crypto.randomUUID(),result={...contentRecord(id,propertyId),...copy(previous??{}),kind,id,propertyId};
 for(const key of ['name','address','description','sourceLabel','transport','booking','fee','parentPlaceId'])result[key]=text(value(form,key,previous),key==='name'?'名称':key==='sourceLabel'?'资料来源':'说明',{required:key==='name'||key==='sourceLabel',max:key==='name'?100:1000});
 result.unitId=value(form,'unitId',previous)||null;
 result.visibility=value(form,'visibility',previous,'public');if(!['public','resident','internal'].includes(result.visibility))throw Error('请选择可见范围');
 result.enabled=checked(form,'enabled');result.cancelled=checked(form,'cancelled');
 result.lat=number(form,'lat',previous,'纬度',90);result.lng=number(form,'lng',previous,'经度',180);
 result.durationMinutes=number(form,'durationMinutes',previous,'时长',1440);if(result.durationMinutes!==null&&result.durationMinutes<=0)throw Error('建议时长必须大于0分钟');
 result.period=value(form,'period',previous);if(result.period==='all')result.period='';if(result.period&&!own(periods,result.period))throw Error('请选择半天或一天');
 result.party=[...new Set(form.getAll('party').map(String))];if(result.party.some(item=>!own(parties,item)))throw Error('同行偏好选项不正确');
 result.sourceUrl=value(form,'sourceUrl',previous);if(result.sourceUrl&&!safeExternalUrl(result.sourceUrl))throw Error('来源链接请填写http或https网址');
 result.validFrom=date(form,'validFrom',previous);result.validUntil=date(form,'validUntil',previous);
 if(result.validFrom&&result.validUntil&&Date.parse(result.validUntil)<Date.parse(result.validFrom))throw Error('有效结束日期不能早于开始日期');
 for(const field of ['transport','booking','fee'])result[field+'Confirmed']=checked(form,field+'Confirmed');
 if(kind==='route'){
  result.placeIds=placeIds(form,previous);
  if(!result.period||!result.durationMinutes)throw Error('请填写路线适用半天或一天及自己的建议时长');
  if(result.period==='half'&&result.durationMinutes>240)throw Error('半天路线建议时长需在240分钟以内，请另做半日安排或选择一天');
 }
 if(kind==='benefit'){
  result.placeIds=placeIds(form,previous);
  result.placeId=form.has('placeId')?value(form,'placeId',null):form.has('placeIds')?result.placeIds[0]||'':previous?.placeId||result.placeIds[0]||'';
 }
 result.confirmation={status:'pending',by:'',at:''};
 return result;
}
