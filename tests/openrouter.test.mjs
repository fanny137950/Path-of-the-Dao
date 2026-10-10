import test from 'node:test';
import assert from 'node:assert/strict';
import {connection,generateJSON,testConnection} from '../lib/story/providers.mjs';
const settings={provider:'openrouter',sessionKey:'test-only-key',model:'openrouter/free'};
test('OpenRouter only accepts free model IDs and enforces zero price on requests',async()=>{
 assert.throws(()=>connection({...settings,model:'vendor/paid'}),/免費/);
 const result=await generateJSON(connection(settings),'system',{},async(url,init)=>{
  assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(init.headers.Authorization,'Bearer test-only-key');
  assert(!init.body.includes(settings.sessionKey));
  const body=JSON.parse(init.body);
  assert.deepEqual(body.provider,{require_parameters:true,max_price:{prompt:0,completion:0}});
  assert.equal(body.model,'openrouter/free');assert.equal(body.response_format.type,'json_object');
  return Response.json({choices:[{finish_reason:'stop',message:{content:'{"kind":"continue"}'}}]});
 });
 assert.deepEqual(result,{kind:'continue'});
});
test('generation cannot bypass free-only validation by skipping connection helper',async()=>{
 let calls=0;await assert.rejects(generateJSON({provider:'openrouter',key:'fake',model:'vendor/paid'},'',{},async()=>{calls++;}),/免費/);assert.equal(calls,0);
});
test('key is authenticated before public catalog; only free JSON text models are listed',async()=>{
 const urls=[];
 const result=await testConnection(settings,{},async(url,init)=>{
  urls.push(url);
  if(url.endsWith('/key')){assert.equal(init.headers.Authorization,'Bearer test-only-key');return Response.json({data:{}});}
  assert.equal(init.headers.Authorization,undefined);
  const free={id:'vendor/good:free',pricing:{prompt:'0',completion:'0'},supported_parameters:['response_format'],architecture:{output_modalities:['text']}};
  return Response.json({data:[free,{...free,id:'vendor/paid',pricing:{prompt:'1',completion:'1'}},{...free,id:'vendor/changed:free',pricing:{prompt:'1',completion:'0'}},{...free,id:'vendor/no-json:free',supported_parameters:[]},{...free,id:'vendor/no-price:free',pricing:{}},{...free,id:'vendor/image:free',architecture:{output_modalities:['image']}}]});
 });
 assert.deepEqual(urls,['https://openrouter.ai/api/v1/key','https://openrouter.ai/api/v1/models']);
 assert.deepEqual(result.models,['openrouter/free','vendor/good:free']);assert.equal(result.connected,true);
});
test('public model list cannot make an invalid key appear connected',async()=>{
 let calls=0;await assert.rejects(testConnection(settings,{},async()=>{calls++;return new Response('private',{status:401});}),/401/);assert.equal(calls,1);
});
test('free exhaustion and unavailable models never fall back to paid generation',async()=>{
 for(const status of [402,404,503]){
  let calls=0;await assert.rejects(generateJSON(connection(settings),'',{},async()=>{calls++;return Response.json({error:{message:'private provider text'}},{status});}),e=>/正式回合未提交/.test(e.message)&&!e.message.includes('private provider text'));assert.equal(calls,1);
 }
});
