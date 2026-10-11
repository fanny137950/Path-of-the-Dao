// Request identity only. Narrative/world decisions remain in the existing GM path.
export function turnIdentity(body,text){
 return {text,op:body.op,advanceMinutes:body.op==='advance-time'?body.advanceMinutes:null,
  mode:body.mode,model:body.model||'',revision:body.revision};
}
export function checkTurnRequest(world,requestId,identity){
 const prior=world.events.find(event=>event.requestId===requestId);
 if(prior){
  const previous=prior.request;
  if(prior.text!==identity.text || (previous&&Object.keys(identity).some(key=>previous[key]!==identity[key])))
   return {status:409,error:'同一回合 ID 不可更換內容、模型或等待時間。'};
  return {replayed:true};
 }
 if(!Number.isInteger(identity.revision)||identity.revision!==world.revision)
  return {status:409,error:'世界版本已更新，請重新讀取後再決定行動。'};
 return {replayed:false};
}
