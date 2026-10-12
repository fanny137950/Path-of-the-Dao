'use client';
import {useEffect,useMemo,useState} from 'react';
import {organizeCharacters,countCharacters} from '../v3/server/character-index.mjs';

type Memory={id:string;eventId:string;kind:string;day:number;minute:number;text:string;source:string};
type Character={
 id:string;name:string;role:string;realm:string;roots:string;where:string;goal:string;
 traits:string[];speech:string;plan:string;mood:string;status:string;cultivationProgress:number;
 peak?:string;source?:string;age?:number|null;personality?:string;flaw?:string;
 methods?:string[];ties?:string[];background?:string;privateLore?:string;
 aptitude?:{grade:string;description:string;bottleneck:string;growth:string;assessed:boolean};
 fieldSources?:Record<string,string>;
 relationships:{player:{favor:number;trust:number;respect:number;impression?:string}};
 memories:Memory[];privateNotes:string[];knowledge:string[];
};
type NPCAgenda={id:string;actorId:string;title:string;location:string;start:number;end:number;phase:string;goal:string;status:string;cause:string;summary?:string};
type DeveloperData={
 gmManaged?:boolean;revision:number;world:string;day:number;minute:number;location:string;
 characters:Record<string,Character>;bibleVersion?:number;
 gmMemories?:{id:string;day:number;text:string;playerKnown:boolean;knownBy:string[]}[];
 npcAgency?:{lastAdvancedAt:number;agendas:Record<string,NPCAgenda>;history:{id:string;actorId:string;at:number;title:string;location:string}[]};
 protagonist?:{name:string;age:number;gender?:string;hometown?:string;realm:string;spiritualRoot:string;aptitude?:{grade:string;description:string};family?:string[]};
 worldBible?:{title:string;sect?:{recruitment:{steps:string[]};peaks:{name:string;domain:string;leader:string;source:string}[]};
  cultivation?:{realmOrder:string[];hardRules:string[]};factions?:{name:string;region:string;stance:string}[]};
 events:{id?:string;text:string;reply:string;witnesses?:string[]}[];
 audit:{revision:number;actorId:string;fields:string[];by:string;note?:string}[];
};
type WorldView={id:string;revision:number;day:number;minute:number;location:string;messages:{role:'user'|'assistant';content:string}[]};
const moods=['平靜','愉快','好奇','警惕','不悅','憤怒','擔憂','疲憊','悲傷','緊張'];
const conditions=['健康','輕傷','受傷','重傷','休養'];
type Draft={mood:string;status:string;where:string;goal:string;cultivationProgress:string;favor:string;trust:string;respect:string;privateNote:string;role:string;realm:string;roots:string;traits:string;speech:string;plan:string};
function fromCharacter(c:Character):Draft{
 return {mood:c.mood,status:c.status,where:c.where,goal:c.goal,role:c.role,realm:c.realm,roots:c.roots,traits:c.traits.join('、'),speech:c.speech,plan:c.plan,
  cultivationProgress:String(c.cultivationProgress),
  favor:String(c.relationships.player.favor),trust:String(c.relationships.player.trust),
  respect:String(c.relationships.player.respect),privateNote:''};
}
export default function V3DeveloperPanel({
 worldId,revision,onWorldChange,
}:{
 worldId:string;revision:number;onWorldChange:(world:WorldView)=>void;
}){
 const [data,setData]=useState<DeveloperData|null>(null);
 const [selected,setSelected]=useState('registrar');
 const [characterSearch,setCharacterSearch]=useState('');
 const [openedGroups,setOpenedGroups]=useState<Record<string,boolean>>({});
 const [draft,setDraft]=useState<Draft|null>(null);
 const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);
 useEffect(()=>{
  if(!worldId)return;
  const abort=new AbortController();
  setLoading(true);setError('');
  fetch('/api/v3/world?world='+encodeURIComponent(worldId)+'&view=developer',{cache:'no-store',signal:abort.signal})
   .then(async res=>{
    const data=await res.json() as DeveloperData & {error?:string};
    if(!res.ok)throw Error(data.error||'無法載入開發者資訊');
    if(!data.characters||!data.world)throw Error('開發者資料格式錯誤');
    return data;
   }).then(value=>{if(!abort.signal.aborted)setData(value)})
   .catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'讀取失敗')})
   .finally(()=>{if(!abort.signal.aborted)setLoading(false)});
  return()=>abort.abort();
 },[worldId,revision]);
 const actor=data?.characters[selected]||null;
 const directory=useMemo(()=>organizeCharacters(data?.characters||{},{
  peaks:data?.worldBible?.sect?.peaks,query:characterSearch,
 }),[data?.characters,data?.worldBible?.sect?.peaks,characterSearch]);
 const totalCharacters=Object.keys(data?.characters||{}).length;
 const matchedCharacters=countCharacters(directory);
 useEffect(()=>{setDraft(actor?fromCharacter(actor):null)},[actor?.id,data?.revision]);
 const change=(field:keyof Draft,value:string)=>setDraft(d=>d?{...d,[field]:value}:d);
 const save=async()=>{
  if(!data||!actor||!draft||saving)return;
  setSaving(true);setError('');setNotice('');
  try{
   const patch={
    mood:draft.mood,status:draft.status,where:draft.where,goal:draft.goal,
    role:draft.role,realm:draft.realm,roots:draft.roots,speech:draft.speech,plan:draft.plan,
    traits:draft.traits.split(/[、,，]/).map(x=>x.trim()).filter(Boolean),
    cultivationProgress:Number(draft.cultivationProgress),
    relationship:{favor:Number(draft.favor),trust:Number(draft.trust),respect:Number(draft.respect)},
    ...(draft.privateNote.trim()?{privateNote:draft.privateNote.trim()}:{})
   };
   const res=await fetch('/api/v3/world',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({op:'edit-character',world:worldId,revision:data.revision,actor:actor.id,patch,note:'由開發者面板編輯'})});
   const result=await res.json() as {error?:string;developer?:DeveloperData;world?:WorldView};
   if(!res.ok)throw Error(result.error||'儲存失敗');
   if(!result.developer||!result.world)throw Error('儲存回應格式錯誤');
   setData(result.developer);
   onWorldChange(result.world);
   setNotice('人物設定已存入 D1，並留下修改紀錄。');
  }catch(e){setError(e instanceof Error?e.message:'儲存失敗')}
  finally{setSaving(false)}
 };
 return <section className="v3-panel v3-dev-panel" aria-label="開發者人物管理">
  <h3>開發者管理 · 世界人物與記憶</h3>
  <p>人物內在狀態與知情屬於私密 GM 資訊，只有伺服器授權的開發者可查看及修改。</p>
  {loading&&<p>正在從 D1 讀取世界資料……</p>}
  {error&&<p className="v3-error" role="alert">{error}</p>}
  {notice&&<p className="v3-success">{notice}</p>}
  {!!data?.gmMemories?.length&&<details className="v3-dev-dossier">
   <summary>GM 事件記憶與知情範圍（{data.gmMemories.length} 筆）</summary>
   {data.gmMemories.slice(-30).reverse().map(memory=><p key={memory.id} className="v3-memory-item">
    第{memory.day}日 · {memory.playerKnown?'洛河可知':'幕後記憶'}：{memory.text}<br/>
    知情人物：{memory.knownBy.map(id=>data.characters[id]?.name||id).join('、')||'無'}
   </p>)}
  </details>}
  {data?.protagonist&&<details className="v3-dev-dossier" open>
    <summary>洛河 · 玩家主角資料（自由角色扮演）</summary>
    <p>{data.protagonist.name}，{data.protagonist.gender||'女'}，{data.protagonist.age}歲，來自{data.protagonist.hometown||'青石鎮'}</p>
    <p><strong>目前境界：</strong>{data.protagonist.realm}；<strong>靈根：</strong>{data.protagonist.spiritualRoot}；<strong>資質：</strong>{data.protagonist.aptitude?.grade||'未知'}</p>
    <p><strong>家人：</strong>{data.protagonist.family?.join('；')}</p>
    <p>洛河的思想、性格發展與重大決定由玩家控制，原型設定不限制玩家自由演出。</p>
   </details>}
  {data&&<div className="v3-dev-grid">
   <aside className="v3-dev-actors" aria-label="依勢力、山峰與職級分類的人物名錄">
    <div className="v3-dev-directory-tools">
     <label htmlFor="v3-character-search">搜尋人物／山峰／境界／資質</label>
     <input id="v3-character-search" type="search" value={characterSearch}
      onChange={e=>{setCharacterSearch(e.target.value);setOpenedGroups({})}}
      placeholder="例如：沈滄月、築基、棲風峰"
      aria-label="搜尋人物姓名、宗門、境界、靈根與資質"/>
     <p aria-live="polite">第 {data.day} 日 · 顯示 {matchedCharacters}／{totalCharacters} 位 NPC</p>
    </div>
    {directory.length===0?<p className="v3-dev-empty">找不到符合條件的人物，請嘗試其他關鍵字。</p>
    :directory.map(faction=><details key={faction.id+(characterSearch.trim()?':search':'')} 
      className="v3-dev-faction"
      open={openedGroups[faction.id]??(faction.id==='taixu'||Boolean(characterSearch.trim()))}
      onToggle={e=>{const expanded=e.currentTarget.open;setOpenedGroups(prev=>
       prev[faction.id]===expanded?prev:{...prev,[faction.id]:expanded})}}>
      <summary>{faction.name}<span>{faction.count} 人</span></summary>
      <div className="v3-dev-peaks">
       {faction.sections.map(section=><details key={section.id+(characterSearch.trim()?':search':'')}
        className="v3-dev-peak"
        open={openedGroups[faction.id+':'+section.id]??(
         Boolean(characterSearch.trim())||section.id==='山門'||section.id==='棲風峰')}
        onToggle={e=>{const expanded=e.currentTarget.open;const key=faction.id+':'+section.id;
         setOpenedGroups(prev=>prev[key]===expanded?prev:{...prev,[key]:expanded})}}>
        <summary>{section.name}<span>{section.count}</span></summary>
        <div className="v3-dev-rank-groups">
         {section.ranks.map(rank=><div className="v3-dev-rank" key={rank.id}>
          <h5>{rank.name} · {rank.people.length}</h5>
          {rank.people.map(c=><button type="button" key={c.id}
           aria-pressed={selected===c.id}
           className={selected===c.id?'v3-dev-active':''}
           onClick={()=>setSelected(c.id)}>
           <strong>{c.name}</strong>
           <small>{c.realm} · 資質{c.aptitude?.grade||'未知'}</small>
           <small>{c.role}</small>
          </button>)}
         </div>)}
        </div>
       </details>)}
      </div>
     </details>)}
   </aside>
   <div className="v3-dev-details">
    {!actor||!draft?<p>請選擇人物。</p>:<>
     <h4>{actor.name} <span className="v3-dev-muted">#{actor.id}</span></h4>
     {!data.gmManaged&&data.npcAgency?.agendas[actor.id]&&<div className="v3-dev-dossier" style={{padding:'12px 16px',marginBottom:16}}>
      <strong>NPC 自主行動 · 當前日程</strong>
      <p><strong>目前工作：</strong>{data.npcAgency.agendas[actor.id].title}</p>
      <p><strong>所在位置：</strong>{data.npcAgency.agendas[actor.id].location} · <strong>行動狀態：</strong>{data.npcAgency.agendas[actor.id].status}</p>
      <p><strong>開始時間：</strong>第 {Math.floor(data.npcAgency.agendas[actor.id].start/1440)+1} 日 {String(Math.floor(data.npcAgency.agendas[actor.id].start%1440/60)).padStart(2,'0')}:{String(data.npcAgency.agendas[actor.id].start%60).padStart(2,'0')}</p>
      <p><strong>預定完成：</strong>第 {Math.floor(data.npcAgency.agendas[actor.id].end/1440)+1} 日 {String(Math.floor(data.npcAgency.agendas[actor.id].end%1440/60)).padStart(2,'0')}:{String(data.npcAgency.agendas[actor.id].end%60).padStart(2,'0')}</p>
      {data.npcAgency.agendas[actor.id].summary&&<p>{data.npcAgency.agendas[actor.id].summary}</p>}
      <p>幕後日程是私人 GM 資訊，不能讓洛河或不知情的 NPC 自動得知。</p>
     </div>}
     <p><strong>人物核心資料與日常狀態</strong> — 資質、境界、靈根及人格分開記錄；新增設定附有來源標註。下方可編輯的欄位不會重寫人物聖經。</p>
     <details className="v3-dev-dossier" open>
      <summary>人物設定與修煉資質</summary>
      <p><strong>所屬：</strong>{actor.peak||'未明'} · <strong>資質：</strong>{actor.aptitude?.grade||'未知'} · <strong>年齡：</strong>{actor.age??'未公開'}</p>
      <p><strong>資質評估：</strong>{actor.aptitude?.description||'暫無評估'}</p>
      <p><strong>修行瓶頸：</strong>{actor.aptitude?.bottleneck||'未詳'} · <strong>成長方式：</strong>{actor.aptitude?.growth||'未詳'}</p>
      <p><strong>人物核心：</strong>{actor.personality||actor.traits.join('、')}</p>
      <p><strong>性格弱點：</strong>{actor.flaw||'尚未定義'}</p>
      <p><strong>戰鬥／專長：</strong>{actor.methods?.join('、')||'未詳'}</p>
      <p><strong>過往與背景：</strong>{actor.background||'未詳'}</p>
      <p><strong>人際關係：</strong>{actor.ties?.join('；')||'尚未記錄'}</p>
      <p><strong>GM 才知道的角色內在：</strong>{actor.privateLore||'尚無'}</p>
      <p><strong>人物原型：</strong>{actor.source==='expanded'?'本次新增':'沿用過去太虛宗世界線'}；
       <strong>境界來源：</strong>{actor.fieldSources?.realm==='expanded'?'新增補充':'既定設定'}；
       <strong>靈根來源：</strong>{actor.fieldSources?.roots==='established'?'既定設定':actor.fieldSources?.roots==='unknown'?'尚未公開':'新設定'}；
       <strong>資質來源：</strong>新增推定，非現階段公開測定</p>
     </details>
     <div className="v3-dev-edit-grid">
      <label>身分／職責<input value={draft.role} maxLength={80} onChange={e=>change('role',e.target.value)}/></label>
      <label>境界<input value={draft.realm} maxLength={40} onChange={e=>change('realm',e.target.value)}/></label>
      <label>靈根<input value={draft.roots} maxLength={50} onChange={e=>change('roots',e.target.value)}/></label>
      <label className="v3-dev-wide">人格特質（以頓號分隔）<input value={draft.traits} onChange={e=>change('traits',e.target.value)}/></label>
      <label className="v3-dev-wide">說話風格<input value={draft.speech} maxLength={180} onChange={e=>change('speech',e.target.value)}/></label>
      <label className="v3-dev-wide">日常行程<input value={draft.plan} maxLength={180} onChange={e=>change('plan',e.target.value)}/></label>
      <label>情緒<select value={draft.mood} onChange={e=>change('mood',e.target.value)}>
       {moods.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>身體狀態<select value={draft.status} onChange={e=>change('status',e.target.value)}>
       {conditions.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>修煉進度（0–100）<input type="number" min={0} max={100} value={draft.cultivationProgress} onChange={e=>change('cultivationProgress',e.target.value)}/></label>
      <label>所在位置<input value={draft.where} maxLength={70} onChange={e=>change('where',e.target.value)}/></label>
      <label className="v3-dev-wide">目前目標<input value={draft.goal} maxLength={180} onChange={e=>change('goal',e.target.value)}/></label>
      <label>對洛河好感（-100 至 100）<input type="number" min={-100} max={100} value={draft.favor} onChange={e=>change('favor',e.target.value)}/></label>
      <label>信任（-100 至 100）<input type="number" min={-100} max={100} value={draft.trust} onChange={e=>change('trust',e.target.value)}/></label>
      <label>尊重（-100 至 100）<input type="number" min={-100} max={100} value={draft.respect} onChange={e=>change('respect',e.target.value)}/></label>
      <label className="v3-dev-wide">新增 GM 私密備註（選填）
       <textarea rows={2} maxLength={240} value={draft.privateNote} onChange={e=>change('privateNote',e.target.value)} placeholder="僅開發者與 GM 可見；不會被當成其他 NPC 已知情報"/>
      </label>
     </div>
     <button onClick={()=>void save()} disabled={saving||loading}>{saving?'正在保存……':'保存人物設定'}</button>
     <div className="v3-dev-memory">
      <h4>長期記憶 <span className="v3-dev-muted">{actor.memories.length} 筆</span></h4>
      {actor.memories.length?actor.memories.slice(-25).reverse().map(m=><div key={m.id} className="v3-memory-item">
       <small>第 {m.day} 日 · {m.kind} · {m.eventId}</small><p>{m.text}</p>
      </div>):<p>尚無親歷紀錄。人物不會自動知道其他地方發生的事。</p>}
      <h4>GM 私密備註 <span className="v3-dev-muted">{actor.privateNotes.length} 筆</span></h4>
      {actor.privateNotes.map((n,i)=><p key={i} className="v3-memory-item">{n}</p>)}
     </div>
    </>}
   </div>
  </div>}
  {data?.worldBible&&<details className="v3-dev-audit v3-dev-dossier">
    <summary>九州世界聖經 · {data.worldBible.title} · 第 {data.bibleVersion??1} 版</summary>
    <p><strong>修煉境界：</strong>{data.worldBible.cultivation?.realmOrder.join(' → ')}</p>
    <p><strong>太虛宗十二峰：</strong></p>
    {data.worldBible.sect?.peaks.map(p=><p key={p.name}>{p.name} · {p.domain} · 主事：{p.leader} {p.source==='expanded'?'（新增）':''}</p>)}
    <p><strong>收徒規則：</strong>{data.worldBible.sect?.recruitment.steps.join(' → ')}</p>
    <p><strong>九州勢力：</strong>{data.worldBible.factions?.map(f=>f.name+'／'+f.region).join('、')}</p>
   </details>}
  {data&&<details className="v3-dev-audit"><summary>世界事件與修改紀錄</summary>
   {data.events.slice(-10).reverse().map((e,i)=><p key={e.id||i}>事件 {e.id||i} · {e.witnesses?.join('、')||'無已確認旁聽者'}：{e.text}</p>)}
   {data.audit.slice(-10).reverse().map((e,i)=><p key={i}>版本 {e.revision} · {e.actorId} · 修改 {e.fields.join('、')}</p>)}
  </details>}
 </section>;
}
