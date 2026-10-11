/**
 * NPC Daily Planner V2.
 * A daily intention is not a completed deed. Plans are generated from the
 * canonical character, calendar duties and *that NPC's own* known events.
 *
 * No AI call per actor, no invented promotions/injuries/relationships, no
 * remote character magically learning information from private task progress.
 */
import {ensureNPCAgency} from './npc-agency.mjs';

const DAY=1440;
const at=e=>(e.day-1)*DAY+e.minute;
const active=e=>e.state!=='cancelled'&&e.state!=='completed';
const uniq=x=>[...new Set(x)];
const writeDay=day=>day*DAY-1;
const MAX_DETAIL_DAYS=14;

function applicableEvents(world,id,day){
 const start=(day-1)*DAY,end=day*DAY;
 return (world.eventCalendar?.events||[]).filter(e=>
  active(e)&&e.start<end&&e.end>start&&e.participants?.includes(id))
  .sort((a,b)=>a.start-b.start);
}
function personalSignals(world,actor,day){
 const cutoff=writeDay(day),previous=Math.max(0,(day-3)*DAY);
 const ids=new Set(actor.knowledge||[]);
 const witnessed=(world.events||[]).filter(e=>{
  const timestamp=Number.isInteger(e.day)&&Number.isInteger(e.minute)?at(e):-1;
  return timestamp>previous&&timestamp<=cutoff&&
   (e.witnesses?.includes(actor.id)||ids.has(e.id));
 });
 return witnessed.slice(-8);
}
function choosePlan(world,actor,day){
 const start=(day-1)*DAY+480, end=(day-1)*DAY+1080;
 const status=String(actor.status||''),goal=String(actor.goal||'');
 const jobs=applicableEvents(world,actor.id,day);
 const signals=personalSignals(world,actor,day);
 const warnings=signals.filter(e=>/警戒|重傷|失竊|危險|異常|遭襲/.test(e.text||''));
 let category,title,priority,reason,sourceEvent=null,taskId=null;
 if(/重傷|休養|受傷/.test(status)){
  category='recovery';title='休養、檢查傷勢並調整工作量';priority=90;
  reason='身體狀態：'+status;
 }else if(warnings.length&&/峰主|宗主|護法|戒律|執事|守衛/.test(actor.role||'')){
  const latest=warnings.at(-1);
  category='safety';title='核對已知異常、安排必要的風險處置';priority=85;
  reason='本人知悉事件：'+String(latest.text).slice(0,90);sourceEvent=latest.id;
 }else if(jobs.length){
  const task=jobs[0];
  category='duty';title='履行「'+task.name+'」當日職責';priority=75;
  reason='已排定的參與者職責（不表示事件必定成功）';taskId=task.id;
 }else if(/閉關|突破/.test(goal)&&!/(幼|新弟子)/.test(actor.role||'')){
  category='cultivation';title='專注修行與自身瓶頸';priority=55;
  reason='個人目標：'+goal.slice(0,95);
 }else if(/弟子|峰主|教習|執事/.test(actor.role||'')&&/指導|管理|教|守護|維護|修行/.test(goal)){
  category='work';title='修行並處理既有師門或職務安排';priority=50;
  reason='既有角色職責與目標：'+goal.slice(0,90);
 }else if(/劍|修煉|修行|築基|金丹|突破/.test(goal)){
  category='cultivation';title='依既定功法修煉、整理進度';priority=45;
  reason='個人修行目標：'+goal.slice(0,95);
 }else{
  category='routine';title='按自己的目標處理日常事務與生活';priority=30;
  reason='角色日常與長期目標：'+goal.slice(0,90);
 }
 return {id:actor.id+':daily:'+day,actorId:actor.id,day,category,title,priority,reason,
  location:actor.where,start,end,status:'planned',
  goal:actor.goal||'維持日常生活',
  ...(sourceEvent?{sourceEvent}:{}),...(taskId?{taskId}:{})};
}
/**
 * Generates only the destination day on long jumps: periods in between
 * are kept in Daily Tick and the real event timeline, not imagined as plans
 * that were successfully executed.
 */
export function planNPCDay(world,day){
 if(!Number.isSafeInteger(day)||day<1)throw Error('NPC 計畫日期無效');
 const agency=ensureNPCAgency(world);
 agency.dailyPlans??={};
 const key=String(day);
 if(agency.dailyPlans[key])return agency.dailyPlans[key];
 const plans=Object.fromEntries(Object.entries(world.npcs||{}).map(([id,actor])=>
  [id,choosePlan(world,actor,day)]));
 agency.dailyPlans[key]=plans;
 // Bound storage independent of number of play years.
 const old=Object.keys(agency.dailyPlans).map(Number).sort((a,b)=>a-b);
 for(const k of old.slice(0,Math.max(0,old.length-4)))delete agency.dailyPlans[String(k)];
 agency.lastPlannedDay=Math.max(agency.lastPlannedDay||0,day);
 return plans;
}
export function advanceNPCDailyPlans(world,from,to){
 if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||to<=from)return [];
 const fromDay=Math.floor(from/DAY)+1,toDay=Math.floor(to/DAY)+1;
 if(toDay<=fromDay)return [];
 const agency=ensureNPCAgency(world),plan=planNPCDay(world,toDay);
 const installed=[];
 for(const [id,choice] of Object.entries(plan)){
  const actor=world.npcs[id],current=agency.agendas[id];
  if(!actor||!current)continue;
  // A reactive plan that has not finished takes precedence: next day's
  // routine doesn't silently cancel ongoing emergency work.
  if(current.cause==='NPC事件應變'&&current.end>to)continue;
  // Daily planning does not teleport anyone and does not alter the past.
  // Install a plan as the currently scheduled work only when today's daytime
  // slot is in progress (or the previous agenda has ended).
  if(to<choice.start||to>=choice.end)continue;
  if(current.end>to&&current.cause!=='NPC日常計畫')continue;
  agency.agendas[id]={...choice,location:actor.where,status:'active',
   cause:'NPC每日自主計畫',start:Math.max(choice.start,fromDay<toDay?choice.start:to)};
  installed.push(id);
 }
 agency.dailyPlanHistory=[...(agency.dailyPlanHistory||[]),
  {day:toDay,actors:Object.keys(plan).length,installed:uniq(installed),
   skippedDays:Math.max(0,toDay-fromDay-MAX_DETAIL_DAYS),
   source:'npc-daily-planner'}].slice(-80);
 return Object.values(plan);
}
export function npcDailyPlanForGM(world,maxChars=470){
 const agency=ensureNPCAgency(world);
 const plan=agency.dailyPlans?.[world.day];
 if(!plan)return '';
 const here=Object.entries(world.npcs||{}).filter(([,actor])=>actor.where===world.location);
 const lines=here.map(([id,npc])=>plan[id]?
  npc.name+'：今日打算「'+plan[id].title+'」，根據'+plan[id].reason+'；此為計畫，尚未證明完成。':'').filter(Boolean);
 return ('【在場NPC的今日意圖，不能視為已完成的事件】'+lines.join('；')).slice(0,maxChars);
}
