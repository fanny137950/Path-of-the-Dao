import {pathToFileURL} from 'node:url';
import {GAME_RELEASE} from '../v3/release.mjs';

/** Check the deployed revision, allowing bounded propagation time; never accept an old build. */
export async function checkDeployedV3({baseURL='https://wendao-living-world.danew137950.workers.dev',revision,
 fetchImpl=fetch,attempts=8,delayMs=5000,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),log=console.log}={}){
 if(!/^[a-f0-9]{40}$/i.test(revision||''))throw Error('Expected a full Git commit SHA');
 const origin=new URL(baseURL);
 if(!['https:','http:'].includes(origin.protocol)||origin.username||origin.password)throw Error('Invalid deployment URL');
 let reason='';
 for(let attempt=1;attempt<=attempts;attempt++){
  const url=new URL('/api/v3/version',origin);
  url.searchParams.set('build',revision);url.searchParams.set('probe',String(attempt));
  try{
   const response=await fetchImpl(url,{headers:{Accept:'application/json','Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error(`${url.pathname}: HTTP ${response.status}`);
   let version;
   try{version=await response.json();}catch{throw Error(`${url.pathname}: expected JSON, received a different response`);}
   if(version?.release!==GAME_RELEASE||version?.revision!==revision)
    throw Error(`${url.pathname}: deployed release/SHA does not match ${GAME_RELEASE}/${revision.slice(0,7)}`);
   const game=await fetchImpl(new URL('/v3',origin),{redirect:'follow',signal:AbortSignal.timeout(10000)});
   if(!game.ok)throw Error(`/v3: HTTP ${game.status}`);
   log(`Verified /v3 and ${GAME_RELEASE} at ${revision}.`);
   return version;
  }catch(error){
   reason=error instanceof Error?error.message:'Request failed';
   log(`Deployment check ${attempt}/${attempts}: ${reason}`);
   if(attempt<attempts)await wait(delayMs);
  }
 }
 throw Error(`Deployment verification failed at ${origin.origin}: ${reason}. The Worker upload may already have succeeded; this check does not roll back deployment. Check the selected workflow branch, Worker URL and deployment logs.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{await checkDeployedV3({revision:process.env.GITHUB_SHA});}
 catch(error){console.error(error instanceof Error?error.message:'Deployment verification failed');process.exitCode=1;}
}
