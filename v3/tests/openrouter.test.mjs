import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOpenRouterResponse } from '../server/openrouter.mjs';

test('free model uses official endpoint and zero price ceilings',async()=>{
 const result=await generateOpenRouterResponse({
  apiKey:'sk-or-test',instructions:'你是 GM',input:'洛河說你好',model:'openrouter/free',
  fetchImpl:async(url,opts)=>{
   assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');
   assert.equal(opts.headers.Authorization,'Bearer sk-or-test');
   const body=JSON.parse(opts.body);
   assert.equal(body.model,'openrouter/free');
   assert.deepEqual(body.provider.max_price,{prompt:0,completion:0,request:0});
   return {ok:true,json:async()=>({model:'sample/model:free',choices:[{message:{content:'執事抬頭。'}}],usage:{total_tokens:12}})};
  },
 });
 assert.equal(result.text,'執事抬頭。');
 assert.equal(result.usage.totalTokens,12);
 assert.equal(JSON.stringify(result).includes('sk-or-test'),false);
});

test('reject paid or malformed model identifiers',async()=>{
 for(const model of ['anthropic/claude-sonnet-4','openai/gpt-4.1','foo:free','https://evil/a:free'])
  await assert.rejects(generateOpenRouterResponse({apiKey:'x',model,instructions:'GM',input:'你好'}),/只允許/);
});

test('reject missing credentials',async()=>{
 await assert.rejects(generateOpenRouterResponse({apiKey:'',instructions:'GM',input:'你好'}),/Key/);
});

test('report 429 without exposing upstream body',async()=>{
 await assert.rejects(generateOpenRouterResponse({
  apiKey:'sk-or-test',instructions:'GM',input:'你好',
  fetchImpl:async()=>({ok:false,status:429}),
 }),/用量限制/);
});


test('invalid JSON response from free router retries and saves only valid second story',async()=>{
 let attempts=0;
 const result=await generateOpenRouterResponse({
  apiKey:'sk-or-private',instructions:'GM',input:'繼續',
  fetchImpl:async()=>{attempts++;return attempts===1
   ?{ok:true,json:async()=>{throw new SyntaxError('Unexpected token < in HTML')}}
   :{ok:true,json:async()=>({model:'other:free',choices:[{message:{content:'韓守一指了指眼前的測靈石。'}}]})};
  },
 });
 assert.equal(attempts,2);
 assert.equal(result.text,'韓守一指了指眼前的測靈石。');
});

test('two invalid JSON results produce actionable non-leaking error and no text',async()=>{
 let attempts=0;
 await assert.rejects(generateOpenRouterResponse({
  apiKey:'sk-or-private',instructions:'GM',input:'洛河你好',
  fetchImpl:async()=>{attempts++;return {ok:true,json:async()=>{throw Error('contains sk-or-private')}};},
 }),e=>{
  assert.equal(e.status,502);
  assert.match(e.message,/連續兩次.*無法讀取.*未存檔/);
  assert.doesNotMatch(e.message,/sk-or-private/);
  return true;
 });
 assert.equal(attempts,2);
});

test('200 with non-chat object retries, then rejects if still not standard completion',async()=>{
 let attempts=0;
 await assert.rejects(generateOpenRouterResponse({
  apiKey:'sk-or-test',instructions:'GM',input:'你好',
  fetchImpl:async()=>{attempts++;return {ok:true,json:async()=>({error:{message:'upstream bad gateway'}})};},
 }),e=>e.status===502&&/未傳回標準對話資料/.test(e.message));
 assert.equal(attempts,2);
});

test('a malformed first JSON response can recover to text-parts content',async()=>{
 let attempts=0;
 const result=await generateOpenRouterResponse({
  apiKey:'sk-or-test',instructions:'GM',input:'繼續',
  fetchImpl:async()=>{attempts++;return {ok:true,json:async()=>attempts===1?[]:
   ({choices:[{message:{content:[{type:'text',text:'沈滄月合上手中的典籍。'}]}}]})};},
 });
 assert.equal(attempts,2);
 assert.equal(result.text,'沈滄月合上手中的典籍。');
});
