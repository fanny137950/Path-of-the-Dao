'use client';
import {useEffect,useState} from 'react';

type Memory={id:string;eventId:string;kind:string;day:number;minute:number;text:string;source:string};
type Character={
 id:string;name:string;role:string;realm:string;roots:string;where:string;goal:string;
 traits:string[];speech:string;plan:string;mood:string;status:string;cultivationProgress:number;
 relationships:{player:{favor:number;trust:number;respect:number;impression?:string}};
 memories:Memory[];privateNotes:string[];knowledge:string[];
};
type DeveloperData={
 revision:number;world:string;day:number;minute:number;location:string;
 characters:Record<string,Character>;
 events:{id?:string;text:string;reply:string;witnesses?:string[]}[];
 audit:{revision:number;actorId:string;fields:string[];by:string;note?:string}[];
};
type WorldView={id:string;revision:number;day:number;minute:number;location:string;messages:{role:'user'|'assistant';content:string}[]};
const moods=['平靜','愉快','好奇','警惕','不悅','憤怒','擔憂','疲憊','悲傷','緊張'];
const conditions=['健康','輕傷','受傷','重傷','休養'];
type Draft={mood:string;status:string;where:string;goal:string;cultivationProgress:string;favor:string;trust:string;respect:string;privateNote:string};
function fromCharacter(c:Character):Draft{
 return {mood:c.mood,status:c.status,where:c.where,goal:c.goal,
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
 const [draft,setDraft]=useState<Draft|null>(null);
 const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);
 useEffect(()=>{
  if(!worldId)return;
  const abort=new AbortController();
  setLoading(true);setError('');
  fetch('/api/v3/world?world='+encodeURIComponent(worldId)+'&view=developer',{cache:'no-store',signal:abort.signal})
   .then(async res=>{
    const data=await res.json();
    if(!res.ok)throw Error(data.error||'無法載入開發者資訊');
    return data as DeveloperData;
   }).then(value=>{if(!abort.signal.aborted)setData(value)})
   .catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'讀取失敗')})
   .finally(()=>{if(!abort.signal.aborted)setLoading(false)});
  return()=>abort.abort();
 },[worldId,revision]);
 const actor=data?.characters[selected]||null;
 useEffect(()=>{setDraft(actor?fromCharacter(actor):null)},[actor?.id,data?.revision]);
 const change=(field:keyof Draft,value:string)=>setDraft(d=>d?{...d,[field]:value}:d);
 const save=async()=>{
  if(!data||!actor||!draft||saving)return;
  setSaving(true);setError('');setNotice('');
  try{
   const patch={
    mood:draft.mood,status:draft.status,where:draft.where,goal:draft.goal,
    cultivationProgress:Number(draft.cultivationProgress),
    relationship:{favor:Number(draft.favor),trust:Number(draft.trust),respect:Number(draft.respect)},
    ...(draft.privateNote.trim()?{privateNote:draft.privateNote.trim()}:{})
   };
   const res=await fetch('/api/v3/world',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({op:'edit-character',world:worldId,revision:data.revision,actor:actor.id,patch,note:'由開發者面板編輯'})});
   const result=await res.json();
   if(!res.ok)throw Error(result.error||'儲存失敗');
   setData(result.developer as DeveloperData);
   onWorldChange(result.world as WorldView);
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
  {data&&<div className="v3-dev-grid">
   <aside className="v3-dev-actors">
    <p>第 {data.day} 日 · 回合／版本 {data.revision}</p>
    {Object.values(data.characters).map(c=><button key={c.id} className={selected===c.id?'v3-dev-active':''} onClick={()=>setSelected(c.id)}>
     <strong>{c.name}</strong><small>{c.realm} · {c.mood}</small>
    </button>)}
   </aside>
   <div className="v3-dev-details">
    {!actor||!draft?<p>請選擇人物。</p>:<>
     <h4>{actor.name} <span className="v3-dev-muted">#{actor.id}</span></h4>
     <p><strong>身分：</strong>{actor.role}　<strong>靈根：</strong>{actor.roots}</p>
     <p><strong>境界：</strong>{actor.realm}　<strong>日常計畫：</strong>{actor.plan}</p>
     <p><strong>人格：</strong>{actor.traits.join('、')}</p>
     <p><strong>說話風格：</strong>{actor.speech}</p>
     <div className="v3-dev-edit-grid">
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
  {data&&<details className="v3-dev-audit"><summary>世界事件與修改紀錄</summary>
   {data.events.slice(-10).reverse().map((e,i)=><p key={e.id||i}>事件 {e.id||i} · {e.witnesses?.join('、')||'無已確認旁聽者'}：{e.text}</p>)}
   {data.audit.slice(-10).reverse().map((e,i)=><p key={i}>版本 {e.revision} · {e.actorId} · 修改 {e.fields.join('、')}</p>)}
  </details>}
 </section>;
}
