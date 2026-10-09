export const TRAITS={humor:'愛開玩笑',curiosity:'好奇求知',caution:'重視風險',directness:'直接表達',care:'關心他人',independence:'重視自主',discipline:'重視自律',competitiveness:'好勝求進'};
export const CONTEXTS={general:'一般互動',teachers:'面對師長',peers:'面對同門',risk:'面對風險',training:'修行時'};
export function personalityOf(s){return s.personality||{version:1,traits:[],notes:[],history:[]};}
const copy=x=>JSON.parse(JSON.stringify(x));
export function ensurePersonality(s){if(!s.personality)s.personality=copy(personalityOf(s));return s.personality;}
export function observePersonality(s,proposals,source){
 if(!Array.isArray(proposals)||!source||source.speaker!=='player'||!['dialogue','action'].includes(source.kind)||!source.event)return [];
 const profile=ensurePersonality(s),added=[];
 for(const p of proposals.slice(0,3)){
  if(!Object.hasOwn(TRAITS,p.trait)||!Object.hasOwn(CONTEXTS,p.context||'general')||typeof p.quote!=='string'||p.quote.length<3||p.quote.length>160||!source.content.includes(p.quote))continue;
  const context=p.context||'general',id=`${p.trait}:${context}`;let t=profile.traits.find(t=>t.id===id);
  if(t?.status==='dismissed'||t?.evidence.some(e=>e.message===source.id||e.quote===p.quote))continue;
  if(!t){t={id,trait:p.trait,label:TRAITS[p.trait],context,status:'observed',evidence:[]};profile.traits.push(t);}
  const evidence={message:source.id,event:source.event,time:source.minute,quote:p.quote,origin:'player',audience:[...source.audience]};t.evidence.push(evidence);if(t.evidence.length>=3&&t.status!=='confirmed')t.status='emerging';added.push({trait:id,evidence});
 }
 return added;
}
export function editPersonality(s,action,eventId){const p=ensurePersonality(s);
 if(action.operation==='note'){
  const text=typeof action.text==='string'?action.text.trim():'';if(!text||text.length>240)throw Error('個性補充需為 1–240 字');
  p.notes.push({id:eventId,text,time:s.time,origin:'developer',active:true});
 }else if(action.operation==='remove-note'){
  const n=p.notes.find(n=>n.id===action.note);if(!n)throw Error('找不到補充');n.active=false;
 }else if(['confirm','dismiss'].includes(action.operation)){
  const t=p.traits.find(t=>t.id===action.trait);if(!t)throw Error('找不到個性傾向');t.status=action.operation==='confirm'?'confirmed':'dismissed';
 }else throw Error('不支援的個性編輯');
 p.history.push({event:eventId,operation:action.operation,time:s.time,trait:action.trait||null,note:action.note||null});return p;
}
export function actingProfile(s){const p=personalityOf(s);return {notes:p.notes.filter(n=>n.active).map(n=>n.text),traits:p.traits.filter(t=>['emerging','confirmed'].includes(t.status)).map(t=>({label:t.label,context:CONTEXTS[t.context],status:t.status})),guidance:'只供演出主角的日常口吻，不是 NPC 知道的資訊，也不是強制人格。傾向可矛盾、可隨情境改變。未形成時保持中性，少補主角台詞。'};}
