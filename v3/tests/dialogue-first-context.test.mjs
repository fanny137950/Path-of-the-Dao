import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn,gmContext,validatedWorld} from '../server/world.mjs';
import {sceneConversationForGM} from '../server/conversation-memory.mjs';

test('newest consecutive exchanges are preserved verbatim in order',()=>{
 let w=initialV3World('dialogue-first');
 for(let i=1;i<=8;i++)w=commitV3Turn(w,'洛河第'+i+'句：關於葉沖的比試','葉沖回答第'+i+'句：我還記得剛才的話。','dialogue-first-'+i);
 const c=gmContext(w,'剛才你說什麼');
 assert.match(c,/洛河第7句：關於葉沖的比試/);
 assert.match(c,/葉沖回答第8句：我還記得剛才的話/);
 assert.ok(c.indexOf('洛河第7句')<c.indexOf('洛河第8句'));
 assert.ok(c.length<=11800);
 assert.ok(c.indexOf('【目前場景對話')<c.indexOf('【較遠的重要舊事'));
});

test('oversized turn does not cause gaps by selecting older turns in its place',()=>{
 let w=initialV3World('dialogue-contiguous');
 w=commitV3Turn(w,'第一次說話','韓守一答：「第一句」。','dialogue-large-1');
 w=commitV3Turn(w,'第二次說話','韓守一答：「第二句」。','dialogue-large-2');
 w=commitV3Turn(w,'第三次說話','第三次的較長回答：'+'今天山門很忙。'.repeat(140),'dialogue-large-3');
 w=commitV3Turn(w,'第四次說話','韓守一答：「第四句」。','dialogue-large-4');
 const c=sceneConversationForGM(w,'繼續',650);
 assert.match(c,/第四句/);
 assert.doesNotMatch(c,/洛河：第二次說話\nGM/);
});

test('task and character memory do not replace dialogue; stored save remains intact',()=>{
 let w=initialV3World('dialogue-separation');
 w=commitV3Turn(w,'我剛才說你很自負','葉沖：「誰說的？」','dialogue-sep-1');
 const c=gmContext(w,'我可沒這麼說');
 assert.match(c,/我剛才說你很自負/);
 assert.match(c,/葉沖：「誰說的？」/);
 const restored=validatedWorld(JSON.parse(JSON.stringify(w)));
 assert.equal(restored.messages.length,w.messages.length);
 assert.equal(restored.eventCalendar.events.length,w.eventCalendar.events.length);
 assert.deepEqual(restored.npcs.registrar.relationships.player,w.npcs.registrar.relationships.player);
});
