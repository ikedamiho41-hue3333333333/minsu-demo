const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function originalConversationMarkup(preview){
 const all=preview.thread.messages,assistant=all.find(m=>m.id===preview.ticket?.messageId);
 const selected=assistant?all.filter(m=>m.id===assistant.replyTo||m.id===assistant.id||m.replyTo===assistant.id):all;
 const rest=all.filter(m=>!selected.includes(m));
 const render=messages=>messages.map(m=>`<article class="reply-ai"><strong>${({guest:'客人',assistant:'AI管家',merchant:'民宿管家 · 人工回复'})[m.role]||'咨询记录'}</strong><p class="preserve-lines">${esc(m.body)}</p>${m.sources?.length?`<p class="small muted">依据：${m.sources.map(s=>esc(s.label)+' · V'+s.version).join('、')}</p>`:''}</article>`).join('');
 return `<p class="notice">${esc(preview.propertyName)} · ${esc(preview.unitName)}<br>只读回看原客人会话，不切换客人身份。</p><div class="conversation-preview">${render(selected)}${rest.length?`<details><summary>展开原会话其他对话（${rest.length}条）</summary>${render(rest)}</details>`:''}</div>`;
}
