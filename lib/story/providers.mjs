import {rateLimitMessage} from './rate-limit.mjs';
export const PROVIDERS={openai:{key:'OPENAI_API_KEY',models:'https://api.openai.com/v1/models'},anthropic:{key:'ANTHROPIC_API_KEY',models:'https://api.anthropic.com/v1/models'},gemini:{key:'GEMINI_API_KEY',models:'https://generativelanguage.googleapis.com/v1beta/models'}};
export function connection(body,env={}){const p=PROVIDERS[body.provider];if(!p)throw Error('請選擇支援的 AI Provider');const key=typeof body.sessionKey==='string'&&body.sessionKey.trim()?body.sessionKey.trim():env[p.key];if(!key)throw Error('尚未連接 AI。請在設定提供本次連線金鑰，或由伺服器配置。');if(typeof key!=='string'||key.length>2048||/[\r\n]/.test(key))throw Error('金鑰格式不符');const model=String(body.model||'').replace(/^models\//,'');if(!/^[\w.\-:/]{1,150}$/.test(model))throw Error('請填寫有效的模型 ID');return {provider:body.provider,key,model};}
function headers(c){return c.provider==='anthropic'?{'Content-Type':'application/json','x-api-key':c.key,'anthropic-version':'2023-06-01'}:c.provider==='gemini'?{'Content-Type':'application/json','x-goog-api-key':c.key}:{'Content-Type':'application/json',Authorization:`Bearer ${c.key}`};}
export async function generateJSON(c,system,input,transport=fetch,{timeoutMs=35000,responseSchema}={}) {
 let url,body;
 if(c.provider==='openai') {
  url='https://api.openai.com/v1/chat/completions';
  body={model:c.model,messages:[{role:'system',content:system+'\nReturn only one JSON object.'},{role:'user',content:JSON.stringify(input)}],response_format:{type:'json_object'},max_completion_tokens:2400,store:false};
 } else if(c.provider==='anthropic') {
  url='https://api.anthropic.com/v1/messages';
  body={model:c.model,system:system+'\nReturn only one JSON object without markdown.',messages:[{role:'user',content:JSON.stringify(input)}],max_tokens:2400};
 } else {
  url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.model)}:generateContent`;
  // Reasoning and JSON share the provider's output budget on thinking models.
  // This is a ceiling, not a request for longer stories or extra API attempts.
  const generationConfig={responseMimeType:'application/json',maxOutputTokens:8192};
  // Keep the JSON mode that worked before strict schemas were introduced.
  // Some model versions reject the full scene schema with HTTP 400. The prompt
  // describes the shape and game validators still check every field afterwards.
  body={systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:JSON.stringify(input)}]}],generationConfig};
 }
 let r;
 try{r=await transport(url,{method:'POST',headers:headers(c),body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)});}
 catch{throw Error('AI 連線逾時或中斷，正式回合未提交，可用同一回合重試。');}
 if(!r.ok)throw await providerError(r,c.provider);
 let data;try{data=await r.json();}catch{throw Error('AI 服務回應格式錯誤，正式回合未提交。');}
 const candidate=data.candidates?.[0];
 const finish=c.provider==='gemini'?candidate?.finishReason:c.provider==='openai'?data.choices?.[0]?.finish_reason:data.stop_reason;
 if(['MAX_TOKENS','length','max_tokens'].includes(finish))throw Error('AI 輸出達到長度上限，資料被截斷。請以原回合重試；若持續發生，請重新載入核對後更換模型。正式回合未提交。');
 if(c.provider==='gemini'&&(data.promptFeedback?.blockReason||['SAFETY','RECITATION','BLOCKLIST','PROHIBITED_CONTENT','SPII','IMAGE_SAFETY'].includes(finish)))throw Error('Gemini 未提供可用內容（供應商內容限制）。請重新載入核對後調整輸入。正式回合未提交。');
 if(c.provider==='gemini'&&finish&&finish!=='STOP')throw Error('Gemini 生成未正常完成，請以原回合重試。正式回合未提交。');
 const raw=c.provider==='openai'?data.choices?.[0]?.message?.content:c.provider==='anthropic'?data.content?.filter(x=>x.type==='text').map(x=>x.text).join(''):candidate?.content?.parts?.filter(x=>x.thought!==true&&typeof x.text==='string').map(x=>x.text).join('');
 if(typeof raw!=='string'||!raw.trim()||raw.length>24000)throw Error('AI 沒有回傳有效文字，正式回合未提交。');
 let parsed;
 try{parsed=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}
 catch{throw Error('AI 未遵守資料協定，正式回合未提交。');}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('AI 未遵守資料協定，正式回合未提交。');
 return parsed;
}
export async function testConnection(body,env={},transport=fetch){const p=PROVIDERS[body.provider];if(!p)throw Error('不支援此 Provider');const key=body.sessionKey?.trim()||env[p.key];if(!key)return {connected:false,status:'offline',message:'尚未配置金鑰。帳號登入與 AI 連線分開管理。'};if(typeof key!=='string'||key.length>2048||/[\r\n]/.test(key))throw Error('金鑰格式不符');const c={provider:body.provider,key,model:body.model};let r;try{r=await transport(p.models,{headers:headers(c),signal:AbortSignal.timeout(12000)});}catch{throw Error('測試逾時或連線中斷');}if(!r.ok)throw Error(`模型服務回應 HTTP ${r.status}`);const data=await r.json(),models=(data.data||data.models||[]).map(x=>x.id||x.name?.replace('models/','')).filter(Boolean);return {connected:true,status:'connected',models,modelListed:body.model?models.includes(body.model.replace(/^models\//,'')):null,message:'已驗證服務金鑰。模型清單可能分頁，實際生成時會再次確認模型是否可用。'};}

async function providerError(r,provider){
 if(provider==='gemini'&&r.status===400){
  let data;try{data=await r.json();}catch{}
  const details=Array.isArray(data?.error?.details)?data.error.details:[];
  const reasons=details.map(x=>x?.reason);
  // Read upstream text only to select fixed labels. Never display it: it can
  // echo user content, credentials or account identifiers.
  const message=typeof data?.error?.message==='string'?data.error.message.toLowerCase():'';
  let hint;
  if(reasons.some(x=>['API_KEY_INVALID','API_KEY_EXPIRED','API_KEY_SERVICE_BLOCKED','API_KEY_HTTP_REFERRER_BLOCKED','API_KEY_IP_ADDRESS_BLOCKED'].includes(x))||/api.?key.{0,50}(invalid|expired|not valid|blocked)/.test(message))hint='金鑰無效、過期或受到使用限制；請在設定重新測試連線';
  else if(/response[_. ]?(json[_. ]?)?schema|schema.{0,50}(complex|unsupported|not supported|too many)/.test(message))hint='模型不接受目前的結構化輸出格式';
  else if(/response[_. ]?mime[_. ]?type|json mode|application\/json/.test(message))hint='模型不支援目前的 JSON 輸出模式；請改選支援文字 JSON 生成的模型';
  else if(/max[_. ]?output[_. ]?tokens|output token limit/.test(message))hint='模型不接受目前的輸出長度設定';
  else if(/input.{0,40}token|token.{0,40}(exceed|too)|context.{0,30}(limit|length|window)/.test(message))hint='本回合資料超過模型的輸入長度限制';
  else if(/system[_. ]?instruction|developer instruction/.test(message))hint='模型不支援目前的系統指令設定';
  else if(/location|region|country/.test(message))hint='供應商不允許目前的服務地區';
  else if(/billing|paid tier|free tier/.test(message))hint='此模型需要符合帳戶方案或計費條件';
  else if(/model.{0,60}(not found|not supported|unsupported|not available)|not supported.{0,60}model/.test(message))hint='模型不支援目前的文字生成介面；請從模型清單重新選擇';
  else hint='模型拒絕請求參數，但未能安全判定具體欄位';
  return Error(`Gemini 請求遭拒（HTTP 400）：${hint}。正式回合未提交。`);
 }
 if(r.status!==429)return Error(`AI 服務回應 HTTP ${r.status}，正式回合未提交。`);
 let data;try{data=await r.json();}catch{}
 const code=data?.error?.code,type=data?.error?.type;
 if(['insufficient_quota','credit_balance_exhausted'].includes(code)||type==='insufficient_quota')return Error('AI API 額度不足或帳戶用量受限（HTTP 429）。請確認此金鑰所屬專案的 API 餘額與用量限制；重試不會補足額度。正式回合未提交。');
 if(['organization_usage_limit_exceeded','organization_spend_limit_exceeded','project_spend_limit_exceeded'].includes(code))return Error('AI API 的組織或專案已達用量／支出上限（HTTP 429）。請查看 API 帳戶限制。正式回合未提交。');
 if(['rate_limit_exceeded','slow_down'].includes(code)||type==='rate_limit_error')return Error(rateLimitMessage(data,r.headers));
 return Error('AI 服務回應 HTTP 429，尚無足夠資訊區分暫時限流與額度限制。請查看 API 餘額與用量限制。正式回合未提交。');
}
