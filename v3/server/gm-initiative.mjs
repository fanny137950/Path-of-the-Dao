/**
 * "繼續" means the GM advances independently observable world/NPC behavior,
 * not another choice menu. This module does not advance the clock, commit state,
 * fabricate new events or let NPCs read hidden plans.
 */
import {visibleNarrative} from './narrative.mjs';
export const isContinueIntent=text=>/^(?:繼續|继续|然後呢[？?]?|然后呢[？?]?|接著|接下来|接下來|往下|下一幕|讓劇情繼續|交給\s*GM\s*推進)[。！!～~\s]*$/.test(String(text||'').trim());
const lastNarration=world=>visibleNarrative([...world.messages].reverse().find(m=>m.role==='assistant')?.content||'');
const nowOf=world=>(world.day-1)*1440+world.minute;
const fmt=t=>'第'+(Math.floor(t/1440)+1)+'日 '+String(Math.floor(t%1440/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
/**
 * Server-grounded planning instruction, not scripted prose. At an upcoming
 * checkpoint, describe preparations rather than firing a future event.
 */
export function nextBeatDirective(world,text){
 if(!isContinueIntent(text))return '';
 const now=nowOf(world),nearby=Object.values(world.npcs||{}).filter(n=>n.where===world.location);
 const events=(world.eventCalendar?.events||[]).filter(e=>
  e.state!=='cancelled'&&e.state!=='completed'&&e.location===world.location&&now<e.end);
 const upcoming=events.flatMap(e=>(e.stages||[]).filter(b=>!e.completed?.includes(b.id)&&b.at>now)
  .map(b=>({event:e,beat:b}))).sort((a,b)=>a.beat.at-b.beat.at)[0];
 const current=events.find(e=>now>=e.start&&now<e.end);
 let stage='';
 if(upcoming)stage='接下來排程：'+upcoming.event.name+' '+upcoming.beat.title+'，預定'+fmt(upcoming.beat.at)+
  '；目前'+fmt(now)+'，尚未到點，絕不可寫成已發生。只可描寫合乎現在時間的準備或其他 NPC 自行行動。';
 else if(current)stage='此刻仍在'+current.name+'的時段內，請讓工作人員依已發生階段繼續實際作業。';
 const tested=world.location==='太虛宗山門'&&world.protagonist.spiritualRoot!=='未測定';
 const currentActivity=tested?
  '洛河已測靈根，不再重複解釋屬性或反問測試結果。由韓守一繼續處理下一份名冊、其他新人的測試或同場行政工作；可有接引人員按規定來取資料，但不能憑空讓尚未到時的初選正式開始、讓洛河自動入峰、指定師父或替她移動。': '';
 const present=nearby.map(n=>n.name).slice(0,8).join('、')||'沒有已登記的在場人物';
 const repetition=lastNarration(world).slice(-500);
 return '\n\n【本回合 GM 接管節奏：不是洛河發起新行動】目前可互動人物：'+present+'。'+
  stage+currentActivity+
  ' 請寫出一個有因果的新進展，例如現場 NPC 主動處理一項具體工作、對話中新資訊、與其他 NPC 互動或由既有事件衍生的可觀察變化；不用製造危機，也不必要求洛河立刻選擇。'+
  ' 結尾不要出現「還有什麼問題」「你想怎麼做」「要不要先」「還是想」「可以選擇」之類的任務導航。'+
  ' 可自然停在有意義的互動點，不必附上行動清單。上一幕尾端供避免重複：'+repetition;
}
/**
 * Strongly scoped quality gate: only for a naked continue turn. A question in
 * natural character dialogue is NOT automatically a failure. Reject a response
 * when it ends in a stock decision menu while doing little but restating tasks.
 */
export function assessContinueReply(text,raw){
 if(!isContinueIntent(text))return {ok:true,reason:'not-continuation'};
 const narrative=visibleNarrative(raw||'').trim();
 if(!narrative||narrative.length<24)return {ok:false,reason:'too-short'};
 const tail=narrative.slice(-190).replace(/\s+/g,'');
 const canned=/(?:你(?:還|还)?有(?:什麼|什么)(?:其他)?(?:問題|问题|想問|想问)|你(?:想|要)(?:先|不先|不)?(?:做|問|问|去哪|知道)|你(?:會|会)(?:怎麼|怎么)(?:做|選擇)|要不要(?:先)?(?:去|問|问|看看|繼續)|還是(?:想|要)(?:先)?(?:去|問|问)|可(?:以|自行)選擇|或者(?:你)?(?:想|先)|你覺得呢|你打算怎麼辦|你準備怎麼做)/;
 const endsWithMenu=canned.test(tail)&&/[？?」]?\s*$/.test(tail);
 if(!endsWithMenu)return {ok:true,reason:'no-stock-menu'};
 // A genuine new action can end in an NPC question; tolerate it when clear.
 const meaningful=/(?:忽然|突然|趕來|赶来|走近|走來|递来|遞來|交給|交给|接過|接过|喊道|高喊|攔住|拦住|打斷|打断|衝進|冲进|走出去|轉身離開|转身离开|拿走|收下|發現|发现|遞出|递出|推開門|推开门|走進|走进|敲響|敲响|交接|送來|送来|記入|记入|宣佈|宣布)/.test(narrative);
 if(meaningful)return {ok:true,reason:'meaningful-npc-action'};
 return {ok:false,reason:'stock-question-without-progress'};
}
export function retryContinueDirective(assessment){
 return '\n\n【重要：上一份草稿未通過「繼續」推進檢查（'+assessment.reason+'）】請重寫整個回合，不能只是改掉最後問號。至少讓已在場 NPC 做一件具體、可信、時間正確的新行動，或在談話中帶來真正新資訊；不得重複介紹收徒規則後又詢問洛河選什麼。不要改寫先前確定的靈根、人物位置、事件日期或替洛河做決定。';
}
