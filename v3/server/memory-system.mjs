/** Five logical views of one save. Records remain source-linked and append-only. */
import {resolveNPCReferences} from './npc-registration.mjs';
import {visibleNarrative} from './narrative.mjs';
import {currentGMMemories} from './durable-memory.mjs';
import {REALM_ORDER} from './world-bible.mjs';
const clip=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const now=w=>(w.day-1)*1440+w.minute;
const ids=(w,x)=>Array.isArray(x)&&x.length<=12&&x.every(id=>typeof id==='string'&&Object.hasOwn(w.npcs,id));
const evidence=(n,x)=>typeof x==='string'&&x.length>=4&&x.length<=240&&n.includes(x);
const latest=items=>[...new Map(items.map(x=>[x.id,x])).values()];
export function memoryState(world){
 return world.memorySystem?.version===1&&Array.isArray(world.memorySystem.threads)?world.memorySystem:{version:1,working:null,threads:[]};
}
export function activeThreads(world){return latest(memoryState(world).threads);}
export function applyMemorySystem(next,parsed,narration,event){
 next.memorySystem=memoryState(next);
 const memory=next.memorySystem;
 const source={revision:next.revision,eventId:event.id,day:next.day,minute:next.minute};
 const working=parsed.workingMemory;
 if(working)working.participants=resolveNPCReferences(next,working.participants);
 memory.working={...source,location:next.location,summary:clip(narration,380),openLoops:[],goal:'',participants:[]};
 if(working&&evidence(narration,working.evidence)){
  if(typeof working.summary==='string'&&working.summary.length<=600)memory.working.summary=working.summary.trim();
  if(typeof working.goal==='string'&&working.goal.length<=200)memory.working.goal=working.goal.trim();
  if(Array.isArray(working.openLoops)&&working.openLoops.length<=5&&working.openLoops.every(x=>typeof x==='string'&&x.length<=180))memory.working.openLoops=[...working.openLoops];
  if(ids(next,working.participants)){memory.working.participants=[...new Set(working.participants)];memory.working.participantsConfirmed=true;}
  memory.working.evidence=working.evidence;
 }
 for(const raw of Array.isArray(parsed.threads)?parsed.threads.slice(0,6):[]){
  const item=raw&&{...raw,participants:resolveNPCReferences(next,raw.participants),...(raw.truthKnownBy===undefined?{}:{truthKnownBy:resolveNPCReferences(next,raw.truthKnownBy)})};
  if(!item||typeof item.id!=='string'||!/^[\w-]{1,64}$/.test(item.id)||
   typeof item.title!=='string'||!item.title.trim()||item.title.length>80||
   typeof item.summary!=='string'||item.summary.length>600||
   !['open','blocked','resolved','failed'].includes(item.status)||typeof item.playerKnown!=='boolean'||!ids(next,item.participants))continue;
  if(item.playerKnown&&!evidence(narration,item.evidence))continue;
  if(item.dueAt!==null&&item.dueAt!==undefined&&(!Number.isSafeInteger(item.dueAt)||item.dueAt<0))continue;
  // Public/secret changes must be explicit; missing fields never erase a hidden truth.
  const previous=activeThreads(next).find(x=>x.id===item.id);
  if(item.truthKnownBy!==undefined&&!ids(next,item.truthKnownBy))continue;
  memory.threads.push({...source,id:item.id,title:item.title.trim(),summary:item.summary.trim(),status:item.status,
   playerKnown:item.playerKnown,participants:[...new Set(item.participants)],dueAt:item.dueAt===undefined?previous?.dueAt??null:item.dueAt,
   truthKnownBy:item.truthKnownBy??previous?.truthKnownBy??[],
   truth:typeof item.truth==='string'&&item.truth.length<=600?item.truth:previous?.truth||'',
   ...(item.playerKnown?{evidence:item.evidence}:{})});
 }
}
export function memoryLayers(world,text,{advanceMinutes=0}={}){
 const state=memoryState(world),working=state.working;
 const last=[...world.messages].reverse().find(m=>m.role==='assistant');
 const horizon=now(world)+(Number.isInteger(advanceMinutes)?advanceMinutes:0);
 const query=text+' '+visibleNarrative(last?.content).slice(-900);
 const threads=activeThreads(world).map(t=>({t,rank:
  (t.status==='open'||t.status==='blocked'?10:0)+(['open','blocked'].includes(t.status)&&t.dueAt!==null&&t.dueAt<=horizon?30:0)+
  (query.includes(t.title)?30:0)+(t.participants.some(id=>world.npcs[id]?.where===world.location)?10:0)}))
  .sort((a,b)=>b.rank-a.rank||b.t.revision-a.t.revision).slice(0,8)
  .map(({t})=>({...t,dueForReview:['open','blocked'].includes(t.status)&&t.dueAt!==null&&t.dueAt<=horizon}));
 return {
  L0:{realms:REALM_ORDER,knowledge:'記憶 knownBy 是知情範圍，事件 participants 只是參與者，幕後真相僅 truthKnownBy 知悉；belief 是角色看法，非客觀真相。',
   source:'原始回合與變更紀錄保留；摘要與目前狀態不能回寫歷史。期限到達只需推演，不代表結局已發生。'},
  L1:{time:{day:world.day,minute:world.minute},location:world.location,protagonist:world.protagonist,
   scene:working?.location===world.location?working:null,
   lastExchange:world.messages.slice(-2).map(m=>({role:m.role,content:visibleNarrative(m.content).length>2400?'【原文尾段】'+visibleNarrative(m.content).slice(-2400):visibleNarrative(m.content)})),
   playerInput:text},
  L3:{reviewThrough:horizon,threads},
  L4:{turns:world.events.filter(e=>e.type==='conversation').length,latestRevision:world.revision},
 };
}
export function playerMemory(world){
 const working=memoryState(world).working;
 // Only public summaries, no participants' private goals, due truth or NPC attitudes.
 return {scene:working?{summary:working.summary,openLoops:working.openLoops,sourceRevision:working.revision}:null,
  threads:activeThreads(world).filter(t=>t.playerKnown).map(({id,title,summary,status,revision})=>({id,title,summary,status,revision})),
  memories:currentGMMemories(world,{publicOnly:true}).slice(-12).map(({id,text,day,revision})=>({id,text,day,revision})),
  historyCount:world.events.filter(e=>e.type==='conversation').length};
}
const snapshot=w=>({day:w.day,minute:w.minute,location:w.location,protagonist:structuredClone(w.protagonist),
 npcs:Object.fromEntries(Object.entries(w.npcs).map(([id,n])=>[id,{where:n.where,realm:n.realm,status:n.status,mood:n.mood,
  goal:n.goal,cultivationProgress:n.cultivationProgress,relationships:structuredClone(n.relationships)}]))});
export function stateChanges(before,after){
 const a=snapshot(before),b=snapshot(after),changes=[];
 for(const key of ['day','minute','location','protagonist'])if(JSON.stringify(a[key])!==JSON.stringify(b[key]))changes.push({path:key,before:a[key],after:b[key]});
 for(const id of Object.keys(b.npcs))if(JSON.stringify(a.npcs[id])!==JSON.stringify(b.npcs[id]))changes.push({path:'npcs.'+id,before:a.npcs[id]??null,after:b.npcs[id]});
 return changes;
}
export function historyArchive(world,query='',beforeRevision=Infinity){
 const q=clip(query,120);
 return world.events.filter(e=>['conversation','memory-correction'].includes(e.type)&&e.revision<beforeRevision&&(!q||(e.text+' '+e.reply).includes(q)))
  .slice(-25).reverse().map(e=>({id:e.id,revision:e.revision,day:e.day,minute:e.minute,text:e.text,reply:e.reply,
   changes:e.changes||[],records:e.records||null,source:e.type==='memory-correction'?'開發者修正紀錄':e.rawAnswer?'完整GM原始回覆已保留':'舊版原文',rawAnswer:e.rawAnswer||e.reply}));
}

/** Owner correction creates a new version and audit event; never rewrites a past turn. */
export function correctMemory(world,target,patch,note,by){
 if(typeof note!=='string'||!note.trim()||note.length>300)throw Error('請填寫修正原因（最多300字）');
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('記憶修正格式錯誤');
 const working=target==='working',previous=working?memoryState(world).working:activeThreads(world).find(t=>t.id===target);
 if(!previous)throw Error('找不到這筆記憶');
 const allowed=working?['summary','goal','openLoops']:['summary','status','truth'];
 if(!Object.keys(patch).length||Object.keys(patch).some(k=>!allowed.includes(k)))throw Error('不支援的記憶欄位');
 for(const [k,v] of Object.entries(patch)){
  if(k==='openLoops'){if(!Array.isArray(v)||v.length>5||v.some(x=>typeof x!=='string'||x.length>180))throw Error('未完事項格式錯誤');}
  else if(k==='status'){if(!['open','blocked','resolved','failed'].includes(v))throw Error('事件狀態錯誤');}
  else if(typeof v!=='string'||v.length>(k==='goal'?200:600))throw Error('記憶文字過長');
 }
 const next=structuredClone(world);next.revision++;
 next.memorySystem=memoryState(next);
 const id='memory-correction:'+next.revision;
 const updated={...previous,...patch,revision:next.revision,eventId:id,day:next.day,minute:next.minute,source:'開發者修正'};
 delete updated.evidence;
 if(working)next.memorySystem.working=updated;else next.memorySystem.threads.push(updated);
 const changes=[{path:working?'memorySystem.working':'memorySystem.threads.'+target,before:previous,after:updated}];
 next.events.push({id,type:'memory-correction',revision:next.revision,day:next.day,minute:next.minute,
  text:'開發者修正：'+note.trim(),reply:JSON.stringify(updated),changes,by});
 next.developerAudit??=[];next.developerAudit.push({revision:next.revision,actorId:target,fields:Object.keys(patch),by,note:note.trim()});
 return next;
}

/** D1 has a per-value limit. Refuse before writing, preserving the existing save. */
export function serializeWorldSave(world){
 const value=JSON.stringify(world);
 if(new TextEncoder().encode(value).length>1_800_000){
  const error=new Error('存檔已達目前版本的容量上限，本次變更未保存。請從開發者後台下載完整存檔，再開啟新世界。');
  error.status=413;throw error;
 }
 return value;
}
