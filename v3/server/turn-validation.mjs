/** Narrow guard for unimplemented progression. It is not a proof of all prose. */
export function validateObjectiveNarrative(world,narration){
 const prose=narration.replace(/[「“][^」”]*[」”]|"[^"]*"/g,'');
 const claim=/洛河[^。！？\n]{0,24}?(?:突破(?:到|至|成為|到了)?|晉升(?:到|至|為)?|成為|已是|已經是)\s*(鍛體|聚氣|築基|金丹|元嬰|化神|洞虛|合道|渡劫)(初期|中期|後期|圓滿)?/g;
 for(const match of prose.matchAll(claim)){
  if(/(?:沒有|尚未|未能|無法|不能|假如|如果|夢見|想像)/.test(match[0]))continue;
  if(match[1]+(match[2]||'')!==world.protagonist.realm){
   const error=new Error('模型描述了尚未經世界規則確認的突破，本回合未存檔。請重試。');
   error.status=422;
   throw error;
  }
 }
}

export function validateTurnRequest(world,body){
 const prior=world.events.find(e=>e.requestId===body.requestId);
 if(prior){
  if(prior.text!==body.text || (prior.request &&
   (prior.request.mode!==body.mode || prior.request.model!==(body.model||'') || prior.request.revision!==body.revision)))
   return {status:409,error:'同一回合 ID 不可更換內容或模型。'};
  return {replayed:true};
 }
 if(!Number.isInteger(body.revision)||body.revision!==world.revision)
  return {status:409,error:'世界版本已更新，請重新讀取後再決定行動。'};
 return {replayed:false};
}
