import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn,gmContext,playerWorld,developerWorld} from '../server/world.mjs';
import {checkWorldFacts,correctionDirective} from '../server/world-fact-guard.mjs';
import {replanNPCAgendas} from '../server/npc-decision-v2.mjs';
import {prepareSceneJump,sceneJumpPlan} from '../server/scene-jump.mjs';

test('guard rejects explicit wrong Luohe spiritual root, not uncertainty and normal rival dialogue',()=>{
 const w=initialV3World('fact-1');
 w.protagonist.spiritualRoot='金靈根';
 const error=checkWorldFacts(w,'洛河的靈根是水靈根。韓守一記入名冊。');
 assert.equal(error.ok,false);
 assert.equal(error.errors[0].code,'wrong-root');
 assert.match(correctionDirective(error),/金靈根/);
 assert.equal(checkWorldFacts(w,'洛河的靈根是金靈根。').ok,true);
 assert.equal(checkWorldFacts(w,'葉沖笑道：「聽說你是水靈根？」').ok,true);
 assert.equal(checkWorldFacts(w,'有人誤認洛河的靈根是水靈根。').ok,true);
 assert.equal(checkWorldFacts(w,'江離本身是風水雙靈根。').ok,true);
});

test('guard catches declarative future ceremony but does not reject scheduled preparations',()=>{
 const w=initialV3World('fact-2');
 assert.equal(checkWorldFacts(w,'十二峰初選已經開始了，執事正在接引。').ok,false);
 assert.equal(checkWorldFacts(w,'十二峰初選預定下午開始。').ok,true);
 assert.equal(checkWorldFacts(w,'韓守一正準備十二峰初選。').ok,true);
 w.minute=780;
 assert.equal(checkWorldFacts(w,'十二峰初選已經開始了。').ok,true);
});

test('witness-scoped NPC replan changes registrar agenda but not unrelated masters',()=>{
 let w=initialV3World('decision-one');
 const beforeShen=w.npcAgency.agendas.shen.id;
 w=commitV3Turn(w,'我等到下午','山門開始忙碌。','decision-wait',{advanceMinutes:360});
 const registrar=w.npcAgency.agendas.registrar;
 assert.equal(registrar.cause,'NPC事件應變');
 assert.match(registrar.title,/名冊/);
 assert.equal(registrar.location,w.npcs.registrar.where);
 assert.equal(w.npcAgency.agendas.shen.id!==beforeShen,true);
 assert.notEqual(w.npcAgency.agendas.shen.cause,'NPC事件應變');
 assert.ok(w.npcAgency.decisions.some(d=>d.actorId==='registrar'));
 assert.ok(!w.npcAgency.decisions.some(d=>d.actorId==='shen'));
 assert.equal(playerWorld(w).npcAgency,undefined);
 assert.ok(developerWorld(w).npcAgency.decisions.length>0);
 assert.match(gmContext(w,'繼續'),/NPC自主日程/);
});

test('replanning is idempotent for same witnessed event and never invents success',()=>{
 const w=initialV3World('decision-repeat');
 w.day=1;w.minute=600;
 const e={id:'offscreen:fake:one',day:1,minute:590,type:'offscreen',
  text:'收徒名冊需要重新核對',hidden:true,witnesses:['registrar'],source:'living-world'};
 w.events.push(e);
 const first=replanNPCAgendas(w,580,600);
 assert.equal(first.length,1);
 const next=replanNPCAgendas(w,580,600);
 assert.equal(next.length,0);
 assert.equal(w.npcs.registrar.where,'太虛宗山門');
 assert.ok(w.npcAgency.agendas.registrar.title.includes('核對'));
 assert.equal(w.events.filter(x=>x.source==='npc-agency').length,0);
});

test('scene-jump settlement triggers independent NPC plans without accepting player decisions',()=>{
 const w=initialV3World('decision-jump');
 const plan=sceneJumpPlan(w,'直接進到收徒');
 const after=prepareSceneJump(w,plan);
 assert.equal(after.minute,780);
 assert.ok(after.npcAgency.decisions.some(d=>d.actorId==='registrar'));
 assert.equal(after.protagonist.realm,'凡人');
 assert.equal(w.npcAgency.decisions,undefined);
});
