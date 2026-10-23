const signature=[137,80,78,71,13,10,26,10];
const crcTable=Uint32Array.from({length:256},(_,value)=>{
 for(let bit=0;bit<8;bit++)value=(value&1)?0xedb88320^(value>>>1):value>>>1;
 return value>>>0;
});
const invalidPng=()=>{throw Error('封面图片无效：仅支持完整且结构有效的PNG图片');};

function crc32(bytes,start,end){
 let crc=0xffffffff;
 for(let i=start;i<end;i++)crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);
 return (crc^0xffffffff)>>>0;
}

// Validate the PNG container, including chunk checksums, without trusting MIME.
// Pixel decoding remains the image renderer's responsibility.
function verifyPng(bytes){
 if(bytes.length<45||signature.some((value,index)=>bytes[index]!==value))invalidPng();
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let offset=8,header=false,palette=false,data=false,dataEnded=false,dataBytes=0,colorType;
 while(offset+12<=bytes.length){
  const length=view.getUint32(offset),end=offset+12+length;
  if(length>0x7fffffff||end>bytes.length)invalidPng();
  const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));
  if(!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type))invalidPng();
  if(!['IHDR','PLTE','IDAT','IEND'].includes(type)&&/^[A-Z]/.test(type))invalidPng();
  if(crc32(bytes,offset+4,end-4)!==view.getUint32(end-4))invalidPng();
  if(!header){
   if(type!=='IHDR'||length!==13)invalidPng();
   const width=view.getUint32(offset+8),height=view.getUint32(offset+12);
   const depth=bytes[offset+16];colorType=bytes[offset+17];
   const depths={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
   if(!width||!height||width>0x7fffffff||height>0x7fffffff||!depths[colorType]?.includes(depth)||bytes[offset+18]!==0||bytes[offset+19]!==0||bytes[offset+20]>1)invalidPng();
   header=true;
  }else if(type==='IHDR')invalidPng();
  if(type==='PLTE'){
   if(palette||data||!length||length>768||length%3||colorType===0||colorType===4)invalidPng();
   palette=true;
  }
  if(type==='IDAT'){
   if(dataEnded||(colorType===3&&!palette))invalidPng();
   data=true;dataBytes+=length;
  }else if(data)dataEnded=true;
  if(type==='IEND'){
   if(length!==0||!dataBytes||end!==bytes.length)invalidPng();
   return;
  }
  offset=end;
 }
 invalidPng();
}

/** Read an HTTP response as verified PNG bytes, normalizing absent/wrong MIME. */
export async function pngCoverBlob(response){
 if(!response?.ok)throw Error(`读取海报封面失败（HTTP ${response?.status??'未知'}）`);
 let buffer;
 try{buffer=await response.arrayBuffer();}
 catch(error){throw Error(`读取海报封面失败：${error?.message||'图片内容读取失败'}`);}
 const bytes=new Uint8Array(buffer);
 verifyPng(bytes);
 return new Blob([bytes],{type:'image/png'});
}
