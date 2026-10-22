import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
let bundler;
try{bundler=await import('rolldown');}
catch(error){
 if(!process.env.MINSU_ROLLDOWN_MODULE)throw error;
 bundler=await import(pathToFileURL(process.env.MINSU_ROLLDOWN_MODULE));
}
const bundle=await bundler.rolldown({input:resolve(root,'src/app.mjs'),platform:'browser',plugins:[{name:'local-module-cache-version',resolveId(source,importer){if(importer&&source.startsWith('./')&&source.includes('?v='))return resolve(dirname(importer),source.split('?')[0]);}}]});
const generated=await bundle.generate({format:'iife'});
await bundle.close();
const code=generated.output.find(x=>x.type==='chunk').code;
const css=await readFile(resolve(root,'src/styles.css'),'utf8');
const compat=await readFile(resolve(root,'scripts/http-compat.js'),'utf8');
const icon=await readFile(resolve(root,'assets/icon.svg'));
const script=(compat+code).replaceAll('assets/icon.svg','data:image/svg+xml;base64,'+icon.toString('base64')).replace(/<\/script/gi,'<\\/script');
const template=await readFile(resolve(root,'scripts/template.html'),'utf8');
const html=template.replace('BUILD_STYLES',()=>css).replace('BUILD_SCRIPT',()=>script);
await writeFile(resolve(root,'index.html'),html);
await mkdir(resolve(root,'output'),{recursive:true});
await writeFile(resolve(root,'output/build.json'),JSON.stringify({builtAt:new Date().toISOString(),bytes:Buffer.byteLength(html),sha256:createHash('sha256').update(html).digest('hex')},null,2)+'\n');
console.log('Built index.html ('+Buffer.byteLength(html)+' bytes)');
