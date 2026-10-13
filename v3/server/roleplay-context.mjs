import {memoryLayers} from './memory-system.mjs';
/** Data-only reference packet. No procedural director, input classification or fixed outcomes. */
import {WORLD_BIBLE} from './world-bible.mjs';
import {gmNotebookContext,recallDurableMemory} from './durable-memory.mjs';
import {visibleNarrative} from './narrative.mjs';
const cut=(s,n)=>String(s??'').slice(0,n);
const currentNPCMemories=actor=>{const entries=actor.memories||[];const replaced=new Set(entries.map(m=>m.supersedes).filter(Boolean));return entries.filter(m=>!replaced.has(m.eventId));};
const coreNames=new Set(['沈滄月','晏清辭','江離','顧長青']);
export function roleplayContext(world,text,{advanceMinutes=0}={}){
 const layers=memoryLayers(world,text,{advanceMinutes});
 const recent=world.messages.slice(-6).map(m=>visibleNarrative(m.content).slice(-400)).join('\n');
 const query=text+' '+recent;
 const peaks=WORLD_BIBLE.sect.peaks;
 const scene=layers.L1.scene;
 const present=a=>scene?.participantsConfirmed?scene.participants.includes(a.id):a.where===world.location;
 const ranked=Object.values(world.npcs).map(actor=>({actor,score:
  (query.includes(actor.name)?100:0)+(present(actor)?30:0)+
  (peaks.some(p=>query.includes(p.name)&&p.leader.includes(actor.name))?60:0)+
  (typeof world.protagonist.master==='string'&&world.protagonist.master.includes(actor.name)?40:0)
 })).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,8);
 const packet={
  rules:layers.L0,workingMemory:layers.L1.scene,latestExchange:layers.L1.lastExchange,worldThreads:layers.L3,archive:layers.L4,
  time:{day:world.day,minute:world.minute},location:world.location,
  protagonist:structuredClone(world.protagonist),
  characters:ranked.map(({actor:a})=>({id:a.id,name:a.name,role:a.role,where:a.where,
   present:present(a),realm:a.realm,status:a.status,mood:a.mood,
   personality:coreNames.has(a.name)?'依核心框架的人格基準':cut(a.personality||a.traits?.join('、'),160),
   relationship:a.relationships?.player,goal:cut(a.goal,160),
   memories:currentNPCMemories(a).map((m,i)=>({m,score:(m.kind==='promise'&&!m.resolved?4:0)+(query.includes(a.name)?2:0)+((m.text||'').split(/[，。；：]/).some(t=>t.length>2&&query.includes(t))?8:0)+i/Math.max(1,a.memories.length)})).sort((x,y)=>y.score-x.score).slice(0,4).map(({m})=>({text:cut(m.text,200),id:m.eventId,kind:m.kind,resolved:m.resolved,interpretation:m.interpretation,emotion:m.emotion,source:m.source,eventId:m.eventId})),
   privateNotes:(a.privateNotes||[]).slice(-2).map(n=>cut(n,120))})),
  geography:peaks.map(p=>({name:p.name,leader:p.leader,domain:p.domain})),
  memory:gmNotebookContext(world,query+' '+ranked.map(x=>x.actor.name).join(' ')),
  pastEvents:recallDurableMemory(world,query,{limit:4,maxChars:1100}),
  events:(world.eventCalendar?.events||[]).filter(e=>e.location===world.location||query.includes(e.name)).slice(0,4)
   .map(e=>({id:e.id,name:e.name,public:e.public,start:e.start,end:e.end,
    progress:(e.progressLog||[]).slice(-3).map(p=>({status:p.status,note:cut(p.note,180)}))})),
 };
 // Drop whole lower-priority records, never truncate JSON or lose protagonist state.
 while(JSON.stringify(packet).length>15000&&packet.worldThreads.threads.length>1)packet.worldThreads.threads.pop();
 while(JSON.stringify(packet).length>15000&&packet.characters.length>1)packet.characters.pop();
 while(JSON.stringify(packet).length>18000&&packet.events.length)packet.events.pop();
 if(JSON.stringify(packet).length>18000){packet.pastEvents='';packet.memory='';}
 // Large inventories stay authoritative in the save; retrieve relevant entries first.
 for(const field of ['inventory','skills','equipment']){
  if(JSON.stringify(packet).length<=20000)break;
  const values=packet.protagonist[field];
  if(!Array.isArray(values))continue;
  packet.protagonist[field]=values.map((item,i)=>({item,i,score:query.includes(typeof item==='string'?item:item.name)?1:0})).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,12).map(x=>x.item);
  packet.protagonist[field+'Omitted']=values.length-packet.protagonist[field].length;
 }
 return '以下為本存檔參考資料。人物列入參考不代表已在場；秘密依知情範圍使用。日期尚無月日對應時使用第幾日。\n'+JSON.stringify(packet);
}
