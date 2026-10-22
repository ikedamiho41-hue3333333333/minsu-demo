// Phones use the full viewport; the explicit entry also works on a desktop.
export function isMobilePresentation(search,width){
 return new URLSearchParams(search).get('mobile')==='1'||width<=760;
}
export function propertyUrl(baseUrl,propertyId,role){
 const url=new URL(baseUrl),mobile=url.searchParams.get('mobile')==='1';
 url.search='';
 if(mobile)url.searchParams.set('mobile','1');
 url.searchParams.set('property',propertyId);
 url.hash='/'+role+'/home';
 return url.href;
}
