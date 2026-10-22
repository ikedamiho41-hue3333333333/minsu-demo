import {matchQinghuanGuides,analyzeQinghuanQuestion} from './qinghuan.mjs';
import {requestedScopes,scopeLabel,scopeKey,relevantFacts,intersection,difference,configurationQuestion,precautions} from './answer-scopes.mjs';

const clone=x=>structuredClone(x);
const own=(obj,key)=>Object.hasOwn(obj,key);
const norm=x=>String(x??'').normalize('NFKC').replace(/[\s？?。！!，,、]/g,'').toLowerCase();
const id=()=>globalThis.crypto.randomUUID();
export const TOPICS={
 kitchen:{label:'厨房使用规则',pattern:/厨房|做饭|煮饭|烹饪|锅具|厨具/},
 parking:{label:'停车说明',pattern:/停车|车位|自驾|停哪/},
 checkin:{label:'入住与退房',pattern:/入住|退房|几点到|提前到|晚到/},
 location:{label:'位置与交通',pattern:/地址|在哪|位置|怎么去|怎么走|导航|交通/},
 environment:{label:'环境与公共区域',pattern:/院子|庭院|环境|客厅|公共区/},
 wifi:{label:'网络与设施',pattern:/wifi|wi-fi|无线|网络|空调|吹风机|洗衣/i},
 pets:{label:'宠物规则',pattern:/宠物|带狗|带猫|狗狗|猫咪/},
 breakfast:{label:'早餐说明',pattern:/早餐|早饭/},
 barbecue:{label:'烧烤规则',pattern:/烧烤|烤肉/},
 accessibility:{label:'无障碍与通行',pattern:/轮椅|无障碍|楼梯|电梯/},
 price:{label:'价格与预订',pattern:/价格|多少钱|预订|预定|房价|退款|取消订单/},
 nearby:{label:'周边吃喝玩乐',pattern:/周边|附近|餐厅|景点|吃什么|去哪玩/}
};

export function createSeed(){
 const draft={name:'松间小院',subtitle:'住进山间，把日子慢下来。',location:'浙江 · 莫干山（虚构示例）',
  description:'一座被绿意围住的小院。清晨在院子里喝茶，午后一起做饭，晚上把时间留给家人和朋友。',
  facts:{
   kitchen:{text:'厨房可以做饭，开放时间为10:00—20:00，需提前向管家预约。提供基础锅具和餐具；食材、调料请自备，使用后请清洁归位。'},
   parking:{text:'院外有3个免费停车位，车位先到先停，不提供预留。到达前请联系管家确认当天情况。'},
   checkin:{text:'入住时间为14:00后，退房时间为次日12:00前。需登记每位入住人的身份信息；提前入住、延迟退房请管家单独确认。'},
   location:{text:'民宿位于浙江莫干山地区，原型使用虚构地址，不提供真实导航。实际到店路线需由管家提供。'},
   environment:{text:'有独立庭院、共享客厅和共享厨房。庭院与客厅开放至22:00，22:00后请降低音量。'},
   wifi:{text:'客房与共享客厅提供Wi-Fi；客房配有空调、吹风机。Wi-Fi密码到店后向管家获取；洗衣设施尚未记录。'}
  },
  rooms:[
   {id:'mountain',name:'听山 · 大床房',type:'大床房',floor:'二楼',area:'约28㎡',beds:'1张1.8米大床',capacity:'建议2人入住',bath:'独立卫浴',photo:'bedroom',description:'窗外是满眼山色，房内以原木与棉麻为主。',facilities:['独立卫浴','空调','Wi-Fi','吹风机']},
   {id:'courtyard',name:'望院 · 双床房',type:'双床房',floor:'一楼',area:'约30㎡',beds:'2张1.2米单人床',capacity:'建议2人入住',bath:'独立卫浴',photo:'bedroom',description:'面向庭院，适合朋友同行。图片仅作空间氛围示意。',facilities:['独立卫浴','空调','Wi-Fi','吹风机']}
  ],knowledge:[],vrUrl:'https://tujia.realsee.cn/redJnEMB',vrKind:'reference',vrLabel:'身临其境，感受空间',vrDescription:'走进空间，感受一间民宿。'};
 return {schema:1,revision:0,propertyId:'songjian-demo',visible:true,draft,published:{...clone(draft),version:1,publishedAt:Date.now()},draftDirty:false,threads:{},tickets:{},operations:{}};
}

export function answer(state,question,context=null){
 const p=state.published,q=norm(question),sources=[],parts=[],missing=[];
 let needsClarification=false;
 if(!state.visible)return {status:'unavailable',body:'本民宿资料暂时停止展示，请联系管家。',sources:[]};
 if(context?.roomId&&!p.rooms.some(r=>r.id===context.roomId))return {status:'needs_clarification',body:'这个房间不在本民宿当前公开资料中，请重新选择房间。',sources:[]};
 const add=(key,label,text,metadata={})=>{if(sources.some(source=>source.key===key))return;sources.push({key,label,text,version:p.version,...metadata});parts.push(text);};
 const guideMetadata=k=>({kind:k.kind,requiresHuman:k.requiresHuman!==false,sourceLabel:k.sourceLabel,sourceRange:k.sourceRange});
 const addKnowledge=k=>add('knowledge:'+k.id,k.question,k.text,k.kind==='confirmation_guide'?guideMetadata(k):{});
 const pendingGuide=k=>k.kind==='confirmation_guide'&&k.requiresHuman!==false;
 const analysis=analyzeQinghuanQuestion(p,question),guideMatches=analysis.guides,knowledgeIds=guideMatches.map(guide=>guide.id);
 const exactKnowledge=p.knowledge.find(k=>!pendingGuide(k)&&[k.question,...k.aliases].some(a=>norm(a)===q));
 const contextualQuestion=/开放|时间|几点|这里|这个空间/.test(q)&&['独立庭院','共享厨房','共享客厅'].includes(context?.spaceName)?q+norm(context.spaceName):q;
 const requested=requestedScopes(contextualQuestion);
 const knownFor=(scopes,keys=null)=>relevantFacts(p,scopes,keys);
 const addFacts=facts=>{for(const fact of facts)add(fact.key,TOPICS[fact.key]?.label||fact.key,fact.text);};
 const wholeQuestion=p.rentalMode==='whole'&&/整院|包栋|整栋|几间卧室/.test(q);
 function resolveRoom(query){
  const named=p.rooms.filter(r=>query.includes(norm(r.name.split(' · ')[0]))||query.includes(norm(r.type)));
  return context?.roomId?p.rooms.find(r=>r.id===context.roomId):(named.length===1?named[0]:null);
 }
 function addRoomConfiguration(query,whole=false){
  if(whole){add('whole','整院配置',`${p.name}按整院包栋出租，包含${p.rooms.length}间卧室，不单独出租卧室。${p.wholeCapacity||'整院总入住人数尚未记录，请管家确认。'}床型配置：${p.rooms.map(r=>r.name+'，'+r.beds).join('；')}。`);return;}
  if(p.profilePending===true&&!p.rooms.length){missing.push('房间配置与面积（房源资料待录入）');return;}
  const room=resolveRoom(query);
  if(room)add('room:'+room.id,room.name,`${room.name}位于${room.floor}，${room.area}，配置${room.beds}、${room.bath}，${room.capacity}。已记录设施：${room.facilities.join('、')}。`);
  else{needsClarification=true;parts.push('你想了解哪一间房？可以先在「房间设施」选择'+p.rooms.map(r=>r.name).join('、')+'，再带着房间来问我。');}
 }
 const finish=(pending=false)=>{
  if(missing.length)parts.push(`本店资料尚未记录${[...new Set(missing)].join('、')}，我暂时无法确认。可以点击下方「请管家确认」，把问题交给民宿管家。`);
  return {status:pending||missing.length?'needs_human':needsClarification?'needs_clarification':'answered',body:parts.join('\n\n'),sources,knowledgeIds};
 };
 // An exact answer is an indivisible statement. If any part overlaps a
 // published rule or selected configuration, it must not re-enter via a later
 // missing-topic fallback. Rental-mode words alone are not configuration.
 const exactClaims=exactKnowledge?requestedScopes(question+'；'+exactKnowledge.text):new Set();
 const structuralConflict=exactKnowledge&&configurationQuestion(question+'；'+exactKnowledge.text)&&(resolveRoom(q)||wholeQuestion);
 const exactAllowed=exactKnowledge&&!knownFor(exactClaims).length&&!structuralConflict;
 if(exactAllowed){addKnowledge(exactKnowledge);return finish();}
 if(structuralConflict)for(const scope of ['extra-bed','crib'])if(requested.has(scope))missing.push(scopeLabel(scope));
 if(guideMatches.length&&!exactKnowledge){
  const owned=new Set(),guides=guideMatches.filter(pendingGuide);
  for(const guide of guideMatches){
   const guideScopes=requestedScopes([guide.question,...guide.aliases].join('；'));
   for(const scope of guideScopes)owned.add(scope);
   const guideRequest=intersection(requested,guideScopes);
   const pending=pendingGuide(guide);
   // A confirmed answer's own assertions also participate in conflict checks.
   const claims=pending?guideRequest:new Set([...guideRequest,...requestedScopes(guide.text)]);
   const facts=knownFor(claims,guide.topics);
   addFacts(facts);
   if(!pending&&facts.length){
    const covered=new Set(facts.flatMap(fact=>[...fact.scopes]));
    for(const scope of difference(guideRequest,covered))missing.push(scopeLabel(scope));
    continue;
   }
   const advice=precautions(guide.text);
   const body=facts.length?`${advice?advice+'\n':''}${guide.question}\n其余待确认项：${guide.confirmationChecklist}（以上公开规则已明确的部分除外）。`:guide.text;
   add('knowledge:'+guide.id,guide.id+(pending?' · 待确认指南':' · 已确认公开答复'),body,guideMetadata(guide));
  }
  // Exact original questions/aliases own their whole spans. Pattern matches
  // own only their subjects, so another request in the same clause survives.
  const remainderScopes=requestedScopes(analysis.remainder),extraScopes=difference(remainderScopes,owned);
  // A route guide mentioning a room does not own a later room-size question.
  if(remainderScopes.has('room')&&configurationQuestion(analysis.remainder))extraScopes.add('room');
  for(const scope of extraScopes){
   if(scope==='room'){addRoomConfiguration(norm(analysis.remainder),p.rentalMode==='whole'&&configurationQuestion(analysis.remainder));continue;}
   const facts=knownFor(new Set([scope]));
   if(facts.length)addFacts(facts);else missing.push(scopeLabel(scope));
  }
  for(const clause of analysis.remainder.split(/[，,。.!！?？；;:：\n]|另外|还有|以及|顺便|并且|同时/).filter(part=>part.trim())){
   if(!requestedScopes(clause).size&&!matchQinghuanGuides(p,clause).length&&/吗|能|可以|怎么|如何|是否|提供|安排|帮/.test(clause))missing.push('“'+clause.trim()+'”');
  }
  return finish(guides.length>0);
 }
 const roomQuestion=/房间|房型|床|卫浴|浴室|几人|几个人|住几|面积|楼层|几楼/.test(q);
 if(wholeQuestion)addRoomConfiguration(q,true);
 if(roomQuestion&&!wholeQuestion)addRoomConfiguration(q);
 const matched=Object.entries(TOPICS).filter(([key,topic])=>topic.pattern.test(contextualQuestion)||[...requested].some(scope=>scopeKey(scope)===key));
 for(const [key,topic] of matched){
  const scopes=new Set([...requested].filter(scope=>scopeKey(scope)===key));
  const facts=knownFor(scopes,[key]);
  if(facts.length){
   addFacts(facts);
   const covered=new Set(facts.flatMap(fact=>[...fact.scopes]));
   for(const scope of difference(scopes,covered))missing.push(scopeLabel(scope));
  }else missing.push(topic.label);
 }
 if(!matched.length&&!roomQuestion&&!wholeQuestion){
  if(/^(你好|您好|嗨|hello|hi)$/.test(q))return {status:'answered',body:`你好，我是${p.name}的AI管家。可以问我厨房、停车、入住，或先看看房间。资料里没有的，我会请民宿管家确认。`,sources:[]};
  missing.push('这个问题');
 }
 return finish();
}

export function guestThreads(state,sessionId){return Object.values(state.threads).filter(t=>t.owner===sessionId&&t.propertyId===state.propertyId);}
function text(value,label,max=1000){if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw Error(`请填写${label}（1—${max}字）`);return value.trim();}
function validateDraft(d){
 if(!d||typeof d!=='object')throw Error('资料格式不正确');
 text(d.name,'民宿名称',40);text(d.subtitle,'民宿短句',80);text(d.location,'位置',200);text(d.description,'民宿介绍',1000);
 for(const k of Object.keys(TOPICS))if(d.facts[k]){if(typeof d.facts[k].text!=='string'||d.facts[k].text.length>1000)throw Error('使用规则需在1000字以内');}
 if(d.rooms.length<(d.profilePending===true?0:1)||d.rooms.length>10)throw Error('请保留1—10间房');
 for(const r of d.rooms){for(const k of ['name','floor','area','beds','capacity','bath'])text(r[k],'房间资料',100);}
 if(d.vrUrl!=='https://tujia.realsee.cn/redJnEMB')throw Error('本轮仅使用已指定的VR参考案例');
 if(d.vrLabel!==undefined)text(d.vrLabel,'VR入口说明',80);
 if(d.vrDescription!==undefined)text(d.vrDescription,'VR展示说明',500);
 if(d.knowledge.length>50)throw Error('知识条目最多50条');
 const keys=new Set();
 for(const k of d.knowledge){text(k.question,'公开问题',200);text(k.text,'公开答案',1000);if(!Array.isArray(k.aliases)||k.aliases.length>5)throw Error('相似问法最多5个');
  for(const alias of [k.question,...k.aliases]){text(alias,'问法',200);const key=norm(alias);if(keys.has(key))throw Error('已有相同问法，请编辑原知识');keys.add(key);}}
}
export function dispatch(state,action,ctx){
 const {type}=action;
 if(!ctx?.sessionId)throw Error('无法保持演示会话，请启用浏览器会话存储');
 const guestActions=['ASK','HANDOFF'],merchantActions=['REPLY','ACCEPT','SAVE_DRAFT','PUBLISH','SAVE_KNOWLEDGE','DELETE_KNOWLEDGE'];
 if(guestActions.includes(type)&&ctx.role!=='guest')throw Error('请从客人端操作');
 if(merchantActions.includes(type)&&ctx.role!=='merchant')throw Error('请从商家端操作');
 if(type==='SET_VISIBLE'&&ctx.role!=='platform')throw Error('请从平台端操作');
 if(![...guestActions,...merchantActions,'SET_VISIBLE'].includes(type))throw Error('未知操作');
 const operationKey=action.operation?`${ctx.sessionId}:${type}:${action.operation}`:null;
 if(operationKey&&own(state.operations,operationKey))return state;
 const s=clone(state),now=Date.now();
 if(type==='ASK'){
  if(!s.visible)throw Error('本民宿资料暂停展示，请联系管家');
  const body=text(action.body,'问题');
  let t;
  if(action.threadId){t=s.threads[action.threadId];if(!t||t.owner!==ctx.sessionId||t.propertyId!==s.propertyId)throw Error('找不到本人的会话');}
  else t=guestThreads(s,ctx.sessionId)[0];
  if(!t){t={id:id(),propertyId:s.propertyId,owner:ctx.sessionId,messages:[],createdAt:now};s.threads[t.id]=t;}
  const a=answer(s,body,action.context??null),guestId=id();
  t.messages.push({id:guestId,role:'guest',body,context:action.context??null,at:now});
  t.messages.push({id:id(),role:'assistant',body:a.body,status:a.status,sources:a.sources,knowledgeIds:clone(a.knowledgeIds??[]),replyTo:guestId,at:now});
 }
 if(type==='HANDOFF'){
  const t=s.threads[action.threadId];if(!t||t.owner!==ctx.sessionId||t.propertyId!==s.propertyId)throw Error('找不到本人的会话');
  const m=t.messages.find(m=>m.id===action.messageId&&m.role==='assistant');if(!m)throw Error('找不到需要确认的问题');
  if(!Object.values(s.tickets).some(x=>x.messageId===m.id)){
   const g=t.messages.find(x=>x.id===m.replyTo),ticketId=id();
   s.tickets[ticketId]={id:ticketId,threadId:t.id,messageId:m.id,question:g.body,context:g.context,knowledgeIds:clone(m.knowledgeIds??[]),status:'pending',createdAt:now,reply:null};
  }
 }
 if(type==='ACCEPT'||type==='REPLY'){
  const ticket=s.tickets[action.ticketId];if(!ticket)throw Error('咨询已不存在，请刷新工作台');
  if(type==='ACCEPT'&&ticket.status==='pending')ticket.status='processing';
  if(type==='REPLY'){
   if(ticket.status==='replied')throw Error('这条咨询已回复，请勿重复发送');
   const body=text(action.body,'回复');const m={id:id(),role:'merchant',body,replyTo:ticket.messageId,at:now};
   s.threads[ticket.threadId].messages.push(m);ticket.status='replied';ticket.reply=m;
  }
 }
 if(type==='SAVE_DRAFT'){validateDraft(action.draft);s.draft=clone(action.draft);s.draftDirty=true;}
 if(type==='SAVE_KNOWLEDGE'){
  const knowledgeId=action.knowledgeId??id(),idx=s.draft.knowledge.findIndex(x=>x.id===knowledgeId),previous=s.draft.knowledge[idx];
  const k={...previous,id:knowledgeId,question:text(action.question,'公开问题',200),text:text(action.text,'公开答案'),aliases:(action.aliases??[]).map(a=>text(a,'相似问法',200))};
  if(previous?.kind==='confirmation_guide'){
   if(own(action,'requiresHuman')&&typeof action.requiresHuman!=='boolean')throw Error('请明确选择是否仍需人工确认');
   k.requiresHuman=own(action,'requiresHuman')?action.requiresHuman:previous.requiresHuman!==false;
  }
  if(idx<0)s.draft.knowledge.push(k);else s.draft.knowledge[idx]=k;
  validateDraft(s.draft);s.draftDirty=true;
 }
 if(type==='DELETE_KNOWLEDGE'){s.draft.knowledge=s.draft.knowledge.filter(k=>k.id!==action.knowledgeId);s.draftDirty=true;}
 if(type==='PUBLISH'){validateDraft(s.draft);s.published={...clone(s.draft),version:s.published.version+1,publishedAt:now};s.draftDirty=false;}
 if(type==='SET_VISIBLE')s.visible=Boolean(action.visible);
 if(operationKey)s.operations[operationKey]=true;
 s.revision++;return s;
}
