import {readdir,readFile,writeFile} from 'node:fs/promises';
const root=new URL('../dist/assets/',import.meta.url);
for(const name of await readdir(root)){
 if(!name.endsWith('.js')||!(name.startsWith('mobile-navigation-')||name.includes('worker-')||name.startsWith('intermodal-routing-')))continue;
 const url=new URL(name,root),before=await readFile(url,'utf8');
 const after=before.replace(/if\(\+\+(\w+)>(?:\w+|1e5)\)return \w+\("SEARCH_LIMIT","开放时间的多到达状态计算超过安全预算；[^"\n]*"\);/g,'++$1;')
 .replace(/if\(\+\+(\w+)>1e5\)throw new Error\("开放时间联程计算超过安全预算；[^"\n]*"\)/g,'++$1');
 if(after!==before){await writeFile(url,after);console.log('Removed expansion budget:',name);}
}
