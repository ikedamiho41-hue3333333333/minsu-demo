import {selectDraft,restoreDraft} from './conversation-drafts.mjs';
import {arrivalMarkup,handbookMarkup,guideEditorMarkup} from './guide-ui.mjs';
import {readGuideForm} from './guide.mjs';
import {recommendationsMarkup,recommendedPlaceMarkup,recommendedRouteMarkup,recommendationEditorMarkup} from './recommendations-ui.mjs';
import {recommendationContext,readRecommendationForm} from './recommendations.mjs';
import {upgradeExperience} from './experience.mjs';
import {propertyFormMarkup,unitManagerMarkup,roomFormMarkup,spaceFormMarkup} from './property-ui.mjs';
import {createProperty,createRoom,saveRoom,saveSpace,setDraftRentalMode} from './catalog.mjs';
import {createSeed,dispatch,guestThreads,TOPICS} from './model.mjs';
import {icon} from './icons.mjs';
import {originalConversationMarkup} from './merchant-ui.mjs';
import {createWorkspace,shareUnits,shareUrl,resolveTarget,replaceProperty,updateRentalMode,ticketPreview,merchantPendingSummary,ensureQinghuanWorkspace} from './catalog.mjs?v=20261023-content1';
import {lifeAnswer,saveEvent,syncDemo,LIFE_PLACES} from './local-life.mjs';
import {lifeCard,lifeHome,lifeChat,lifeComposer,eventContent,activityAdmin,activityForm,dateText,eventsPreviewMarkup} from './life-ui.mjs';
import {isMobilePresentation,propertyUrl} from './presentation.mjs';
import {contentFor,makeContentContext,validContentContext,lifeChatKey} from './content.mjs';
import {contentHome,placeContent,routeContent,leadContent,contentContextChip} from './content-ui.mjs';
import {serviceDeskMarkup,ticketServiceMarkup,guestHandbookMarkup} from './service-ui.mjs';

const STORAGE='minsu-mini-v040',LEGACY_STORAGE='minsu-mini-v030',SESSION='minsu-mini-guest-session',DRAFT='minsu-mini-composer-v040';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let workspace,state,target,activePropertyId,merchantId,sessionId,storageError='',composer={body:'',context:null},editorCache=null,knowledgeCache=null,vrCache=null,replyCache={},roomFilter='all',queueFilter='all',mobileOpen=false,toastTimer,lastRoute='',dialogAction=null,returnFocus=null,lifeFilter='all',lifeDraft='',lifeContext=null,lifePrevious=null,contentTab='places',contentCategory='all',contentQuery='',contentLimit=16,recommendationFilters={period:'all',party:'all'},recommendationEdit={kind:'place',id:null};
const customerPreview=new URLSearchParams(location.search).get('share')==='1';
const mobilePresentation=()=>isMobilePresentation(location.search,window.innerWidth);
function fitViewport(){document.documentElement.style.setProperty('--app-height',(window.visualViewport?.height||window.innerHeight)+'px');}
fitViewport();
window.visualViewport?.addEventListener('resize',fitViewport);
window.addEventListener('resize',fitViewport);
window.matchMedia('(max-width:760px)').addEventListener('change',()=>render());
try{const raw=localStorage.getItem(STORAGE);let old=null;try{old=JSON.parse(localStorage.getItem(LEGACY_STORAGE)||'null');}catch{}workspace=raw?JSON.parse(raw):createWorkspace(old?.schema===1?old:null);if(workspace.schema!==2||!workspace.properties||!Object.keys(workspace.properties).length||!workspace.life||!Number.isInteger(workspace.revision))throw Error('invalid');}
catch{workspace=createWorkspace();storageError='本地资料暂时无法读取，保留原数据并显示示例。请检查浏览器存储后重试。';}
// Add only the missing Qinghuan entry; preserve every existing property, draft and conversation.
try{const upgraded=ensureQinghuanWorkspace(workspace);if(upgraded!==workspace){localStorage.setItem(STORAGE,JSON.stringify(upgraded));workspace=upgraded;}}catch{storageError='清欢资料未能补入浏览器存储，原有资料保留。请检查存储后刷新。';}
workspace=upgradeExperience(workspace);
function setActive(){target=resolveTarget(workspace,location.search);activePropertyId=Object.hasOwn(workspace.properties,target.propertyId)?target.propertyId:Object.keys(workspace.properties)[0];state=workspace.properties[activePropertyId].state;merchantId=workspace.properties[activePropertyId].merchantId;}
setActive();
const draftKey=()=>DRAFT+':'+activePropertyId+':'+(target.unitId||'all');
const lifeDraftKey=()=>`minsu-life-draft:${activePropertyId}:${target.unitId||'all'}`,lifeContextKey=()=>`minsu-life-context:${activePropertyId}:${target.unitId||'all'}`;
try{sessionId=sessionStorage.getItem(SESSION);if(!sessionId){sessionId=crypto.randomUUID();sessionStorage.setItem(SESSION,sessionId);}composer=JSON.parse(sessionStorage.getItem(draftKey())||'null')||composer;lifeDraft=sessionStorage.getItem(lifeDraftKey())||(!target.unitId?sessionStorage.getItem('minsu-life-draft:'+activePropertyId):'')||'';lifeContext=JSON.parse(sessionStorage.getItem(lifeContextKey())||(!target.unitId?sessionStorage.getItem('minsu-life-context:'+activePropertyId):'')||'null');lifePrevious=JSON.parse(sessionStorage.getItem(lifeDraftKey()+':previous')||'null');}
catch{sessionId=null;storageError='浏览器无法保留会话，暂时不能发送问题。请启用浏览器存储后刷新。';}
const parts=()=>location.hash.replace(/^#\/?/,'').split('/');
const role=()=>customerPreview?'guest':parts()[0]||'guest';
const page=()=>customerPreview&&parts()[0]&&parts()[0]!=='guest'?'home':parts()[1]||'home';
const guestSession=()=>sessionId?(activePropertyId==='legacy'&&!target.unitId?sessionId:sessionId+':'+activePropertyId+':'+(target.unitId||'all')):null;
const currentThread=()=>guestThreads(state,guestSession())[0];
const canReadOwnHistory=()=>target.propertyId===activePropertyId&&!!currentThread();
const currentEntry=()=>workspace.properties[activePropertyId];
const currentCity=()=>currentEntry().city;
const lifeScope=()=>({propertyId:activePropertyId,unitId:target.unitId||null,cityId:currentCity().id,cityName:currentCity().name});
function validLifeObject(context){return context?.collection==='recommendations'?recommendationContext(context.kind,context.id,state.published,lifeScope()):validContentContext(context,lifeScope());}
function lifeContextMarkup(){const c=validLifeObject(lifeContext);if(!c&&lifeContext)return `<div class="composer-context"><span>原提问对象暂不可用</span><button type="button" data-action="clear-life-context">移除</button></div>`;return c?.collection==='recommendations'?`<div class="composer-context"><span>正在问：${esc(c.label)}</span><button type="button" data-action="clear-life-context" aria-label="移除本地生活对象">移除</button></div>`:contentContextChip(lifeContext,lifeScope());}
function saveLifeDraft(){try{sessionStorage.setItem(lifeDraftKey(),lifeDraft);sessionStorage.setItem(lifeContextKey(),JSON.stringify(lifeContext));sessionStorage.setItem(lifeDraftKey()+':previous',JSON.stringify(lifePrevious));}catch{}}
function goLifeChat(body='',context=null){const next=selectDraft({body:lifeDraft,context:lifeContext,previous:lifePrevious},body||undefined,validLifeObject(context));lifeDraft=next.body;lifeContext=next.context;lifePrevious=next.previous||null;saveLifeDraft();go('guest/life-chat');}
function guestProperty(){const p={...state.published,rooms:state.published.rooms.filter(r=>r.enabled!==false)};if(currentEntry().rentalMode==='room'&&target.unitId){const room=p.rooms.find(r=>r.id===target.unitId);return {...p,name:room?.name||p.name,rooms:room?[room]:[]};}return p;}
const pending=()=>Object.values(state.tickets).filter(t=>t.status!=='replied');
const time=n=>new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}).format(n);
const photo=(scene,cls='',label='示例空间氛围图')=>`<div class="scene ${scene} ${cls}" role="img" aria-label="${esc(label)}"><span class="photo-note">AI示例图</span></div>`;
const btn=(label,action,cls='secondary',data='')=>`<button class="btn ${cls}" data-action="${action}" ${data}>${label}</button>`;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3600);}
function saveComposer(){try{sessionStorage.setItem(draftKey(),JSON.stringify(composer));}catch{}}
function saveWorkspace(next){
 try{const raw=localStorage.getItem(STORAGE);if(raw){const latest=JSON.parse(raw);if(latest.revision!==workspace.revision){workspace=latest;setActive();render();throw Error('另一窗口更新了资料，已同步；请检查后重试，输入已保留。');}}
 localStorage.setItem(STORAGE,JSON.stringify(next));workspace=next;setActive();return true;
 }catch(e){toast(e.name==='QuotaExceededError'?'浏览器空间不足，未保存本次操作，输入已保留。':e.message);return false;}
}
function mutate(action,r=role()){
 try{if(r==='guest'&&!target.ok)throw Error('这条看房链接已失效，请联系管家');if(r==='merchant'&&currentEntry().merchantId!==merchantId)throw Error('当前商家不能修改此房源');
 if(action.type==='ASK'&&target.unitId)action={...action,context:{...action.context,unitId:target.unitId,...(currentEntry().rentalMode==='room'?{roomId:target.unitId}:{})}};
 const next=dispatch(state,action,{role:r,sessionId:r==='guest'?guestSession():sessionId});
 return saveWorkspace(replaceProperty(workspace,activePropertyId,next));
 }catch(e){toast(e.message);return false;}
}
function switchProperty(pid,r=role()){
 location.href=propertyUrl(location.href,pid,r);
}
function demoSelectors(){return `<div class="demo-selectors"><label>演示商家<select id="merchant-select" aria-label="选择演示商家">${Object.entries(workspace.merchants).map(([id,m])=>`<option value="${id}" ${id===merchantId?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label><label>当前房源<select id="property-select" aria-label="选择当前房源">${Object.entries(workspace.properties).filter(([,p])=>p.merchantId===merchantId).map(([id,p])=>`<option value="${id}" ${id===activePropertyId?'selected':''}>${esc(p.state.published.name)} · ${p.rentalMode==='pending'?'待确认':p.rentalMode==='room'?'按间':'整院'}</option>`).join('')}</select></label></div>`;}

function go(route){const h='#/'+route;if(location.hash===h)render();else location.hash=h;}
function goChat(body='',context=null){const normalized=context?{...context,propertyId:activePropertyId,version:state.published.version,label:context.label||state.published.rooms.find(r=>r.id===context.roomId)?.name||context.spaceName||'本店资料'}:null;composer=selectDraft(composer,body||undefined,normalized);saveComposer();go('guest/chat');}
function showDialog(title,body,onAction=null){
 returnFocus=document.activeElement;dialogAction=onAction;
 const d=$('#detail-dialog');d.innerHTML=`<div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2><button class="icon-btn" data-action="close-dialog" aria-label="关闭">${icon('close')}</button></div>${body}`;d.showModal();
}
function closeDialog(){const d=$('#detail-dialog');d.close();dialogAction=null;if(returnFocus?.isConnected)returnFocus.focus();}
function tabbar(){
 const r=role(),p=page();
 const tabs=r==='merchant'?[['home','bell','接待工作台'],['editor','edit','民宿资料'],['knowledge','book','问答与周边']]:[['home','house','这家民宿'],['handbook','book','入住指南'],['life','pin','周边推荐'],['chat','chat','AI管家']];
 return `<nav class="tabbar" aria-label="${r==='merchant'?'商家':'客人'}底部导航">${tabs.map(([key,i,label])=>`<button data-action="nav" data-route="${r}/${key}" class="${p===key||(key==='rooms'&&['room','space'].includes(p))?'active':''}" ${p===key||(key==='home'&&['rooms','room','space'].includes(p))?'aria-current="page"':''}>${icon(i)}<span>${label}</span></button>`).join('')}</nav>`;
}
const narrationMap={
 'guest/home':{title:'先看见喜欢的地方，\n再问清在意的事。',lead:'客人打开的就是这家民宿。VR看房、AI管家，都在手边。',items:[['panorama','VR看房放在首屏','首页直接呈现可操作的全景，先感受空间；也可进入完整观看页。当前使用指定参考案例。'],['chat','问题，就在这家店里问','停车、入住、厨房和设施，回答只取自这家民宿已经公开的资料。'],['users','答不上来，就交给管家','客人主动转人工，商家接手，回复回到同一段对话。']],next:['体验一次AI问答','try-kitchen']},
 'guest/rooms':{title:'房间与设施，\n看得见，也问得清。',lead:'房型、床型、公共区域，按空间组织。看完任何一个地方，都可以接着问。',items:[['bed','先选你关心的房间','卧室、厨房、庭院和客厅各有详情，图片与资料放在一起。'],['chat','带着房间问AI','从所选房间发起提问，对话会带上该房间标签，不需要客人重复描述。'],['book','资料不够，保留未知','图片是示例图，文字来自公开资料。未写明的设施和条件，留给管家确认。']],next:['带着当前房间提问','try-room']},
 'guest/chat':{title:'有资料，给答案。\n没把握，请管家。',lead:'把反复出现的咨询交给AI，把需要判断的事留给民宿管家。',items:[['book','每个答案都能看依据','厨房回答使用厨房规则，停车回答使用停车说明；查看来源可以追到公开版本。'],['users','一条问题，一次交接','试着问“可以带宠物吗”。资料没有记录，点击请管家确认后，商家工作台会出现同一条咨询。'],['edit','回复和知识分开','人工回答只回给当前客人。商家可另外整理公开问答，发布后才用于后续咨询。']],next:['切换商家，查看待办','switch-merchant']},
 'guest/vr':{title:'先走进空间，\n再决定想了解什么。',lead:'全景是看房主入口之一。看完可以回到这家民宿继续问管家。',items:[['panorama','真正打开全景播放器','直接加载第三方参考案例，在页内观看，也可以打开原站。'],['shield','案例来源始终可见','参考VR非当前民宿实拍，不把其中房间、面积或设施当作本店事实。'],['chat','回到咨询不丢草稿','返回民宿或切到AI管家，保留之前的输入和房间上下文。']],next:['回到民宿首页','guest-home']},
 'merchant/home':{title:'需要你接手的，\n已经在这里。',lead:'商家与客人共用同一份民宿资料、同一条咨询。这里展示真实演示操作产生的待办。',items:[['bell','从AI交接过来的问题','待办保留客人的原问题和房间上下文，可以接手后给出人工答复。'],['person','人工回复，有清楚署名','回复后切回客人端，就能在原会话看到“民宿管家”的答案。'],['book','常见问题，慢慢沉淀','选择整理为公开问答，编辑为可对所有客人展示的内容，再发布生效。']],next:['回客人端查看对话','switch-chat']},
 'merchant/editor':{title:'这家民宿的事实，\n从这里维护。',lead:'位置、环境、房间、设施和使用规则，共同组成客人能看、AI能引用的资料。',items:[['edit','先保存草稿','草稿单独保存，不会立即改变客人看到的内容和AI答案。'],['check','发布后才生效','确认内容后发布，新提问会引用新版本，旧对话保留当时的依据。'],['panorama','VR和文字各有来源','可维护VR素材说明；当前指定参考案例不与虚构房间自动关联。']],next:['去客人端验证新答案','switch-chat']},
 'merchant/knowledge':{title:'把一次答复，\n变成下次的帮助。',lead:'高频问答经过商家编辑、确认与发布，才能进入本店资料库。',items:[['book','只公开适合所有人的内容','单次特殊承诺不会自动进入知识；编辑问题、答案和相似问法后保存草稿。'],['check','沿用资料发布','问答与民宿资料统一发布。未发布的草稿不参与客人咨询。'],['shield','明确规则优先','已有厨房、停车、入住规则优先，避免自由问答覆盖结构化使用条件。']],next:['查看客人咨询效果','switch-chat']},
 'platform/home':{title:'平台在背后支撑，\n客人直接开始。',lead:'商家、房源和服务状态由平台管理，客人无需走一遍管理流程。',items:[['house','管理房源展示状态','可暂停或恢复示例房源展示；暂停后AI不会继续引用资料回答。'],['book','了解资料与服务状态','查看公开版本、问答数量和人工待办，支持商家服务。'],['users','演示入口不等于真实权限','三端切换仅用于原型讲解，没有接入真实登录和跨设备通知。']],next:['回到客人首页','guest-home']}
};
Object.assign(narrationMap,{
 'guest/handbook':{title:'按入住阶段，\n把问题找清楚。',lead:'清欢30问分为入住前、入住中和退房后。公开接待指引与商家内部处置资料分别展示。',items:[['book','沿用当前公开资料','手册读取当前房源公开版本，未确认的店规继续说明缺项。'],['chat','带着问题继续咨询','展开条目可预填到AI管家，客人确认发送后才提交。'],['shield','内部建议留在商家端','岗位、巡检、整改排序和处置建议不会进入客人手册。']],next:['继续问AI管家','switch-chat']},
 'merchant/service':{title:'接手之前，\n先看清处理依据。',lead:'按清欢30问查看核实清单、内部动作建议和责任岗位候选。原稿建议仍待店方确认。',items:[['book','咨询与题号关联','客人转人工后，咨询详情可显示对应题目的处置资料。'],['person','岗位待落实到实际人员','原表岗位和整改排序只是候选，不等于已排班、派单或批准补偿。'],['shield','公开答复单独维护','内部动作不自动成为客人答案，人工回复只回到原会话。']],next:['回客人端查看对话','switch-chat']}
});
function narration(){
 let key=role()+'/'+page();if(['room','space'].includes(page()))key='guest/rooms';if(['ticket','queue'].includes(page()))key='merchant/home';if(['knowledge-edit'].includes(page()))key='merchant/knowledge';if(role()==='merchant'&&page()==='vr')key='merchant/editor';if(role()==='platform')key='platform/home';
 const n=['life','life-chat','life-place','life-route','life-lead'].includes(page())?{title:'住在哪里，\n也想知道怎么玩。',lead:'民宿管家回答本店的事，本地生活AI帮助了解同城吃喝、游玩与活动。',items:[['pin','从房源所在地出发','按当前城市展示资料，原稿地点与行程仍需结合实际出发点核实。'],['book','活动有来源与有效期','展示时间、地点、来源和更新时间，取消或结束后不继续推荐。'],['spark','国内AI随后接入','先按有出处的本地资料做问答，豆包与真实活动源分别接入。']],next:['回到这家民宿','guest-home']}:narrationMap[key]||narrationMap['guest/home'];
 return `<aside class="narration ${mobileOpen?'mobile-open':''}" aria-label="原型讲解和演示入口"><nav class="view-switch" aria-label="演示视角（非客人业务流程）">${[['guest','客人端'],['merchant','商家端'],['platform','平台端']].map(([key,label])=>`<button data-action="role" data-role="${key}" class="${role()===key?'active':''}" aria-pressed="${role()===key}">${label}${key==='merchant'&&pending().length?`<span class="badge-dot">${pending().length}</span>`:''}</button>`).join('')}</nav>${demoSelectors()}<h1>${esc(n.title).replace('\n','<br>')}</h1><p class="lead">${esc(n.lead)}</p><div class="divider"></div><div class="narration-items">${n.items.map(([i,title,copy])=>`<div class="narration-item">${icon(i)}<div><h2>${title}</h2><p>${copy}</p></div></div>`).join('')}</div><div class="demo-next"><span>继续演示</span><button class="text-btn" data-action="${n.next[1]}">${n.next[0]} ${icon('arrow')}</button></div><p class="scope-note">房源与本地生活内容为演示示例，VR为参考案例。问答采用本地资料匹配演示，未接真实模型。网页模拟小程序，无真实微信登录、预订或消息通知。</p></aside>`;
}
function headerInfo(){
 const r=role(),p=page();let title=target.ok?state.published.name:'看房链接失效',back=null;
 if(r==='merchant'){title=({home:'商家接待',editor:'民宿资料',knowledge:'问答知识',vr:'VR资料',queue:'人工咨询',ticket:'咨询详情','knowledge-edit':'编辑公开问答'})[p]||'商家接待';if(['ticket','queue','service'].includes(p))back='merchant/home';if(p==='service')title='接待处置资料';if(p==='knowledge-edit')back='merchant/knowledge';if(p==='vr')back='merchant/home';}
 if(r==='platform'){title=p==='activities'?'本地活动管理':p==='event-edit'?'编辑本地活动':'平台服务管理';if(p!=='home')back='platform/home';}
 if(r==='guest'){
  if(p==='chat'){title=state.published.name+' · AI管家';back='guest/home';}
  if(p==='vr'){title='VR看房';back='guest/home';}
  if(p==='room'){title='房间详情';back='guest/rooms';}
  if(p==='space'){title='公共区域';back='guest/rooms';}if(p==='life'){title=currentCity().name+' · 本地生活';}if(p==='life-chat'){title=currentCity().name+' · 本地生活AI';back='guest/life';}if(['life-place','life-route','life-lead'].includes(p)){title=({'life-place':'地点资料','life-route':'主题路线','life-lead':'活动线索'})[p];back='guest/life';}if(p==='handbook'){title='入住指南';back='guest/home';}
 }
 if(r==='guest'){if(p==='arrival'){title='如何到店';back='guest/handbook';}if(p==='life-library'){title='完整资料预览';back='guest/life';}if(p==='recommended-place'||p==='recommended-route'){title=p==='recommended-place'?'精选地点':'推荐路线';back='guest/life';}}
 return {title,back};
}
	function demoEntrySwitch(currentRole) {
		if (customerPreview) return "";
		return `<nav class="demo-entry-switch" aria-label="切换演示端"><span>演示切换</span>${[["guest", "客人端"], ["merchant", "商家端"]].map(([key, label]) => `<button type="button" data-action="role" data-role="${key}" aria-pressed="${currentRole === key}">${label}</button>`).join("")}</nav>`;
	}
function render(){
 const r=role(),p=page(),info=headerInfo(),chat=r==='guest'&&p==='chat'&&(target.ok||canReadOwnHistory()),localChat=r==='guest'&&p==='life-chat'&&(target.ok||canReadOwnHistory()),noTabs=chat||localChat||p==='vr'||p==='room'||p==='space'||['ticket','knowledge-edit','queue','service','life-place','life-route','life-lead'].includes(p)||r==='platform';
 const prevScroll=$('.phone-body')?.scrollTop??0,prevRoute=lastRoute;lastRoute=location.hash;
 document.body.classList.toggle('customer-preview',customerPreview);
 document.body.classList.toggle('mobile-presentation',mobilePresentation());
 $('#app').innerHTML=`<header class="workspace-header"><a class="brand" href="#/guest/home"><img src="assets/icon.svg" alt="">民宿工具 <span>可交互演示原型</span></a><div class="header-right"><span><i class="live-dot"></i>交互演示 · v0.5 开发中</span><span>房源分享，看房咨询，本地生活</span></div></header><button class="mobile-demo-toggle" data-action="mobile-controls" aria-expanded="${mobileOpen}"><span>${icon('house')} 小程序风格演示 <strong>· ${r==='guest'?'客人端':r==='merchant'?'商家端':'平台端'}</strong></span><span>${mobileOpen?'收起讲解':'演示控制'} ${icon(mobileOpen?'close':'more')}</span></button><main class="workspace">${mobilePresentation()?'':narration()}<section class="stage" aria-label="可操作手机原型"><div class="stage-caption">${target.ok||r!=='guest'?esc(state.published.name):'看房链接失效'} <span>小程序体验</span></div><div class="phone"><div class="status-bar"><span>9:41</span><span class="status-icons">${icon('signal')}${icon('wifi')}${icon('battery')}</span></div><header class="mini-header"><div class="mini-title">${info.back?`<button class="icon-btn" data-action="nav" data-route="${info.back}" aria-label="返回">${icon('back')}</button>`:''}<span class="mini-title-text">${esc(info.title)}</span></div><button class="mini-capsule" data-action="about" aria-label="${mobilePresentation()&&!customerPreview?'演示入口与说明':'小程序演示说明'}">${icon('more')}<span class="capsule-divider"></span><i class="capsule-circle"></i></button></header>${demoEntrySwitch(r)}${storageError?`<div class="error-banner">${esc(storageError)}</div>`:''}${chat||localChat?renderChat():`<div class="phone-body ${p==='vr'&&r==='guest'?'vr-body':''}" id="phone-scroll">${content()}</div>`}${noTabs?'':tabbar()}${localChat?lifeComposer(lifeDraft,lifeContextMarkup()+(lifePrevious?'<button type="button" class="text-btn restore-draft" data-action="restore-life-draft">恢复上次未发送内容</button>':''),!target.ok||!state.visible||!sessionId):chat?composerView():r==='merchant'&&p==='editor'?editorActions():''}${r==='guest'&&['room','space'].includes(p)?detailActions():''}<div class="home-indicator"></div></div><p class="stage-footer">在右侧直接操作 · 左侧讲解随页面变化</p></section></main>`;
 if(chat||localChat){const c=$('.chat-scroll');if(c)c.scrollTop=c.scrollHeight;const body=$('.phone-body');if(body)body.scrollTop=body.scrollHeight;}
 else if(prevRoute===location.hash&&$('.phone-body'))$('.phone-body').scrollTop=prevScroll;
 if(p==='editor'&&editorCache)fillEditor();
 if(p==='knowledge-edit'&&knowledgeCache)fillKnowledge();
 if(p==='ticket'&&replyCache[parts()[2]])$('#reply-body').value=replyCache[parts()[2]];
 if(!chat&&!localChat&&prevRoute!==location.hash){$('.phone-body')?.setAttribute('tabindex','-1');$('.phone-body')?.focus({preventScroll:true});}
}
function content(){
 const r=role(),p=page();
 if(r==='guest'){
  if(!target.ok)return `<div class="page-pad"><div class="empty-state">${icon('house')}<h1 class="page-title">看房链接暂不可用</h1><p>${esc(target.message)}</p>${canReadOwnHistory()?btn('查看已有咨询记录','nav','secondary wide',`data-route="guest/chat"`):''}</div></div>`;
  if(!state.visible)return `<div class="page-pad"><div class="empty-state">${icon('house')}<h2>民宿资料暂时停止展示</h2><p>请联系民宿管家确认。恢复展示后可继续看房和咨询。</p></div>${btn('查看已有咨询','switch-chat','secondary wide')}</div>`;
  if(p==='life')return recommendationsMarkup(state.published,lifeScope(),recommendationFilters);if(p==='recommended-place')return recommendedPlaceMarkup(parts()[2],state.published,lifeScope());if(p==='recommended-route')return recommendedRouteMarkup(parts()[2],state.published,lifeScope());if(p==='life-library')return contentHome(lifeScope(),{tab:contentTab,category:contentCategory,query:contentQuery,limit:contentLimit,eventsMarkup:eventsPreviewMarkup(workspace.life,currentCity())})||'<div class="page-pad"><h1 class="page-title">本房源暂无原稿资料库</h1><p class="notice">未将其他房源的专属资料混入本店。可从演示商家选择清欢资料预览，查看已有85条资料与5条主题路线。</p></div>';if(p==='life-place')return placeContent(parts()[2],lifeScope());if(p==='life-route')return routeContent(parts()[2],lifeScope());if(p==='life-lead')return leadContent(parts()[2],lifeScope());if(p==='handbook')return `<div class="page-pad">${handbookMarkup(activePropertyId,state.published)}</div>`;if(p==='arrival')return `<div class="page-pad">${arrivalMarkup(state.published,activePropertyId,target.unitId||null)}</div>`;if(p==='home')return home();if(p==='rooms')return rooms();if(p==='room')return roomDetail();if(p==='space')return spaceDetail();if(p==='vr')return vr();
 }
 if(r==='merchant'){if(p==='guide-editor')return `<div class="page-pad">${guideEditorMarkup(state,activePropertyId)}</div>`;if(p==='recommendations')return recommendationEditorMarkup(state.draft,activePropertyId,recommendationEdit);if(p==='new-property')return propertyFormMarkup();if(p==='units')return unitManagerMarkup(state);if(p==='room-edit')return roomFormMarkup(state,parts()[2]);if(p==='space-edit')return spaceFormMarkup(state,parts()[2]);if(p==='service')return `<div class="page-pad"><h1 class="page-title">接待处置资料</h1><p class="page-description">按问题查看确认清单、内部动作建议和责任岗位。</p>${serviceDeskMarkup(activePropertyId,state.published.knowledge)||'<p class="notice">当前房源暂无此组资料。</p>'}</div>`;if(p==='home')return merchantHome();if(p==='queue')return queue();if(p==='ticket')return ticketDetail();if(p==='editor')return editor();if(p==='vr')return vrEditor();if(p==='knowledge')return knowledge();if(p==='knowledge-edit')return knowledgeEditor();}
 if(r==='platform'){if(p==='activities')return activityAdmin(workspace.life);if(p==='event-edit')return activityForm(workspace.life.events[parts()[2]]||null);return platform();}
 return `<div class="page-pad"><h1 class="page-title">页面未找到</h1>${btn('返回民宿首页','guest-home','wide')}</div>`;
}
function inlineVr(label,cls=''){
 const p=state.published;
 return `<section class="vr-inline ${cls}" aria-label="${esc(label)}"><div class="vr-inline-player"><iframe class="vr-inline-frame" title="${esc(label)}：第三方参考，非当前民宿实拍" src="${esc(p.vrUrl)}" allow="fullscreen; gyroscope; accelerometer" referrerpolicy="no-referrer"></iframe><span class="vr-inline-disclosure">VR参考案例 · 非本店实拍</span></div><div class="vr-inline-toolbar"><div><strong>${icon('panorama')} VR 看房</strong><small>${esc(p.vrLabel||'拖动全景，感受空间')}</small></div><button class="text-btn" data-action="nav" data-route="guest/vr" aria-label="VR 看房，完整观看">${icon('expand')} 完整观看</button><a class="text-btn vr-inline-original" href="${esc(p.vrUrl)}" target="_blank" rel="noopener noreferrer" aria-label="打开VR原站">${icon('external')}</a></div></section>`;
}
function home(){
 const p=guestProperty();
 return `${inlineVr('首页VR看房')}<div class="home-main vr-first"><div class="property-heading"><h1>${esc(p.name)}</h1>${icon('leaf')}</div><p class="property-location">${icon('pin')}${esc(p.location)}</p><p class="property-tagline">${esc(p.subtitle)}</p><span class="rental-badge">${currentEntry().rentalMode==='pending'?'出租方式待店方确认':currentEntry().rentalMode==='whole'?'整院包栋 · 卧室不单独出租':target.unitId?'当前分享：单间出租':'按间出租 · 可分别分享房间'}</span><section class="ai-entry"><div class="ai-entry-title">${icon('spark')}<strong>AI 民宿管家</strong><small>随时问，少等待</small></div><p>停车、入住、厨房和房间，想问什么？</p><button class="ask-link" data-action="switch-chat"><span>问问这家民宿的事…</span>${icon('arrow')}</button></section><div class="home-quick-actions"><button class="btn secondary" data-action="nav" data-route="guest/arrival">如何到店</button><button class="btn outline" data-action="nav" data-route="guest/handbook">入住指南</button><button class="btn outline" data-action="nav" data-route="guest/life">周边推荐</button></div><div class="section-title"><h2>${currentEntry().rentalMode==='pending'?'真实房源资料待补齐':currentEntry().rentalMode==='whole'?'整院里的卧室':'喜欢的房间，先看看'}</h2><button class="text-btn" data-action="nav" data-route="guest/rooms">房间设施 ${icon('chevron')}</button></div>${p.profilePending?'<p class="notice">已接入清欢30问接待指引。具体店规尚未确认时，AI会说明缺项并请管家确认。</p><button class="text-btn" data-action="nav" data-route="guest/handbook">查看入住前、中、后的服务手册</button>':''}<div class="room-preview">${p.rooms.map(r=>`<button class="preview-item" data-action="nav" data-route="guest/room/${esc(r.id)}">${photo(r.photo,'preview-photo',r.name+'（AI示例图）')}<strong>${esc(r.name)}</strong><small>${esc(r.area)} · ${esc(r.beds)}</small></button>`).join('')}</div><div class="amenities">${[['kitchen','kitchen','厨房说明'],['parking','parking','停车说明'],['wifi','wifi','网络设施'],['environment','leaf','公共区域']].map(([k,i,l])=>`<button class="amenity" data-action="fact" data-key="${k}">${icon(i)}${l}</button>`).join('')}</div><div class="section-title"><h2>关于这座小院</h2></div><p class="intro-copy">${esc(p.description)}</p><div class="facts-list">${[['checkin','clock','入住与退房'],['kitchen','kitchen','厨房使用说明'],['parking','parking','自驾与停车']].map(([k,i,l])=>`<button class="fact-row" data-action="fact" data-key="${k}">${icon(i)}<span>${l}</span>${icon('chevron')}</button>`).join('')}</div><p class="demo-footnote">示例资料仅供原型演示 · 吃喝玩乐可进入本地生活<br>${esc(state.published.name)} · 期待与你相遇</p></div>`;
}
function rooms(){
 const p=guestProperty();if(!p.rooms.length&&!(p.spaces||[]).length)return `<div class="page-pad"><h1 class="page-title">房源资料待确认</h1><p class="page-description">真实房间、床型、设施和出租方式尚未录入。可以先向AI管家提问，由管家逐项确认。</p>${btn('问问AI管家','switch-chat','wide')}</div>`;const showRooms=roomFilter!=='spaces',showSpaces=roomFilter!=='bedrooms';
 return `<div class="page-pad"><h1 class="page-title">把每个空间，看清楚。</h1><p class="page-description">房间、院子、厨房与公共区域，都在这里。</p><nav class="page-filter" aria-label="空间分类">${[['all','全部空间'],['bedrooms','卧室'],['spaces','公共区域']].map(([k,l])=>`<button class="${roomFilter===k?'active':''}" data-action="room-filter" data-filter="${k}" aria-pressed="${roomFilter===k}">${l}</button>`).join('')}</nav>${showRooms?p.rooms.map(r=>`<article class="room-item"><button class="room-item-photo scene ${r.photo}" data-action="nav" data-route="guest/room/${esc(r.id)}" aria-label="查看${esc(r.name)}"><span class="photo-note">AI示例图</span></button><div class="room-item-info"><h2>${esc(r.name)}</h2><span class="tag">${esc(r.type)}</span></div><p class="room-info-sub">${esc(r.floor)} · ${esc(r.area)} · ${esc(r.beds)}</p><div class="tags">${r.facilities.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><div class="room-actions">${btn('查看房间','nav','outline',`data-route="guest/room/${esc(r.id)}"`)}${btn(icon('chat')+' 问问管家','ask-room','secondary',`data-room="${esc(r.id)}"`)}</div></article>`).join(''):''}${showSpaces?`<div class="section-title"><h2>公共区域</h2></div>${(p.spaces?p.spaces.filter(x=>x.enabled!==false).map(x=>[x.id,x.name,x.description]):[['courtyard','独立庭院','喝茶、聊天，把时间交给自然。'],['kitchen','共享厨房','做一顿家常饭，先了解开放规则。'],['living','共享客厅','一起阅读，或安静坐一会儿。']]).map(([k,n,d])=>`<button class="space-row" data-action="nav" data-route="guest/space/${k}">${photo(k)}<span><strong>${n}</strong><p>${d}</p></span>${icon('chevron')}</button>`).join('')}`:''}<p class="demo-footnote">图片为氛围示意，使用条件以本店公开资料为准。</p></div>`;
}
function roomDetail(){
 const r=guestProperty().rooms.find(r=>r.id===parts()[2]);if(!r)return `<div class="page-pad">房间已不存在，请返回重新选择。</div>`;
 return `${photo(r.photo,'detail-photo',r.name+'氛围示意')}<div class="page-pad"><h1 class="detail-title">${esc(r.name)}</h1><p class="page-description">${esc(r.description)}</p><div class="tags">${r.facilities.map(f=>`<span class="tag">${esc(f)}</span>`).join('')}</div><dl class="detail-grid">${[['房间面积',r.area],['床型配置',r.beds],['建议人数',r.capacity],['所在楼层',r.floor],['卫浴',r.bath],['房型',r.type]].map(([a,b])=>`<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl><h2 style="font-size:15px">入住前，了解这些</h2><p class="notice">${esc(state.published.facts.checkin?.text||'入住规则尚未记录，请管家确认。')}</p><button class="text-btn" data-action="photo" data-scene="${r.photo}" data-label="${esc(r.name)}">${icon('image')} 查看示例图片</button><p class="demo-footnote">虚构示例资料 · 非真实房源实拍<br>公开资料 V${state.published.version}</p></div>`;
}
function spaceInfo(){if(state.published.spaces){const x=state.published.spaces.find(x=>x.id===parts()[2]&&x.enabled!==false);return x?{...x,scene:x.key==='kitchen'?'kitchen':'courtyard',key:x.key||'environment',desc:x.description}:null;}return ({courtyard:{name:'独立庭院',scene:'courtyard',key:'environment',desc:'留一段时间，在院子里慢下来。'},kitchen:{name:'共享厨房',scene:'kitchen',key:'kitchen',desc:'旅途中，也可以做一顿喜欢的家常饭。'},living:{name:'共享客厅',scene:'living',key:'environment',desc:'一起聊天、阅读，享受自在的公共时光。'}})[parts()[2]];}
function spaceDetail(){
 const s=spaceInfo();if(!s)return `<div class="page-pad">空间不存在，请返回重新选择。</div>`;
 return `${inlineVr(s.name+' · VR参考','space-vr')}<div class="page-pad"><h1 class="detail-title">${s.name}</h1><p class="page-description">${s.desc}</p><div class="section-title"><h2>开放与使用</h2></div><p class="intro-copy">${esc(state.published.facts[s.key]?.text||'暂无资料，请管家确认。')}</p><button class="text-btn" data-action="fact" data-key="${s.key}">${icon('book')} 查看本店资料依据</button><p class="notice">想了解使用时间、是否需要预约或具体设施，可以带着这个空间问问管家。</p><p class="demo-footnote">VR为整体看房参考，不绑定当前空间 · 使用条件以本店资料为准</p></div>`;
}
function detailActions(){return `<div class="sticky-actions">${btn(icon('chat')+' 问问管家','ask-detail','wide')}</div>`;}
function messageChatScope(message,thread){
 let item=message;const seen=new Set();while(item&&item.role!=='guest'&&!seen.has(item.id)){seen.add(item.id);item=thread.messages.find(x=>x.id===item.replyTo);}return item?.context?.scope==='local'?'local':'stay';
}
function renderChat(){
 const t=currentThread(),local=page()==='life-chat',scope=local?'local':'stay',messages=(t?.messages||[]).filter(m=>messageChatScope(m,t)===scope);
 const suggestions=local?['半天有哪些适合的安排','附近有什么好吃的','有哪些活动来源线索']:state.published.profilePending?['从机场/高铁站怎么到院子？能安排接站吗？','自驾好停车吗？收费吗？有充电桩吗？','含早餐吗？可以自己做饭吗？']:['厨房能做饭吗','怎么停车','几点可以入住','可以带宠物吗'];
 const scopes=`<nav class="assistant-scopes" aria-label="AI问答范围"><button type="button" data-action="assistant-scope" data-scope="stay" aria-pressed="${!local}">本店管家</button><button type="button" data-action="assistant-scope" data-scope="local" aria-pressed="${local}">本地向导</button></nav>`;
 const info=`<div class="chat-info">${icon('shield')}<span>${local?'当前范围：周边推荐与原稿预览 · 未接豆包':state.published.profilePending?(state.published.knowledge.some(k=>k.kind==='confirmation_guide')?'当前范围：本店30问 · 店规待确认':'当前范围：本店资料待补 · 请管家确认'):'当前范围：本店公开资料 · 本地问答演示'}</span>${!local&&state.published.knowledge.some(k=>k.kind==='confirmation_guide')?'<button class="text-btn" data-action="question-library">常见30问</button>':''}</div>`;
 const welcome=`<div class="welcome"><div class="ai-avatar">${icon(local?'leaf':'spark')}</div><h1>${local?'想了解周边，<br><span>这次准备怎么玩？</span>':'你好，我是小院管家。<br><span>这趟旅程，想了解什么？</span>'}</h1><p>${local?'仅按当前房源已发布精选或有出处的待核原稿说明。<br>咨询不代表已预约，费用和服务须另行确认。':'厨房、停车、入住或服务需求。<br>知道的说明依据，不确定的请管家确认。'}</p></div><div class="suggested">${suggestions.map(q=>`<button data-action="${local?'life-prefill':'prefill'}" data-question="${esc(q)}">${esc(q)}${icon('arrow')}</button>`).join('')}</div><p class="chat-tip">先选择问题，或在下方输入。点击发送才会提交。<br>仅本浏览器演示，无真实模型或外部通知。</p>`;
 const legacy=local&&!target.unitId?lifeMessages():[];
 const archive=legacy.length?`<details class="legacy-chat"><summary>旧版本向导记录（只读）</summary><p>历史来源预览，不代表当前营业与服务状态。</p>${legacy.map(m=>`<p><strong>${m.role==='guest'?'客人':'旧版向导'}</strong>：${esc(m.body)}</p>`).join('')}</details>`:'';
 return scopes+info+`<div class="phone-body chat-body" id="phone-scroll"><div class="chat-scroll">${messages.length?`<p class="chat-time">今天 ${time(messages[0].at)}</p>${!state.visible||!target.ok?'<p class="chat-history-banner">资料已暂停展示，保留历史；新的咨询暂不可发送。</p>':''}${messages.map(m=>message(m,t)).join('')}`:welcome}${archive}</div></div>`;
}
function message(m,t){
 const ticket=Object.values(state.tickets).find(x=>x.messageId===m.id),human=m.role==='merchant',guest=m.role==='guest';
 const context=m.contextLabel||m.context?.label||(m.context?.roomId?state.published.rooms.find(r=>r.id===m.context.roomId)?.name:m.context?.spaceName);
 return `<article class="message ${m.role}">${guest?'':`<span class="message-avatar">${icon(human?'person':'spark')}</span>`}<div class="message-content">${guest?'':`<p class="message-name">${human?'民宿管家 · 人工回复':messageChatScope(m,t)==='local'?'本地向导 · 资料演示':'AI小院管家'}</p>`}<div class="message-bubble">${context?`<span class="message-context">关于 ${esc(context)}</span>`:''}${esc(m.body)}</div>${m.sources?.length?`<button class="message-source" data-action="sources" data-thread="${t.id}" data-message="${m.id}">${icon('book')} 依据：${esc(m.sources.map(s=>s.label).join('、'))} <span>V${m.sources[0].version}${m.sources[0].version!==state.published.version?' · 已更新':''}</span>${icon('chevron')}</button>`:''}${m.knowledgeIds?.includes('Q19')?`<button class="handoff-button" data-action="q19-life" data-thread="${t.id}" data-message="${m.id}">带着问题问本地生活AI</button>`:''}${!guest&&!human?ticket?`<p class="handoff-state">${icon(ticket.status==='replied'?'check':'clock')}${ticket.status==='replied'?'管家已回复，见下方':ticket.status==='processing'?'管家已接手，等待人工回复':'本机待办已生成，等待演示接手'}</p>`:`<button class="handoff-button" data-action="handoff" data-thread="${t.id}" data-message="${m.id}">${icon('person')} ${m.status==='needs_human'?'请管家确认':'继续请教人工管家'}</button>`:''}</div></article>`;
}
function composerView(){
 const context=composer.context?.label||(composer.context?.roomId?state.published.rooms.find(r=>r.id===composer.context.roomId)?.name:composer.context?.spaceName);
 return `<form id="chat-form" class="chat-composer">${composer.previous?'<button type="button" class="text-btn restore-draft" data-action="restore-chat-draft">恢复上次未发送内容</button>':''}${context?`<div class="composer-context"><span>${icon('bed')} 正在问：${esc(context)}</span><button type="button" data-action="clear-context" aria-label="移除提问对象">${icon('close')}</button></div>`:''}<div class="composer-row"><textarea id="chat-input" name="question" aria-label="输入想问管家的问题" placeholder="问问厨房、停车、入住…" maxlength="1000" rows="1" ${!sessionId||!state.visible||!target.ok?'disabled':''}>${esc(composer.body)}</textarea><button class="send-button" type="submit" aria-label="发送问题" ${!composer.body.trim()||!sessionId||!state.visible||!target.ok?'disabled':''}>${icon('send')}</button></div><p class="composer-note">AI为本地资料匹配演示 · 不确定的事由管家确认</p></form>`;
}
function vr(){
 return `<iframe class="vr-frame" title="第三方VR看房参考案例，非当前民宿" src="${esc(state.published.vrUrl)}" allow="fullscreen; gyroscope; accelerometer" referrerpolicy="no-referrer"></iframe><div class="vr-description"><p class="vr-loading">拖动全景探索空间，首次加载可能需要片刻。若长时间空白，请打开原站。</p><h1>${esc(state.published.vrDescription||'走进空间，感受一间民宿。')}</h1><p>当前使用指定的第三方VR参考案例，非当前民宿实拍。案例中的房间与设施不作为本店资料。</p><a class="btn secondary wide" href="${esc(state.published.vrUrl)}" target="_blank" rel="noopener noreferrer">${icon('external')} 打开VR原站</a><button class="text-btn" data-action="switch-chat">看完了，问问AI管家 ${icon('arrow')}</button><p class="vr-source">来源：途家 · 如视 Realsee<br>仅作体验参考 · 不绑定本店房间</p></div>`;
}
function vrEditor(){
 const d=vrCache||state.draft;
 return `<div class="page-pad"><h1 class="page-title">让客人走进空间。</h1><p class="page-description">维护看房入口和展示说明，随民宿资料发布生效。</p><form id="vr-form"><label class="field">VR入口短句<input name="vrLabel" value="${esc(d.vrLabel||'身临其境，感受空间')}" maxlength="80" required></label><label class="field">VR展示说明<textarea name="vrDescription" maxlength="500" required>${esc(d.vrDescription||'走进空间，感受一间民宿。')}</textarea></label><label class="field">当前VR素材链接<input value="${esc(d.vrUrl)}" readonly><small>沿用已指定的途家／如视第三方参考案例。本轮尚未提供本店真实VR素材。</small></label><p class="notice">素材类型：第三方参考。客人页面持续标明“非当前房源实拍”，此说明不会因编辑短句而隐藏。</p><button class="btn secondary wide" type="submit">保存VR资料草稿</button></form><div style="margin-top:12px">${btn('发布已保存的资料与问答','publish-knowledge','wide',state.draftDirty?'':'disabled')}</div><a class="text-btn" href="${esc(d.vrUrl)}" target="_blank" rel="noopener noreferrer">查看当前VR素材 ${icon('external')}</a></div>`;
}
function merchantShareSection(){
 const owned=Object.entries(workspace.properties).filter(([,p])=>p.merchantId===merchantId),summary=merchantPendingSummary(workspace,merchantId);
 return `<div class="section-title"><h2>我的房源与分享</h2><span class="tag">${owned.length}处房源</span></div><p class="small muted share-intro">把房间或整院的看房页面发给客人，打开就是VR、房源资料和AI管家。</p><div class="share-properties">${owned.map(([pid,p])=>`<section class="share-property"><div class="share-property-heading"><div><h3>${esc(p.state.published.name)}</h3><span class="rental-badge">${p.rentalMode==='pending'?'出租方式待确认':p.rentalMode==='room'?'按间出租':'整院包栋'} · ${p.state.visible?'展示中':'暂停展示'}</span></div><button class="text-btn" data-action="rental-mode" data-property="${pid}">${icon('edit')} 设置</button></div>${p.rentalMode==='pending'?'<p class="notice">房间与出租方式待确认，暂不生成房间或整院分享链接。</p>':''}${shareUnits(workspace,pid).map(u=>`<div class="share-unit"><span class="share-unit-icon">${icon(p.rentalMode==='whole'?'house':'bed')}</span><div><strong>${esc(u.name)}</strong><p>${esc(u.description)}</p><small>VR资料已绑定 · 当前为参考案例</small><div class="share-unit-actions"><button class="text-btn" data-action="preview-unit" data-property="${pid}" data-unit="${u.id}" ${p.state.visible?'':'disabled'}>预览客人页面 ${icon('external')}</button><button class="btn compact secondary" data-action="share-unit" data-property="${pid}" data-unit="${u.id}" ${p.state.visible?'':'disabled'}>分享看房链接</button></div></div></div>`).join('')}${summary.properties.find(x=>x.propertyId===pid)?.pending?`<p class="property-pending"><strong>待处理 ${summary.properties.find(x=>x.propertyId===pid).pending} 条咨询</strong>${pid!==activePropertyId?`<button class="text-btn" data-action="manage-property" data-property="${pid}">进入该房源处理 ${icon('arrow')}</button>`:''}</p>`:''}${pid!==activePropertyId?`<button class="text-btn" data-action="manage-property" data-property="${pid}">管理这处房源 ${icon('arrow')}</button>`:''}</section>`).join('')}</div><p class="share-local-note">可分享默认示例房源供团队查看。资料修改与咨询记录保存在当前浏览器，不跨设备同步；微信分享卡片随后接入。</p>`;
}
function lifeMessages(){return workspace.lifeChats[lifeChatKey(sessionId,currentCity().id,activePropertyId)]||[];}
function handleExtraAction(a,b){
 if(a==='assistant-scope'){saveComposer();saveLifeDraft();go(b.dataset.scope==='local'?'guest/life-chat':'guest/chat');toast('已切换问答范围，另一范围的输入草稿仍保留。');return true;}
 if(a==='restore-chat-draft'){composer=restoreDraft(composer);saveComposer();render();return true;}
 if(a==='restore-life-draft'){const next=restoreDraft({body:lifeDraft,context:lifeContext,previous:lifePrevious});lifeDraft=next.body;lifeContext=next.context;lifePrevious=null;saveLifeDraft();render();return true;}
 if(a==='legacy-life-archive'){const old=Object.entries(workspace.lifeChats||{}).filter(([key])=>key.startsWith(sessionId+':'));showDialog('旧版向导演示存档',`<p class="notice">仅保留本浏览器当前演示身份的历史。早期同城记录未标明房源，不自动归属任何店，也不用于当前回答。</p>${old.length?old.map(([,rows])=>`<details><summary>一组旧版记录</summary>${rows.map(m=>`<p>${esc(m.body)}</p>`).join('')}</details>`).join(''):'<p>当前身份没有旧版向导存档。</p>'}`);return true;}
 if(a==='guide-ask'){goChat(b.dataset.question||'想了解这项入住指引',{kind:b.dataset.kind||'guide',id:b.dataset.id,label:b.dataset.label||'入住指引',propertyId:activePropertyId,unitId:target.unitId||null,version:state.published.version});return true;}
 if(a==='guide-copy-address'||a==='recommendation-copy-address'||a==='copy-recommendation-address'){
  const address=b.dataset.address||'';if(!address){toast('尚无可复制地址，请联系管家');return true;}
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(address).then(()=>toast('地址已复制；地图打不开时可手动粘贴。')).catch(()=>showDialog('手动复制地址',`<label class="field">地址<textarea readonly>${esc(address)}</textarea></label>`));
  else showDialog('手动复制地址',`<label class="field">地址<textarea readonly>${esc(address)}</textarea></label>`);return true;
 }
 if(a==='show-content-library'){go('guest/life-library');return true;}
 if(a==='recommendation-place'||a==='recommendation-route'){go('guest/recommended-'+(a==='recommendation-place'?'place':'route')+'/'+encodeURIComponent(b.dataset.id));return true;}
 if(a==='recommendation-ask'){const c=recommendationContext(b.dataset.kind,b.dataset.id,state.published,lifeScope());if(c)goLifeChat('想了解'+c.label+'，有什么需要注意的？',c);else toast('该推荐暂不可用，请返回重新选择。');return true;}
 if(a==='new-recommendation'||a==='edit-recommendation'){recommendationEdit={kind:b.dataset.kind||'place',id:b.dataset.id||null};go('merchant/recommendations');return true;}
 if(a==='q19-life'){
  const thread=state.threads[b.dataset.thread],message=thread?.messages.find(m=>m.id===b.dataset.message),original=thread?.messages.find(m=>m.id===message?.replyTo);
  if(role()==='guest'&&message?.knowledgeIds?.includes('Q19')&&original)goLifeChat(original.body);
  return true;
 }
 if(a==='content-tab'){if(['places','routes','leads','events'].includes(b.dataset.tab)){contentTab=b.dataset.tab;render();}return true;}
 if(a==='content-more'){contentLimit+=16;render();return true;}
 if(a==='content-reset'){contentQuery='';contentCategory='all';contentLimit=16;render();return true;}
 if(a==='content-place'){go('guest/life-place/'+encodeURIComponent(b.dataset.id));return true;}
 if(a==='content-route'){go('guest/life-route/'+encodeURIComponent(b.dataset.id));return true;}
 if(a==='content-lead'){go('guest/life-lead/'+encodeURIComponent(b.dataset.id));return true;}
 if(a==='content-ask'){
  const context=makeContentContext(b.dataset.kind,b.dataset.id,lifeScope());
  if(context)goLifeChat(context.kind==='route'?'这条路线适合哪些人，有什么需要留意的？':context.kind==='activity-lead'?'这条活动线索是什么，怎么确认当期场次？':'想了解这个地点，有什么需要留意的？',context);
  else toast('未找到当前资料，请返回本地生活重新选择。');
  return true;
 }
 if(a==='clear-life-context'){lifeContext=null;saveLifeDraft();render();$('#life-chat-input')?.focus();return true;}
 if(a==='question-library'){
  const guides=state.published.knowledge.filter(k=>k.kind==='confirmation_guide');
  showDialog('清欢30个常见问题',`<p class="dialog-copy">选择问题后可继续修改，点击发送才会提问。具体店规尚未确认时由管家承接。</p><div class="question-library">${guides.map(k=>`<button class="fact-row" data-action="select-guide" data-knowledge="${esc(k.id)}"><span>${esc(k.question)}</span>${icon('arrow')}</button>`).join('')}</div>`);return true;
 }
 if(a==='select-guide'){
  const guide=state.published.knowledge.find(k=>k.id===b.dataset.knowledge&&k.kind==='confirmation_guide');
  if(guide){closeDialog();goChat(guide.question);}return true;
 }
 if(a==='preview-thread'){
  if(role()!=='merchant'){toast('请从商家端回看咨询。');return true;}
  try{const preview=ticketPreview(workspace,{merchantId,propertyId:activePropertyId,ticketId:b.dataset.ticket});showDialog('客人原会话（只读）',originalConversationMarkup(preview));}catch(e){toast(e.message);}return true;
 }
 if(a==='life-filter'){lifeFilter=b.dataset.filter;render();return true;}
 if(a==='life-prefill'){lifeDraft=b.dataset.question;lifeContext=null;saveLifeDraft();render();$('#life-chat-input')?.focus();return true;}
 if(a==='life-event'){const event=workspace.life.events[b.dataset.event];if(event)showDialog(event.title,eventContent(event));return true;}
 if(a==='life-place'){const p=LIFE_PLACES.find(p=>p.id===b.dataset.place);if(p)showDialog(p.name,`<p class="dialog-copy">${esc(p.text)}\n\n区域：${esc(p.location)}\n\n原型示例，未连接实时商家数据。</p>${btn('问问本地生活AI','dialog-confirm','secondary wide')}`,()=>{lifeDraft=p.category==='food'?'附近有什么好吃的':'半天可以怎么玩';go('guest/life-chat');});return true;}
 if(a==='share-unit'||a==='preview-unit'){
  try{const pid=b.dataset.property,unit=shareUnits(workspace,pid).find(u=>u.id===b.dataset.unit),url=shareUrl(workspace,{merchantId,propertyId:pid,unitId:b.dataset.unit,baseUrl:location.href});
  if(a==='preview-unit'){window.open(url,'_blank','noopener,noreferrer');return true;}
  showDialog('分享：'+unit.name,`<p class="small muted">${esc(unit.kind)} · 打开后直接进入此出租单元的客人页面</p><label class="field">看房演示链接<input id="share-link" value="${esc(url)}" readonly aria-label="看房演示链接"></label><div class="dialog-actions"><a class="btn outline" href="${esc(url)}" target="_blank" rel="noopener noreferrer">预览客户页面</a><button class="btn" data-action="copy-share" data-url="${esc(url)}">复制看房链接</button></div><p id="share-feedback" class="small" role="status" aria-live="polite" style="margin-top:12px"></p><p class="notice">此链接用于团队演示；各设备独立保存资料和咨询，修改不会同步。VR为参考案例，不代表此单元真实拍摄。</p>`);
  }catch(e){toast(e.message);}return true;
 }
 if(a==='copy-share'){
  const feedback=message=>{const el=$('#share-feedback');if(el)el.textContent=message;else toast(message);};
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(b.dataset.url).then(()=>feedback('看房链接已复制。打开后直接进入客户页面。')).catch(()=>{const i=$('#share-link');i?.select();feedback('浏览器不允许自动复制，请手动复制已选中的链接。');});
  else{$('#share-link')?.select();feedback('请复制已选中的看房链接。');}return true;
 }
 if(a==='manage-property'){switchProperty(b.dataset.property,'merchant');return true;}
 if(a==='rental-mode'){if(b.dataset.property!==activePropertyId)switchProperty(b.dataset.property,'merchant');else go('merchant/units');return true;}
 if(a==='sync-events'){
  if(role()!=='platform'){toast('请从平台管理操作。');return true;}const next=structuredClone(workspace);next.life=syncDemo(next.life);next.revision++;
  if(saveWorkspace(next)){render();toast('示例活动已模拟更新，未向小程序获取真实数据。');}return true;
 }
 if(a==='new-event'){go('platform/event-edit');return true;}
 if(a==='edit-event'){go('platform/event-edit/'+b.dataset.event);return true;}
 return false;
}
function handleExtraSubmit(event){
 if(event.target.id==='recommendation-filter'){event.preventDefault();recommendationFilters=Object.fromEntries(new FormData(event.target));render();return true;}
 if(event.target.id==='guide-editor-form'||event.target.id==='recommendation-form'){
  event.preventDefault();if(role()!=='merchant'){toast('请从商家端操作');return true;}
  try{const d=structuredClone(state.draft),data=new FormData(event.target);
   if(event.target.id==='guide-editor-form')d.experience.guide=readGuideForm(data,d.experience.guide,activePropertyId);
   else{const kind=String(data.get('kind')||'place'),key=({place:'places',route:'routes',benefit:'benefits'})[kind];if(!key)throw Error('内容类型无效');const list=d.experience.recommendations[key],previous=list.find(r=>r.id===data.get('id'));const record=readRecommendationForm(data,previous,activePropertyId),index=list.findIndex(r=>r.id===record.id);if(index<0)list.push(record);else list[index]=record;}
   if(mutate({type:'SAVE_DRAFT',draft:d},'merchant')){render();toast('已保存为待确认草稿，尚未发布。');}
  }catch(e){toast(e.message);}return true;
 }

 if(['new-property-form','unit-room-form','unit-space-form','rental-mode-form'].includes(event.target.id)){
  event.preventDefault();if(role()!=='merchant'){toast('请从商家端操作');return true;}
  try{const f=event.target,data=Object.fromEntries(new FormData(f));let next;
   if(f.id==='new-property-form'){data.dataIdentity='测试资料／真实确认待补';data.city={id:data.city,name:({dali:'大理',moganshan:'莫干山',pending:'地区待确认'})[data.city]};next=createProperty(workspace,merchantId,data);if(saveWorkspace(next))switchProperty(next.lastCreatedPropertyId,'merchant');return true;}
   if(f.id==='unit-room-form'){data.facilities=String(data.facilities||'').split(/[，,、]/).map(x=>x.trim()).filter(Boolean);data.enabled=data.enabled!=='false';next=f.dataset.id==='new'?createRoom(workspace,merchantId,activePropertyId,data):saveRoom(workspace,merchantId,activePropertyId,f.dataset.id,data);}
   if(f.id==='unit-space-form'){data.enabled=data.enabled!=='false';next=saveSpace(workspace,merchantId,activePropertyId,f.dataset.id==='new'?null:f.dataset.id,data);}
   if(f.id==='rental-mode-form'){next=setDraftRentalMode(workspace,merchantId,activePropertyId,data.rentalMode);next.properties[activePropertyId].state.draft.wholeCapacity=data.wholeCapacity||'人数待确认';}
   if(saveWorkspace(next)){editorCache=null;go('merchant/units');toast('已保存草稿；确认发布后才对客生效。');}
  }catch(e){toast(e.message);}return true;
 }

 if(event.target.id==='content-search-form'){
  event.preventDefault();const data=new FormData(event.target);contentQuery=String(data.get('query')||'').trim().slice(0,100);contentCategory=String(data.get('category')||'all');contentLimit=16;render();return true;
 }
 if(event.target.id==='life-chat-form'){
  event.preventDefault();const body=lifeDraft.trim();if(!body)return true;
  const context={...(lifeContext||{}),scope:'local',propertyId:activePropertyId,unitId:target.unitId||null,cityId:currentCity().id};
  if(mutate({type:'ASK',body,context},'guest')){const reply=currentThread()?.messages.at(-1);lifeDraft='';lifeContext=reply?.resolvedContext?validLifeObject(reply.resolvedContext):null;saveLifeDraft();render();$('#life-chat-input')?.focus({preventScroll:true});}
  return true;
 }
 if(event.target.id==='event-form'){
  event.preventDefault();if(role()!=='platform'){toast('请从平台管理操作。');return true;}
  try{const data=Object.fromEntries(new FormData(event.target)),next=structuredClone(workspace);data.id=event.target.dataset.event||null;data.cityId='dali';data.start=new Date(data.start).getTime();data.end=new Date(data.end).getTime();next.life=saveEvent(next.life,data);next.revision++;
   if(saveWorkspace(next)){go('platform/activities');toast('活动资料已保存，标记为人工录入、待核验。');}
  }catch(e){toast(e.message);}return true;
 }
 return false;
}
document.addEventListener('change',event=>{
 if(event.target.id==='merchant-select'){const p=Object.entries(workspace.properties).find(([,p])=>p.merchantId===event.target.value);if(p)switchProperty(p[0],role());}
 if(event.target.id==='property-select')switchProperty(event.target.value,role());
});
function ticketCard(t){
 return `<button class="ticket-item" data-action="nav" data-route="merchant/ticket/${t.id}"><span class="ticket-top"><span>客人咨询 · ${time(t.createdAt)}</span><span class="status-tag ${t.status==='replied'?'done':''}">${({pending:'待接手',processing:'处理中',replied:'已回复'})[t.status]}</span></span><h3>${esc(t.question)}</h3><p>${t.context?.label?'关于：'+esc(t.context.label):t.context?.roomId?'关于：'+esc(state.published.rooms.find(r=>r.id===t.context.roomId)?.name||'房间'):t.context?.spaceName?'关于：'+esc(t.context.spaceName):'来自本店AI管家会话'}</p><span class="ticket-bottom"><span>${t.status==='replied'?'查看人工答复':'查看问题并回复'}</span>${icon('arrow')}</span></button>`;
}
function merchantHome(){
 const list=pending(),summary=merchantPendingSummary(workspace,merchantId);return `<div class="merchant-header"><div class="merchant-header-top"><h1>你好，小院管家。</h1><span class="tag">商家演示</span></div><p>${esc(state.published.name)} · 接待工作台</p><div class="merchant-stats"><div><strong>${summary.total}</strong><span>本商家待处理</span></div><div><strong>${Object.values(state.tickets).filter(t=>t.status==='replied').length}</strong><span>本房源已回复</span></div><div><strong>${state.published.knowledge.length}</strong><span>可用问答/指引</span></div></div></div><section class="merchant-section"><div class="section-title" style="margin-top:0"><h2>当前房源待办</h2><button class="text-btn" data-action="nav" data-route="merchant/queue">全部咨询 ${icon('chevron')}</button></div><p class="small muted queue-scope">当前：${esc(state.published.name)} · ${list.length} 条待处理${summary.total>list.length?`；其他房源还有 ${summary.total-list.length} 条，请在下方房源列表处理。`:''}</p>${list.length?list.slice(0,3).map(ticketCard).join(''):`<div class="empty-state">${icon('check')}<h2>当前房源暂无待处理咨询</h2><p>客人在AI对话中点击「请管家确认」后，<br>同一个问题就会出现在这里。</p><button class="text-btn" data-action="try-pets">去客人端试试 ${icon('arrow')}</button></div>`}<div class="section-title"><h2>房源建档</h2></div><div class="home-quick-actions">${btn('新增房源','nav','secondary', 'data-route="merchant/new-property"')}${btn('房间与公共空间','nav','outline','data-route="merchant/units"')}</div>${merchantShareSection()}<div class="section-title"><h2>维护这家民宿</h2></div><div class="merchant-links">${[...(activePropertyId==='qinghuan-dali'?[['service','book','接待处置资料','30问内部动作、责任岗位与确认清单']]:[]),['editor','edit','民宿资料','位置、环境、房间、设施与使用规则'],['knowledge','book','问答知识','高频问题和适合所有客人的公开答复'],['vr','panorama','VR资料','当前使用已指定的第三方参考案例']].map(([r,i,n,d])=>`<button class="merchant-link" data-action="nav" data-route="merchant/${r}">${icon(i)}<span><strong>${n}</strong><small>${d}</small></span>${icon('chevron')}</button>`).join('')}</div><p class="notice">${state.draftDirty?'有尚未发布的资料草稿。客人和AI仍使用当前公开版本。':'公开资料 V'+state.published.version+' 正在使用。保存草稿不会立即影响客人。'}</p></section>`;
}
function queue(){
 const tickets=Object.values(state.tickets).filter(t=>queueFilter==='all'||t.status===queueFilter).sort((a,b)=>b.createdAt-a.createdAt);
 return `<div class="page-pad"><h1 class="page-title">人工咨询</h1><p class="page-description">${esc(state.published.name)} · 当前房源咨询，按原会话回复。其他房源待办可从接待工作台查看。</p><div class="queue-filter">${[['all','全部'],['pending','待接手'],['processing','处理中'],['replied','已回复']].map(([f,l])=>`<button class="${queueFilter===f?'active':''}" data-action="queue-filter" data-filter="${f}">${l}</button>`).join('')}</div>${tickets.length?tickets.map(ticketCard).join(''):'<div class="empty-state"><h2>暂无这一状态的咨询</h2><p>可切换筛选或到客人端发起人工咨询。</p></div>'}</div>`;
}
function ticketDetail(){
 const t=state.tickets[parts()[2]];if(!t)return '<div class="page-pad">咨询不存在，请返回工作台。</div>';
 const a=state.threads[t.threadId]?.messages.find(m=>m.id===t.messageId);
 return `<div class="page-pad"><p class="notice">${esc(state.published.name)} · ${esc(t.context?.label||(t.context?.roomId?state.published.rooms.find(r=>r.id===t.context.roomId)?.name||'原房间':t.context?.unitId==='whole'?'整院包栋':'本房源咨询'))}</p><p class="reply-label">客人的原问题 · ${time(t.createdAt)}</p><div class="reply-question">${esc(t.question)}</div><p class="reply-ai"><strong>AI此前的答复</strong><br>${esc(a?.body||'暂无记录').replace(/\n/g,'<br>')}</p><div class="panel-line"><span>人工处理状态</span><span class="status-tag ${t.status==='replied'?'done':''}">${({pending:'待接手',processing:'处理中',replied:'已回复'})[t.status]}</span></div>${ticketServiceMarkup(activePropertyId,t,state.published.knowledge)}${t.status==='replied'?`<div class="section-title"><h2>已发送的人工答复</h2></div><p class="reply-question">${esc(t.reply.body)}</p><p class="notice">已回到客人的原会话。这条人工答复没有自动成为公开知识。</p>${btn('回客人端看回复','view-reply','secondary wide',`data-ticket="${t.id}"`)}${btn('整理为公开问答','ticket-knowledge','secondary wide',`data-ticket="${t.id}"`)}<button class="text-btn" data-action="preview-thread" data-ticket="${t.id}">查看客人原会话（只读） ${icon('arrow')}</button>`:`${t.status==='pending'?`<div style="margin-top:18px">${btn('接手这条咨询','accept','secondary wide',`data-ticket="${t.id}"`)}</div>`:''}<form id="reply-form" class="reply-form" data-ticket="${t.id}"><label class="field">给这位客人的回复<textarea id="reply-body" name="reply" placeholder="根据实际情况回复这位客人…" maxlength="1000" required></textarea><small>发送后显示为“民宿管家 · 人工回复”，仅进入此会话。</small></label><button class="btn wide" type="submit">发送人工答复 ${icon('arrow')}</button></form>`}</div>`;
}
function editor(){
 const d=editorCache||state.draft;
 return `<div class="page-pad"><h1 class="page-title">把这家店，说清楚。</h1><p class="page-description">客人看到的资料，也是AI回答的依据。</p><p class="version-line">当前公开 V${state.published.version} · ${state.draftDirty?'有已保存、未发布的草稿':'公开资料与已保存草稿一致'}<br>先保存草稿，检查后再发布生效。</p><button class="btn secondary wide" data-action="nav" data-route="merchant/units">新增、编辑房间与公共空间</button><form id="property-form"><label class="field">民宿名称<input name="name" value="${esc(d.name)}" maxlength="40" required></label><label class="field">一句话介绍<input name="subtitle" value="${esc(d.subtitle)}" maxlength="80" required></label><label class="field">位置与地区<input name="location" value="${esc(d.location)}" maxlength="200" required><small>示例使用虚构位置，不提供真实导航。</small></label><label class="field">民宿介绍<textarea name="description" maxlength="1000" required>${esc(d.description)}</textarea></label><div class="editor-group"><h2>设施与使用规则</h2><p class="small muted" style="margin-top:8px">资料不知道的地方可以留空，AI会请管家确认。</p></div>${Object.entries(TOPICS).filter(([k])=>!['price','nearby'].includes(k)).map(([k,t])=>`<label class="field">${t.label}<textarea name="fact-${k}" maxlength="1000" placeholder="未记录时留空，不作保证">${esc(d.facts[k]?.text||'')}</textarea></label>`).join('')}<div class="editor-group"><h2>房间配置</h2></div>${d.rooms.map((r,idx)=>`<div class="editor-group"><h2>${esc(r.name)}</h2>${[['name','房间名称'],['floor','所在楼层'],['area','面积'],['beds','床型'],['capacity','建议入住人数'],['bath','卫浴']].map(([k,l])=>`<label class="field">${l}<input name="room-${idx}-${k}" maxlength="100" value="${esc(r[k])}" required></label>`).join('')}</div>`).join('')}<p class="demo-footnote">这里只影响本次演示资料，不写入旧版原型。</p></form></div>`;
}
function readEditor(){
 const form=$('#property-form');if(!form)return editorCache||structuredClone(state.draft);
 const data=new FormData(form),d=structuredClone(state.draft);
 for(const k of ['name','subtitle','location','description'])d[k]=String(data.get(k)||'').trim();
 for(const k of Object.keys(TOPICS))if(data.has('fact-'+k))d.facts[k]={text:String(data.get('fact-'+k)||'').trim()};
 d.rooms.forEach((r,idx)=>{for(const k of ['name','floor','area','beds','capacity','bath'])r[k]=String(data.get(`room-${idx}-${k}`)||'').trim();});
 return d;
}
function fillEditor(){/* The template reads the cached draft directly. */}
function editorActions(){return `<div class="publish-bar">${btn('保存草稿','save-draft','secondary')}${btn('发布到客人端','publish-editor','')}</div>`;}
function knowledge(){
 const ks=state.draft.knowledge;return `<div class="page-pad"><h1 class="page-title">常问的问题，认真回答。</h1><p class="page-description">适合所有客人的问题和答案，编辑后再公开。</p><p class="version-line">${state.published.profilePending?`接待指引 ${state.published.knowledge.filter(k=>k.requiresHuman!==false&&k.kind==='confirmation_guide').length} 条 · 已确认公开答复 ${state.published.knowledge.filter(k=>k.requiresHuman===false||k.kind!=='confirmation_guide').length} 条`:`已生效 ${state.published.knowledge.length} 条`} · 草稿 ${ks.length} 条${state.draftDirty?' · 有未发布修改':''}</p>${btn(icon('plus')+' 新增公开问答','new-knowledge','secondary wide')}${ks.length?ks.map(k=>`<article class="knowledge-item"><h3>${esc(k.question)}</h3>${k.kind==='confirmation_guide'?`<p class="tag">${esc(k.id)} · ${k.requiresHuman!==false?'接待指引，店规待确认':'商家已确认公开答复'}</p>`:''}<p>${esc(k.text)}</p>${k.aliases.length?`<p>相似问法：${k.aliases.map(esc).join('、')}</p>`:''}<div style="display:flex;justify-content:space-between"><button class="text-btn" data-action="edit-knowledge" data-knowledge="${k.id}">${icon('edit')} 编辑问答</button><button class="text-btn" data-action="delete-knowledge" data-knowledge="${k.id}">删除</button></div></article>`).join(''):`<div class="empty-state">${icon('book')}<h2>还没有额外的公开问答</h2><p>厨房、停车、入住规则已从民宿资料回答。<br>其他高频问题，可从这里添加。</p></div>`}<p class="notice">保存后仍是草稿。明确发布后，AI才会在新提问中使用；历史对话保留原答复。</p>${btn('发布已保存的资料与问答','publish-knowledge','wide',state.draftDirty?'':'disabled')}<button class="text-btn" data-action="nav" data-route="merchant/editor">查看民宿资料草稿 ${icon('arrow')}</button></div>`;
}
function knowledgeEditor(){
 const k=knowledgeCache||{question:'',text:'',aliases:[]};
 return `<div class="page-pad"><h1 class="page-title">整理一条公开问答</h1><p class="page-description">请编辑为适合所有客人阅读的规则，去掉个人信息和单次特殊承诺。</p><form id="knowledge-form"><label class="field">客人会怎么问<input id="knowledge-question" name="question" maxlength="200" value="${esc(k.question)}" placeholder="例如：可以带宠物吗" required></label><label class="field">可以公开的答案<textarea id="knowledge-answer" name="answer" maxlength="1000" required placeholder="请按本店实际规则填写…" style="min-height:170px">${esc(k.text)}</textarea></label><label class="field">其他相似问法<textarea id="knowledge-aliases" name="aliases" placeholder="每行一个，最多5个">${esc((k.aliases||[]).join('\n'))}</textarea><small>本地演示按完整问题或这些问法匹配；不是通用大模型。</small></label><p class="notice warning">厨房、停车等已有使用规则优先。若需调整，请编辑民宿资料中的对应规则。</p>${k.kind==='confirmation_guide'?`<label class="field guide-confirm"><span><input type="checkbox" name="still-needs-confirmation" ${k.requiresHuman!==false?'checked':''}> 答复仍需管家确认</span><small>只有已核实本房源规则、适用条件和对客范围后，才取消勾选。保存后仍须明确发布。</small></label>`:''}<button class="btn wide" type="submit">保存问答草稿</button></form></div>`;
}
function fillKnowledge(){/* The template reads cached public text, never internal ticket identifiers. */}
function platform(){
 return `<div class="page-pad"><h1 class="page-title">支持商家，把服务做好。</h1><p class="page-description">管理入口留在后台，客人从民宿首页直接开始。</p><button class="btn secondary wide" data-action="nav" data-route="platform/activities">${icon('pin')} 大理本地活动管理</button><p class="version-line" style="margin-top:12px">本地生活AI：演示模式 · 真实国内AI接口待接入</p><div class="platform-intro"><h2>${esc(state.published.name)}</h2><p>虚构商家 · 示例房源 songjian-demo<br>展示状态：${state.visible?'对客人展示中':'已暂停展示'}<br>当前公开资料：V${state.published.version}</p></div><div class="support-summary"><div><strong>${Object.keys(state.threads).length}</strong><span>演示咨询会话</span></div><div><strong>${pending().length}</strong><span>待人工处理</span></div></div><div class="panel-line"><div><strong>房源展示</strong><p>${state.visible?'客人可看房和提问。':'客人保留历史，不能发起新咨询。'}</p></div>${btn(state.visible?'暂停展示':'恢复展示','visibility','secondary compact')}</div><div class="panel-line"><div><strong>公开问答</strong><p>${state.published.knowledge.length}条生效 · 草稿${state.draft.knowledge.length}条</p></div><span class="tag">V${state.published.version}</span></div><div class="panel-line"><div><strong>资料草稿</strong><p>${state.draftDirty?'有保存尚未发布的修改':'与当前公开资料一致'}</p></div><button class="text-btn" data-action="nav" data-route="merchant/editor">查看 ${icon('chevron')}</button></div><div class="panel-line"><div><strong>人工服务</strong><p>真实演示操作生成，没有伪造待办。</p></div><button class="text-btn" data-action="nav" data-route="merchant/queue">咨询列表 ${icon('chevron')}</button></div><p class="notice">平台只提供本地演示管理。本次没有接入真实身份、审核团队、模型服务或外部通知。</p>${btn(icon('external')+' 导出演示数据备份','export','outline wide')}<button class="text-btn" data-action="reset">${icon('refresh')} 恢复初始示例</button></div>`;
}

document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b||b.disabled)return;
 const a=b.dataset.action;
 if(handleExtraAction(a,b))return;
 if(a==='close-dialog'){closeDialog();return;}
 if(a==='dialog-confirm'){const f=dialogAction;closeDialog();f?.();return;}
 if(a==='nav'){mobileOpen=false;go(b.dataset.route);return;}
 if(a==='role'){mobileOpen=false;if($('#detail-dialog').open)closeDialog();go(b.dataset.role+'/home');return;}
 if(a==='guest-home'){mobileOpen=false;go('guest/home');return;}
 if(a==='switch-chat'){mobileOpen=false;go('guest/chat');return;}
 if(a==='switch-merchant'){mobileOpen=false;go('merchant/home');return;}
 if(a==='mobile-controls'){mobileOpen=!mobileOpen;render();return;}
 if(a==='about'){
  const controls=mobilePresentation()&&!customerPreview?`<p class="demo-menu-label">切换演示视角</p><nav class="demo-role-menu" aria-label="切换演示视角">${[['guest','客人端','看房与咨询'],['merchant','商家端','接待与分享'],['platform','平台端','资料与活动']].map(([key,label,hint])=>`<button data-action="role" data-role="${key}" class="${role()===key?'active':''}" aria-pressed="${role()===key}"><strong>${label}</strong><small>${hint}</small></button>`).join('')}</nav>${demoSelectors()}<button class="text-btn" data-action="legacy-life-archive">查看本浏览器旧版向导记录</button>`:'';
  showDialog(controls?'演示入口':'关于这个演示',`${controls}<p class="dialog-copy">房源与本地生活为示例内容，VR为第三方参考案例。AI按已公开资料做本地问答演示，尚未连接真实模型。\n\n资料和咨询保存在当前浏览器，各设备独立；尚未接入真实登录与通知。</p>`);return;
 }
 if(a==='try-kitchen'){goChat('厨房能做饭吗');return;}
 if(a==='try-room'){goChat('这间房床有多大',{roomId:guestProperty().rooms[0]?.id});return;}
 if(a==='try-pets'){goChat('可以带宠物吗');return;}
 if(a==='prefill'){composer.body=b.dataset.question;saveComposer();render();$('#chat-input')?.focus();return;}
 if(a==='ask-room'){goChat('这间房的床型和设施是什么？',{roomId:b.dataset.room});return;}
 if(a==='ask-detail'){
  if(page()==='room')goChat('这间房的床型和设施是什么？',{roomId:parts()[2]});
  else{const s=spaceInfo();goChat(s.key==='kitchen'?'厨房能做饭吗':'这里的开放时间是什么？',{spaceName:s.name});}return;
 }
 if(a==='clear-context'){composer.context=null;saveComposer();render();return;}
 if(a==='room-filter'){roomFilter=b.dataset.filter;render();return;}
 if(a==='queue-filter'){queueFilter=b.dataset.filter;render();return;}
 if(a==='fact'){
  const key=b.dataset.key,t=TOPICS[key],text=state.published.facts[key]?.text;
  showDialog(t.label,`<p class="dialog-copy">${esc(text||'本店尚未记录这一规则，请管家确认。')}</p><p class="version-line" style="margin-top:17px">来源：${esc(state.published.name)}公开资料 V${state.published.version}</p>${btn('带着这个问题问管家','dialog-confirm','secondary wide')}`,()=>goChat(({kitchen:'厨房能做饭吗',parking:'怎么停车',checkin:'几点可以入住',environment:'公共区域几点开放'})[key]||'想了解'+t.label));return;
 }
 if(a==='photo'){
  showDialog(b.dataset.label,`<div class="photo-dialog">${photo(b.dataset.scene)}<p class="small muted">AI生成的空间氛围示意，不是房源实拍。</p></div>`);return;
 }

 if(a==='sources'){
  const m=state.threads[b.dataset.thread]?.messages.find(m=>m.id===b.dataset.message);
  if(!m)return;showDialog('这条答复的资料依据',`<p class="small muted">${m.sources[0]?.version!==state.published.version?'资料已有新版本，以下保留当时回答所使用的依据。':'只引用本民宿已公开资料。'}</p>${m.sources.map(s=>`<section class="source-detail"><h3>${esc(s.label)}</h3><p>${esc(s.text)}</p><small>${s.kind==='confirmation_guide'?`${esc(s.sourceLabel||s.label)} · ${esc(s.sourceRange||'')} · ${s.requiresHuman?'接待指引，店规待确认':'商家已确认答复'}`:'本店公开资料'} · V${s.version}</small></section>`).join('')}`);return;
 }
 if(a==='handoff'){
  showDialog('请民宿管家确认',`<p class="dialog-copy">将这条问题和相关空间信息交给本店管家。管家答复后，会显示在当前对话里。\n\n本原型仅生成本地待办，不会发送外部通知。</p><div class="dialog-actions">${btn('暂时不用','close-dialog','outline')}${btn('交给管家','dialog-confirm','')}</div>`,()=>{if(mutate({type:'HANDOFF',threadId:b.dataset.thread,messageId:b.dataset.message},'guest')){render();toast('本机演示已留存，不等于真人已收到。');}});return;
 }
 if(a==='accept'){if(mutate({type:'ACCEPT',ticketId:b.dataset.ticket})){render();toast('已接手，填写实际答复后发送。');}return;}
 if(a==='view-reply'){const t=state.tickets[b.dataset.ticket],thread=state.threads[t?.threadId],unit=t?.context?.unitId||'all',owner=activePropertyId==='legacy'&&unit==='all'?sessionId:sessionId+':'+activePropertyId+':'+unit;if(!thread||thread.owner!==owner){toast('只能从原客人演示身份查看回复；商家可使用只读会话预览。');return;}const u=new URL(location.href);u.searchParams.delete('share');if(unit!=='all')u.searchParams.set('unit',unit);else u.searchParams.delete('unit');u.hash=t.context?.scope==='local'?'/guest/life-chat':'/guest/chat';location.href=u.href;return;}
 if(a==='ticket-knowledge'){
  const t=state.tickets[b.dataset.ticket];knowledgeCache={question:t.question,text:t.reply.body,aliases:[]};go('merchant/knowledge-edit');return;
 }
 if(a==='save-draft'){
  const d=readEditor();editorCache=d;if(mutate({type:'SAVE_DRAFT',draft:d})){editorCache=null;render();toast('草稿已保存，客人端尚未改变。');}return;
 }
 if(a==='publish-editor'){
  const d=readEditor();editorCache=d;
  showDialog('发布民宿资料',`<p class="dialog-copy">发布后，这家民宿的客人页面和AI新答复会使用当前表单资料，以及已经保存的问答草稿。\n\n历史对话保留原答复和当时依据。</p><div class="dialog-actions">${btn('再检查一下','close-dialog','outline')}${btn('确认发布','dialog-confirm','')}</div>`,()=>{
   // One durable write: a failed publication cannot leave a half-saved draft.
   try{const candidate=dispatch(state,{type:'SAVE_DRAFT',draft:d},{role:'merchant',sessionId});const published=dispatch(candidate,{type:'PUBLISH'},{role:'merchant',sessionId});if(saveWorkspace(replaceProperty(workspace,activePropertyId,published))){editorCache=null;render();toast('已发布 V'+state.published.version+'，新咨询会使用新资料。');}}catch(e){toast('未发布：'+e.message+'，表单已保留。');}
  });return;
 }
 if(a==='new-knowledge'){knowledgeCache={question:'',text:'',aliases:[]};go('merchant/knowledge-edit');return;}
 if(a==='edit-knowledge'){knowledgeCache=structuredClone(state.draft.knowledge.find(k=>k.id===b.dataset.knowledge));go('merchant/knowledge-edit');return;}
 if(a==='delete-knowledge'){
  showDialog('从草稿中删除问答',`<p class="dialog-copy">删除后需要再次发布，才会从客人使用的资料中移除。历史对话不会被删除。</p><div class="dialog-actions">${btn('保留','close-dialog','outline')}${btn('删除草稿条目','dialog-confirm','')}</div>`,()=>{if(mutate({type:'DELETE_KNOWLEDGE',knowledgeId:b.dataset.knowledge})){render();toast('已从草稿中删除，发布后生效。');}});return;
 }
 if(a==='publish-knowledge'){
  showDialog('发布本店资料与问答',`<p class="dialog-copy">将发布所有已保存的民宿资料和问答草稿，新的提问使用公开版本 V${state.published.version+1}。\n\n人工会话内容不会自动公开。</p><div class="dialog-actions">${btn('再检查一下','close-dialog','outline')}${btn('确认发布','dialog-confirm','')}</div>`,()=>{if(mutate({type:'PUBLISH'},'merchant')){render();toast('公开资料已更新至 V'+state.published.version);}});return;
 }
 if(a==='vr-settings'){
  showDialog('VR资料',`<p class="dialog-copy">当前素材类型：第三方参考案例\n\n${esc(state.draft.vrUrl)}\n\n来源：途家 / 如视\n\n此案例只演示全景体验，不与当前民宿房间、设施绑定。当前尚未提供本店真实VR素材。</p><a class="btn secondary wide" style="margin-top:20px" href="${esc(state.draft.vrUrl)}" target="_blank" rel="noopener noreferrer">查看指定VR参考 ${icon('external')}</a>`);return;
 }
 if(a==='visibility'){
  const v=!state.visible;showDialog(v?'恢复房源展示':'暂停房源展示',`<p class="dialog-copy">${v?'恢复后，客人可以继续看房和发起咨询。':'暂停后，客人不能查看房源资料或发起新的AI咨询；保留已有会话与人工回复。'}</p><div class="dialog-actions">${btn('取消','close-dialog','outline')}${btn('确认'+(v?'恢复':'暂停'),'dialog-confirm','')}</div>`,()=>{if(mutate({type:'SET_VISIBLE',visible:v})){render();toast(v?'已恢复展示':'已暂停展示');}});return;
 }
 if(a==='export'){
  const blob=new Blob([JSON.stringify(workspace,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='松间小院-演示资料-'+Date.now()+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已生成当前浏览器的演示数据备份。');return;
 }
 if(a==='reset'){
  showDialog('恢复初始示例',`<p class="dialog-copy">这会清除当前房源的演示咨询、人工回复和修改。其他房源与旧版原型数据不受影响。\n\n需要保留当前演示时，请先导出备份。</p><div class="dialog-actions">${btn('保留当前数据','close-dialog','outline')}${btn('确认恢复示例','dialog-confirm','')}</div>`,()=>{try{const defaults=createWorkspace(),next=defaults.properties[activePropertyId]?.state||createSeed();next.propertyId=state.propertyId;next.revision=state.revision+1;if(!saveWorkspace(replaceProperty(workspace,activePropertyId,next)))return;composer={body:'',context:null};editorCache=null;knowledgeCache=null;vrCache=null;replyCache={};saveComposer();render();toast('已恢复初始示例。');}catch{toast('浏览器存储不可用，未清除当前数据。');}});return;
 }
});
document.addEventListener('input',e=>{
 if(e.target.id==='life-chat-input'){lifeDraft=e.target.value;saveLifeDraft();const b=$('#life-chat-form .send-button');if(b)b.disabled=!lifeDraft.trim();}
 if(e.target.id==='chat-input'){composer.body=e.target.value;saveComposer();const send=$('.send-button');if(send)send.disabled=!composer.body.trim()||!state.visible||!sessionId;}
 if(e.target.closest('#property-form'))editorCache=readEditor();
 if(e.target.id==='reply-body')replyCache[parts()[2]]=e.target.value;
 if(e.target.closest('#vr-form')){const f=new FormData($('#vr-form'));vrCache={...structuredClone(state.draft),vrLabel:String(f.get('vrLabel')),vrDescription:String(f.get('vrDescription'))};}
 if(e.target.closest('#knowledge-form')){const f=new FormData($('#knowledge-form'));knowledgeCache={...knowledgeCache,question:String(f.get('question')),text:String(f.get('answer')),aliases:String(f.get('aliases')).split('\n').map(x=>x.trim()).filter(Boolean)};}
});
document.addEventListener('submit',e=>{
 if(handleExtraSubmit(e))return;
 if(e.target.id==='vr-form'){
  e.preventDefault();const f=new FormData(e.target),d={...structuredClone(state.draft),vrLabel:String(f.get('vrLabel')).trim(),vrDescription:String(f.get('vrDescription')).trim()};
  if(mutate({type:'SAVE_DRAFT',draft:d},'merchant')){vrCache=null;render();toast('VR资料草稿已保存，发布后影响客人端。');}return;
 }
 if(e.target.id==='chat-form'){
  e.preventDefault();const body=composer.body.trim();if(!body)return;
  if(mutate({type:'ASK',body,context:composer.context,operation:crypto.randomUUID()},'guest')){composer.body='';saveComposer();render();$('#chat-input')?.focus({preventScroll:true});}return;
 }
 if(e.target.id==='reply-form'){
  e.preventDefault();const ticketId=e.target.dataset.ticket,body=$('#reply-body').value;
  if(mutate({type:'REPLY',ticketId,body},'merchant')){delete replyCache[ticketId];render();toast('人工答复已回到客人原会话。');}return;
 }
 if(e.target.id==='knowledge-form'){
  e.preventDefault();const f=new FormData(e.target);
  if(mutate({type:'SAVE_KNOWLEDGE',knowledgeId:knowledgeCache?.id,...(knowledgeCache?.kind==='confirmation_guide'?{requiresHuman:f.has('still-needs-confirmation')}:{}),question:String(f.get('question')),text:String(f.get('answer')),aliases:String(f.get('aliases')).split('\n').map(x=>x.trim()).filter(Boolean)},'merchant')){knowledgeCache=null;go('merchant/knowledge');toast('问答草稿已保存，发布后才参与AI回答。');}
 }
});
document.addEventListener('keydown',e=>{if(e.target.id==='chat-input'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#chat-form').requestSubmit();}});
$('#detail-dialog').addEventListener('click',e=>{if(e.target===$('#detail-dialog'))closeDialog();});
$('#detail-dialog').addEventListener('cancel',()=>{dialogAction=null;});
window.addEventListener('hashchange',()=>{if($('#detail-dialog').open)closeDialog();render();});
window.addEventListener('storage',e=>{if(e.key===STORAGE&&e.newValue){try{const next=JSON.parse(e.newValue);if(next.schema===2&&next.revision!==workspace.revision){workspace=next;setActive();render();toast('已同步另一窗口的房源与活动更新。');}}catch{toast('另一窗口资料格式异常，保留当前页面。');}}});
if(!location.hash)history.replaceState(null,'',location.pathname+location.search+'#/guest/home');
render();

document.addEventListener('error',event=>{const media=event.target;if(media?.matches?.('video[data-guide-media],img[data-guide-media]')){const id=media.dataset.guideMedia;const fallback=[...document.querySelectorAll('[data-guide-media-fallback]')].find(el=>el.dataset.guideMediaFallback===id);if(fallback){fallback.hidden=false;fallback.textContent='媒体暂不可用，请继续查看下方图文和联系说明。';}}},true);
