// NAS 局域网 HTTP 页面使用 getRandomValues 生成演示操作 UUID。
// HTTPS 的原生 randomUUID 保持原样。
if(typeof globalThis.crypto?.randomUUID!=='function'){
 Object.defineProperty(globalThis.crypto,'randomUUID',{
  configurable:true,
  value:function randomUUID(){
   const bytes=new Uint8Array(16);
   globalThis.crypto.getRandomValues(bytes);
   bytes[6]=(bytes[6]&15)|64;
   bytes[8]=(bytes[8]&63)|128;
   const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
   return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
  }
 });
}

