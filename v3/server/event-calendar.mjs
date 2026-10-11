/**
 * Authoritative game-time event calendar. Time is minutes since game day 1
 * 00:00; the first saved day is the recruitment festival's day 1.
 *
 * Planning is not narration: scheduled future beats are never facts until
 * game-time reaches them, and even then NPC knowledge stays witness-scoped.
 */
const DAY=1440;
const integer=x=>Number.isInteger(x)&&x>=0;
const stamp=m=>'第'+(Math.floor(m/DAY)+1)+'日 '+String(Math.floor(m%DAY/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const copy=x=>structuredClone(x);
const SEED=Object.freeze([
 {id:'sect-recruitment',name:'太虛宗收徒大典',type:'宗門活動',location:'太虛宗山門',
  start:480,end:1080,participants:['registrar','guide'],public:true,
  stages:[
   {id:'registration',at:480,title:'山門登記與靈根測試',detail:'執事核對報名資料，靈根測試依序進行'},
   {id:'preliminary',at:720,title:'初評與名冊彙整',detail:'執事開始整理測試名冊，各峰接引人員準備核查名額'},
   {id:'handover',at:900,title:'接引與憑證核發',detail:'經宗門錄取的新人依規定領取入門憑證與接引安排；不等於洛河自動錄取'},
   {id:'closing',at:1080,title:'本日山門收徒作業結束',detail:'執事結算當日名冊，未完手續轉交後續辦理'},
  ]},
 {id:'twelve-peaks-selection',name:'十二峰收徒初選',type:'宗門活動',location:'太虛宗山門',
  start:780,end:2400,participants:['registrar','guide'],public:true,
  stages:[
   {id:'open',at:780,title:'各峰接引代表陸續開始初選',detail:'各峰依既定名冊與安排了解新弟子，並非十二位峰主同時親自到場'},
   {id:'review',at:1980,title:'第二日各峰繼續考察',detail:'不同峰的代表可按各自職責安排初評與接觸'},
   {id:'close',at:2400,title:'本屆初選窗口結束',detail:'尚未確定師承者按宗門規定繼續受觀察，不能自動成為親傳'},
  ]},
]);
export function initialEventCalendar(){
 return {version:1,epoch:'大周曆·收徒大典首日（第1日）',
  events:SEED.map(e=>({...copy(e),state:'scheduled',completed:[],createdAt:480,source:'宗門預定日程'}))};
}
export function validateScheduledEvent(event,world,now){
 if(!event||typeof event!=='object'||Array.isArray(event))throw Error('事件排程格式無效');
 const {id,name,type,location,start,end,participants,stages}=event;
 if(typeof id!=='string'||!/^[a-z0-9][a-z0-9-]{2,63}$/.test(id))throw Error('事件 ID 無效');
 if(typeof name!=='string'||!name.trim()||name.length>75)throw Error('事件名稱無效');
 if(typeof type!=='string'||!['宗門活動','任務','委託','約定','突發事件','NPC計畫'].includes(type))throw Error('事件類型無效');
 if(typeof location!=='string'||!location.trim()||location.length>80)throw Error('事件地點無效');
 if(!integer(start)||!integer(end)||start<now||end<=start||end-start>365*DAY)throw Error('事件開始或結束時間無效');
 if(!Array.isArray(participants)||participants.length>20||
   participants.some(p=>typeof p!=='string'||!world.npcs?.[p]))throw Error('事件參與者無效');
 if(!Array.isArray(stages)||stages.length<1||stages.length>12)throw Error('事件必須預先安排階段時間');
 let previous=start-1;
 const seen=new Set();
 for(const stage of stages){
  if(!stage||typeof stage.id!=='string'||!/^[a-z0-9-]{2,48}$/.test(stage.id)||
    seen.has(stage.id)||!integer(stage.at)||stage.at<start||stage.at>end||stage.at<=previous||
    typeof stage.title!=='string'||!stage.title.trim()||stage.title.length>110||
    typeof stage.detail!=='string'||!stage.detail.trim()||stage.detail.length>250)
    throw Error('事件階段時間或說明無效');
  previous=stage.at;seen.add(stage.id);
 }
 return {id,name:name.trim(),type,location:location.trim(),start,end,
  participants:[...new Set(participants)],public:event.public===true,
  stages:stages.map(s=>({id:s.id,at:s.at,title:s.title.trim(),detail:s.detail.trim()})),
  state:'scheduled',completed:[],createdAt:now,source:'GM新事件排程'};
}
export function addScheduledEvent(world,proposal,now){
 world.eventCalendar??=initialEventCalendar();
 if(world.eventCalendar.events.some(e=>e.id===proposal?.id))throw Error('事件 ID 重複');
 const event=validateScheduledEvent(proposal,world,now);
 world.eventCalendar.events.push(event);
 return event;
}
export function ensureEventCalendar(world){
 if(!world.eventCalendar||!Array.isArray(world.eventCalendar.events)){
  // Existing saves preserve their game-time: no replay of a past festival.
  world.eventCalendar=initialEventCalendar();
 }
 return world.eventCalendar;
}
/** Advance planned milestones. Emits private timeline events for accountability,
 * not player-visible facts; only corresponding witnesses learn them. */
export function advanceEventCalendar(world,from,to){
 const calendar=ensureEventCalendar(world),made=[];
 for(const e of calendar.events){
  if(e.state==='completed'||e.state==='cancelled')continue;
  for(const stage of e.stages){
   if(stage.at<=from||stage.at>to||e.completed.includes(stage.id))continue;
   e.completed.push(stage.id);
   const witnessIds=e.participants.filter(id=>world.npcs?.[id]);
   const eventId='calendar:'+e.id+':'+stage.id;
   const day=Math.floor(stage.at/DAY)+1,minute=stage.at%DAY;
   const record={id:eventId,revision:world.revision,day,minute,type:'offscreen',
    text:e.name+'：'+stage.title,reply:'',location:e.location,
    witnesses:witnessIds,hidden:true,source:'event-calendar',arc:e.id};
   world.events.push(record);
   for(const id of witnessIds){
    const npc=world.npcs[id];
    npc.knowledge.push(eventId);
    npc.memories.push({id:eventId+':'+id,eventId,kind:'知悉',day,minute,
     importance:2,source:'宗門／事件日程',text:record.text});
   }
   made.push(record);
  }
  if(to>=e.end){e.state='completed';}
  else if(to>=e.start){e.state='active';}
 }
 return made;
}
/** GM-only calendar context: real start/end and upcoming stages, not an excuse
 * to force the protagonist into events or claim future stages already happened. */
export function eventCalendarForGM(world,limit=1700){
 const now=(world.day-1)*DAY+world.minute;
 const events=ensureEventCalendar(world).events;
 const lines=events.filter(e=>e.state!=='completed'||e.end>=now-2*DAY).map(e=>{
  const upcoming=e.stages.filter(s=>!e.completed.includes(s.id)).slice(0,3);
  const happened=e.stages.filter(s=>e.completed.includes(s.id)).slice(-2);
  return '【'+e.name+'／'+e.type+'／'+e.state+'】地點'+e.location+
   '；開始'+stamp(e.start)+'；結束'+stamp(e.end)+'；'+
   '已到時點：'+(happened.map(s=>stamp(s.at)+' '+s.title).join('、')||'無')+'；'+
   '後續排程（尚未發生）：'+(upcoming.map(s=>stamp(s.at)+' '+s.title).join('、')||'無')+
   '。時間排程屬客觀設定，未到時不能當成已發生；NPC 也不能因排程而瞬移。';
 });
 return '【世界排程：現在'+stamp(now)+'；新任務必須先安排開始／結束／各階段時間】\n'+lines.join('\n').slice(0,limit);
}
