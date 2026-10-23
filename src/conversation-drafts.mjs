export function selectDraft(draft,body,context){
 const next=structuredClone(draft);
 if(body!==undefined&&body!==next.body){if(next.body?.trim())next.previous={body:next.body,context:structuredClone(next.context)};next.body=body;}
 if(context!==undefined)next.context=structuredClone(context);
 return next;
}
export function restoreDraft(draft){return draft.previous?{...structuredClone(draft),...structuredClone(draft.previous),previous:null}:structuredClone(draft);}
