import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../dist/',import.meta.url),files=[];
for(const folder of ['assets','taxi'])for(const name of await readdir(new URL(folder+'/',root))){
 if(/\.(?:js|css)$/.test(name))files.push(folder+'/'+name);
}
files.sort();
const clean=value=>value.replace(/\?v=[a-f0-9]{12}/g,'');
const hash=createHash('sha256');
for(const file of files)hash.update(file).update(clean(await readFile(new URL(file,root),'utf8')));
for(const data of ['area/area-graph.json.gz','transit/walk-links.json.gz','area/admiralty-block-graph.json.gz','area/station-graph.json.gz','preview/station-model-coverage.json','preview/station-access-alternatives.json','map-detail/admiralty.json'])hash.update(data).update(await readFile(new URL(data,root)));
const version=hash.digest('hex').slice(0,12);
for(const file of files){
 if(!file.endsWith('.js'))continue;
 const url=new URL(file,root),text=clean(await readFile(url,'utf8'));
 const next=text.replace(/(["'])(\.{1,2}\/[^"'\s]+\.js|\/(?:assets|taxi)\/[^"'\s]+\.js)\1/g,(_,quote,path)=>quote+path+'?v='+version+quote)
 .replace(/(["'])(\/area\/(?:area|station|admiralty-block)-graph\.json\.gz|\/preview\/station-(?:model-coverage|access-alternatives)\.json|\/map-detail\/admiralty\.json|\/transit\/walk-links\.json\.gz)\1/g,(_,quote,path)=>quote+path+'?v='+version+quote);
 await writeFile(url,next);
}
for(const file of ['index.html','area.html','metro.html','research.html']){
 const url=new URL(file,root),text=clean(await readFile(url,'utf8'));
 await writeFile(url,text.replace(/(["'])(\/assets\/[^"'\s]+\.(?:js|css))\1/g,(_,quote,path)=>quote+path+'?v='+version+quote));
}
await writeFile(new URL('build-meta.json',root),JSON.stringify({version,builtAt:new Date().toISOString()},null,2)+'\n');
console.log('Runtime cache version:',version);
