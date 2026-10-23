import {experienceOf,publicRecord,safeExternalUrl} from './experience.mjs';
import {guestPublishedItem} from './guide.mjs';
import {QINGHUAN_QUESTIONS} from './qinghuan.mjs';
import {requestedScopes,factScopes} from './answer-scopes.mjs';
import {recommendedPlaceById,recommendedRouteById,recommendationContext,recommendationTransport,recommendationNavigation,selectRecommendations,recommendationBenefits} from './recommendations.mjs';
import {answerContent,validContentContext} from './content.mjs';

// Content uses the workspace key; persisted legacy thread identities stay intact.
export const scopePropertyId=state=>state.published.experience?.propertyId??state.propertyId;

const clone=value=>structuredClone(value),norm=value=>String(value??'').normalize('NFKC').replace(/[\s·，,。？?！!、；;]/g,'').toLowerCase();
const originalGuides=new Map(QINGHUAN_QUESTIONS.map(item=>[item.id,item]));
const unavailable=body=>({status:'unavailable',body,sources:[],knowledgeIds:[],context:null});
const pending=body=>({status:'needs_human',body,sources:[],knowledgeIds:[],mode:'local',context:null});
const publicStatus=item=>!['pending','draft','unconfirmed','disabled','cancelled','ended','expired'].includes(item?.status);
export function answerKind(question){
 const affirmative=String(question).replace(/(?:不用|不需要|不要|不申请)[^，,。；;！？?!]*/g,'');
 if(/(?:帮(?:我|我们)?|请|我要|我想|我们想|需要)(?:安排|预约|预订|报名|派|报修|维修|叫车|订车|接站|送站|补扫|清扫|寄回|退款|退押金)|坏了|故障|失灵|漏水|停水|停电|跳闸|冒烟|连不上|连接失败|断网|网速慢|忽冷忽热|不出热水|不制冷|不制热|无法启动|开不了|没反应|热水.{0,8}(?:不热|太冷|太烫)/.test(affirmative))return 'request';
 if(/怎么|如何|操作|使用|步骤|教程|视频|找不到|怎么走/.test(question))return 'operation';
 return 'rule';
}
export function originalGuideQuestion(p,question){
 const q=norm(question);
 return (p.knowledge??[]).some(item=>item.kind==='confirmation_guide'&&[item.question,...(item.aliases??[])].some(value=>norm(value)===q));
}
export function contextIssue(state,context){
 if(!context)return null;
 const pid=scopePropertyId(state),p=state.published;
 if(Object.hasOwn(context,'propertyId')&&context.propertyId!==pid)return unavailable('这个对象不属于当前民宿，不能引用。请返回当前房源重新选择。');
 const selected=['arrival','guide','place','route','activity-lead'].includes(context.kind)||context.collection==='recommendations';
 if(selected&&context.propertyId!==pid)return unavailable('对象的房源归属缺失或不一致，请返回当前房源重新选择。');
 if(context.unitId){
  const valid=context.unitId==='whole'?p.rentalMode==='whole':p.rentalMode!=='whole'&&(p.rooms??[]).some(room=>room.id===context.unitId&&room.enabled!==false);
  if(!valid)return unavailable('这个出租单元已失效或不属于当前民宿，请通过当前房源重新选择。');
 }
 if(context.roomId&&context.unitId&&context.unitId!=='whole'&&context.roomId!==context.unitId)return unavailable('所选房间与当前出租单元不一致，请重新选择。');
 if(context.roomId&&!(p.rooms??[]).some(room=>room.id===context.roomId&&room.enabled!==false))return {status:'needs_clarification',body:'这个房间不在本民宿当前公开资料中，请重新选择房间。',sources:[],knowledgeIds:[],context:null};
 return null;
}
export function visiblePublishedItem(item,propertyId,unitId=null){return publicStatus(item)&&guestPublishedItem(item,propertyId,unitId);}
export function answerState(state,context=null){
 const unitId=context?.unitId??null,p=state.published;
 const facts=Object.fromEntries(Object.entries(p.facts??{}).filter(([,item])=>visiblePublishedItem(item,scopePropertyId(state),unitId)));
 const knowledge=(p.knowledge??[]).flatMap(item=>{
  if(visiblePublishedItem(item,scopePropertyId(state),unitId))return [item];
  const original=originalGuides.get(item.id);
  const structural={...item,confirmation:undefined,validFrom:null,validUntil:null,status:undefined};
  if(original&&item.kind==='confirmation_guide'&&guestPublishedItem(structural,scopePropertyId(state),unitId))return [{...item,requiresHuman:true,text:original.text,confirmationChecklist:original.confirmationChecklist,sourceLabel:original.sourceLabel,sourceRange:original.sourceRange}];
  return [];
 });
 return {...state,published:{...p,facts,knowledge}};
}
function guideEntry(state,context){
 const p=state.published,pid=scopePropertyId(state),unit=context.unitId??null,guide=experienceOf(p,pid).guide;
 if(!guide)return null;
 const labels={property:'民宿位置',parking:'停车点',entrance:'实际入口'};
 for(const [key,record]of Object.entries(guide.points??{}))if(context.id===record?.id||context.id===key)return publicRecord(record,pid,unit)?{record,label:labels[key]||key,type:'point',key,scopes:new Set(['location',...(key==='parking'?['parking']:[])])}:null;
 for(const record of [...(guide.steps??[]),...(guide.media??[]),guide.contact].filter(Boolean))if(record.id===context.id)return publicRecord(record,pid,unit)?{record,label:record.title||(record.id==='contact'?'到店联系':'入住指引'),type:guide.contact===record?'contact':'guide',scopes:requestedScopes([record.title,record.text].join('；'))}:null;
 if(context.kind==='guide'&&String(context.id).startsWith('fact:')){
  const key=context.id.slice(5),record=p.facts?.[key];
  if(record&&visiblePublishedItem(record,pid,unit))return {record:{...record,id:context.id},label:{parking:'停车说明',kitchen:'厨房规则',checkin:'入住与退房',wifi:'网络与设备使用',location:'位置与交通'}[key]||key,type:'fact',key,scopes:factScopes(key,record.text)};
 }
 const item=(p.knowledge??[]).find(item=>item.id===context.id);
 if(context.kind==='guide'&&item&&visiblePublishedItem(item,pid,unit))return {record:item,label:item.question,type:'knowledge',scopes:requestedScopes(item.question+'；'+item.text)};
 return null;
}
function source(record,label,text,p,group,kind){
 return {key:`${group}:${kind}:${record.id}`,label,text,version:p.version,sourceLabel:record.sourceLabel||'本店当前公开资料',sourceVersion:record.sourceVersion??record.version??null,
  reference:{collection:group,kind,id:record.id,sourceLabel:record.sourceLabel||'本店当前公开资料',sourceRefs:clone(record.sourceRefs??[])},...(record.confirmation?{confirmation:clone(record.confirmation)}:{})};
}
function extraGuideQuestions(question,scopes){
 const extras=[...requestedScopes(question)].filter(scope=>!scopes.has(scope));
 const unknown=String(question).split(/另外|还有|顺便|以及|并且|同时/).slice(1).filter(part=>/吗|能|可以|是否|提供|安排|帮/.test(part)&&!requestedScopes(part).size);
 return [...extras.map(scope=>({'crib':'婴儿床','extra-bed':'加床服务',kitchen:'厨房规则',pets:'宠物规则',breakfast:'早餐',booking:'价格与预订',pickup:'接站',dropoff:'送站与叫车'}[scope]||scope)),...unknown.map(part=>`“${part.trim()}”`)];
}
function guideAnswer(state,question,context){
 const entry=guideEntry(state,context);if(!entry)return unavailable('这项指南内容尚未公开确认、已停用或不适用于当前单元。请重新选择或请管家确认。');
 const {record,label,type,scopes}=entry,p=state.published;
 const text=type==='point'?`${label}：${record.address||'详细地址待补充。'}`:record.text||'这项资料的图文说明待补充，请向管家确认。';
 const url=safeExternalUrl(record.url),media=url?`\n资料入口：${url}（若无法加载，请使用已有图文或联系管家）`:'';
 const extras=extraGuideQuestions(question,scopes),request=answerKind(question)==='request';
 const body=[`${label}\n${text}${media}`,extras.length?`额外诉求 ${extras.join('、')} 尚未由本项指南确认，请管家分别核对。`:'',request?'这是服务需求或故障咨询，需要人工核对和处理；当前仅整理问题，尚未发起预约、派修或完成服务。':''].filter(Boolean).join('\n\n');
 return {body,status:extras.length||request?'needs_human':'answered',sources:[source(record,label,text+(url?'\n'+url:''),p,'guide',type)],knowledgeIds:[],mode:'property_guide',answerKind:answerKind(question),coveredScopes:[...scopes],context:{kind:context.kind,id:record.id,label,propertyId:scopePropertyId(state),unitId:context.unitId??null,version:p.version}};
}
function recommendationEntry(state,context){
 const scope={propertyId:scopePropertyId(state),unitId:context?.unitId??null},p=state.published;
 const canonical=recommendationContext(context.kind,context.id,p,scope);
 if(!canonical)return null;
 const item=context.kind==='place'?recommendedPlaceById(context.id,p,scope):recommendedRouteById(context.id,p,scope);
 return {item,context:{...canonical,scope:'local',...(context.cityId?{cityId:context.cityId}:{})},scope};
}
const periodName={half:'半天',day:'一天'};
function recommendationText(item,kind,state,scope){
 const parts=[item.name,item.description||'',Number.isFinite(item.durationMinutes)?`建议${kind==='route'?'总安排':'停留'}约${item.durationMinutes}分钟；按${periodName[item.period]||'待确认时长'}参考。`:'建议时长待核实。'];
 if(kind==='route')parts.push('站点顺序：'+item.placeIds.map(id=>recommendedPlaceById(id,state.published,scope)?.name).join(' → '));
 if(item.address)parts.push(`目的地位置：${item.address}`);
 parts.push(item.feeConfirmed===true&&item.fee?.trim()?`费用：${item.fee}`:'费用及计价单位待核实，请向管家或商户确认。');
 parts.push(item.bookingConfirmed===true&&item.booking?.trim()?`预约条件：${item.booking}`:'预约方式、名额及限制待核实；当前没有发起预约。');
 parts.push(recommendationTransport(item,state.published,scope));
 const nav=recommendationNavigation(item,scope);if(nav.available)parts.push('目的地地图：'+nav.url);
 return parts.filter(Boolean).join('\n');
}
function localRulesQuestion(question){return /(?:本店|民宿|我们住的|这家民宿).{0,10}(?:厨房|宠物|早餐|门禁|门锁|入住|退房|热水|网络)|门锁|门禁|WiFi|wifi|停水|漏水|开票|发票/.test(question);}
function isFollowUp(question){
 if(/^(?:请问)?(?:这个地点|这个地方|这家店|这条路线|这家|这里|它)(?:有|提供|能|可以|需要|怎么|多少|预约|要|适合|允许)/.test(question))return true;
 const rest=norm(question).replace(/^(?:请问|那|那么|想知道|想了解)/,'').replace(/这个地点|这个地方|这家店|这条路线|这家|这里|它|多少钱|怎么样|好不好|怎么预约|怎么去|怎么走|怎么安排|要提前预约|需要预约|能预约|预约|预订|报名|订位|帮我们|帮我|请|安排|有名额|有什么需要注意|有什么需要留意|有什么|注意|留意|适合|人群|价格|费用|人均|营业|开放|提前|需要|请问|是否|可以|要|吗|呢|呀|啊|的|半天|一天|亲子|孩子|带娃|雨天|下雨|不爬山/g,'');
 return rest.length===0;
}
function clearSubject(question){return String(question).replace(/(?:不问|不去|不看|不选|不考虑)[^，,。；;？?]*[，,。；;]?/g,'');}
function recommendationMatches(state,question,scope){
 const topic=norm(clearSubject(question)),records=experienceOf(state.published,scopePropertyId(state)).recommendations??{},matches=[];
 for(const [kind,items]of [['place',records.places],['route',records.routes]])for(const item of items??[]){
  if([item.name,...(item.aliases??[])].some(name=>norm(name).length>=2&&topic.includes(norm(name)))){const context=recommendationContext(kind,item.id,state.published,scope);if(context)matches.push({kind,id:item.id});}
 }
 return matches;
}
function recommendationsAnswer(state,question,selected){
 const {item,context,scope}=selected,kind=context.kind,p=state.published;
 const body=recommendationText(item,kind,state,scope),request=answerKind(question)==='request';
 const needsFee=/多少钱|价格|费用|收费|免费|人均|预算|门票/.test(question)&&!(item.feeConfirmed===true&&item.fee?.trim());
 const needsBooking=/预约|预订|报名|名额|订位/.test(question)&&!(item.bookingConfirmed===true&&item.booking?.trim());
 const localExtras=[...requestedScopes(question)].filter(value=>['crib','extra-bed','pets','kitchen','breakfast','invoice','utilities','hotwater','network','network-fault'].includes(value));
 const unknownExtras=String(question).split(/另外|还有|顺便|以及|并且|同时/).slice(1).filter(part=>/吗|能|可以|是否|提供|安排|帮/.test(part)&&!requestedScopes(part).size);
 const remarks=[];
 if(context.kind==='route'&&/半天|两小时|三小时|2小时|3小时/.test(question)&&item.period==='day')remarks.push('这是一条完整一天安排，不能直接作为半天路线；请另选已核实的半日安排。');
 if(/雨天|下雨|不爬山/.test(question))remarks.push('天气、体力和当日开放仍需核对；本条记录没有已确认的完整替代路线，不会自动改编行程。');
 if(localExtras.length)remarks.push('其中涉及本店设施或额外服务的诉求，需回到本店范围或请管家分别确认，周边商户资料不能代替本店店规。');
 if(unknownExtras.length)remarks.push(`额外诉求 ${unknownExtras.map(text=>'“'+text.trim()+'”').join('、')} 不在这条已确认资料中，请管家另行核对。`);
 if(request)remarks.push('本地原型仅整理这项服务需求，需要人工确认；当前没有发起预约、报名、付款或派单。');
 const sources=[source(item,item.name,body,p,'recommendations',kind)];
 if(kind==='route')for(const id of item.placeIds){const stop=recommendedPlaceById(id,p,scope);sources.push(source(stop,stop.name,recommendationText(stop,'place',state,scope),p,'recommendations','place'));}
 if(/福利|权益|优惠|折扣/.test(question)){
  const benefits=recommendationBenefits(p,scope,kind==='place'?item.id:null);
  if(benefits.length)for(const benefit of benefits){remarks.push(`权益说明：${benefit.name}。${benefit.description||'使用条件需按已公开说明核对。'}这不表示已经领取或已享有。`);sources.push(source(benefit,benefit.name,benefit.description||benefit.name,p,'recommendations','benefit'));}
  else remarks.push('当前没有符合公开范围及有效期的已核实权益，不提供领取或已享有的承诺。');
 }
 return {body:[`本地向导 · ${experienceOf(p,scopePropertyId(state)).dataIdentity}`,body,...remarks].join('\n\n'),status:request||needsFee||needsBooking||localExtras.length||unknownExtras.length||remarks.some(t=>/不能直接作为半天/.test(t))?'needs_human':'answered',sources,knowledgeIds:[],mode:'recommendations',answerKind:answerKind(question),context};
}
function previewAnswer(state,question,context){
 const pid=scopePropertyId(state),scope={propertyId:pid,cityId:context?.cityId??(pid==='qinghuan-dali'?'dali':undefined),context:context?.kind?context:null};
 if(scope.context&&!validContentContext(scope.context,scope))return unavailable('原稿对象已失效或不属于当前房源，不能引用；请返回重新选择。');
 const reply=answerContent(question,scope);
 if(!reply)return pending('当前房源没有可用于这个问题的已核实本地资料。请补充具体对象或请管家确认，不会用其他民宿内容代替。');
 return {body:reply.body,status:'needs_human',mode:reply.mode,knowledgeIds:[],context:reply.context?{...reply.context,scope:'local',unitId:context?.unitId??null,version:state.published.version}:null,
  sources:(reply.refs??[]).map(ref=>({key:'source-preview:'+ref.id,label:ref.label,text:reply.body,version:state.published.version,sourceLabel:ref.source,sourceVersion:ref.version,reference:clone(ref),status:'pending'})),answerKind:answerKind(question)};
}

// A null result delegates to the existing property/30-question core unchanged.
export function answerExperience(state,question,context=null){
 if(!state.visible)return unavailable('本民宿资料暂时停止展示，请联系管家。');
 const issue=contextIssue(state,context);if(issue)return issue;
 // Validate an explicit object before any original-question or search fallback.
 if(context?.collection==='recommendations'&&!recommendationEntry(state,context))return unavailable('这个周边推荐已停用、失效或不属于当前房源/单元，请重新选择。');
 if(['arrival','guide'].includes(context?.kind)){
  if(/^Q(?:0[1-9]|[12]\d|30)$/.test(context.id??'')){
   if(!(state.published.knowledge??[]).some(item=>item.id===context.id))return unavailable('这道指南题已停用或不适用于当前房源，请重新选择。');
  }else if(!guideEntry(state,context))return unavailable('这项指南内容尚未公开确认、已停用或不适用于当前单元。请重新选择或请管家确认。');
 }else if(context?.kind&&context.collection!=='recommendations'&&context?.scope==='local'&&!validContentContext(context,{propertyId:scopePropertyId(state),cityId:context.cityId}))return unavailable('这个周边对象已失效或不属于当前房源，请重新选择。');
 if(originalGuideQuestion(state.published,question))return null;
 if(['arrival','guide'].includes(context?.kind)){
  if(/^Q(?:0[1-9]|[12]\d|30)$/.test(context.id??''))return null;
  return guideAnswer(state,question,context);
 }
 const local=context?.scope==='local'||context?.collection==='recommendations';
 if(!local)return null;
 let selected=null;
 if(context?.collection==='recommendations'){
  selected=recommendationEntry(state,context);if(!selected)return unavailable('这个周边推荐已停用、失效或不属于当前房源/单元，请重新选择。');
 }else if(context?.kind&&(!['place','route','activity-lead'].includes(context.kind)||!validContentContext(context,{propertyId:scopePropertyId(state),cityId:context.cityId})))return unavailable('这个周边对象已失效或不属于当前房源，请重新选择。');
 if(localRulesQuestion(question))return {...pending('这里是本地向导范围。涉及本店入住规则、厨房、设备或服务，请切换回本店AI管家，按当前房源公开资料查询；周边商户资料不会作为本店设施。'),mode:'scope_switch_required'};
 const scope={propertyId:scopePropertyId(state),unitId:context?.unitId??null},matches=recommendationMatches(state,question,scope);
 if(matches.length===1)return recommendationsAnswer(state,question,recommendationEntry(state,{...matches[0],...scope,cityId:context?.cityId}));
 if(matches.length>1){
  const replies=matches.slice(0,5).map(match=>recommendationsAnswer(state,question,recommendationEntry(state,{...match,...scope,cityId:context?.cityId})));
  return {body:replies.map(reply=>reply.body).join('\n\n'),status:replies.some(reply=>reply.status==='needs_human')?'needs_human':'answered',sources:replies.flatMap(reply=>reply.sources),knowledgeIds:[],mode:'recommendations',context:null,answerKind:answerKind(question)};
 }
 const reset=clearSubject(question)!==question||/换(?:个|一家|一条)|改问|别的|其他/.test(question);
 if(selected&&!reset&&isFollowUp(question))return recommendationsAnswer(state,question,selected);
 const broad=/^(?:请问)?(?:附近|周边).*(?:推荐|有什么|有哪些)|^(?:请)?推荐|^(?:亲子|带娃|带孩子|半天|一天).*(?:怎么|推荐|安排|玩)/.test(question)&&!/(?:几点|开门|多少钱|营业)/.test(question);
 if(broad){
  const filters={period:/半天/.test(question)?'half':/一天/.test(question)?'day':'all',party:/亲子|孩子|带娃/.test(question)?'family':/老人|长辈/.test(question)?'senior':/独自|一个人/.test(question)?'solo':'all'};
  const picks=selectRecommendations(state.published,scope,filters),items=[...picks.places.map(item=>({kind:'place',id:item.id})),...picks.routes.map(item=>({kind:'route',id:item.id}))];
  if(items.length){const replies=items.map(item=>recommendationsAnswer(state,question,recommendationEntry(state,{...item,...scope,cityId:context?.cityId})));return {body:replies.map(reply=>reply.body).join('\n\n'),status:replies.some(reply=>reply.status==='needs_human')?'needs_human':'answered',sources:replies.flatMap(reply=>reply.sources),knowledgeIds:[],mode:'recommendations',context:items.length===1?replies[0].context:null,answerKind:answerKind(question)};}
 }
 return previewAnswer(state,question,context?.collection==='recommendations'?{scope:'local',propertyId:scopePropertyId(state),unitId:context.unitId??null,cityId:context.cityId}:context);
}

export function canonicalCoreContext(state,context){
 if(!context)return null;
 if(context.collection==='recommendations')return recommendationEntry(state,context)?.context??null;
 if(context.scope==='local'&&['place','route','activity-lead'].includes(context.kind)){
  const resolved=validContentContext(context,{propertyId:scopePropertyId(state),cityId:context.cityId});
  return resolved?{...resolved,scope:'local',unitId:context.unitId??null,version:state.published.version}:null;
 }
 if(context.kind==='guide'&&originalGuides.has(context.id)){
  const item=state.published.knowledge.find(k=>k.id===context.id);if(!item)return null;
  return {...context,label:`${item.id} · ${item.question}`,propertyId:scopePropertyId(state),version:state.published.version};
 }
 const room=context.roomId?(state.published.rooms??[]).find(item=>item.id===context.roomId):null;
 return {...context,...(room?{label:room.name}:{}),propertyId:scopePropertyId(state),version:state.published.version};
}
