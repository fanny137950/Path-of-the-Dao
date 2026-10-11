'use client';
import {useEffect,useRef,useState} from 'react';
import './v3.css';
import V3DeveloperPanel from '../../components/v3-developer-panel';
type Msg={role:'user'|'assistant';content:string};
const intro='太虛宗收徒大典，山門前人潮如織。高臺上，負責測試靈根的執事抬起眼。\n\n「下一位。姓名？」\n\n你是十五歲的洛河，今日第一次踏入太虛宗。';
// New local pointer deliberately starts a fresh V3 test world; old test rows remain untouched.
const worldKey='wendao-v3-chat-first-world';
type WorldView={id:string;revision:number;day:number;minute:number;location:string;messages:Msg[];usage?:{totalTokens?:number}|null;error?:string};
export default function V3(){
 const [messages,setMessages]=useState<Msg[]>([{role:'assistant',content:intro}]);
 const [text,setText]=useState('');const [busy,setBusy]=useState(false);
 const [apiKey,setApiKey]=useState('');const [model,setModel]=useState('openrouter/free');
 const [settings,setSettings]=useState(false);const [dev,setDev]=useState(false);
 const [error,setError]=useState('');const [mode,setMode]=useState<'demo'|'ai'|'openrouter'>('demo');
 const [turn,setTurn]=useState(0);const [usage,setUsage]=useState<number|null>(null);
 const [worldId,setWorldId]=useState('');const [loading,setLoading]=useState(true);const [day,setDay]=useState(1);const [minute,setMinute]=useState(480);
 const [location,setLocation]=useState('太虛宗山門');
 const bottom=useRef<HTMLDivElement>(null);
 const initializationStarted=useRef(false);
 function applyWorld(world:WorldView){
  if(!world.id||!Array.isArray(world.messages))throw Error('世界資料格式錯誤');
  setWorldId(world.id);setMessages(world.messages);setTurn(world.revision);
  setDay(world.day);setMinute(world.minute);setLocation(world.location||'太虛宗山門');
  setUsage(typeof world.usage?.totalTokens==='number'?world.usage.totalTokens:null);
  localStorage.setItem(worldKey,world.id);
 }
 async function createWorld(){
  const response=await fetch('/api/v3/world',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'new'})});
  const data=await response.json() as WorldView;
  if(!response.ok)throw Error(data.error||'建立世界失敗');
  applyWorld(data);
 }
 useEffect(()=>{
  if(initializationStarted.current)return;
  initializationStarted.current=true;
  let active=true;
  (async()=>{try{
   const id=localStorage.getItem(worldKey);
   if(id){
    const res=await fetch('/api/v3/world?world='+encodeURIComponent(id),{cache:'no-store'});
    if(res.ok){const data=await res.json() as WorldView;if(active)applyWorld(data);}
    else if(res.status===404){if(active)await createWorld();}
    else{const data=await res.json() as WorldView;throw Error(data.error||'讀取世界失敗');}
   }else if(active)await createWorld();
  }catch(e){if(active)setError(e instanceof Error?e.message:'讀取世界失敗')}
  finally{if(active)setLoading(false)}})();
  // The initialization guard prevents duplicate worlds in React Strict Mode.
 },[]);
 useEffect(()=>{if(!settings&&!dev)bottom.current?.scrollIntoView({behavior:'smooth',block:'end'})},[messages,settings,dev]);
 async function reset(){
  if(busy||loading||!confirm('重新建立自由劇情測試世界？這會切換到新的世界線，原有 D1 測試紀錄不會被刪除。'))return;
  setLoading(true);setError('');
  try{await createWorld()}catch(e){setError(e instanceof Error?e.message:'建立世界失敗')}finally{setLoading(false)}
 }
 async function send(){
  const value=text.trim();if(!value||busy||loading||!worldId)return;
  setBusy(true);setError('');setText('');
  try{
   const res=await fetch('/api/v3/world',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'turn',world:worldId,requestId:crypto.randomUUID(),text:value,mode,model,apiKey:mode!=='demo'?apiKey:undefined})});
   const data=await res.json() as WorldView;
   if(!res.ok)throw Error(data.error||'回合提交失敗');
   applyWorld(data);
  }catch(e){setText(value);setError(e instanceof Error?e.message:'連線失敗')}
  finally{setBusy(false)}
 }
 const panel=dev?'dev':settings?'settings':'story';
 const clock=String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
 const modeName=mode==='ai'?'OpenAI':mode==='openrouter'?'OpenRouter':'示範模式';
 return <main className="v3-shell">
  <header className="v3-header">
   <div className="v3-brand">
    <div className="v3-brand-symbol" aria-hidden="true">道</div>
    <div><div className="v3-brand-kicker">WEN DAO · LIVING WORLD</div>
     <strong>問道九州 <small>V3</small></strong>
     <p>一念起，九州動。你的故事仍在繼續。</p>
    </div>
   </div>
   <nav className="v3-header-nav" aria-label="遊戲選單">
    <button type="button" className={panel==='story'?'v3-tab-active':''}
     aria-pressed={panel==='story'} onClick={()=>{setDev(false);setSettings(false)}}>故事</button>
    <button type="button" className={panel==='dev'?'v3-tab-active':''}
     aria-pressed={panel==='dev'} onClick={()=>{setDev(!dev);setSettings(false)}}>人物管理</button>
    <button type="button" className={panel==='settings'?'v3-tab-active':''}
     aria-pressed={panel==='settings'} onClick={()=>{setSettings(!settings);setDev(false)}}>AI 設定</button>
   </nav>
  </header>
  <div className="v3-status-bar" role="status" aria-live="polite">
   <div><span className="v3-status-dot" aria-hidden="true"></span><strong>{location}</strong><span>第 {day} 日 · {clock}</span></div>
   <div><span>{modeName}</span><span>回合 {turn}</span>
    <span className={loading?'v3-state-loading':'v3-state-saved'}>{loading?'載入中':'D1 已連線'}</span></div>
  </div>
  {panel==='settings'&&<section className="v3-panel v3-settings" aria-label="AI 模型設定">
   <div className="v3-section-intro"><span className="v3-eyebrow">CONFIGURATION / AI</span><h2>選擇說書人</h2>
    <p>模型只影響 GM 的敘事方式；世界與人物記憶保存在同一條存檔中。API Key 不會寫入 D1。</p></div>
   <div className="v3-mode-grid">
    <label className={mode==='demo'?'v3-mode-active':''}><input type="radio" name="gm-mode" checked={mode==='demo'} onChange={()=>setMode('demo')}/>
     <strong>規則示範</strong><small>免費 · 不是真正的 AI 對話</small></label>
    <label className={mode==='openrouter'?'v3-mode-active':''}><input type="radio" name="gm-mode" checked={mode==='openrouter'} onChange={()=>{setMode('openrouter');setModel('openrouter/free');setApiKey('')}}/>
     <strong>OpenRouter</strong><small>免費模型 · 需自備 API Key</small></label>
    <label className={mode==='ai'?'v3-mode-active':''}><input type="radio" name="gm-mode" checked={mode==='ai'} onChange={()=>{setMode('ai');setModel('gpt-4.1-mini');setApiKey('')}}/>
     <strong>OpenAI</strong><small>付費 API · 適合測試自然對話</small></label>
   </div>
   {mode!=='demo'&&<div className="v3-config-fields">
    <label htmlFor="v3-model-id">模型 ID<input id="v3-model-id" value={model} onChange={e=>setModel(e.target.value)} maxLength={120} placeholder="請輸入模型 ID"/></label>
    <label htmlFor="v3-api-key">本次工作階段 API Key<input id="v3-api-key" type="password" autoComplete="off" value={apiKey}
     onChange={e=>setApiKey(e.target.value)} placeholder={mode==='openrouter'?'sk-or-v1-...':'sk-...'}/></label>
    <div className="v3-config-note">金鑰只存於這個頁面的記憶體，經遊戲伺服器送往你選的 AI 服務。OpenRouter 僅支援 openrouter/free 或 :free 模型，並設定免費供應商限制。模型可能有額度或可用性限制。</div>
    {mode==='openrouter'&&<a className="v3-text-link" href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">建立 OpenRouter API Key ↗</a>}
   </div>}
   <div className="v3-settings-footer"><button className="v3-primary-btn" onClick={()=>setSettings(false)}>返回故事</button>
    <button className="v3-danger-btn" onClick={()=>void reset()} disabled={loading||busy}>開啟新測試世界</button></div>
  </section>}
  {panel==='dev'&&worldId&&<div className="v3-dev-workspace"><V3DeveloperPanel worldId={worldId} revision={turn} onWorldChange={applyWorld}/></div>}
  {panel==='story'&&<>
   <div className="v3-story-header"><span className="v3-eyebrow">TAIXU SECT · CHAPTER {String(day).padStart(2,'0')}</span>
    <h1>{location}</h1>
    <div className="v3-story-ornament" aria-hidden="true"><span></span>✦<span></span></div>
   </div>
   <section className="v3-messages" aria-label="故事對話紀錄" aria-live="polite">
    {messages.map((m,i)=><article key={i} className={m.role==='user'?'v3-user':'v3-assistant'}>
     <div className="v3-label">{m.role==='user'?<><span className="v3-speaker-dot v3-player-dot"></span>洛河</>:<><span className="v3-speaker-dot v3-gm-dot"></span>問道九州 · GM</>}</div>
     <div className="v3-content">{m.content}</div>
    </article>)}
    {busy&&<div className="v3-thinking" role="status"><span className="v3-thinking-icon">✦</span> GM 正在推演此刻的九州……</div>}
    <div ref={bottom}/>
   </section>
   <footer className="v3-compose">
    <div className="v3-compose-top"><span>洛河 · 自由行動</span><span>{text.length} / 2500</span></div>
    {error&&<p className="v3-error" role="alert">{error}</p>}
    <div className="v3-compose-row"><textarea aria-label="輸入洛河的對話或行動"
     value={text} onChange={e=>setText(e.target.value.slice(0,2500))}
     onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send()}}}
     placeholder="說一句話、做一個動作，或只是靜靜觀察……"
     disabled={busy||loading} rows={2}/>
     <button className="v3-send-btn" onClick={()=>void send()} disabled={busy||loading||!worldId||!text.trim()} aria-label="送出對話">
      <span>送出</span><span aria-hidden="true">↗</span>
     </button>
    </div>
    <p className="v3-compose-hint">Enter 送出 · Shift + Enter 換行 · 每一段對話都保存在世界存檔中</p>
   </footer>
  </>}
 </main>;
}
