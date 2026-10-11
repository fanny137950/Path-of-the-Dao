/**
 * Phase 1: conversation continuity and durable episodic recall.
 * Pure read-only projection over existing D1 world.messages / world.events.
 * Keeps the raw conversation intact, avoids any data migration, and never
 * exposes offscreen truth as player knowledge.
 */
import {isNonNarrative,visibleNarrative} from './narrative.mjs';

const clean=(value,max)=>String(value??'').trim().slice(0,max);
const absolute=e=>(Number(e.day)-1)*1440+Number(e.minute);
const important=/(承諾|答應|約定|保證|發誓|道歉|拒絕|背叛|秘密|救命|救了|救下|受傷|重傷|打架|切磋|收徒|拜師|師父|靈根|突破|木劍|信任|對不起|說好|約戰|不再|永遠|記得)/;
const tokens=s=>{
 const words=String(s??'').match(/[\u3400-\u9fff]+|[a-zA-Z0-9]+/g)||[];
 const out=new Set();
 for(const word of words){
  if(/^[\u3400-\u9fff]+$/.test(word)){
   for(let i=0;i<word.length-1;i++)out.add(word.slice(i,i+2));
  }else if(word.length>2)out.add(word.toLowerCase());
 }
 return out;
};
const similarity=(query,candidate)=>{
 const q=tokens(query),c=tokens(candidate);
 let hits=0;for(const t of q)if(c.has(t))hits++;
 return hits;
};
/**
 * A scene consists of contiguous, same-place conversations with no long
 * intermission. Do not mistake earlier visits to the same place for one scene.
 * Existing saves need no scene_id migration: event times/locations suffice.
 */
export function currentSceneEvents(world){
 const events=(world.events||[]).filter(e=>e.type==='conversation'&&!isNonNarrative(e.reply));
 if(events.length===0)return [];
 const newest=events.at(-1);
 if((newest.destination||newest.location)!==world.location)return [];
 const result=[];
 for(let i=events.length-1;i>=0;i--){
  const e=events[i],next=events[i+1];
  if((e.destination||e.location)!==world.location)break;
  if(next&&(absolute(next)-absolute(e)>180||Number(e.advanceMinutes)>=360))break;
  result.push(e);
  // A long wait represents a genuine scene break, even without travel.
  if(Number(e.advanceMinutes)>=360)break;
 }
 return result.reverse();
}
/**
 * Preserve complete lines of the newest scene first. If long, summarize older
 * scene turns by selecting their actual source lines, not invented AI summaries.
 * Original events and messages remain in the authoritative D1 world forever.
 */
export function sceneConversationForGM(world,userText,maxChars=4900){
 const events=currentSceneEvents(world);
 if(!events.length){
  const opening=world.messages?.find(m=>m.role==='assistant'&&!isNonNarrative(m.content));
  return '【目前場景對話】'+(opening?'\nGM：'+clean(visibleNarrative(opening.content),1250):'尚無已完成的玩家對話');
 }
 const toLines=e=>'第'+e.day+'日 '+String(Math.floor(e.minute/60)).padStart(2,'0')+':'+String(e.minute%60).padStart(2,'0')+
  '\n洛河：'+clean(e.text,2500)+'\nGM：'+clean(visibleNarrative(e.reply),8000);
 // A contiguous suffix matters more than isolated older lines: skipping a
 // long recent reply would create a misleading hole in an active exchange.
 const lines=events.map(toLines);
 const selected=[],older=[];
 let remaining=Math.max(700,maxChars-120);
 let boundary=events.length;
 for(let i=lines.length-1;i>=0;i--){
  if(lines[i].length+2>remaining){boundary=i+1;break;}
  selected.unshift(lines[i]);remaining-=lines[i].length+2;
  boundary=i;
 }
 older.push(...events.slice(0,boundary));
 // If the most recent exchange alone is very long, keep its final portion,
 // labeled as an excerpt; never replace it with an unrelated older turn.
 if(!selected.length&&lines.length){
  selected.push('【最新回合原文尾段】'+lines.at(-1).slice(-Math.max(350,maxChars-190)));
  older.splice(-1,1);
 }
 // Keep precise older source excerpts for continuity (not fabricated claims).
 const excerpts=older.filter(e=>important.test(e.text+' '+e.reply)).slice(-4)
  .map(e=>'第'+e.day+'日第'+e.revision+'回合：洛河 '+clean(e.text,135)+'；GM '+clean(visibleNarrative(e.reply),180));
 const budget=Math.max(0,maxChars-selected.join('\n\n').length-90);
 const oldText=excerpts.join('\n').slice(-Math.min(budget,1100));
 return '【目前場景對話（按時間順序，保留原話；不是新場景）】\n'+
  (oldText?'【較早的關鍵原話摘錄】\n'+oldText+'\n':'')+selected.join('\n\n');
}
/**
 * Important previous events can be recalled even when the player uses vague
 * references ("上次那件事") or a new name for the same incident. Only
 * explicitly recorded player-visible conversation events are eligible here;
 * hidden offscreen events and NPC-only recollections stay in their own scopes.
 */
export function episodicMemoriesForGM(world,userText,maxChars=1350){
 const active=new Set(currentSceneEvents(world).map(e=>e.id));
 const events=(world.events||[]).filter(e=>e.type==='conversation'&&!active.has(e.id)&&!isNonNarrative(e.reply));
 const present=new Set(Object.values(world.npcs||{}).filter(n=>n.where===world.location).map(n=>n.id));
 const sceneText=(currentSceneEvents(world).slice(-3).map(e=>e.text+' '+visibleNarrative(e.reply)).join(' '));
 const query=userText+' '+sceneText;
 const ranked=events.map((e,i)=>{
  const inWorld=e.witnesses||[];
  // Recall is for GM continuity; non-witnesses must not receive these facts.
  const score=similarity(query,e.text+' '+visibleNarrative(e.reply))*9+
   (important.test(e.text+' '+e.reply)?10:0)+
   (inWorld.some(id=>present.has(id))?8:0)+i/Math.max(1,events.length);
  return {e,score};
 }).filter(x=>x.score>=8).sort((a,b)=>b.score-a.score).slice(0,8).sort((a,b)=>a.e.revision-b.e.revision);
 const lines=ranked.map(({e})=>'第'+e.day+'日／第'+e.revision+'回合／'+e.location+
  '：洛河 '+clean(e.text,180)+'；當時 '+clean(visibleNarrative(e.reply),250)+
  '。【當時見證者】'+(e.witnesses?.length?e.witnesses.map(id=>world.npcs?.[id]?.name||'未知').join('、'):'無已記錄見證者'));
 return '【跨場景往事：GM參考，不表示在場NPC都知道】\n'+
   (lines.join('\n').slice(0,maxChars)||'無需引用的往事');
}
