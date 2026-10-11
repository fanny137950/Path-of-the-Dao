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
