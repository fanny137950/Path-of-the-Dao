/**
 * Canonical named-NPC registration from the GM_STATE payload.
 * No inference of secret realm, affiliation, aptitude or personal goals.
 * For plain narrative introductions, the conservative backup captures only
 * explicit self-introductions, so named characters don't disappear from D1.
 */
import {initialNPCAgency,ensureNPCAgency} from './npc-agency.mjs';
const short=(s,max=120)=>String(s??'').trim().slice(0,max);
const NAME=/^[\u3400-\u9fff]{2,5}$/u;
const BANNED=new Set(['洛河','韓守一','太虛宗','十二峰','測靈石','新弟子','中年人','年輕人','風靈根','收徒大典','初評','師兄','師姐']);
const NPC_LIMIT=160;
function newId(world){
 let n=Math.max(1,Number(world.nextGeneratedNpc)||1),id='';
 do{id='npc-ai-'+String(n++).padStart(5,'0')}while(world.npcs[id]);
 world.nextGeneratedNpc=n;
 return id;
}
export function extractIntroductions(narrative){
 const matches=[...String(narrative).matchAll(/(?:我叫|我名叫|我的名字(?:是|叫)|在下|名為)([\u3400-\u9fff]{2,5})/gu)];
 return [...new Set(matches.map(m=>m[1]).filter(n=>NAME.test(n)&&!BANNED.has(n)))].slice(0,2);
}
export function registerNamedNPCs(world,narrative,proposals=[],seenIds=[]){
 const names=extractIntroductions(narrative);
 const proposalsValid=Array.isArray(proposals)?proposals.slice(0,3):[];
 for(const raw of proposalsValid){
  if(!raw||typeof raw!=='object'||typeof raw.name!=='string')continue;
  const name=raw.name.trim();
  // A character must visibly appear; unmentioned proposals cannot spawn.
  if(NAME.test(name)&&!BANNED.has(name)&&String(narrative).includes(name)&&!names.includes(name))
   names.push(name);
 }
 const created=[];
 for(const name of names.slice(0,3)){
  const known=Object.values(world.npcs).find(n=>n.name===name);
  if(known)continue;
  if(Object.keys(world.npcs).length>=NPC_LIMIT)break;
  const proposal=proposalsValid.find(p=>p?.name===name)||{};
  const location=world.location;
  // Only use explicitly narrated job and properties. Unknown is safe.
  const role=typeof proposal.role==='string'&&proposal.role.length<=60&&
   String(narrative).includes(proposal.role)?short(proposal.role,60):'身分待查';
  const traits=Array.isArray(proposal.traits)?
   proposal.traits.filter(t=>typeof t==='string'&&t.length<=20).slice(0,4):[];
  const id=newId(world),index=world.revision;
  world.npcs[id]={id,name,peak:typeof proposal.peak==='string'&&proposal.peak.length<=35?
   proposal.peak:'未歸屬',role,realm:'未公開',roots:'未公開',where:location,
   source:'ai-generated',createdAt:{day:world.day,minute:world.minute,revision:index},
   personality:short(proposal.personality||'尚待接觸了解',120),
   traits,speech:short(proposal.speech||'依實際對話表現',90),
   goal:short(proposal.goal||'依個人情況生活與行動',120),
   plan:short(proposal.plan||'暫無公開的固定安排',120),
   status:'健康',mood:'平靜',cultivationProgress:0,
   relationships:{player:{favor:0,trust:0,respect:0,impression:'初次接觸'}},
   memories:[],knowledge:[],privateNotes:[],ties:[],background:'新登場人物，背景尚待確認',
   aptitude:{grade:'未知',description:'尚未確認',bottleneck:'未知',growth:'未知',assessed:false}};
  created.push(id);
 }
 if(created.length){
  const agency=ensureNPCAgency(world),fresh=initialNPCAgency(world);
  for(const id of created)agency.agendas[id]=fresh.agendas[id];
 }
 // All currently evidenced named characters are explicit witnesses of the
 // introduction/conversation; avoid adding unknown bystanders.
 const mentions=Object.values(world.npcs).filter(n=>n.source==='ai-generated'&&
  (String(narrative).includes(n.name)||seenIds.includes(n.id))).map(n=>n.id);
 return {created,mentioned:mentions};
}

/** New arrivals do not know their server-assigned ID until the next turn. */
export function resolveNPCReferences(world,refs){
 if(!Array.isArray(refs)||refs.length>12)return null;
 const out=[];
 for(const ref of refs){
  if(typeof ref!=='string')return null;
  if(Object.hasOwn(world.npcs,ref)){out.push(ref);continue;}
  const matches=Object.values(world.npcs).filter(n=>n.name===ref);
  if(matches.length!==1)return null;
  out.push(matches[0].id);
 }
 return [...new Set(out)];
}
