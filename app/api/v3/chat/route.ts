import {getChatGPTUser} from '../../../chatgpt-auth';
// @ts-ignore — the server-only adapter is implemented in a plain .mjs module.
import {generateGMResponse} from '../../../../v3/server/openai.mjs';
export const dynamic='force-dynamic';
const instructions=`你是《問道九州》V3 的中央 GM。玩家扮演十五歲少女洛河，剛抵達太虛宗參加入門測試。保留修仙世界觀：太虛宗、棲風峰、沈滄月（冷靜嚴格的峰主）、晏清辭（嚴謹師姐）、江離（溫和愛鬧師兄）、顧長青。不得擅自代玩家做重大決定。以繁體中文輸出一段連續、自然、節奏俐落的場景，NPC 台詞與動作可放在同一則回覆。NPC 不全知，不為討好玩家而破壞修為差距。避免每回合都製造危機。此為無持久世界模擬的早期試玩版，不要聲稱你已更新資料庫。依照對話歷史維持一致性。`;
const demo=(text:string,turn:number)=>{
 if(turn===0)return `執事接過名冊，筆尖懸在紙上。

「洛河？」他將名字記下，示意你上前，將手掌按在測靈石上。

周圍弟子安靜了一瞬。

「別緊張，靈根測試不會傷人。」`;
 if(/師父|沈滄月/.test(text))return `高臺另一側，一名青衣女修聽見你的話，淡淡看了過來。

沈滄月：「你先把眼前的測試完成。」`;
 if(/測試|靈根|手|按/.test(text))return `測靈石表面浮現淡淡青光，像一縷細風繞過指尖。執事皺眉，將手中的記錄玉簡翻了一頁。

「風屬性……再等片刻，讓靈光穩定。」`;
 return `山門前的風拂過石階。執事聽完你的話，沒有立刻回答，反而朝測靈石示意。

「先把測試做完。其他事，入門後自然有人與你說。」`;
};
export async function POST(request:Request){
 try{
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'拒絕跨來源請求'},{status:403});
  const user=await getChatGPTUser();if(!user)return Response.json({error:'請先透過 Sites 登入以試玩'},{status:401});
  const raw=await request.text();if(raw.length>16000)return Response.json({error:'請求過長'},{status:413});
  const body=JSON.parse(raw);const messages=body.messages;
  if(!Array.isArray(messages)||messages.length<1||messages.length>20||messages.some((m:any)=>!['user','assistant'].includes(m?.role)||typeof m?.content!=='string'||m.content.length>2500))return Response.json({error:'無效對話紀錄'},{status:400});
  const latest=messages.at(-1);if(latest.role!=='user'||!latest.content.trim())return Response.json({error:'缺少玩家輸入'},{status:400});
  if(body.mode==='demo')return Response.json({text:demo(latest.content,Number(body.turn)||0)});
  if(body.mode!=='ai')return Response.json({error:'未知模式'},{status:400});
  const apiKey=typeof body.apiKey==='string'?body.apiKey:'';if(apiKey.length>300)return Response.json({error:'無效金鑰'},{status:400});
  const transcript=messages.map((m:any)=>`${m.role==='user'?'洛河':'GM'}：${m.content}`).join('\n\n');
  const result=await generateGMResponse({apiKey,model:body.model||'gpt-4.1-mini',instructions,input:transcript,maxOutputTokens:1000});
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'伺服器錯誤'},{status:e&&typeof e==='object'&&'status' in e&&typeof e.status==='number'?e.status:500,headers:{'Cache-Control':'no-store'}})}
}
