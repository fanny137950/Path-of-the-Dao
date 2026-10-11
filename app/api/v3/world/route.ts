import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
// @ts-ignore - module is authored in JS
import {initialV3World,validatedWorld,playerWorld,developerWorld,gmContext,commitV3Turn,editCharacter} from '../../../../v3/server/world.mjs';
// @ts-ignore - module is authored in JS
import {generateGMResponse} from '../../../../v3/server/openai.mjs';
// @ts-ignore - module is authored in JS
import {generateOpenRouterResponse} from '../../../../v3/server/openrouter.mjs';
// @ts-ignore - conservative objective-action stability filter
import {stabilizeDecisiveAction} from '../../../../v3/server/outcome-stability.mjs';

// @ts-ignore — server-only JS validator
import {validateTurnRequest} from '../../../../v3/server/turn-validation.mjs';
// @ts-ignore — server-only conversation protocol
import {recentConversation,CONVERSATION_STYLE} from '../../../../v3/server/conversation.mjs';
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
  if(!id){
   const rows=await requireDB().prepare("SELECT id,name,revision,created FROM worlds WHERE owner=? AND json_extract(state,'$.mode')='v3' ORDER BY created DESC,id DESC").bind(user.userId).all();
   return reply({worlds:rows.results});
  }
  if(!/^[0-9a-f-]{36}$/.test(id))return reply({error:'無效世界 ID'},400);
  const world=await readWorld(id,user.userId);
  if(!world)return reply({error:'找不到 V3 世界'},404);
  if(new URL(request.url).searchParams.get('view')==='developer'){
   if(!isDeveloper(user.userId))return reply({error:'無權查看開發者資訊'},403);
   return reply(developerWorld(world));
  }
  const requestId=new URL(request.url).searchParams.get('requestId');
  const confirmedRequestId=requestId&&world.events.some((event:{requestId?:string})=>event.requestId===requestId)?requestId:null;
  return reply({...playerWorld(world),confirmedRequestId});
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
  if(!['turn','edit-character'].includes(body.op)||typeof body.world!=='string'||!/^[0-9a-f-]{36}$/.test(body.world))return reply({error:'未知操作'},400);
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
  const text=body.text;
  if(typeof text!=='string'||!text.trim()||text.length>2500)return reply({error:'玩家輸入無效'},400);
  if(typeof body.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(body.requestId))return reply({error:'回合 ID 無效'},400);
  const check=validateTurnRequest(world,body);
  if(check.error)return reply({error:check.error},check.status);
  if(check.replayed)return reply({...playerWorld(world),usage:null});
  if(world.events.filter((e:{type:string})=>e.type==='conversation').length>=1000)return reply({error:'試玩世界已達1000回合上限，請先備份'},409);
  const mode=body.mode;
  if(!['demo','ai','openrouter'].includes(mode))return reply({error:'未知對話模式'},400);
  const key=typeof body.apiKey==='string'?body.apiKey:'';
  if(key.length>300)return reply({error:'API Key 無效'},400);
  const model=typeof body.model==='string'?body.model:undefined;
  let answer:string,usage:null|{totalTokens?:number}=null;
  if(mode==='demo')answer='韓守一合起名冊，仔細聽完洛河的話。\n\n「你想問便問；想去看看也行。山門今日很熱鬧，不必照著別人的腳步走。」\n\n（示範模式只供測試存檔；自然對話請選 OpenRouter 或 OpenAI。）';
  else{
   const args={apiKey:key,instructions:instructions+'\n\n'+CONVERSATION_STYLE,input:gmContext(world,text,{structuredConversation:true}),conversation:recentConversation(world,text),maxOutputTokens:1000};
   const result=mode==='openrouter'
    ?await generateOpenRouterResponse({...args,model:model||'openrouter/free'})
    :await generateGMResponse({...args,model:model||'gpt-4.1-mini'});
   answer=result.text;usage=result.usage;
  }
  answer=stabilizeDecisiveAction(world,text,answer);
  const next=commitV3Turn(world,text,answer,body.requestId);
  const committed=next.events.find((event:{requestId:string})=>event.requestId===body.requestId);
  committed.request={mode:body.mode,model:body.model||'',revision:body.revision};
  // Compare-and-swap: no partial turn or lost concurrent update.
  const result=await requireDB().prepare('UPDATE worlds SET state=?, revision=? WHERE id=? AND owner=? AND revision=?')
   .bind(JSON.stringify(next),next.revision,world.id,user.userId,world.revision).run();
  if(result.meta.changes!==1){
   const current=await readWorld(world.id,user.userId);
   if(current&&validateTurnRequest(current,body).replayed)return reply({...playerWorld(current),usage:null});
   return reply({error:'世界已在另一個分頁更新，請重新讀取後再決定行動'},409);
  }
  return reply({...playerWorld(next),usage});
 }catch(e){
  const status=e&&typeof e==='object'&&'status'in e&&typeof e.status==='number'?e.status:500;
  return reply({error:status===500?'伺服器處理失敗':e instanceof Error?e.message:'AI 服務失敗'},status);
 }
}
