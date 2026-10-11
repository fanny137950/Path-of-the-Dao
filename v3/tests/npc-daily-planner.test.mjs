import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn,developerWorld,playerWorld,validatedWorld} from '../server/world.mjs';
import {planNPCDay,advanceNPCDailyPlans,npcDailyPlanForGM} from '../server/npc-daily-planner.mjs';
import {sceneJumpPlan,prepareSceneJump} from '../server/scene-jump.mjs';

test('a midnight transition creates one persistent intention per NPC without granting outcomes',()=>{
 const old=initialV3World('daily-plan-midnight');
 old.minute=1438;
 const next=commitV3Turn(old,'繼續','韓守一繼續收拾帳冊。','daily-plan-midnight-1');
 assert.equal(next.day,2);
 const plans=next.npcAgency.dailyPlans['2'];
 assert.equal(Object.keys(plans).length,Object.keys(next.npcs).length);
 assert.equal(plans.shen.day,2);
 assert.equal(plans.shen.location,next.npcs.shen.where);
 assert.equal(plans.shen.status,'planned');
 assert.match(plans.shen.reason,/目標|職責|角色/);
 assert.equal(next.npcs.shen.cultivationProgress,old.npcs.shen.cultivationProgress);
 assert.equal(next.npcs.shen.relationships.player.favor,old.npcs.shen.relationships.player.favor);
 assert.equal(playerWorld(next).npcAgency,undefined);
 assert.ok(developerWorld(next).npcAgency.dailyPlans['2']);
});

test('status of an injured NPC overrides normal sect duties without healing automatically',()=>{
 const world=initialV3World('daily-plan-injury');
 world.npcs.shen.status='重傷';
 const plans=planNPCDay(world,2);
 assert.equal(plans.shen.category,'recovery');
 assert.match(plans.shen.title,/休養/);
 assert.equal(world.npcs.shen.status,'重傷');
});

test('NPC reacts only to personally witnessed safety incident',()=>{
 const world=initialV3World('daily-plan-knowledge');
 world.npcs.han_su.where='戒律峰';
 world.events.push({id:'private-threat',type:'offscreen',source:'living-world',
  day:1,minute:1200,text:'戒律峰巡防發現異常',hidden:true,witnesses:['han_su']});
 const plans=planNPCDay(world,2);
 assert.equal(plans.han_su.category,'safety');
 assert.equal(plans.han_su.sourceEvent,'private-threat');
 assert.notEqual(plans.shen.category,'safety');
 assert.equal(world.npcs.shen.knowledge.includes('private-threat'),false);
});

test('calendar participants may plan duties, but task progress is not forged',()=>{
 const world=initialV3World('daily-plan-calendar');
 const event=world.eventCalendar.events.find(e=>e.id==='twelve-peaks-selection');
 assert.ok(event);
 const plans=planNPCDay(world,2);
 assert.equal(plans.registrar.category,'duty');
 assert.equal(plans.registrar.taskId,'twelve-peaks-selection');
 assert.equal(event.state,'scheduled');
 assert.equal(event.completed.length,0);
});

test('daily planning is idempotent and does not cancel an unfinished emergency',()=>{
 const world=initialV3World('daily-plan-priority');
 world.day=2;world.minute=530;
 world.npcAgency.agendas.han_su={id:'urgent',actorId:'han_su',cause:'NPC事件應變',
  title:'緊急處置',start:1450,end:1700,location:'戒律峰'};
 let plans=advanceNPCDailyPlans(world,1430,1970);
 assert.equal(world.npcAgency.agendas.han_su.id,'urgent');
 assert.ok(plans.some(p=>p.actorId==='han_su'));
 assert.ok(world.npcAgency.agendas.shen.cause==='NPC每日自主計畫');
 const snapshot=world.npcAgency.dailyPlans['2'].shen.id;
 assert.equal(planNPCDay(world,2).shen.id,snapshot);
 assert.equal(world.npcs.shen.where,'棲風峰');
});

test('long skip produces only one destination-day plan and bounded history',()=>{
 const world=initialV3World('daily-plan-skip');
 const from=480,to=from+150*1440;
 world.day=Math.floor(to/1440)+1;world.minute=to%1440;
 advanceNPCDailyPlans(world,from,to);
 assert.deepEqual(Object.keys(world.npcAgency.dailyPlans),['151']);
 assert.equal(world.npcAgency.dailyPlanHistory.length,1);
 assert.equal(world.events.length,0);
});

test('scene-jump settlement builds daily plans without leaking them to player',()=>{
 const world=initialV3World('daily-plan-scene');
 const next=prepareSceneJump(world,sceneJumpPlan(world,'跳到宗門論道'));
 assert.ok(next.day>1);
 assert.ok(next.npcAgency.dailyPlans[String(next.day)]);
 assert.ok(!world.npcAgency.dailyPlans);
 assert.equal(playerWorld(next).npcAgency,undefined);
 const reload=validatedWorld(JSON.parse(JSON.stringify(next)));
 assert.equal(reload.npcAgency.dailyPlans[String(next.day)].shen.id,
  next.npcAgency.dailyPlans[String(next.day)].shen.id);
 assert.match(npcDailyPlanForGM(next,900),/今日意圖/);
});
