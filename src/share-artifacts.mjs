import qrcode from './vendor/qrcode.mjs';
import {shareUrl,shareUnits} from './catalog.mjs';

const QUIET_ZONE=4,POSTER_WIDTH=750,POSTER_HEIGHT=1240;
const scenes={courtyard:[0,0],bedroom:[724,0],kitchen:[0,543],living:[724,543]};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function makeMatrix(url){
 const qr=qrcode(0,'M');
 try{qr.addData(url);qr.make();}catch{throw Error('分享链接过长，暂时无法生成二维码，请缩短网址后重试。');}
 const size=qr.getModuleCount();
 return Array.from({length:size},(_,row)=>Array.from({length:size},(_,col)=>qr.isDark(row,col)));
}
function validateMatrix(matrix){
 const count=matrix?.length;
 if(!Array.isArray(matrix)||count<21||count>177||count%4!==1||!matrix.every(row=>Array.isArray(row)&&row.length===count&&row.every(value=>typeof value==='boolean')))throw Error('二维码矩阵格式不正确');
 return count;
}
export function rasterizeQr(matrix,{scale=6,quietZone=QUIET_ZONE}={}){
 const count=validateMatrix(matrix);
 if(!Number.isInteger(scale)||scale<1||scale>32||!Number.isInteger(quietZone)||quietZone<QUIET_ZONE||quietZone>16)throw Error('二维码像素比例或留白范围不正确');
 const width=(count+quietZone*2)*scale,height=width,data=new Uint8ClampedArray(width*height*4).fill(255);
 for(let row=0;row<count;row++)for(let col=0;col<count;col++)if(matrix[row][col]){
  for(let y=0;y<scale;y++)for(let x=0;x<scale;x++){
   const offset=(((row+quietZone)*scale+y)*width+(col+quietZone)*scale+x)*4;
   data[offset]=0;data[offset+1]=0;data[offset+2]=0;
  }
 }
 return {data,width,height};
}
function qrMarkup(matrix,attributes=''){
 const size=matrix.length+QUIET_ZONE*2,commands=[];
 for(let row=0;row<matrix.length;row++)for(let col=0;col<matrix.length;col++)if(matrix[row][col])commands.push(`M${col+QUIET_ZONE} ${row+QUIET_ZONE}h1v1h-1z`);
 return `<svg ${attributes} viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${commands.join('')}" fill="#111"/></svg>`;
}
function linesOf(value,maxUnits,maxLines){
 const chars=Array.from(String(value??'').replace(/\r/g,'')),lines=[];let line='',units=0;
 for(let index=0;index<chars.length;index++){
  const char=chars[index],weight=/[\u0000-\u00ff]/.test(char)?0.56:1;
  if(char==='\n'||units+weight>maxUnits){
   lines.push(line);line='';units=0;
   if(lines.length===maxLines){
    const last=Array.from(lines[maxLines-1]);if(last.length)last.pop();lines[maxLines-1]=last.join('')+'…';return lines;
   }
   if(char==='\n')continue;
  }
  line+=char;units+=weight;
 }
 if(line||!lines.length)lines.push(line);
 return lines.slice(0,maxLines);
}
function svgText(value,{x,y,size=25,lineHeight=36,maxUnits=26,maxLines=1,fill='#31483b',weight=400}={}){
 const lines=linesOf(value,maxUnits,maxLines);
 return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}">${lines.map((line,index)=>`<tspan x="${x}" dy="${index?lineHeight:0}">${esc(line)}</tspan>`).join('')}</text>`;
}
function pngCover(value){
 if(value===undefined||value===null||value==='')return '';
 if(typeof value!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))throw Error('封面仅支持有效的PNG图片数据，请重新加载封面。');
 try{
  const bytes=atob(value.slice('data:image/png;base64,'.length)),signature=[137,80,78,71,13,10,26,10];
  if(bytes.length<24||!signature.every((byte,index)=>bytes.charCodeAt(index)===byte))throw Error('invalid PNG');
 }catch{throw Error('封面PNG数据无效，请重新加载封面。');}
 return value;
}
function poster({name,propertyName,description,location,kind,version,matrix,cover,coverScene}){
 const [cropX,cropY]=scenes[coverScene];
 const image=cover?`<svg x="40" y="40" width="670" height="360" viewBox="${cropX} ${cropY} 724 543" preserveAspectRatio="xMidYMid slice" overflow="hidden"><image href="${esc(cover)}" x="0" y="0" width="1448" height="1086"/></svg><rect x="54" y="350" width="182" height="32" rx="6" fill="#20382d" fill-opacity=".86"/>${svgText('AI示例氛围图',{x:66,y:373,size:19,maxUnits:15,fill:'#fff'})}`:
  `<rect x="40" y="40" width="670" height="360" rx="16" fill="#e8ede2"/>${svgText('封面待补充',{x:250,y:209,size:32,maxUnits:16,fill:'#5e725e'})}${svgText('当前无图片，可扫码查看文字资料',{x:155,y:253,size:22,maxUnits:28,fill:'#6b7c6a'})}`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}" role="img" aria-label="${esc(name)}基础介绍海报"><title>${esc(name)} · 公开资料 V${version}</title><desc>仅展示此出租单元当前公开的基础介绍；图片为示例氛围图，二维码打开对应客人页面。</desc><rect width="750" height="1240" rx="24" fill="#f7f8f2"/><g font-family="system-ui,-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif">${image}${svgText(kind==='整院包栋'?'整院分享 · 卧室不单独出租':propertyName,{x:42,y:447,size:21,maxUnits:31,maxLines:1,fill:'#6d806c'})}${svgText(name,{x:40,y:500,size:38,lineHeight:53,maxUnits:17,maxLines:3,weight:600,fill:'#213d2c'})}${svgText(location,{x:42,y:663,size:23,lineHeight:32,maxUnits:28,maxLines:2,fill:'#63745d'})}<line x1="40" y1="717" x2="710" y2="717" stroke="#d6decf"/>${svgText(description||'详细房源介绍待补充，请扫码查看已公开资料。',{x:42,y:764,size:25,lineHeight:37,maxUnits:26,maxLines:3})}<rect x="40" y="894" width="670" height="284" rx="18" fill="#eaf0e3"/>${svgText('扫码看房，继续问管家',{x:65,y:955,size:28,lineHeight:38,maxUnits:11,maxLines:2,weight:600})}${svgText(kind,{x:65,y:1042,size:23,maxUnits:14,maxLines:1,fill:'#5a7055'})}${svgText('资料与咨询在同一入口',{x:65,y:1081,size:20,maxUnits:16,maxLines:2,fill:'#6d8068'})}${qrMarkup(matrix,'x="438" y="912" width="252" height="252" data-artifact="poster-qr"')}${svgText(`公开资料 V${version} · 以页面当前信息为准`,{x:42,y:1210,size:18,maxUnits:38,fill:'#7a8771'})}</g></svg>`;
}
function filenameOf(name,version){
 const cleaned=Array.from(String(name).replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/\s+/g,' ').replace(/^\.+|\.+$/g,'').trim()).slice(0,55).join('')||'民宿介绍';
 return `${cleaned}-V${version}.png`;
}
export function buildShareArtifact(workspace,{merchantId,propertyId,unitId,baseUrl,coverDataUrl}={}){
 // Validate ownership, published rental mode, generation and visibility through
 // the same canonical URL builder used by preview/copy links.
 const url=shareUrl(workspace,{merchantId,propertyId,unitId,baseUrl});
 if(!['https:','http:'].includes(new URL(url).protocol))throw Error('看房分享链接必须使用HTTP或HTTPS网址。');
 const entry=workspace.properties[propertyId],published=entry.state.published,unit=shareUnits(workspace,propertyId).find(item=>item.id===unitId);
 if(!Number.isInteger(published.version)||published.version<1)throw Error('房源资料尚未发布，不能生成对客海报。');
 const room=entry.rentalMode==='room'?published.rooms.find(item=>item.id===unitId):null;
 const cover=pngCover(coverDataUrl),coverScene=room&&Object.hasOwn(scenes,room.photo)?room.photo:entry.rentalMode==='whole'?'courtyard':'bedroom';
 const matrix=makeMatrix(url),name=unit.name,propertyName=published.name,description=room?.description?.trim()||published.description||'',location=published.location||'';
 const qrSvg=qrMarkup(matrix,`xmlns="http://www.w3.org/2000/svg" width="280" height="280" role="img" aria-label="${esc(name)}的看房二维码"`);
 const posterSvg=poster({name,propertyName,description,location,kind:unit.kind,version:published.version,matrix,cover,coverScene});
 return {url,qrSvg,posterSvg,qrMatrix:matrix,moduleCount:matrix.length,quietZone:QUIET_ZONE,version:published.version,propertyId,unitId,name,propertyName,description,
  filename:filenameOf(name,published.version),posterWidth:POSTER_WIDTH,posterHeight:POSTER_HEIGHT,hasCover:!!cover,coverScene,coverIdentity:cover?'AI示例氛围图':'封面待补充',mimeType:'image/svg+xml'};
}
