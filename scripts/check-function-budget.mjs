import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function checkFunctionBudget(projectRoot=root,limit=12){
 const manifest=JSON.parse(await fs.readFile(path.join(projectRoot,'.next/server/app-paths-manifest.json'),'utf8'));
 const entries=Object.keys(manifest),apis=entries.filter(route=>route.startsWith('/api/'));
 if(apis.length!==1||apis[0]!=='/api/[...path]/route')throw new Error('The build must contain exactly one consolidated API entry point. Run npm run build and remove unrecognised legacy routes.');
 if(entries.length>limit)throw new Error(`Function budget exceeded: ${entries.length} App Router entries, maximum ${limit}. Consolidate routes before deploying.`);
 return {apiEntrypoints:apis.length,appRouterEntries:entries.length,conservativeLimit:limit,entries:entries.sort()};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await checkFunctionBudget(),null,2));
