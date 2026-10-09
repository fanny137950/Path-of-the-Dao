import WORLD from '../../data/taixu.json' with {type:'json'};
import {PERSONAS} from './world.mjs';
import {personalityOf} from './personality.mjs';
export function isDeveloper(userId,env={}){return typeof userId==='string'&&String(env.GAME_DEVELOPER_USER_IDS||'').split(',').map(s=>s.trim()).filter(Boolean).includes(userId);}
export function developerView(s){return {world:s.id,revision:s.revision,time:s.time,personality:personalityOf(s),characters:Object.entries(s.npcs).map(([id,n])=>({id,name:WORLD.npcs[id].name,role:WORLD.npcs[id].role,original:{...WORLD.npcs[id],...PERSONAS[id]},current:n})),lastGeneration:s.lastGeneration||null,scope:'只讀取這條世界線；個性補充不改原生 NPC，不回寫歷史。'};}
