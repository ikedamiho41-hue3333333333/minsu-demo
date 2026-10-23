export const STORAGE_KEY='minsu-mini-v050';
export const LEGACY_KEY='minsu-mini-v040';
export const LEGACY_V030_KEY='minsu-mini-v030';
export const BACKUP_PREFIX=STORAGE_KEY+':backup:';
export const RECEIPT_PREFIX=STORAGE_KEY+':receipt:';
const sourceKeys=[STORAGE_KEY,LEGACY_KEY,LEGACY_V030_KEY];
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const string=value=>typeof value==='string';
const nonempty=value=>string(value)&&!!value.trim();
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const copy=value=>structuredClone(value);
const fail=message=>{throw Error(message);};
function requireValue(ok,path,message='资料结构不完整'){if(!ok)fail(`${path}：${message}`);}
function strings(value,path){requireValue(Array.isArray(value)&&value.every(string),path,'应为文字列表');}
function dictionary(value,path){requireValue(object(value),path,'应为对象记录');}
function confirmation(value,path){
 dictionary(value,path);requireValue(['pending','confirmed'].includes(value.status),path+'.status','确认状态不受支持');
 for(const key of ['by','at'])if(value[key]!==undefined)requireValue(string(value[key]),path+'.'+key,'应为文字');
}
function contentRecord(record,path,pid){
 dictionary(record,path);requireValue(nonempty(record.id)&&record.propertyId===pid,path,'稳定编号或房源归属不一致');
 requireValue(record.unitId===null||record.unitId===undefined||string(record.unitId),path+'.unitId');
 requireValue(string(record.sourceLabel)&&['public','stay','resident','internal'].includes(record.visibility)&&typeof record.enabled==='boolean',path,'来源、范围或启用状态不完整');
 confirmation(record.confirmation,path+'.confirmation');
 for(const key of ['validFrom','validUntil'])if(record[key]!==undefined&&record[key]!==null)requireValue(string(record[key]),path+'.'+key);
 if(record.cancelled!==undefined)requireValue(typeof record.cancelled==='boolean',path+'.cancelled');
}
function experience(value,path,pid){
 dictionary(value,path);requireValue(value.schema===1&&value.propertyId===pid,path,'内容结构版本或逻辑房源范围不一致');confirmation(value.confirmation,path+'.confirmation');
 dictionary(value.guide,path+'.guide');dictionary(value.guide.points,path+'.guide.points');
 for(const key of ['property','parking','entrance'])contentRecord(value.guide.points[key],path+'.guide.points.'+key,pid);
 for(const key of ['steps','media']){requireValue(Array.isArray(value.guide[key]),path+'.guide.'+key);for(const [i,record]of value.guide[key].entries())contentRecord(record,path+'.guide.'+key+'.'+i,pid);}
 contentRecord(value.guide.contact,path+'.guide.contact',pid);dictionary(value.recommendations,path+'.recommendations');
 for(const key of ['places','routes','benefits']){requireValue(Array.isArray(value.recommendations[key]),path+'.recommendations.'+key);for(const [i,record]of value.recommendations[key].entries())contentRecord(record,path+'.recommendations.'+key+'.'+i,pid);}
}
function snapshot(value,path,{published=false,pid=null}={}){
 dictionary(value,path);
 for(const key of ['name','subtitle','location','description'])requireValue(string(value[key]),path+'.'+key,'应为文字');
 requireValue(nonempty(value.name),path+'.name','名称不可为空');dictionary(value.facts,path+'.facts');
 for(const [key,fact]of Object.entries(value.facts)){dictionary(fact,path+'.facts.'+key);requireValue(string(fact.text),path+'.facts.'+key+'.text');}
 requireValue(Array.isArray(value.rooms),path+'.rooms','应为房间列表');const roomIds=new Set();
 for(const [i,room]of value.rooms.entries()){
  const at=path+'.rooms.'+i;dictionary(room,at);requireValue(nonempty(room.id)&&!roomIds.has(room.id),at+'.id','房间编号缺失或重复');roomIds.add(room.id);
  for(const key of ['name','type','floor','area','beds','capacity','bath'])requireValue(string(room[key]),at+'.'+key,'应为文字');
  strings(room.facilities,at+'.facilities');if(room.enabled!==undefined)requireValue(typeof room.enabled==='boolean',at+'.enabled');
 }
 requireValue(Array.isArray(value.knowledge),path+'.knowledge','应为问答列表');const knowledgeIds=new Set();
 for(const [i,item]of value.knowledge.entries()){
  const at=path+'.knowledge.'+i;dictionary(item,at);requireValue(nonempty(item.id)&&!knowledgeIds.has(item.id),at+'.id','问答编号缺失或重复');knowledgeIds.add(item.id);
  requireValue(string(item.question)&&string(item.text),at,'问题与答复应为文字');strings(item.aliases,at+'.aliases');
  if(item.requiresHuman!==undefined)requireValue(typeof item.requiresHuman==='boolean',at+'.requiresHuman');
 }
 if(value.spaces!==undefined){requireValue(Array.isArray(value.spaces),path+'.spaces');for(const [i,space]of value.spaces.entries())requireValue(object(space)&&nonempty(space.id)&&string(space.name)&&string(space.description),path+'.spaces.'+i);}
 if(value.rentalMode!==undefined)requireValue(['room','whole','pending'].includes(value.rentalMode),path+'.rentalMode');
 if(value.vrUrl!==undefined)requireValue(string(value.vrUrl),path+'.vrUrl');
 if(value.experience!==undefined)experience(value.experience,path+'.experience',pid??value.experience?.propertyId);
 if(published){requireValue(integer(value.version),path+'.version');requireValue(value.publishedAt===null||finite(value.publishedAt),path+'.publishedAt');}
}
function message(value,path,{history=false}={}){
 dictionary(value,path);requireValue(nonempty(value.id)&&['guest','assistant','merchant'].includes(value.role)&&string(value.body),path,'消息编号、身份或正文不完整');
 if(!history||value.at!==undefined)requireValue(finite(value.at),path+'.at','消息时间无效');
 for(const key of ['context','resolvedContext'])if(value[key]!==undefined&&value[key]!==null)dictionary(value[key],path+'.'+key);
 if(value.sources!==undefined){requireValue(Array.isArray(value.sources),path+'.sources');for(const [i,source]of value.sources.entries())requireValue(object(source)&&string(source.label)&&string(source.text)&&(integer(source.version)||string(source.version)),path+'.sources.'+i);}
 if(value.knowledgeIds!==undefined)strings(value.knowledgeIds,path+'.knowledgeIds');
 if(value.refs!==undefined)requireValue(Array.isArray(value.refs)&&value.refs.every(object),path+'.refs');
}
function state(value,path,pid=null){
 dictionary(value,path);requireValue(value.schema===1,path+'.schema','民宿状态版本不受支持');requireValue(integer(value.revision),path+'.revision');requireValue(nonempty(value.propertyId)&&typeof value.visible==='boolean'&&typeof value.draftDirty==='boolean',path,'民宿身份或展示状态不完整');
 snapshot(value.draft,path+'.draft',{pid});snapshot(value.published,path+'.published',{published:true,pid});
 dictionary(value.threads,path+'.threads');dictionary(value.tickets,path+'.tickets');dictionary(value.operations,path+'.operations');
 for(const [id,thread]of Object.entries(value.threads)){
  const at=path+'.threads.'+id;dictionary(thread,at);requireValue(thread.id===id&&thread.propertyId===value.propertyId&&nonempty(thread.owner)&&Array.isArray(thread.messages)&&finite(thread.createdAt),at,'原会话归属、时间或消息不完整');const ids=new Set();
  for(const [i,item]of thread.messages.entries()){message(item,at+'.messages.'+i);requireValue(!ids.has(item.id),at+'.messages.'+i+'.id','消息编号重复');ids.add(item.id);}
 }
 for(const [id,ticket]of Object.entries(value.tickets)){
  const at=path+'.tickets.'+id;dictionary(ticket,at);const thread=value.threads[ticket.threadId];requireValue(ticket.id===id&&['pending','processing','replied'].includes(ticket.status)&&!!thread&&string(ticket.question)&&finite(ticket.createdAt),at,'咨询编号、状态或原会话不完整');
  requireValue(thread.messages.some(item=>item.id===ticket.messageId&&item.role==='assistant'),at+'.messageId','未找到原客人咨询对应答复');
  if(ticket.status==='replied'){message(ticket.reply,at+'.reply');requireValue(ticket.reply.role==='merchant'&&thread.messages.some(item=>item.id===ticket.reply.id),at+'.reply','人工答复未保留在原会话');}
 }
 requireValue(Object.values(value.operations).every(item=>typeof item==='boolean'),path+'.operations','操作去重记录不完整');
}
function workspace(value){
 dictionary(value,'workspace');requireValue(value.schema===2,'workspace.schema','工作区版本不受支持，保留原数据');requireValue(integer(value.revision),'workspace.revision');dictionary(value.properties,'workspace.properties');dictionary(value.merchants,'workspace.merchants');requireValue(Object.keys(value.properties).length>0,'workspace.properties','没有可操作的房源');
 for(const [id,merchant]of Object.entries(value.merchants))requireValue(object(merchant)&&nonempty(merchant.name),'workspace.merchants.'+id,'商家名称不完整');
 for(const [pid,entry]of Object.entries(value.properties)){
  const at='workspace.properties.'+pid;dictionary(entry,at);requireValue(nonempty(entry.merchantId)&&Object.hasOwn(value.merchants,entry.merchantId),at+'.merchantId','商家归属不存在');requireValue(['room','whole','pending'].includes(entry.rentalMode),at+'.rentalMode');requireValue(object(entry.city)&&nonempty(entry.city.id)&&nonempty(entry.city.name),at+'.city');
  if(entry.shareGeneration!==undefined)requireValue(integer(entry.shareGeneration),at+'.shareGeneration');state(entry.state,at+'.state',pid);
 }
 dictionary(value.life,'workspace.life');dictionary(value.life.events,'workspace.life.events');requireValue(integer(value.life.revision)&&finite(value.life.syncedAt)&&string(value.life.feedMode),'workspace.life','周边活动状态不完整');
 for(const [id,event]of Object.entries(value.life.events)){
  const at='workspace.life.events.'+id;requireValue(object(event)&&event.id===id&&nonempty(event.cityId)&&finite(event.start)&&finite(event.end)&&event.end>event.start&&['active','cancelled'].includes(event.status),at,'活动归属、时间或状态不完整');
  for(const key of ['title','location','price','description','sourceName'])requireValue(string(event[key]),at+'.'+key);
 }
 dictionary(value.lifeChats,'workspace.lifeChats');for(const [key,messages]of Object.entries(value.lifeChats)){requireValue(Array.isArray(messages),'workspace.lifeChats.'+key);for(const [i,item]of messages.entries())message(item,'workspace.lifeChats.'+key+'.'+i,{history:true});}
 return value;
}
export function inspectWorkspace(raw){
 try{const value=typeof raw==='string'?JSON.parse(raw):copy(raw);workspace(value);return {ok:true,workspace:value};}
 catch(error){return {ok:false,error:'本地资料无法安全读取：'+error.message};}
}
function preserved(before,after,path='workspace'){
 if(path==='workspace.revision'){requireValue(integer(after)&&after>=before,path,'升级不能回退工作区版本');return;}
 if(Array.isArray(before)){requireValue(Array.isArray(after)&&after.length===before.length,path,'升级改变了已有列表');before.forEach((value,index)=>preserved(value,after[index],path+'.'+index));return;}
 if(object(before)){requireValue(object(after),path,'升级移除了已有资料');for(const [key,value]of Object.entries(before)){requireValue(Object.hasOwn(after,key),path+'.'+key,'升级丢失已有字段');preserved(value,after[key],path+'.'+key);}return;}
 requireValue(Object.is(before,after),path,'升级改变了已有内容，保留原文');
}
function upgraded(value,upgradeWorkspace){
 const next=typeof upgradeWorkspace==='function'?upgradeWorkspace(copy(value)):copy(value),checked=inspectWorkspace(next);if(!checked.ok)fail(checked.error);preserved(value,checked.workspace);return checked.workspace;
}
function read(storage,key){requireValue(storage&&typeof storage.getItem==='function',key,'浏览器存储不可用');const raw=storage.getItem(key);requireValue(raw===null||typeof raw==='string',key,'存储返回值不受支持');return raw;}
function originals(storage){return new Map(sourceKeys.map(key=>[key,read(storage,key)]));}
function problem(error){return error?.name==='QuotaExceededError'?'浏览器存储空间或配额不足，备份及保存未完成，原始资料保持不变。':'本地资料未能保存或读取：'+(error?.message??String(error));}
function blocked(error,raw=null,sourceKey=STORAGE_KEY){return {workspace:null,blocked:true,error:typeof error==='string'?error:problem(error),raw,sourceKey,migrated:false};}
function id(){return globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(16).slice(2)}`;}
function fingerprint(raw){let h=2166136261;for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);}return `${(h>>>0).toString(16)}:${raw.length}`;}
const bytes=raw=>new TextEncoder().encode(raw).length;
function rollback(storage,written){for(const [key,previous]of written.reverse())try{if(previous===null)storage.removeItem(key);else storage.setItem(key,previous);}catch{}}
function transaction(storage,expected,target,operation,sourceKey){
 const operationId=id(),createdAt=new Date().toISOString(),receiptKey=RECEIPT_PREFIX+operationId,backupKeys=[],stages=[];
 for(const [key,raw]of expected)if(raw!==null){
  const backupKey=BACKUP_PREFIX+operationId+':'+key;
  requireValue(read(storage,backupKey)===null,backupKey,'备份编号冲突，请重新尝试');backupKeys.push(backupKey);
  stages.push([backupKey,JSON.stringify({schema:1,key:backupKey,sourceKey:key,raw,createdAt,operation,receiptKey,bytes:bytes(raw)})]);
 }
 const receipt={schema:1,id:operationId,key:receiptKey,operation,createdAt,sourceKey,targetKey:STORAGE_KEY,targetRevision:target.revision,targetFingerprint:fingerprint(JSON.stringify(target)),backupKeys};
 stages.push([receiptKey,JSON.stringify(receipt)]);const written=[];const targetRaw=JSON.stringify(target),before=expected.get(STORAGE_KEY);let targetAttempted=false;
 try{
  for(const [key,value]of stages){const previous=read(storage,key);requireValue(previous===null,key,'备份或回执编号已存在');storage.setItem(key,value);written.push([key,previous]);}
  for(const [key,raw]of expected)requireValue(read(storage,key)===raw,key,'另一窗口更新了资料，未覆盖新版本，请重新读取');
  targetAttempted=true;storage.setItem(STORAGE_KEY,targetRaw);requireValue(read(storage,STORAGE_KEY)===targetRaw,STORAGE_KEY,'保存后回读与目标内容不一致');
  return {...receipt,verified:true};
 }catch(error){
  // Native localStorage.setItem is atomic on quota errors. This additional
  // guarded rollback also covers storage adapters that fail after a write.
  try{const actual=read(storage,STORAGE_KEY);if(targetAttempted&&(actual===targetRaw||!inspectWorkspace(actual).ok)){if(before===null)storage.removeItem(STORAGE_KEY);else storage.setItem(STORAGE_KEY,before);}}catch{}
  rollback(storage,written);throw error;
 }
}
function createIndependent(createWorkspace){requireValue(typeof createWorkspace==='function','createWorkspace','缺少独立示例创建方法');const next=createWorkspace(),checked=inspectWorkspace(next);if(!checked.ok)fail(checked.error);return checked.workspace;}
export function loadWorkspaceStorage(storage,{createWorkspace,upgradeWorkspace}={}){
 let sourceKey=STORAGE_KEY,raw=null;
 try{
  const expected=originals(storage);raw=expected.get(STORAGE_KEY);
  if(raw!==null){
   const checked=inspectWorkspace(raw);if(!checked.ok)return blocked(checked.error,raw,sourceKey);
   const next=upgraded(checked.workspace,upgradeWorkspace);
   if(JSON.stringify(next)===JSON.stringify(checked.workspace))return {workspace:next,blocked:false,error:'',raw,sourceKey,migrated:false};
   const receipt=transaction(storage,expected,next,'upgrade-current',sourceKey);return {workspace:next,blocked:false,error:'',raw,sourceKey,migrated:true,receipt};
  }
  sourceKey=expected.get(LEGACY_KEY)!==null?LEGACY_KEY:expected.get(LEGACY_V030_KEY)!==null?LEGACY_V030_KEY:null;
  if(sourceKey){
   raw=expected.get(sourceKey);let value;
   if(sourceKey===LEGACY_V030_KEY){
    const parsed=JSON.parse(raw);
    if(parsed?.schema===1){state(parsed,'legacy-v030');requireValue(typeof createWorkspace==='function','createWorkspace','缺少旧版资料兼容方法');value=createWorkspace(copy(parsed));const checked=inspectWorkspace(value);if(!checked.ok)fail(checked.error);requireValue(!!checked.workspace.properties.legacy,'legacy','升级未保留旧版房源');preserved(parsed,checked.workspace.properties.legacy.state,'legacy-state');value=checked.workspace;}
    else {const checked=inspectWorkspace(raw);if(!checked.ok)return blocked(checked.error,raw,sourceKey);value=checked.workspace;}
   }else {const checked=inspectWorkspace(raw);if(!checked.ok)return blocked(checked.error,raw,sourceKey);value=checked.workspace;}
   const next=upgraded(value,upgradeWorkspace),receipt=transaction(storage,expected,next,'migration',sourceKey);return {workspace:next,blocked:false,error:'',raw,sourceKey,migrated:true,receipt};
  }
  const next=upgraded(createIndependent(createWorkspace),upgradeWorkspace),receipt=transaction(storage,expected,next,'initialize',null);return {workspace:next,blocked:false,error:'',raw:JSON.stringify(next),sourceKey:STORAGE_KEY,migrated:false,receipt};
 }catch(error){return blocked(error,raw,sourceKey??STORAGE_KEY);}
}
export function saveWorkspaceStorage(storage,next,{expectedRevision}={}){
 let raw=null,targetRaw=null,writeAttempted=false;
 try{
  raw=read(storage,STORAGE_KEY);if(raw===null)return {...blocked('尚未初始化独立v0.5工作区，请先重新读取资料。',null,STORAGE_KEY),ok:false};
  const current=inspectWorkspace(raw);if(!current.ok)return {...blocked(current.error,raw,STORAGE_KEY),ok:false};
  if(!integer(expectedRevision))return {ok:false,workspace:current.workspace,blocked:false,error:'缺少有效的预期版本，未保存本次操作。',raw,sourceKey:STORAGE_KEY,migrated:false};
  if(current.workspace.revision!==expectedRevision)return {ok:false,workspace:current.workspace,blocked:false,error:'另一窗口更新了资料，未覆盖新版本；请检查后重试，输入仍应保留。',raw,sourceKey:STORAGE_KEY,migrated:false,conflict:true};
  const checked=inspectWorkspace(next);if(!checked.ok)return {ok:false,workspace:current.workspace,blocked:false,error:checked.error,raw,sourceKey:STORAGE_KEY,migrated:false};
  const serialized=JSON.stringify(checked.workspace),same=serialized===JSON.stringify(current.workspace);
  if(same)return {ok:true,workspace:checked.workspace,blocked:false,error:'',raw,sourceKey:STORAGE_KEY,migrated:false};
  if(checked.workspace.revision<=expectedRevision)return {ok:false,workspace:current.workspace,blocked:false,error:'资料有变化但工作区版本未递增，未保存。',raw,sourceKey:STORAGE_KEY,migrated:false};
  const latestRaw=read(storage,STORAGE_KEY);
  if(latestRaw!==raw){
   const latest=inspectWorkspace(latestRaw);
   if(!latest.ok)return {...blocked(latest.error,latestRaw,STORAGE_KEY),ok:false};
   return {ok:false,workspace:latest.workspace,blocked:false,error:'另一窗口刚更新资料，请重新读取后重试。',raw:latestRaw,sourceKey:STORAGE_KEY,migrated:false,conflict:true};
  }
  targetRaw=serialized;writeAttempted=true;storage.setItem(STORAGE_KEY,serialized);requireValue(read(storage,STORAGE_KEY)===serialized,STORAGE_KEY,'保存后回读不一致');return {ok:true,workspace:checked.workspace,blocked:false,error:'',raw:serialized,sourceKey:STORAGE_KEY,migrated:false};
 }catch(error){
  if(writeAttempted&&raw!==null)try{
   const actual=read(storage,STORAGE_KEY);
   // A different valid snapshot may be another window's update; preserve it.
   if(actual===targetRaw||!inspectWorkspace(actual).ok)storage.setItem(STORAGE_KEY,raw);
  }catch{}
  return {...blocked(error,raw,STORAGE_KEY),ok:false};
 }
}
export function recoverWorkspaceStorage(storage,raw,{createWorkspace,upgradeWorkspace}={}){
 let originalsBefore=null;
 try{
  const value=raw===null?createIndependent(createWorkspace):(()=>{const checked=inspectWorkspace(raw);if(!checked.ok)fail(checked.error);return checked.workspace;})();
  const next=upgraded(value,upgradeWorkspace);originalsBefore=originals(storage);
  const receipt=transaction(storage,originalsBefore,next,raw===null?'recovery-new-sample':'recovery-import',raw===null?null:'import');return {workspace:next,blocked:false,error:'',raw:JSON.stringify(next),sourceKey:STORAGE_KEY,migrated:false,receipt};
 }catch(error){
  let preservedRaw=null,preservedKey=STORAGE_KEY;
  for(const key of sourceKeys)try{
   const value=originalsBefore?.has(key)?originalsBefore.get(key):read(storage,key);
   if(value!==null){preservedRaw=value;preservedKey=key;break;}
  }catch{}
  return blocked(error,preservedRaw,preservedKey);
 }
}
export function listWorkspaceBackups(storage){
 try{
  const result=[];for(let i=0;i<storage.length;i++){
   const key=storage.key(i);if(typeof key!=='string'||!key.startsWith(BACKUP_PREFIX))continue;const backup=readWorkspaceBackup(storage,key);if(backup.ok)result.push({key,sourceKey:backup.sourceKey,createdAt:backup.createdAt,operation:backup.operation,bytes:backup.bytes,receiptKey:backup.receiptKey});
  }
  return result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.key.localeCompare(a.key));
 }catch{return [];}
}
export function readWorkspaceBackup(storage,key){
 try{
  requireValue(typeof key==='string'&&key.startsWith(BACKUP_PREFIX),'backup','不是本工作区的备份编号');const raw=read(storage,key);requireValue(raw!==null,'backup','备份不存在');const value=JSON.parse(raw);requireValue(value.schema===1&&typeof value.raw==='string'&&sourceKeys.includes(value.sourceKey),'backup','备份结构不完整');return {ok:true,...value};
 }catch(error){return {ok:false,error:problem(error)};}
}
