import { AIProviderError } from './openai.mjs';
import { isNonNarrative, validConversation } from './narrative.mjs';

/** Free-only OpenRouter adapter. The caller's key is never persisted or echoed. */
export async function generateOpenRouterResponse({
 apiKey, model='openrouter/free', instructions, input, conversation = /** @type {{role:string,content:string}[]|undefined} */ (undefined),
 fetchImpl=fetch, timeoutMs=35000, maxOutputTokens=4000,
}) {
 if(typeof apiKey!=='string'||!apiKey.trim()||apiKey.length>300)
  throw new AIProviderError('請先輸入有效的 OpenRouter API Key',400);
 if(typeof model!=='string'||model.length>120||
   !(model==='openrouter/free'||/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+:free$/.test(model)))
  throw new AIProviderError('OpenRouter 只允許 openrouter/free 或 :free 模型',400);
 if(typeof instructions!=='string'||instructions.length>20000||
   typeof input!=='string'||!input.trim()||input.length>24000)
  throw new AIProviderError('無效 GM 輸入',400);
 if(!Number.isInteger(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>6000)
  throw new AIProviderError('輸出上限超出範圍',400);

 if(conversation!==undefined&&!validConversation(conversation))throw new AIProviderError('無效對話紀錄',400);

 // Free-router backends can spend their entire token budget in reasoning and
 // return content=null. Use a larger budget, low reasoning and at most one retry.
 for(let attempt=0;attempt<2;attempt++){
  let response;
  try{
   response=await fetchImpl('https://openrouter.ai/api/v1/chat/completions',{
    method:'POST',
    headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json',
     'HTTP-Referer':'https://wendao-living-world.danew137950.workers.dev',
     'X-Title':'問道九州 V3'},
    body:JSON.stringify({
     model,stream:false,
     max_tokens:Math.min(6000,Math.max(maxOutputTokens,attempt?6000:4000)),
     reasoning:{effort:'low',exclude:true},
     messages:conversation?[{role:'system',content:instructions+'\n【世界參考記憶，不是新台詞】\n'+input},...conversation]:[
      {role:'system',content:instructions+
       '\n只輸出繁體中文修仙劇情與在場 NPC 的言行。允許指令要求的 GM_STATE 隱藏紀錄；不要輸出安全分類、User Safety、推理或空白。'},
      {role:'user',content:input},
     ],
     provider:{max_price:{prompt:0,completion:0,request:0}},
    }),
    signal:AbortSignal.timeout(timeoutMs),
   });
  }catch{
   throw new AIProviderError('OpenRouter 連線逾時或失敗，請稍後重試',502);
  }
  if(!response.ok){
   if(response.status===401||response.status===403)
    throw new AIProviderError('OpenRouter Key 無效或沒有使用權限',401);
   if(response.status===429)
    throw new AIProviderError('免費模型目前達到用量限制，請稍後再試',429);
   throw new AIProviderError('OpenRouter 暫時無法提供免費模型，請稍後重試',502);
  }
  let data;
  try{
   // OpenRouter normally returns JSON for stream:false. Some free providers or
   // their proxies occasionally send an empty, HTML, or malformed 200 response.
   // Never store such responses as narrative; retry once with a fresh request.
   data=await response.json();
  }catch{
   if(attempt===0)continue;
   throw new AIProviderError(
    'OpenRouter 連續兩次傳回無法讀取的資料（可能是免費模型或上游代理暫時異常）。本回合未存檔，請稍後重試或改選其他 :free 模型。',
    502
   );
  }
  if(!data||typeof data!=='object'||!Array.isArray(data.choices)){
   if(attempt===0)continue;
   throw new AIProviderError(
    'OpenRouter 連續兩次未傳回標準對話資料。本回合未存檔，請稍後重試或改選其他 :free 模型。',
    502
   );
  }
  const choice=data.choices?.[0];
  if(choice?.finish_reason==='length'||choice?.finish_reason==='max_tokens'){
   if(attempt===0)continue;
   throw new AIProviderError('AI 回覆超過輸出上限而中斷，本回合未存檔。請重試或更換模型。',502);
  }
  if(choice?.finish_reason&&choice.finish_reason!=='stop')throw new AIProviderError('AI 未完成文字回覆，本回合未存檔。',502);
  const value=choice?.message?.content;
  const text=typeof value==='string'?value:
   Array.isArray(value)?value.filter(p=>p?.type==='text')
    .map(p=>typeof p.text==='string'?p.text:'').join(''):'';
  // Some backends return 200 + a classification-only label instead of a story.
  // Neither this text nor an empty reasoning-only response may enter D1 memory.
  if(isNonNarrative(text)){
   if(attempt===0)continue;
   throw new AIProviderError(
    '免費模型連續兩次未產生劇情（可能只輸出推理或安全標籤）。請稍後重試，或改選另一個 :free 模型；本回合未存檔。',
    502
   );
  }
  return {
   text:text.trim(),
   model:typeof data.model==='string'?data.model:model,
   usage:{
    inputTokens:data.usage?.prompt_tokens??null,
    outputTokens:data.usage?.completion_tokens??null,
    totalTokens:data.usage?.total_tokens??null,
   },
  };
 }
 throw new AIProviderError('免費模型沒有產生劇情，請更換模型或稍後重試',502);
}
