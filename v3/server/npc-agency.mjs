/**
 * V3 NPC autonomy baseline: deterministic, event-driven daily agendas.
 * The GM narrates these facts, it does not decide that an offscreen person has
 * teleported, already witnessed Luohe, or finished an unperformed action.
 *
 * Initial agendas respect the canonical NPC locations. Subsequent schedules
 * are derived from duties/goals, not prompts containing player dialogue.
 */
const DAY=1440;
const phases=[
 {id:'morning',start:480,end:720},
 {id:'midday',start:720,end:780},
 {id:'afternoon',start:780,end:1080},
 {id:'evening',start:1080,end:1320},
 {id:'night',start:1320,end:1920},
];
const timeLabel=t=>'第'+(Math.floor(t/DAY)+1)+'日 '+String(Math.floor(t%DAY/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
const home=actor=>actor.peak==='山門'?'太虛宗山門':actor.peak==='主峰'?'太虛宗主峰':actor.where;
const duty=(actor,phase,day)=>{
 if(actor.id==='registrar'){
  if(day===1&&phase==='morning')return '核對報名名冊與測試結果';
  if(day===1&&phase==='afternoon')return '處理收徒初評資料與接引核對';
  return phase==='evening'?'整理今日宗門文書':'整理收徒與宗務紀錄';
 }
 if(actor.id==='guide')return phase==='midday'?'安排新弟子午間報到':'處理新弟子接引與外門生活安排';
 if(phase==='evening')return '整理當日修行心得並處理私人事務';
 if(phase==='night')return '休息與個人修行';
 if(phase==='midday')return '用膳與同門往來';
 if(/峰主|宗主|長老|護法/.test(actor.role||''))return '處理'+(actor.peak||'宗門')+'事務與修行';
 if(/接引|執事|教習|管事/.test(actor.role||''))return '完成'+(actor.role||'宗門')+'值務';
 if((actor.goal||'').includes('劍'))return '練劍並磨練自身修為';
 return '依個人目標修煉與處理'+(actor.peak||'宗門')+'日常';
};
const phaseAt=now=>{
 const day=Math.floor(now/DAY);
 const t=now%DAY;
 if(t<480)return {phase:'night',start:(day-1)*DAY+1320,end:day*DAY+480};
 for(const p of phases.slice(0,4))if(t>=p.start&&t<p.end)
  return {phase:p.id,start:day*DAY+p.start,end:day*DAY+p.end};
 if(t>=1320)return {phase:'night',start:day*DAY+1320,end:(day+1)*DAY+480};
 return {phase:'evening',start:day*DAY+1080,end:day*DAY+1320};
};
const destination=(actor,phase,day)=>{
 if(actor.id==='registrar')return day===1&&['morning','afternoon'].includes(phase)
  ?'太虛宗山門':'太虛宗執事處';
 if(actor.id==='guide')return phase==='evening'||phase==='night'?'外門居所':'外門報到處';
 // Until individual travel routes exist, keep known places stable.
 return home(actor);
};
function plannedAction(actor,now,{location}={}){
 const p=phaseAt(now),day=Math.floor(p.start/DAY)+1;
 return {id:actor.id+':'+p.start+':'+p.phase,actorId:actor.id,
  title:duty(actor,p.phase,day),location:location||destination(actor,p.phase,day),
  start:p.start,end:p.end,phase:p.phase,goal:actor.goal||'維持日常生活',
  status:'active',cause:'NPC日常計畫'};
}
export function initialNPCAgency(world){
 const now=(world.day-1)*DAY+world.minute;
 return {version:1,lastAdvancedAt:now,
  agendas:Object.fromEntries(Object.entries(world.npcs||{}).map(([id,npc])=>
   [id,plannedAction(npc,now,{location:npc.where})])),
  history:[]};
}
export function ensureNPCAgency(world){
 if(!world.npcAgency||world.npcAgency.version!==1||!world.npcAgency.agendas){
  world.npcAgency=initialNPCAgency(world);
 }
 for(const [id,npc] of Object.entries(world.npcs||{})){
  if(!world.npcAgency.agendas[id])
   world.npcAgency.agendas[id]=plannedAction(npc,(world.day-1)*DAY+world.minute,{location:npc.where});
 }
 return world.npcAgency;
}
const actorInScene=(world,id)=>world.npcs[id]?.where===world.location;
/** Resolve at most one durable duty completion per NPC per clock jump, not
 * thousands of fabricated beats when a player skips months or years.
 * World and actors are mutated only by the committed turn path. */
export function advanceNPCAgency(world,from,to){
 if(to<=from)return [];
 const agency=ensureNPCAgency(world),updates=[];
 for(const [id,actor] of Object.entries(world.npcs||{})){
  const prior=agency.agendas[id];
  if(!prior)continue;
  // Do not move or silently complete in-progress dialogue on a short turn.
  const protectedInScene=actorInScene(world,id)&&to-from<30;
  if(protectedInScene){
   // Preserve all scene NPC positions; time still advances.
   if(prior.end<=to)agency.agendas[id]={...prior,end:to+15};
   continue;
  }
  if(prior.end>to)continue;
  const multiDay=to-prior.end>DAY;
  const occurredAt=prior.end;
  const eventId='npc-action:'+prior.id;
  // This is a self-reported private outcome; does not imply task success
  // or any new witness / public announcement.
  if(!world.events.some(e=>e.id===eventId)){
   const record={id:eventId,revision:world.revision,
    day:Math.floor(occurredAt/DAY)+1,minute:occurredAt%DAY,type:'offscreen',
    text:actor.name+'完成：'+prior.title,reply:'',location:prior.location,
    witnesses:[id],hidden:true,source:'npc-agency',actorId:id,
    ...(multiDay?{summaryOnly:true}:{} )};
   world.events.push(record);
   actor.memories.push({id:eventId+':'+id,eventId,kind:'親歷',
    day:record.day,minute:record.minute,importance:1,source:'自身日程',text:record.text});
   actor.knowledge.push(eventId);
   agency.history.push({id:eventId,actorId:id,at:occurredAt,
    title:prior.title,location:prior.location});
   updates.push(record);
  }
  // For long skips, select the actual phase at the destination time; older
  // daily activities are summarized, not invented turn by turn.
  const current=plannedAction(actor,to);
  // Only apply destination shifts if NPC wasn't physically interacting with
  // Luohe at the start of this turn. No 4-minute teleporting.
  if(!actorInScene(world,id)&&current.location!==actor.where&&to-from>=30)
   actor.where=current.location;
  agency.agendas[id]={
   ...current,location:actor.where,
   ...(multiDay?{summary:'此期間按職責維持日常，未逐日演算個別細節'}:{})
  };
 }
 agency.history=agency.history.slice(-180);
 agency.lastAdvancedAt=Math.max(agency.lastAdvancedAt,to);
 return updates;
}
export function npcAgencyForGM(world,maxChars=1300){
 const agency=ensureNPCAgency(world),now=(world.day-1)*DAY+world.minute;
 const present=Object.entries(world.npcs||{}).filter(([,a])=>a.where===world.location);
 const inScene=present.map(([id,n])=>{
  const task=agency.agendas[id];
  return n.name+'：目前「'+task?.title+'」，預計'+timeLabel(task?.end??now)+
   '結束；長期目標「'+(n.goal||'未知')+'」。';
 }).join('\n');
 const recent=agency.history.slice(-3).map(h=>h.actorId+' 在'+timeLabel(h.at)+'完成個人日程（此處僅供GM掌握，不能令其他人全知）').join('；');
 return ('【NPC自主日程：僅有在場NPC可直接被洛河目睹】\n'+
  (inScene||'當前無已登記在場人物')+
  '\n【私密幕後行動摘要，不可自動告知洛河】'+recent+
  '\nNPC 可以自行行動，但不能瞬移；此日程不代表某個正式宗門任務已成功。').slice(0,maxChars);
}
