/** Data-only reference packet. No procedural director, input classification or fixed outcomes. */
import {WORLD_BIBLE} from './world-bible.mjs';
import {gmNotebookContext,recallDurableMemory} from './durable-memory.mjs';
import {visibleNarrative} from './narrative.mjs';
const cut=(s,n)=>String(s??'').slice(0,n);
const coreNames=new Set(['沈滄月','晏清辭','江離','顧長青']);
export function roleplayContext(world,text){
 const recent=world.messages.slice(-6).map(m=>visibleNarrative(m.content).slice(-400)).join('\n');
 const query=text+' '+recent;
 const peaks=WORLD_BIBLE.sect.peaks;
 const ranked=Object.values(world.npcs).map(actor=>({actor,score:
  (query.includes(actor.name)?100:0)+(actor.where===world.location?30:0)+
  (peaks.some(p=>query.includes(p.name)&&p.leader.includes(actor.name))?60:0)+
  (typeof world.protagonist.master==='string'&&world.protagonist.master.includes(actor.name)?40:0)
 })).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,8);
 const packet={
  time:{day:world.day,minute:world.minute},location:world.location,
  protagonist:world.protagonist,
  characters:ranked.map(({actor:a})=>({id:a.id,name:a.name,role:a.role,where:a.where,
   present:a.where===world.location,realm:a.realm,status:a.status,mood:a.mood,
   personality:coreNames.has(a.name)?'依核心框架的人格基準':cut(a.personality||a.traits?.join('、'),160),
   relationship:a.relationships?.player,goal:cut(a.goal,160),
   memories:(a.memories||[]).slice(-3).map(m=>({text:cut(m.text,160),source:m.source})),
   privateNotes:(a.privateNotes||[]).slice(-2).map(n=>cut(n,120))})),
  geography:peaks.map(p=>({name:p.name,leader:p.leader,domain:p.domain})),
  memory:gmNotebookContext(world,query+' '+ranked.map(x=>x.actor.name).join(' ')),
  pastEvents:recallDurableMemory(world,query,{limit:4,maxChars:1100}),
  events:(world.eventCalendar?.events||[]).filter(e=>e.location===world.location||query.includes(e.name)).slice(0,4)
   .map(e=>({id:e.id,name:e.name,public:e.public,start:e.start,end:e.end,
    progress:(e.progressLog||[]).slice(-3).map(p=>({status:p.status,note:cut(p.note,180)}))})),
 };
 // Drop whole lower-priority records, never truncate JSON or lose protagonist state.
 while(JSON.stringify(packet).length>10500&&packet.characters.length>1)packet.characters.pop();
 while(JSON.stringify(packet).length>11500&&packet.events.length)packet.events.pop();
 if(JSON.stringify(packet).length>11500){packet.pastEvents='';packet.memory='';}
 return '以下為本存檔參考資料。人物列入參考不代表已在場；秘密依知情範圍使用。日期尚無月日對應時使用第幾日。\n'+JSON.stringify(packet);
}
