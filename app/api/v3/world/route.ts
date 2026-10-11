import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
// @ts-ignore - module is authored in JS
import {initialV3World,validatedWorld,playerWorld,developerWorld,gmContext,commitV3Turn,editCharacter,developerTaskChange} from '../../../../v3/server/world.mjs';
// @ts-ignore - module is authored in JS
import {generateGMResponse} from '../../../../v3/server/openai.mjs';
// @ts-ignore - module is authored in JS
import {generateOpenRouterResponse} from '../../../../v3/server/openrouter.mjs';
// @ts-ignore - conservative objective-action stability filter
import {stabilizeDecisiveAction} from '../../../../v3/server/outcome-stability.mjs';
// @ts-ignore - backend-only GM initiative director
import {nextBeatDirective,assessContinueReply,retryContinueDirective,isContinueIntent} from '../../../../v3/server/gm-initiative.mjs';
// @ts-ignore - backend scene jump planner
import {sceneJumpPlan,prepareSceneJump} from '../../../../v3/server/scene-jump.mjs';
// @ts-ignore - backend narration fact guard
import {checkWorldFacts,correctionDirective} from '../../../../v3/server/world-fact-guard.mjs';
// @ts-ignore - explicit action adjudication quality gate
import {assessActionResolution,actionResolutionDirective} from '../../../../v3/server/action-resolution.mjs';

export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
function requireDB(){
 const database=env.DB;
 if(!database)throw new Error('Cloudflare D1 DB 綁定不存在');
 return database;
}
const instructions=`你是《問道九州》的中央 GM，不是選項式任務導航器。這是持續的、自由輸入的修仙角色扮演，玩家只控制十五歲的洛河。

【最重要的體驗】像在 ChatGPT 中自然演修仙世界：NPC 可以與洛河你來我往聊很久、打趣、吵架、誤解、拒絕、沉默或主動改變話題。不要每回合重新描述同一段景色、重問已知問題或強迫完成下一個流程。玩家說「繼續」就主動讓當前人物、時間或事件自然推進，不要反問玩家要選什麼。對話不應動輒結束場景。

【世界權威】使用伺服器提供的世界事實、每個NPC的個別記憶、角色個性、所處地點、修為及隱藏事件計畫。隱藏真相只供你保持因果，未知道真相的NPC不能全知、洩密或用讀心能力得知洛河私下所想。事件計畫可因洛河行動合理變化，但NPC不應只是圍著洛河轉。不能擅自改變洛河境界或已測靈根，不得憑劇情一句話改寫資料庫。

【動作與對話】短輸入應依上下文判斷：例如面前只有測靈石時「手放上去」自然是按在石頭上。行動依現實條件結算，不能所有行為都自動成功，也不能強制玩家回去完成某項任務。修為與因果限制仍在。適時提供新線索、他人行動或日常變化，但不必每回合都有危機。

【文風】繁體中文。旁白與NPC台詞同一則訊息；語言直接自然、人物各有口氣，避免奇怪比喻及冗長重複。純對話可很短；複雜事件可寫長一些。不要生成供點擊的固定選項；玩家自行輸入。

【主角控制界線】絕對不能替洛河編造內心獨白、想法、害怕、決心、額外台詞或尚未輸入的下一步行動；可以描寫玩家剛才選擇的動作如何成功或失敗。不要讓洛河突然拿起整顆測靈石，除非她明確說要搬動石頭。

【場景連續性】伺服器會提供上一幕的精確場景錨點。每回合從上一個動作停止的位置接續，不要因大地點仍為山門就重新走回山門口，也不要重畫同一段晨光、松樹與人群。對「放上去」「碰一下」等省略受詞的短句，優先使用當前互動物件。

【世界時間與活動硬規則】所有宗門活動、選徒典禮、約戰、限時委託、任務與持續性新事件，在 GM 宣告啟動之前必須擁有明確、可驗證的事件排程：開始與結束的遊戲絕對分鐘（第1日00:00為0）、至少一個具時間的階段、地點與參與者。以伺服器【世界排程】為權威；已結束的活動不能再次開始，尚未到時不可說成已發生。日常聊天與眼前短暫行為不用硬編任務。已預定的十二峰初選到時間會由各峰按程序運作，不要把收徒儀式永遠卡在山門聊天，也不強迫洛河參與或指定師父。新的長期事件若尚未提供完整排程，只能作為構想，不能寫成已正式開始。玩家說「接下來十二峰開始收徒」，應核對日程：時間未到則推進當下可觀察的準備，時間已到則描寫有合理途徑看到的真正開場；別用固定選項或回問代替進度。

【建立新事件】若本回合發生了新約定或正式任務，可在文末 GM_STATE JSON 裡附 schedules 陣列，例如 {"schedules":[{"id":"new-task-001","name":"新任務","type":"任務","location":"太虛宗山門","start":900,"end":1200,"participants":["registrar"],"public":true,"stages":[{"id":"begin","at":900,"title":"開始調查","detail":"執事開始查核"},{"id":"deadline","at":1200,"title":"期限截止","detail":"未處理則依既定後果結算"}]}]}。只能使用已存在 NPC 的 ID，日期不得早於當前遊戲時間，階段按時間排序；未寫入有效排程的長期新任務不視為正式成立。階段是預定計畫，不保證成功或玩家配合。時間推進期間他人可自行工作，但不能替洛河決定。

【正式新 NPC 建檔】凡新增具姓名、參與對話或預期再次出現的人物，在敘事文末同一個 GM_STATE JSON 加入 newNPCs:[{"name":"葉沖","role":"報名少年","peak":"未歸屬","traits":["自負","好勝"],"goal":"參加入門考核"}]。人物身分、靈根、修為不能憑空補完；已存在姓名不得重建。若沒輸出結構化資料，伺服器仍會從「我叫某某」辨識最明確的自我介紹，建立保守的未公開資料。不要讓新 NPC 變成一次性對白後就消失。

【結構化建議（可不填）】若NPC情緒、對玩家態度或洛河地點確實改變，可在敘事末尾加 <!--GM_STATE:{"changes":[{"id":"registrar","mood":"好奇","relationship":{"favor":1},"evidence":"敘事中的原文字句"}],"move":{"to":"棲風峰","evidence":"抵達棲風峰"}}-->。只有在場人物的固定ID才能改心情/好感，單次增減不超過2，且 evidence 必須逐字見於玩家輸入或敘事。move 僅在玩家選擇移動且已到達時提交，未到達不要填。此標記由伺服器驗證後剝除；不要在文字中討論它。沒有任何需要保存的改變就不要寫標記。`;
function isDeveloper(userId:string){
 const permissions=env as unknown as {GAME_DEVELOPER_USER_IDS?:string};
 const ids=String(permissions.GAME_DEVELOPER_USER_IDS||'').split(/[,;\s]+/).filter(Boolean);
 return ids.includes(userId);
}

async function readWorld(id:string,owner:string){
 const row=await requireDB().prepare('SELECT state,revision FROM worlds WHERE id=? AND owner=?').bind(id,owner).first<{state:string;revision:number}>();
 if(!row)return null;
 const world=validatedWorld(JSON.parse(row.state));
 if(world.revision!==row.revision)throw Error('世界版本不一致');
 return world;
}
export async function GET(request:Request){
 try{
  const user=await getChatGPTUser();if(!user)return reply({error:'請先登入'},401);
  const id=new URL(request.url).searchParams.get('world')||'';
  if(!/^[0-9a-f-]{36}$/.test(id))return reply({error:'無效世界 ID'},400);
  const world=await readWorld(id,user.userId);
  if(!world)return reply({error:'找不到 V3 世界'},404);
  if(new URL(request.url).searchParams.get('view')==='developer'){
   if(!isDeveloper(user.userId))return reply({error:'無權查看開發者資訊'},403);
   return reply(developerWorld(world));
  }
  return reply(playerWorld(world));
 }catch{return reply({error:'無法讀取世界'},500);}
}
export async function POST(request:Request){
 try{
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return reply({error:'拒絕跨站請求'},403);
  const user=await getChatGPTUser();if(!user)return reply({error:'請先登入'},401);
  const raw=await request.text();if(raw.length>12000)return reply({error:'請求過長'},413);
  const body=JSON.parse(raw);
  if(body.op==='new'){
   const id=crypto.randomUUID(),world=initialV3World(id);
   await requireDB().prepare('INSERT INTO worlds (id,owner,name,revision,state,created) VALUES (?,?,?,?,?,?)')
    .bind(id,user.userId,'問道九州 V3 · 洛河',0,JSON.stringify(world),new Date().toISOString()).run();
   return reply(playerWorld(world),201);
  }
  if(!['turn','advance-time','edit-character','manage-task'].includes(body.op)||typeof body.world!=='string'||!/^[0-9a-f-]{36}$/.test(body.world))return reply({error:'未知操作'},400);
  const world=await readWorld(body.world,user.userId);
  if(!world)return reply({error:'找不到 V3 世界'},404);
  if(body.op==='edit-character'){
   if(!isDeveloper(user.userId))return reply({error:'無權修改人物設定'},403);
   if(body.revision!==world.revision)return reply({error:'世界版本已更新，請重新讀取人物資料'},409);
   let next;
   try{next=editCharacter(world,body.actor,body.patch,body.note,user.userId);}
   catch(e){return reply({error:e instanceof Error?e.message:'人物設定無效'},400);}
   const result=await requireDB().prepare('UPDATE worlds SET state=?, revision=? WHERE id=? AND owner=? AND revision=?')
    .bind(JSON.stringify(next),next.revision,world.id,user.userId,world.revision).run();
   if(result.meta.changes!==1)return reply({error:'世界資料已更新，請重試'},409);
   return reply({world:playerWorld(next),developer:developerWorld(next)});
  }
  if(body.op==='manage-task'){
   if(!isDeveloper(user.userId))return reply({error:'無權管理任務'},403);
   if(body.revision!==world.revision)return reply({error:'世界版本已更新，請重新載入任務'},409);
   let next;
   try{next=developerTaskChange(world,body.action,body.task,user.userId);}
   catch(e){return reply({error:e instanceof Error?e.message:'任務資料無效'},400);}
   const result=await requireDB().prepare('UPDATE worlds SET state=?, revision=? WHERE id=? AND owner=? AND revision=?')
    .bind(JSON.stringify(next),next.revision,world.id,user.userId,world.revision).run();
   if(result.meta.changes!==1)return reply({error:'世界資料已更新，請重試'},409);
   return reply({world:playerWorld(next),developer:developerWorld(next)});
  }
  const requestedMinutes=body.advanceMinutes;
  const isTimeAdvance=body.op==='advance-time';
  if(isTimeAdvance&&![15,60,360,1440].includes(requestedMinutes))
   return reply({error:'時間只能推進 15 分鐘、1 小時、6 小時或 1 天'},400);
  const text=isTimeAdvance
   ?'洛河選擇在目前位置等待'+({15:'一刻鐘',60:'一個時辰的一半（約一小時）',360:'六個小時',1440:'一整天'} as Record<number,string>)[requestedMinutes]+'，留意周遭的人事變化。'
   :body.text;
  if(typeof text!=='string'||!text.trim()||text.length>2500)return reply({error:'玩家輸入無效'},400);
  if(typeof body.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(body.requestId))return reply({error:'回合 ID 無效'},400);
  const prior=world.events.find((e:{requestId:string})=>e.requestId===body.requestId);
  if(prior)return reply({...playerWorld(world),usage:null});
  if(world.events.filter((e:{type:string})=>e.type==='conversation').length>=1000)return reply({error:'試玩世界已達1000回合上限，請先備份'},409);
  const mode=body.mode;
  if(!['demo','ai','openrouter'].includes(mode))return reply({error:'未知對話模式'},400);
  const key=typeof body.apiKey==='string'?body.apiKey:'';
  if(key.length>300)return reply({error:'API Key 無效'},400);
  const model=typeof body.model==='string'?body.model:undefined;
  const scenePlan=!isTimeAdvance?sceneJumpPlan(world,text):null;
  if(scenePlan?.blocked)return reply({error:scenePlan.reason||'無法跳轉到指定活動'},400);
  const actingWorld=scenePlan?prepareSceneJump(world,scenePlan):world;
  let answer:string,usage:null|{totalTokens?:number}=null;
  const progressionDirective=!isTimeAdvance&&!scenePlan?nextBeatDirective(actingWorld,text):'';
  if(mode==='demo')answer=isTimeAdvance
   ?'洛河在原處等待，時間緩緩流逝。來往弟子換了幾批，周遭的宗務照常運作。\n\n（示範模式不會產生動態 NPC 對話，請使用 AI 模式體驗故事。）'
   :'韓守一合起名冊，仔細聽完洛河的話。\n\n「你想問便問；想去看看也行。山門今日很熱鬧，不必照著別人的腳步走。」\n\n（示範模式只供測試存檔；自然對話請選 OpenRouter 或 OpenAI。）';
  else{
   const timeDirective=isTimeAdvance
    ?'\n\n【玩家已選時間推進】本次將在伺服器準確推進'+requestedMinutes+'分鐘；洛河只是在現址等待，沒有同意移動、拜師或戰鬥。請自然描寫這段時間的環境與 NPC 行動；如事件未被當場得知，不得讓洛河憑空知道隱藏真相。若無人與她互動，描述具體可觀察的日常變化，不要只是複述上一幕。'
    :'';
   const args={apiKey:key,instructions:instructions+timeDirective+progressionDirective+(scenePlan?'\n\n'+scenePlan.directive:'')+actionResolutionDirective(text),input:gmContext(actingWorld,text),maxOutputTokens:1000};
   const generate=(instruction:string)=>mode==='openrouter'
    ?generateOpenRouterResponse({...args,instructions:instruction,model:model||'openrouter/free'})
    :generateGMResponse({...args,instructions:instruction,model:model||'gpt-4.1-mini'});
   const result=await generate(args.instructions);
   answer=result.text;usage=result.usage;
   const quality=assessContinueReply(text,answer);
   const facts=checkWorldFacts(actingWorld,answer);
   const action=assessActionResolution(text,answer);
   if((!quality.ok&&isContinueIntent(text))||!facts.ok||!action.ok){
    // Draft is never saved. Retry only clearly stalled "繼續" turns, at most once.
    const retry=await generate(args.instructions+
     (!quality.ok&&isContinueIntent(text)?retryContinueDirective(quality):'')+
     (!facts.ok?correctionDirective(facts):'')+
     (!action.ok?actionResolutionDirective(text,action):''));
    answer=retry.text;
    usage={totalTokens:(result.usage?.totalTokens||0)+(retry.usage?.totalTokens||0)};
    if((isContinueIntent(text)&&!assessContinueReply(text,answer).ok)||!checkWorldFacts(actingWorld,answer).ok||!assessActionResolution(text,answer).ok){
     return reply({error:'GM 回覆未通過敘事一致性檢查，世界與遊戲時間未儲存，請重試。'},502);
    }
   }
  }
  answer=stabilizeDecisiveAction(actingWorld,text,answer);
  if(mode==='demo'&&!checkWorldFacts(actingWorld,answer).ok)
   return reply({error:'示範模式回覆不符合世界設定，未儲存。'},502);
  const next=commitV3Turn(actingWorld,text,answer,body.requestId,
   isTimeAdvance?{advanceMinutes:requestedMinutes}:scenePlan?{advanceMinutes:0,sceneJump:{eventId:scenePlan.eventId,minutes:scenePlan.minutes}}:{});
  // Compare-and-swap: no partial turn or lost concurrent update.
  const result=await requireDB().prepare('UPDATE worlds SET state=?, revision=? WHERE id=? AND owner=? AND revision=?')
   .bind(JSON.stringify(next),next.revision,world.id,user.userId,world.revision).run();
  if(result.meta.changes!==1)return reply({error:'世界已在另一個分頁更新，請重新整理後重試'},409);
  return reply({...playerWorld(next),usage});
 }catch(e){
  const status=e&&typeof e==='object'&&'status'in e&&typeof e.status==='number'?e.status:500;
  return reply({error:status===500?'伺服器處理失敗':e instanceof Error?e.message:'AI 服務失敗'},status);
 }
}
