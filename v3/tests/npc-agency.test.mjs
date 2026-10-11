import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,validatedWorld,commitV3Turn,developerWorld,playerWorld,gmContext,editCharacter} from '../server/world.mjs';
import {ensureNPCAgency,initialNPCAgency,advanceNPCAgency,npcAgencyForGM} from '../server/npc-agency.mjs';

test('all 57 established NPCs have persistent independent, timed daily duties',()=>{
 const world=initialV3World('npc-agency-initial');
 const agency=ensureNPCAgency(world);
 assert.equal(Object.keys(agency.agendas).length,Object.keys(world.npcs).length);
 assert.equal(agency.agendas.registrar.title,'核對報名名冊與測試結果');
 assert.equal(agency.agendas.registrar.location,'太虛宗山門');
 assert.equal(agency.agendas.shen.location,'棲風峰');
 assert.ok(agency.agendas.shen.end>480);
 const copy=validatedWorld(JSON.parse(JSON.stringify(world)));
 assert.equal(copy.npcAgency.agendas.shen.id,agency.agendas.shen.id);
 assert.match(gmContext(world,'繼續'),/NPC自主日程/);
 assert.equal(playerWorld(world).npcAgency,undefined);
 assert.ok(developerWorld(world).npcAgency.agendas.shen);
});

test('short player conversation does not teleport current NPC or end his scene duty',()=>{
 let world=initialV3World('npc-short-chat');
 world=commitV3Turn(world,'很強嗎','韓守一抬起頭，耐心解釋測試結果。','npc-short-1');
 assert.equal(world.npcs.registrar.where,'太虛宗山門');
 assert.equal(world.npcAgency.agendas.registrar.location,'太虛宗山門');
 assert.equal(world.events.filter(e=>e.source==='npc-agency'&&e.actorId==='registrar').length,0);
});

test('independent NPC duties resolve offscreen on time, without public revelation',()=>{
 let world=initialV3World('npc-independent');
 // Wait through morning and into afternoon; the faraway peak is not in scene.
 const next=commitV3Turn(world,'我等到下午','山門人群漸多。','npc-wait-1',{advanceMinutes:360});
 const records=next.events.filter(e=>e.source==='npc-agency');
 assert.ok(records.some(e=>e.actorId==='shen'));
 assert.ok(records.every(e=>e.hidden&&e.witnesses.length===1&&e.witnesses[0]===e.actorId));
 assert.ok(next.npcs.shen.knowledge.some(id=>id.startsWith('npc-action:shen:')));
 assert.equal(next.npcs.registrar.where,'太虛宗山門');
 assert.equal(playerWorld(next).npcAgency,undefined);
 assert.equal(playerWorld(next).events,undefined);
 assert.equal(world.events.some(e=>e.source==='npc-agency'),false);
});

test('large time jump produces bounded private summaries, never fabricated thousands of daily events',()=>{
 const world=initialV3World('npc-month');
 const start=480,to=start+50*1440;
 advanceNPCAgency(world,start,to);
 const events=world.events.filter(e=>e.source==='npc-agency');
 assert.ok(events.length<=Object.keys(world.npcs).length);
 assert.ok(events.length>25);
 assert.ok(events.some(e=>e.summaryOnly===true));
 assert.equal(world.npcAgency.agendas.shen.summary,'此期間按職責維持日常，未逐日演算個別細節');
 const size=world.events.length;
 advanceNPCAgency(world,start,to);
 assert.equal(world.events.length,size);
});

test('developer changing goal or location updates only that NPC schedule',()=>{
 const world=initialV3World('npc-dev');
 const previous=world.npcAgency.agendas.shen.id;
 const revised=editCharacter(world,'shen',{goal:'今日專心鑽研風道',where:'棲風峰'},'調整測試','dev');
 assert.equal(revised.npcAgency.agendas.shen.goal,'今日專心鑽研風道');
 assert.equal(revised.npcAgency.agendas.shen.id,previous);
 assert.equal(world.npcs.shen.goal!=='今日專心鑽研風道',true);
});

test('legacy worlds hydrate daily plans without rewinding current clock',()=>{
 const world=initialV3World('npc-migrate');
 delete world.npcAgency;
 world.day=10;world.minute=600;
 validatedWorld(world);
 assert.equal(world.npcAgency.lastAdvancedAt,9*1440+600);
 assert.equal(world.npcAgency.agendas.registrar.start<=9*1440+600,true);
 assert.equal(world.events.filter(e=>e.source==='npc-agency').length,0);
});
