import test from 'node:test';
import assert from 'node:assert/strict';
import {isNonNarrative,visibleNarrative,requireNarrative} from '../server/narrative.mjs';
import {generateOpenRouterResponse} from '../server/openrouter.mjs';
import {initialV3World,playerWorld,commitV3Turn,gmContext} from '../server/world.mjs';

const args={apiKey:'sk-or-fake',model:'openrouter/free',instructions:'GM',input:'洛河翻開日課冊'};
const ok=(content,finish='stop')=>({ok:true,json:async()=>({
 choices:[{finish_reason:finish,message:{content}}],
 usage:{completion_tokens:1000,completion_tokens_details:{reasoning_tokens:999}},
})});

test('reject output-only safety classifier without rejecting in-world dialogue',()=>{
 for(const text of ['User Safety: safe','User Safety: unsafe','Safety: safe',
  '{"safety":"safe"}','  ','\n<!--GM_STATE:{"changes":[]}-->'])
  assert.equal(isNonNarrative(text),true,text);
 assert.equal(isNonNarrative('韓守一：有人說 User Safety: safe，但那不是修行術語。'),false);
 assert.equal(isNonNarrative('韓守一點頭。\n<!--GM_STATE:{"changes":[]}-->'),false);
 assert.equal(visibleNarrative('韓守一點頭。\n<!--GM_STATE:{"changes":[]}-->'),'韓守一點頭。');
 assert.throws(()=>requireNarrative('User Safety: safe'),/未存檔/);
});

test('OpenRouter retries once after empty 200/content=null and increases output budget',async()=>{
 const requests=[];
 const response=await generateOpenRouterResponse({...args,fetchImpl:async(_url,opts)=>{
  requests.push(JSON.parse(opts.body));
  return requests.length===1?ok(null,'length'):ok('許秋雁指向日課冊。');
 }});
 assert.equal(response.text,'許秋雁指向日課冊。');
 assert.equal(requests.length,2);
 assert.equal(requests[0].max_tokens,2800);
 assert.equal(requests[1].max_tokens,4000);
 assert.deepEqual(requests[0].reasoning,{effort:'low',exclude:true});
 assert.deepEqual(requests[0].provider.max_price,{prompt:0,completion:0,request:0});
 assert.ok(!JSON.stringify(response).includes('sk-or-fake'));
});

test('OpenRouter retries once after status-only output and never returns it as story',async()=>{
 let count=0;
 const result=await generateOpenRouterResponse({...args,fetchImpl:async()=>{
  count++;return count===1?ok('User Safety: safe'):ok('韓守一放下了筆。');
 }});
 assert.equal(count,2);
 assert.equal(result.text,'韓守一放下了筆。');
});

test('two invalid model messages return 502 and do not commit',async()=>{
 let n=0;
 await assert.rejects(generateOpenRouterResponse({...args,fetchImpl:async()=>{
  n++;return ok(n===1?'User Safety: safe':null);
 }}),error=>error.status===502&&/本回合未存檔/.test(error.message));
 assert.equal(n,2);
});

test('429 does not automatically retry expensive/rate-limited request',async()=>{
 let n=0;
 await assert.rejects(generateOpenRouterResponse({...args,fetchImpl:async()=>{
  n++;return {ok:false,status:429};
 }}),error=>error.status===429);
 assert.equal(n,1);
});

test('D1 turn commit refuses classifier-only text without advancing time, memory or progress',()=>{
 const w=initialV3World('invalid-result');
 assert.throws(()=>commitV3Turn(w,'我翻開日課冊','User Safety: safe','bad-turn'),/未存檔/);
 assert.equal(w.events.length,0);
 assert.equal(w.messages.length,1);
 assert.equal(w.revision,0);
 assert.equal(w.npcs.registrar.memories.length,0);
});

test('legacy invalid committed output remains in D1 history but is hidden from player and next GM',()=>{
 const w=initialV3World('legacy-output');
 w.messages.push({role:'user',content:'我想看看日課冊'},{role:'assistant',content:'User Safety: safe'});
 w.events.push({id:'turn:1',requestId:'legacy-request',day:1,minute:490,text:'我想看看日課冊',reply:'User Safety: safe'});
 w.npcs.registrar.memories.push({
  id:'turn:1:registrar',eventId:'turn:1',kind:'親歷',day:1,minute:490,
  importance:1,source:'現場',text:'洛河：我想看看日課冊；當時：User Safety: safe',
 });
 const clean=playerWorld(w);
 assert.match(clean.messages.at(-1).content,/已排除/);
 assert.equal(w.messages.at(-1).content,'User Safety: safe');
 const prompt=gmContext(w,'我再看一下');
 assert.doesNotMatch(prompt,/User Safety: safe/);
 assert.match(prompt,/洛河最新輸入/);
});
