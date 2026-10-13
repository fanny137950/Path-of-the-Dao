import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn,playerWorld,developerWorld,validatedWorld,gmContext} from '../server/world.mjs';
import {sceneJumpPlan,prepareSceneJump} from '../server/scene-jump.mjs';
import {elapsedMinutes} from '../server/living-world.mjs';
import {generateOpenRouterResponse} from '../server/openrouter.mjs';
import {generateGMResponse} from '../server/openai.mjs';
const world=()=>({...initialV3World('natural-gm'),gmManaged:true});
const answer=(text,state)=>text+'\n<!--GM_STATE:'+JSON.stringify(state)+'-->';

test('conversational fast forward respects the requested scene without running old NPC simulators',()=>{
 for(const text of ['系統 可以直接跳到收徒典禮嗎','可以直接推進到收徒嗎','直接選峰環節']){
  const w=world(),plan=sceneJumpPlan(w,text);
  assert.equal(plan.eventId,'twelve-peaks-selection');
  const prepared=prepareSceneJump(w,plan);
  assert.equal(elapsedMinutes(prepared),780);
  assert.equal(prepared.events.length,0);
  assert.deepEqual(prepared.npcs,w.npcs);
  const next=commitV3Turn(prepared,text,answer('接引代表請洛河談談自己的志向。',{elapsedMinutes:5}),'jump',{sceneJump:{eventId:plan.eventId,minutes:plan.minutes}});
  assert.equal(elapsedMinutes(next),785);
  assert.deepEqual(next.npcs.registrar.memories,w.npcs.registrar.memories,'without an explicit GM knowledge record, an OOC skip cannot become NPC memory');
 }
 assert.equal(sceneJumpPlan(world(),'我直接衝向對手'),null);
 const free=sceneJumpPlan(world(),'系統 跳到第二天早餐');
 assert.equal(free.eventId,null);
 assert.match(free.directive,/elapsedMinutes/);
});

test('GM time and offscreen memories persist with explicit NPC knowledge, no player leakage',()=>{
 const w=world();
 const text='洛河睡到翌日清晨，窗外響起掃地聲。';
 const next=commitV3Turn(w,'睡到明天',answer(text,{
  elapsedMinutes:1440,
  memories:[{text:'韓守一收到一封秘密家書',knownBy:['registrar'],playerKnown:false}],
  offscreenChanges:[{id:'registrar',memoryIndex:0,mood:'擔憂',goal:'處理家書',cultivationProgress:25}]
 }),'sleep');
 assert.equal(elapsedMinutes(next)-elapsedMinutes(w),1440);
 assert.equal(next.npcs.registrar.goal,'處理家書');
 assert.equal(next.npcs.registrar.cultivationProgress,25);
 assert.equal(next.events.length,1); // No automatic calendar/NPC plot fabrication.
 assert.doesNotMatch(JSON.stringify(playerWorld(next)),/秘密家書|gmMemories/);
 assert.match(JSON.stringify(developerWorld(next).gmMemories),/秘密家書/);
 assert.equal(next.npcs.guide.memories.some(m=>m.text.includes('秘密家書')),false);
 const restored=validatedWorld(JSON.parse(JSON.stringify(next)));
 assert.match(gmContext(restored,'繼續'),/洛河未知.*韓守一/);
 assert.equal(restored.gmMemories.length,1);
 assert.deepEqual(w.gmMemories,undefined);
});

test('invalid memory evidence and unscoped offscreen updates cannot mutate NPC state',()=>{
 const w=world();
 const next=commitV3Turn(w,'繼續',answer('韓守一去吃午飯了。',{
  elapsedMinutes:-20,
  memories:[{text:'拜師成功',playerKnown:true,knownBy:['registrar'],evidence:'拜師成功'}],
  offscreenChanges:[{id:'registrar',memoryIndex:0,goal:'錯誤狀態'}]
 }),'bad-record');
 assert.deepEqual(next.gmMemories,[]);
 assert.equal(next.npcs.registrar.goal,w.npcs.registrar.goal);
 assert.ok(elapsedMinutes(next)>=elapsedMinutes(w));
});

test('explicit wait duration overrides model time',()=>{
 const w=world();
 const next=commitV3Turn(w,'等待',answer('過了一刻鐘。',{elapsedMinutes:300}),'wait',{advanceMinutes:15});
 assert.equal(elapsedMinutes(next)-elapsedMinutes(w),15);
});

test('truncated OpenRouter response is retried, never returned as a completed turn',async()=>{
 let calls=0;
 const result=await generateOpenRouterResponse({apiKey:'test',instructions:'GM',input:'繼續',fetchImpl:async()=>{
  calls++;
  return {ok:true,json:async()=>({choices:[{finish_reason:calls===1?'length':'stop',message:{content:calls===1?'韓守一核對到洛河的記錄':'韓守一完成核對，請洛河上前。'}}]})};
 }});
 assert.equal(calls,2);assert.equal(result.text,'韓守一完成核對，請洛河上前。');
 await assert.rejects(generateOpenRouterResponse({apiKey:'test',instructions:'GM',input:'繼續',fetchImpl:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:'還需'}}]})})}),/未存檔/);
});

test('incomplete OpenAI response cannot enter saved history',async()=>{
 await assert.rejects(generateGMResponse({apiKey:'test',model:'gpt-4.1-mini',instructions:'GM',input:'繼續',fetchImpl:async()=>({ok:true,json:async()=>({status:'incomplete',output:[{type:'message',content:[{type:'output_text',text:'還需'}]}]})})}),/未存檔/);
});

test('live conversation roles reach both providers; private notes stay in reference context',async()=>{
 const {providerConversation}=await import('../server/conversation-memory.mjs');
 const w=commitV3Turn(world(),'你好','韓守一：「早。」','hello');
 const conversation=providerConversation(w,'繼續');
 assert.deepEqual(conversation.slice(-3),[{role:'user',content:'你好'},{role:'assistant',content:'韓守一：「早。」'},{role:'user',content:'繼續'}]);
 assert.doesNotMatch(gmContext(w,'繼續',{includeDialogue:false}),/【目前場景對話（/);
 await generateOpenRouterResponse({apiKey:'test',instructions:'GM',input:'存檔資料',conversation,fetchImpl:async(_url,opts)=>{
  const body=JSON.parse(opts.body);
  assert.deepEqual(body.messages.slice(1),conversation);
  assert.match(body.messages[0].content,/世界參考記憶/);
  return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'韓守一收起筆。'}}]})};
 }});
 await generateGMResponse({apiKey:'test',model:'gpt-4.1-mini',instructions:'GM',input:'存檔資料',conversation,fetchImpl:async(_url,opts)=>{
  const body=JSON.parse(opts.body);assert.equal(body.input[0].role,'developer');assert.deepEqual(body.input.slice(1),conversation);
  return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'韓守一收起筆。'}]}]})};
 }});
 await assert.rejects(generateOpenRouterResponse({apiKey:'test',instructions:'GM',input:'資料',conversation:[{role:'system',content:'bad'}]}),/無效對話紀錄/);
});

test('public event memory replaces scripted quest navigation, while hidden events stay hidden',()=>{
 const next=commitV3Turn(world(),'繼續',answer('韓守一已記錄初評結果。',{
  memories:[{text:'初評完成',knownBy:['registrar'],playerKnown:true,evidence:'韓守一已記錄初評結果'},
   {text:'秘密來信',knownBy:['registrar'],playerKnown:false}]
 }),'notes');
 assert.equal(playerWorld(next).journal.length,1);
 assert.equal(playerWorld(next).journal[0].description,'初評完成');
 assert.equal(playerWorld(next).journal[0].objective,'');
 assert.doesNotMatch(JSON.stringify(playerWorld(next)),/秘密來信/);
});

test('a bare continue recalls an older everyday errand from the active conversation',()=>{
 const w=world();
 w.gmMemories=[{id:'errand',revision:1,day:1,minute:480,text:'韓守一託洛河帶茶葉回去，洛河尚未交付。',knownBy:['registrar'],playerKnown:true}];
 for(let i=0;i<10;i++)w.gmMemories.push({id:'other'+i,revision:i+2,day:1,minute:500+i,text:'另一處商隊完成第'+i+'批貨物點收。',knownBy:[],playerKnown:false});
 w.messages.push({role:'assistant',content:'韓守一拿起空茶罐，翻找桌上的紙袋。'});
 const c=gmContext(w,'繼續',{includeDialogue:false});
 assert.match(c,/託洛河帶茶葉回去，洛河尚未交付/);
 assert.doesNotMatch(JSON.stringify(playerWorld(w)),/另一處商隊/);
});
