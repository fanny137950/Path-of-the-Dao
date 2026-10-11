import {getChatGPTUser} from '../../../chatgpt-auth';
// @ts-ignore — server-only JS adapter
import {generateOpenRouterResponse} from '../../../../v3/server/openrouter.mjs';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 try{
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return reply({error:'拒絕跨來源請求'},403);
  if(!await getChatGPTUser())return reply({error:'請先登入'},401);
  const raw=await request.text();
  if(raw.length>1500)return reply({error:'請求過長'},413);
  let body;
  try{body=JSON.parse(raw);}catch{return reply({error:'無效設定'},400);}
  const result=await generateOpenRouterResponse({
   apiKey:body.apiKey,model:body.model||'openrouter/free',maxOutputTokens:100,
   instructions:'以繁體中文回覆一句修仙人物的簡短問候，不加標記。',
   input:'請讓守門弟子說一句歡迎來到太虛宗。這是連線測試，不建立世界紀錄。',
  });
  return reply({ok:true,model:result.model,sample:result.text,usage:result.usage});
 }catch(e){
  const error=e as {status?:number;message?:string};
  return reply({error:error.status?error.message:'連線測試失敗，請稍後再試'},error.status||502);
 }
}
