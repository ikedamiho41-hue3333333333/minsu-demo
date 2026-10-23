import {experienceOf,publicRecord,safeExternalUrl} from './experience.mjs';
import {guestHandbookMarkup} from './service-ui.mjs';
import {answer} from './model.mjs';
import {GUIDE_PHASES,GUIDE_POINTS,publishedSnapshot,guideOf,publicGuideRecords,guideMapUrl,guestPublishedItem,guideKind,handbookPhase} from './guide.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const source=record=>`<p class="small muted guide-source">来源：${esc(record.sourceLabel||'公开资料')} · 确认：${esc(record.confirmation?.by||'已发布资料')} ${esc(record.confirmation?.at||'')}</p>`;
const ask=(kind,id,question,label)=>`<button type="button" class="text-btn guide-ask" data-action="guide-ask" data-kind="${kind}" data-id="${esc(id)}" data-question="${esc(question)}" data-label="${esc(label)}">带着这个问题咨询</button>`;
const multiline=value=>esc(value).replaceAll('\n','<br>');
function pointMarkup(record,key,label,propertyId,unitId){
 const visible=publicRecord(record,propertyId,unitId),map=visible?guideMapUrl(record,propertyId,unitId):'';
 return `<article class="knowledge-item guide-point" data-guide-point="${key}"><h3>${label}</h3>${visible&&record.address?.trim()?`<p class="guide-address">${esc(record.address)}</p><div class="action-row">${map?`<a class="text-btn" data-guide-navigation="${key}" href="${esc(map)}" target="_blank" rel="noopener noreferrer">打开地图导航</a>`:'<span class="small muted">定位待补，暂不提供导航。</span>'}<button type="button" class="text-btn" data-action="guide-copy-address" data-id="${esc(record.id)}" data-address="${esc(record.address)}">复制${label}地址</button></div>${source(record)}`:'<p class="small muted">此处的公开位置尚待确认，请向管家获取。不会以其他位置代替。</p>'}${ask('arrival',record?.id||key,`请确认${label}与到店走法。`,label)}</article>`;
}
function mediaMarkup(record){
 const href=safeExternalUrl(record.url),caption=record.text||record.title||'图文说明待补充';
 let player='';
 if(href&&record.type==='video')player=`<video class="guide-media" controls preload="none" playsinline data-guide-media="${esc(record.id)}" src="${esc(href)}">当前浏览器无法播放视频，请查看图文说明或联系管家。</video>`;
 else if(href&&record.type==='image')player=`<img class="guide-media" loading="lazy" data-guide-media="${esc(record.id)}" src="${esc(href)}" alt="${esc(record.title||'到店路线参考图')}" />`;
 else if(href&&record.type==='link')player=`<a class="text-btn" href="${esc(href)}" target="_blank" rel="noopener noreferrer" data-guide-external="${esc(record.id)}">打开${esc(record.title||'到店参考资料')} ↗</a>`;
 return `<figure class="knowledge-item guide-media-card"><figcaption><h3>${esc(record.title||'到店图文与视频')}</h3><p>${multiline(caption)}</p></figcaption>${player}<p class="small muted guide-media-fallback" data-guide-media-fallback="${esc(record.id)}">${href?'如视频、图片或外链加载失败，可继续按图文说明查看；仍找不到时使用下方联系出口。':'媒体链接缺失或不可用，请按图文说明查看，或使用下方联系出口。'}</p>${source(record)}</figure>`;
}
function contactMarkup(record,propertyId,unitId){
 const visible=publicRecord(record,propertyId,unitId),href=visible?safeExternalUrl(record.url):'';
 return `<section class="editor-group guide-contact" id="guide-contact"><h2>找不到时，联系管家</h2>${visible&&record.text?.trim()?`<p>${multiline(record.text)}</p>${href?`<a class="text-btn" href="${esc(href)}" target="_blank" rel="noopener noreferrer">打开已确认联系入口 ↗</a>`:''}${source(record)}`:'<p>本店对客联系方式与接待时段待确认。请通过原订单平台已有的商家联系入口联系管家。</p>'}${ask('arrival',record?.id||'contact','我找不到入口，请管家协助确认到店路线。','到店联系')}</section>`;
}
export function arrivalMarkup(snapshot,propertyId,unitId=null){
 const p=publishedSnapshot(snapshot),guide=guideOf(p,propertyId),steps=publicGuideRecords(guide.steps,propertyId,unitId).filter(s=>!s.phase||s.phase==='arrival'),media=publicGuideRecords(guide.media,propertyId,unitId).filter(m=>!m.phase||m.phase==='arrival');
 return `<section class="arrival-guide"><p class="notice">${esc(experienceOf(p,propertyId).dataIdentity)}。先核对入口和停车点，再打开地图；地图无法打开时可复制已公开地址。</p><section class="editor-group"><h2>如何到店</h2><p class="small muted">民宿位置、停车点和实际入口分别核对。</p>${GUIDE_POINTS.map(({id,label})=>pointMarkup(guide.points?.[id],id,label,propertyId,unitId)).join('')}</section><section class="editor-group"><h2>下车后，最后一段路</h2>${steps.length?`<ol class="guide-steps">${steps.map(s=>`<li><h3>${esc(s.title||'到店步骤')}</h3><p>${multiline(s.text)}</p>${source(s)}${ask('arrival',s.id,'请说明这一步：'+(s.title||s.text),'到店指引 · '+(s.title||'操作步骤'))}</li>`).join('')}</ol>`:'<p class="small muted">本店路书图文、地标和夜间提示待补。请向管家核对，不按社区中心点推测房门位置。</p>'}</section><section class="editor-group"><h2>图文和视频</h2>${media.length?media.map(mediaMarkup).join(''):'<p class="notice">暂无已确认的视频或图片。已有文字说明仍可查看；需要带路时请使用下方联系出口。</p>'}</section>${contactMarkup(guide.contact,propertyId,unitId)}</section>`;
}

const factLabels={parking:'停车说明',location:'位置与交通',checkin:'入住与退房',kitchen:'厨房规则',wifi:'网络与设备使用',breakfast:'早餐说明',environment:'公共空间',pets:'宠物规则',accessibility:'通行说明',barbecue:'烧烤规则',price:'费用与订单说明'};
function legacyHandbook(p,propertyId){
 const facts=Object.entries(p.facts??{}).filter(([,item])=>guestPublishedItem(item,propertyId)).map(([key,item])=>({...item,id:`fact:${key}`,question:factLabels[key]||key,phase:handbookPhase(item,key)}));
 const knowledge=(p.knowledge??[]).filter(item=>guestPublishedItem(item,propertyId)).map(item=>({...item,phase:handbookPhase(item)}));
 return GUIDE_PHASES.map(phase=>{const items=[...facts,...knowledge].filter(item=>item.phase===phase.id);return `<section class="editor-group service-phase" data-guide-phase="${phase.id}"><h2>${phase.label}</h2>${items.length?items.map(item=>{const kind=guideKind(item);return `<details class="knowledge-item service-guide"><summary>${esc(item.question)}</summary><p class="tag">${kind.label}</p><p>${multiline(item.text)}</p><p class="small muted">来源：${esc(item.sourceLabel||'本店当前公开资料')} · 公开版 v${esc(p.version??0)}</p>${ask('guide',item.id,item.question,item.question)}</details>`;}).join(''):'<p class="small muted">此阶段暂无本店公开说明，可带问题咨询管家。</p>'}</section>`;}).join('');
}
export function handbookMarkup(propertyId,snapshot){
 const p=publishedSnapshot(snapshot),guide=guideOf(p,propertyId),steps=publicGuideRecords(guide.steps,propertyId),media=publicGuideRecords(guide.media,propertyId);
 let original='';
 if(propertyId==='qinghuan-dali'){
  // Preserve the public question when its answer awaits confirmation, while
  // keeping the unconfirmed answer itself out of the guest collection.
  const knowledge=(p.knowledge??[]).filter(item=>guestPublishedItem({...item,confirmation:undefined,validFrom:null,validUntil:null},propertyId)).map(item=>{
   if(guestPublishedItem(item,propertyId))return {...item};
   return {...item,requiresHuman:true,text:'这道题的本店答复尚待商家确认，请向管家核对。'};
  });
  const facts=Object.fromEntries(Object.entries(p.facts??{}).filter(([,item])=>guestPublishedItem(item,propertyId)));
  const current={...p,facts,knowledge};
  const displayKnowledge=knowledge.map(item=>{
   const response=answer({propertyId,visible:true,published:current},item.question);
   return {...item,text:response.body,requiresHuman:response.status!=='answered'};
  });
  original=guestHandbookMarkup(propertyId,displayKnowledge).replace(/<button class="text-btn service-ask" data-action="select-guide" data-knowledge="(Q\d{2})">[^<]*<\/button>/g,(button,id)=>{const item=displayKnowledge.find(k=>k.id===id);return item?`<p class="tag">${guideKind(item).label}</p>${ask('guide',id,item.question,`${id} · ${item.question}`)}`:'';});
 }else original=legacyHandbook(p,propertyId);
 const extras=GUIDE_PHASES.map(phase=>{
  const phaseSteps=steps.filter(s=>handbookPhase(s)===phase.id),phaseMedia=media.filter(m=>handbookPhase(m)===phase.id);
  if(!phaseSteps.length&&!phaseMedia.length)return '';
  return `<section class="editor-group" data-guide-phase="${phase.id}"><h2>${phase.label} · 本店操作指引</h2>${phaseSteps.map(s=>`<article class="knowledge-item"><h3>${esc(s.title||'操作步骤')}</h3><p>${multiline(s.text)}</p>${source(s)}${ask('guide',s.id,'请说明：'+(s.title||s.text),s.title||'本店操作')}</article>`).join('')}${phaseMedia.map(mediaMarkup).join('')}</section>`;
 }).join('');
 return `<section class="stay-handbook"><p class="notice">入住前、入住中、退房后三阶段查找。规则说明条件，操作查看步骤；服务需求需管家确认，提交咨询不代表已办理。</p><a class="text-btn" href="#/guest/arrival">如何到店与停车 →</a>${original}${extras}</section>`;
}

const input=(prefix,key,label,value,type='text')=>`<label class="field">${label}<input type="${type}" name="${prefix}.${key}" value="${esc(value)}" ${type==='number'?'step="any"':''}/></label>`;
const area=(prefix,key,label,value)=>`<label class="field">${label}<textarea name="${prefix}.${key}" rows="3">${esc(value)}</textarea></label>`;
const select=(prefix,key,label,value,options)=>`<label class="field">${label}<select name="${prefix}.${key}">${options.map(([id,name])=>`<option value="${esc(id)}" ${String(value)===id?'selected':''}>${esc(name)}</option>`).join('')}</select></label>`;
function metadata(prefix,record,p){
 const units=[['','本房源全部单元'],...(p.rentalMode==='whole'?[['whole','整院']]:[]),...(p.rooms??[]).map(room=>[room.id,room.name])];
 return `<details class="guide-record-metadata"><summary>来源、适用范围与有效期 · ${record.confirmation?.status==='confirmed'?'已确认':'待确认'}</summary>${input(prefix,'sourceLabel','资料来源',record.sourceLabel)}${select(prefix,'unitId','适用单元',record.unitId||'',units)}${select(prefix,'visibility','可见范围',record.visibility||'public',[['public','公开访客'],['stay','仅获授权住客（本地原型不展示凭据）'],['internal','仅商家内部']])}${select(prefix,'enabled','启用状态',record.enabled!==false?'true':'false',[['true','启用'],['false','停用']])}${input(prefix,'validFrom','生效日期（可留空）',record.validFrom)}${input(prefix,'validUntil','失效日期（可留空）',record.validUntil)}<p class="small muted">确认人：${esc(record.confirmation?.by||'待确认')}；确认日期：${esc(record.confirmation?.at||'待确认')}。修改内容或范围后须重新确认。</p></details>`;
}
export function guideEditorMarkup(snapshot,propertyId){
 const p=snapshot?.draft??snapshot??{},guide=experienceOf(p,propertyId).guide;
 const steps=[...(guide.steps??[]),{}],media=[...(guide.media??[]),{}];
 return `<form id="guide-editor-form" class="guide-editor"><h2>到店与住店指南</h2><p class="notice">修改仅保存为草稿。确认与发布另行操作，保存不会影响客人当前公开内容。请勿填写真实门锁、门禁或Wi-Fi密码、客人身份及订单资料，只写获授权后的获取方式。</p>${GUIDE_POINTS.map(({id,label})=>{const r=guide.points?.[id]??{},prefix=`point.${id}`;return `<fieldset class="editor-group"><legend>${label}</legend>${input(prefix,'address','公开地址 / 地标',r.address)}${input(prefix,'lat','纬度（无定位可留空）',r.lat,'number')}${input(prefix,'lng','经度（无定位可留空）',r.lng,'number')}${select(prefix,'coordinate','坐标系',r.coordinate||'gaode',[['gaode','高德 GCJ-02'],['wgs84','GPS WGS84']])}${metadata(prefix,r,p)}</fieldset>`;}).join('')}<fieldset class="editor-group"><legend>图文操作步骤</legend><input type="hidden" name="steps.count" value="${steps.length}"/>${steps.map((r,i)=>{const prefix=`step.${i}`;return `<details class="knowledge-item" ${i===steps.length-1?'open':''}><summary>${i===steps.length-1?'新增一条步骤':esc(r.title||`步骤 ${i+1}`)}</summary>${input(prefix,'title','步骤标题',r.title)}${area(prefix,'text','步骤说明（新增留空则不保存）',r.text)}${select(prefix,'phase','入住阶段',r.phase||'arrival',GUIDE_PHASES.map(p=>[p.id,p.label]))}${metadata(prefix,r,p)}</details>`;}).join('')}</fieldset><fieldset class="editor-group"><legend>图片、视频与外链</legend><input type="hidden" name="media.count" value="${media.length}"/>${media.map((r,i)=>{const prefix=`media.${i}`;return `<details class="knowledge-item" ${i===media.length-1?'open':''}><summary>${i===media.length-1?'新增媒体':esc(r.title||`媒体 ${i+1}`)}</summary>${input(prefix,'title','媒体标题',r.title)}${select(prefix,'type','媒体类型',r.type||'video',[['video','视频'],['image','图片'],['link','外部参考链接']])}${input(prefix,'url','公开链接（http/https）',r.url,'url')}${area(prefix,'text','图文 / 加载失败时的说明',r.text)}${select(prefix,'phase','入住阶段',r.phase||'arrival',GUIDE_PHASES.map(p=>[p.id,p.label]))}${metadata(prefix,r,p)}</details>`;}).join('')}</fieldset><fieldset class="editor-group"><legend>迷路与服务联系出口</legend>${area('contact','text','联系获取方式、服务时段及非服务时段说明',guide.contact?.text)}${input('contact','url','获准公开的联系页面链接',guide.contact?.url,'url')}${metadata('contact',guide.contact??{},p)}</fieldset><button type="submit" class="btn wide">保存指南草稿</button><p class="small muted">测试确认不代表真实店方确认。真实联系方式、定位和素材授权缺失时继续保留待补。</p></form>`;
}
