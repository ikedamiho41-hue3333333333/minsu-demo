import test from 'node:test';
import assert from 'node:assert/strict';

test('原咨询预览展示原问题与人工回复，且没有发送或转人工控件',async()=>{
 let view={};try{view=await import('../src/merchant-ui.mjs');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
 const html=view.originalConversationMarkup?.({propertyName:'花溪院',unitName:'整院包栋',thread:{messages:[{role:'guest',body:'可以携宠入住吗？'},{role:'assistant',body:'请管家确认。',sources:[{label:'宠物规则',version:1}]},{role:'merchant',body:'仅回复该客人的人工确认。'}]}})||'';
 assert.match(html,/可以携宠入住吗/);
 assert.match(html,/仅回复该客人的人工确认/);
 assert.match(html,/花溪院/);
 assert.match(html,/只读/);
 assert.doesNotMatch(html,/<form|<textarea|data-action="handoff"|data-action="prefill"/);
});

test('长会话回看先显示所选咨询与答复，其他消息可展开查阅',async()=>{
 const {originalConversationMarkup}=await import('../src/merchant-ui.mjs');
 const html=originalConversationMarkup({propertyName:'清欢',unitName:'本房源咨询',ticket:{messageId:'a2'},thread:{messages:[
  {id:'g1',role:'guest',body:'之前的咨询'}, {id:'a1',role:'assistant',body:'之前的答复',replyTo:'g1'},
  {id:'g2',role:'guest',body:'本次需要回看的问题'}, {id:'a2',role:'assistant',body:'本次的AI答复',replyTo:'g2'},
  {id:'h2',role:'merchant',body:'本次的人工回复',replyTo:'a2'}
 ]}});
 assert.ok(html.indexOf('本次的人工回复')<html.indexOf('之前的咨询'));
 assert.match(html,/<details/);assert.match(html,/其他对话/);
 assert.doesNotMatch(html,/<textarea|data-action="handoff"/);
});
