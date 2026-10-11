import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn,gmContext,playerWorld} from '../server/world.mjs';
import {suggestedActions} from '../server/action-suggestions.mjs';
import {preseededRoot,pendingRootResult} from '../server/action-rules.mjs';

test('initial recruitment provides useful non-rail options and GM forward',()=>{
 const w=initialV3World('suggestions-intro');
 const list=suggestedActions(w);
 assert.ok(list.some(x=>x.label==='開始靈根測試'));
 assert.ok(!list.some(x=>x.label==='詢問收徒方式'));
 assert.ok(list.some(x=>x.label==='交給 GM 推進'&&x.text==='繼續'));
 assert.ok(list.length<=4);
 assert.deepEqual(playerWorld(w).suggestions,list);
 assert.deepEqual(playerWorld(w).choices,[]);
});

test('after NPC invites the player to touch the spirit stone, action really concludes the root test',()=>{
 let w=initialV3World('suggestions-stone');
 w=commitV3Turn(w,'我要測試','韓守一帶洛河走到測靈石旁：「將手掌按在石面上，就可以開始測試。」','req1');
 const list=suggestedActions(w);
 const button=list.find(x=>x.label==='將手放上測靈石');
 assert.ok(button,JSON.stringify(list));
 const root=preseededRoot(w.id);
 assert.equal(pendingRootResult(w,button.text),root);
 w=commitV3Turn(w,button.text,'測靈石亮起。韓守一道：「你的靈根是'+root+'。」','req2');
 assert.equal(w.protagonist.spiritualRoot,root);
 assert.ok(!suggestedActions(w).some(x=>x.label==='將手放上測靈石'));
 assert.ok(!suggestedActions(w).some(x=>x.label==='詢問測試結果'));
});

test('options never depend on secret NPC memory or offscreen event truth',()=>{
 const w=initialV3World('privacy-suggestions');
 const normal=JSON.stringify(suggestedActions(w));
 w.npcs.registrar.privateNotes.push('太虛宗有祕密名冊');
 w.living.arcs[0].truth='宗門禁地藏著一本不可見的書';
 const after=JSON.stringify(suggestedActions(w));
 assert.equal(after,normal);
 assert.doesNotMatch(after,/祕密名冊|不可見的書/);
 const advanced=suggestedActions(w).find(x=>x.kind==='advance');
 assert.equal(advanced.text,'繼續');
 assert.match(gmContext(w,advanced.text),/GM主動性/);
});

test('ordinary dialogue locations do not hallucinate stone action, yet allow free play',()=>{
 const w=initialV3World('nonstone');
 w.location='藏經樓';w.scene.focus='當前地點';
 w.messages.push({role:'assistant',content:'寧素雲正在整理新送來的古籍。'});
 const list=suggestedActions(w);
 assert.ok(list.some(x=>x.label==='查看附近書目'));
 assert.ok(list.some(x=>x.kind==='advance'));
 assert.ok(!list.some(x=>x.label==='將手放上測靈石'));
 assert.ok(list.every(x=>x.text.length<=2500));
 assert.equal(playerWorld(w).messages.at(-1).content,'寧素雲正在整理新送來的古籍。');
});

test('player action suggestions do not add a turn, state, or memory until clicked/submitted',()=>{
 const w=initialV3World('read-only');
 const old=JSON.stringify(w);
 for(let i=0;i<5;i++)suggestedActions(w);
 assert.equal(JSON.stringify(w),old);
 assert.equal(w.events.length,0);
 assert.equal(w.npcs.registrar.memories.length,0);
});
