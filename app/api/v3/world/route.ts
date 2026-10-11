import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
// @ts-ignore - module is authored in JS
import {initialV3World,validatedWorld,playerWorld,gmContext,commitV3Turn} from '../../../../v3/server/world.mjs';
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
const instructions=`你是《問道九州》V3 的中央 GM。玩家扮演少女洛河。所有玩家台詞／行動只由玩家決定，你不得代玩家作重要決策。維持太虛宗、沈滄月、晏清辭、江離、顧長青的性格、修為差距與人際關係。繁體中文，同一則回答整合旁白和所有 NPC 台詞，緊湊自然。NPC 不全知、會拒絕、會誤解、對世界有獨立目標。不要虛構你已更新資料庫或已經產生未經驗證的事件。**只有伺服器世界事實有效**；你描述的變更尚不是系統記錄的正式事實。避免擅自創造主角突破、人物死亡或永久身分變更。`;
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
  return world?reply(playerWorld(world)):reply({error:'找不到 V3 世界'},404);
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
  if(body.op!=='turn'||typeof body.world!=='string'||!/^[0-9a-f-]{36}$/.test(body.world))return reply({error:'未知操作'},400);
  const world=await readWorld(body.world,user.userId);
  if(!world)return reply({error:'找不到 V3 世界'},404);
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
