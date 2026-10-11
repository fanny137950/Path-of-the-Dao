import test from 'node:test';
import assert from 'node:assert/strict';
import {
 initialV3World,validatedWorld,playerWorld,developerWorld,gmContext,
 commitV3Turn,parseGMResult,recalledMemories,editCharacter,nearbyCharacters,
} from '../server/world.mjs';

test('creates permanent-character profiles separate from V2',()=>{
 const w=initialV3World('world-1');
 assert.equal(w.mode,'v3');assert.equal(w.revision,0);
 assert.equal(w.protagonist.spiritualRoot,'未測定');
 assert.equal(w.npcs.shen.realm,'元嬰後期');
 assert.equal(w.npcs.registrar.where,'太虛宗山門');
 assert.deepEqual(nearbyCharacters(w).map(c=>c.id),['registrar']);
 assert.ok(!('events' in playerWorld(w)));
 assert.ok(!('characters' in playerWorld(w)));
 assert.equal(developerWorld(w).characters.shen.name,'沈滄月');
});

test('past saves upgrade without changing existing character progress',()=>{
 const old=initialV3World('old');
 old.version=undefined;
 old.npcs.shen={name:'沈滄月',where:'主峰',goal:'秘密任務',knowledge:['old-event']};
 delete old.npcs.registrar;
 const after=validatedWorld(old);
 assert.equal(after,old);
 assert.equal(after.npcs.shen.where,'主峰');
 assert.equal(after.npcs.shen.goal,'秘密任務');
 assert.deepEqual(after.npcs.shen.knowledge,['old-event']);
 assert.equal(after.npcs.registrar.name,'韓守一');
 assert.deepEqual(after.npcs.shen.memories,[]);
});

test('witnesses receive memories; absent characters learn nothing',()=>{
 const old=initialV3World('world-2');
 const next=commitV3Turn(old,'我叫洛河','執事點點頭。','request-1');
 assert.equal(next.revision,1);assert.equal(next.minute,old.minute+5);
 assert.equal(old.events.length,0);assert.equal(next.events.length,1);
 assert.equal(next.messages.at(-1).content,'執事點點頭。');
 assert.equal(next.events[0].witnesses.length,1);
 assert.equal(next.npcs.registrar.memories.length,1);
 assert.equal(next.npcs.shen.memories.length,0);
 assert.equal(next.npcs.registrar.knowledge[0],'turn:1');
 assert.equal(validatedWorld(next),next);
 assert.throws(()=>commitV3Turn(next,'hi','reply','request-1'),/重複/);
 assert.equal(developerWorld(next).characters.registrar.memories.length,1);
 assert.ok(!('characters' in playerWorld(next)));
});

test('private thoughts are not treated as witnessed events',()=>{
 const old=initialV3World('secret');
 const next=commitV3Turn(old,'我心想：這地方不太對勁','執事繼續登記。','request-2');
 assert.deepEqual(next.events[0].witnesses,[]);
 assert.equal(next.npcs.registrar.memories.length,0);
});

test('GM context retrieves older relevant memory, excluding knowledge of absent NPCs',()=>{
 let world=initialV3World('memory');
 world=commitV3Turn(world,'洛河向執事保證明天帶木劍','執事點頭','req-a');
 for(let i=0;i<18;i++)world=commitV3Turn(world,'等候'+i,'執事整理名冊','r-'+i);
 const context=gmContext(world,'執事還記得我承諾帶木劍嗎');
 assert.match(context,/明天帶木劍/);
 assert.match(context,/韓守一/);
 assert.doesNotMatch(context,/沈滄月／shen/);
 assert.ok(recalledMemories(world.npcs.registrar,'木劍').length>0);
});

test('GM metadata is stripped and restricted to witnessed, evidence-backed mood/relationship changes',()=>{
 const w=initialV3World('meta');
 const raw='執事皺起眉頭。\n<!--GM_STATE:{"changes":[{"id":"registrar","evidence":"皺起眉頭","mood":"不悅","relationship":{"favor":-1}},{"id":"shen","evidence":"皺起眉頭","mood":"憤怒","relationship":{"trust":-2}}]}-->';
 const n=commitV3Turn(w,'我插隊',raw,'req-meta');
 assert.equal(n.messages.at(-1).content,'執事皺起眉頭。');
 assert.equal(n.npcs.registrar.mood,'不悅');
 assert.equal(n.npcs.registrar.relationships.player.favor,-1);
 assert.equal(n.npcs.shen.mood,'平靜');
 assert.equal(n.npcs.shen.relationships.player.trust,0);
 assert.equal(parseGMResult('你好').changes.length,0);
 assert.equal(parseGMResult('你好\n<!--GM_STATE:{bad-json}-->').narration,'你好');
});

test('developer patches are audited and do not mutate old world',()=>{
 const w=initialV3World('dev');
 const next=editCharacter(w,'shen',{
  mood:'擔憂',status:'輕傷',where:'太虛宗山門',goal:'查看新弟子',
  cultivationProgress:42,relationship:{trust:20},privateNote:'曾察覺異常氣息',
 },'測試設定','standalone-owner');
 assert.equal(w.npcs.shen.where,'棲風峰');
 assert.equal(next.npcs.shen.where,'太虛宗山門');
 assert.equal(next.npcs.shen.cultivationProgress,42);
 assert.equal(next.npcs.shen.privateNotes[0],'曾察覺異常氣息');
 assert.equal(next.developerAudit.at(-1).operation,'character-edit');
 assert.throws(()=>editCharacter(w,'shen',{realm:'化神'},''),/不允許/);
 assert.throws(()=>editCharacter(w,'shen',{relationship:{trust:200}},''),/關係值/);
});
