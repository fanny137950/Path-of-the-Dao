'use client';
import {useEffect,useRef,useState} from 'react';
import './v3.css';
import V3DeveloperPanel from '../../components/v3-developer-panel';
type Msg={role:'user'|'assistant';content:string};
const intro='太虛宗收徒大典，山門前人潮如織。高臺上，負責測試靈根的執事抬起眼。\n\n「下一位。姓名？」\n\n你是十五歲的洛河，今日第一次踏入太虛宗。';
const worldKey='wendao-v3-active-world';
type QuickAction={id:string;label:string;text:string};
type WorldView={id:string;revision:number;day:number;minute:number;location:string;messages:Msg[];phase?:string;choices?:QuickAction[];usage?:{totalTokens?:number}|null;error?:string};
export default function V3(){
 const [messages,setMessages]=useState<Msg[]>([{role:'assistant',content:intro}]);
 const [text,setText]=useState('');const [busy,setBusy]=useState(false);
 const [apiKey,setApiKey]=useState('');const [model,setModel]=useState('openrouter/free');
 const [settings,setSettings]=useState(false);const [dev,setDev]=useState(false);
 const [error,setError]=useState('');const [mode,setMode]=useState<'demo'|'ai'|'openrouter'>('demo');
 const [turn,setTurn]=useState(0);const [usage,setUsage]=useState<number|null>(null);
 const [worldId,setWorldId]=useState('');const [loading,setLoading]=useState(true);const [day,setDay]=useState(1);const [minute,setMinute]=useState(480);
 const [choices,setChoices]=useState<QuickAction[]>([]);const [phase,setPhase]=useState('test_ready');
 const bottom=useRef<HTMLDivElement>(null);
 const initializationStarted=useRef(false);
 function applyWorld(world:WorldView){
  if(!world.id||!Array.isArray(world.messages))throw Error('世界資料格式錯誤');
  setWorldId(world.id);setMessages(world.messages);setTurn(world.revision);
  setDay(world.day);setMinute(world.minute);
  setChoices(Array.isArray(world.choices)?world.choices.filter(a=>a&&typeof a.id==='string'&&typeof a.label==='string'&&typeof a.text==='string').slice(0,4):[]);
  setPhase(world.phase||'test_ready');
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
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth'})},[messages]);
 async function reset(){
  if(busy||loading||!confirm('建立新的 V3 世界線？舊的 V3 世界線不會被刪除，但目前畫面會切換至新世界。'))return;
  setLoading(true);setError('');
  try{await createWorld()}catch(e){setError(e instanceof Error?e.message:'建立世界失敗')}finally{setLoading(false)}
 }
 async function send(suggestion?:string){
  const value=(suggestion??text).trim();if(!value||busy||loading||!worldId)return;
  setBusy(true);setError('');setText('');
  try{
   const res=await fetch('/api/v3/world',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'turn',world:worldId,requestId:crypto.randomUUID(),text:value,mode,model,apiKey:mode!=='demo'?apiKey:undefined})});
   const data=await res.json() as WorldView;
   if(!res.ok)throw Error(data.error||'回合提交失敗');
   applyWorld(data);
  }catch(e){setText(value);setError(e instanceof Error?e.message:'連線失敗')}
  finally{setBusy(false)}
 }
 return <main className="v3-shell"><header className="v3-header"><div><strong>問道九州 <small>V3 試玩</small></strong><p>太虛宗 · 第 {day} 日 {String(Math.floor(minute/60)).padStart(2,'0')}:{String(minute%60).padStart(2,'0')} · {phase==='test_ready'?'收徒測試':phase==='result_known'?'已測定靈根':phase==='admitted'?'初試通過':'外門報到'}</p></div><nav><button onClick={()=>setDev(!dev)}>開發者</button><button onClick={()=>setSettings(!settings)}>AI 設定</button><button onClick={reset}>重新開始</button></nav></header>
 {settings&&<section className="v3-panel"><h3>對話模式</h3><label><input type="radio" checked={mode==='demo'} onChange={()=>setMode('demo')}/> 免費示範（規則式回應，非 AI）</label><label><input type="radio" checked={mode==='openrouter'} onChange={()=>{setMode('openrouter');setModel('openrouter/free');setApiKey('')}}/> OpenRouter 免費 AI（需要 OpenRouter API Key）</label><label><input type="radio" checked={mode==='ai'} onChange={()=>{setMode('ai');setModel('gpt-4.1-mini');setApiKey('')}}/> OpenAI API（可能產生費用）</label>{mode!=='demo'&&<><label>模型 ID <input value={model} onChange={e=>setModel(e.target.value)} maxLength={120}/></label><label>本次頁面 API Key <input type="password" autoComplete="off" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={mode==='openrouter'?'sk-or-v1-...':'sk-...'}/></label><p>金鑰只保留在目前頁面的記憶體，不存進瀏覽器存檔；會傳送到遊戲伺服器，再轉發給你選擇的 AI 服務。OpenRouter 只允許 openrouter/free 或以 :free 結尾的模型，並限制供應商價格為零。免費模型可能有額度、速度或可用性限制。請勿在共用電腦使用。</p>{mode==='openrouter'&&<p><a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">建立 OpenRouter API Key ↗</a></p>}</>}</section>}
 {dev&&worldId&&<V3DeveloperPanel worldId={worldId} revision={turn} onWorldChange={applyWorld}/>}
 <section className="v3-messages">{messages.map((m,i)=><article key={i} className={m.role==='user'?'v3-user':'v3-assistant'}><div className="v3-label">{m.role==='user'?'洛河':'問道九州 · GM'}</div><div className="v3-content">{m.content}</div></article>)}{!busy&&!loading&&worldId&&choices.length>0&&messages.at(-1)?.role==='assistant'&&<section className="v3-actions" aria-label="推薦的下一步行動">
  <p className="v3-actions-title">接下來可以…… <span>也能直接輸入任何行動</span></p>
  <div className="v3-actions-buttons">{choices.map(a=><button type="button" key={a.id} onClick={()=>void send(a.text)}>{a.label} <span aria-hidden="true">↗</span></button>)}</div>
 </section>}
 {busy&&<p className="v3-loading">GM 正在回應……</p>}<div ref={bottom}/></section>
 <footer className="v3-compose">{error&&<p className="v3-error">{error}</p>}<div className="v3-compose-row"><textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}} placeholder="輸入洛河的對話或行動……（Enter 送出，Shift+Enter 換行）" disabled={busy||loading} rows={2}/><button onClick={()=>void send()} disabled={busy||loading||!worldId||!text.trim()}>送出 ↑</button></div><p>V3 試玩版 · 對話與回合保存在 Cloudflare D1 · 舊版存檔不受影響</p></footer></main>
}
