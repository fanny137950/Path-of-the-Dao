/**
 * Explicit player pacing commands are out-of-character requests, not Luohe's
 * dialogue. Resolve them into authoritative calendar checkpoints.
 */
import {elapsedMinutes,advanceLivingWorld} from './living-world.mjs';
import {advanceEventCalendar} from './event-calendar.mjs';
import {advanceNPCAgency} from './npc-agency.mjs';
import {settleWorldDays} from './world-daily-tick.mjs';

export function sceneJumpPlan(world,text){
 const input=String(text||'').trim();
 if(!/^(?:(?:直接|馬上|立刻|現在|快點|跳過|略過|省略).{0,12}(?:進|到|跳|推進|進入)|跳到|快轉到|推進到|切到|直接).{0,20}$/u.test(input))
  return null;
 let event;
 let label;
 if(/(?:十二峰|收徒|選徒|拜師)/.test(input)){
  event=(world.eventCalendar?.events||[]).find(e=>e.id==='twelve-peaks-selection'&&e.state!=='cancelled');
  label='十二峰收徒初選';
 }else if(/(?:論道|论道)/.test(input)){
  event=(world.eventCalendar?.events||[]).filter(e=>e.name.includes('論道')&&e.state!=='cancelled'&&e.state!=='completed')
   .sort((a,b)=>a.start-b.start)[0];
  label='年度論道';
 }else if(/(?:歷練|探險|探险)/.test(input)){
  event=(world.eventCalendar?.events||[]).filter(e=>/歷練|探險/.test(e.name)&&e.state!=='cancelled'&&e.state!=='completed')
   .sort((a,b)=>a.start-b.start)[0];
  label='出峰歷練';
 }
 if(!event)return null;
 const now=elapsedMinutes(world);
 const target=Math.max(now,event.start);
 const minutes=Math.max(0,target-now);
 // Long fast-forward must be explicit and bounded; a schedule beyond 90 days
 // is not auto-skipped on a vague story command.
 if(minutes>90*1440)return {blocked:true,label,reason:'距離活動超過90日，請指定跳轉時間'};
 return {eventId:event.id,label,target,minutes,
  directive:'【玩家的幕外節奏指令】「'+input+'」是玩家要求跳到「'+label+'」的場面，不是洛河對NPC說的話。'+
   '已由伺服器將世界時間推進到活動開始或目前時間；請從正在進行的階段敘事，不要讓NPC引用這句指令。'+
   '可以摘要不重要的候場流程，但不可自動視為洛河已通過考核、報名、加入隊伍、被收徒或完成重要行動。'+
   '若缺少必要前置條件，讓她在此階段合理遇到需親自決定或接受評定的情境；不反覆重開舊話題。'};
}
export function prepareSceneJump(world,plan){
 if(!plan||plan.blocked||!Number.isInteger(plan.minutes)||plan.minutes<0)throw Error('跳轉規劃無效');
 const working=structuredClone(world),from=elapsedMinutes(working);
 if(plan.minutes===0)return working;
 const to=plan.target;
 working.day=Math.floor(to/1440)+1;working.minute=to%1440;
 advanceEventCalendar(working,from,to);
 advanceLivingWorld(working,from,to);
 advanceNPCAgency(working,from,to);
 settleWorldDays(working,from,to);
 return working;
}
