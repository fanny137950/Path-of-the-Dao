import test from 'node:test';
import assert from 'node:assert/strict';
import {initialStory,resolveAction} from '../lib/story/world.mjs';
import {buildSceneContext,applyScene,prepareScene} from '../lib/story/scene.mjs';
import {sceneReferenceIndex,resolveSceneReferences} from '../lib/story/references.mjs';
const draft=refs=>({beats:[{speaker:'shen',text:'你方才說的話，我聽見了。',memoryRefs:refs}],stopReason:'natural'});
test('visible transcript references normalize to recorded events even outside retrieved memory list',()=>{
 const state=resolveAction(initialStory('reference'),{kind:'continue',target:'shen'}).state;
 const transcript=[{id:'reference:m1',event:'reference:e1',speaker:'player',content:'今日想聽師父說話。',audience:['player','shen','yan','jiang','gu']}];
 const context=buildSceneContext(state,'shen',[],transcript);
 assert.equal(context.sharedMemories.length,0);
 applyScene(state,'shen',draft(['reference:m1']),context);
 assert.deepEqual(state.events.find(e=>e.type==='npc-speech').links,['reference:e1']);
});
test('private transcript, invented IDs and authored biography IDs cannot become event citations',()=>{
 const state=resolveAction(initialStory('private-reference'),{kind:'continue',target:'shen'}).state;
 const context=buildSceneContext(state,'shen',[],[{id:'secret-message',event:'secret-event',audience:['gu'],content:'秘密'}]);
 const index=sceneReferenceIndex(context);
 for(const ref of ['secret-message','secret-event','invented','__proto__','shen-teaching-notes'])assert.throws(()=>resolveSceneReferences([ref],index),e=>e.code==='SCENE_MEMORY_REFERENCE');
 assert.deepEqual(resolveSceneReferences([],index),[]);
});
test('one reference correction uses same source context and commits only the corrected scene',async()=>{
 const state=initialStory('repair-reference'),before=JSON.stringify(state);let calls=0,originalInput;
 const result=await prepareScene({state,text:'繼續',target:'shen',generate:async(c,p,input,t,options)=>{
  calls++;assert.equal(JSON.stringify(state),before);
  if(calls===1){originalInput=input;return draft(['invented']);}
  assert.deepEqual(input.context,originalInput.context);assert.deepEqual(input.referenceIndex,originalInput.referenceIndex);
  assert(input.rejectedDraft);assert(options.timeoutMs>0&&options.timeoutMs<=15000);
  return {beats:[{speaker:'shen',text:'先坐下，喝口茶。',memoryRefs:[]}]};
 }});
 assert.equal(calls,2);assert.equal(result.state.revision,1);assert.equal(result.state.lastGeneration.report.referenceRepair,1);
 assert(!result.state.messages.some(m=>m.content==='你方才說的話，我聽見了。'));
});
test('failed correction preserves the original world and does not loop',async()=>{
 const state=initialStory('failed-reference'),before=JSON.stringify(state);let calls=0;
 await assert.rejects(prepareScene({state,text:'繼續',target:'shen',generate:async()=>{calls++;return draft(['invented']);}}),/一次校正仍/);
 assert.equal(calls,2);assert.equal(JSON.stringify(state),before);
});
test('rate limits and other semantic violations are not treated as reference repair',async()=>{
 for(const generate of [async()=>{throw Error('HTTP 429');},async()=>({beats:[{speaker:'player',text:'我答應你。'},{speaker:'shen',text:'好。'}]})]){
  const state=initialStory('no-retry'),before=JSON.stringify(state);let calls=0;
  await assert.rejects(prepareScene({state,text:'繼續',target:'shen',generate:async(...args)=>{calls++;return generate(...args);}}));
  assert.equal(calls,1);assert.equal(JSON.stringify(state),before);
 }
});
