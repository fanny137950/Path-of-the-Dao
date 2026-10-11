/*
 * First playable recruitment arc. All transitions are computed from player input
 * and a stable per-world outcome, not from unverifiable AI prose.
 * Suggestions are non-binding conveniences; free input remains first-class.
 */
export const PHASES=Object.freeze({
 test_ready:'等待測靈根',result_known:'靈根已測定',
 admitted:'初試通過',outer_checkin:'外門報到',
});
const ROOTS=Object.freeze([
 '風靈根','水木雙靈根','火靈根','土靈根',
 '金靈根','水靈根','木靈根','風水雙靈根',
 '風靈根','純風靈根',
]);
export function spiritualRootForWorld(id){
 const key=String(id||'');
 let hash=2166136261;
 for(let i=0;i<key.length;i++){hash^=key.charCodeAt(i);hash=Math.imul(hash,16777619);}
 return ROOTS[(hash>>>0)%ROOTS.length];
}
export function initialProgress(){
 return {phase:'test_ready',stageTurns:0,rootMeasuredAt:null};
}
export function progressOf(world){
 const raw=world?.progress;
 if(raw&&Object.hasOwn(PHASES,raw.phase)){
  return {phase:raw.phase,
   stageTurns:Number.isInteger(raw.stageTurns)&&raw.stageTurns>=0?raw.stageTurns:0,
   rootMeasuredAt:raw.rootMeasuredAt??null};
 }
 // Safe migration: established root is not erased or reassigned.
 if(world?.protagonist?.spiritualRoot&&world.protagonist.spiritualRoot!=='未測定')
  return {phase:'result_known',stageTurns:0,rootMeasuredAt:null};
 return initialProgress();
}
function actionIsNegated(text){
 return /(?:不要|不想|拒絕|不按|不碰|先別|別碰|沒按|尚未|不準備|收回手)/.test(text);
}
function touchesStone(text){
 if(actionIsNegated(text))return false;
 return /(手|手掌|掌心|指尖).{0,12}(按|放|觸|貼|伸|碰|摸)/.test(text)||
  /(按|放|觸|貼|伸|碰|摸).{0,12}(測靈石|測試石|靈石|石面|石頭)/.test(text)||
  /(?:測靈根|開始測試|接受測試)/.test(text);
}
function acceptsToken(text){
 if(/(?:不要|拒絕|不收|不拿|沒接|先別)/.test(text))return false;
 return /(?:收下|接過|領取|領到|拿起|拿了|收起).{0,12}(?:木牌|報到牌|名牌|牌子)/.test(text)||
  /(?:木牌|報到牌|名牌|牌子).{0,8}(?:接過|收下|領取)/.test(text);
}
function goesToOuter(text){
 if(/(?:不去|不要去|不前往|暫時不)/.test(text))return false;
 return /(?:前往|去|走向|走到|抵達|到|報到|進入).{0,10}(?:外門報到處|外門報到|報到處)/.test(text)||
  /(?:外門報到處|報到處).{0,8}(?:前往|報到|走去)/.test(text);
}
export function prepareProgress(world,playerText){
 const current=progressOf(world),phase=current.phase,text=String(playerText||'').trim();
 if(phase==='test_ready'&&touchesStone(text)){
  const root=spiritualRootForWorld(world.id);
  return {from:phase,to:'result_known',kind:'root-test',root,
   cutscene:'洛河的手掌貼上測靈石。石面先是一片沉寂，隨即泛起光芒，測試陣紋依序亮起。\n\n韓守一仔細核對記錄，提筆寫下結果。\n\n「'+root+'。」他將記錄玉簡翻過一面，語氣終於多了幾分認真。「靈根測定完畢，初試合格。這是你的報到木牌，領了牌便能往下一處去。」\n\n一塊刻有太虛宗雲紋的木牌被放在桌邊。隊伍往前移動，後面已有下一位應試者等候。'};
 }
 if(phase==='result_known'&&acceptsToken(text)){
  return {from:phase,to:'admitted',kind:'token-accepted',
   cutscene:'洛河接過木牌，溫潤的木面刻著太虛宗雲紋，背面還有外門報到處的位置。\n\n韓守一在名冊上勾去一行。「初試登記完成。接下來去外門報到處領住處與日課安排。若有疑問，也可以問那邊的接引弟子。」\n\n這一輪收徒測試告一段落，前方山道已開放新弟子通行。'};
 }
 if(phase==='admitted'&&goesToOuter(text)){
  return {from:phase,to:'outer_checkin',kind:'outer-arrival',toLocation:'外門報到處',
   cutscene:'洛河沿著木牌背面的指引走過外門石道，抵達外門報到處。\n\n一名身著灰青弟子服的少女正整理一疊新生名冊。她抬頭看了看洛河手上的木牌。\n\n「新弟子？正好。把木牌拿來，我給你登記住處，接著說明今日的日課。」\n\n周圍還有幾名剛通過初試的弟子，正小聲討論要去哪一峰修行。'};
 }
 return {from:phase,to:phase,kind:'conversation',cutscene:null};
}
export function applyPreparedProgress(next,preparation){
 const old=progressOf(next);
 next.progress={...old,phase:preparation.to,
  stageTurns:preparation.to===preparation.from?old.stageTurns+1:0,
  rootMeasuredAt:preparation.kind==='root-test'
   ?{day:next.day,minute:next.minute}:old.rootMeasuredAt};
 if(preparation.root)next.protagonist.spiritualRoot=preparation.root;
 if(preparation.toLocation)next.location=preparation.toLocation;
 return next;
}
const actions={
 test_ready:[
  {id:'test',label:'把手放上測靈石',text:'我走到測靈石前，把手掌按上去。'},
  {id:'ask',label:'詢問測試規則',text:'我問韓守一：測靈石會測出什麼？'},
  {id:'observe',label:'觀察其他應試者',text:'我看向旁邊正在測試的人，觀察靈石的反應。'},
 ],
 result_known:[
  {id:'take',label:'領取報到木牌',text:'我接過韓守一遞來的報到木牌。'},
  {id:'root',label:'詢問靈根的意義',text:'我問韓守一：這個靈根代表什麼？'},
  {id:'peak',label:'打聽棲風峰',text:'我問韓守一：棲風峰是什麼地方？'},
 ],
 admitted:[
  {id:'go',label:'前往外門報到處',text:'我拿著木牌前往外門報到處。'},
  {id:'peak',label:'詢問宗門十二峰',text:'我向韓守一詢問太虛宗十二峰的情況。'},
  {id:'friends',label:'認識同屆弟子',text:'我走向一位正在等待的同屆弟子，主動打招呼。'},
 ],
 outer_checkin:[
  {id:'checkin',label:'辦理新弟子報到',text:'我將木牌交給接引弟子，請她幫我登記住處。'},
  {id:'daily',label:'詢問修煉日課',text:'我問接引弟子：新弟子每天要做哪些修煉？'},
  {id:'peers',label:'與同屆弟子交談',text:'我走向旁邊的新弟子，問她是哪裡來的。'},
 ],
};
export function suggestedActions(world){
 const progress=progressOf(world);
 const available=actions[progress.phase]||[];
 // Distinct, bounded commands, never secret or authoritatively decisive.
 return available.map(a=>({...a}));
}
export function progressFacts(world,playerText){
 const p=prepareProgress(world,playerText),phase=progressOf(world).phase;
 const official=p.root?'本回合玩家正在實際觸摸測靈石，測得結果固定為「'+p.root+'」，不可改成其他靈根。':
  p.kind==='token-accepted'?'本回合洛河正式收下報到木牌，完成入門初試；不要再要求她回答姓名或重新測試。':
  p.kind==='outer-arrival'?'本回合洛河已抵達外門報到處，應開始外門日課／住處登記；現場有接引弟子。':'';
 const scene={
  test_ready:'名冊已寫明：洛河，十五歲。韓守一右手邊的桌上放著測靈石，大小如盤，無需再問姓名或年齡。玩家可以直接按石測試，也可以詢問或觀察。',
  result_known:'測試已完成，靈根是「'+world.protagonist.spiritualRoot+'」。韓守一已提供報到木牌，下一步是收下木牌或追問測試結果。嚴禁再把靈根說成未知。',
  admitted:'初試已合格並領木牌，下一步可前往外門報到處、認識新弟子或打聽宗門。不要再回到測試流程。',
  outer_checkin:'已到外門報到處，接引弟子在場，可安排住處與日課。不要重新開始收徒測試。',
 }[phase];
 return '【場景階段：'+PHASES[phase]+'】'+scene+
  '\n【本回合玩家動作的結算】'+(official||'尚未達成下一個流程里程碑；但本回合必須有新的回答、人物反應、可見進展或線索，不能複製上回合的敘述。')+
  '\n【節奏要求】不要重複前一回合開頭景物描寫，不得重問已知姓名年齡。避免空泛、拗口比喻，每回合通常用 100～250 字的自然繁體中文推進，最多一個必要追問。選項由程式顯示，不必在正文列選項。';
}
export function demoProgressReply(world,text){
 const p=prepareProgress(world,text);
 if(p.cutscene)return p.cutscene;
 switch(p.from){
  case 'test_ready':return '韓守一看了你一眼，拿筆點了點面前的名冊。\n\n「洛河，十五歲，已登記。測靈石就在你面前，將手掌按上去就行。若不放心，可以先看別人怎麼做。」\n\n旁邊的測試臺忽然亮起一抹金光，隊伍裡傳來低低的驚嘆。';
  case 'result_known':return '韓守一看著已記錄的靈根結果，解釋了幾句修行上可能的方向。\n\n「靈根只決定起步方向，不保證日後成就。先拿木牌，後面的外門接引弟子會把規矩說清楚。」';
  case 'admitted':return '山門裡漸漸熱鬧起來。韓守一收好名冊，指向通往外門的石道。\n\n「你已通過初試。拿著木牌去報到，或者趁現在問我一兩件事。別讓隊伍等太久。」';
  default:return '接引弟子抬頭看向洛河手中的木牌。\n\n「先登記住處，再領日課冊。你也可以先跟其他新弟子認識認識。」';
 }
}
