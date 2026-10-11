import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
// @ts-ignore - module is authored in JS
import {initialV3World,validatedWorld,playerWorld,developerWorld,gmContext,commitV3Turn,editCharacter} from '../../../../v3/server/world.mjs';
// @ts-ignore - module is authored in JS
import {generateGMResponse} from '../../../../v3/server/openai.mjs';
// @ts-ignore - module is authored in JS
import {generateOpenRouterResponse} from '../../../../v3/server/openrouter.mjs';

export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
function requireDB(){
 const database=env.DB;
 if(!database)throw new Error('Cloudflare D1 DB 綁定不存在');
 return database;
}
const instructions=`你是《問道九州》V3 的中央 GM。玩家扮演少女洛河；重大決策與台詞由玩家決定。繁體中文，一則回應同時描述場景和在場 NPC 的台詞，不要反覆鋪陳。嚴格遵守伺服器提供的角色境界、所在地、固定性格、各人物的個別知情與長期記憶。NPC 有自己的目標，可以拒絕、誤會或生氣；不在場的人物不會突然出現，亦不可能知道沒有目睹、聽說或調查到的事件。任何由玩家自稱的變化不自動成為真實修為或客觀歷史。請勿憑空敘述已修改資料庫。保留真實感、合理因果，不要不斷製造危機。\n\n【選用的結構化狀態建議】若本回合明確影響在場 NPC 情緒或對玩家態度，可以在敘述最後額外附加一個不可見標記，格式為：<!--GM_STATE:{"changes":[{"id":"registrar","mood":"好奇","relationship":{"favor":1},"evidence":"敘述原文中確實出現的短句"}]}-->。只填現場人物的固定 ID，且 evidence 必須逐字出現在回合輸入或你的敘述中。關係每個欄位變化限 -2 到 2；情緒限：平靜、愉快、好奇、警惕、不悅、憤怒、擔憂、疲憊、悲傷、緊張。不能建議修改修為、人物位置或其他角色不知情的記憶。若洛河明確提出移動且敘述證明已抵達，可以在同一 JSON 物件加入 move：{"to":"棲風峰","evidence":"你的敘述內有的抵達棲風峰原文"}；只允許太虛宗山門、太虛宗主峰、棲風峰、演武場、藏經樓、內門居所。若行動未成功、被拒絕、仍在途中或玩家未選擇移動，絕不可加入 move。沒有變化時直接正常回覆，不必加標記。`;
function isDeveloper(userId:string){
 const permissions=env as unknown as {GAME_DEVELOPER_USER_IDS?:string};
 const ids=String(permissions.GAME_DEVELOPER_USER_IDS||'').split(/[,;\s]+/).filter(Boolean);
 return ids.includes(userId);
}
const demo=(turn:number,txt:string)=>turn===0?'執事接過名冊，將名字記下，示意你上前。\n\n「洛河，請把手按在測靈石上。」':/靈根|測試|按/.test(txt)?'測靈石泛起青色光芒。執事放低聲音：「風屬性，還要再觀察。」':'執事望向你：「先完成測試。其他的事稍後再談。」';
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
  const prior=world.events.find((e:{requestId:string})=>e.requestId===body.requestId);
  if(prior)return reply({...playerWorld(world),usage:null});
  if(world.events.length>=1000)return reply({error:'試玩世界已達1000回合上限，請先備份'},409);
  const mode=body.mode;
  if(!['demo','ai','openrouter'].includes(mode))return reply({error:'未知對話模式'},400);
  const key=typeof body.apiKey==='string'?body.apiKey:'';
  if(key.length>300)return reply({error:'API Key 無效'},400);
  const model=typeof body.model==='string'?body.model:undefined;
  let answer:string,usage:null|{totalTokens?:number}=null;
  if(mode==='demo')answer=demo(world.revision,text);
  else{
   const args={apiKey:key,instructions,input:gmContext(world,text),maxOutputTokens:1000};
   const result=mode==='openrouter'
    ?await generateOpenRouterResponse({...args,model:model||'openrouter/free'})
    :await generateGMResponse({...args,model:model||'gpt-4.1-mini'});
   answer=result.text;usage=result.usage;
  }
  const next=commitV3Turn(world,text,answer,body.requestId);
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
