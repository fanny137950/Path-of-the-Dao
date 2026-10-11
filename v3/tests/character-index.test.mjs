import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTER_BIBLE} from '../server/character-bible.mjs';
import {WORLD_BIBLE} from '../server/world-bible.mjs';
import {initialV3World,editCharacter,developerWorld,playerWorld} from '../server/world.mjs';
import {organizeCharacters,countCharacters} from '../server/character-index.mjs';

const peaks=WORLD_BIBLE.sect.peaks;
const all=initialV3World('directory');
const grouped=(world=all,query='')=>organizeCharacters(world.npcs,{peaks,query});
const flat=groups=>groups.flatMap(g=>g.sections.flatMap(s=>s.ranks.flatMap(r=>r.people)));
const faction=(groups,id)=>groups.find(g=>g.id===id);
const section=(group,id)=>group.sections.find(s=>s.id===id);

test('entire 57-character canon appears exactly once in categorized developer directory',()=>{
 const groups=grouped();
 const people=flat(groups);
 assert.equal(CHARACTER_BIBLE.length,57);
 assert.equal(countCharacters(groups),57);
 assert.equal(people.length,57);
 assert.equal(new Set(people.map(p=>p.id)).size,57);
 assert.deepEqual(new Set(people.map(p=>p.id)),new Set(Object.keys(all.npcs)));
 assert.equal(groups[0].name,'太虛宗');
 assert.equal(groups[1].name,'青石鎮 · 洛河家人');
 assert.equal(faction(groups,'family').count,3);
});

test('taixu uses structured peak order and per-peak seniority, not alphabetical flat list',()=>{
 const groups=grouped();
 const sect=faction(groups,'taixu');
 const peakIds=sect.sections.map(s=>s.id);
 assert.equal(peakIds[0],'山門');
 assert.equal(peakIds[1],'主峰');
 assert.equal(peakIds[2],'棲風峰');
 assert.equal(peakIds[3],'赤霄峰');
 assert.ok(peakIds.indexOf('青雲峰')<peakIds.indexOf('望月峰'));
 assert.ok(peakIds.includes('長明峰'));
 assert.deepEqual(flat([{sections:[section(sect,'棲風峰')]}]).slice(0,4).map(c=>c.id),
  ['shen','yan','jiang','gu']);
 assert.equal(section(sect,'主峰').ranks[0].name,'宗主與掌門');
 assert.equal(section(sect,'主峰').ranks[0].people[0].name,'裴玄真');
 assert.equal(section(sect,'山門').ranks[0].name,'宗門執事與職務人員');
 assert.equal(section(sect,'山門').ranks[0].people[0].name,'韓守一');
});

test('factions are separate from Taixu sword peak and player family',()=>{
 const groups=grouped();
 assert.ok(flat([{sections:[section(faction(groups,'taixu'),'天劍峰')]}]).some(c=>c.name==='謝凌川'));
 assert.deepEqual(flat([faction(groups,'天劍山')]).map(c=>c.name),['劍無鳴']);
 assert.deepEqual(flat([faction(groups,'萬獸谷')]).map(c=>c.name),['白牧河']);
 assert.deepEqual(flat([faction(groups,'北荒妖庭')]).map(c=>c.name),['拓跋蒼']);
 assert.deepEqual(flat([faction(groups,'family')]).map(c=>c.name).sort(),
  ['柳氏','洛小川','洛成安'].sort());
});

test('search combines Chinese names, realm, affiliation, roots and aptitude without duplicating entries',()=>{
 for(const [query,name] of [
  ['沈滄月','沈滄月'],['棲風峰','江離'],['聚氣','陳景'],
  ['純風靈根','沈滄月'],['天驕','謝凌川'],['收徒執事','韓守一'],
 ]){
  const groups=grouped(all,query),people=flat(groups);
  assert.ok(people.some(p=>p.name===name),query);
  assert.equal(people.length,new Set(people.map(p=>p.id)).size,query);
  assert.equal(countCharacters(groups),people.length);
 }
 assert.equal(grouped(all,'不存在的名字').length,0);
});

test('group by affiliation, not runtime where: editing character location leaves home peak intact',()=>{
 const moved=editCharacter(all,'shen',{where:'太虛宗山門'},'test');
 assert.equal(moved.npcs.shen.where,'太虛宗山門');
 const groups=grouped(moved);
 const shen=flat([{sections:[section(faction(groups,'taixu'),'棲風峰')]}]).find(c=>c.id==='shen');
 assert.equal(shen.where,'太虛宗山門');
 assert.equal(shen.peak,'棲風峰');
 assert.equal(flat([{sections:[section(faction(groups,'taixu'),'山門')]}]).some(c=>c.id==='shen'),false);
 assert.equal(grouped(moved,'太虛宗山門').length>0,true);
 assert.equal(all.npcs.shen.where,'棲風峰');
});

test('hierarchy is developer-only and does not expose private NPC profiles to player',()=>{
 const dev=developerWorld(all);
 const publiclyVisible=playerWorld(all);
 assert.equal(countCharacters(organizeCharacters(dev.characters,{peaks})),57);
 assert.ok(dev.characters.shen.privateLore);
 assert.equal(publiclyVisible.characters,undefined);
 assert.equal(publiclyVisible.worldBible,undefined);
});
