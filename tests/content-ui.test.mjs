import test from 'node:test';
import assert from 'node:assert/strict';
import {lifeChat,lifeComposer} from '../src/life-ui.mjs';
let ui={},api={};
try{ui=await import('../src/content-ui.mjs');api=await import('../src/content.mjs');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const scope={propertyId:'qinghuan-dali',cityId:'dali',cityName:'大理'};
test('地点目录有八类筛选和搜索，分页不一次铺开全部记录',()=>{
 const html=ui.contentHome?.(scope,{tab:'places',category:'all',query:'',limit:16})||'';
 assert.match(html,/搜索地点/);assert.match(html,/大学周边/);assert.match(html,/五条主题路线/);assert.match(html,/待核验/);
 assert.equal((html.match(/data-action="content-place"/g)||[]).length,16);
 assert.match(html,/content-more/);
});
test('空搜索结果有恢复入口，不显示未经筛选的其他地点',()=>{
 const html=ui.contentHome?.(scope,{tab:'places',query:'不存在的门店XYZ'})||'';
 assert.match(html,/没有找到/);assert.match(html,/content-reset/);assert.doesNotMatch(html,/data-action="content-place"/);
});
test('具体地点详情隐藏原稿报价电话，显示来源及带对象提问入口',()=>{
 const p=api.findPlaces?.({...scope,query:'了巴'})?.[0];assert.ok(p);
 const html=ui.placeContent(p.id,scope);
 assert.match(html,/了巴/);assert.match(html,/content-ask/);assert.match(html,/data-kind="place"/);assert.match(html,/资料出处/);
 assert.match(html,/待确认|待核验/);assert.doesNotMatch(html,/(?:88|98|168|368)\s*元|tel:|weixin:/);
});
test('路线详情可逐站跳转，时间为原稿到达建议，含雨天备选',()=>{
 const c=api.contentFor?.('qinghuan-dali','dali');assert.ok(c);
 const html=ui.routeContent(c.routes[0].id,scope);
 assert.match(html,/寂照庵/);assert.match(html,/云舟/);assert.match(html,/建议到达/);assert.match(html,/集合|发车/);
 assert.match(html,/雨天备选/);assert.match(html,/content-place/);assert.match(html,/data-kind="route"/);
});
test('活动线索不显示报名成功或伪造当期场次，保留不定期记录',()=>{
 const html=ui.contentHome?.(scope,{tab:'leads'})||'';assert.match(html,/凤阳邑/);assert.match(html,/不定期/);
 assert.doesNotMatch(html,/报名成功|已预约|可用活动 9/);assert.match(html,/当期|场次/);
});
test('详情无效ID及其他民宿范围有恢复入口，不显示清欢内容',()=>{
 assert.match(ui.placeContent?.('missing',scope)||'',/未找到|不存在/);
 assert.equal(ui.contentHome({propertyId:'lake-inn',cityId:'dali'}),null);
 assert.doesNotMatch(ui.routeContent('missing',{propertyId:'lake-inn',cityId:'dali'}),/寂照庵|了巴/);
});
test('上下文标签从有效对象取值，伪造标签不能注入HTML，过期对象不显示',()=>{
 const p=api.findPlaces?.({...scope,query:'寂照庵'})?.[0];assert.ok(p);
 const ctx={...api.makeContentContext('place',p.id,scope),label:'<img src=x onerror=alert(1)>'};
 const html=ui.contentContextChip(ctx,scope);assert.match(html,/寂照庵/);assert.match(html,/clear-life-context/);assert.doesNotMatch(html,/<img|onerror/);
 assert.equal(ui.contentContextChip({...ctx,id:'missing'},scope),'');
});
test('清欢本地生活欢迎页区分来源资料问答，历史回复展示真实引用出处',()=>{
 const html=lifeChat({}, {id:'dali',name:'大理'},[{role:'assistant',body:'资料答复',mode:'source_preview',refs:[{label:'了巴空间',source:'五主题.pptx · 第17页',version:'2026-10-23'}]}],scope);
 assert.match(html,/清欢原稿/);assert.match(html,/五主题.pptx/);assert.match(html,/第17页/);assert.match(html,/豆包接口待接入/);
});
test('本地生活输入区显示可移除对象，保留带特殊字符的提问草稿',()=>{
 const html=lifeComposer('多少钱<&', '<div>正在问：了巴空间</div>');
 assert.match(html,/正在问：了巴空间/);assert.match(html,/多少钱&lt;&amp;/);
});
test('客人地点详情不铺内部运营容量或价格版本比对，用简明待确认提示',()=>{
 const html=ui.placeContent('qh-laba-space',scope);
 assert.doesNotMatch(html,/48\/68\/108|20人起|2桌/);
 assert.match(html,/价格|费用/);assert.match(html,/待核验|待确认/);
});
