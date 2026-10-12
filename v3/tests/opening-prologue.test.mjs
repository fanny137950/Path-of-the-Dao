import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,validatedWorld,playerWorld,V3_INTRO,commitV3Turn} from '../server/world.mjs';

test('fresh V3 game opens with grounded, immersive prologue, root basics and a live scene',()=>{
 const w=initialV3World('prologue-1');
 const intro=w.messages[0].content;
 assert.equal(intro,V3_INTRO);
 for(const text of ['你叫洛河','十五歲','青石鎮','洛成安','柳氏','洛小川',
    '三年一度','太虛宗','靈根','金','木','水','火','土','風','雷','冰','韓守一','測靈石'])
  assert.ok(intro.includes(text),'Missing prologue element: '+text);
 assert.match(intro,/鍛體、聚氣、築基/);
 assert.match(intro,/只有真正接受測試，結果才會揭曉/);
 assert.match(intro,/少年.*催促/);
 assert.equal(w.protagonist.spiritualRoot,'未測定');
 assert.equal(w.protagonist.realm,'凡人');
 assert.equal(w.revision,0);
 assert.equal(w.events.length,0);
 assert.equal(w.day,1);
 assert.equal(w.minute,480);
 assert.deepEqual(playerWorld(w).choices,[]);
});
test('prologue is only for new saves, not retroactively added to existing histories',()=>{
 const w=initialV3World('prologue-2');
 const prev='太虛宗山門。韓守一：「洛河，名冊已核對。」';
 w.messages=[{role:'assistant',content:prev}];
 const restored=validatedWorld(JSON.parse(JSON.stringify(w)));
 assert.deepEqual(restored.messages,[{role:'assistant',content:prev}]);
 const next=commitV3Turn(restored,'請問靈根有幾種？','韓守一抬頭：「屬性很多，先看妳適合哪一種。」','intro-test');
 assert.equal(next.messages[0].content,prev);
 assert.equal(next.protagonist.spiritualRoot,'未測定');
});
