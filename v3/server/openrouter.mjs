import { AIProviderError } from './openai.mjs';

/** Only route to OpenRouter's designated no-cost models. Never persist user keys. */
export async function generateOpenRouterResponse({
 apiKey, model='openrouter/free', instructions, input,
 fetchImpl=fetch, timeoutMs=45000, maxOutputTokens=1000,
}) {
 if(typeof apiKey!=='string'||!apiKey.trim()||apiKey.length>300)throw new AIProviderError('請先輸入有效的 OpenRouter API Key',400);
 if(typeof model!=='string'||model.length>120||
   !(model==='openrouter/free'||/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+:free$/.test(model)))
   throw new AIProviderError('OpenRouter 只允許 openrouter/free 或 :free 模型',400);
 if(typeof instructions!=='string'||instructions.length>20000||
   typeof input!=='string'||!input.trim()||input.length>12000)throw new AIProviderError('無效 GM 輸入',400);
 if(!Number.isInteger(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>4000)throw new AIProviderError('輸出上限超出範圍',400);
 let response;
 try {
  response=await fetchImpl('https://openrouter.ai/api/v1/chat/completions',{
   method:'POST',
   headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json',
      'HTTP-Referer':'https://wendao-living-world.danew137950.workers.dev',
      'X-Title':'問道九州 V3'},
   body:JSON.stringify({
    model,stream:false,max_tokens:maxOutputTokens,
    messages:[{role:'system',content:instructions},{role:'user',content:input}],
    provider:{max_price:{prompt:0,completion:0,request:0}},
   }),
   signal:AbortSignal.timeout(timeoutMs),
  });
 }catch{throw new AIProviderError('OpenRouter 連線逾時或失敗',502);}
 if(!response.ok){
  if(response.status===401||response.status===403)throw new AIProviderError('OpenRouter Key 無效或沒有使用權限',401);
  if(response.status===429)throw new AIProviderError('免費模型目前達到用量限制，請稍後再試',429);
  throw new AIProviderError('OpenRouter 暫時無法提供免費模型，請稍後重試',502);
 }
 let data;
 try{data=await response.json();}catch{throw new AIProviderError('OpenRouter 回應格式錯誤',502);}
 const content=data?.choices?.[0]?.message?.content;
 const text=typeof content==='string'?content:
  Array.isArray(content)?content.filter(p=>p?.type==='text'&&typeof p.text==='string').map(p=>p.text).join(''):'';
 if(!text.trim())throw new AIProviderError('免費模型沒有傳回可用文字，請重試',502);
 return {text,model:typeof data.model==='string'?data.model:model,usage:{
  inputTokens:data.usage?.prompt_tokens??null,
  outputTokens:data.usage?.completion_tokens??null,
  totalTokens:data.usage?.total_tokens??null,
 }};
}
