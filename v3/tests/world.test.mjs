import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,gmContext,commitV3Turn,playerWorld,validatedWorld} from '../server/world.mjs';
test('creates separate V3 world without V2 mode',()=>{
 const w=initialV3World('world-1');
 assert.equal(w.mode,'v3');assert.equal(w.revision,0);
 assert.equal(w.protagonist.spiritualRoot,'未測定');
 assert.ok(!('events' in playerWorld(w)));
});
test('commits a turn and advances time without mutating old state',()=>{
 const old=initialV3World('world-2');
 const next=commitV3Turn(old,'我叫洛河','執事點點頭。','request-1');
 assert.equal(next.revision,1);assert.equal(next.minute,old.minute+5);
 assert.equal(old.events.length,0);assert.equal(next.events.length,1);
 assert.equal(next.messages.at(-1).content,'執事點點頭。');
 assert.equal(validatedWorld(next),next);
 assert.throws(()=>commitV3Turn(next,'hi','reply','request-1'),/重複/);
});
test('GM context uses authoritative history instead of user-provided history',()=>{
 const w=commitV3Turn(initialV3World('world-3'),'我姓洛','你可以去測靈根。','req-2');
 const c=gmContext(w,'走向測靈石');
 assert.match(c,/我姓洛/);assert.match(c,/走向測靈石/);assert.match(c,/靈根：未測定/);
});
