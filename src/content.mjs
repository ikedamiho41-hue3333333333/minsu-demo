import data from './qinghuan-content.json' with {type:'json'};

const norm=value=>String(value??'').normalize('NFKC').replace(/[\s·，,。？?！!、]/g,'').toLowerCase();
const scoped=({propertyId,cityId}={})=>propertyId==='qinghuan-dali'&&cityId==='dali';
export const contentFor=(propertyId,cityId)=>scoped({propertyId,cityId})?data:null;
export function findPlaces({propertyId,cityId,category='all',query=''}={}){
 const c=contentFor(propertyId,cityId);if(!c)return [];
 const q=norm(query);
 return c.places.filter(p=>(category==='all'||p.category===category)&&(!q||norm([p.name,...(p.aliases??[]),p.summary,p.locationText].join(' ')).includes(q)));
}
export const placeById=(id,scope)=>scoped(scope)?data.places.find(p=>p.id===id)||null:null;
export const routeById=(id,scope)=>scoped(scope)?data.routes.find(r=>r.id===id)||null:null;
export const leadById=(id,scope)=>scoped(scope)?data.activityLeads.find(l=>l.id===id)||null:null;
const lookups={place:placeById,route:routeById,'activity-lead':leadById};
export function makeContentContext(kind,id,scope){
 const item=lookups[kind]?.(id,scope);
 return item?{kind,id,label:item.name||item.title,propertyId:scope.propertyId,cityId:scope.cityId}:null;
}
export function validContentContext(context,scope){
 if(!context||context.propertyId!==scope?.propertyId||context.cityId!==scope?.cityId)return null;
 return makeContentContext(context.kind,context.id,scope);
}
export const lifeChatKey=(sessionId,cityId,propertyId)=>`${sessionId}:${cityId}${propertyId==='qinghuan-dali'?':qinghuan-dali':''}`;
// Public previews explain the source, without promoting raw prices or contact details to verified facts.
export const previewCopy=value=>String(value??'').replace(/\d+(?:[—\-~～/]\d+)*(?:\.\d+)?\s*元(?:\/人)?/g,'费用待确认').replace(/(?:24小时营业|24h营业|24H营业)/g,'营业时段待确认');
export function publicContentNotes(item){
 const text=(item.notes??[]).join(' '),notes=[];
 if(/(?:餐价|课程计价|价格|费用|计价).{0,12}(?:冲突|不一致|差异)|(?:冲突|不一致).{0,12}(?:价格|费用|计价)/.test(text))notes.push('原稿的费用或计价有不同版本，请确认实际项目、价格和计价单位。');
 if(/拼布|服饰|摄影|拍摄/.test(text)&&/冲突|不一致|是否提供/.test(text))notes.push('手作、课程或摄影的实际提供内容仍待经营方确认。');
 if(/零门票|索道/.test(text))notes.push('部分路段涉及索道或其他交通，相关费用需另行核实，请勿按全程零费用安排。');
 if(/预约|营业|开门|日期/.test(text)&&/冲突|不一致/.test(text))notes.push('原稿的开放、日期或预约口径存在差异，出行前请核实。');
 if(/20分钟|闭环|不回头/.test(text))notes.push('交通时间须按真实出发点与当日情况核实，路线不保证固定车程。');
 if(item.duplicateGroup)notes.push('此条与其他来源记录可能重复，地点关系仍待核对。');
 if(/多店|复合/.test(text))notes.push('资料包含多店或组合名称，具体门店与地址需分别确认。');
 if(item.parentPlaceId)notes.push('此条为另一场所的子空间，开放和使用资格需另行确认。');
 return [...new Set(notes)];
}
const references=items=>items.map(item=>({id:item.id,label:item.name||item.title,source:(item.sourceRefs??[]).map(r=>`${r.file} · ${r.location}`).join('；'),version:data.version,status:'pending'}));
const guardNotes=q=>{
 const notes=[];
 if(/多少钱|人均|价格|费用|预算|免费|门票|收费|优惠|折扣/.test(q))notes.push('价格与费用：尚未核实有效价目、计价单位及包含项目，请向管家或商户确认；原稿价格不能直接作为报价或优惠。');
 if(/预约|预订|报名|名额|代订|订位|联系|微信|电话/.test(q))notes.push('预约与联系：是否需要预约、可用名额、联系方式及代订能力仍待确认，当前没有发起预订或报名。');
 if(/营业|几点|开门|关门|开放|今天|明天|本周|周末|最近|现在|什么时候|时间/.test(q))notes.push('时间与开放：原稿并非实时营业或场次数据，当期日期、开放时段及取消情况尚未核实。');
 if(/怎么去|导航|多远|距离|车程|打车|地址|位置|在哪|到达|接送|接站/.test(q))notes.push('位置与交通：下方文字仅为原稿位置线索；本店准确出发点、导航入口、车程和接送安排仍需管家核实。');
 return notes;
};
function placeText(p){return `${p.name}\n原稿介绍（待核验）：${previewCopy(p.summary)||'地点介绍待补充。'}${p.locationText?`\n原稿位置参考：${previewCopy(p.locationText)}`:''}`;}
function routeText(r,scope){
 return `${r.title}\n原稿适合人群：${(r.audience??[]).join('、')||'待确认'}\n${r.stops.map(s=>`${s.optional?'可选：':''}${s.arrival?`${s.arrival} `:''}${placeById(s.placeId,scope)?.name||s.label}${s.duration?` · 原稿建议停留${s.duration}`:''}`).join('\n')}\n这是完整一日提案中的建议到达时间，不是集合发车、实时开放或预订确认。`;
}
function leadText(l){return `${l.title}\n原稿时间线索：${l.frequency||'不定期，待发布方确认'}${l.locationText?`\n原稿场地：${previewCopy(l.locationText)}`:''}\n当期日期、起止时刻、费用、预约和取消状态未核实；这是一条活动来源线索，不能确定今天有场次或可报名。`;}
function mentions(q,kind,items){
 const text=norm(q);
 return items.filter(item=>[item.name||item.title,...(item.aliases??[]),...(kind==='route'?item.title.split('·').filter(s=>s.length>=4):[])].some(name=>norm(name).length>=2&&text.includes(norm(name))));
}
export function answerContent(question,scope={}){
 if(!scoped(scope))return null;
 const q=String(question??'').trim();if(!q)throw Error('请填写问题');
 const result=(body,items=[],context=null)=>({status:'preview',mode:'source_preview',body:`清欢原稿资料预览 · 尚待核验\n\n${body}`,refs:references([...new Map(items.map(i=>[i.id,i])).values()]),context});
 if(/门锁|门禁|WiFi|wifi|热水|停水|漏水|发票|退房|入住规则|民宿.*(?:宠物|早餐|厨房)/.test(q))return result('本店入住规则、设备与服务请回到“AI管家”查询或请管家确认；本地生活资料不用于推断这些店规，也不提供门锁等凭据。');
 // Negated subjects do not become the selected subject of a new question.
 const topic=q.replace(/(?:不问|不去|不看|不选|不考虑)[^，,。；;？?]*[，,。；;]?/g,'');
 const reset=topic!==q||/换(?:个|一家|一条)|别的|其他|还有什么|附近.*(?:咖啡|吃|餐)/.test(q);
 const notes=guardNotes(q),rain=/下雨|雨天/.test(q),short=/半天|两小时|三小时|2小时|3小时/.test(q),kids=/亲子|孩子|带娃|儿童/.test(q),mobility=/老人|长辈|体力|不爬山|不想爬|不登山/.test(q);
 const constraints=[];
 if(short)constraints.push('你只有半天或较短时间：原稿路线是完整一天的一日提案，不能直接套用全线。可先选择其中一站，再请管家核实往返与体验时长。');
 if(kids)constraints.push('带孩子出行：儿童年龄、体力、体验年龄限制、场地条件与监护要求仍需确认，原稿客群标签不等于适合所有儿童。');
 if(mobility)constraints.push('体力、步行路段和无障碍条件待确认；不想爬山时，不能直接照搬含登山或户外段的路线。');
 const activityMatches=mentions(topic,'activity-lead',data.activityLeads);
 const routeMatches=mentions(topic,'route',data.routes);
 const activityQuestion=/活动|场次|报名|今天|明天|本周|周末|市集|集市|火把节|脱口秀/.test(topic);
 const activityNames=new Set(activityMatches.map(l=>norm(l.title)));
 const placeMatches=mentions(topic,'place',data.places).filter(p=>!(activityQuestion&&[p.name,...(p.aliases??[])].some(name=>activityNames.has(norm(name)))));
 let selected=[...placeMatches.map(item=>({kind:'place',item})),...routeMatches.map(item=>({kind:'route',item})),...(activityQuestion?activityMatches.map(item=>({kind:'activity-lead',item})):[])];
 const original=validContentContext(scope.context,scope);
 const shortQuestion=norm(topic).replace(/^(?:请问|那么|那(?=怎么|多少|需要|要|预约|几点|价格|费用|营业)|还想问|想了解|想知道)/,'').replace(/这个地点|这个地方|这家店|这条路线|这条活动线索|这家|那家|这里|它|多少钱|怎么样|好不好|什么时候|几点|怎么预约|怎么去|怎么走|要提前预约|需要预约|能预约|要预约|预约|有名额|有什么需要留意|有什么注意|有什么|留意|适合|人群|价格|费用|人均|营业|开放|提前|需要|请问|是否|可以|要|吗|呢|呀|啊|的/g,'');
 const followUp=shortQuestion.replace(/带孩子|带娃|孩子|只有|半天|下雨了|下雨|雨天|不想爬山|不爬山|怎么安排|怎么办|我们|出行|安排|合适|亲子|长辈|老人|爬山|去玩|的话|我/g,'').length===0||/^(?:请问|那|还想问|想了解|想知道)?(?:这个地点|这家店|这条路线|这条活动线索|这里|它|半天|下雨|雨天|不想爬|不爬)/.test(topic);
 if(!selected.length&&original&&!reset&&followUp)selected=[{kind:original.kind,item:lookups[original.kind](original.id,scope)}];
 const parts=[],used=[];
 if(selected.length){
  for(const {kind,item} of selected.slice(0,8)){
   parts.push(kind==='place'?placeText(item):kind==='activity-lead'?leadText(item):rain?`${item.title}\n这条提案包含户外安排，下雨时不能直接照搬全线，请先参考下方备选并核实交通与开放。`:routeText(item,scope));used.push(item);
  }
  if(selected.length>8)parts.push('本次先列出前8条匹配资料，其余对象请分别提问；未列出的要求没有视为已解决。');
 }
 if(rain){
  const places=data.rainPlaceIds.map(id=>placeById(id,scope)).filter(Boolean);used.push(...places);
  parts.push('原稿提供的共享雨天备选：\n\n'+places.map(placeText).join('\n\n')+'\n\n这是备选地点池，仍需确认当日开放、交通及体验条件，没有五条路线各自完整的雨天方案。');
 }
 if(parts.length){
  const context=selected.length===1?makeContentContext(selected[0].kind,selected[0].item.id,scope):null;
  return result([...parts,...constraints,...notes].join('\n\n'),used,context);
 }
 const routeQuestion=/路线|怎么玩|游玩|去哪玩|亲子|孩子|带娃|独行|社交|旅居|手作|人文|爬山|自然|半天/.test(topic);
 if(routeQuestion){
  let routes=data.routes;
  if(kids)routes=routes.filter(r=>/亲子|非遗|指尖/.test(r.title+r.audience.join('')));
  else if(/独行|社交|交友/.test(topic))routes=routes.filter(r=>/社交|同频/.test(r.title));
  else if(/人文|文化/.test(topic))routes=routes.filter(r=>/人文/.test(r.title));
  if(/不爬山|不想爬|不登山/.test(q))routes=routes.filter(r=>!r.title.includes('苍洱自然'));
  return result(['原稿中的主题提案：\n\n'+routes.map(r=>`${r.title}\n适合人群（原稿）：${r.audience.join('、')}`).join('\n\n'),...constraints,...notes].join('\n\n'),routes);
 }
 if(/活动|市集|集市|脱口秀|火把节|最近有什么|今天有什么|本周有什么/.test(topic))return result(['原稿收录以下9条活动日历与来源线索：\n'+data.activityLeads.map(l=>`${l.title} · ${l.frequency||'不定期'}`).join('\n')+'\n\n其中包括周期活动、年度节庆和不定期活动。当前没有已核实的当期场次，不能据此确定今天/本周举办或可报名。',...constraints,...notes].join('\n\n'),data.activityLeads);
 let category=null;
 if(/咖啡|茶饮|甜点/.test(topic))category='coffee';
 else if(/吃|餐|美食|小吃|素食|清淡|早餐/.test(topic))category='food';
 else if(/市场|购物|买菜/.test(topic))category='market';
 const broad=/附近|周边|有哪些|有什么|推荐|想喝|想吃|吃点|喝点|找个|找一家|找一间|本地小吃|去哪吃/.test(topic)&&!/(?:几点|关门|开门|多少钱|营业)/.test(topic);
 if(category&&broad){
  const places=findPlaces({...scope,category}).slice(0,5);
  return result(['原稿收录的地点候选：\n\n'+places.map(placeText).join('\n\n')+'\n\n可打开地点详情继续询问。营业、价格、适合人群和可用服务尚待核验。',...constraints,...notes].join('\n\n'),places);
 }
 return result(['当前资料中没有找到这个具体问题的可确认答案，也不会用其他地点替代。可以先浏览地点、五条主题路线或活动来源线索，再选择具体对象继续问。',...constraints,...notes].join('\n\n'));
}
