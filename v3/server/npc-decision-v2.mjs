/**
 * NPC Decision V2: limited evidence-based replanning from witness-scoped
 * events. Decisions never forge official successes, knowledge or teleportation.
 * For big clock jumps each NPC can replan once, keeping cost bounded.
 */
import {ensureNPCAgency} from './npc-agency.mjs';
const timeOf=world=>(world.day-1)*1440+world.minute;
const profiles=[
 {pattern:/名冊|登記|初評|收徒/u,title:'核對宗門名冊及手續',minutes:90,requires:/執事|接引|管事/u},
 {pattern:/警戒|巡防|失竊|異常/u,title:'查核值守紀錄並通報異常',minutes:120,requires:/護法|戒律|執事|峰主/u},
 {pattern:/論道|比試|切磋/u,title:'檢視論道或比試準備',minutes:90,requires:/峰主|親傳|弟子/u},
 {pattern:/歷練|探險|出峰/u,title:'評估歷練風險與相關職責',minutes:120,requires:/峰主|親傳|護法|執事/u},
];
export function replanNPCAgendas(world,from,to){
 const agency=ensureNPCAgency(world),recent=world.events.filter(e=>
  e.type==='offscreen'&&e.hidden===true&&e.source!=='npc-agency'&&
  Number.isInteger(e.day)&&Number.isInteger(e.minute)&&
  (e.day-1)*1440+e.minute>from&&(e.day-1)*1440+e.minute<=to);
 const changed=[];
 for(const [id,actor] of Object.entries(world.npcs||{})){
  const agenda=agency.agendas[id];
  if(!agenda)continue;
  const witnessed=recent.filter(e=>e.witnesses?.includes(id));
  const event=witnessed.at(-1);
  if(!event)continue;
  const rule=profiles.find(p=>p.pattern.test(event.text||'')&&p.requires.test(actor.role||''));
  if(!rule)continue;
  // A scene participant is not abruptly moved, and a plan's venue stays
  // their currently verified location (including after world clock jumps).
  const now=timeOf(world);
  const current=agency.agendas[id];
  if(current?.cause==='NPC事件應變'&&current.trigger===event.id)continue;
  const action={...current,id:id+':reaction:'+event.id,title:rule.title,
   goal:actor.goal||current.goal,location:actor.where,
   start:now,end:now+rule.minutes,status:'active',
   cause:'NPC事件應變',trigger:event.id,
   reason:'親自知悉：'+String(event.text||'').slice(0,100)};
  agency.agendas[id]=action;
  // Decision itself is private, not an event completed or an outcome.
  changed.push({actorId:id,trigger:event.id,title:action.title,
   at:now,location:actor.where});
 }
 agency.decisions=[...(agency.decisions||[]),...changed].slice(-120);
 return changed;
}
export function npcDecisionContext(world,limit=550){
 const agency=ensureNPCAgency(world);
 const here=Object.values(world.npcs||{}).filter(a=>a.where===world.location);
 const text=here.map(a=>{
  const plan=agency.agendas[a.id];
  return plan?.cause==='NPC事件應變'?
   a.name+'因親自獲知的事件而改變計畫，現正「'+plan.title+'」，不代表已完成或洛河知道原因。':'';
 }).filter(Boolean).join('\n');
 return ('【在場 NPC 的自主應變】'+(text||'無新應變')+
  '。只能按照人物本人知情與意願行動；不可替洛河決定。').slice(0,limit);
}
