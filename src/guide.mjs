import {contentRecord,emptyExperience,experienceOf,publicRecord,confirmedPoint,safeExternalUrl} from './experience.mjs';

export const GUIDE_PHASES=[{id:'arrival',label:'入住前'},{id:'during',label:'入住中'},{id:'after',label:'退房后'}];
export const GUIDE_POINTS=[{id:'property',label:'民宿位置'},{id:'parking',label:'停车点'},{id:'entrance',label:'实际入口'}];
export const publishedSnapshot=snapshot=>snapshot?.published??snapshot??{};
export function guideOf(snapshot,propertyId){return experienceOf(publishedSnapshot(snapshot),propertyId).guide??emptyExperience(propertyId).guide;}
export function publicGuideRecords(records,propertyId,unitId=null){return (Array.isArray(records)?records:[]).filter(record=>publicRecord(record,propertyId,unitId));}

// Official URI: https://lbs.amap.com/api/uri-api/guide/mobile-web/point
// position is longitude,latitude. A marker opens the map's route/navigation entry;
// no geocoding, fictitious start point or API key is introduced here.
export function guideMapUrl(point,propertyId,unitId=null){
 if(!confirmedPoint(point,propertyId,unitId))return '';
 const coordinate=point.coordinate??'gaode';
 if(!['gaode','wgs84'].includes(coordinate))return '';
 const params=new URLSearchParams({position:`${point.lng},${point.lat}`,name:point.address,coordinate,src:'minsu-demo',callnative:'0'});
 return `https://uri.amap.com/marker?${params}`;
}

// Legacy published facts have no record metadata. Explicit private, withdrawn,
// wrong-property or unconfirmed records must still respect their newer metadata.
export function guestPublishedItem(item,propertyId,unitId=null){
 if(!item||typeof item!=='object'||item.enabled===false||item.cancelled)return false;
 if(item.propertyId&&item.propertyId!==propertyId||item.unitId&&item.unitId!==unitId)return false;
 if(item.visibility&&item.visibility!=='public')return false;
 if(item.confirmation)return publicRecord({...item,propertyId:item.propertyId??propertyId,visibility:item.visibility??'public'},propertyId,unitId);
 if(item.validFrom&&(!Number.isFinite(Date.parse(item.validFrom))||Date.parse(item.validFrom)>Date.now()))return false;
 if(item.validUntil&&(!Number.isFinite(Date.parse(item.validUntil))||Date.parse(item.validUntil)<Date.now()))return false;
 return true;
}
export function guideKind(item){
 const text=String(item?.question??item?.text??'');
 if(/报修|故障|送站|接站|开票|发票|遗留|投诉|退款|退押金|补扫|代订|叫车|丢失|赔偿/.test(text))return {id:'request',label:'服务需求 · 需管家确认'};
 if(/怎么用|如何使用|操作|热水|网络|Wi-Fi|wifi|门禁|找不到/.test(text))return {id:'operation',label:'操作说明'};
 return {id:'rule',label:'规则与条件'};
}
export function handbookPhase(item,key=''){
 if(GUIDE_PHASES.some(p=>p.id===item?.phase))return item.phase;
 const phase=GUIDE_PHASES.find(p=>p.label===item?.phase);if(phase)return phase.id;
 const text=String(item?.question??'');
 if(/退房|押金|发票|遗留|售后|退款|损坏/.test(text)||key==='price')return 'after';
 if(['parking','location','checkin'].includes(key)||/到店|怎么走|停车|入住|接站/.test(text))return 'arrival';
 return 'during';
}

const text=(value,label,max=2000)=>{const result=String(value??'').trim();if(result.length>max)throw Error(`${label}请控制在${max}字以内`);return result;};
const pending=()=>({status:'pending',by:'',at:''});
function number(value,label,limit){if(String(value??'').trim()==='')return null;const n=Number(value);if(!Number.isFinite(n)||Math.abs(n)>limit)throw Error(`${label}无效，请核对坐标范围`);return n;}
function date(value,label){const result=text(value,label,100);if(result&&!Number.isFinite(Date.parse(result)))throw Error(`${label}无效，请填写日期或ISO时间`);return result||null;}
function url(value){const raw=text(value,'链接',2000);if(raw&&!safeExternalUrl(raw))throw Error('链接须为有效的http或https地址');return raw;}
function choice(value,allowed,label){if(!allowed.includes(value))throw Error(`${label}无效`);return value;}
function count(form,name,previousLength,max){if(!form.has(name))return previousLength;const n=Number(form.get(name));if(!Number.isInteger(n)||n<0||n>max)throw Error('指引或媒体条数无效');return n;}
function editRecord(form,prefix,previous,id,propertyId,fields){
 if(previous?.propertyId&&previous.propertyId!==propertyId)throw Error('资料不属于当前房源');
 const before=previous?structuredClone(previous):contentRecord(id,propertyId),next=structuredClone(before);
 const set=(key,parse)=>{const name=`${prefix}.${key}`;if(form.has(name))next[key]=parse(form.get(name));};
 set('sourceLabel',v=>text(v,'来源',200)||'待补来源');
 set('visibility',v=>choice(v,['public','stay','internal'],'可见范围'));
 set('unitId',v=>text(v,'适用单元',100)||null);
 set('enabled',v=>choice(v,['true','false'],'启用状态')==='true');
 set('validFrom',v=>date(v,'生效日期'));set('validUntil',v=>date(v,'失效日期'));
 for(const [key,parse]of Object.entries(fields))set(key,parse);
 if(next.validFrom&&next.validUntil&&Date.parse(next.validUntil)<Date.parse(next.validFrom))throw Error('失效日期不能早于生效日期');
 next.id=before.id;next.propertyId=propertyId;
 if(JSON.stringify(next)!==JSON.stringify(before))next.confirmation=pending();
 return next;
}

// Returns a new draft guide only. Saving/confirming/publishing belong to the
// workspace commands; this function cannot change the published snapshot.
export function readGuideForm(form,previousGuide,propertyId){
 if(!form||typeof form.has!=='function')throw Error('无法读取到店指引表单');
 const previous=previousGuide??emptyExperience(propertyId).guide,next=structuredClone(previous);next.points??={};
 for(const {id}of GUIDE_POINTS)next.points[id]=editRecord(form,`point.${id}`,previous.points?.[id],id==='property'?'property-location':id,propertyId,{address:v=>text(v,'公开地址',300),lat:v=>number(v,'纬度',90),lng:v=>number(v,'经度',180),coordinate:v=>choice(v,['gaode','wgs84'],'坐标系')});
 const stepCount=count(form,'steps.count',previous.steps?.length??0,20);next.steps=[];
 for(let i=0;i<stepCount;i++){
  const old=previous.steps?.[i],record=editRecord(form,`step.${i}`,old,`guide-step-${crypto.randomUUID()}`,propertyId,{title:v=>text(v,'步骤标题',100),text:v=>text(v,'操作步骤'),phase:v=>choice(v,GUIDE_PHASES.map(p=>p.id),'入住阶段')});
  if(old||record.text?.trim())next.steps.push(record);
 }
 const mediaCount=count(form,'media.count',previous.media?.length??0,12);next.media=[];
 for(let i=0;i<mediaCount;i++){
  const old=previous.media?.[i],record=editRecord(form,`media.${i}`,old,`guide-media-${crypto.randomUUID()}`,propertyId,{type:v=>choice(v,['image','video','link'],'媒体类型'),url,text:v=>text(v,'媒体说明'),title:v=>text(v,'媒体标题',100),phase:v=>choice(v,GUIDE_PHASES.map(p=>p.id),'媒体阶段')});
  if(old||record.url||record.text?.trim())next.media.push(record);
 }
 next.contact=editRecord(form,'contact',previous.contact,'contact',propertyId,{text:v=>text(v,'联系说明'),url});
 return next;
}
