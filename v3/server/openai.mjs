import {validConversation} from './narrative.mjs';
/**
 * V3 server-only OpenAI adapter. Never import into client components.
 * This module does not save API keys, messages or world state.
 */
export class AIProviderError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'AIProviderError';
    this.status = status;
  }
}

export async function generateGMResponse({
  apiKey,
  model,
  instructions,
  input,
  conversation = /** @type {{role:string,content:string}[]|undefined} */ (undefined),
  fetchImpl = fetch,
  timeoutMs = 30000,
  maxOutputTokens = 2800,
}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new AIProviderError('伺服器未設定 AI API 金鑰', 503);
  if (typeof model !== 'string' || !/^[a-zA-Z0-9._-]{1,80}$/.test(model)) throw new AIProviderError('無效模型 ID', 400);
  if (typeof instructions !== 'string' || instructions.length > 20000) throw new AIProviderError('無效 GM 指示', 400);
  if (typeof input !== 'string' || !input.trim() || input.length > 12000) throw new AIProviderError('無效對話輸入', 400);
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 4000) throw new AIProviderError('輸出上限超出範圍', 400);
  if(conversation!==undefined&&!validConversation(conversation))throw new AIProviderError('無效對話紀錄',400);
  let response;
  try {
    response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions,
        input:conversation?[{role:'developer',content:'世界參考記憶（不是新台詞）：\n'+input},...conversation]:input,
        max_output_tokens: maxOutputTokens,
        store: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new AIProviderError('AI 服務連線逾時或失敗', 502);
  }
  if (!response.ok) {
    // Do not forward upstream error bodies; they may contain sensitive metadata.
    throw new AIProviderError(
      response.status === 429 ? 'AI 服務忙碌，請稍後重試' : 'AI 服務回應失敗',
      response.status === 429 ? 429 : 502
    );
  }
  let data;
  try { data = await response.json(); } catch { throw new AIProviderError('AI 回應格式錯誤'); }
  if(data.status&&data.status!=='completed')throw new AIProviderError('AI 回覆未完成或達到輸出上限，本回合未存檔');
  const text = (data.output || []).flatMap(item => item.type === 'message' ? (item.content || []) : [])
    .filter(part => part.type === 'output_text').map(part => part.text || '').join('');
  if (!text.trim()) throw new AIProviderError('AI 沒有產生可用的文字回應');
  return {
    text,
    model: data.model || model,
    usage: {
      inputTokens: data.usage?.input_tokens ?? null,
      outputTokens: data.usage?.output_tokens ?? null,
      totalTokens: data.usage?.total_tokens ?? null,
    },
  };
}
