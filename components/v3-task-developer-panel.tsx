'use client';
import {useEffect,useMemo,useState} from 'react';

type Stage={id:string;at:number;title:string;detail:string};
type Schedule={id:string;name:string;type:string;location:string;start:number;end:number;
 participants:string[];public:boolean;state:string;completed:string[];
 stages:Stage[];source?:string;origin?:string;templateId?:string;cycle?:number;repeatYears?:number;description?:string;cancelledAt?:number};
type Arc={id:string;name:string;truth:string;status:string;participants:string[];
 beats:{id:string;at:number;summary:string;witnesses:string[]}[];completed:string[]};
type DeveloperData={world:string;revision:number;day:number;minute:number;
 eventCalendar:{epoch:string;events:Schedule[]};livingArcs:Arc[];
 eventTemplates?:{id:string;name:string;intervalYears:number;note:string}[];gameYearDays?:number;
 characters:Record<string,{name:string}>;error?:string};
type WorldView={id:string;revision:number;day:number;minute:number;location:string;
 messages:{role:'user'|'assistant';content:string}[]};
const stamp=(n:number)=>'第 '+(Math.floor(n/1440)+1)+' 日 '+String(Math.floor(n%1440/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
type NewDraft={name:string;type:string;location:string;start:string;end:string;
 participants:string;beginTitle:string;endTitle:string;beginDetail:string;endDetail:string;public:boolean};
const makeDraft=(now:number):NewDraft=>({
 name:'',type:'任務',location:'太虛宗山門',start:String(now+30),end:String(now+180),
 participants:'',beginTitle:'事件開始',endTitle:'事件期限',beginDetail:'',endDetail:'',public:false
});
export default function V3TaskDeveloperPanel({worldId,revision,onWorldChange}:{
 worldId:string;revision:number;onWorldChange:(world:WorldView)=>void
}){
 const [data,setData]=useState<DeveloperData|null>(null);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [search,setSearch]=useState(''),[status,setStatus]=useState('全部');
 const [originFilter,setOriginFilter]=useState('全部來源');
 const [selected,setSelected]=useState<string>('');
 const [createOpen,setCreateOpen]=useState(false);
 const [draft,setDraft]=useState<NewDraft>(()=>makeDraft(480));
 useEffect(()=>{
  if(!worldId)return;
  const controller=new AbortController();
  setLoading(true);setError('');
  fetch('/api/v3/world?world='+encodeURIComponent(worldId)+'&view=developer',
   {cache:'no-store',signal:controller.signal})
   .then(async r=>{const v=await r.json() as DeveloperData;if(!r.ok)throw Error(v.error||'無法讀取任務');
    if(!v.eventCalendar||!Array.isArray(v.livingArcs))throw Error('任務管理資料不完整');return v;})
   .then(v=>{if(!controller.signal.aborted){setData(v);
    setDraft(d=>d.name?d:makeDraft((v.day-1)*1440+v.minute));}})
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'無法讀取任務')})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[worldId,revision]);
 const events=data?.eventCalendar.events||[];
 const all=useMemo(()=>[
  ...events.map(e=>({...e,kind:'scheduled' as const})),
  ...(data?.livingArcs||[]).map(a=>({
   id:a.id,name:a.name,type:'幕後事件',location:'幕後',start:a.beats[0]?.at??0,end:a.beats.at(-1)?.at??0,
   participants:a.participants,public:false,state:a.status,completed:a.completed,
   stages:a.beats.map(b=>({id:b.id,at:b.at,title:b.summary,detail:'知情者：'+b.witnesses.map(id=>data?.characters[id]?.name||id).join('、')})),
   source:'living-world',kind:'arc' as const,truth:a.truth
  }))
 ],[events,data?.livingArcs,data?.characters]);
 const sourceLabel=(e:typeof all[number])=>e.kind==='arc'?'幕後事件':
  e.origin==='builtin'||e.source==='宗門預定日程'||e.source==='預設任務'?'預設任務':
  e.origin==='ai'||e.source==='GM新事件排程'?'AI 新增任務':
  e.origin==='developer'||e.source==='開發者新增任務'?'開發者任務':'其他事件';
 const filtered=all.filter(e=>(originFilter==='全部來源'||sourceLabel(e)===originFilter)&&
  (status==='全部'||e.state===status)&&
  (!search.trim()||(e.name+' '+e.id+' '+e.type+' '+e.location).includes(search.trim())));
 const active=all.find(e=>e.id===selected)||filtered[0];
 const now=data?(data.day-1)*1440+data.minute:480;
 async function submit(action:'create'|'cancel',task:object){
  if(!data||saving)return;
  setSaving(true);setNotice('');setError('');
  try{
   const res=await fetch('/api/v3/world',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({op:'manage-task',world:worldId,revision:data.revision,action,task})});
   const result=await res.json() as {error?:string;developer?:DeveloperData;world?:WorldView};
   if(!res.ok)throw Error(result.error||'任務操作失敗');
   if(!result.developer||!result.world)throw Error('資料格式錯誤');
   setData(result.developer);onWorldChange(result.world);
   if(action==='create'){setCreateOpen(false);setDraft(makeDraft((result.world.day-1)*1440+result.world.minute));}
   setNotice(action==='create'?'任務時間表已建立並存入 D1。':'任務已取消，並留下開發者操作紀錄。');
  }catch(e){setError(e instanceof Error?e.message:'儲存任務失敗')}
  finally{setSaving(false)}
 }
 function create(){
  const start=Number(draft.start),end=Number(draft.end);
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<now||end<=start){
   setError('時間使用「自第 1 日 00:00 起算的分鐘」，開始不可早於現在，結束必須晚於開始。');return;
  }
  const safeId='dev-'+String(Date.now()); // unique developer-created calendar ID
  const task={
   id:safeId,name:draft.name.trim(),type:draft.type,location:draft.location.trim(),
   start,end,public:draft.public,
   participants:draft.participants.split(/[,，、\s]+/).filter(Boolean),
   stages:[
    {id:'start',at:start,title:draft.beginTitle.trim(),detail:draft.beginDetail.trim()||'按計畫開始事件'},
    {id:'end',at:end,title:draft.endTitle.trim(),detail:draft.endDetail.trim()||'進入期限或收尾階段'}
   ]
  };
  void submit('create',task);
 }
 return <section className="v3-panel v3-dev-panel v3-task-admin" aria-label="開發者任務管理">
  <h3>開發者管理 · 任務與世界事件</h3>
  <p>這裡可以檢視正式活動、幕後事件、每個時間節點與參與角色；隱藏資訊不會送往玩家畫面。時間以遊戲世界為準。</p>
  {loading&&<p>正在讀取事件與世界日程……</p>}
  {error&&<p className="v3-error" role="alert">{error}</p>}
  {notice&&<p className="v3-success">{notice}</p>}
  {data&&<>
   <div className="v3-dev-dossier v3-task-templates">
    <strong>世界預設週期活動（{data.eventTemplates?.length??0} 類）</strong>
    <p>遊戲年暫訂 {data.gameYearDays??365} 日。收徒三年一次；論道、出峰歷練每年有固定活動窗口。玩家不參加也不會停止日程。</p>
    {data.eventTemplates?.map(template=><p key={template.id}><strong>{template.name}</strong> · 每 {template.intervalYears} 年一次 · {template.note}</p>)}
   </div>
   <div className="v3-task-overview">
    <div><small>目前遊戲時間</small><strong>{stamp(now)}</strong></div>
    <div><small>排定活動／任務</small><strong>{events.length}</strong></div>
    <div><small>幕後事件線</small><strong>{data.livingArcs.length}</strong></div>
    <div><small>進行中／進行中幕後</small><strong>{all.filter(e=>['active','進行中'].includes(e.state)).length}</strong></div>
   </div>
   <div className="v3-task-toolbar">
    <input type="search" aria-label="搜尋任務" placeholder="搜尋任務名稱、地點或 ID" value={search} onChange={e=>setSearch(e.target.value)}/>
    <select aria-label="依任務來源篩選" value={originFilter} onChange={e=>setOriginFilter(e.target.value)}>
     {['全部來源','預設任務','AI 新增任務','開發者任務','幕後事件'].map(x=><option key={x}>{x}</option>)}
    </select>
    <select aria-label="依任務狀態篩選" value={status} onChange={e=>setStatus(e.target.value)}>
     {['全部','scheduled','active','completed','cancelled','未開始','進行中','已解決'].map(x=><option key={x} value={x}>{x==='scheduled'?'未開始':x==='active'?'進行中':x==='completed'?'已結束':x==='cancelled'?'已取消':x}</option>)}
    </select>
    <button type="button" onClick={()=>setCreateOpen(x=>!x)}>{createOpen?'收起新增任務':'+ 新增排程任務'}</button>
   </div>
   {createOpen&&<div className="v3-task-create">
    <h4>建立正式事件時間表</h4>
    <p>新事件需先確定起訖時間與階段，未來不會因 GM 敘事而任意改日期。此操作只供開發者使用。</p>
    <div className="v3-dev-edit-grid">
     <label>名稱<input maxLength={75} value={draft.name} onChange={e=>setDraft(x=>({...x,name:e.target.value}))} placeholder="例如：外門入門考核"/></label>
     <label>類別<select value={draft.type} onChange={e=>setDraft(x=>({...x,type:e.target.value}))}>
      {['任務','宗門活動','委託','約定','突發事件','NPC計畫'].map(x=><option key={x}>{x}</option>)}</select></label>
     <label>地點<input maxLength={80} value={draft.location} onChange={e=>setDraft(x=>({...x,location:e.target.value}))}/></label>
     <label>參與 NPC ID（逗號分隔，可留空）<input value={draft.participants} onChange={e=>setDraft(x=>({...x,participants:e.target.value}))} placeholder="registrar, guide"/></label>
     <label>開始時間（絕對分鐘）<input type="number" min={now} value={draft.start} onChange={e=>setDraft(x=>({...x,start:e.target.value}))}/><small>{Number.isFinite(Number(draft.start))?stamp(Math.max(0,Number(draft.start))):'請輸入分鐘'}</small></label>
     <label>結束時間（絕對分鐘）<input type="number" min={now+1} value={draft.end} onChange={e=>setDraft(x=>({...x,end:e.target.value}))}/><small>{Number.isFinite(Number(draft.end))?stamp(Math.max(0,Number(draft.end))):'請輸入分鐘'}</small></label>
     <label>第一階段<input maxLength={110} value={draft.beginTitle} onChange={e=>setDraft(x=>({...x,beginTitle:e.target.value}))}/></label>
     <label>最後階段<input maxLength={110} value={draft.endTitle} onChange={e=>setDraft(x=>({...x,endTitle:e.target.value}))}/></label>
     <label className="v3-dev-wide">開始時發生什麼<input maxLength={250} value={draft.beginDetail} onChange={e=>setDraft(x=>({...x,beginDetail:e.target.value}))}/></label>
     <label className="v3-dev-wide">截止時發生什麼<input maxLength={250} value={draft.endDetail} onChange={e=>setDraft(x=>({...x,endDetail:e.target.value}))}/></label>
    </div>
    <label className="v3-task-public"><input type="checkbox" checked={draft.public} onChange={e=>setDraft(x=>({...x,public:e.target.checked}))}/>公開事件標記（不代表玩家立即得知詳情）</label>
    <button type="button" disabled={saving||!draft.name.trim()} onClick={create}>{saving?'儲存中……':'建立時間表'}</button>
   </div>}
   <div className="v3-task-grid">
    <aside className="v3-task-list" aria-label="任務與事件列表">
     {filtered.length===0?<p className="v3-dev-empty">沒有符合篩選條件的事件。</p>:
      filtered.map(e=><button type="button" key={e.id} aria-pressed={active?.id===e.id}
       className={active?.id===e.id?'v3-dev-active':''} onClick={()=>setSelected(e.id)}>
       <strong>{e.name}</strong>
       <small>{sourceLabel(e)} · {e.state} · {e.stages.filter(s=>e.completed.includes(s.id)).length}/{e.stages.length} 階段</small>
       <small>{stamp(e.start)} → {stamp(e.end)}</small>
      </button>)}
    </aside>
    <div className="v3-task-detail">
     {!active?<p>請選擇一個任務或事件。</p>:<>
      <h4>{active.name}</h4>
      <p className="v3-dev-muted">#{active.id} · {sourceLabel(active)} · {active.type} · {active.state}</p>
      {'repeatYears' in active&&typeof active.repeatYears==='number'&&<p className="v3-dev-muted">每 {active.repeatYears} 年循環 · 第 {active.cycle??1} 期 · 每年暫按 {data.gameYearDays??365} 遊戲日計算</p>}
      {'description' in active&&active.description&&<p>{active.description}</p>}
      <div className="v3-task-facts">
       <p><strong>所在地：</strong>{active.location}</p>
       <p><strong>開始：</strong>{stamp(active.start)}</p>
       <p><strong>結束：</strong>{stamp(active.end)}</p>
       <p><strong>來源：</strong>{active.source||'未標記'}</p>
       <p><strong>參與者：</strong>{active.participants.map(id=>data.characters[id]?.name||id).join('、')||'尚無指定人物'}</p>
       <p><strong>是否標記公開：</strong>{active.public?'是':'否（GM／開發者資料）'}</p>
      </div>
      {'truth' in active&&typeof active.truth==='string'&&<div className="v3-task-secret"><strong>幕後真相（僅開發者）</strong><p>{active.truth}</p></div>}
      <h4>事件階段與進度</h4>
      <div className="v3-task-stages">
       {active.stages.map(stage=><div key={stage.id} className="v3-task-stage">
        <span className={active.completed.includes(stage.id)?'v3-task-finished':'v3-task-pending'}>
         {active.completed.includes(stage.id)?'✓ 已發生':'◷ 未到／未完成'}
        </span>
        <strong>{stamp(stage.at)} · {stage.title}</strong>
        <p>{stage.detail}</p>
       </div>)}
      </div>
      {active.kind==='scheduled'&&sourceLabel(active)!=='預設任務'&&['scheduled','active'].includes(active.state)&&
       <button type="button" className="v3-danger-btn" disabled={saving}
        onClick={()=>{if(confirm('確定取消「'+active.name+'」？會留下稽核紀錄，不刪除歷史。'))void submit('cancel',{id:active.id})}}>
        取消此事件
       </button>}
      {active.kind==='arc'&&<p className="v3-dev-muted">此為現有幕後事件線，由世界模擬器控制，不可從任務面板直接取消。</p>}
     </>}
    </div>
   </div>
  </>}
 </section>;
}
