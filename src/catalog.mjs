import {createSeed} from './model.mjs';
import {createLife} from './local-life.mjs';
import {QINGHUAN_QUESTIONS} from './qinghuan.mjs';
const clone=x=>structuredClone(x);
const own=(o,k)=>typeof k==='string'&&Object.hasOwn(o,k);
function sample(propertyId,name,roomNames){
 const s=createSeed();s.propertyId=propertyId;
 s.draft.name=name;s.draft.location='云南 · 大理（虚构演示）';
 s.draft.subtitle='在大理，住一段慢下来的时光。';
 s.draft.description='这是大理民宿的虚构演示资料，展示房源分享、VR看房、民宿咨询与本地生活如何衔接。';
 s.draft.facts.location.text='位于大理地区的虚构示例房源，不提供真实到店导航。实际地址和路线需管家确认。';
 s.draft.rooms=s.draft.rooms.map((r,i)=>({...r,id:roomNames[i][0],name:roomNames[i][1]}));
 s.published={...clone(s.draft),version:1,publishedAt:Date.now()};return s;
}
export function createWorkspace(legacy=null){
 const dali={id:'dali',name:'大理'},properties={
  'lake-inn':{merchantId:'lake',rentalMode:'room',city:dali,state:sample('lake-inn','洱岸听风 · 海景客栈',[['sea-king','听海 · 大床房'],['sea-twin','望海 · 双床房']])},
  'mountain-yard':{merchantId:'mountain',rentalMode:'whole',city:dali,state:sample('mountain-yard','苍山慢住 · 松风院',[['pine-king','松风主卧'],['pine-twin','庭院次卧']])},
  'flower-yard':{merchantId:'mountain',rentalMode:'whole',city:dali,state:sample('flower-yard','苍山慢住 · 花溪院',[['flower-king','花溪主卧'],['flower-twin','花溪次卧']])}
 };
 const merchants={lake:{name:'洱岸听风民宿',note:'按间经营示例'},mountain:{name:'苍山慢住民宿',note:'整院包栋示例'}};
 for(const p of Object.values(properties)){p.state.draft.rentalMode=p.rentalMode;if(p.rentalMode==='whole')p.state.draft.wholeCapacity='建议4人入住';p.state.published={...clone(p.state.draft),version:1,publishedAt:Date.now()};}
 if(legacy){properties.legacy={merchantId:'legacy',rentalMode:'room',city:{id:'moganshan',name:'莫干山'},state:clone(legacy)};merchants.legacy={name:'原有演示资料',note:'保留旧版资料与咨询'};}
 return ensureQinghuanWorkspace({schema:2,revision:0,merchants,properties,life:createLife(),lifeChats:{}});
}
function qinghuanEntry(){
 const state=createSeed();state.propertyId='qinghuan-dali';
 state.draft={...state.draft,name:'清欢 · 大理资料预览',subtitle:'入住前后常见问题，在这里问清楚。',location:'云南 · 大理（具体房源与地址待确认）',
  description:'依据清欢整理的30个高频问题提供接待指引。真实房源、出租方式、店规和服务能力仍需逐项确认；参考VR不代表当前房源。',
  profilePending:true,rentalMode:'pending',facts:{},rooms:[],knowledge:clone(QINGHUAN_QUESTIONS),vrLabel:'参考体验 · 真实VR素材待提供',vrDescription:'真实房源VR待提供，当前仅展示参考体验。'};
 state.published={...clone(state.draft),version:1,publishedAt:Date.now()};
 return {merchantId:'qinghuan',rentalMode:'pending',city:{id:'dali',name:'大理'},state};
}
export function ensureQinghuanWorkspace(w){
 if(own(w.properties,'qinghuan-dali'))return w;
 const next=clone(w);
 next.merchants.qinghuan={name:'清欢 · 大理资料预览',note:'30问接待指引；真实店规待确认'};
 next.properties['qinghuan-dali']=qinghuanEntry();next.revision++;
 return next;
}
function entry(w,pid){if(!own(w.properties,pid))throw Error('房源不存在');return w.properties[pid];}
export function shareUnits(w,pid){
 const p=entry(w,pid),s=p.state.published;
 if(p.rentalMode==='pending')return [];
 if(p.rentalMode==='whole')return [{id:'whole',name:s.name,kind:'整院包栋',description:`整院出租 · ${s.rooms.length}间卧室 · 不单独出租卧室`,vrUrl:s.vrUrl}];
 return s.rooms.map(r=>({id:r.id,name:r.name,kind:'单间出租',description:`${r.area} · ${r.beds} · ${r.capacity}`,vrUrl:s.vrUrl}));
}
export function shareUrl(w,{merchantId,propertyId,unitId,baseUrl}){
 const p=entry(w,propertyId);if(p.merchantId!==merchantId)throw Error('只能分享当前商家的房源');
 if(!p.state.visible)throw Error('房源已暂停展示，不能生成看房链接');
 if(!shareUnits(w,propertyId).some(u=>u.id===unitId))throw Error('出租单元不存在或经营方式已变化');
 const url=new URL(baseUrl),mobile=url.searchParams.get('mobile')==='1';url.search='';if(mobile)url.searchParams.set('mobile','1');url.searchParams.set('property',propertyId);url.searchParams.set('unit',unitId);url.searchParams.set('share','1');url.hash='/guest/home';return url.href;
}
export function resolveTarget(w,search){
 const q=new URLSearchParams(search),propertyId=q.get('property')||'lake-inn',unitId=q.get('unit');
 if(!own(w.properties,propertyId))return {ok:false,propertyId,message:'这条看房链接的房源已不存在，请联系民宿管家。'};
 if(q.get('share')==='1'&&!unitId)return {ok:false,propertyId,message:'看房链接缺少房间或整院信息，请向管家获取完整链接。'};
 if(unitId&&!shareUnits(w,propertyId).some(u=>u.id===unitId))return {ok:false,propertyId,message:'这个房间或整院的分享链接已失效，可能是经营方式发生了变化。请向管家获取新链接。'};
 return {ok:true,propertyId,unitId,customer:q.get('share')==='1'};
}
export function replaceProperty(w,pid,nextState){
 const p=entry(w,pid);if(nextState.propertyId!==p.state.propertyId)throw Error('房源归属不一致');
 const n=clone(w);n.properties[pid].state=clone(nextState);n.revision++;return n;
}
export function updateRentalMode(w,merchantId,pid,mode){
 const p=entry(w,pid);if(p.merchantId!==merchantId)throw Error('只能设置当前商家的房源');
 if(!['room','whole'].includes(mode))throw Error('请选择单间出租或整院包栋');
 if(!p.state.published.rooms.length)throw Error('请先补齐真实房间资料与房源配置，再设置出租方式和生成分享链接');
 const n=clone(w),pNext=n.properties[pid];pNext.rentalMode=mode;pNext.state.draft.rentalMode=mode;pNext.state.published.rentalMode=mode;pNext.state.published.version++;pNext.state.published.publishedAt=Date.now();pNext.state.revision++;n.revision++;return n;
}

export function ticketPreview(w,{merchantId,propertyId,ticketId}){
 const p=entry(w,propertyId);
 if(p.merchantId!==merchantId)throw Error('当前商家无权查看此房源咨询');
 const ticket=p.state.tickets[ticketId];
 const thread=ticket&&p.state.threads[ticket.threadId];
 if(!ticket||!thread||thread.propertyId!==p.state.propertyId)throw Error('原咨询会话不存在，请返回工作台');
 const room=p.state.published.rooms.find(r=>r.id===ticket.context?.roomId);
 return clone({propertyId,propertyName:p.state.published.name,unitName:room?.name||(ticket.context?.unitId==='whole'?'整院包栋':'本房源咨询'),ticket,thread});
}

export function merchantPendingSummary(w,merchantId){
 const properties=Object.entries(w.properties).filter(([,p])=>p.merchantId===merchantId).map(([propertyId,p])=>({
  propertyId,name:p.state.published.name,pending:Object.values(p.state.tickets).filter(t=>t.status!=='replied').length
 }));
 return {total:properties.reduce((sum,p)=>sum+p.pending,0),properties};
}
