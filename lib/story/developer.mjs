import {incidentView} from './incidents.mjs';
import {historyFor} from './performance.mjs';
import {supplementalFor} from './supplemental-memory.mjs';
import WORLD from '../../data/taixu.json' with {type:'json'};
import {PERSONAS} from './world.mjs';
import {personalityOf} from './personality.mjs';
export function isDeveloper(userId,env={}){return typeof userId==='string'&&String(env.GAME_DEVELOPER_USER_IDS||'').split(',').map(s=>s.trim()).filter(Boolean).includes(userId);}
export function developerView(s){return {world:s.id,revision:s.revision,time:s.time,personality:personalityOf(s),incident:incidentView(s),characters:Object.entries(s.npcs).map(([id,n])=>({id,name:WORLD.npcs[id].name,role:WORLD.npcs[id].role,original:{...WORLD.npcs[id],...PERSONAS[id]},history:[...historyFor(id),...supplementalFor(s,id)],recollections:(s.recollections||[]).filter(r=>r.speaker===id),attitude:attitude(n),progress:progress(n,PERSONAS[id]),current:n})),lastGeneration:s.lastGeneration||null,scope:'只讀取這條世界線；個性補充不改原生 NPC，不回寫歷史。'};}

function attitude(n){const r=n.relations;return `${r.trust>=50?'已累積信任':r.trust>=20?'願意觀察與往來':'信任仍需建立'}，${r.closeness>=40?'相處較親近':'仍保有距離'}；${r.caution>=40?'對重要事情有所戒備':'目前戒備不高'}。`;}
function progress(n,p){return {goal:p.goal,trainingRequired:p.threshold,trainingRemaining:Math.max(0,p.threshold-n.trainingHours),blockers:[...(n.breakthroughs?['目前已完成此版本提供的成長階段']:[]),...(n.trainingHours<p.threshold?['修行累積不足']:[]),...(n.money<p.breakthroughCost?['準備靈石不足']:[]),...(n.insight<3?['歷練不足']:[]),...(n.health<80?['身體狀態未達標']:[]),...(n.travel||n.activity!=='修行'?['尚未處於可突破的修行時機']:[])]};}
