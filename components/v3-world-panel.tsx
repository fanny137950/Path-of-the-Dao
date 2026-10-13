'use client';
import {BookOpen,MapPin,Leaf,Archive} from 'lucide-react';
export type PlayerMemory={scene:{summary:string;openLoops:string[];sourceRevision:number}|null;threads:{id:string;title:string;summary:string;status:string;revision:number}[];memories:{id:string;text:string;day:number;revision:number}[];historyCount:number};
export type PlayerProfile={name:string;realm:string;spiritualRoot:string;status?:string;master?:string;sect?:string;spiritStones?:number;inventory?:{name:string;quantity:number}[];skills?:string[];equipment?:string[]};
export default function V3WorldPanel({memory,profile,location,revision}:{memory:PlayerMemory|null;profile:PlayerProfile|null;location:string;revision:number}){
 const status:Record<string,string>={open:'進行中',blocked:'暫待轉機',resolved:'已落定',failed:'已失去機會'};
 return <div className="v3-world-notebook">
  <div className="v3-notebook-title"><span className="v3-kicker">沿途拾記</span><h2>這一刻的世界</h2><p>只記下洛河已知的事情。</p></div>
  <section><h3><MapPin size={15}/>此刻 · {location}</h3><p>{memory?.scene?.summary||'故事剛剛翻開。說一句話，世界便會回應。'}</p>{!!memory?.scene?.openLoops.length&&<div className="v3-unfinished"><small>話還沒說完</small>{memory.scene.openLoops.map((q,i)=><p key={i}>{q}</p>)}</div>}</section>
  {profile&&<section><h3><Leaf size={15}/>洛河</h3><dl className="v3-profile-facts"><dt>境界</dt><dd>{profile.realm}</dd><dt>靈根</dt><dd>{profile.spiritualRoot}</dd><dt>近況</dt><dd>{profile.status||'尚無特別記錄'}</dd>{profile.master&&<><dt>師承</dt><dd>{profile.master}</dd></>}{profile.spiritStones!==undefined&&<><dt>靈石</dt><dd>{profile.spiritStones}</dd></>}</dl>
   <details><summary>行囊與所學</summary>{profile.inventory?.length?<ul>{profile.inventory.map((item,i)=><li key={i}>{item.name} <span>× {item.quantity}</span></li>)}</ul>:<p>尚無記錄的物品。</p>}{!!profile.skills?.length&&<p>所學：{profile.skills.join('、')}</p>}{!!profile.equipment?.length&&<p>裝備：{profile.equipment.join('、')}</p>}</details>
  </section>}
  <section><h3><BookOpen size={15}/>尚在發生</h3>{memory?.threads?.length?memory.threads.slice().reverse().map(t=><article key={t.id} className="v3-thread"><div><strong>{t.title}</strong><small>{status[t.status]||t.status}</small></div><p>{t.summary}</p></article>):<p className="v3-notebook-empty">還沒有待追蹤的事件。日常也值得慢慢過。</p>}</section>
  <section><h3><Archive size={15}/>留在記憶裡</h3>{memory?.memories?.length?<ol className="v3-memory-trail">{memory.memories.slice(-5).reverse().map(m=><li key={m.id}><small>第 {m.day} 日</small><p>{m.text}</p></li>)}</ol>:<p className="v3-notebook-empty">重要的經歷、約定與關係，會隨故事留下。</p>}</section>
  <p className="v3-notebook-foot">已保存 {memory?.historyCount||0} 回合 · 存檔版本 {revision}</p>
 </div>;
}
