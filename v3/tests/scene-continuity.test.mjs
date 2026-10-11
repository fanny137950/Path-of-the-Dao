import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn,gmContext,playerWorld,validatedWorld} from '../server/world.mjs';
import {pendingRootResult} from '../server/action-rules.mjs';
import {sceneOf,resolvePlayerReference} from '../server/scene-context.mjs';
import {stabilizeDecisiveAction} from '../server/outcome-stability.mjs';
import {visibleNarrative,isNonNarrative} from '../server/narrative.mjs';

const firstReply='韓守一點頭：「好，請跟我來。」他停在較大的測靈石前，轉頭說：「放手上去，感受石頭的反應。」';
const sample='太虛宗山門內，晨光穿過樹梢。洛河將那塊靈根測試石放在石座上。韓守一仍在等待結果。\n\n洛河心中暗想：這測試真奇怪。\n<!--GM_STATE:{"changes":[{"id":"registrar","mood":"期待","evidence":"放上去"}]}}';

test('scene tracks precise focus after moving from the gate to spirit-stone table',()=>{
 const old=initialV3World('scene-1');
 assert.equal(sceneOf(old).focus,'收徒登記');
 const world=commitV3Turn(old,'開始吧',firstReply,'req-go');
 assert.equal(world.location,'太虛宗山門');
 assert.equal(world.scene.focus,'測靈石');
 assert.match(world.scene.lastBeat,/放手上去/);
 assert.equal(resolvePlayerReference(world,'放上去').kind,'touch-spirit-stone');
 assert.equal(resolvePlayerReference(world,'放上去').interpreted,'洛河把手掌按在面前的測靈石上，開始靈根測試。');
 const context=gmContext(world,'放上去');
 assert.match(context,/場景焦點：測靈石/);
 assert.match(context,/不是玩家搬動石頭/);
 assert.match(context,/直接描寫陣紋與結果/);
 assert.match(context,new RegExp(pendingRootResult(world,'放上去')));
 assert.match(context,/【洛河最新輸入】放上去/);
});

test('free model ambiguity is repaired only for player-confirmed test action, no rail stages',()=>{
 const started=commitV3Turn(initialV3World('scene-2'),'開始吧',firstReply,'req-start');
 const root=pendingRootResult(started,'放上去');
 assert.ok(root);
 const response=stabilizeDecisiveAction(started,'放上去',sample);
 assert.match(response,new RegExp(root));
 assert.match(response,/洛河將手掌按在測靈石表面/);
 assert.doesNotMatch(response,/洛河心中暗想|<!--GM_STATE/);
 const end=commitV3Turn(started,'放上去',response,'req-touch');
 assert.equal(end.protagonist.spiritualRoot,root);
 assert.equal(end.scene.focus,'測試結果');
 assert.equal(end.revision,2);
 assert.equal(end.npcs.registrar.memories.length,2);
 assert.equal(playerWorld(end).choices.length,0);
 assert.doesNotMatch(playerWorld(end).messages.at(-1).content,/<!--GM_STATE|心中暗想/);
});

test('existing correct free-form narration is preserved, not replaced by scripted fallback',()=>{
 const w=commitV3Turn(initialV3World('scene-3'),'開始吧',firstReply,'req-1');
 const root=pendingRootResult(w,'放上去');
 const natural='手掌一貼上測靈石，陣紋便亮起。韓守一說：「'+root+'，好，你的測試完成了。」';
 assert.equal(stabilizeDecisiveAction(w,'放上去',natural),natural);
 assert.equal(commitV3Turn(w,'放上去',natural,'req-2').protagonist.spiritualRoot,root);
});

test('refused or negated actions do not force a result',()=>{
 const w=commitV3Turn(initialV3World('scene-4'),'開始吧',firstReply,'req-1');
 assert.equal(pendingRootResult(w,'我不放上去'),null);
 const blocked='韓守一攔住她：「等等，測靈石還在校正，現在不能碰。」';
 assert.equal(stabilizeDecisiveAction(w,'放上去',blocked),blocked);
 const end=commitV3Turn(w,'放上去',blocked,'req-2');
 assert.equal(end.protagonist.spiritualRoot,'未測定');
 assert.equal(pendingRootResult(w,'我把木牌放上去'),null);
});

test('incomplete GM metadata is stripped from current turns, legacy display and future GM context',()=>{
 const incomplete='韓守一點了點頭。\n<!--GM_STATE:{"changes":[{"id":"registrar","mood":"專業"}]}}';
 assert.equal(visibleNarrative(incomplete),'韓守一點了點頭。');
 assert.equal(isNonNarrative('<!--GM_STATE:{"changes":[]}'),true);
 const w=initialV3World('scene-5');
 const next=commitV3Turn(w,'你好',incomplete,'req-hello');
 assert.equal(next.messages.at(-1).content,'韓守一點了點頭。');
 assert.equal(next.npcs.registrar.mood,'平靜');
 const legacy=initialV3World('scene-legacy');
 legacy.messages.push({role:'user',content:'你好'},{role:'assistant',content:incomplete});
 legacy.events.push({id:'turn:1',requestId:'bad-old',type:'conversation',day:1,minute:500,text:'你好',reply:incomplete});
 validatedWorld(legacy);
 assert.equal(playerWorld(legacy).messages.at(-1).content,'韓守一點了點頭。');
 assert.doesNotMatch(gmContext(legacy,'繼續'),/<!--GM_STATE/);
});

test('backend safety failure is not silently turned into a root result',()=>{
 const w=commitV3Turn(initialV3World('scene-6'),'開始吧',firstReply,'req-1');
 assert.equal(stabilizeDecisiveAction(w,'放上去','User Safety: safe'),'User Safety: safe');
 assert.throws(()=>commitV3Turn(w,'放上去','User Safety: safe','req-2'),/未存檔/);
});
