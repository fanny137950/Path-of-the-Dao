/**
 * Player-visible journal. Never derive task titles from hidden living-world
 * plans, offscreen events, unpublished NPC memories, or developer data.
 * Milestones are tied to public observations and canonical saved world state.
 */
const short=(x,max=90)=>String(x||'').trim().slice(0,max);
const seenText=world=>(world.messages||[]).filter(x=>x?.role==='assistant').map(x=>String(x.content||'')).join('\n');
export function playerQuestJournal(world){
 const output=[];
 const story=seenText(world),events=(world.events||[]).filter(e=>e.type==='conversation');
 const root=world.protagonist?.spiritualRoot;
 const tested=root&&root!=='未測定';
 const location=world.location||'太虛宗山門';
 // The recruitment is known to any newcomer and must not disappear after a
 // successful test; do not claim automatic sect admission or apprenticeship.
 const admitted=/(?:領到|領取|獲發|發給|領了).{0,16}(?:弟子|身份|入門)(?:令牌|牌|憑證|文書)/.test(story);
 output.push({
  id:'recruitment',
  title:'太虛宗收徒大典',
  type:'主線',
  status:admitted?'已完成':tested?'進行中':'進行中',
  description:admitted?'已取得入門憑證；之後可自行選擇修行與師承方向。'
   :tested?'靈根已測定；接下來可詢問錄取安排與入門程序。'
   :'已在山門報名，等待洛河完成靈根測試及入門評估。',
  objective:admitted?'留意宗門後續安排':tested?'詢問韓守一接下來的收徒安排':'進行靈根測試',
  progress:admitted?100:tested?60:20,
  updatedDay:world.day,
 });
 // Only surfaced once publicly referenced during a witnessed conversation.
 // Even after time advances, a secret arc stays absent if the player hasn't
 // learned of it. No truth, deadlines, hidden status or future beats leave GM.
 const talkedRegister=events.some(e=>/名冊(?:編號|對不上|錯位|遺漏|核對|抄錄|更正)/.test(
   String(e.reply||'')+' '+String(e.text||'')));
 if(talkedRegister){
  const lines=events.map(e=>String(e.reply||'')+' '+String(e.text||'')).join('\n');
  const resolved=/名冊.{0,18}(?:已更正|更正完成|查清|核對完成|修正完成)/.test(lines);
  output.push({
   id:'register-check',
   title:'收徒名冊的異常',
   type:'見聞',
   status:resolved?'已完成':'已知悉',
   description:resolved?'洛河已得知名冊問題獲得處理。':'洛河聽聞名冊資料可能有問題，仍需自行判斷是否過問。',
   objective:resolved?'可繼續其他事務':'有興趣可詢問執事或自行查證',
   progress:resolved?100:20,
   updatedDay:world.day,
  });
 }
 // Limit names and texts; no event plan, NPC private notes or participants.
 return output.map(q=>({...q,title:short(q.title,40),description:short(q.description,110)})).slice(0,12);
}
