import test from 'node:test';
import assert from 'node:assert/strict';
import {initialStory,resolveAction} from '../lib/story/world.mjs';
import {prepareScene,buildSceneContext,applyScene} from '../lib/story/scene.mjs';
import {historyFor} from '../lib/story/performance.mjs';
import {developerView} from '../lib/story/developer.mjs';
const root=historyFor('shen')[0];
const detail='那次改寫筆記，桌邊的半盞茶放涼了。';
const draft=()=>({beats:[{speaker:'shen',text:detail,memoryRefs:['tea-detail'],memoryAddition:{id:'tea-detail',rootId:root.id,kind:'sensory',detail}}]});
test('small rooted memory is reviewed, persisted with provenance and available next turn',async()=>{
 const state=initialStory('memory-addition'),truth=JSON.stringify(state.truth),roots=JSON.stringify(historyFor('shen'));let calls=0;
 const result=await prepareScene({state,text:'繼續',target:'shen',generate:async(c,p,input)=>{
  calls++;
  if(calls===1)return draft();
  assert.equal(input.actors[0].roots[0].id,root.id);
  assert.equal(input.additions[0].spokenText,detail);
  return {approved:input.additions.map(m=>m.id)};
 }});
 assert.equal(calls,2);assert.equal(JSON.stringify(result.state.truth),truth);assert.equal(JSON.stringify(historyFor('shen')),roots);
 const memory=result.state.supplementalMemories[0];assert.equal(memory.rootId,root.id);assert.equal(memory.detail,detail);assert(memory.event&&memory.message);
 assert(result.state.events.some(e=>e.type==='supplemental-memory'&&e.changes.rootId===root.id));
 const next=resolveAction(JSON.parse(JSON.stringify(result.state)),{kind:'continue',target:'shen'}).state;
 const context=buildSceneContext(next,'shen');assert(context.actors.find(a=>a.id==='shen').history.some(h=>h.id===memory.id));
 applyScene(next,'shen',{beats:[{speaker:'shen',text:'就是那半盞涼茶。',historyRefs:[memory.id]}]},context);
 assert.equal(next.supplementalMemories.length,1);
 assert(developerView(next).characters.find(c=>c.id==='shen').history.some(h=>h.rootId===root.id));
 assert.equal(initialStory('other-world').supplementalMemories,undefined);
});
test('contradiction rejected by consistency review leaves root and world unchanged',async()=>{
 const state=initialStory('root-conflict'),before=JSON.stringify(state);let calls=0;
 await assert.rejects(prepareScene({state,text:'繼續',target:'shen',generate:async()=>{calls++;return calls===1?draft():{approved:[]};}}),/不相容/);
 assert.equal(calls,2);assert.equal(JSON.stringify(state),before);
});
test('major additions and invented roots cannot be admitted as minor memories',()=>{
 const state=resolveAction(initialStory('major'),{kind:'continue',target:'shen'}).state;
 for(const change of [{rootId:'invented'},{detail:'那一次我突破了境界。'},{detail:'洛河那時已經在旁邊。'}]){
  const out=draft();Object.assign(out.beats[0].memoryAddition,change);out.beats[0].text=out.beats[0].memoryAddition.detail;
  assert.throws(()=>applyScene(state,'shen',out,buildSceneContext(state,'shen')));
 }
 assert.equal(state.supplementalMemories,undefined);
});
test('memory after a player decision boundary is neither reviewed nor saved',async()=>{
 let calls=0;
 const result=await prepareScene({state:initialStory('boundary'),text:'繼續',target:'shen',generate:async()=>{
  calls++;return {beats:[{speaker:'shen',text:'你想先聽哪一件？',turnToPlayer:true},draft().beats[0]]};
 }});
 assert.equal(calls,1);assert.equal(result.state.supplementalMemories,undefined);
});
test('fixed biography IDs in the event reference field are mapped to history without another call',async()=>{
 let calls=0;
 const result=await prepareScene({state:initialStory('history-ref'),text:'繼續',target:'shen',generate:async()=>{
  calls++;return {beats:[{speaker:'shen',text:'授課筆記裡，有些步驟我曾拆開重寫。',memoryRefs:[root.id]}]};
 }});
 assert.equal(calls,1);assert.deepEqual(result.state.messages.findLast(m=>m.speaker==='shen').performance.historyRefs,[root.id]);
});
test('rootless reference can be corrected into a rooted addition, not discarded',async()=>{
 let calls=0;
 const result=await prepareScene({state:initialStory('convert'),text:'繼續',target:'shen',generate:async(c,p,input)=>{
  calls++;if(calls===1)return {beats:[{speaker:'shen',text:detail,memoryRefs:['tea-detail']}]};
  if(calls===2)return draft();
  return {approved:input.additions.map(m=>m.id)};
 }});
 assert.equal(calls,3);assert.equal(result.state.supplementalMemories[0].detail,detail);
});
test('new history alias is normalized and repeating a saved detail needs no second review',async()=>{
 let calls=0;
 const generate=async(c,p,input)=>{
  calls++;
  if(input.additions)return {approved:input.additions.map(m=>m.id)};
  const out=draft();out.beats[0].memoryRefs=[];out.beats[0].historyRefs=['tea-detail'];return out;
 };
 const first=await prepareScene({state:initialStory('repeat'),text:'繼續',target:'shen',generate});
 assert.equal(calls,2);
 const second=await prepareScene({state:first.state,text:'繼續',target:'shen',generate});
 assert.equal(calls,3);assert.equal(second.state.supplementalMemories.length,1);
});
test('review provider failure is not retried and never commits a partial turn',async()=>{
 const state=initialStory('review-rate-limit'),before=JSON.stringify(state);let calls=0;
 await assert.rejects(prepareScene({state,text:'繼續',target:'shen',generate:async()=>{
  calls++;if(calls===1)return draft();throw Error('HTTP 429');
 }}),/429/);
 assert.equal(calls,2);assert.equal(JSON.stringify(state),before);
});
