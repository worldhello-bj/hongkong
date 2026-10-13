/** Freeze routing assets; reuse data only from an already frozen snapshot, never active dist. */
import {copyFileSync,linkSync,mkdirSync,readdirSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT,runtimeIdentity,digest} from './point-matrix-fixture.mjs';
const arg=name=>process.argv.find(a=>a.startsWith(name+'='))?.slice(name.length+1),source=resolve(arg('--source')??resolve(ROOT,'dist')),outArg=arg('--out'),reuseArg=arg('--reuse');
if(!outArg)throw Error('--out=<new snapshot directory> required');
const out=resolve(outArg),reuse=reuseArg?resolve(reuseArg):null;
if(existsSync(out)||out===source||reuse===source||reuse===resolve(ROOT,'dist'))throw Error('Output must be new, and reuse must be a frozen snapshot distinct from active source/dist.');
const before=runtimeIdentity(source),records=[];mkdirSync(out,{recursive:true});
for(const dir of ['assets','area','transit','taxi']){
 mkdirSync(resolve(out,dir));
 for(const entry of readdirSync(resolve(source,dir),{withFileTypes:true})){
  if(!entry.isFile()||! /\.(js|json|gz)$/.test(entry.name))continue;
  const p=dir+'/'+entry.name,bytes=readFileSync(resolve(source,p)),old=reuse&&resolve(reuse,p);
  // JS always gets its own file so relative module resolution stays in this snapshot.
  const linked=!p.endsWith('.js')&&old&&existsSync(old)&&digest(readFileSync(old))===digest(bytes);
  if(linked)linkSync(old,resolve(out,p));else copyFileSync(resolve(source,p),resolve(out,p));
  records.push({path:p,bytes:bytes.length,method:linked?'hardlink-existing-frozen-data':'copy'});
 }
}
copyFileSync(resolve(source,'build-meta.json'),resolve(out,'build-meta.json'));
const frozen=runtimeIdentity(out),after=runtimeIdentity(source);
if(before.version!==frozen.version||before.signature!==frozen.signature||after.signature!==before.signature||after.version!==before.version)throw Error('Source changed or snapshot differs; do not run this snapshot.');
const report={schema:1,createdAt:new Date().toISOString(),runtime:frozen,source,reuse,records};writeFileSync(resolve(out,'point-freeze.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({out,runtime:frozen.version,signature:frozen.signature,copiedBytes:records.filter(r=>r.method==='copy').reduce((s,r)=>s+r.bytes,0),reusedFrozenBytes:records.filter(r=>r.method!=='copy').reduce((s,r)=>s+r.bytes,0)}));
