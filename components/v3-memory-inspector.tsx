'use client';
import {useEffect,useState} from 'react';
type Thread={id:string;title:string;summary:string;truth:string;status:string;revision:number;dueAt:number|null;playerKnown:boolean;participants:string[];truthKnownBy?:string[]};
type Data={revision:number;memorySystem:{working:{summary:string}|null;threads:Thread[]};gmMemories:{id:string;text:string;kind?:string;interpretation?:string;knownBy:string[];playerKnown:boolean}[];characters:Record<string,{name:string}>;error?:string};
type Entry={id:string;revision:number;text:string;reply:string;source:string;rawAnswer:string;changes:unknown[];records:unknown};
type WorldView={id:string;revision:number;day:number;minute:number;location:string;messages:{role:'user'|'assistant';content:string}[]};
export default function V3MemoryInspector({worldId,revision,onWorldChange}:{worldId:string;revision:number;onWorldChange:(world:WorldView)=>void}){
 const [data,setData]=useState<Data|null>(null),[entries,setEntries]=useState<Entry[]>([]);
 const [target,setTarget]=useState(''),[draft,setDraft]=useState({summary:'',truth:'',status:'open',note:''});
 const [query,setQuery]=useState(''),[applied,setApplied]=useState(''),[before,setBefore]=useState<number|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{const abort=new AbortController();
  setData(null);setTarget('');setError('');setEntries([]);setBefore(null);setApplied('');
  fetch('/api/v3/world?world='+encodeURIComponent(worldId)+'&view=developer',{cache:'no-store',signal:abort.signal}).then(async r=>{const d=await r.json() as Data;if(!r.ok)throw Error(d.error||'無法讀取記憶');return d;}).then(d=>{if(!abort.signal.aborted)setData(d)}).catch(e=>{if(!abort.signal.aborted)setError(e.message)});
  return()=>abort.abort();
 },[worldId,revision]);
 async function search(older=false){setBusy(true);setError('');try{
  const q=older?applied:query;
  const res=await fetch('/api/v3/world?'+new URLSearchParams({world:worldId,view:'history',q,...(older&&before?{before:String(before)}:{})}),{cache:'no-store'});
  const d=await res.json() as {entries:Entry[];nextBefore:number|null;error?:string};if(!res.ok)throw Error(d.error||'無法讀取歷史');
  setEntries(old=>older?[...old,...d.entries]:d.entries);setBefore(d.nextBefore);setApplied(q);
 }catch(e){setError(e instanceof Error?e.message:'無法讀取歷史')}finally{setBusy(false)}}
 async function correct(){if(!target||busy)return;setBusy(true);setError('');try{
  const patch=target==='working'?{summary:draft.summary}:{summary:draft.summary,truth:draft.truth,status:draft.status};
  const r=await fetch('/api/v3/world',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'edit-memory',world:worldId,revision,target,patch,note:draft.note})});
  const d=await r.json() as {world:WorldView;error?:string};if(!r.ok)throw Error(d.error||'修正失敗');setTarget('');onWorldChange(d.world);
 }catch(e){setError(e instanceof Error?e.message:'修正失敗')}finally{setBusy(false)}}
 const names=(ids:string[])=>ids.map(id=>data?.characters[id]?.name||id).join('、')||'無';
 const threads=[...new Map((data?.memorySystem.threads||[]).map(t=>[t.id,t])).values()];
 return <section className="v3-memory-inspector" aria-label="世界記憶後台"><p className="v3-setting-help">含幕後資訊。這裡是存檔持有者的檢查工具，NPC 不會因此得知秘密。</p>
  <a className="v3-export" href={'/api/v3/world?world='+encodeURIComponent(worldId)+'&view=export'} download>下載完整存檔（含秘密與原始紀錄）</a>
  {error&&<p role="alert" className="v3-error">{error}</p>}
  {!data?<p>正在整理記憶……</p>:<>
   <div className="v3-layer-cards"><div><small>L0 · 固定規則</small><strong>世界設定與權限</strong></div><div><small>L1 · 工作記憶</small><strong>當前場景快照</strong></div><div><small>L2 · 角色記憶</small><strong>{data.gmMemories.length} 筆 GM 紀錄</strong></div><div><small>L3 · 世界事件</small><strong>{threads.length} 條事件線</strong></div><div><small>L4 · 原始檔案</small><strong>回合與變更來源</strong></div></div>
   <details open><summary>目前工作記憶 · L1</summary><pre>{JSON.stringify(data.memorySystem.working,null,2)||'尚無新回合；GM 會先讀最近對話原文。'}</pre></details>
   <details><summary>角色如何記得 · L2</summary>{data.gmMemories.slice(-40).reverse().map(m=><article key={m.id}><strong>{m.kind||'fact'} · {m.playerKnown?'洛河已知':'幕後'}</strong><p>{m.text}</p>{m.interpretation&&<p>角色理解：{m.interpretation}</p>}<small>知情者：{names(m.knownBy)}</small></article>)}{!data.gmMemories.length&&<p>尚無結構化角色記憶。人物檔案保留既有紀錄。</p>}</details>
   <details open><summary>世界正在發生什麼 · L3</summary>{threads.map(t=><article key={t.id}><strong>{t.title} · {t.status}</strong><p>{t.summary}</p><p>幕後真相：{t.truth||'尚無記錄'}</p><small>參與者：{names(t.participants)} · 真相知情者：{names(t.truthKnownBy||[])}<br/>來源：版本 {t.revision} · {t.playerKnown?'洛河已知':'洛河未知'}{t.dueAt!==null?' · 待推演時間：第 '+(Math.floor(t.dueAt/1440)+1)+' 日 '+Math.floor(t.dueAt%1440/60)+':'+String(t.dueAt%60).padStart(2,'0'):''}</small></article>)}{!threads.length&&<p>尚無 GM 建立的事件線；舊存檔日程可在任務管理查看。</p>}</details>
  </>}
  {data&&<details><summary>修正目前記憶（保留原始歷史）</summary><label className="v3-field">修正項目<select value={target} disabled={busy} onChange={e=>{const id=e.target.value;setTarget(id);const t=threads.find(t=>t.id===id);setDraft({summary:id==='working'?data.memorySystem.working?.summary||'':t?.summary||'',truth:t?.truth||'',status:t?.status||'open',note:''})}}><option value="">請選擇</option>{data.memorySystem.working&&<option value="working">目前場景摘要</option>}{threads.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>{target&&<><label className="v3-field">摘要<textarea aria-label="摘要" maxLength={600} value={draft.summary} onChange={e=>setDraft({...draft,summary:e.target.value})}/></label>{target!=='working'&&<><label className="v3-field">幕後真相<textarea aria-label="幕後真相" maxLength={600} value={draft.truth} onChange={e=>setDraft({...draft,truth:e.target.value})}/></label><label className="v3-field">狀態<select aria-label="狀態" value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>{['open','blocked','resolved','failed'].map(x=><option key={x}>{x}</option>)}</select></label></>}<label className="v3-field">修正原因<input aria-label="修正原因" maxLength={300} value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/></label><button disabled={busy||!draft.note.trim()} onClick={()=>void correct()}>保存修正並留下紀錄</button></>}</details>}
  <h3>尋回原話 · L4</h3><form className="v3-history-search" onSubmit={e=>{e.preventDefault();void search()}}><input aria-label="搜尋對話原文" placeholder="人名、一句話，或留空查看最近回合" maxLength={120} value={query} onChange={e=>setQuery(e.target.value)}/><button disabled={busy}>{busy?'讀取中…':'搜尋紀錄'}</button></form>
  {entries.map(e=><details key={e.id}><summary>第 {e.revision} 次變化 · {e.text.slice(0,70)}</summary><p>{e.text}</p><div className="v3-history-prose">{e.reply}</div><details><summary>這一回合更新了什麼</summary><pre>{JSON.stringify({changes:e.changes,records:e.records},null,2)}</pre></details><details><summary>{e.source}</summary><pre>{e.rawAnswer}</pre></details></details>)}
  {before&&<button disabled={busy} onClick={()=>void search(true)}>讀取更早的紀錄</button>}
 </section>;
}
