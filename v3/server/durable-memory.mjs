/**
 * Durable, model-independent significant-event ledger (phase 2).
 * The ledger stores source excerpts, not AI-invented summaries. It distinguishes
 * what the GM can verify from what each NPC actually witnessed.
 */
import {visibleNarrative} from './narrative.mjs';
const excerpt=(s,n)=>String(s??'').trim().slice(0,n);
const categories=[
 ['promise',/(承諾|答應|約定|說好|保證|發誓|不再|一定會)/],
 ['conflict',/(吵架|打架|爭執|決裂|背叛|辱罵|挑釁|切磋|約戰)/],
 ['trust',/(信任|懷疑|原諒|道歉|對不起|感謝|救了|救下|救命)/],
 ['secret',/(秘密|隱瞞|保密|不可告訴|不能告訴|私下)/],
 ['milestone',/(拜師|收徒|測靈|靈根|突破|晉升|重傷|受傷|贈送|交給|收到|取得)/],
];
const grams=value=>{
 const t=String(value??'').match(/[\u3400-\u9fff]+|[a-zA-Z0-9]+/g)||[];
 const out=new Set();
 for(const w of t){
  if(/^[\u3400-\u9fff]+$/.test(w)){for(let i=0;i<w.length-1;i++)out.add(w.slice(i,i+2));}
  else if(w.length>2)out.add(w.toLowerCase());
 }
 return out;
};
const overlap=(a,b)=>{
 const needle=grams(a),haystack=grams(b);
 let result=0;for(const n of needle)if(haystack.has(n))result++;
 return result;
};
const validEvent=e=>e?.type==='conversation'&&typeof e.id==='string'&&typeof e.text==='string';
export function memoryFromEvent(e){
 if(!validEvent(e))return null;
 const narrative=visibleNarrative(e.reply||'');
 const kinds=categories.filter(([,re])=>re.test(e.text+' '+narrative)).map(([name])=>name);
 if(!kinds.length)return null;
 return {id:'memory:'+e.id,eventId:e.id,revision:e.revision,day:e.day,minute:e.minute,
  location:e.location,kinds,source:'原始回合',playerText:excerpt(e.text,500),
  narration:excerpt(narrative,750),witnesses:Array.isArray(e.witnesses)?[...e.witnesses]:[],
  // "Witnessed" is an observation, not proof that each actor understood it.
  importance:kinds.includes('promise')||kinds.includes('secret')?3:2};
}
/** Incremental updates are idempotent, and old savegames hydrate lazily. */
export function updateDurableMemory(world,event){
 world.memoryLedger??={version:1,entries:[]};
 if(!Array.isArray(world.memoryLedger.entries))world.memoryLedger.entries=[];
 if(world.memoryLedger.entries.some(m=>m.eventId===event.id))return;
 const memory=memoryFromEvent(event);
 if(memory)world.memoryLedger.entries.push(memory);
}
export function hydrateDurableMemory(world){
 if(!world.memoryLedger||!Array.isArray(world.memoryLedger.entries)){
  world.memoryLedger={version:1,entries:[]};
 }
 const existing=new Set(world.memoryLedger.entries.map(x=>x.eventId));
 for(const event of world.events||[]){
  if(existing.has(event.id))continue;
  const memory=memoryFromEvent(event);
  if(memory){world.memoryLedger.entries.push(memory);existing.add(event.id);}
 }
 return world.memoryLedger;
}
export function recallDurableMemory(world,query,{actorId=null,limit=6,maxChars=1700}={}){
 const ledger=world.memoryLedger?.entries||[];
 const actor=actorId?world.npcs?.[actorId]:null;
 if(actorId&&!actor)return '';
 const relevant=ledger.filter(m=>!actorId||m.witnesses?.includes(actorId)||
  actor.knowledge?.includes(m.eventId));
 const selected=relevant.map((m,i)=>{
  const details=m.playerText+' '+m.narration;
  const score=overlap(query,details)*9+m.importance*4+i/Math.max(relevant.length,1);
  return {m,score};
 }).sort((a,b)=>b.score-a.score).slice(0,limit).sort((a,b)=>a.m.revision-b.m.revision);
 const lines=selected.map(({m})=>'【'+m.kinds.join('/')+'｜第'+m.day+'日・第'+m.revision+'回合｜'+m.location+'】'+
  '洛河：'+excerpt(m.playerText,195)+'；當時：'+excerpt(m.narration,240)+
  (actorId?'【知情：該 NPC 曾在場或收到紀錄】':
   '【見證者】'+(m.witnesses?.map(id=>world.npcs?.[id]?.name||id).join('、')||'無')));
 return lines.join('\n').slice(0,maxChars);
}
