import {publicRecord,safeExternalUrl} from './experience.mjs';
import {routeTimingIssue} from './recommendations.mjs';

const clone=value=>structuredClone(value);
const pending=()=>({status:'pending',by:'',at:''});
const unknown=/待确认|待核验|待填写|待补|尚未确认|尚未提供|未记录|未提供|未知|不详/;
const provided=value=>typeof value==='string'&&!!value.trim()&&!unknown.test(value);
const canonical=value=>{
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])]));
 return value;
};
function signature(value){
 const raw=JSON.stringify(canonical(value));let hash=0xcbf29ce484222325n;
 for(let i=0;i<raw.length;i++){hash^=BigInt(raw.charCodeAt(i));hash=BigInt.asUintN(64,hash*0x100000001b3n);}
 return `draft-v1:${hash.toString(16).padStart(16,'0')}:${raw.length}`;
}
// This local fingerprint detects edits; it is not authentication or a signature
// from a real business. Record confirmations are included, the global receipt is not.
export function draftFingerprint(draft){
 const value=clone(draft);if(value?.experience)delete value.experience.confirmation;
 return signature(value);
}
function recordFingerprint(record){const copy=clone(record);delete copy.confirmation;return signature(copy);}
const propertyIdOf=draft=>draft?.experience?.propertyId;
function recordsOf(draft){
 const result=[];if(!draft||typeof draft!=='object')return result;
 for(const [key,record]of Object.entries(draft.facts??{}))if(record&&typeof record==='object')result.push({key:`facts.${key}`,id:record.id??`fact:${key}`,label:key,group:'fact',record});
 for(const record of draft.knowledge??[])if(record&&typeof record==='object')result.push({key:`knowledge.${record.id}`,id:record.id,label:record.question,group:'knowledge',record});
 const experience=draft.experience??{},guide=experience.guide??{},recommendations=experience.recommendations??{};
 for(const [key,record]of Object.entries(guide.points??{}))if(record)result.push({key:`guide.points.${key}`,id:record.id,label:{property:'民宿位置',parking:'停车点',entrance:'实际入口'}[key]??key,group:'point',record});
 for(const record of guide.steps??[])if(record)result.push({key:`guide.steps.${record.id}`,id:record.id,label:record.title||'操作指引',group:'step',record});
 for(const record of guide.media??[])if(record)result.push({key:`guide.media.${record.id}`,id:record.id,label:record.title||'媒体',group:'media',record});
 if(guide.contact)result.push({key:'guide.contact',id:guide.contact.id,label:'联系获取方式',group:'contact',record:guide.contact});
 for(const [key,group]of [['places','place'],['routes','route'],['benefits','benefit']])for(const record of recommendations[key]??[])if(record)result.push({key:`recommendations.${key}.${record.id}`,id:record.id,label:record.name||'待补名称',group,record});
 return result;
}
function envelope(draft){
 const next=clone(draft),pid=propertyIdOf(next);
 if(!pid)return next;
 for(const descriptor of recordsOf(next)){
  const record=descriptor.record;
  if(record.id===undefined)record.id=descriptor.id;
  if(record.propertyId===undefined)record.propertyId=pid;
  if(record.unitId===undefined)record.unitId=null;
  if(record.visibility===undefined)record.visibility='public';
  if(record.enabled===undefined)record.enabled=true;
  if(!record.confirmation)record.confirmation=pending();
 }
 return next;
}
export function invalidateDraftConfirmation(draft,previousDraft=null){
 if(!draft?.experience)return clone(draft);
 const next=envelope(draft),previous=new Map(recordsOf(envelope(previousDraft??{})).map(item=>[item.key,item.record]));
 for(const {key,record}of recordsOf(next)){
  const before=previous.get(key);
  if(!before||recordFingerprint(before)!==recordFingerprint(record))record.confirmation=pending();
 }
 next.experience.confirmation=pending();return next;
}
function reasonFor(item,draft,now,sourceFallback=''){
 const {record:r,group}=item,pid=propertyIdOf(draft);
 if(!r.id||r.propertyId!==pid)return '房源归属或稳定编号不一致';
 if(r.unitId){const valid=r.unitId==='whole'?draft.rentalMode==='whole':(draft.rooms??[]).some(room=>room.id===r.unitId&&room.enabled!==false);if(!valid)return '适用单元不存在或已停用';}
 if(r.visibility!=='public')return '属于内部或入住专属范围，保留原可见范围';
 if(r.enabled===false||r.cancelled||['disabled','cancelled','ended'].includes(r.status))return '已停用、取消或结束';
 if(r.status==='pending'||r.status==='draft'||r.status==='unconfirmed')return '原稿或候选状态仍待核验';
 if(r.validFrom&&(!Number.isFinite(Date.parse(r.validFrom))||Date.parse(r.validFrom)>now))return '生效日期待核或尚未生效';
 if(r.validUntil&&(!Number.isFinite(Date.parse(r.validUntil))||Date.parse(r.validUntil)<now))return '有效期已过或日期待核';
 const source=Object.hasOwn(r,'sourceLabel')?r.sourceLabel:['fact','knowledge'].includes(group)?sourceFallback:'';
 if(!provided(source)||source==='待补来源')return '资料来源待补充';
 if(group==='knowledge'&&r.kind==='confirmation_guide'&&r.requiresHuman!==false)return '原30问的真实规则仍需店方确认';
 const value=group==='point'?r.address:group==='media'?(r.text||r.title||r.url):['place','route','benefit'].includes(group)?r.name:r.text;
 if(!provided(value))return '内容为空或明确待确认';
 if(group==='point'&&(r.lat!==undefined&&r.lat!==null||r.lng!==undefined&&r.lng!==null)){
  if(typeof r.lat!=='number'||typeof r.lng!=='number'||!Number.isFinite(r.lat)||!Number.isFinite(r.lng)||Math.abs(r.lat)>90||Math.abs(r.lng)>180)return '定位坐标尚不完整或无效';
 }
 if(group==='media'&&!safeExternalUrl(r.url))return '媒体链接缺失或无效';
 if(group==='contact'&&r.url&&!safeExternalUrl(r.url))return '联系页面链接无效';
 if(['place','route','benefit'].includes(group))for(const field of ['fee','booking','transport'])if(r[field+'Confirmed']===true&&!provided(r[field]))return `${field==='fee'?'费用':field==='booking'?'预约':'交通'}核实内容仍为空或未知`;
 if(group==='route'){
  if(!['half','day'].includes(r.period)||!Number.isFinite(r.durationMinutes)||r.durationMinutes<=0||r.period==='half'&&r.durationMinutes>240||!Array.isArray(r.placeIds)||!r.placeIds.length)return '路线时长、类型或站点待补齐';
  const timingIssue=routeTimingIssue(r,draft.experience.recommendations?.places??[]);if(timingIssue)return timingIssue;
 }
 if(group==='benefit'&&!r.validUntil)return '权益有效期待补充';
 if(group==='route'||group==='benefit'){
  const ids=group==='route'?r.placeIds:[...new Set([r.placeId,...(r.placeIds??[])].filter(Boolean))],places=draft.experience.recommendations?.places??[];
  if(!ids?.length||ids.some(id=>!places.some(place=>place.id===id&&publicRecord(place,pid,r.unitId??null,now))))return '关联地点尚未确认、停用或不适用';
 }
 return '';
}
function text(value,label,max=200){if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw Error(`请填写${label}（1—${max}字）`);return value.trim();}
export function confirmDraft(draft,action,now=Date.now()){
 if(!draft?.experience?.propertyId)throw Error('旧版资料没有独立确认流程，请先升级资料结构');
 if(action.confirmTestContent!==true)throw Error('请明确勾选确认本次测试内容；测试确认不代表真实店方确认');
 const by=text(action.by,'实际测试确认操作者姓名',80),sourceLabel=text(action.sourceLabel,'本次测试确认来源',200),next=envelope(draft),pid=propertyIdOf(next),at=new Date(now).toISOString();
 if(!provided(sourceLabel))throw Error('本次测试确认来源仍待补充');
 const descriptors=recordsOf(next),selected=action.recordIds;
 if(selected!==undefined&&(!Array.isArray(selected)||selected.some(id=>typeof id!=='string')))throw Error('请选择有效的测试记录编号');
 if(selected)for(const id of selected){const found=descriptors.filter(item=>item.key===id||item.id===id);if(found.length!==1)throw Error('测试记录编号不存在或不唯一，请使用记录的完整key');}
 const included=item=>selected===undefined||selected.includes(item.key)||selected.includes(item.id);
 const confirmedKeys=[];
 // Places precede routes/benefits so dependencies are checked against the same
 // test-confirmed snapshot rather than a previous public version.
 const ordered=[...descriptors].sort((a,b)=>({place:0,route:2,benefit:3}[a.group]??1)-({place:0,route:2,benefit:3}[b.group]??1));
 for(const item of ordered){
  const reason=reasonFor(item,next,now,sourceLabel),r=item.record;
  if(reason){
   if(!/内部|专属|停用|取消|结束|有效期已过/.test(reason))r.confirmation=pending();
   continue;
  }
  if(!included(item))continue;
  if(!Object.hasOwn(r,'sourceLabel')&&['fact','knowledge'].includes(item.group))r.sourceLabel=sourceLabel;
  r.confirmation={status:'confirmed',by,at,identity:'test',businessConfirmed:false,sourceLabel:r.sourceLabel,scope:{propertyId:pid,unitId:r.unitId??null,visibility:r.visibility}};
  r.confirmation.fingerprint=recordFingerprint(r);confirmedKeys.push(item.key);
 }
 next.experience.confirmation={status:'confirmed',by,at,identity:'test',businessConfirmed:false,sourceLabel,scope:{propertyId:pid,visibility:'public'},confirmedKeys};
 next.experience.confirmation.fingerprint=draftFingerprint(next);
 return next;
}
export function publicationStatus(state,now=Date.now()){
 try{
  const draft=state?.draft,pid=propertyIdOf(draft),confirmation=clone(draft?.experience?.confirmation??pending());
  const fingerprint=draft?draftFingerprint(draft):null,descriptors=recordsOf(draft),records=descriptors.map(item=>({key:item.key,id:item.id,label:item.label,group:item.group,propertyId:item.record.propertyId,unitId:item.record.unitId??null,visibility:item.record.visibility??'public',sourceLabel:item.record.sourceLabel??'',confirmation:clone(item.record.confirmation??pending()),missing:reasonFor(item,draft,now,confirmation.sourceLabel||'')||(item.record.confirmation?.status!=='confirmed'?'尚未进行本次测试确认':'')}));
  const confirmed=!!pid&&confirmation.status==='confirmed'&&confirmation.identity==='test'&&confirmation.businessConfirmed===false&&!!confirmation.by&&Number.isFinite(Date.parse(confirmation.at))&&confirmation.scope?.propertyId===pid&&confirmation.fingerprint===fingerprint;
  return {confirmed,canPublish:confirmed,confirmation,missing:records.filter(item=>item.missing).map(item=>({...item,reason:item.missing})),records,propertyId:pid??state?.propertyId??null,fingerprint};
 }catch{return {confirmed:false,canPublish:false,confirmation:pending(),missing:[{key:'draft',reason:'资料结构不完整，请先保存并检查草稿'}],records:[],propertyId:null,fingerprint:null};}
}
