/**
 * Quiet, deterministic world simulation. This is not a story-rail system.
 * Background events advance with GAME time even if Luohe ignores them.
 * Public narration is generated separately by the GM.
 */
const simple=(value,max=120)=>String(value??'').trim().slice(0,max);
export function initialLivingWorld(){
 return {
  planVersion:1,
  arcs:[{
   id:'recruitment-register',name:'收徒名冊遺漏',
   truth:'執事處的兩份收徒名冊編號錯位，源於抄錄差錯，不是有人蓄意竄改。',
   participants:['registrar','guide'],status:'未開始',
   beats:[
    {id:'mismatch',at:570,summary:'收徒執事發現名冊號碼對不上，暫未公布',witnesses:['registrar']},
    {id:'inquiry',at:690,summary:'收徒執事託接引弟子核對原始名冊',witnesses:['registrar','guide']},
    {id:'resolved',at:990,summary:'接引弟子找到抄錄錯誤並將名冊更正',witnesses:['registrar','guide']},
   ],completed:[],
  }],
  chapters:[],
  lastSimulatedMinute:480,
 };
}
export function elapsedMinutes(world){
 return (world.day-1)*1440+world.minute;
}
export function timeCost(playerText,currentMinute=480){
 // Quoted dialogue, questions, refusals and hypothetical plans are not actions.
 // This remains a conservative parser, not unrestricted natural-language understanding.
 const source=String(playerText||'');
 const text=source.replace(/[「“][^」”]*[」”]|"[^"]*"/g,'')
  .split(/[，,。！？!?；;\n]/).filter(part=>
   !/(?:不|沒|未|別|拒絕|取消|先不).{0,4}(?:修煉|練劍|練功|打坐|等待|休息|睡|前往|走|閉關|跳過)/.test(part)&&
   !/(?:問|詢問|如果|假如|假設|要是|打算|想要|考慮|能不能|可不可以|是否|怎麼|如何|為什麼)/.test(part)
  ).join('，');
 if(/(?:過了|跳過|略過).{0,5}(?:三|3)天|三天後/.test(text))return 4320;
 if(/(?:隔天|第二天|明天早上|睡到明天)/.test(text))return 1440-currentMinute+480;
 if(/(?:等到|待到).{0,5}(?:天黑|夜晚|晚上)/.test(text))return Math.max(0,1080-currentMinute);
 if(/(?:閉關|修煉|練劍|練功|打坐).{0,8}(?:一個時辰|兩個小時)/.test(text))return 120;
 if(/(?:練劍|修煉|打坐|讀書|休息|等待).{0,10}(?:一小時|半個時辰|一個小時)/.test(text))return 60;
 if(/(?:前往|走到|走向|趕往|出發|下山|上山|帶我去)/.test(text))return 30;
 if(/(?:切磋|練劍|修煉|打坐|上課|旁觀比試)/.test(text))return 25;
 if(/(?:聊天|詢問|告訴|問|說|想|看|觀察|繼續)/.test(source))return 4;
 return 6;
}
export function advanceLivingWorld(world,startAbs,endAbs){
 const living=world.living;
 if(!living||!Array.isArray(living.arcs))return [];
 const made=[];
 for(const arc of living.arcs){
  for(const beat of arc.beats||[]){
   const absolute=beat.at;
   if(absolute<=startAbs||absolute>endAbs||arc.completed.includes(beat.id))continue;
   arc.completed.push(beat.id);
   arc.status=beat.id==='resolved'?'已解決':'進行中';
   const eventId='offscreen:'+arc.id+':'+beat.id;
   const day=Math.floor(absolute/1440)+1,minute=absolute%1440;
   const event={id:eventId,revision:world.revision,day,minute,type:'offscreen',text:beat.summary,
    reply:'',location:'太虛宗執事處',witnesses:[...beat.witnesses],hidden:true,
    source:'living-world',arc:arc.id};
   world.events.push(event);
   for(const id of beat.witnesses){
    const actor=world.npcs[id];
    if(!actor)continue;
    actor.knowledge.push(eventId);
    actor.memories.push({id:eventId+':'+id,eventId,kind:'知悉',day,minute,
     importance:2,source:'自身工作',text:beat.summary});
   }
   made.push(event);
  }
 }
 living.lastSimulatedMinute=Math.max(living.lastSimulatedMinute??0,endAbs);
 // Only update an actor's schedule after it is off-screen. Interactions do not
 // teleport characters while Luohe is still talking to them.
 const hour=world.minute/60;
 if(hour>=18&&world.location!=='太虛宗山門'&&world.npcs.registrar?.where==='太虛宗山門')
  world.npcs.registrar.where='太虛宗執事處';
 if(hour>=18&&world.location!=='外門報到處'&&world.npcs.guide?.where==='外門報到處')
  world.npcs.guide.where='外門居所';
 return made;
}
export function maybeWriteChapter(world,querySize=12){
 const recent=world.events.filter(e=>e.type==='conversation');
 if(recent.length===0||recent.length%querySize!==0)return;
 const group=recent.slice(-querySize);
 const lines=group.filter((e,i)=>i===0||i===group.length-1||
  /(答應|承諾|秘密|打架|受傷|收下|交給|拜師|靈根|突破|拒絕|答應|師父)/.test(e.text||''))
  .slice(0,7).map(e=>'第'+e.day+'日：洛河 '+simple(e.text,72)+'；'+simple(e.reply,100));
 world.living.chapters.push({from:group[0].revision,to:group.at(-1).revision,
  day:world.day,text:lines.join('\n')});
}
function grams(text){
 const clean=String(text??'').replace(/\s+/g,'');
 const terms=new Set();
 for(let i=0;i<clean.length-1;i++)terms.add(clean.slice(i,i+2));
 return terms;
}
export function recallChapters(world,query,max=4){
 const chapters=world.living?.chapters||[],queryTerms=grams(query);
 return chapters.map((chapter,index)=>({
  chapter,score:[...grams(chapter.text)].filter(x=>queryTerms.has(x)).length*4+index/Math.max(1,chapters.length),
 })).sort((a,b)=>b.score-a.score).slice(0,max).map(x=>x.chapter);
}
export function worldPlanForGM(world){
 const arcs=world.living?.arcs||[];
 return arcs.map(arc=>{
  const available=(arc.beats||[]).filter(b=>arc.completed.includes(b.id));
  return '【世界事件：'+arc.name+'】真相（只供GM規劃，不能令NPC全知）：'+arc.truth+
   '。目前：'+arc.status+'。已發生：'+available.map(b=>b.summary).join('；')+
   '。未到時間的事件只屬計畫，不可寫成已經發生。';
 }).join('\n');
}
