import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn,gmContext,playerWorld,validatedWorld} from '../server/world.mjs';
import {memoryLayers,memoryState,activeThreads,historyArchive,correctMemory} from '../server/memory-system.mjs';
import {standaloneConfig} from '../../scripts/prepare-cloudflare.mjs';
const fresh=()=>({...initialV3World('memory-test'),gmManaged:true});
const reply=(n,s)=>n+'\n<!--GM_STATE:'+JSON.stringify(s)+'-->';
const advance=(w,input,n,s,id)=>commitV3Turn(w,input,reply(n,s),id);
const thread=(patch={})=>({id:'letter',title:'秘密家書',summary:'韓守一等待家人回覆。',status:'open',participants:['registrar'],playerKnown:false,dueAt:600,truth:'家人其實已平安抵達',truthKnownBy:['guide'],...patch});

test('L1 keeps the last question and clears answered open loops rather than repeating them',()=>{
 const question='韓守一放下筆：「妳昨晚去了哪裡？」';
 let w=advance(fresh(),'打招呼',question,{workingMemory:{summary:'韓守一詢問昨夜去處。',openLoops:['妳昨晚去了哪裡？'],participants:['registrar'],evidence:'妳昨晚去了哪裡'}},'q');
 const c=gmContext(w,'沒有啊');assert.match(c,/妳昨晚去了哪裡/);assert.match(c,/openLoops/);
 assert.equal(memoryLayers(w,'沒有啊').L1.playerInput,'沒有啊');
 const n='韓守一看著她，收起名冊，轉身去吃早飯。';
 w=advance(w,'沒有啊',n,{workingMemory:{summary:'交流告一段落，韓守一離開。',openLoops:[],participants:[],evidence:'轉身去吃早飯'}},'a');
 assert.deepEqual(memoryState(w).working.openLoops,[]);
 assert.match(historyArchive(w).at(-1).reply,/妳昨晚去了哪裡/);
});

test('L2 beliefs stay with their explicit knowers and never become every present NPC memory',()=>{
 const w=advance(fresh(),'繼續','韓守一將信收進袖中。',{
  memories:[{text:'韓守一誤以為家人已受傷',kind:'belief',interpretation:'把紅墨誤看成血跡',emotion:'擔憂',knownBy:['registrar'],playerKnown:false}]
 },'belief');
 assert.equal(w.npcs.registrar.memories.at(-1).kind,'belief');
 assert.equal(w.npcs.registrar.memories.at(-1).interpretation,'把紅墨誤看成血跡');
 assert.equal(w.npcs.guide.memories.some(m=>m.text.includes('紅墨')),false);
 assert.doesNotMatch(JSON.stringify(playerWorld(w)),/誤以為|紅墨/);
 assert.match(gmContext(w,'韓守一'),/belief/);
});

test('L3 due dates request GM review; elapsed time never fabricates event results',()=>{
 const w=advance(fresh(),'繼續','洛河望著山門。',{threads:[thread()]},'thread');
 assert.equal(memoryLayers(w,'等待',{advanceMinutes:30*1440}).L3.threads[0].dueForReview,true);
 assert.equal(activeThreads(w)[0].status,'open');
 const later=advance(w,'閉關一個月','一個月後，洛河推開房門。',{elapsedMinutes:30*1440},'month');
 assert.equal(activeThreads(later)[0].status,'open');
 const resolved=advance(later,'繼續','遠處傳來鐘聲。',{threads:[thread({status:'resolved',summary:'韓守一讀到回信。',truth:undefined,truthKnownBy:undefined})]},'resolve');
 assert.equal(activeThreads(resolved)[0].truth,'家人其實已平安抵達');
 assert.equal(resolved.memorySystem.threads.length,2);
 assert.equal(resolved.memorySystem.threads[0].status,'open');
 assert.doesNotMatch(JSON.stringify(playerWorld(resolved)),/秘密家書|家人其實/);
});

test('public event projection omits private truth, knower identities, and old hidden versions',()=>{
 let w=advance(fresh(),'繼續','山門外有人走過。',{threads:[thread()]},'hidden');
 const n='韓守一說：「家人來信報平安了。」';
 w=advance(w,'問候韓守一',n,{threads:[thread({title:'家人的消息',summary:'韓守一收到報平安的信。',status:'resolved',playerKnown:true,evidence:'家人來信報平安了'})]},'public');
 const view=playerWorld(w);assert.equal(view.memory.threads.length,1);
 assert.equal(view.memory.threads[0].status,'resolved');
 assert.doesNotMatch(JSON.stringify(view),/秘密家書|truthKnownBy|家人其實|dueAt/);
 assert.equal(w.memorySystem.threads[0].playerKnown,false);
});

test('invalid evidence and invalid NPC references cannot create authoritative memory',()=>{
 const w=advance(fresh(),'繼續','山門很安靜。',{
  workingMemory:{summary:'已成元嬰',evidence:'成功突破元嬰',openLoops:['無效']},
  threads:[thread({playerKnown:true,evidence:'不存在的原文'}),thread({id:'invalid',truthKnownBy:['unknown']})]
 },'bad');
 assert.equal(memoryState(w).working.summary,'山門很安靜。');
 assert.deepEqual(activeThreads(w),[]);
});

test('L4 retains raw metadata and before/after changes; corrections append an audit version',()=>{
 const w=advance(fresh(),'等待','洛河等了一刻鐘。',{elapsedMinutes:15,threads:[thread()]},'source');
 const before=JSON.stringify(w.events);
 const corrected=correctMemory(w,'letter',{summary:'已核實平安。',status:'resolved'},'原先的回信判斷有誤','owner');
 assert.equal(w.memorySystem.threads.length,1);
 assert.equal(corrected.memorySystem.threads.length,2);
 assert.equal(corrected.events.slice(0,-1).length,w.events.length);
 assert.equal(JSON.stringify(corrected.events.slice(0,-1)),before);
 const history=historyArchive(corrected);
 assert.equal(history[0].source,'開發者修正紀錄');
 assert.match(history[1].rawAnswer,/GM_STATE/);
 assert.ok(history[1].changes.some(c=>c.path==='minute'&&c.after-c.before===15));
 assert.equal(historyArchive(corrected,'判斷有誤').length,1);
 assert.equal(historyArchive(corrected,'',corrected.revision)[0].revision,w.revision);
 assert.throws(()=>correctMemory(w,'letter',{revision:999},'bad','owner'),/不支援/);
 assert.throws(()=>correctMemory(w,'working',{summary:'bad'},'','owner'),/修正原因/);
});

test('archive pagination preserves all source turns and old saves hydrate without losing history',()=>{
 let w=fresh();for(let i=0;i<29;i++)w=commitV3Turn(w,'問候'+i,'韓守一點點頭。','hello'+i);
 const first=historyArchive(w),second=historyArchive(w,'',first.at(-1).revision);
 assert.equal(first.length,25);assert.equal(second.length,4);
 assert.equal(new Set([...first,...second].map(e=>e.id)).size,29);
 delete w.memorySystem;
 const old=validatedWorld(JSON.parse(JSON.stringify(w)));
 assert.equal(old.events.length,29);assert.deepEqual(activeThreads(old),[]);
 assert.doesNotThrow(()=>gmContext(old,'繼續'));
});

test('large save context remains valid JSON within provider input budget and keeps current scene',()=>{
 const w=fresh();
 w.protagonist.inventory=Array.from({length:80},(_,i)=>({name:'靈石'+i+'物'.repeat(74),quantity:999}));
 w.protagonist.skills=Array.from({length:50},(_,i)=>'術'+i+'法'.repeat(74));
 w.protagonist.equipment=Array.from({length:50},(_,i)=>'裝備'+i+'物'.repeat(74));
 w.messages.push({role:'assistant',content:'韓守一問：「剛才的信呢？」'});
 const context=gmContext(w,'沒有啊');
 assert.ok(context.length<24000,String(context.length));
 const packet=JSON.parse(context.slice(context.indexOf('{')));
 assert.match(JSON.stringify(packet.latestExchange),/剛才的信呢/);
 assert.equal(w.protagonist.inventory.length,80,'read-side budgeting cannot delete saved inventory');
});

test('build identity is explicit and malformed hashes are rejected',()=>{
 const base={main:'index.js',assets:{directory:'../client'}};
 const hash='a'.repeat(40);
 assert.equal(standaloneConfig(base,{local:true,revision:hash}).vars.GAME_BUILD_SHA,hash);
 assert.throws(()=>standaloneConfig(base,{local:true,revision:'not-a-hash'}),/Invalid build/);
});

test('latest long scene and player action reach the model verbatim rather than losing the opening',async()=>{
 const {providerConversation}=await import('../server/conversation-memory.mjs');
 const {validConversation}=await import('../server/narrative.mjs');
 const w=fresh();const scene='沈滄月：「昨晚去了哪裡？」'+('山風拂過衣袖。'.repeat(1300));
 w.messages.push({role:'user',content:'回棲風殿'},{role:'assistant',content:scene});
 const messages=providerConversation(w,'沒有啊');
 assert.equal(messages.at(-2).content,scene);assert.equal(messages.at(-1).content,'沒有啊');
 assert.equal(validConversation(messages),true);
});

test('fulfilled promises replace current recall while original knowledge and sources remain archived',()=>{
 const w=advance(fresh(),'我幫你帶茶','韩守一說：「好，替我帶茶。」',{memories:[{kind:'promise',text:'帶茶的約定尚未履行',knownBy:['registrar'],playerKnown:true,evidence:'好，替我帶茶'}]},'promise');
 const id=w.gmMemories[0].id;
 const done=advance(w,'交茶','韓守一接過茶葉：「多謝，說好的茶到了。」',{memories:[{kind:'promise',text:'帶茶的約定已履行',knownBy:['registrar'],playerKnown:true,resolved:true,supersedes:id,evidence:'說好的茶到了'}]},'done');
 assert.equal(done.gmMemories.length,2);
 assert.equal(playerWorld(done).memory.memories.length,1);
 assert.match(playerWorld(done).memory.memories[0].text,/已履行/);
 const packet=JSON.parse(gmContext(done,'韓守一').split('\n').slice(1).join('\n'));
 assert.doesNotMatch(packet.memory,/尚未履行/);
 assert.equal(packet.characters.find(c=>c.id==='registrar').memories.length,1);
 assert.match(historyArchive(done).at(-1).rawAnswer,/尚未履行/);
});

test('save capacity is checked in bytes before D1 is mutated',async()=>{
 const {serializeWorldSave}=await import('../server/memory-system.mjs');
 assert.equal(JSON.parse(serializeWorldSave(fresh())).mode,'v3');
 assert.throws(()=>serializeWorldSave({text:'字'.repeat(650000)}),e=>e.status===413&&/未保存/.test(e.message));
});

test('new NPC names resolve to canonical IDs in the same turn, with current scene presence preserved',()=>{
 const n='溫小舟抱著一包茶走進山門：「我叫溫小舟，幫忙送茶的。」';
 const w=advance(fresh(),'誰來了',n,{newNPCs:[{name:'溫小舟',role:'送茶的'}],workingMemory:{summary:'溫小舟剛到，只有他在洛河身邊。',participants:['溫小舟'],evidence:'溫小舟抱著一包茶走進山門'},memories:[{text:'溫小舟知道這包茶要交給韓守一',knownBy:['溫小舟'],playerKnown:false}],threads:[thread({participants:['溫小舟'],truthKnownBy:['溫小舟']})]},'arrival');
 const npc=Object.values(w.npcs).find(n=>n.name==='溫小舟');
 assert.deepEqual(w.gmMemories[0].knownBy,[npc.id]);
 assert.deepEqual(w.memorySystem.working.participants,[npc.id]);
 assert.deepEqual(activeThreads(w)[0].truthKnownBy,[npc.id]);
 const packet=JSON.parse(gmContext(w,'韓守一呢？').split('\n').slice(1).join('\n'));
 assert.equal(packet.characters.find(c=>c.id===npc.id).present,true);
 assert.equal(packet.characters.find(c=>c.id==='registrar').present,false);
});
