import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const reference = new URL('./reviewed-policy.json', import.meta.url);
const normalize = source => source.replace(/\?v=[a-z0-9]+/g, '')
  .replace(/\/\* HK_TERMINAL_PRECHECK_IMPORT_BEGIN \*\/[\s\S]*?\/\* HK_TERMINAL_PRECHECK_IMPORT_END \*\//g, '')
  .replace(/\/\* HK_TERMINAL_PRECHECK_HOOK_BEGIN \*\/[\s\S]*?\/\* HK_TERMINAL_PRECHECK_HOOK_END \*\//g, '');
export async function verifyTerminalResolverPolicy(root) {
  const reviewed = JSON.parse(await readFile(reference, 'utf8')), profiles=[];
  const templates=await Promise.all(['main-import.txt','main-hook.txt'].map(p=>readFile(new URL('./'+p,import.meta.url),'utf8')));
  for(const profile of reviewed.profiles){
    const files=[];
    for (const entry of profile.files) {
      try {
        const source=await readFile(resolve(root, entry.path), 'utf8');let hookVerified=true;
        for(const [i,kind] of ['IMPORT','HOOK'].entries()){
          const expression=new RegExp('/\\* HK_TERMINAL_PRECHECK_'+kind+'_BEGIN \\*/[\\s\\S]*?/\\* HK_TERMINAL_PRECHECK_'+kind+'_END \\*/','g');
          const found=source.replace(/\?v=[a-z0-9]+/g,'').match(expression)??[];
          if(found.length&&!(found.length===1&&found[0]===templates[i].trimEnd()))hookVerified=false;
        }
        const actual = createHash('sha256').update(normalize(source)).digest('hex');
        files.push({...entry, actual, verified: actual === entry.sha256&&hookVerified});
      } catch (error) { files.push({...entry, verified: false, error: error.message}); }
    }
    profiles.push({id:profile.id,files,verified:files.every(f=>f.verified)});
  }
  const match=profiles.find(p=>p.verified);
  return {verified:!!match,policyId:match?reviewed.policyId:null,profileId:match?.id??null,files:match?.files??profiles[0].files,profiles:profiles.map(p=>({id:p.id,verified:p.verified,changed:p.files.filter(f=>!f.verified).map(f=>f.path)}))};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw Error('Pass the checkout to verify (read-only).');
  const result = await verifyTerminalResolverPolicy(process.argv[2]);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.verified) process.exitCode = 1;
}
