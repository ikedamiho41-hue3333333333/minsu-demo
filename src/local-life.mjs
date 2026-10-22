import {answerContent} from './content.mjs';
const day=86400000,clone=x=>structuredClone(x);
const clean=(s,label,max=200)=>{if(typeof s!=='string'||!s.trim()||s.trim().length>max)throw Error(`请填写${label}（1—${max}字）`);return s.trim();};
const stamp=t=>new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'}).format(t);
export const LIFE_PLACES=[
 {id:'food',category:'food',name:'一碗云南味道',title:'本地小吃与家常菜',text:'在古城周边找一家小店，慢慢吃一顿。可按清淡、带娃、素食等偏好咨询。',location:'大理古城 · 示例推荐区域',icon:'kitchen'},
 {id:'coffee',category:'food',name:'咖啡与午后的空档',title:'咖啡、茶饮与甜点',text:'用一杯咖啡安排一个轻松的下午。具体营业时间、价格需向店家确认。',location:'洱海沿线 · 示例推荐区域',icon:'leaf'},
 {id:'walk',category:'play',name:'给洱海留半天',title:'散步与轻松游玩',text:'示例路线：沿湖散步、找地方休息，再回民宿。开放情况与交通需出发前核实。',location:'大理 · 示例出游方向',icon:'pin'},
 {id:'culture',category:'play',name:'走进街巷与手作',title:'古城与在地体验',text:'按同行人数和时间，了解街巷漫游、手工体验等方向。具体活动以来源发布为准。',location:'大理 · 示例体验方向',icon:'book'}
];
function demoEvents(now){
 const start=new Date(now);start.setHours(15,0,0,0);
 return [
  {id:'demo-market',title:'古城周末手作市集',category:'市集',start:+start+day*2,end:+start+day*2+4*3600000,location:'大理古城 · 示例场地',price:'免费（示例）',description:'逛手作摊位、聊聊在地创作。此条为流程演示，不代表真实活动。',status:'active'},
  {id:'demo-workshop',title:'白族扎染体验',category:'手作',start:+start+day*3,end:+start+day*3+2*3600000,location:'大理 · 示例工坊',price:'费用待确认',description:'了解手作体验的时间、地点与报名方式。此条不是实际开班通知。',status:'active'},
  {id:'demo-music',title:'取消的日落音乐会',category:'音乐',start:+start+day,end:+start+day+2*3600000,location:'大理 · 示例场地',price:'待确认',description:'演示取消活动的状态与推荐过滤。',status:'cancelled'}
 ].map(e=>({...e,cityId:'dali',sourceName:'示例活动源 · 未连接微信小程序',sourceUrl:'',isDemo:true,provenance:'demo',verified:false,updatedAt:now}));
}
export function createLife(now=Date.now()){return {events:Object.fromEntries(demoEvents(now).map(e=>[e.id,e])),revision:0,syncedAt:now,feedMode:'demo'};}
export function eventStatus(e,now=Date.now()){return e.status==='cancelled'?'cancelled':e.end<now?'ended':e.start<=now?'ongoing':'upcoming';}
export function eventsFor(life,cityId,{now=Date.now(),all=false}={}){
 return Object.values(life.events).filter(e=>e.cityId===cityId&&(all||!['cancelled','ended'].includes(eventStatus(e,now)))).sort((a,b)=>a.start-b.start);
}
export function lifeAnswer(life,question,cityId,{now=Date.now(),propertyId,context=null}={}){
 const q=clean(question,'问题',1000);
 const contentReply=answerContent(q,{propertyId,cityId,context});if(contentReply)return contentReply;
 if(cityId!=='dali')return {status:'no_data',mode:'demo',body:'当前房源所在城市还没有本地生活资料。大理示例活动不会默认推荐到这里，可以切换到大理示例房源体验。',refs:[]};
 let body='',refs=[];
 if(/活动|市集|扎染|音乐|周末|今天|明天|最近|这几天/.test(q)){
  let events=eventsFor(life,cityId,{now});
  if(/今天|明天/.test(q)){const t=new Date(now);t.setHours(0,0,0,0);const from=+t+(/明天/.test(q)?day:0);events=events.filter(e=>e.start<from+day&&e.end>=from);}
  if(events.length){body='以下来自当前活动资料库，示例内容仅用于演示：\n\n'+events.map(e=>`${e.title}${e.isDemo?'（示例）':'（人工录入，未核验）'}\n${stamp(e.start)} · ${e.location}\n${e.price}\n来源：${e.sourceName}`).join('\n\n');refs=events.map(e=>({id:e.id,label:e.title,source:e.sourceName,updatedAt:e.updatedAt}));}
  else body='当前资料库没有符合这个时间的可用活动。已取消或已结束的活动不会继续推荐；尚未连接真实小程序来源，不能保证实时完整。';
 }else if(/吃|喝|餐|咖啡|美食|小吃|素食|清淡/.test(q)){
  body='可以从云南小吃、家常菜、咖啡茶饮几个方向安排。当前是大理本地生活演示，尚无已核验的具体商家、价格和营业时间。\n\n你可以补充所在区域、预算、是否带娃，我会在真实服务接入后结合来源进一步推荐。';
  refs=[{id:'food-demo',label:'大理吃喝示例资料',source:'原型示例资料'}];
 }else if(/玩|散步|路线|游|亲子|娃|骑行|半天/.test(q)){
  body='示例安排：留半天在洱海沿线轻松散步，或选择古城街巷和手作体验。具体开放、天气、交通与报名情况需出发前核实。\n\n这是玩法方向演示，不是已核验的实时行程。';refs=[{id:'play-demo',label:'大理游玩示例资料',source:'原型示例资料'}];
 }else body='我可以帮你了解大理的吃喝、游玩和本地活动。试试问“最近有什么活动”“附近有什么好吃的”或“带孩子半天怎么玩”。目前是本地示例问答，豆包等真实AI尚未接入。';
 return {status:'answered',mode:'demo',body,refs};
}
export function saveEvent(life,input,now=Date.now()){
 const title=clean(input.title,'活动名称',100),location=clean(input.location,'活动地点'),sourceName=clean(input.sourceName,'活动来源');
 const start=Number(input.start),end=Number(input.end);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Error('结束时间必须晚于开始时间');
 if(!['active','cancelled'].includes(input.status))throw Error('请选择有效的活动状态');
 const sourceUrl=String(input.sourceUrl||'').trim();if(sourceUrl&&!/^https:\/\//i.test(sourceUrl))throw Error('原始来源链接请填写https网址；没有时可留空');
 const n=clone(life),id=input.id||crypto.randomUUID();
 n.events[id]={id,title,location,sourceName,sourceUrl,cityId:input.cityId||'dali',start,end,category:clean(input.category||'活动','分类',30),price:clean(input.price||'费用待确认','费用说明',100),description:String(input.description||'').trim().slice(0,1000),status:input.status,isDemo:false,verified:false,provenance:'manual',updatedAt:now};n.revision++;return n;
}
export function syncDemo(life,now=Date.now()){
 const n=clone(life);for(const e of demoEvents(now))if(n.events[e.id]?.provenance!=='manual')n.events[e.id]=e;n.revision++;n.syncedAt=now;n.feedMode='demo';return n;
}
