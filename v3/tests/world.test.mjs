import test from 'node:test';
import assert from 'node:assert/strict';
import {
 initialV3World,validatedWorld,playerWorld,developerWorld,gmContext,
 commitV3Turn,parseGMResult,recalledMemories,editCharacter,nearbyCharacters,
} from '../server/world.mjs';

test('new V3 is free-form, with detailed people and hidden living-world plans',()=>{
 const world=initialV3World('new-chat');
 assert.equal(world.mode,'v3');
 assert.equal(world.revision,0);
 assert.equal(world.version,4);
 assert.equal(world.protagonist.spiritualRoot,'未測定');
 assert.equal(world.npcs.shen.realm,'元嬰後期');
 assert.deepEqual(nearbyCharacters(world).map(c=>c.id),['registrar']);
 assert.ok(world.living.arcs.length>0);
 assert.deepEqual(playerWorld(world).choices,[]);
 assert.equal(playerWorld(world).phase,'freeform');
 assert.equal(playerWorld(world).living,undefined);
 assert.equal(playerWorld(world).events,undefined);
 assert.equal(developerWorld(world).characters.shen.name,'沈滄月');
});

test('existing character customizations survive loading, V3 state remains isolated',()=>{
 const world=initialV3World('old');
 world.version=3;
 delete world.living;
 world.npcs.shen={name:'沈滄月',where:'主峰',goal:'秘密任務',knowledge:['old-event']};
 delete world.npcs.registrar;
 const after=validatedWorld(world);
 assert.equal(after,world);
 assert.equal(after.npcs.shen.where,'主峰');
 assert.equal(after.npcs.shen.goal,'秘密任務');
 assert.deepEqual(after.npcs.shen.knowledge,['old-event']);
 assert.equal(after.npcs.registrar.name,'韓守一');
 assert.ok(after.living.arcs.length>0);
});

test('chat replies continue without stage gates and record witnesses only',()=>{
 const old=initialV3World('world-2');
 const next=commitV3Turn(old,'你好，我叫洛河','韓守一放下筆：「洛河？我知道。你想先問哪件事？」','request-1');
 assert.equal(next.revision,1);
 assert.ok(next.minute>old.minute);
 assert.equal(old.events.length,0);
 assert.equal(next.events.length,1);
 assert.equal(next.messages.at(-1).content,'韓守一放下筆：「洛河？我知道。你想先問哪件事？」');
 assert.deepEqual(next.events[0].witnesses,['registrar']);
 assert.equal(next.npcs.registrar.memories.length,1);
 assert.equal(next.npcs.shen.memories.length,0);
 assert.equal(validatedWorld(next),next);
 assert.throws(()=>commitV3Turn(next,'hi','reply','request-1'),/重複/);
});

test('private thoughts are not automatically treated as NPC knowledge',()=>{
 const world=initialV3World('private');
 const next=commitV3Turn(world,'我心想：這地方不太對勁','韓守一繼續核對名冊。','request-private');
 assert.deepEqual(next.events[0].witnesses,[]);
 assert.equal(next.npcs.registrar.memories.length,0);
});

test('older relevant memories are retrieved after many turns and offscreen secrets stay private',()=>{
 let world=initialV3World('memory');
 world=commitV3Turn(world,'我答應韓守一明天帶木劍','韓守一點了點頭。','req-0');
 for(let i=1;i<=24;i++)
  world=commitV3Turn(world,'我跟韓守一閒聊第'+i+'件小事','韓守一回答了幾句。','req-'+i);
 assert.ok(world.living.chapters.length>=2);
 const context=gmContext(world,'韓守一還記得我承諾帶木劍嗎');
 assert.match(context,/明天帶木劍/);
 assert.match(context,/韓守一/);
 assert.doesNotMatch(context,/沈滄月／shen/);
 assert.ok(recalledMemories(world.npcs.registrar,'木劍').length>0);
 assert.ok(context.length<=12000);
});

test('structured changes are limited to real nearby NPCs and supporting text',()=>{
 const world=initialV3World('meta');
 const raw='韓守一皺起眉頭。\n<!--GM_STATE:{"changes":[{"id":"registrar","evidence":"皺起眉頭","mood":"不悅","relationship":{"favor":-1}},{"id":"shen","evidence":"皺起眉頭","mood":"憤怒","relationship":{"trust":-2}}]}-->';
 const result=commitV3Turn(world,'我插隊',raw,'req-meta');
 assert.equal(result.messages.at(-1).content,'韓守一皺起眉頭。');
 assert.equal(result.npcs.registrar.mood,'不悅');
 assert.equal(result.npcs.registrar.relationships.player.favor,-1);
 assert.equal(result.npcs.shen.mood,'平靜');
 assert.equal(result.npcs.shen.relationships.player.trust,0);
 assert.equal(parseGMResult('你好').changes.length,0);
 assert.equal(parseGMResult('你好\n<!--GM_STATE:{bad-json}-->').narration,'你好');
});

test('developer patches remain auditable, unauthorized fields cannot change',()=>{
 const world=initialV3World('dev');
 const next=editCharacter(world,'shen',{
  mood:'擔憂',status:'輕傷',where:'太虛宗山門',goal:'查看新弟子',
  cultivationProgress:42,relationship:{trust:20},privateNote:'曾察覺異常氣息',
 },'測試設定','owner');
 assert.equal(world.npcs.shen.where,'棲風峰');
 assert.equal(next.npcs.shen.where,'太虛宗山門');
 assert.equal(next.npcs.shen.cultivationProgress,42);
 assert.equal(next.npcs.shen.privateNotes[0],'曾察覺異常氣息');
 assert.equal(next.developerAudit.at(-1).operation,'character-edit');
 assert.equal(editCharacter(world,'shen',{realm:'化神初期'},'測試').npcs.shen.realm,'化神初期');
 assert.throws(()=>editCharacter(world,'shen',{realm:'化神無上境'},''),/無效修為/);
 assert.throws(()=>editCharacter(world,'shen',{password:'x'},''),/不允許/);
});

test('travel happens on confirmed arrival, not simply because GM requests a move',()=>{
 const world=initialV3World('travel');
 const raw='洛河沿石階走上山，終於抵達棲風峰。\n<!--GM_STATE:{"move":{"to":"棲風峰","evidence":"終於抵達棲風峰"},"changes":[]}-->';
 const yes=commitV3Turn(world,'我前往棲風峰',raw,'req-go');
 assert.equal(yes.location,'棲風峰');
 assert.equal(yes.minute,510);
 assert.equal(yes.events[0].destination,'棲風峰');
 assert.equal(yes.npcs.shen.memories.length,0);
 assert.match(gmContext(yes,'有人在嗎'),/沈滄月/);
 const no=commitV3Turn(world,'我待在原地',raw,'req-no');
 assert.equal(no.location,'太虛宗山門');
});

test('empty or safety-classifier responses never commit time or memory',()=>{
 const world=initialV3World('invalid');
 assert.throws(()=>commitV3Turn(world,'繼續','User Safety: safe','req-fail'),/未存檔/);
 assert.equal(world.revision,0);
 assert.equal(world.messages.length,1);
});
