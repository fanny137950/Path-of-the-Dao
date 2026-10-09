// @ts-nocheck
import {env} from 'cloudflare:workers';
import {getDb} from '../../../db';
import {worlds,saves,eventLedger,knowledge,turnCommits,storyMessages,storyRequests,sealedTruths} from '../../../db/schema';
import {eq,and,desc,lt,sql} from 'drizzle-orm';
import {getChatGPTUser} from '../../chatgpt-auth';
import {ledgerWrites} from '../../../lib/game/persistence';
import {initialStory,playerView} from '../../../lib/story/world.mjs';
import {localAction} from '../../../lib/story/dialogue.mjs';
import {prepareScene} from '../../../lib/story/scene.mjs';
import {isDeveloper,developerView} from '../../../lib/story/developer.mjs';
import {connection,PROVIDERS} from '../../../lib/story/providers.mjs';
export const dynamic='force-dynamic';
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const hash=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
function messagesWrites(db,s){return s.messages.map(m=>db.insert(storyMessages).values({...m,world:s.id,audience:JSON.stringify(m.audience),performance:JSON.stringify(m.performance||{})}));}
async function messages(db,world,actor='player',before=2147483647,limit=60){const rows=await db.select().from(storyMessages).where(and(eq(storyMessages.world,world),lt(storyMessages.seq,before),sql`EXISTS (SELECT 1 FROM json_each(${storyMessages.audience}) WHERE value=${actor})`)).orderBy(desc(storyMessages.seq)).limit(limit);return rows.reverse().map(r=>({...r,audience:JSON.parse(r.audience),performance:JSON.parse(r.performance||'{}')}));}
async function memories(db,world,actor,q='',limit=80){let conditions=[eq(eventLedger.world,world),eq(knowledge.actor,actor)];if(q)conditions.push(sql`instr(${eventLedger.content},${q}) > 0`);const rows=await db.select({data:eventLedger.data}).from(eventLedger).innerJoin(knowledge,and(eq(eventLedger.world,knowledge.world),eq(eventLedger.id,knowledge.event))).where(and(...conditions)).orderBy(desc(eventLedger.minute),desc(eventLedger.id)).limit(limit);return rows.map(r=>JSON.parse(r.data));}
async function npcMemories(db,world,actor,text){const recent=await memories(db,world,actor,'',24);const important=await db.select({data:eventLedger.data}).from(eventLedger).innerJoin(knowledge,and(eq(eventLedger.world,knowledge.world),eq(eventLedger.id,knowledge.event))).where(and(eq(eventLedger.world,world),eq(knowledge.actor,actor),sql`${eventLedger.type} IN ('enroll','promise','promise-fulfilled','promise-missed','promise-report','growth-observed','news','npc-growth','personal-memory')`)).orderBy(desc(eventLedger.minute)).limit(48);const match=text?.trim()?await memories(db,world,actor,text.trim().slice(0,30),12):[];return [...new Map([...important.map(r=>JSON.parse(r.data)),...recent,...match].map(e=>[e.id,e])).values()];}
async function view(db,s){return {...playerView(s),messages:(await messages(db,s.id)).map(({audience,world,...m})=>m)};}
export async function GET(request:Request){return handle(request);}
export async function POST(request:Request){return handle(request);}
async function handle(request:Request){let db,claim=null;try{
 if(request.method==='POST'&&request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'拒絕跨來源提交'},403);
 const user=await getChatGPTUser();if(!user)return json({error:'請先登入以保護你的世界線',signin:'/signin-with-chatgpt?return_to=%2F'},401);
 const owner=user.userId;db=getDb();const raw=request.method==='POST'?await request.text():'';if(raw.length>16000)throw Error('請求過長');const b=raw?JSON.parse(raw):{op:'list'};
 if(b.op==='list'){const ws=await db.select({id:worlds.id,name:worlds.name,revision:worlds.revision}).from(worlds).where(and(eq(worlds.owner,owner),sql`json_extract(${worlds.state},'$.mode')='story-v1'`));const sv=await db.select({id:saves.id,world:saves.world,name:saves.name,created:saves.created}).from(saves).where(and(eq(saves.owner,owner),sql`json_extract(${saves.state},'$.mode')='story-v1'`));return json({worlds:ws,saves:sv,isDeveloper:isDeveloper(owner,env),configured:Object.fromEntries(Object.entries(PROVIDERS).map(([k,p])=>[k,!!env[p.key]]))});}
 if(b.op==='new'){const id=crypto.randomUUID(),s=initialStory(id);await db.batch([db.insert(worlds).values({id,owner,name:String(b.name||'棲風峰 · 初識').slice(0,60),state:JSON.stringify(s),created:new Date().toISOString()}),db.insert(sealedTruths).values({world:id,id:s.truth.id,hash:await hash(JSON.stringify(s.truth)),data:JSON.stringify(s.truth)}),...await ledgerWrites(db,s),...messagesWrites(db,s)]);return json(await view(db,s));}
 let w,s;if(b.op==='restore'){const [sv]=await db.select().from(saves).where(and(eq(saves.id,b.save),eq(saves.owner,owner)));if(!sv)throw Error('找不到存檔');s=JSON.parse(sv.state);[w]=await db.select().from(worlds).where(and(eq(worlds.id,sv.world),eq(worlds.owner,owner)));}else{[w]=await db.select().from(worlds).where(and(eq(worlds.id,b.world),eq(worlds.owner,owner)));if(w)s=JSON.parse(w.state);}if(!w||s?.mode!=='story-v1')throw Error('找不到這條對話世界線');
 if(b.op==='developer'){if(!isDeveloper(owner,env))return json({error:'只有指定開發者可以查看此面板'},403);const actor=['player','shen','yan','jiang','gu'].includes(b.actor)?b.actor:'shen';const known=await memories(db,w.id,actor,'',80);return json({...developerView(s),selectedActor:actor,actorMemories:known});}
 if(b.op==='load')return json(await view(db,s));
 if(b.op==='messages')return json({messages:(await messages(db,w.id,'player',Number(b.before)||2147483647)).map(({audience,world,...m})=>m)});
 if(b.op==='memory'){const events=await memories(db,w.id,'player',String(b.q||'').slice(0,200),200);return json({events:events.map(({knowers,...e})=>e),limit:200});}
 if(b.op==='save'){const id=crypto.randomUUID();await db.insert(saves).values({id,owner,world:w.id,name:String(b.name||`第 ${Math.floor(s.time/1440)+1} 日 · 第 ${s.revision} 回合`).slice(0,60),state:w.state,created:new Date().toISOString()});return json({saved:id});}
 if(b.op==='branch'||b.op==='restore'){
 const source=w.id,id=crypto.randomUUID(),cutEvent=s.eventSeq,cutMessage=s.messageSeq;const next=JSON.parse(JSON.stringify(s).split(source+':').join(id+':'));next.id=id;next.revision=0;next.branchOrigin={world:source,revision:s.revision};next.events=[];next.messages=[];
 const suffix=source.length+1,digits=source.length+3;
 const stmt=(query,args)=>env.DB.prepare(query).bind(...args),truthData=JSON.stringify(next.truth);
 await env.DB.batch([
 stmt('INSERT INTO worlds(id,owner,name,revision,state,created) VALUES (?,?,?,?,?,?)',[id,owner,String(b.name||'記憶分支').slice(0,60),0,JSON.stringify(next),new Date().toISOString()]),
 stmt('INSERT INTO event_ledger(world,id,minute,type,location,content,source,data) SELECT ?,?||substr(id,?),minute,type,location,content,source,replace(replace(data,?,?),?,?) FROM event_ledger WHERE world=? AND CAST(substr(id,?) AS INTEGER)<=?',[id,id,suffix,source+':',id+':','"timeline":"'+source+'"','"timeline":"'+id+'"',source,digits,cutEvent]),
 stmt('INSERT INTO actor_knowledge(world,actor,event,acquired,status) SELECT ?,actor,?||substr(event,?),acquired,status FROM actor_knowledge WHERE world=? AND CAST(substr(event,?) AS INTEGER)<=?',[id,id,suffix,source,digits,cutEvent]),
 stmt('INSERT INTO story_messages(world,id,seq,minute,location,speaker,kind,content,audience,event,performance) SELECT ?,?||substr(id,?),seq,minute,location,speaker,kind,content,audience,CASE WHEN event IS NULL THEN NULL ELSE ?||substr(event,?) END,performance FROM story_messages WHERE world=? AND seq<=?',[id,id,suffix,id,suffix,source,cutMessage]),
 stmt('INSERT INTO sealed_truths(world,id,hash,data) VALUES (?,?,?,?)',[id,next.truth.id,await hash(truthData),truthData])
 ]);return json(await view(db,next));}
 if(b.op==='turn'){const truthData=JSON.stringify(s.truth);await db.insert(sealedTruths).values({world:w.id,id:s.truth.id,hash:await hash(truthData),data:truthData}).onConflictDoNothing();const [sealed]=await db.select().from(sealedTruths).where(and(eq(sealedTruths.world,w.id),eq(sealedTruths.id,s.truth.id)));if(!sealed||sealed.hash!==await hash(truthData))throw Error('事件真相與封存版本不符，未提交回合');}
 if(b.op!=='turn')throw Error('未知操作');if(typeof b.requestId!=='string'||!/^[-\w]{8,100}$/.test(b.requestId))throw Error('缺少有效回合 ID');
 const [receipt]=await db.select().from(turnCommits).where(and(eq(turnCommits.world,w.id),eq(turnCommits.request,b.requestId)));const fingerprint=await hash(JSON.stringify({revision:b.revision,text:b.text||'',action:b.action||null,target:b.target||null,provider:b.provider||null,model:b.model||null}));
 const [old]=await db.select().from(storyRequests).where(and(eq(storyRequests.world,w.id),eq(storyRequests.request,b.requestId)));if(old&&old.fingerprint!==fingerprint)return json({error:'同一回合 ID 不可替換內容，請重新載入。',conflict:true},409);if(receipt)return json({...await view(db,s),replayed:true});
 if(b.revision!==s.revision)return json({error:'另一回合已更新世界，請重新載入。',conflict:true},409);
 const text=String(b.text||'');if(text.length>2000)throw Error('每回合請控制在 2,000 字以內');if(!text.trim()&&!b.action)throw Error('請輸入對白或行動');
 if(b.action&&!['move','wait','train','observe','consume','promise','report-promise','system','remember','personality-edit','incident'].includes(b.action.kind))throw Error('此直接行動不開放');
 if(b.action?.kind==='personality-edit'&&!isDeveloper(owner,env))return json({error:'只有指定開發者可以調整演出設定'},403);
 const action=b.action||localAction(text);const needsAI=!action||['continue','speak','gesture'].includes(action.kind);const c=needsAI?connection(b,env):null;
 const now=Date.now();if(old?.status==='processing'&&old.expires>now)return json({error:'同一回合仍在生成，稍後用原回合重試。',pending:true},409);
 const [{count}]=await db.select({count:sql`count(*)`}).from(storyRequests).where(and(eq(storyRequests.world,w.id),sql`${storyRequests.created}>${now-60000}`));if(count>=12&&!old)throw Error('一分鐘最多提交十二個回合，請稍候。');
 const lease=crypto.randomUUID();if(old){const updated=await db.update(storyRequests).set({status:'processing',lease,expires:now+120000}).where(and(eq(storyRequests.world,w.id),eq(storyRequests.request,b.requestId),sql`(${storyRequests.status}='failed' OR ${storyRequests.expires}<=${now})`)).returning();if(!updated.length)throw Error('回合仍在處理中');}else await db.insert(storyRequests).values({world:w.id,request:b.requestId,fingerprint,status:'processing',lease,expires:now+120000,created:now});
 claim={world:w.id,request:b.requestId,lease};const target=b.target||s.scene.target;const memory=target?await npcMemories(db,w.id,target,text):[];const history=target?await messages(db,w.id,target,2147483647,30):[];
 let submitted=b.action;if(submitted?.kind==='remember'){const [m]=await db.select().from(storyMessages).where(and(eq(storyMessages.world,w.id),eq(storyMessages.id,submitted.message)));if(!m||m.speaker==='narrator'||!JSON.parse(m.audience).includes('player'))throw Error('找不到可保留的對話');const [exists]=await db.select({id:eventLedger.id}).from(eventLedger).where(and(eq(eventLedger.world,w.id),eq(eventLedger.type,'personal-memory'),sql`json_extract(${eventLedger.data},'$.changes.message')=${m.id}`)).limit(1);if(exists)throw Error('這段話已是重要記憶');submitted={kind:'remember',sourceMessage:{...m,audience:JSON.parse(m.audience)}};}
 const {state:next}=await prepareScene({state:s,text,action:submitted,target,connection:c,memories:memory,transcript:history});
 await db.batch([db.insert(turnCommits).values({world:w.id,request:b.requestId,revision:next.revision,result:JSON.stringify({revision:next.revision,lease})}),db.update(worlds).set({state:JSON.stringify(next),revision:next.revision}).where(and(eq(worlds.id,w.id),eq(worlds.revision,s.revision))),...await ledgerWrites(db,next),...messagesWrites(db,next),db.update(storyRequests).set({status:'committed'}).where(and(eq(storyRequests.world,w.id),eq(storyRequests.request,b.requestId),eq(storyRequests.lease,lease)))]);
 claim=null;return json(await view(db,next));
 }catch(e){if(claim)try{await db.update(storyRequests).set({status:'failed'}).where(and(eq(storyRequests.world,claim.world),eq(storyRequests.request,claim.request),eq(storyRequests.lease,claim.lease),eq(storyRequests.status,'processing')));}catch{}const m=e instanceof Error?e.message:'操作失敗';if(/conflict|UNIQUE constraint|turn_revision_unique/.test(m))return json({error:'回合已被其他請求更新，請重新載入再確認。',conflict:true},409);if(/D1_|SQLITE|no such table/.test(m))return json({error:'資料庫操作未完成，請稍後重試；未提交部分回合。'},500);return json({error:m},400);}}
