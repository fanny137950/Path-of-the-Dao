import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GM_INSTRUCTIONS,ROLEPLAY_PROMPT,TIMELINE_ISOLATION} from '../server/gm-prompt.mjs';
import {initialV3World,commitV3Turn,gmContext,validatedWorld,playerWorld} from '../server/world.mjs';
const make=()=>({...initialV3World('immersive'),gmManaged:true});
const raw=(narration,state)=>narration+'\n<!--GM_STATE:'+JSON.stringify(state)+'-->';

test('runtime respects core world rules and isolates NPC knowledge from older relationship examples',()=>{
 assert.match(ROLEPLAY_PROMPT,/NPC 的性格基準來源/);
 assert.doesNotMatch(ROLEPLAY_PROMPT,/\*\*沈滄月｜師父\*\*/);
 assert.match(TIMELINE_ISOLATION,/新世界線中未成立的關係視為不存在/);
 assert.ok(GM_INSTRUCTIONS.includes(TIMELINE_ISOLATION));
 assert.ok(GM_INSTRUCTIONS.length<20000);
 const route=readFileSync(new URL('../../app/api/v3/world/route.ts',import.meta.url),'utf8');
 assert.doesNotMatch(route,/sceneJumpPlan|currentTurnDirective|checkWorldFacts|stabilizeDecisiveAction|assessActionResolution/);
});

test('asking about the peak master retrieves the real character and no procedural warnings',()=>{
 const w=make();
 const context=gmContext(w,'我可以拜棲風峰風主為施媽');
 const data=JSON.parse(context.slice(context.indexOf('{')));
 const master=data.characters.find(a=>a.name==='沈滄月');
 assert.ok(master);
 assert.equal(master.personality,'依核心框架的人格基準');
 assert.doesNotMatch(context,/尚未拜師|請等待玩家實際動作|收徒規則|本回合優先結算|本回合執行焦點/);
 assert.equal(data.protagonist.spiritualRoot,'未測定');
});

test('GM can complete testing, pass time and arrive without keyword commands or a preseeded result',()=>{
 const w=make();
 const n='韓守一記下測試結果：「土靈根。」午後，洛河已在棲風殿內。';
 const next=commitV3Turn(w,'繼續 然後直接選師傅',raw(n,{
  elapsedMinutes:360,
  protagonist:{spiritualRoot:'土靈根',evidence:'韓守一記下測試結果：「土靈根。」'},
  move:{to:'棲風殿',evidence:'午後，洛河已在棲風殿內。'}
 }),'test');
 assert.equal(next.protagonist.spiritualRoot,'土靈根');
 assert.equal(next.location,'棲風殿');
 assert.equal(next.minute,840);
 assert.equal(w.minute,480);
 assert.equal(next.events.filter(e=>e.type==='conversation').length,1);
});

test('established apprenticeship, possessions and NPC arrival persist without rewriting old saves',()=>{
 let w=make();
 const master=Object.values(w.npcs).find(a=>a.name==='沈滄月');
 const n='沈滄月在棲風殿落座，收下洛河為徒，給了她三张符籙。';
 w=commitV3Turn(w,'拜師',raw(n,{
  protagonist:{master:'沈滄月',inventory:[{name:'護身符',quantity:3}],evidence:n},
  changes:[{id:master.id,where:'棲風殿',goal:'教導新弟子',evidence:n}]
 }),'admit');
 const restored=validatedWorld(JSON.parse(JSON.stringify(w)));
 assert.equal(restored.protagonist.master,'沈滄月');
 assert.equal(restored.protagonist.inventory[0].quantity,3);
 assert.equal(restored.npcs[master.id].where,'棲風殿');
 assert.doesNotMatch(gmContext(restored,'師父好'),/當前新存檔尚未拜師/);
 assert.equal(playerWorld(restored).protagonist.master,'沈滄月');
});

test('basic state validation still rejects unsupported evidence and invalid resources',()=>{
 const w=make();
 const next=commitV3Turn(w,'繼續',raw('韓守一翻過名冊。',{
  protagonist:{realm:'化神',evidence:'並未出現的突破'},
  move:{to:'棲風殿',evidence:'並未出現的抵達'}
 }),'invalid');
 assert.equal(next.protagonist.realm,w.protagonist.realm);
 assert.equal(next.location,w.location);
 const after=commitV3Turn(next,'繼續',raw('洛河清點了隨身財物。',{
  protagonist:{spiritStones:-5,inventory:[{name:'符籙',quantity:-1}],evidence:'洛河清點了隨身財物。'}
 }),'negative');
 assert.equal(after.protagonist.spiritStones,undefined);
 assert.equal(after.protagonist.inventory,undefined);
});
