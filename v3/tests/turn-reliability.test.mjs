import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn} from '../server/world.mjs';
import {timeCost} from '../server/living-world.mjs';
import {validateTurnRequest,validateObjectiveNarrative} from '../server/turn-validation.mjs';

test('questions, hypothetical actions and refusals do not consume training time',()=>{
 for(const text of ['我不修煉，只問問一個時辰要做什麼','我問師兄修煉一個時辰有什麼用','如果修煉一個時辰會怎樣','我說「我要修煉一個時辰」','我考慮修煉一個時辰'])
  assert.ok(timeCost(text)<10,text);
 assert.equal(timeCost('我先詢問師兄，然後修煉一個時辰'),120);
 assert.equal(timeCost('我修煉一個時辰'),120);
});

test('target-time waits use the current world clock',()=>{
 assert.equal(timeCost('我睡到明天早上',20*60),12*60);
 assert.equal(timeCost('我等到晚上',17*60),60);
 assert.equal(timeCost('我等到晚上',19*60),0);
 const w=initialV3World('clock');w.minute=20*60;
 const next=commitV3Turn(w,'我睡到明天早上','翌日清晨，韓守一正在核對名冊。','sleep');
 assert.equal(next.day,2);assert.equal(next.minute,480);
});

test('unresolved realm claims cannot pollute state, history or NPC memories',()=>{
 const w=initialV3World('realm');const before=structuredClone(w);
 assert.throws(()=>commitV3Turn(w,'我修煉一個時辰','洛河突破到了築基，手中多出十枚靈石。','false'),/未存檔/);
 assert.deepEqual(w,before);
 assert.doesNotThrow(()=>validateObjectiveNarrative(w,'韓守一說：「洛河想突破到築基還早。」'));
 assert.doesNotThrow(()=>validateObjectiveNarrative(w,'洛河未能突破到築基。'));
});

test('retry replays a committed turn even after later revisions, but cannot change intent',()=>{
 let w=initialV3World('retry');
 const request={requestId:'first',text:'你好',mode:'demo',model:'openrouter/free',revision:0};
 assert.deepEqual(validateTurnRequest(w,request),{replayed:false});
 w=commitV3Turn(w,request.text,'韓守一點頭。','first');
 w.events[0].request={mode:request.mode,model:request.model,revision:request.revision};
 w=commitV3Turn(w,'謝謝','韓守一微笑。','second');
 assert.deepEqual(validateTurnRequest(w,request),{replayed:true});
 for(const change of [{text:'走開'},{model:'other/model:free'},{revision:2}])
  assert.equal(validateTurnRequest(w,{...request,...change}).status,409);
 assert.equal(validateTurnRequest(w,{...request,requestId:'new'}).status,409);
 assert.equal(validateTurnRequest(w,{...request,requestId:'new',revision:undefined}).status,409);
});
