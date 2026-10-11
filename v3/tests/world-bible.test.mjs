import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_BIBLE,CANON_LOCATIONS,REALM_ORDER} from '../server/world-bible.mjs';
import {CHARACTER_BIBLE,CHARACTER_BY_ID,assertCharacterBible} from '../server/character-bible.mjs';
import {loreForGM,npcPortraitForGM} from '../server/lore-retrieval.mjs';
import {initialV3World,validatedWorld,gmContext,playerWorld,developerWorld,editCharacter,nearbyCharacters} from '../server/world.mjs';

test('world bible contains twelve peaks, established orders, role distinctions and sect entry rules',()=>{
 assert.equal(WORLD_BIBLE.sect.peaks.length,12);
 assert.equal(new Set(WORLD_BIBLE.sect.peaks.map(p=>p.id)).size,12);
 for(const name of ['主峰','棲風峰','赤霄峰','天劍峰','玄機峰','丹霞峰','鑄天峰','靈獸峰','戒律峰','青雲峰'])
  assert.ok(WORLD_BIBLE.sect.peaks.some(p=>p.name===name),'missing canon peak '+name);
 const additions=WORLD_BIBLE.sect.peaks.filter(p=>p.source==='expanded');
 assert.deepEqual(additions.map(p=>p.name),['望月峰','長明峰']);
 assert.equal(REALM_ORDER.length,10);
 assert.equal(WORLD_BIBLE.sect.disciples.length,4);
 assert.match(WORLD_BIBLE.sect.recruitment.boundaries.join('；'),/不代表直接分配棲風峰/);
 assert.ok(CANON_LOCATIONS.includes('藏經樓'));
 assert.ok(CANON_LOCATIONS.includes('太虛宗執事處'));
 assert.ok(WORLD_BIBLE.continuity.exclusions.some(x=>x.includes('舊世界線太玄仙門')));
});

test('every NPC has unique ID, personality, realm, aptitude, method, vulnerability and sources',()=>{
 const count=assertCharacterBible();
 assert.ok(count>=45,'expected extensive cast; got '+count);
 for(const c of CHARACTER_BIBLE){
  assert.ok(c.aptitude.grade);
  assert.ok(c.fieldSources.realm);
  assert.ok(c.fieldSources.roots);
  assert.ok(c.background.length>8,c.name);
  assert.ok(c.speech.length>4,c.name);
  assert.ok(c.flaw.length>3,c.name);
  assert.ok(Array.isArray(c.ties),c.name);
 }
 assert.equal(CHARACTER_BY_ID.shen.realm,'元嬰後期');
 assert.equal(CHARACTER_BY_ID.shen.roots,'純風靈根');
 assert.equal(CHARACTER_BY_ID.yan.roots,'風金雙靈根');
 assert.equal(CHARACTER_BY_ID.jiang.roots,'風水雙靈根');
 assert.equal(CHARACTER_BY_ID.gu.realm,'築基中期');
 assert.equal(CHARACTER_BY_ID.xie_lingchuan.realm,'築基後期');
 assert.equal(CHARACTER_BY_ID.chen_jing.roots,'火土中品靈根');
 assert.equal(CHARACTER_BY_ID.luo_xiaochuan.age,11);
 assert.equal(CHARACTER_BY_ID.su_he.age,14);
 assert.equal(CHARACTER_BY_ID.jian_wuming.peak,'天劍山');
});

test('new worlds seed roster and private canon without inventing past player relationships',()=>{
 const world=initialV3World('world-bible');
 assert.equal(Object.keys(world.npcs).length,CHARACTER_BIBLE.length);
 assert.equal(world.protagonist.realm,'凡人');
 assert.equal(world.protagonist.spiritualRoot,'未測定');
 assert.deepEqual(nearbyCharacters(world).map(c=>c.id),['registrar']);
 assert.equal(world.npcs.shen.relationships.player.trust,0);
 assert.equal(world.npcs.shen.memories.length,0);
 assert.equal(world.npcs.shen.where,'棲風峰');
 assert.equal(world.npcs.yan.where,'棲風峰');
 assert.equal(world.npcs.luo_chengan.where,'青石鎮');
 assert.equal(world.npcs.guide.where,'外門報到處');
 assert.equal(world.npcs.jian_wuming.where,'天劍山');
 assert.equal(world.npcs.xie_lingchuan.where,'天劍峰');
 assert.ok(world.npcs.shen.aptitude.grade);
 assert.ok(world.npcs.shen.methods.includes('御風身法'));
 assert.ok(world.npcs.shen.privateLore);
 assert.ok(!('npcs' in playerWorld(world)));
 assert.ok(!('worldBible' in playerWorld(world)));
 assert.equal(developerWorld(world).characters.shen.aptitude.grade,'天驕');
 assert.equal(developerWorld(world).worldBible.sect.peaks.length,12);
});

test('existing D1 NPC changes/memories preserved while new records and missing fields get added',()=>{
 const world=initialV3World('legacy-bible');
 world.npcs.shen={id:'shen',name:'沈滄月',where:'太虛宗主峰',goal:'調查靈脈',
  memories:[{id:'m1',eventId:'turn:1',text:'師父曾經巡查'}],
  relationships:{player:{trust:18}}};
 delete world.npcs.xie_lingchuan;
 delete world.npcs.chen_jing;
 delete world.bibleVersion;
 const next=validatedWorld(world);
 assert.equal(next.npcs.shen.goal,'調查靈脈');
 assert.equal(next.npcs.shen.where,'太虛宗主峰');
 assert.equal(next.npcs.shen.relationships.player.trust,18);
 assert.equal(next.npcs.shen.memories.length,1);
 assert.equal(next.npcs.shen.realm,'元嬰後期');
 assert.equal(next.npcs.shen.aptitude.grade,'天驕');
 assert.equal(next.npcs.xie_lingchuan.realm,'築基後期');
 assert.equal(next.npcs.chen_jing.name,'陳景');
 assert.ok(next.bibleVersion);
 const modified=editCharacter(next,'shen',{relationship:{trust:22}},'只改動關係');
 assert.equal(modified.npcs.shen.relationships.player.trust,22);
 assert.equal(modified.npcs.shen.aptitude.grade,'天驕');
});

test('scene-specific lore selection: recruitment procedures are always delivered at mountain gate',()=>{
 const world=initialV3World('recruit');
 const prompt=gmContext(world,'直接開始');
 assert.match(prompt,/測出靈根≠自動拜師/);
 assert.match(prompt,/資質與心性初評/);
 assert.match(prompt,/同意進行流程，不等於已經動手按石/);
 assert.match(prompt,/【在場NPC：韓守一／registrar】/);
 assert.match(prompt,/資質良/);
 assert.doesNotMatch(prompt,/洛雲／/);
 assert.doesNotMatch(prompt,/【在場NPC：沈滄月／shen】/);
 assert.doesNotMatch(prompt,/韓鐵山：師父/);
 assert.ok(prompt.length<=12000);
});

test('topic retrieval injects applicable peak and rank laws, without importing private far-away memories',()=>{
 const world=initialV3World('topics');
 const p=gmContext(world,'天劍峰的謝凌川是築基嗎？');
 assert.match(p,/天劍峰/);
 assert.match(p,/境界及勝負/);
 assert.match(p,/謝凌川/);
 assert.doesNotMatch(p,/【在場NPC：謝凌川/);
 assert.doesNotMatch(p,/過往世界線內門大比奪魁/);
 const q=gmContext(world,'宗門有哪些峰');
 assert.match(q,/望月峰/);
 assert.match(q,/長明峰/);
 assert.match(q,/戒律峰/);
 assert.ok(q.length<=12000);
});

test('GM sees full detail for present NPC only and the developer sees sources',()=>{
 const world=initialV3World('profile');
 const moved=editCharacter(world,'yan',{where:'太虛宗山門'},'test','dev');
 const prompt=gmContext(moved,'妳是哪位師姐');
 assert.match(prompt,/【在場NPC：晏清辭／yan】/);
 assert.match(prompt,/風金雙靈根/);
 assert.match(prompt,/責任感強/);
 assert.match(prompt,/對洛河：好感0/);
 assert.match(prompt,/【只有晏清辭經歷或獲知的事件】/);
 assert.ok(prompt.length<=12000);
 const dev=developerWorld(moved);
 assert.equal(dev.characters.yan.fieldSources.roots,'established');
 assert.equal(dev.characters.yan.fieldSources.aptitude,'expanded');
 assert.ok(dev.worldBible.continuity.exclusions.length>0);
});

test('local lore retrieval honors an explicit budget and avoids importing old timeline',()=>{
 const world=initialV3World('budget');
 const lore=loreForGM(world,'太虛宗收徒及築基',1000);
 assert.ok(lore.length<=1000);
 assert.match(lore,/太虛宗/);
 assert.match(npcPortraitForGM(world.npcs.shen),/元嬰後期/);
 assert.ok(!WORLD_BIBLE.continuity.line.includes('太玄仙門'));
});
