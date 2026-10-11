import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn,playerWorld,validatedWorld} from '../server/world.mjs';
import {playerQuestJournal} from '../server/player-journal.mjs';
import {elapsedMinutes} from '../server/living-world.mjs';

test('new player sees recruitment quest but not hidden offscreen arcs',()=>{
 const world=initialV3World('test-journal');
 const visible=playerWorld(world);
 assert.equal(visible.journal.length,1);
 assert.equal(visible.journal[0].id,'recruitment');
 assert.equal(visible.journal[0].progress,20);
 assert.doesNotMatch(JSON.stringify(visible.journal),/收徒名冊遺漏|名冊編號錯位|抄錄差錯|recruitment-register/);
});
test('quest tracker updates only after objective state actually changes',()=>{
 let world=initialV3World('test-quest-root');
 world.protagonist.spiritualRoot='金靈根';
 assert.equal(playerQuestJournal(world)[0].progress,60);
 assert.match(playerQuestJournal(world)[0].objective,/詢問韓守一/);
 world.messages.push({role:'assistant',content:'韓守一已發給洛河入門弟子憑證。'});
 assert.equal(playerQuestJournal(world)[0].status,'已完成');
 assert.equal(playerQuestJournal(world)[0].progress,100);
});
test('elapsed time advances exact requested delta across midnight and background beats',()=>{
 let world=initialV3World('test-time-skip');
 const original=elapsedMinutes(world);
 world=commitV3Turn(world,'洛河留在原地等待。','執事仍在處理名冊，來往的隊伍慢慢減少。','test-delta-1',{advanceMinutes:360});
 assert.equal(elapsedMinutes(world),original+360);
 assert.equal(world.day,1);
 assert.equal(world.minute,840);
 assert.ok(world.living.arcs[0].completed.includes('mismatch'));
 assert.ok(world.living.arcs[0].completed.includes('inquiry'));
 assert.equal(world.events.at(-1).advanceMinutes,360);
 assert.equal(world.events.filter(e=>e.type==='conversation').length,1);
 world=commitV3Turn(world,'洛河繼續等待。','人群換過數次，夜裡安靜下來。','test-delta-2',{advanceMinutes:1440});
 assert.equal(elapsedMinutes(world),original+1800);
 assert.equal(world.day,2);
 assert.equal(world.minute,840);
 assert.ok(world.living.arcs[0].completed.includes('resolved'));
 assert.equal(world.events.filter(e=>e.type==='conversation').length,2);
 // Offscreen NPC knowledge must not be visible as a quest.
 assert.equal(playerQuestJournal(world).length,1);
 assert.doesNotMatch(JSON.stringify(playerWorld(world).journal),/名冊錯位|收徒名冊的異常/);
});
test('time skip never happens if invalid length, bad narration or repeated request',()=>{
 const world=initialV3World('validation');
 const before=JSON.stringify(world);
 assert.throws(()=>commitV3Turn(world,'等一下','人群漸漸散去。','id-invalid',{advanceMinutes:999}),/時間推進/);
 assert.throws(()=>commitV3Turn(world,'等一下','User Safety: safe','id-invalid',{advanceMinutes:60}),/劇情/);
 assert.equal(JSON.stringify(world),before);
 const changed=commitV3Turn(world,'等一小時','此時日光已更亮了。','id-good',{advanceMinutes:60});
 assert.throws(()=>commitV3Turn(changed,'等一小時','一切繼續。','id-good',{advanceMinutes:60}),/重複/);
});
test('journal shows publicly raised issue but never confirms hidden secret automatically',()=>{
 const world=initialV3World('journal-known');
 world.events.push({id:'turn:1',type:'conversation',text:'我問名冊編號是否對不上',reply:'韓守一說：「名冊編號確實需要核對。」'});
 const j=playerQuestJournal(world);
 assert.equal(j.length,2);
 assert.equal(j[1].status,'已知悉');
 assert.doesNotMatch(JSON.stringify(j),/不是有人蓄意|抄錄差錯|今夜|名冊遺漏/);
 const saved=validatedWorld(structuredClone(world));
 assert.equal(playerWorld(saved).journal.length,2);
});
