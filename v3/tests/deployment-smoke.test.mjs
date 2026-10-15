import test from 'node:test';
import assert from 'node:assert/strict';
import {checkDeployedV3} from '../../scripts/check-deployed-v3.mjs';
import {standaloneConfig} from '../../scripts/prepare-cloudflare.mjs';
import {GAME_RELEASE} from '../release.mjs';
const revision='a'.repeat(40);
const version=sha=>Response.json({release:GAME_RELEASE,revision:sha});

test('deployment probe waits for missing/old revision, then verifies the actual game path',async()=>{
 let probes=0,waits=0;const urls=[],logs=[];
 const result=await checkDeployedV3({revision,wait:async()=>{waits++},log:s=>logs.push(s),fetchImpl:async url=>{
  urls.push(String(url));if(url.pathname==='/v3')return new Response('game');
  probes++;return probes===1?new Response('missing',{status:404}):probes===2?version('b'.repeat(40)):version(revision);
 }});
 assert.equal(result.revision,revision);assert.equal(waits,2);assert.equal(probes,3);
 assert.match(logs[0],/HTTP 404/);assert.ok(urls.at(-1).endsWith('/v3'));
 assert.ok(new Set(urls.slice(0,-1)).size===3,'each retry bypasses an old cached probe');
});

test('persistent 404 fails explicitly without treating upload as rolled back',async()=>{
 let calls=0;
 await assert.rejects(checkDeployedV3({revision,attempts:2,wait:async()=>{},log:()=>{},fetchImpl:async()=>{calls++;return new Response('',{status:404})}}),/HTTP 404.*upload may already have succeeded/);
 assert.equal(calls,2);
});

test('old build, HTML instead of JSON, and broken game are never successful deployments',async()=>{
 for(const fetchImpl of [async()=>version('b'.repeat(40)),async()=>new Response('<html>login</html>'),async url=>url.pathname==='/v3'?new Response('',{status:500}):version(revision)]){
  await assert.rejects(checkDeployedV3({revision,attempts:1,log:()=>{},fetchImpl}),/Deployment verification failed/);
 }
});

test('standalone API routing reaches the Worker while keeping asset configuration',()=>{
 const config=standaloneConfig({main:'index.js',assets:{directory:'../client',html_handling:'none'}},{local:true,revision});
 assert.deepEqual(config.assets,{directory:'../client',html_handling:'none',run_worker_first:['/api/*']});
 assert.equal(config.vars.GAME_BUILD_SHA,revision);
 assert.equal(config.keep_vars,true);
});
