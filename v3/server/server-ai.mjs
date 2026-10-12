/**
 * V3 server-managed AI access. API keys are Cloudflare Worker secrets, never
 * client settings. Only explicitly allowlisted user IDs may spend site quota.
 */
const list=value=>String(value||'').split(/[,;\s]+/).map(s=>s.trim()).filter(Boolean);
export function serverAIConfig(env,userId){
 const allowed=list(env.V3_AI_USER_IDS).includes(userId);
 const openaiKey=String(env.OPENAI_API_KEY||'').trim();
 const routerKey=String(env.OPENROUTER_API_KEY||'').trim();
 const openaiModels=list(env.V3_OPENAI_MODELS||'gpt-4.1-mini').filter(x=>/^[a-zA-Z0-9._-]{1,80}$/.test(x));
 const routerModels=list(env.V3_OPENROUTER_MODELS||'openrouter/free')
  .filter(x=>x==='openrouter/free'||/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+:free$/.test(x));
 const providers={
  ai:{ready:allowed&&!!openaiKey,models:openaiModels,key:openaiKey},
  openrouter:{ready:allowed&&!!routerKey,models:routerModels,key:routerKey},
 };
 return {allowed,providers};
}
export function publicAIConfig(config){
 const {allowed,providers}=config;
 return {allowed,providers:{
  ai:{ready:providers.ai.ready,models:providers.ai.models},
  openrouter:{ready:providers.openrouter.ready,models:providers.openrouter.models},
 }};
}
export function chooseServerAI(config,mode,model){
 if(!config.allowed)throw Object.assign(new Error('此帳號尚未獲得網站 AI 使用權限。請在 Cloudflare 設定 V3_AI_USER_IDS。'),{status:403});
 const provider=config.providers[mode];
 if(!provider||!provider.ready)throw Object.assign(new Error('此 AI 服務尚未在伺服器設定金鑰，請檢查 Worker Secrets。'),{status:503});
 const chosen=typeof model==='string'&&model.trim()?model.trim():provider.models[0];
 if(!provider.models.includes(chosen))throw Object.assign(new Error('此模型尚未列入伺服器允許清單，請在 Cloudflare 設定模型白名單。'),{status:403});
 return {apiKey:provider.key,model:chosen};
}
