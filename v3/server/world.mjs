import {isNonNarrative,requireNarrative,visibleNarrative} from './narrative.mjs';
import {initialScene,sceneOf,updateScene,sceneContext} from './scene-context.mjs';
import {initialLivingWorld,elapsedMinutes,timeCost,advanceLivingWorld,maybeWriteChapter,recallChapters,worldPlanForGM} from './living-world.mjs';
import {pendingRootResult,rootResultConfirmed} from './action-rules.mjs';
import {WORLD_BIBLE,CANON_LOCATIONS,WORLD_BIBLE_VERSION} from './world-bible.mjs';
import {CHARACTER_BIBLE} from './character-bible.mjs';
import {loreForGM,npcPortraitForGM} from './lore-retrieval.mjs';
import {suggestedActions} from './action-suggestions.mjs';
import {playerQuestJournal} from './player-journal.mjs';
import {sceneConversationForGM,episodicMemoriesForGM} from './conversation-memory.mjs';
import {hydrateDurableMemory,updateDurableMemory,recallDurableMemory} from './durable-memory.mjs';
import {initialEventCalendar,ensureEventCalendar,addScheduledEvent,advanceEventCalendar,eventCalendarForGM} from './event-calendar.mjs';
import {BUILTIN_EVENT_TEMPLATES,eventSourceCategory,GAME_YEAR_DAYS} from './event-templates.mjs';
import {initialNPCAgency,ensureNPCAgency,advanceNPCAgency,npcAgencyForGM} from './npc-agency.mjs';
import {registerNamedNPCs} from './npc-registration.mjs';
import {ensureDailyTick,settleWorldDays,dailyTickForGM} from './world-daily-tick.mjs';
/* Authoritative V3 character registry and per-character memories. No D1 schema changes. */
export const V3_INTRO='太虛宗山門，晨光穿過石階旁的古松。今日正值收徒大典。\n\n十五歲的洛河來到山門時，韓守一正為新弟子核對名冊。附近有人測靈根，有人與同伴低聲交談。\n\n韓守一抬頭看了她一眼：「洛河？名冊上有你。想先問什麼，或直接開始測試，都可以。」\n\n山門裡仍有人來往，宗門的日常不會為誰停下。';
export const MOODS=['平靜','愉快','好奇','警惕','不悅','憤怒','擔憂','疲憊','悲傷','緊張'];
export const CONDITIONS=['健康','輕傷','受傷','重傷','休養'];
export const LOCATIONS=CANON_LOCATIONS;
const clone=x=>structuredClone(x);
const shorten=(x,max=180)=>typeof x==='string'?x.trim().slice(0,max):'';
const clamp=(n,min=-100,max=100)=>Math.min(max,Math.max(min,n));
const relationship=()=>({favor:0,trust:0,respect:0,impression:'尚未熟識'});
const whereFromRoster=actor=>{
 if(actor.id==='registrar')return '太虛宗山門';
 if(actor.id==='guide')return '外門報到處';
 if(actor.peak==='主峰')return '太虛宗主峰';
 if(CANON_LOCATIONS.includes(actor.peak))return actor.peak;
 if(actor.peak==='山門')return '太虛宗山門';
 return actor.peak;
};
const rosterNpc=actor=>({
 ...clone(actor),
 where:whereFromRoster(actor),
 relationships:{player:relationship()},
 memories:[],knowledge:[],privateNotes:[],
});
export const NPCS=Object.freeze(Object.fromEntries(CHARACTER_BIBLE.map(actor=>[
 actor.id,rosterNpc(actor)
])));

export function initialV3World(id){
 const initial={id,mode:'v3',version:4,revision:0,minute:480,day:1,location:'太虛宗山門',
  protagonist:{name:'洛河',age:15,gender:'女',hometown:'青石鎮',
   family:clone(WORLD_BIBLE.protagonist.family),
   aptitude:{grade:'未知',description:'尚未完成靈根與資質測試；不能僅因往昔世界線直接認定。'},
   realm:'凡人',spiritualRoot:'未測定'},
  npcs:clone(NPCS),npcAgency:null,eventCalendar:initialEventCalendar(),memoryLedger:{version:1,entries:[]},events:[],messages:[{role:'assistant',content:V3_INTRO}],developerAudit:[],living:initialLivingWorld(),scene:initialScene(),bibleVersion:WORLD_BIBLE_VERSION,legacyNPCBackfillVersion:1};
 initial.npcAgency=initialNPCAgency(initial);
 ensureDailyTick(initial);
 return initial;
}
export function validatedWorld(value){
 if(!value||value.mode!=='v3'||!Array.isArray(value.messages)||!Array.isArray(value.events)
 ||!Number.isInteger(value.minute)||!Number.isInteger(value.revision)||!value.npcs
 ||typeof value.npcs!=='object'||!value.protagonist)throw Error('世界資料損毀');
 value.version=4;
 value.bibleVersion=Number.isInteger(value.bibleVersion)?value.bibleVersion:WORLD_BIBLE_VERSION;
 value.protagonist.gender??='女';
 value.protagonist.hometown??='青石鎮';
 value.protagonist.family??=clone(WORLD_BIBLE.protagonist.family);
 value.protagonist.aptitude??={grade:'未知',description:'尚未完成完整資質評估'};
 value.living??=initialLivingWorld();
 ensureEventCalendar(value);
 hydrateDurableMemory(value);
 value.scene??=sceneOf(value);
 value.developerAudit??=[];
 for(const [id,defaults] of Object.entries(NPCS)){
  const original=value.npcs[id]||{};
  value.npcs[id]={...clone(defaults),...original,id,
   relationships:{player:{...relationship(),...original.relationships?.player}},
   memories:Array.isArray(original.memories)?original.memories:[],
   knowledge:Array.isArray(original.knowledge)?original.knowledge:[],
   privateNotes:Array.isArray(original.privateNotes)?original.privateNotes:[]};
 }
 for(const [id,c] of Object.entries(value.npcs)){
  if(!c||typeof c!=='object'||c.id!==id)throw Error('人物資料損毀');
  c.memories=Array.isArray(c.memories)?c.memories:[];
  c.knowledge=Array.isArray(c.knowledge)?c.knowledge:[];
  c.privateNotes=Array.isArray(c.privateNotes)?c.privateNotes:[];
  c.relationships={player:{...relationship(),...c.relationships?.player}};
 }
 // One-time conservative migration for earlier saved games in which named
 // speakers such as 葉沖 introduced themselves but were never written to D1.
 // Do not reconstruct unverifiable private backgrounds or replay old events.
 if(value.legacyNPCBackfillVersion!==1){
  for(const m of value.messages.slice(-80)){
   if(m.role==='assistant'&&!isNonNarrative(m.content))
    registerNamedNPCs(value,visibleNarrative(m.content),[]);
  }
  value.legacyNPCBackfillVersion=1;
 }
 ensureNPCAgency(value);
 ensureDailyTick(value);
 return value;
}
export function playerWorld(world){
 return {id:world.id,revision:world.revision,day:world.day,minute:world.minute,
 location:world.location,protagonist:world.protagonist,
  // Keep old D1 event history untouched, but do not render legacy classifier
  // outputs as if they were a character's dialogue.
  messages:world.messages.map(m=>m.role==='assistant'
   ?{...m,content:isNonNarrative(m.content)
      ?'（先前免費模型的回應無效，已排除在遊戲劇情之外。）'
      :visibleNarrative(m.content)}:m),
  phase:'freeform',choices:[],suggestions:suggestedActions(world),journal:playerQuestJournal(world)};
}
export function developerWorld(world){
 return {world:world.id,revision:world.revision,day:world.day,minute:world.minute,
  location:world.location,bibleVersion:WORLD_BIBLE_VERSION,
  worldBible:clone(WORLD_BIBLE),protagonist:clone(world.protagonist),
  characters:clone(world.npcs),events:clone(world.events.slice(-25)),
  npcAgency:clone(ensureNPCAgency(world)),
  dailyTick:clone(ensureDailyTick(world)),
  eventCalendar:clone(ensureEventCalendar(world)),
  eventTemplates:clone(BUILTIN_EVENT_TEMPLATES),gameYearDays:GAME_YEAR_DAYS,
  livingArcs:clone(world.living?.arcs||[]),
  audit:clone((world.developerAudit||[]).slice(-25))};
}
const presentIds=world=>Object.keys(world.npcs).filter(id=>world.npcs[id].where===world.location);
export const nearbyCharacters=world=>presentIds(world).map(id=>world.npcs[id]);
function privacyHint(text){
 return /(?:心想|心裡想|心中想|心底想|暗想|腦海裡|默想|在心裡|暗自思索|偷偷想)/.test(text);
}
function terms(text){
 const matches=(text.match(/[\u3400-\u9fff]{2,}|[a-zA-Z0-9]{3,}/g)||[]);
 const arr=[];
 for(const word of matches){
  if(/[\u3400-\u9fff]/.test(word)&&word.length>2){for(let i=0;i<word.length-1;i++)arr.push(word.slice(i,i+2));}
  else arr.push(word.toLowerCase());
 }
 return new Set(arr);
}
export function recalledMemories(actor,query,limit=8){
 const keys=terms(query),mem=actor.memories||[];
 return mem.map((m,i)=>({
  m,score:[...terms(m.text||'')].filter(k=>keys.has(k)).length*8+(m.importance||1)*2+i/Math.max(1,mem.length)
 })).sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.m);
}
export function gmContext(world,userText){
 const badEvents=new Set(world.events.filter(e=>isNonNarrative(e.reply)).map(e=>e.id));
 const present=nearbyCharacters(world);
 const people=present.map(actor=>{
  const personal=(actor.memories||[]).filter(m=>!badEvents.has(m.eventId));
  const memory=recalledMemories({...actor,memories:personal},userText,6)
   .map(m=>'第'+m.day+'日・'+m.kind+'：'+shorten(visibleNarrative(m.text),200)).join('；');
  const notes=actor.privateNotes?.length?
   '【GM私密備註（不代表其他人已知）】'+actor.privateNotes.slice(-2).join('；'):'';
  return npcPortraitForGM(actor)+
   '\n【只有'+actor.name+'經歷或獲知的事件】'+(memory||'沒有相關舊事')+'。'+notes;
 }).join('\n');

 const durable=recallDurableMemory(world,userText,{limit:5,maxChars:1250});
 const chapters=recallChapters(world,userText,3)
  .map(c=>'【舊章節第'+c.from+'—'+c.to+'回合】'+shorten(c.text,650)).join('\n');
 const expectedRoot=pendingRootResult(world,userText);
 const rootRule=expectedRoot?'【本回合優先結算】洛河正在把手掌按到測靈石表面。請直接描寫陣紋與結果，韓守一應宣布靈根「'+expectedRoot+'」。不得把整顆測靈石說成洛河拿起或放下的物件，不得停在等待測試結果。只有真正被阻止時才能不公布結果。':'';
 const scene='【客觀世界】第'+world.day+'日 '+Math.floor(world.minute/60)+':' +
  String(world.minute%60).padStart(2,'0')+'，地點'+world.location+'。洛河，'+
  world.protagonist.age+'歲，境界'+world.protagonist.realm+'，靈根'+world.protagonist.spiritualRoot+'。';
 const core=[
  scene.slice(0,500),
  sceneContext(world,userText).slice(0,850),
  ('【現場人物】'+(present.map(x=>x.name).join('、')||'無已登記角色')+'。未在場的人不能突然知曉現場私事。').slice(0,220),
  // Keep the *contiguous* latest conversation as guaranteed context, not
  // optional tail content dropped by an oversized quest or NPC dossier.
  sceneConversationForGM(world,userText,5700),
  '【洛河最新輸入】'+userText,
  rootRule,
  '【GM主動性】先判斷最新玩家輸入究竟是台詞、立即動作、內心想法或幕外快轉。已宣告的動作必須當回合處理，不得改成要求玩家再選一次。NPC保有自主性，但不能替洛河做主。'
 ].filter(Boolean);
 const optional=[
  people.slice(0,1500),
  loreForGM(world,userText,1050),
  episodicMemoriesForGM(world,userText,850),
  eventCalendarForGM(world,650),
  npcAgencyForGM(world,400),
  dailyTickForGM(world,150),
  worldPlanForGM(world).slice(0,200),
  ('【較遠的重要舊事（GM核對用，非所有NPC共有記憶）】\n'+durable).slice(0,500),
  chapters.slice(0,120)
 ].filter(Boolean);
 // Reserve the active dialogue and newest action before any optional records.
 // Optional records may shrink, never silently displace the user's latest turn.
 const limit=11800,coreText=core.join('\n\n');
 let head=coreText;
 for(const item of optional){
  const left=limit-head.length-2;
  if(left<=0)break;
  // Preserve each optional section as a whole when possible.
  if(item.length+2<=left)head+='\n\n'+item;
 }
 return head.slice(0,limit);
}

const marker=/\n?<!--GM_STATE:([\s\S]{1,3000})-->\s*$/;
export function parseGMResult(raw){
 if(typeof raw!=='string'||!raw.trim())throw Error('GM 回覆無效');
 const match=raw.match(marker);
 if(!match)return {narration:visibleNarrative(raw),changes:[],move:null,schedules:[],newNPCs:[],taskUpdates:[]};
 const narration=raw.slice(0,match.index).trim();
 let changes=[],move=null,schedules=[],newNPCs=[],taskUpdates=[];
 try{const parsed=JSON.parse(match[1]);if(Array.isArray(parsed.changes))changes=parsed.changes.slice(0,8);
  if(parsed.move&&typeof parsed.move==='object')move=parsed.move;
  if(Array.isArray(parsed.schedules))schedules=parsed.schedules.slice(0,2);
  if(Array.isArray(parsed.newNPCs))newNPCs=parsed.newNPCs.slice(0,3);
  if(Array.isArray(parsed.taskUpdates))taskUpdates=parsed.taskUpdates.slice(0,5);}
 catch{/* Invalid metadata never changes canonical state. */}
 return {narration:narration||'（本回合未產生可用敘述，請重試。）',changes,move,schedules,newNPCs,taskUpdates};
}
function applyChanges(next,changes,text,narration,present){
 const evidenceText=text+'\n'+narration;
 for(const change of changes){
  if(!change||typeof change!=='object'||!present.has(change.id))continue;
  const actor=next.npcs[change.id],quote=shorten(change.evidence,100);
  if(!actor||quote.length<2||!evidenceText.includes(quote))continue;
  if(MOODS.includes(change.mood))actor.mood=change.mood;
  if(CONDITIONS.includes(change.status))actor.status=change.status;
  if(typeof change.goal==='string'&&change.goal.trim()&&change.goal.length<=180&&
     actor.goal!==change.goal.trim())actor.goal=change.goal.trim();
  if(change.relationship&&typeof change.relationship==='object'){
   for(const field of ['favor','trust','respect']){
    const delta=change.relationship[field];
    if(Number.isInteger(delta)&&Math.abs(delta)<=2)
     actor.relationships.player[field]=clamp(actor.relationships.player[field]+delta);
   }
  }
 }
}
/**
 * Task status is a progress note, not an authority to advance a scheduled
 * stage early. Only actual narrated evidence and existing task IDs may write.
 */
function applyTaskUpdates(next,updates,narration){
 const now=elapsedMinutes(next);
 for(const change of updates){
  if(!change||typeof change!=='object'||typeof change.id!=='string')continue;
  const event=next.eventCalendar?.events?.find(e=>e.id===change.id);
  if(!event||event.state==='cancelled')continue;
  const evidence=shorten(change.evidence,120);
  const note=shorten(change.note,220);
  if(evidence.length<4||!narration.includes(evidence)||!note)continue;
  if(!['進行中','受阻','完成','失敗','取得進展'].includes(change.status))continue;
  // No invented completion of a future stage / deadline: this status is
  // a scoped narrative note. Scheduled completion remains clock-owned.
  const record={id:'task-update:'+next.revision+':'+event.id,
   at:now,day:next.day,minute:next.minute,
   status:change.status,note,evidence};
  event.progressLog??=[];
  if(event.progressLog.some(x=>x.id===record.id))continue;
  event.progressLog.push(record);
  event.progressLog=event.progressLog.slice(-30);
 }
}
export function commitV3Turn(world,userText,rawAnswer,requestId,options={}){
 if(typeof userText!=='string'||!userText.trim()||userText.length>2500)throw Error('玩家輸入無效');
 if(typeof rawAnswer!=='string'||!rawAnswer.trim()||rawAnswer.length>12000)throw Error('GM 回覆無效');
 requireNarrative(rawAnswer);
 if(world.events.some(e=>e.requestId===requestId))throw Error('重複回合');
 if(world.events.filter(e=>e.type==='conversation').length>=1000)throw Error('試玩世界已達1000回合，請先備份');
 const before=elapsedMinutes(world);
 const present=new Set(presentIds(world)),parsed=parseGMResult(rawAnswer),next=clone(world);
 const move=parsed.move;
 const approvedMove=move&&LOCATIONS.includes(move.to)&&move.to!==world.location&&
  (userText.includes(move.to)||/(前往|走向|跟著|隨同|出發|帶我去)/.test(userText))&&
  typeof move.evidence==='string'&&move.evidence.length>=4&&move.evidence.length<=100&&
  parsed.narration.includes(move.evidence)&&/(抵達|到達|來到|走進|進入)/.test(move.evidence)&&
  !/(尚未|未能|無法|不能|沒能|不准)/.test(move.evidence);
 next.revision++;
 const requestedMinutes=options.advanceMinutes;
 if(requestedMinutes!==undefined&&![0,15,60,360,1440].includes(requestedMinutes))throw Error('不支援的時間推進幅度');
 const delta=requestedMinutes??(approvedMove?Math.max(30,timeCost(userText)):timeCost(userText));
 const after=before+delta;
 next.day=Math.floor(after/1440)+1;
 next.minute=after%1440;
 if(approvedMove)next.location=move.to;
 const root=rootResultConfirmed(world,userText,parsed.narration);
 if(root)next.protagonist.spiritualRoot=root;
 next.scene=updateScene(sceneOf(world),parsed.narration,next.location);
 if(root)next.scene.focus='測試結果';
 const eventId='turn:'+next.revision;
 const registration=registerNamedNPCs(next,parsed.narration,parsed.newNPCs);
 const seenBy=privacyHint(userText)?[]:[...new Set([...present,...registration.mentioned])];
 next.messages.push({role:'user',content:userText},{role:'assistant',content:parsed.narration});
 next.events.push({requestId,id:eventId,revision:next.revision,day:next.day,minute:next.minute,
  type:'conversation',text:userText,reply:parsed.narration,location:world.location,
  ...(requestedMinutes?{advanceMinutes:requestedMinutes}:{}),
  ...(options.sceneJump?{sceneJump:options.sceneJump}:{}),
  root:root||null,destination:approvedMove?move.to:null,witnesses:seenBy});
 for(const id of seenBy){
  const actor=next.npcs[id];
  actor.knowledge.push(eventId);
  actor.memories.push({id:eventId+':'+id,eventId,kind:'親歷',day:next.day,minute:next.minute,
   importance:/(答應|承諾|道歉|吵架|背叛|救|受傷|秘密)/.test(userText)?3:1,
   source:'現場',text:shorten('洛河：'+userText+'；當時：'+parsed.narration,420)});
 }
 applyChanges(next,parsed.changes,userText,parsed.narration,present);
 applyTaskUpdates(next,parsed.taskUpdates,parsed.narration);
 // Only valid complete plans become authoritative. Rejected suggestions cannot
 // rewrite existing calendar events or invalidate an otherwise valid dialogue.
 for(const proposal of parsed.schedules){
  try{addScheduledEvent(next,proposal,before);}catch{/* Unscheduled plans are never canonical. */}
 }
 advanceEventCalendar(next,before,after);
 updateDurableMemory(next,next.events.find(e=>e.id===eventId));
 advanceLivingWorld(next,before,after);
 advanceNPCAgency(next,before,after);
 settleWorldDays(next,before,after);
 maybeWriteChapter(next);
 return next;
}
export function editCharacter(world,id,patch,note,by='developer'){
 if(typeof id!=='string'||!Object.hasOwn(world.npcs,id))throw Error('找不到人物');
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('無效人物設定');
 const allowed=['mood','status','where','goal','cultivationProgress','relationship','privateNote','role','realm','roots','traits','speech','plan'];
 if(Object.keys(patch).some(k=>!allowed.includes(k)))throw Error('不允許的設定欄位');
 if(Object.keys(patch).length===0)throw Error('沒有修改');
 const next=clone(world),actor=next.npcs[id];
 if(patch.mood!==undefined){if(!MOODS.includes(patch.mood))throw Error('無效情緒');actor.mood=patch.mood;}
 if(patch.status!==undefined){if(!CONDITIONS.includes(patch.status))throw Error('無效身體狀況');actor.status=patch.status;}
 for(const field of ['where','goal','role','roots','speech','plan']){
  if(patch[field]!==undefined){
   const value=patch[field],max=field==='where'?70:field==='roots'?50:field==='role'?80:180;
   if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('無效'+field);
   actor[field]=value.trim();
  }
 }
 if(patch.realm!==undefined){
  if(typeof patch.realm!=='string'||!(/^(凡人|鍛體|聚氣|築基|金丹|元嬰|化神|洞虛|合道|渡劫)(初期|中期|後期|圓滿)?$/).test(patch.realm))throw Error('無效修為境界');
  actor.realm=patch.realm;
 }
 if(patch.traits!==undefined){
  if(!Array.isArray(patch.traits)||patch.traits.length<1||patch.traits.length>12||patch.traits.some(x=>typeof x!=='string'||!x.trim()||x.length>24))throw Error('人格特質需為1至12項');
  actor.traits=patch.traits.map(x=>x.trim());
 }
 if(patch.cultivationProgress!==undefined){
  const n=patch.cultivationProgress;
  if(!Number.isInteger(n)||n<0||n>100)throw Error('修為進度需為0至100');
  actor.cultivationProgress=n;
 }
 if(patch.relationship!==undefined){
  if(!patch.relationship||typeof patch.relationship!=='object'||Array.isArray(patch.relationship))throw Error('無效關係');
  for(const [k,v] of Object.entries(patch.relationship)){
   if(!['favor','trust','respect'].includes(k)||!Number.isInteger(v)||v< -100||v>100)throw Error('關係值需在 -100 至100');
   actor.relationships.player[k]=v;
  }
 }
 if(patch.privateNote!==undefined){
  if(typeof patch.privateNote!=='string'||!patch.privateNote.trim()||patch.privateNote.length>240)throw Error('私人備註需1至240字');
  actor.privateNotes.push(patch.privateNote.trim());
 }
 if(['where','goal','role','plan'].some(k=>patch[k]!==undefined)){
  ensureNPCAgency(next).agendas[id]=initialNPCAgency(next).agendas[id];
 }
 next.revision++;
 next.developerAudit??=[];
 next.developerAudit.push({revision:next.revision,actorId:id,operation:'character-edit',by,
 day:next.day,minute:next.minute,fields:Object.keys(patch),note:shorten(note,120)});
 return next;
}

/** Developer-only actions. API must enforce authorization before invocation. */
export function developerTaskChange(world,action,payload,by='developer'){
 if(!['create','cancel'].includes(action))throw Error('不支援的任務操作');
 const next=clone(world),now=elapsedMinutes(world);
 let event;
 if(action==='create'){
  event=addScheduledEvent(next,payload,now);
  event.source='開發者新增任務';event.origin='developer';
 }else{
  if(typeof payload?.id!=='string')throw Error('任務 ID 無效');
  const entry=ensureEventCalendar(next).events.find(e=>e.id===payload.id);
  if(!entry)throw Error('找不到指定任務');
  if(entry.state==='completed'||entry.state==='cancelled')throw Error('已結束任務不能重複取消');
  if(eventSourceCategory(entry)==='預設任務')throw Error('預設的宗門週期活動不可直接取消，請調整當期參與或另設變故事件');
  entry.state='cancelled';
  entry.cancelledAt=now;
  event=entry;
 }
 next.revision++;
 next.developerAudit??=[];
 next.developerAudit.push({revision:next.revision,actorId:'calendar:'+event.id,
  operation:'task-'+action,by,day:next.day,minute:next.minute,
  fields:action==='create'?['id','name','start','end','stages','participants']:['state'],
  note:action==='create'?'開發者建立事件時間表':'開發者取消未完成事件'});
 return next;
}
