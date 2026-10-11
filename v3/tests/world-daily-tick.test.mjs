import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn,validatedWorld,developerWorld,playerWorld} from '../server/world.mjs';
import {ensureDailyTick,settleWorldDays} from '../server/world-daily-tick.mjs';
import {sceneJumpPlan,prepareSceneJump} from '../server/scene-jump.mjs';

test('crossing midnight settles one day; short same-day turns do not',()=>{
 let w=initialV3World('daily-midnight');
 assert.equal(w.dailyTick.lastSettledDay,1);
 w.day=1;w.minute=1438;
 w=commitV3Turn(w,'繼續','韓守一正收整文書。','daily-1');
 assert.equal(w.day,2);
 assert.equal(w.dailyTick.lastSettledDay,2);
 assert.equal(w.dailyTick.records.length,1);
 assert.equal(w.dailyTick.records[0].id,'daily:2');
 const result=commitV3Turn(w,'聊聊','韓守一回答一句。','daily-2');
 assert.equal(result.dailyTick.records.length,1);
 assert.equal(result.dailyTick.lastSettledDay,2);
 assert.equal(playerWorld(result).dailyTick,undefined);
 assert.ok(developerWorld(result).dailyTick.records.length>0);
});

test('daily settlement summarizes only actual observed private events and task stages',()=>{
 const w=initialV3World('daily-events');
 const result=commitV3Turn(w,'明天見','韓守一揮了揮手。','daily-next',{advanceMinutes:1440});
 assert.equal(result.day,2);
 const report=result.dailyTick.records.at(-1);
 assert.ok(report);
 assert.ok(report.activityCount>=1);
 assert.ok(report.calendarEvents.includes('sect-recruitment'));
 assert.ok(report.npcActivity.includes('shen'));
 assert.ok(!('protagonist' in report));
 assert.equal(result.protagonist.realm,'凡人');
 assert.equal(result.npcs.shen.cultivationProgress,w.npcs.shen.cultivationProgress);
});

test('multi-day skip uses bounded checkpoints without fabricating outcomes',()=>{
 const w=initialV3World('daily-longskip');
 const from=480,to=480+50*1440;
 w.day=Math.floor(to/1440)+1;w.minute=to%1440;
 // In production other engines have already advanced to the new clock.
 const records=settleWorldDays(w,from,to);
 assert.ok(records.length<=13);
 assert.equal(w.dailyTick.lastSettledDay,51);
 assert.equal(w.dailyTick.records.at(-1).id,'daily:51');
 assert.ok(records.every(r=>r.activityCount===0));
 const size=w.dailyTick.records.length;
 settleWorldDays(w,from,to);
 assert.equal(w.dailyTick.records.length,size);
});

test('scene jumps crossing multiple days are integrated, not visible to the player',()=>{
 const w=initialV3World('daily-scenejump');
 const plan=sceneJumpPlan(w,'跳到宗門論道');
 const next=prepareSceneJump(w,plan);
 assert.ok(next.day>1);
 assert.equal(next.dailyTick.lastSettledDay,next.day);
 assert.ok(next.dailyTick.records.length>0);
 assert.equal(w.dailyTick.records.length,0);
});

test('old saves begin settlement at current day, never rewrite prior history',()=>{
 const w=initialV3World('daily-legacy');
 delete w.dailyTick;
 w.day=18;w.minute=660;
 validatedWorld(w);
 assert.equal(w.dailyTick.lastSettledDay,18);
 assert.equal(w.dailyTick.records.length,0);
 const from=(18-1)*1440+660,to=from+1440;
 w.day=19;w.minute=660;
 const entries=settleWorldDays(w,from,to);
 assert.deepEqual(entries.map(e=>e.day),[19]);
});
