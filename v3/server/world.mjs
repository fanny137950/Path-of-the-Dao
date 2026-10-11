// Deterministic V3 prototype world model. Only server may commit this state.
export const V3_INTRO='太虛宗收徒大典，山門前人潮如織。高臺上，負責測試靈根的執事抬起眼。\n\n「下一位。姓名？」\n\n你是十五歲的洛河，今日第一次踏入太虛宗。';
export const NPCS=Object.freeze({
 shen:{name:'沈滄月',realm:'元嬰後期',where:'棲風峰',goal:'指導門下弟子',knowledge:[]},
 yan:{name:'晏清辭',realm:'金丹初期',where:'棲風峰',goal:'修煉與宗務',knowledge:[]},
 jiang:{name:'江離',realm:'築基後期',where:'棲風峰',goal:'修煉與照顧同門',knowledge:[]},
 gu:{name:'顧長青',realm:'築基中期',where:'棲風峰',goal:'修煉',knowledge:[]},
});
export function initialV3World(id) {
 return {id,mode:'v3',revision:0,minute:8*60,day:1,location:'太虛宗山門',
  protagonist:{name:'洛河',age:15,realm:'凡人',spiritualRoot:'未測定'},
  npcs:structuredClone(NPCS),
  events:[],messages:[{role:'assistant',content:V3_INTRO}],};
}
export function validatedWorld(value) {
 if(!value||value.mode!=='v3'||!Array.isArray(value.messages)||!Array.isArray(value.events)
 ||!Number.isInteger(value.minute)||!Number.isInteger(value.revision)||!value.npcs)throw Error('世界資料損毀');
 return value;
}
export function playerWorld(world) {
 return {id:world.id,revision:world.revision,day:world.day,minute:world.minute,
  location:world.location,protagonist:world.protagonist,messages:world.messages};
}
export function gmContext(world, userText) {
 // Never include hidden NPC details or offscreen secrets in this transcript.
 const recent=world.messages.slice(-22).map(m=>`${m.role==='user'?'洛河':'GM'}：${m.content}`).join('\n\n');
 return `【由伺服器保存的世界事實】第${world.day}日，${Math.floor(world.minute/60).toString().padStart(2,'0')}:${String(world.minute%60).padStart(2,'0')}，地點：${world.location}。主角：${world.protagonist.name}，${world.protagonist.age}歲，境界：${world.protagonist.realm}，靈根：${world.protagonist.spiritualRoot}。NPC 的修為與位置由伺服器設定，不應無故改變。\n\n【最近對話】\n${recent}\n\n洛河：${userText}`;
}
export function commitV3Turn(world, userText, answer, requestId) {
 if(typeof userText!=='string'||!userText.trim()||userText.length>2500)throw Error('玩家輸入無效');
 if(typeof answer!=='string'||!answer.trim()||answer.length>10000)throw Error('GM 回覆無效');
 if(world.events.some(e=>e.requestId===requestId))throw Error('重複回合');
 if(world.events.length>=1000)throw Error('試玩世界已達1000回合，請先備份');
 const next=structuredClone(world);
 next.revision++;
 next.minute+=5;
 if(next.minute>=1440){next.minute-=1440;next.day++;}
 next.messages.push({role:'user',content:userText},{role:'assistant',content:answer});
 next.events.push({requestId,revision:next.revision,day:next.day,minute:next.minute,type:'conversation',text:userText,reply:answer});
 return next;
}
