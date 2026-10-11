/**
 * Build a compact, relevant canon excerpt rather than dumping the whole bible.
 * Truth about the world's laws is available to the GM; offscreen NPC minds,
 * past plotlines and GM-only secrets are deliberately not transplanted.
 */
import {WORLD_BIBLE,REALM_ORDER} from './world-bible.mjs';
import {CHARACTER_BIBLE,CHARACTER_BY_NAME} from './character-bible.mjs';

const trim=(v,n)=>String(v??'').slice(0,n);
const match=(text,terms)=>terms.some(k=>text.includes(k));
const P=WORLD_BIBLE.sect;
export function loreForGM(world,input,limit=2500){
 const text=String(input||'')+' '+String(world.location||'');
 const sections=[];
 sections.push('【固定世界線】'+WORLD_BIBLE.continuity.line+'；非舊太玄仙門／洛雲線。'+
  '當前新存檔尚未拜師，舊遊玩劇情不視為已發生。');
 sections.push('【宗門法則】太虛宗弟子分雜役、外門、內門、親傳；'+
  '測出靈根≠自動拜師或取得某峰親傳資格；宗主裴玄真統籌、各峰自有職責；戒律峰按門規查處。'+
  'NPC 不可隨意瞬移、全知或替玩家作決定。');
 if(match(text,['山門','收徒','靈根','測試','測靈石','招生','入門','報到','拜師','選徒','直接開始']))
  sections.push('【收徒規則】'+P.recruitment.steps.join('→')+'。'+P.recruitment.boundaries.join('；')+
   '。玩家僅說「開始」是同意進行流程，不等於已經動手按石，請等待玩家實際動作。');
 if(match(text,['修煉','境界','聚氣','築基','金丹','元嬰','化神','靈力','心法','突破','練功','比試','切磋','戰鬥','劍','法術']))
  sections.push('【境界及勝負】'+REALM_ORDER.join('→')+'；每境有初中後圓滿。'+
   '勝負取決於境界、法器、功法、環境、準備和身體狀態；不得憑說一句話越境突破或取勝。'+
   '靈根屬性與資質、實際修為是三項不同資料。');
 const peak=P.peaks.filter(p=>text.includes(p.name));
 if(match(text,['峰','宗門','師承','弟子'])&&peak.length===0)
  sections.push('【十二峰】'+P.peaks.map(p=>p.name+'（'+p.domain+'）').join('、'));
 for(const p of peak.slice(0,3))sections.push('【'+p.name+'】主管：'+p.leader+'；職能：'+p.domain+
  '；行事風格：'+p.mood+'；資料來源：'+(p.source==='expanded'?'新增設定':'既有設定')+'。');
 for(const faction of WORLD_BIBLE.factions.filter(f=>text.includes(f.name)).slice(0,3))
  sections.push('【勢力'+faction.name+'】'+faction.region+'；'+faction.goal+'；'+faction.stance);
 if(match(text,['靈石','丹藥','買','賣','商隊','貢獻','任務']))
  sections.push('【經濟規則】'+WORLD_BIBLE.economy.notes.join('；'));
 if(match(text,['太虛鐘','鐘聲','警戒','戰時']))
  sections.push('【太虛鐘】'+P.bells.map(x=>x.count+'響='+x.meaning).join('；'));
 // Referenced, non-present people may be mentioned as *public knowledge*, not
 // inserted into the physical scene or handed offscreen personal secrets.
 const present=new Set(Object.values(world.npcs||{}).filter(a=>a.where===world.location).map(a=>a.name));
 const named=CHARACTER_BIBLE.filter(c=>text.includes(c.name)&&!present.has(c.name)).slice(0,2);
 for(const actor of named)sections.push('【遠處人物的公開資料】'+actor.name+'：'+actor.role+
  '，境界'+actor.realm+'；常見性格：'+actor.traits.join('、')+
  '。此人不在現場，不能因被提起就瞬移、知曉當前對話或洩漏私密內容。');
 return sections.join('\n').slice(0,limit);
}
export function npcPortraitForGM(actor){
 return '【在場NPC：'+actor.name+'／'+actor.id+'】'+actor.role+
  '，'+actor.realm+'，靈根'+actor.roots+
  '，資質'+(actor.aptitude?.grade||'未知')+
  '（資質≠現有戰力；公開與否依角色知情）。'+
  '人格：'+(actor.personality||actor.traits?.join('、')||'未詳')+'。'+
  '弱點：'+(actor.flaw||'未知')+'。'+
  '語氣：'+actor.speech+'。擅長：'+(actor.methods||[]).join('、')+
  '。目標：'+actor.goal+'。關係：'+(actor.ties||[]).slice(0,4).join('；')+
  '。日常：'+trim(actor.plan,100)+'。'+
  (actor.background?'背景：'+trim(actor.background,120)+'。':'')+
  '目前：'+actor.status+'／'+actor.mood+
  '。對洛河：好感'+actor.relationships.player.favor+
  '、信任'+actor.relationships.player.trust+
  '、尊重'+actor.relationships.player.respect+'。'+
  // Player doesn't get lore injected, GM must not make actor omniscient.
  '【本人私情，僅GM解讀其行為；不得直接宣告為洛河已知】'+trim(actor.privateLore,160)+'。';
}
