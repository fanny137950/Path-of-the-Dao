/* Authoritative V3 character registry and per-character memories. No D1 schema changes. */
export const V3_INTRO='太虛宗收徒大典，山門前人潮如織。高臺上，負責測試靈根的執事抬起眼。\n\n「下一位。姓名？」\n\n你是十五歲的洛河，今日第一次踏入太虛宗。';
export const MOODS=['平靜','愉快','好奇','警惕','不悅','憤怒','擔憂','疲憊','悲傷','緊張'];
export const CONDITIONS=['健康','輕傷','受傷','重傷','休養'];
export const LOCATIONS=['太虛宗山門','太虛宗主峰','棲風峰','演武場','藏經樓','內門居所'];
const clone=x=>structuredClone(x);
const shorten=(x,max=180)=>typeof x==='string'?x.trim().slice(0,max):'';
const clamp=(n,min=-100,max=100)=>Math.min(max,Math.max(min,n));
const relationship=()=>({favor:0,trust:0,respect:0,impression:'尚未熟識'});
const make=(id,name,role,realm,roots,where,goal,traits,speech,plan)=>({
 id,name,role,realm,roots,where,goal,traits,speech,plan,mood:'平靜',status:'健康',
 cultivationProgress:0,relationships:{player:relationship()},memories:[],knowledge:[],privateNotes:[],
});
export const NPCS=Object.freeze({
 registrar:make('registrar','韓守一','太虛宗收徒執事','聚氣後期','未記載','太虛宗山門',
  '核對名冊，公正完成收徒測試',['公事公辦','耐心有限','重視流程'],'務實、簡短，不隨意許諾','大典值勤後返回執事處'),
 shen:make('shen','沈滄月','棲風峰峰主','元嬰後期','純風靈根','棲風峰',
  '指導弟子並維持峰內秩序',['冷靜','嚴格','保護弟子但不縱容'],'言簡意賅，偶有冷幽默','修行、峰務與管教弟子'),
 yan:make('yan','晏清辭','棲風峰親傳大師姐','金丹初期','風金雙靈根','棲風峰',
  '精進修行與照顧師弟妹',['自律','有責任感','守規矩'],'條理分明、態度直接','劍術修煉與峰內事務'),
 jiang:make('jiang','江離','棲風峰親傳師兄','築基後期','風水雙靈根','棲風峰',
  '修行並協助同門',['溫和','愛開玩笑','擅長圓場'],'隨和，略帶調侃','修煉與同門支援'),
 gu:make('gu','顧長青','棲風峰親傳師兄','築基中期','未記載','棲風峰',
  '穩步修行',['內斂','謹慎'],'不多話，重視實際行動','修煉與內門日課'),
});
export function initialV3World(id){
 return {id,mode:'v3',version:2,revision:0,minute:480,day:1,location:'太虛宗山門',
  protagonist:{name:'洛河',age:15,realm:'凡人',spiritualRoot:'未測定'},
  npcs:clone(NPCS),events:[],messages:[{role:'assistant',content:V3_INTRO}],developerAudit:[]};
}
export function validatedWorld(value){
 if(!value||value.mode!=='v3'||!Array.isArray(value.messages)||!Array.isArray(value.events)
 ||!Number.isInteger(value.minute)||!Number.isInteger(value.revision)||!value.npcs
 ||typeof value.npcs!=='object'||!value.protagonist)throw Error('世界資料損毀');
 value.version=2;
 value.developerAudit??=[];
 for(const [id,defaults] of Object.entries(NPCS)){
  const original=value.npcs[id]||{};
  value.npcs[id]={...clone(defaults),...original,id,
   relationships:{player:{...relationship(),...original.relationships?.player}},
   memories:Array.isArray(original.memories)?original.memories:[],
   knowledge:Array.isArray(original.knowledge)?original.knowledge:[],
   privateNotes:Array.isArray(original.privateNotes)?original.privateNotes:[]};
 }
 for(const [id,c] of Object.entries(value.npcs)){
  if(!c||typeof c!=='object'||c.id!==id)throw Error('人物資料損毀');
  c.memories=Array.isArray(c.memories)?c.memories:[];
  c.knowledge=Array.isArray(c.knowledge)?c.knowledge:[];
  c.privateNotes=Array.isArray(c.privateNotes)?c.privateNotes:[];
  c.relationships={player:{...relationship(),...c.relationships?.player}};
 }
 return value;
}
export function playerWorld(world){
 return {id:world.id,revision:world.revision,day:world.day,minute:world.minute,
 location:world.location,protagonist:world.protagonist,messages:world.messages};
}
export function developerWorld(world){
 return {world:world.id,revision:world.revision,day:world.day,minute:world.minute,
  location:world.location,characters:clone(world.npcs),events:clone(world.events.slice(-25)),
  audit:clone((world.developerAudit||[]).slice(-25))};
}
const presentIds=world=>Object.keys(world.npcs).filter(id=>world.npcs[id].where===world.location);
export const nearbyCharacters=world=>presentIds(world).map(id=>world.npcs[id]);
function privacyHint(text){
 return /(?:心想|心裡想|心中想|心底想|暗想|腦海裡|默想|在心裡|暗自思索|偷偷想)/.test(text);
}
function terms(text){
 const matches=(text.match(/[\u3400-\u9fff]{2,}|[a-zA-Z0-9]{3,}/g)||[]);
 const arr=[];
 for(const word of matches){
  if(/[\u3400-\u9fff]/.test(word)&&word.length>2){for(let i=0;i<word.length-1;i++)arr.push(word.slice(i,i+2));}
  else arr.push(word.toLowerCase());
 }
 return new Set(arr);
}
export function recalledMemories(actor,query,limit=8){
 const keys=terms(query),mem=actor.memories||[];
 return mem.map((m,i)=>({
  m,score:[...terms(m.text||'')].filter(k=>keys.has(k)).length*8+(m.importance||1)*2+i/Math.max(1,mem.length)
 })).sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.m);
}
export function gmContext(world,userText){
 const recent=world.messages.slice(-20).map(m=>(m.role==='user'?'洛河':'GM')+'：'+m.content).join('\n\n');
 const present=nearbyCharacters(world);
 const people=present.map(actor=>{
  const memory=recalledMemories(actor,userText,10).map(m=>'第'+m.day+'日・'+m.kind+'：'+m.text).join('；');
  const notes=actor.privateNotes.length?'【GM 私密備註（其他人物未知）】'+actor.privateNotes.slice(-3).join('；'):'';
  return '【'+actor.name+'／'+actor.id+'】'+actor.role+'，境界'+actor.realm+'，'+actor.status+'、'+actor.mood+
   '。對洛河：好感'+actor.relationships.player.favor+'，信任'+actor.relationships.player.trust+
   '，尊重'+actor.relationships.player.respect+'。人格：'+actor.traits.join('、')+
   '；說話風格：'+actor.speech+'；目標：'+actor.goal+'。\n【自己知道的事】'+(memory||'尚無可確認的相遇記憶')+'。'+notes;
 }).join('\n');
 return '【伺服器確定的世界事實】第'+world.day+'日 '+Math.floor(world.minute/60)+':'+
  String(world.minute%60).padStart(2,'0')+'，地點：'+world.location+'；洛河，'+
  world.protagonist.age+'歲，境界'+world.protagonist.realm+'，靈根'+world.protagonist.spiritualRoot+
  '。\n【現場人物】'+(present.map(x=>x.name).join('、')||'沒有已登記人物')+
  '；不在場人物不能憑空旁聽、瞬間出現。\n'+people+
  '\n【過去已紀錄的事件】'+world.events.slice(-6).map(e=>'第'+e.day+'日：'+shorten(e.text,90)).join('；')+
  '\n【最近對話】\n'+recent+'\n【洛河最新行動】'+userText+
  '\n【知情規則】每人只能使用自身知道的線索。不得把一人秘密變成其他人的知識。AI 敘述不等同正式修改資料庫修為、位置、物品。';
}
const marker=/\n?<!--GM_STATE:([\s\S]{1,3000})-->\s*$/;
export function parseGMResult(raw){
 if(typeof raw!=='string'||!raw.trim())throw Error('GM 回覆無效');
 const match=raw.match(marker);
 if(!match)return {narration:raw.trim(),changes:[],move:null};
 const narration=raw.slice(0,match.index).trim();
 let changes=[],move=null;
 try{const parsed=JSON.parse(match[1]);if(Array.isArray(parsed.changes))changes=parsed.changes.slice(0,8);
  if(parsed.move&&typeof parsed.move==='object')move=parsed.move;}
 catch{/* Invalid metadata never changes canonical state. */}
 return {narration:narration||'（本回合未產生可用敘述，請重試。）',changes,move};
}
function applyChanges(next,changes,text,narration,present){
 const evidenceText=text+'\n'+narration;
 for(const change of changes){
  if(!change||typeof change!=='object'||!present.has(change.id))continue;
  const actor=next.npcs[change.id],quote=shorten(change.evidence,100);
  if(!actor||quote.length<2||!evidenceText.includes(quote))continue;
  if(MOODS.includes(change.mood))actor.mood=change.mood;
  if(change.relationship&&typeof change.relationship==='object'){
   for(const field of ['favor','trust','respect']){
    const delta=change.relationship[field];
    if(Number.isInteger(delta)&&Math.abs(delta)<=2)
     actor.relationships.player[field]=clamp(actor.relationships.player[field]+delta);
   }
  }
 }
}
export function commitV3Turn(world,userText,rawAnswer,requestId){
 if(typeof userText!=='string'||!userText.trim()||userText.length>2500)throw Error('玩家輸入無效');
 if(typeof rawAnswer!=='string'||!rawAnswer.trim()||rawAnswer.length>12000)throw Error('GM 回覆無效');
 if(world.events.some(e=>e.requestId===requestId))throw Error('重複回合');
 if(world.events.length>=1000)throw Error('試玩世界已達1000回合，請先備份');
 const present=new Set(presentIds(world)),parsed=parseGMResult(rawAnswer),next=clone(world);
 const move=parsed.move;
 // A narrative alone cannot teleport the player. Movement needs a matching player request,
 // a known destination and quoted evidence of arrival in the GM response.
 const approvedMove=move&&LOCATIONS.includes(move.to)&&move.to!==world.location&&
  (userText.includes(move.to)||/(前往|走向|跟著|隨同|出發|帶我去)/.test(userText))&&
  typeof move.evidence==='string'&&move.evidence.length>=4&&move.evidence.length<=100&&
  parsed.narration.includes(move.evidence)&&/(抵達|到達|來到|走進|進入)/.test(move.evidence)&&
  !/(尚未|未能|無法|不能|沒能|不准)/.test(move.evidence);
 next.revision++;next.minute+=approvedMove?30:5;
 while(next.minute>=1440){next.minute-=1440;next.day++;}
 if(approvedMove)next.location=move.to;
 const eventId='turn:'+next.revision,seenBy=privacyHint(userText)?[]:[...present];
 next.messages.push({role:'user',content:userText},{role:'assistant',content:parsed.narration});
 next.events.push({requestId,id:eventId,revision:next.revision,day:next.day,minute:next.minute,
 type:'conversation',text:userText,reply:parsed.narration,location:world.location,
 destination:approvedMove?move.to:null,witnesses:seenBy});
 for(const id of seenBy){
  const actor=next.npcs[id];
  actor.knowledge.push(eventId);
  actor.memories.push({id:eventId+':'+id,eventId,kind:'親歷',day:next.day,minute:next.minute,
  importance:1,source:'現場',text:shorten('洛河：'+userText+'；當時：'+parsed.narration,420)});
 }
 applyChanges(next,parsed.changes,userText,parsed.narration,present);
 return next;
}
export function editCharacter(world,id,patch,note,by='developer'){
 if(typeof id!=='string'||!Object.hasOwn(world.npcs,id))throw Error('找不到人物');
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('無效人物設定');
 const allowed=['mood','status','where','goal','cultivationProgress','relationship','privateNote','role','realm','roots','traits','speech','plan'];
 if(Object.keys(patch).some(k=>!allowed.includes(k)))throw Error('不允許的設定欄位');
 if(Object.keys(patch).length===0)throw Error('沒有修改');
 const next=clone(world),actor=next.npcs[id];
 if(patch.mood!==undefined){if(!MOODS.includes(patch.mood))throw Error('無效情緒');actor.mood=patch.mood;}
 if(patch.status!==undefined){if(!CONDITIONS.includes(patch.status))throw Error('無效身體狀況');actor.status=patch.status;}
 for(const field of ['where','goal','role','roots','speech','plan']){
  if(patch[field]!==undefined){
   const value=patch[field],max=field==='where'?70:field==='roots'?50:field==='role'?80:180;
   if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('無效'+field);
   actor[field]=value.trim();
  }
 }
 if(patch.realm!==undefined){
  if(typeof patch.realm!=='string'||!(/^(凡人|鍛體|聚氣|築基|金丹|元嬰|化神|洞虛|合道|渡劫)(初期|中期|後期|圓滿)?$/).test(patch.realm))throw Error('無效修為境界');
  actor.realm=patch.realm;
 }
 if(patch.traits!==undefined){
  if(!Array.isArray(patch.traits)||patch.traits.length<1||patch.traits.length>12||patch.traits.some(x=>typeof x!=='string'||!x.trim()||x.length>24))throw Error('人格特質需為1至12項');
  actor.traits=patch.traits.map(x=>x.trim());
 }
 if(patch.cultivationProgress!==undefined){
  const n=patch.cultivationProgress;
  if(!Number.isInteger(n)||n<0||n>100)throw Error('修為進度需為0至100');
  actor.cultivationProgress=n;
 }
 if(patch.relationship!==undefined){
  if(!patch.relationship||typeof patch.relationship!=='object'||Array.isArray(patch.relationship))throw Error('無效關係');
  for(const [k,v] of Object.entries(patch.relationship)){
   if(!['favor','trust','respect'].includes(k)||!Number.isInteger(v)||v< -100||v>100)throw Error('關係值需在 -100 至100');
   actor.relationships.player[k]=v;
  }
 }
 if(patch.privateNote!==undefined){
  if(typeof patch.privateNote!=='string'||!patch.privateNote.trim()||patch.privateNote.length>240)throw Error('私人備註需1至240字');
  actor.privateNotes.push(patch.privateNote.trim());
 }
 next.revision++;
 next.developerAudit??=[];
 next.developerAudit.push({revision:next.revision,actorId:id,operation:'character-edit',by,
 day:next.day,minute:next.minute,fields:Object.keys(patch),note:shorten(note,120)});
 return next;
}
