'use client';
import {useEffect,useRef,useState} from 'react';
import './v3.css';
type Msg={role:'user'|'assistant';content:string};
const intro='太虛宗收徒大典，山門前人潮如織。高臺上，負責測試靈根的執事抬起眼。\n\n「下一位。姓名？」\n\n你是十五歲的洛河，今日第一次踏入太虛宗。';
const key='wendao-v3-demo-v1';
export default function V3(){
 const [messages,setMessages]=useState<Msg[]>([{role:'assistant',content:intro}]);
 const [text,setText]=useState('');const [busy,setBusy]=useState(false);
 const [apiKey,setApiKey]=useState('');const [model,setModel]=useState('openrouter/free');
 const [settings,setSettings]=useState(false);const [dev,setDev]=useState(false);
 const [error,setError]=useState('');const [mode,setMode]=useState<'demo'|'ai'|'openrouter'>('demo');
 const [turn,setTurn]=useState(0);const [usage,setUsage]=useState<number|null>(null);
 const bottom=useRef<HTMLDivElement>(null);
 useEffect(()=>{try{const s=localStorage.getItem(key);if(s){const v=JSON.parse(s);if(Array.isArray(v.messages)&&v.messages.length){setMessages(v.messages);setTurn(v.turn||0)}}}catch{}},[]);
 useEffect(()=>{if(turn===0&&messages.length===1)return;try{localStorage.setItem(key,JSON.stringify({messages,turn}))}catch{};bottom.current?.scrollIntoView({behavior:'smooth'})},[messages,turn]);
 function reset(){if(!confirm('重新開始 V3 試玩？此操作會清除本瀏覽器的 V3 試玩紀錄，不影響舊版存檔。'))return;localStorage.removeItem(key);setMessages([{role:'assistant',content:intro}]);setTurn(0);setError('')}
 async function send(){const value=text.trim();if(!value||busy)return;setBusy(true);setError('');setText('');
 const next=[...messages,{role:'user' as const,content:value}];setMessages(next);
 try{const res=await fetch('/api/v3/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,model,apiKey:mode!=='demo'?apiKey:undefined,messages:next.slice(-20),turn})});
 const data:unknown=await res.json();
 const reply=data&&typeof data==='object'?data as {error?:unknown;text?:unknown;usage?:{totalTokens?:unknown}}:null;
 if(!res.ok)throw Error(typeof reply?.error==='string'?reply.error:'請求失敗');
 if(typeof reply?.text!=='string')throw Error('伺服器回應格式錯誤');
 setMessages([...next,{role:'assistant',content:reply.text}]);setTurn(t=>t+1);
 setUsage(typeof reply.usage?.totalTokens==='number'?reply.usage.totalTokens:null);
 }catch(e){setMessages(messages);setText(value);setError(e instanceof Error?e.message:'連線失敗')}finally{setBusy(false)}}
 return <main className="v3-shell"><header className="v3-header"><div><strong>問道九州 <small>V3 試玩</small></strong><p>太虛宗 · 入門篇 · 獨立試驗版</p></div><nav><button onClick={()=>setDev(!dev)}>開發者</button><button onClick={()=>setSettings(!settings)}>AI 設定</button><button onClick={reset}>重新開始</button></nav></header>
 {settings&&<section className="v3-panel"><h3>對話模式</h3><label><input type="radio" checked={mode==='demo'} onChange={()=>setMode('demo')}/> 免費示範（規則式回應，非 AI）</label><label><input type="radio" checked={mode==='openrouter'} onChange={()=>{setMode('openrouter');setModel('openrouter/free');setApiKey('')}}/> OpenRouter 免費 AI（需要 OpenRouter API Key）</label><label><input type="radio" checked={mode==='ai'} onChange={()=>{setMode('ai');setModel('gpt-4.1-mini');setApiKey('')}}/> OpenAI API（可能產生費用）</label>{mode!=='demo'&&<><label>模型 ID <input value={model} onChange={e=>setModel(e.target.value)} maxLength={120}/></label><label>本次頁面 API Key <input type="password" autoComplete="off" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={mode==='openrouter'?'sk-or-v1-...':'sk-...'}/></label><p>金鑰只保留在目前頁面的記憶體，不存進瀏覽器存檔；會傳送到遊戲伺服器，再轉發給你選擇的 AI 服務。OpenRouter 只允許 openrouter/free 或以 :free 結尾的模型，並限制供應商價格為零。免費模型可能有額度、速度或可用性限制。請勿在共用電腦使用。</p>{mode==='openrouter'&&<p><a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">建立 OpenRouter API Key ↗</a></p>}</>}</section>}
 {dev&&<section className="v3-panel"><h3>開發者檢視 · 試玩版</h3><p>世界：太虛宗收徒大典｜玩家：洛河｜已完成回合：{turn}</p><p>NPC：收徒執事（現場）；沈滄月、晏清辭、江離、顧長青（預設世界人物，尚未加入自主模擬）</p><p>本次 Token：{usage??'未取得'}。本版尚未提供正式人物狀態、個別知情或世界事件帳本。</p></section>}
 <section className="v3-messages">{messages.map((m,i)=><article key={i} className={m.role==='user'?'v3-user':'v3-assistant'}><div className="v3-label">{m.role==='user'?'洛河':'問道九州 · GM'}</div><div className="v3-content">{m.content}</div></article>)}{busy&&<p className="v3-loading">GM 正在回應……</p>}<div ref={bottom}/></section>
 <footer className="v3-compose">{error&&<p className="v3-error">{error}</p>}<div className="v3-compose-row"><textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}} placeholder="輸入洛河的對話或行動……（Enter 送出，Shift+Enter 換行）" disabled={busy} rows={2}/><button onClick={()=>void send()} disabled={busy||!text.trim()}>送出 ↑</button></div><p>V3 試玩版 · 僅本瀏覽器儲存對話 · 不影響舊版正式存檔</p></footer></main>
}
