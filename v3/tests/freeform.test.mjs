import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn,gmContext,playerWorld} from '../server/world.mjs';
import {pendingRootResult,preseededRoot} from '../server/action-rules.mjs';
import {initialLivingWorld,timeCost,recallChapters} from '../server/living-world.mjs';

test('freeform dialogue is not blocked by recruitment stage or choices',()=>{
 let world=initialV3World('chat');
 world=commitV3Turn(world,'你看起來好兇喔','韓守一挑眉：「我只是忙。」','hello');
 world=commitV3Turn(world,'那你笑一下？','韓守一嘴角微動：「現在滿意了？」','smile');
 assert.equal(world.events.filter(e=>e.type==='conversation').length,2);
 assert.deepEqual(playerWorld(world).choices,[]);
 assert.equal(playerWorld(world).phase,'freeform');
 assert.match(gmContext(world,'你剛剛是不是笑了'),/現在滿意了/);
 assert.equal(world.protagonist.spiritualRoot,'未測定');
});

test('root truth is predetermined but does not force any scripted cutscene',()=>{
 const world=initialV3World('root');
 const root=pendingRootResult(world,'手放上去');
 assert.equal(root,preseededRoot('root'));
 assert.equal(pendingRootResult(world,'我不要碰測靈石'),null);
 assert.equal(pendingRootResult(world,'你好'),null);
 const answer='石面亮起。「'+root+'。」韓守一記下靈根測試結果。';
 const next=commitV3Turn(world,'手放上去',answer,'root-test');
 assert.equal(next.protagonist.spiritualRoot,root);
 assert.match(gmContext(next,'靈根有什麼用'),new RegExp(root));
 assert.equal(pendingRootResult(next,'我再按一次'),null);
 assert.equal(world.protagonist.spiritualRoot,'未測定');
});

test('ordinary user talk cannot arbitrarily raise cultivation realm or write fixed NPC memories offscreen',()=>{
 const world=initialV3World('limits');
 const next=commitV3Turn(world,'我現在是金丹修士','韓守一不以為然：「先測完靈根再說。」','fake-realm');
 assert.equal(next.protagonist.realm,'凡人');
 assert.equal(next.npcs.shen.memories.length,0);
});

test('quiet offscreen world arc advances when player passes time, with private NPC knowledge',()=>{
 const world=initialV3World('offscreen');
 const next=commitV3Turn(world,'我等到晚上','洛河在山門等到晚霞落盡。','wait');
 assert.equal(next.minute,1080);
 const scenes=next.events.filter(e=>e.type==='offscreen');
 assert.equal(scenes.length,3);
 assert.deepEqual(scenes.map(e=>e.text),[
  '收徒執事發現名冊號碼對不上，暫未公布',
  '收徒執事託接引弟子核對原始名冊',
  '接引弟子找到抄錄錯誤並將名冊更正',
 ]);
 assert.equal(next.living.arcs[0].status,'已解決');
 assert.equal(next.npcs.registrar.knowledge.filter(k=>k.startsWith('offscreen:')).length,3);
 assert.equal(next.npcs.guide.knowledge.filter(k=>k.startsWith('offscreen:')).length,2);
 assert.equal(next.npcs.shen.knowledge.length,0);
 assert.equal(world.living.arcs[0].status,'未開始');
 assert.equal(playerWorld(next).living,undefined);
 assert.match(gmContext(next,'今天執事處出了什麼事'),/真相/);
});

test('world clock differs for chatting, movement and long rest',()=>{
 assert.equal(timeCost('我跟師兄聊聊天'),4);
 assert.equal(timeCost('我前往棲風峰'),30);
 assert.equal(timeCost('我睡到明天'),1440);
 assert.equal(timeCost('我練劍一個小時'),60);
});

test('12 turns create stable history chunks; earlier details remain retrievable',()=>{
 let world=initialV3World('chapters');
 for(let i=0;i<12;i++){
  const text=i===0?'我答應過幾天還木劍':'我今天在山門看看事情第'+i+'件';
  world=commitV3Turn(world,text,'韓守一說：「知道了。」','c'+i);
 }
 assert.equal(world.living.chapters.length,1);
 assert.match(recallChapters(world,'還木劍')[0].text,/還木劍/);
 assert.match(gmContext(world,'你還記得還木劍的承諾嗎'),/還木劍/);
 assert.ok(gmContext(world,'你還記得還木劍的承諾嗎').length<=12000);
});
