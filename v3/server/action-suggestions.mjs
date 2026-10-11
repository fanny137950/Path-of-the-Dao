/**
 * Contextual and non-railroading player shortcuts.
 * Never ask again about completed/answered milestones, and never create
 * unsupported NPCs or events from mere string-matching of old history.
 * The player can always type freely; these shortcuts are optional.
 */
import {visibleNarrative} from './narrative.mjs';
const offer=(label,text,kind='action')=>({label,text,kind});
const lastReply=world=>{
 const last=[...(world.messages||[])].reverse().find(x=>x.role==='assistant');
 return visibleNarrative(last?.content||'').slice(-1500);
};
const recentPlayerTexts=world=>(world.messages||[]).filter(x=>x.role==='user').slice(-8).map(x=>x.content).join('\n');
const calendarState=(world,id)=>world.eventCalendar?.events?.find(e=>e.id===id);
export function suggestedActions(world){
 const narrative=lastReply(world),history=recentPlayerTexts(world);
 const location=world.location||'',focus=world.scene?.focus||'';
 const tested=world.protagonist?.spiritualRoot!=='未測定';
 const suggestions=[];
 const add=(label,text,when=true)=>{
  if(when&&!history.includes(text)&&!suggestions.some(s=>s.text===text))suggestions.push(offer(label,text));
 };
 // Only offer direct physical actions whose objects are in the current scene.
 if(location==='太虛宗山門'){
  const stone=/(測靈石|測靈臺|測試石)/.test(narrative)||focus==='測靈石';
  if(!tested&&stone){
   add('將手按上測靈石','我將手掌按在測靈石上，接受測試。');
  }
  // Admission procedures are different from asking again what a tested root means.
  if(tested){
   const admitted=/(?:領到|領取|獲發|發給|領了).{0,16}(?:弟子|身份|入門)(?:令牌|牌|憑證|文書)/.test(
    (world.messages||[]).filter(m=>m.role==='assistant').map(m=>m.content).join('\n'));
   if(!admitted&&/(?:領取|頒發|發放|入門憑證|報到|接引|核對名冊)/.test(narrative))
    add('查看入門手續','我查看此刻是否有可以辦理的入門手續。');
   const selection=calendarState(world,'twelve-peaks-selection');
   if(selection?.state==='active'&&/(?:各峰|十二峰|接引|選徒|初選)/.test(narrative))
    add('觀察各峰代表','我留意現場各峰代表正在做什麼，不打斷他們。');
  }
 }
 // Other actions appear only if that interaction is actually in the current reply.
 if(/(?:演武場|劍坪|比試|切磋)/.test(narrative))
  add('觀察眼前的對手','我先觀察目前在場對手的動作與反應，暫不出招。');
 if(/(?:藏經樓|眼前書架|書冊|可借閱的書)/.test(narrative))
  add('查看眼前書目','我看看目前能閱讀的書目，不擅闖禁區。');
 if(/(?:有人走近|向洛河走來|攔住洛河|朝洛河開口)/.test(narrative))
  add('聽聽對方要說什麼','我看向剛才靠近的人，聽對方接下來說什麼。');
 // Progression is always available, but one button is sufficient. It must not
 // create another menu of stock questions for the same completed scene.
 suggestions.push(offer('交給 GM 推進','繼續','advance'));
 return suggestions.slice(0,3);
}
