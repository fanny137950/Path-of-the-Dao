/** Pacing is a player request, not a background simulation or a fixed outcome. */
export const FAST_FORWARD_LIMITS=[{minutes:60,label:'1 小時'},{minutes:1440,label:'1 天'},{minutes:10080,label:'7 天'},{minutes:43200,label:'30 天'}];
const fail=message=>{const error=new Error(message);error.status=422;throw error;};
export function fastForwardRequest(body){
 if(!FAST_FORWARD_LIMITS.some(x=>x.minutes===body.limitMinutes))fail('請選擇有效的快進時間上限。');
 if(body.target!==undefined&&(typeof body.target!=='string'||body.target.length>160))fail('快進目標最多160字。');
 return {limitMinutes:body.limitMinutes,target:(body.target||'').trim()};
}
export function fastForwardText(request){
 const label=FAST_FORWARD_LIMITS.find(x=>x.minutes===request.limitMinutes)?.label||'';
 return '快進：'+(request.target||'沿著目前生活，直到下一個值得參與的事件')+'（最多 '+label+'，遇到重大選擇就停下）。';
}
export function validDecision(value,narration){
 if(!value||typeof value!=='object'||typeof value.question!=='string'||!value.question.trim()||value.question.length>240||
 typeof value.evidence!=='string'||value.evidence.length<4||value.evidence.length>160||!narration.includes(value.evidence))return null;
 return {question:value.question.trim(),evidence:value.evidence};
}
export function currentDecision(world){
 const last=world.messages?.at(-1);
 return last?.role==='assistant'?validDecision(last.decision,last.content):null;
}
export function assertCanFastForward(world){
 if(currentDecision(world))fail('眼前還有需要你決定的事情。請選擇、拒絕，或自由輸入其他行動，再快進。');
}
export function validateFastForwardResult(world,parsed,request){
 fastForwardRequest(request);assertCanFastForward(world);
 if(!parsed.decisionReported)fail('GM 未確認快進後是否有待決事項，本回合未保存，請重試。');
 if(!Number.isInteger(parsed.elapsedMinutes)||parsed.elapsedMinutes<0||parsed.elapsedMinutes>request.limitMinutes)
  fail('GM 沒有提供有效的快進時間，本回合尚未保存。可以重試，或直接輸入你的行動。');
 if(parsed.elapsedMinutes===0&&!parsed.decision)fail('GM 尚未推進場景或提出需要你決定的事情，本回合未保存。');
 // A pending choice must not silently become a marriage, master or faction change.
 if(parsed.protagonist&&['master','sect'].some(key=>parsed.protagonist[key]!==undefined&&parsed.protagonist[key]!==world.protagonist[key]))
  fail('GM 在快進中替你決定了師承或所屬，本回合未保存。請用自由輸入明確選擇。');
}
export function fastForwardDirective(request){
 return `\n【玩家選擇快進】這是幕外節奏指令，不是洛河對 NPC 說的台詞。
最多前進 ${request.limitMinutes} 分鐘，目標：${request.target||'依目前情境略過例行日常，推進至下一個值得參與的事件'}。
以少量段落交代已授權的例行活動、世界進展與合理後果，然後具體演出下一個值得參與的場景。時間上限不是必須用完的時長；事件提早到來，就提早停下。
快進不表示同意新任務、拜師、立誓、戀愛、花費大筆資源、進入危險或主動戰鬥。遇到新的重大抉擇，在洛河答應或行動前停下，填寫 decision 與當下可行的 suggestions，也允許拒絕、離開或自由行動。NPC 仍可自主行動，已成立的後果不因暫停而消失。
不要把普通招呼、排隊或重複考核變成必停的選擇。若期間平靜，可以到達時間上限，說明真實的日常變化，不必強造危機。若目標需玩家先做重大決定，停在決定處，不保證目標已達成。
GM_STATE 必須包含實際經過的 elapsedMinutes（0 至 ${request.limitMinutes} 的整數）及 decision（需要決定時為 {question,evidence}，否則 null）。不要把上限誤填為實際時間。同步更新 workingMemory、知情記憶與相關 threads，保留秘密知情範圍。`;
}
export const CHOICE_PROTOCOL=`\n【選擇權與節奏】
玩家可以自由說話或行動。只有需要玩家作重大決定時才填 decision:{question,evidence}；question 用一句話說明眼前要決定什麼（最多240字），evidence 為本回合正文4至160字原文。普通招呼或例行動作不必設決策點。新的回覆不再需要決定時填 null。
decision 不是固定任務關卡：提供2至3個由當前劇情支持的 suggestions，讓選項有不同態度或行動方向；玩家也可以拒絕、離開、提出第四種做法。選項與問題只寫洛河可知內容，不透露預定結局、成功率或秘密。
玩家選了或明確輸入行動，就演出嘗試與結果，不重問是否確定；選擇不代表必然成功。保留原文與因果。`;
