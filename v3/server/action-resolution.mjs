/**
 * Explicit action resolution gate. A decisive player action must be
 * adjudicated this turn; NPCs can defend, block or stop it, but cannot turn
 * "打他" into another invitation or simply wait for the player to act again.
 */
import {visibleNarrative} from './narrative.mjs';

const ATTACK=/^(?:(?:上前|衝過去|冲过去|直接|立刻|馬上|狠狠|用拳頭|一拳|抬手|出手)\s*)*(?:打|揍|踢|踹|扇|砍|刺|攻擊|攻击|動手打|动手打)(?:他|她|對方|那個人|韓煜|叶冲|葉沖|白袍少年|灰布衣少年|一拳|一掌|一腳|一剑|一劍|過去|过去|一下|一頓|一顿)?[！!。.\s]*$/u;
const ADJUDICATED=/(?:拳(?:頭|峰|風|风)?|掌|腳|腿|劍|剑|刀|攻擊|攻击|出手|揮|挥|打|揍|踢|踹|扇|刺|砍|攔|拦|擋|挡|避|躲|閃|闪|扣住|抓住|止住|制止|阻止|拉住|失手|擊中|击中|撞上|碰到|打中|打空|落空|退開|退开|撲向|扑向|出拳|出劍|出剑|反擊|反击)/u;
const REAL_ACTION=/(?:洛河|你|妳|她|拳|掌|腳|腿|劍|剑|刀|韓煜|对方|對方)[^。！？\n]{0,75}(?:出手|揮|挥|打中|打空|擊中|击中|砸|劈|刺|踢|踹|扇|砍|拳|掌|腳|腿|劍|剑|刀|擋|挡|閃|闪|躲開|躲开|攔住|拦住|制止|扣住|抓住|被.*?阻止|來不及|没能|未能|無法出手|无法出手|沒能出手)/u;
const STALL=/(?:先(?:動|动)動|先出手|動動你的|动动你的|試試你的拳頭|试试你的拳头|等著你的動作|等着你的动作|等待你出手|來吧|来吧|真敢動手|真敢动手|你(?:敢不敢|要不要|準備|准备|想不想)|讓我看看|让我看看)/u;

export function isDecisiveAttack(text){return ATTACK.test(String(text||'').trim());}
export function assessActionResolution(text,answer){
 if(!isDecisiveAttack(text))return {ok:true,reason:'not-action'};
 const narrative=visibleNarrative(answer||'').trim();
 // Claims inside NPC speech ('先試試你的拳頭') cannot adjudicate a hit.
 const observable=narrative.replace(/「[^」]*」|『[^』]*』/gu,'');
 if(!narrative)return {ok:false,reason:'empty-action'};
 // Reject pure taunting/permission loops: they contain combat vocabulary but
 // no resolved attempt, defense or concrete intervention.
 if(STALL.test(narrative)&&!REAL_ACTION.test(observable))
  return {ok:false,reason:'stalling-attack'};
 if(!ADJUDICATED.test(observable)||!REAL_ACTION.test(observable))
  return {ok:false,reason:'no-action-outcome'};
 return {ok:true,reason:'adjudicated'};
}
export function actionResolutionDirective(text,assessment){
 if(!isDecisiveAttack(text))return '';
 return '\n\n【強制行動結算】玩家已明確指定洛河採取動作「'+String(text).slice(0,50)+'」；這是現在正在發生的行動，不是提議、邀請或準備。請即刻裁定動作：描述她嘗試如何動手，對手能否防禦或躲避、旁人有無能力及時阻止，最後是擊中、閃避、格擋或遭制止，以及現場可見的即時後果。可失敗，不能自動勝利；但絕不可只讓對手笑著叫她先動手。不要替洛河添加下一步行動或內心想法。'+
 (assessment?.ok===false?'上一份草稿的錯誤是：'+assessment.reason+'，請整回合重寫。':'');
}
