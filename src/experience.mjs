// Shared v0.5 content contract. Confirmation of test data is not business verification.
export function contentRecord(id,propertyId,values={}){
 return {id,propertyId,unitId:null,sourceLabel:'待补来源',visibility:'public',enabled:true,cancelled:false,validFrom:null,validUntil:null,confirmation:{status:'pending',by:'',at:''},...structuredClone(values)};
}
export function emptyExperience(propertyId){
 return {schema:1,propertyId,dataIdentity:'测试原型／真实资料待确认',confirmation:{status:'pending',by:'',at:''},
  guide:{points:{property:contentRecord('property-location',propertyId,{address:'',lat:null,lng:null}),parking:contentRecord('parking',propertyId,{address:'',lat:null,lng:null}),entrance:contentRecord('entrance',propertyId,{address:'',lat:null,lng:null})},steps:[],media:[],contact:contentRecord('contact',propertyId,{text:'请通过原订单平台已有的商家联系入口联系管家。',url:''})},
  recommendations:{places:[],routes:[],benefits:[]}};
}
export function experienceOf(snapshot,propertyId){return snapshot.experience?.propertyId===propertyId?snapshot.experience:emptyExperience(propertyId);}
export function upgradeExperience(workspace){
 const next=structuredClone(workspace);
 for(const [pid,p] of Object.entries(next.properties))for(const key of ['draft','published'])if(!p.state[key].experience)p.state[key].experience=emptyExperience(pid);
 return next;
}
export function publicRecord(record,propertyId,unitId=null,now=Date.now()){
 if(!record||record.propertyId!==propertyId||record.unitId&&record.unitId!==unitId||record.enabled===false||record.cancelled||record.visibility!=='public')return false;
 if(record.confirmation?.status!=='confirmed'||!record.confirmation.by||!Number.isFinite(Date.parse(record.confirmation.at)))return false;
 if(record.validFrom&&(!Number.isFinite(Date.parse(record.validFrom))||Date.parse(record.validFrom)>now))return false;
 if(record.validUntil&&(!Number.isFinite(Date.parse(record.validUntil))||Date.parse(record.validUntil)<now))return false;
 return true;
}
export function safeExternalUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
export function confirmedPoint(point,propertyId,unitId=null){return publicRecord(point,propertyId,unitId)&&typeof point.lat==='number'&&typeof point.lng==='number'&&Math.abs(point.lat)<=90&&Math.abs(point.lng)<=180&&!!point.address?.trim();}
