import {fastForwardRequest,fastForwardText,fastForwardDirective,assertCanFastForward} from '../../../../v3/server/fast-forward.mjs';
// @ts-ignore - append-only memory history
import {historyArchive,correctMemory,serializeWorldSave} from '../../../../v3/server/memory-system.mjs';
// @ts-ignore - bounded original conversation roles
import {providerConversation} from '../../../../v3/server/conversation-memory.mjs';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
// @ts-ignore - server-only JS config
import {serverAIConfig,chooseServerAI} from '../../../../v3/server/server-ai.mjs';
// @ts-ignore - module is authored in JS
import {initialV3World,validatedWorld,playerWorld,developerWorld,gmContext,commitV3Turn,editCharacter,developerTaskChange} from '../../../../v3/server/world.mjs';
// @ts-ignore - module is authored in JS
import {generateGMResponse} from '../../../../v3/server/openai.mjs';
// @ts-ignore - module is authored in JS
import {generateOpenRouterResponse} from '../../../../v3/server/openrouter.mjs';
// @ts-ignore - pure GM prompt contract
import {GM_INSTRUCTIONS} from '../../../../v3/server/gm-prompt.mjs';

// @ts-ignore - request identity and optimistic concurrency only
import {turnIdentity,checkTurnRequest} from '../../../../v3/server/turn-request.mjs';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
function requireDB(){
 const database=env.DB;
 if(!database)throw new Error('Cloudflare D1 DB 綁定不存在');
 return database;
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
  const view=new URL(request.url).searchParams.get('view');
  if(view==='history'){
   const params=new URL(request.url).searchParams;
   const before=Number(params.get('before'))||Infinity;
   const entries=historyArchive(world,params.get('q')||'',before);
   return reply({entries,nextBefore:entries.length===25?entries.at(-1)?.revision:null});
  }
  if(view==='export')return new Response(JSON.stringify({format:'wendao-save-v1',exportedAt:new Date().toISOString(),world}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Content-Disposition':'attachment; filename="wendao-save.json"'}});
  if(view==='developer'){
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
  if(body.op==='delete-history'){
   // Destructive operation is scoped to the authenticated player's V3 saves.
   // Never delete legacy worlds, another user, or any GitHub history.
   if(body.confirm!=='DELETE_MY_V3_HISTORY')return reply({error:'請先確認刪除自己的全部 V3 世界紀錄'},400);
   const result=await requireDB().prepare("DELETE FROM worlds WHERE owner=? AND json_extract(state,'$.mode')='v3'")
    .bind(user.userId).run();
   return reply({deleted:result.meta.changes});
  }
  if(body.op==='new'){
   const id=crypto.randomUUID(),world={...initialV3World(id),gmManaged:true};
   await requireDB().prepare('INSERT INTO worlds (id,owner,name,revision,state,created) VALUES (?,?,?,?,?,?)')
    .bind(id,user.userId,'問道九州 V3 · 洛河',0,JSON.stringify(world),new Date().toISOString()).run();
   return reply(playerWorld(world),201);
  }
  if(!['turn','advance-time','fast-forward','edit-character','manage-task','edit-memory'].includes(body.op)||typeof body.world!=='string'||!/^[0-9a-f-]{36}$/.test(body.world))return reply({error:'未知操作'},400);
  const world=await readWorld(body.world,user.userId);
  if(!world)return reply({error:'找不到 V3 世界'},404);
  if(body.op==='edit-memory'){
   if(body.revision!==world.revision)return reply({error:'世界已更新，請重新讀取記憶'},409);
   let next;
   try{next=correctMemory(world,body.target,body.patch,body.note,user.userId);}
   catch(e){return reply({error:e instanceof Error?e.message:'記憶修正無效'},400);}
   const result=await requireDB().prepare('UPDATE worlds SET state=?, revision=? WHERE id=? AND owner=? AND revision=?')
    .bind(serializeWorldSave(next),next.revision,world.id,user.userId,world.revision).run();
   if(result.meta.changes!==1)return reply({error:'世界已更新，請重新讀取記憶'},409);
   return reply({world:playerWorld(next)});
  }
  if(body.op==='edit-character'){
   if(body.revision!==world.revision)return reply({error:'世界版本已更新，請重新讀取人物資料'},409);
   let next;
   try{next=editCharacter(world,body.actor,body.patch,body.note,user.userId);}
   catch(e){return reply({error:e instanceof Error?e.message:'人物設定無效'},400);}
   const result=await requireDB().prepare('UPDATE worlds SET state=?, revision=? WHERE id=? AND owner=? AND revision=?')
    .bind(serializeWorldSave(next),next.revision,world.id,user.userId,world.revision).run();
   if(result.meta.changes!==1)return reply({error:'世界資料已更新，請重試'},409);
   return reply({world:playerWorld(next),developer:developerWorld(next)});
  }
  if(body.op==='manage-task'){
   if(body.revision!==world.revision)return reply({error:'世界版本已更新，請重新載入任務'},409);
   let next;
   try{next=developerTaskChange(world,body.action,body.task,user.userId);}
   catch(e){return reply({error:e instanceof Error?e.message:'任務資料無效'},400);}
   const result=await requireDB().prepare('UPDATE worlds SET state=?, revision=? WHERE id=? AND owner=? AND revision=?')
    .bind(serializeWorldSave(next),next.revision,world.id,user.userId,world.revision).run();
   if(result.meta.changes!==1)return reply({error:'世界資料已更新，請重試'},409);
   return reply({world:playerWorld(next),developer:developerWorld(next)});
  }
  const fastForward=body.op==='fast-forward'?fastForwardRequest(body):null;
  const requestedMinutes=body.advanceMinutes;
  const isTimeAdvance=body.op==='advance-time';
  if(isTimeAdvance&&![15,60,360,1440].includes(requestedMinutes))
   return reply({error:'時間只能推進 15 分鐘、1 小時、6 小時或 1 天'},400);
  const text=isTimeAdvance
   ?'洛河選擇在目前位置等待'+({15:'一刻鐘',60:'一個時辰的一半（約一小時）',360:'六個小時',1440:'一整天'} as Record<number,string>)[requestedMinutes]+'，留意周遭的人事變化。'
   :fastForward?fastForwardText(fastForward):body.text;
  if(typeof text!=='string'||!text.trim()||text.length>2500)return reply({error:'玩家輸入無效'},400);
  if(typeof body.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(body.requestId))return reply({error:'回合 ID 無效'},400);
  const identity=turnIdentity(body,text);
  const check=checkTurnRequest(world,body.requestId,identity);
  if(check.error)return reply({error:check.error},check.status);
  if(check.replayed)return reply({...playerWorld(world),usage:null});
  if(fastForward||isTimeAdvance)assertCanFastForward(world);
  if(world.events.filter((e:{type:string})=>e.type==='conversation').length>=1000)return reply({error:'試玩世界已達1000回合上限，請先備份'},409);
  const mode=body.mode;
  if(!['demo','ai','openrouter'].includes(mode))return reply({error:'未知對話模式'},400);
  if(body.apiKey!==undefined)return reply({error:'本版使用伺服器金鑰，請勿傳送個人 API Key'},400);
  const selected=mode==='demo'?null:chooseServerAI(serverAIConfig(env,user.userId),mode,body.model);
  const model=selected?.model;
  world.gmManaged=true;
  const actingWorld=world;
  let answer:string,usage:null|{totalTokens?:number}=null;
  let usedModel:string=mode==='demo'?'示範模式':'';
  if(mode==='demo')answer=fastForward
   ?'洛河沿著已安排的日常度過一段時間，周遭的宗務照常運作。\n\n（示範模式只測試快進與存檔，不會生成 AI 事件。）\n<!--GM_STATE:'+JSON.stringify({elapsedMinutes:Math.min(60,fastForward.limitMinutes),decision:null})+'-->'
   :isTimeAdvance
   ?'洛河在原處等待，時間緩緩流逝。來往弟子換了幾批，周遭的宗務照常運作。\n\n（示範模式不會產生動態 NPC 對話，請使用 AI 模式體驗故事。）'
   :'韓守一合起名冊，仔細聽完洛河的話。\n\n「你想問便問；想去看看也行。山門今日很熱鬧，不必照著別人的腳步走。」\n\n（示範模式只供測試存檔；自然對話請選 OpenRouter 或 OpenAI。）';
  else{
   const timeDirective=isTimeAdvance
    ?'\n\n【玩家已選時間推進】本次將在伺服器準確推進'+requestedMinutes+'分鐘；洛河只是在現址等待，沒有同意移動、拜師或戰鬥。請自然描寫這段時間的環境與 NPC 行動；如事件未被當場得知，不得讓洛河憑空知道隱藏真相。若無人與她互動，描述具體可觀察的日常變化，不要只是複述上一幕。'
    :fastForward?fastForwardDirective(fastForward):'';
   const args={apiKey:selected!.apiKey,instructions:GM_INSTRUCTIONS+timeDirective,conversation:providerConversation(actingWorld,text),input:gmContext(actingWorld,text,{includeDialogue:false,advanceMinutes:isTimeAdvance?requestedMinutes:fastForward?.limitMinutes||0}),maxOutputTokens:4000};
   const generate=(instruction:string)=>mode==='openrouter'
    ?generateOpenRouterResponse({...args,instructions:instruction,model:model||'openrouter/free'})
    :generateGMResponse({...args,instructions:instruction,model:model||'gpt-4.1-mini'});
   const result=await generate(args.instructions);
   answer=result.text;usage=result.usage;usedModel=result.model;
  }

  const next=commitV3Turn(actingWorld,text,answer,body.requestId,
   isTimeAdvance?{advanceMinutes:requestedMinutes}:fastForward?{fastForward}:{});
  const committed=next.events.find((event:{requestId?:string})=>event.requestId===body.requestId);
  committed.request=identity;
  // Compare-and-swap: no partial turn or lost concurrent update.
  const result=await requireDB().prepare('UPDATE worlds SET state=?, revision=? WHERE id=? AND owner=? AND revision=?')
   .bind(serializeWorldSave(next),next.revision,world.id,user.userId,world.revision).run();
  if(result.meta.changes!==1){
   const current=await readWorld(world.id,user.userId);
   if(current&&checkTurnRequest(current,body.requestId,identity).replayed)return reply({...playerWorld(current),usage:null});
   return reply({error:'世界已在另一個分頁更新，請重新讀取後再決定行動'},409);
  }
  return reply({...playerWorld(next),usage,usedModel});
 }catch(e){
  const status=e&&typeof e==='object'&&'status'in e&&typeof e.status==='number'?e.status:500;
  return reply({error:status===500?'伺服器處理失敗':e instanceof Error?e.message:'AI 服務失敗'},status);
 }
}
