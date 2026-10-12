'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowUp,ArrowDown,Plus,Settings2,PanelLeft,BookOpen,Sparkles,X,Copy,Check,LoaderCircle,ChevronRight} from 'lucide-react';
import StoryText from '../../components/v3-story-text';
import './v3.css';
import V3TaskDeveloperPanel from '../../components/v3-task-developer-panel';
import V3DeveloperPanel from '../../components/v3-developer-panel';
type Msg={role:'user'|'assistant';content:string};
type Mode='demo'|'ai'|'openrouter';
type Suggestion={label:string;text:string;kind?:'action'|'advance'};
type Quest={id:string;title:string;type:string;status:string;description:string;objective:string;progress:number;updatedDay:number};
type WorldView={journal?:Quest[];confirmedRequestId?:string|null;suggestions?:Suggestion[];id:string;revision:number;day:number;minute:number;location:string;messages:Msg[];usage?:{totalTokens?:number}|null;usedModel?:string;error?:string};
type WorldEntry={id:string;name:string;revision:number;created:string};
type Pending={op?:'turn'|'advance-time';advanceMinutes?:number;world:string;revision:number;requestId:string;text:string;mode:Mode;model:string};
const worldKey='wendao-v3-chat-first-world';
const pendingKey='wendao-v3-pending-turn';
const preferencesKey='wendao-v3-ai-preferences';
export default function V3(){
 const [messages,setMessages]=useState<Msg[]>([]);
 const [text,setText]=useState('');const [busy,setBusy]=useState(false);
 const [apiKey,setApiKey]=useState('');const [model,setModel]=useState('openrouter/free');
 const [settings,setSettings]=useState(false);const [dev,setDev]=useState(false);
 const [error,setError]=useState('');const [mode,setMode]=useState<Mode>('openrouter');
 const [connection,setConnection]=useState('');const [testing,setTesting]=useState(false);
 const [turn,setTurn]=useState(0);const [usage,setUsage]=useState<number|null>(null);
 const [usedModel,setUsedModel]=useState('');
 const [worldId,setWorldId]=useState('');const [worlds,setWorlds]=useState<WorldEntry[]>([]);
 const [loading,setLoading]=useState(true);const [day,setDay]=useState(1);const [minute,setMinute]=useState(480);
 const [location,setLocation]=useState('太虛宗山門');const [suggestions,setSuggestions]=useState<Suggestion[]>([]);
 const [journal,setJournal]=useState<Quest[]>([]);const [journalOpen,setJournalOpen]=useState(false);
 const [developerTab,setDeveloperTab]=useState<'people'|'tasks'>('people');const journalDialog=useRef<HTMLDialogElement>(null);
 const [sidebar,setSidebar]=useState(false);const [away,setAway]=useState(false);const [visibleCount,setVisibleCount]=useState(60);
 const [reading,setReading]=useState<'normal'|'large'>('normal');
 const [copied,setCopied]=useState<number|null>(null);const [elapsed,setElapsed]=useState(0);
 const timeline=useRef<HTMLDivElement>(null);const composer=useRef<HTMLTextAreaElement>(null);
 const settingsDialog=useRef<HTMLDialogElement>(null);const developerDialog=useRef<HTMLDialogElement>(null);
 const followLatest=useRef(true);const olderScroll=useRef<{height:number;top:number}|null>(null);
 const [pending,setPending]=useState<Pending|null>(null);
 const pendingRef=useRef<Pending|null>(null);const inFlight=useRef(false);
 const bottom=useRef<HTMLDivElement>(null);const initializationStarted=useRef(false);
 function rememberPending(value:Pending|null){
  // Request identity and player text survive a reload; credentials never enter storage.
  if(value)sessionStorage.setItem(pendingKey,JSON.stringify(value));
  else sessionStorage.removeItem(pendingKey);
  pendingRef.current=value;setPending(value);
 }
 function applyWorld(world:WorldView){
  if(!world.id||!Array.isArray(world.messages))throw Error('世界資料格式錯誤');
  setWorldId(world.id);setMessages(world.messages);setTurn(world.revision);
  setDay(world.day);setMinute(world.minute);setLocation(world.location);setSuggestions(world.suggestions||[]);setJournal(world.journal||[]);
  setUsage(typeof world.usage?.totalTokens==='number'?world.usage.totalTokens:null);
  if(typeof world.usedModel==='string')setUsedModel(world.usedModel);
  localStorage.setItem(worldKey,world.id);
 }
 async function listWorlds(){
  const res=await fetch('/api/v3/world',{cache:'no-store'});
  const data=await res.json() as {worlds:WorldEntry[];error?:string};
  if(!res.ok)throw Error(data.error||'無法取得世界列表');
  setWorlds(data.worlds);return data.worlds as WorldEntry[];
 }
 async function loadWorld(id:string){
  const waiting=pendingRef.current?.world===id?pendingRef.current:null;
  const res=await fetch('/api/v3/world?world='+encodeURIComponent(id)+(waiting?'&requestId='+encodeURIComponent(waiting.requestId):''),{cache:'no-store'});
  const data=await res.json() as WorldView;
  if(!res.ok)throw Error(data.error||'讀取世界失敗');
  applyWorld(data);
  if(waiting&&data.confirmedRequestId===waiting.requestId){rememberPending(null);setText('');setError('');}
 }
 async function createWorld(){
  const response=await fetch('/api/v3/world',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'new'})});
  const data=await response.json() as WorldView;
  if(!response.ok)throw Error(data.error||'建立世界失敗');
  applyWorld(data);await listWorlds();
 }
 useEffect(()=>{
  if(initializationStarted.current)return;
  initializationStarted.current=true;
  (async()=>{try{
   try{
    if(localStorage.getItem('wendao-v3-reading')==='large')setReading('large');
    const prefs=JSON.parse(localStorage.getItem(preferencesKey)||'null');
    if(prefs&&['demo','ai','openrouter'].includes(prefs.mode)&&typeof prefs.model==='string'){
     setMode(prefs.mode);setModel(prefs.model);
    }
    const saved=JSON.parse(sessionStorage.getItem(pendingKey)||'null');
    if(saved&&typeof saved.world==='string'&&typeof saved.requestId==='string'&&typeof saved.text==='string'&&Number.isInteger(saved.revision)&&['demo','ai','openrouter'].includes(saved.mode)&&typeof saved.model==='string'){
     rememberPending(saved);setText(saved.text);setMode(saved.mode);setModel(saved.model);
    }
   }catch{sessionStorage.removeItem(pendingKey);}
   const entries=await listWorlds();
   const id=pendingRef.current?.world||localStorage.getItem(worldKey);
   if(pendingRef.current&&!entries.some(w=>w.id===pendingRef.current?.world))throw Error('找不到待確認回合的世界，請確認登入帳號。');
   const existing=entries.find(w=>w.id===id)||entries[0];
   if(existing)await loadWorld(existing.id);
   else if(pendingRef.current)throw Error('找不到待確認回合的世界，請確認登入帳號。');
   else await createWorld();
  }catch(e){setError(e instanceof Error?e.message:'讀取世界失敗')}
  finally{setLoading(false)}})();
 },[]);
 useLayoutEffect(()=>{
  const box=timeline.current;if(!box)return;
  if(olderScroll.current){box.scrollTop=olderScroll.current.top+box.scrollHeight-olderScroll.current.height;olderScroll.current=null;}
  else if(followLatest.current){box.scrollTop=box.scrollHeight;setAway(false);}
 },[messages,pending,visibleCount,loading]);
 useEffect(()=>{
  if(!busy){setElapsed(0);return;}
  const started=Date.now();const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-started)/1000)),1000);
  return ()=>clearInterval(timer);
 },[busy]);
 useLayoutEffect(()=>{const field=composer.current;if(field){field.style.height='auto';field.style.height=Math.min(180,field.scrollHeight)+'px';}},[text]);
 useEffect(()=>{const modal=settingsDialog.current;if(settings&&!modal?.open)modal?.showModal();else if(!settings&&modal?.open)modal.close();},[settings]);
 useEffect(()=>{const modal=developerDialog.current;if(dev&&!modal?.open)modal?.showModal();else if(!dev&&modal?.open)modal.close();},[dev]);
 useEffect(()=>{const modal=journalDialog.current;if(journalOpen&&!modal?.open)modal?.showModal();else if(!journalOpen&&modal?.open)modal.close();},[journalOpen]);
 function jumpLatest(){followLatest.current=true;setAway(false);timeline.current?.scrollTo({top:timeline.current.scrollHeight,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 function chooseSuggestion(value:string){setText(value);composer.current?.focus();}
 async function copyMessage(value:string,index:number){try{await navigator.clipboard.writeText(value);setCopied(index);}catch{setError('無法複製，請選取文字手動複製。');}}
 function showOlder(){if(timeline.current)olderScroll.current={height:timeline.current.scrollHeight,top:timeline.current.scrollTop};setVisibleCount(n=>n+60);}

 function selectMode(next:Mode){
  const nextModel=next==='ai'?'gpt-4.1-mini':'openrouter/free';
  setMode(next);setModel(nextModel);setApiKey('');setConnection('');setUsedModel('');
  localStorage.setItem(preferencesKey,JSON.stringify({mode:next,model:nextModel}));
 }
 async function testConnection(){
  if(testing||busy||!apiKey.trim())return;
  setTesting(true);setConnection('正在確認所選模型的連線……');
  try{
   const res=await fetch('/api/v3/connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:apiKey.trim(),model:model.trim(),mode})});
   const data=await res.json() as {error?:string;model:string;sample:string};if(!res.ok)throw Error(data.error||'連線失敗');
   setConnection('連線成功 · '+data.model+'\n'+data.sample);
  }catch(e){setConnection(e instanceof Error?e.message:'連線失敗')}
  finally{setTesting(false)}
 }
 async function switchWorld(id:string){
  if(busy||loading||pending)return;
  setLoading(true);setError('');setText('');setSidebar(false);setVisibleCount(60);followLatest.current=true;
  try{await loadWorld(id)}catch(e){setError(e instanceof Error?e.message:'讀取失敗')}
  finally{setLoading(false)}
 }
 async function checkPending(){
  if(!pendingRef.current||busy||loading)return;
  setLoading(true);setError('');
  try{await loadWorld(pendingRef.current.world)}catch{setError('暫時無法確認存檔，請稍後再試。')}
  finally{setLoading(false)}
 }
 async function reset(){
  if(busy||loading||pending||!confirm('建立新的世界線？舊世界仍可從世界列表找回。'))return;
  setLoading(true);setError('');setText('');setSidebar(false);setVisibleCount(60);followLatest.current=true;
  try{await createWorld()}catch(e){setError(e instanceof Error?e.message:'建立世界失敗')}
  finally{setLoading(false)}
 }
 async function clearHistory(){
  if(busy||loading||pending)return;
  if(!window.confirm('將永久刪除目前帳號的所有 V3 世界線、對話、人物狀態及任務存檔。此操作無法復原，確定要繼續？'))return;
  const check=window.prompt('為防止誤刪，請輸入「刪除所有紀錄」進行確認：');
  if(check!=='刪除所有紀錄'){setError('沒有確認刪除，資料保持原樣。');return;}
  setLoading(true);setError('');
  try{
   const res=await fetch('/api/v3/world',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'delete-history',confirm:'DELETE_MY_V3_HISTORY'})});
   const data=await res.json() as {deleted?:number;error?:string};
   if(!res.ok)throw Error(data.error||'無法清除世界紀錄');
   rememberPending(null);localStorage.removeItem(worldKey);
   setMessages([]);setWorlds([]);setJournal([]);setSuggestions([]);setUsage(null);setUsedModel('');setWorldId('');
   setTurn(0);setText('');setVisibleCount(60);setSettings(false);setSidebar(false);setDev(false);
   await createWorld();
   setError('已清除 '+(data.deleted??0)+' 筆個人 V3 世界存檔，並建立全新世界。');
  }catch(e){setError(e instanceof Error?e.message:'清除紀錄失敗');}
  finally{setLoading(false);}
 }
 async function send(advanceMinutes?:number){
  const value=text.trim();if(inFlight.current||busy||testing||loading||!worldId||(!pendingRef.current&&!value&&!advanceMinutes))return;
  const request:Pending=pendingRef.current||{op:advanceMinutes?'advance-time':'turn',advanceMinutes,world:worldId,revision:turn,requestId:crypto.randomUUID(),text:advanceMinutes?'等待時間流逝':value,mode,model:model.trim()};
  if(request.mode!=='demo'&&!apiKey.trim()){setSettings(true);setError('請先在 AI 設定輸入本次頁面的 API Key。');return;}
  inFlight.current=true;setBusy(true);setError('');setText('');followLatest.current=true;
  try{
   rememberPending(request);
   const res=await fetch('/api/v3/world',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...request,op:request.op||'turn',apiKey:request.mode!=='demo'?apiKey.trim():undefined})});
   const data=await res.json() as WorldView;
   if(!res.ok){
    // A revision conflict cannot commit this request: reload before proposing anew.
    if(res.status===409){await loadWorld(request.world);rememberPending(null);}
    else if([400,401,413,422].includes(res.status))rememberPending(null);
    throw Error(data.error||'回合提交失敗');
   }
   applyWorld(data);rememberPending(null);setText('');
  }catch(e){setText(request.text);setError(e instanceof Error?e.message:'連線失敗，請重試同一回合')}
  finally{setBusy(false);inFlight.current=false;requestAnimationFrame(()=>composer.current?.focus())}
 }
 return <main className="v3-shell" data-reading={reading}>
 <aside className={'v3-sidebar'+(sidebar?' is-open':'')} aria-label="世界導航">
  <div className="v3-brand"><span className="v3-seal">道</span><div><strong>問道九州</strong><small>你的故事，留在這個世界</small></div><button className="v3-mobile-close v3-icon" aria-label="關閉導航" onClick={()=>setSidebar(false)}><X size={18}/></button></div>
  <button className="v3-new-world" onClick={reset} disabled={busy||loading||!!pending}><Plus size={17}/>開啟新世界</button>
  <div className="v3-sidebar-label">我的世界線</div>
  <label className="v3-world-select"><span className="v3-sr-only">世界線</span><select aria-label="世界線" value={worldId} disabled={busy||loading||!!pending} onChange={e=>void switchWorld(e.target.value)}>{worlds.map(w=><option key={w.id} value={w.id}>{w.name.replace('問道九州 V3 · ','')} · {w.created.slice(5,10)} · {w.id.slice(0,4)}</option>)}</select></label>
  <div className="v3-world-card"><BookOpen size={18}/><div><strong>太虛初識</strong><p>第 {day} 日 · {location}</p><small>{turn>0?'故事已記下 '+turn+' 次變化':'一切，從一聲問候開始'}</small></div></div>
  <button className="v3-journal-button" onClick={()=>{setJournalOpen(true);setSidebar(false)}} disabled={loading}><BookOpen size={16}/>任務手札 <span>{journal.length}</span></button>
  <details className="v3-time-wait"><summary>在此等待 · 推進時間</summary><p>留在目前位置，讓 NPC 與世界繼續發展。</p><div>{[{minutes:15,label:'15 分鐘'},{minutes:60,label:'1 小時'},{minutes:360,label:'6 小時'},{minutes:1440,label:'1 天'}].map(option=><button key={option.minutes} disabled={busy||loading||!!pending||!!text.trim()} onClick={()=>{setSidebar(false);void send(option.minutes)}}>+ {option.label}</button>)}</div></details>
  <div className="v3-sidebar-bottom"><p>你可以問候、追問、拒絕，<br/>也可以暫時什麼都不做。</p><button onClick={()=>{setSettings(true);setSidebar(false)}}><Settings2 size={16}/> AI 與閱讀設定</button></div>
 </aside>
 {sidebar&&<button className="v3-sidebar-scrim" aria-label="收起導航" onClick={()=>setSidebar(false)}/>}
 <div className="v3-workspace">
  <header className="v3-header"><div className="v3-header-place"><button className="v3-icon v3-menu" aria-label="開啟導航" aria-expanded={sidebar} onClick={()=>setSidebar(!sidebar)}><PanelLeft size={20}/></button><div><span className="v3-kicker">太虛紀事</span><h1>{location}</h1></div></div><div className="v3-header-right"><span className="v3-world-clock">第 {day} 日 <span>·</span> {String(Math.floor(minute/60)).padStart(2,'0')}:{String(minute%60).padStart(2,'0')}</span><button className="v3-connection-button" onClick={()=>setSettings(true)} aria-label="AI 設定"><span className={'v3-status-dot'+(apiKey.trim()?' has-key':'')}/>{mode==='demo'?'示範模式':apiKey.trim()?'AI 設定':'連接 AI'}<Settings2 size={14}/></button></div></header>
  <div className="v3-timeline" ref={timeline} onScroll={()=>{const box=timeline.current;if(box){const isAway=box.scrollHeight-box.scrollTop-box.clientHeight>160;followLatest.current=!isAway;setAway(isAway);}}}>
   <section className="v3-messages" aria-label="故事對話" aria-busy={busy||loading}>
    {loading?<div className="v3-world-loading" role="status"><LoaderCircle size={20}/>正在翻開你的故事……</div>:<>
     {messages.length>visibleCount?<button className="v3-older" onClick={showOlder}>閱讀較早的對話（還有 {messages.length-visibleCount} 則）</button>:<div className="v3-chapter"><span>卷 一</span><h2>山門初見</h2><p>一段問候，也能成為故事的開始。</p></div>}
     {messages.slice(-visibleCount).map((m,i)=>{const index=messages.length-Math.min(messages.length,visibleCount)+i;return <article key={worldId+':'+index} className={m.role==='user'?'v3-user':'v3-assistant'}><div className="v3-label">{m.role==='user'?<><span className="v3-avatar">洛</span>洛河</>:<><span className="v3-narrator-mark">◇</span>問道九州 <span className="v3-label-muted">· 此刻</span></>}</div><div className="v3-content"><StoryText text={m.content}/></div>{m.role==='assistant'&&<button className="v3-copy v3-icon" title={copied===index?'已複製':'複製這段故事'} aria-label={copied===index?'已複製':'複製這段故事'} onClick={()=>void copyMessage(m.content,index)}>{copied===index?<Check size={14}/>:<Copy size={14}/>}</button>}</article>})}
     {pending&&<article className="v3-user v3-pending"><div className="v3-label"><span className="v3-avatar">洛</span>洛河 <span className="v3-label-muted">· {busy?'已送出，等待回覆':'等待確認'}</span></div><div className="v3-content"><StoryText text={pending.text}/></div></article>}
     {busy&&<div className="v3-waiting" role="status"><span className="v3-thinking-dots"><i/><i/><i/></span><div>{elapsed>=20?'還在等候模型回覆，請稍候…':'故事正在接續…'}<small>{elapsed>=20?'免費模型回覆較慢時，這個回合會等待確認。':'回覆確認前，先不要重複送出。'}</small></div><span className="v3-wait-time">{elapsed}s</span></div>}
     {!busy&&!pending&&suggestions.length>0&&<div className="v3-reply-options"><div className="v3-options-heading"><Sparkles size={14}/><span>可選的回應</span><small>點一下帶入，可改寫再送出</small></div><div className="v3-option-grid">{suggestions.map(action=><button key={action.text} onClick={()=>chooseSuggestion(action.text)}><span>{action.label}</span><ChevronRight size={14}/></button>)}</div><p>也可以直接寫下你自己的對話或行動。</p></div>}
    </>}
    <div ref={bottom}/>
   </section>
  </div>
  <footer className="v3-compose">
   {away&&<button className="v3-jump" onClick={jumpLatest}><ArrowDown size={14}/>回到最新對話</button>}
   {error&&<div className="v3-error" role="alert"><span>{error}</span>{!pending&&<button aria-label="關閉提示" className="v3-icon" onClick={()=>setError('')}><X size={14}/></button>}</div>}
   {pending&&!busy&&<div className="v3-retry-note"><span>上一回合尚待確認。重試不會重複推進世界。</span><div className="v3-retry-buttons"><button disabled={loading||testing} onClick={()=>void checkPending()}>確認存檔狀態</button><button disabled={loading||testing} onClick={()=>void send()}>重試上一回合</button></div></div>}
   {!apiKey&&mode!=='demo'&&!loading&&<div className="v3-connect-note"><span>連接你的免費 AI，讓人物回應你。</span><button onClick={()=>setSettings(true)}>設定 OpenRouter <ChevronRight size={12}/></button></div>}
   <div className="v3-composer-box"><textarea ref={composer} aria-label="你的對話或行動" value={text} maxLength={2500} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&!window.matchMedia('(pointer: coarse)').matches){e.preventDefault();void send()}}} placeholder="說一句話，或做一件你想做的事…" disabled={busy||loading||!!pending} rows={2}/><div className="v3-composer-bottom"><span>{pending?'確認上一回合後，就能繼續接話':text.length>2000?`${text.length} / 2500`:'你的選擇，由你決定。'}</span><button className="v3-send" aria-label={busy?'等候回覆':'送出對話'} onClick={()=>void send()} disabled={busy||testing||loading||!!pending||!worldId||!text.trim()}>{busy?<LoaderCircle size={19}/>:<ArrowUp size={19}/>}</button></div></div>
   <div className="v3-composer-hint"><span>{busy?'等待回覆中':pending?'待確認':turn>0?'故事已保存':'自由對話 · 世界會記住你的行動'}</span><span className="v3-keyboard-hint">Enter 送出 · Shift + Enter 換行</span></div>
  </footer>
 </div>
 <dialog ref={settingsDialog} className="v3-dialog" onCancel={()=>setSettings(false)} onClick={e=>{if(e.target===e.currentTarget)setSettings(false)}}><div className="v3-dialog-inner"><header className="v3-dialog-header"><div><span className="v3-kicker">讓故事繼續</span><h2>AI 設定</h2></div><button className="v3-icon" aria-label="關閉 AI 設定" onClick={()=>setSettings(false)}><X size={20}/></button></header>
 <section className="v3-panel"><fieldset disabled={loading||busy||testing||!!pending}><legend>選擇對話模式</legend><div className="v3-provider-grid">{([['openrouter','免費 AI','OpenRouter'],['demo','先試試介面','示範模式，非 AI'],['ai','OpenAI','依 API 用量計費']] as [Mode,string,string][]).map(([value,label,description])=><label className={'v3-provider'+(mode===value?' selected':'')} key={value}><input type="radio" checked={mode===value} onChange={()=>selectMode(value)}/><span><strong>{label}</strong><small>{description}</small></span></label>)}</div>
 {mode!=='demo'&&<label className="v3-field">模型 ID<input value={model} onChange={e=>{setModel(e.target.value);setConnection('');localStorage.setItem(preferencesKey,JSON.stringify({mode,model:e.target.value}))}} maxLength={120}/></label>}</fieldset>
 {mode!=='demo'&&<><label className="v3-field">本次頁面 API Key<input type="password" autoComplete="off" value={apiKey} disabled={loading||busy||testing} onChange={e=>{setApiKey(e.target.value);setConnection('')}} placeholder={mode==='openrouter'?'sk-or-v1-…':'sk-…'}/></label><p className="v3-setting-help">金鑰只保留在當次頁面，重新整理後需再輸入。對話會透過遊戲伺服器送給所選 AI 服務。</p>
 {mode==='ai'&&<button className="v3-test-button" onClick={()=>void testConnection()} disabled={testing||busy||!apiKey.trim()}>{testing?'正在測試 OpenAI 模型…':'測試 OpenAI 模型與 API Key'}</button>}
 {mode==='openrouter'&&<><div className="v3-key-link"><a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">取得 OpenRouter Key ↗</a><span>僅使用免費模型，不自動切換付費。</span></div><button className="v3-test-button" onClick={()=>void testConnection()} disabled={testing||busy||!apiKey.trim()}>{testing?<><LoaderCircle size={16}/>正在取得測試回覆…</>:'測試 AI 連線'}</button></>}{connection&&<p className={'v3-connection-result'+(connection.startsWith('連線成功')?' is-success':'')} role="status">{connection}</p>}</>}
 <fieldset className="v3-reading"><legend>閱讀字級</legend><div>{(['normal','large'] as const).map(size=><button key={size} aria-pressed={reading===size} onClick={()=>{setReading(size);localStorage.setItem('wendao-v3-reading',size)}}>{size==='normal'?'標準':'放大'}</button>)}</div></fieldset>
 <details className="v3-advanced"><summary>進階與人物檔案</summary><p>已選模型：{model}{usedModel?' · 上回合實際使用：'+usedModel:''}{usage!==null?' · 上回合 '+usage+' tokens':''}</p><button disabled={busy||!!pending} onClick={()=>{setSettings(false);setDeveloperTab('people');setDev(true)}}><BookOpen size={15}/>開發者人物檔案</button><button disabled={busy||!!pending} onClick={()=>{setSettings(false);setDeveloperTab('tasks');setDev(true)}}><BookOpen size={15}/>開發者任務管理</button><p>只有已登入且擁有這個世界線的帳號可以查看或編輯這份後台資料。</p><button type="button" disabled={busy||loading||!!pending} className="v3-danger-button" onClick={()=>void clearHistory()}>永久清除我所有 V3 世界線及對話紀錄</button></details>
 <button className="v3-done-button" onClick={()=>setSettings(false)}>{mode==='demo'?'開始試玩':'回到故事'}<ChevronRight size={16}/></button>
 </section></div></dialog>
 <dialog ref={developerDialog} className="v3-dialog v3-inspector" onCancel={()=>setDev(false)}><div className="v3-dialog-inner"><header className="v3-dialog-header"><h2>{developerTab==='tasks'?'任務管理':'人物檔案'}</h2><button className="v3-icon" aria-label="關閉開發者後台" onClick={()=>setDev(false)}><X size={20}/></button></header><nav className="v3-developer-tabs" aria-label="開發者後台"><button aria-pressed={developerTab==='people'} onClick={()=>setDeveloperTab('people')}>人物管理</button><button aria-pressed={developerTab==='tasks'} onClick={()=>setDeveloperTab('tasks')}>任務管理</button></nav>{dev&&worldId&&!pending&&(developerTab==='people'?<V3DeveloperPanel worldId={worldId} revision={turn} onWorldChange={applyWorld}/>:<V3TaskDeveloperPanel worldId={worldId} revision={turn} onWorldChange={applyWorld}/>)}</div></dialog>
 <dialog ref={journalDialog} className="v3-dialog" onCancel={()=>setJournalOpen(false)}><div className="v3-dialog-inner"><header className="v3-dialog-header"><div><span className="v3-kicker">洛河已知的事情</span><h2>經歷與任務手札</h2></div><button className="v3-icon" aria-label="關閉任務手札" onClick={()=>setJournalOpen(false)}><X size={20}/></button></header><p className="v3-journal-note">只顯示洛河已知的線索。任務可以忽略、拒絕或走向不同結局。</p>{journal.length===0?<p>重要經歷會記在這裡，你可以自由生活與探索。</p>:journal.map(quest=><article className="v3-journal-entry" key={quest.id}><div><span>{quest.type}</span><span>{quest.status}</span></div><h3>{quest.title}</h3><p>{quest.description}</p>{quest.type!=='經歷'&&<progress aria-label={quest.title+'進度'} max={100} value={quest.progress}/>}<p>{quest.objective}</p></article>)}</div></dialog>
 </main>
}
