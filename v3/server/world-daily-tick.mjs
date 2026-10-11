/**
 * World Daily Tick — a private, idempotent boundary-settlement ledger.
 *
 * The event calendar and NPC agency own actual event/actor updates. This
 * module records which facts crossed midnight and checks all ongoing
 * obligations. It must not invent success, feelings, cultivation or witnesses.
 */
const DAY=1440;
const at=e=>(e.day-1)*DAY+e.minute;
const completed=event=>event.state==='completed'||event.state==='cancelled';
export function ensureDailyTick(world){
 const current=world.day||1;
 if(!world.dailyTick||world.dailyTick.version!==1||
    !Number.isInteger(world.dailyTick.lastSettledDay)){
  // Older saves start at their current day. No retroactive outcomes.
  world.dailyTick={version:1,lastSettledDay:current,records:[]};
 }
 if(!Array.isArray(world.dailyTick.records))world.dailyTick.records=[];
 return world.dailyTick;
}
const unique=a=>[...new Set(a)];
/**
 * Run after event-calendar, living-world, NPC agency and NPC decision engines
 * have advanced. Log *facts* and due stages, not imagined mission outcomes.
 *
 * Large jumps keep one consolidated entry plus independently meaningful
 * checkpoint days; daily tick is not one AI call per actor/day.
 */
export function settleWorldDays(world,from,to){
 const ledger=ensureDailyTick(world);
 if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||to<=from)return [];
 const lastDay=Math.floor(to/DAY)+1;
 const firstDay=Math.max(ledger.lastSettledDay+1,Math.floor(from/DAY)+2);
 if(firstDay>lastDay)return [];
 const due=(world.eventCalendar?.events||[]).flatMap(e=>(e.stages||[])
  .filter(s=>s.at>from&&s.at<=to).map(s=>({event:e,stage:s})));
 const crossed=(world.events||[]).filter(e=>
  Number.isInteger(e.day)&&Number.isInteger(e.minute)&&
  at(e)>from&&at(e)<=to&&
  ['event-calendar','living-world','npc-agency'].includes(e.source));
 const result=[];
 const daysCount=lastDay-firstDay+1;
 let days=[];
 if(daysCount<=14){
  for(let day=firstDay;day<=lastDay;day++)days.push(day);
 }else{
  const checkpoints=due.filter(x=>x.event.completed?.includes(x.stage.id))
   .map(x=>Math.floor(x.stage.at/DAY)+2)
   .filter(d=>d>=firstDay&&d<=lastDay);
  days=unique([firstDay,...checkpoints.slice(0,10),lastDay]).sort((a,b)=>a-b);
 }
 for(let i=0;i<days.length;i++){
  const day=days[i],rangeStart=i===0?firstDay:days[i-1]+1;
  const startAbs=i===0?from:(days[i-1]-1)*DAY;
  const endAbs=Math.min(to,(day-1)*DAY);
  // Group a long quiet interval; use exact event timestamps in output,
  // rather than pretending all events happened on the last day.
  const records=crossed.filter(e=>at(e)>startAbs&&at(e)<=endAbs);
  const calendarIds=unique(records.filter(e=>e.source==='event-calendar').map(e=>e.arc));
  const npcIds=unique(records.filter(e=>e.source==='npc-agency').map(e=>e.actorId));
  const arcIds=unique(records.filter(e=>e.source==='living-world').map(e=>e.arc));
  const active=(world.eventCalendar?.events||[]).filter(e=>
    !completed(e)&&e.start<endAbs&&e.end>startAbs);
  const record={
   id:'daily:'+day,day,rangeStartDay:rangeStart,rangeEndDay:day,
   at:Math.min((day-1)*DAY,to),type:'world-daily-tick',
   calendarEvents:calendarIds,
   npcActivity:npcIds,
   livingArcs:arcIds,
   activeTasks:unique(active.map(e=>e.id)),
   activityCount:records.length,
   note:daysCount>14&&rangeStart<day?
    '長時間跳轉：僅記錄真實事件與任務階段，不逐日虛構人物經歷':
    '午夜結算：檢查人物與任務已發生的變化',
  };
  if(!ledger.records.some(r=>r.id===record.id)){
   ledger.records.push(record);result.push(record);
  }
 }
 ledger.lastSettledDay=lastDay;
 // The developer report is a bounded audit view, not an infinite timeline.
 ledger.records=ledger.records.slice(-100);
 return result;
}
export function dailyTickForGM(world,maxChars=400){
 const ledger=ensureDailyTick(world);
 const latest=ledger.records.at(-1);
 if(!latest)return '';
 const text='【世界午夜結算（僅供GM核對，不是洛河自動知情）】到第'+
  latest.rangeEndDay+'日；期間已記錄事件'+latest.activityCount+
  '項、涉及任務'+latest.calendarEvents.join('、')+
  '；NPC 相關變化僅限當事人知曉。不要把結算摘要照單宣讀給玩家。';
 return text.slice(0,maxChars);
}
