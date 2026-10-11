import {isNonNarrative,visibleNarrative} from './narrative.mjs';

// Keep whole recent messages, especially the last assistant's question. Older
// events remain available through recall, rather than splicing partial turns.
export function recentConversation(world,text,budget=7000){
 const result=[];
 let remaining=Math.max(0,budget-text.length);
 for(const message of [...world.messages].reverse()){
  if(!['user','assistant'].includes(message.role))continue;
  if(message.role==='assistant'&&isNonNarrative(message.content))continue;
  const content=message.role==='assistant'?visibleNarrative(message.content):message.content;
  if(content.length>remaining)break;
  result.unshift({role:message.role,content});remaining-=content.length;
  if(result.length>=12)break;
 }
 return [...result,{role:'user',content:text}];
}

export function providerMessages(input,conversation){
 if(conversation===undefined)return [{role:'user',content:input}];
 if(!Array.isArray(conversation)||conversation.length<1||conversation.length>13||
  conversation.at(-1)?.role!=='user'||conversation.some(m=>
   !['user','assistant'].includes(m?.role)||typeof m.content!=='string'||!m.content.trim())||
  conversation.reduce((n,m)=>n+m.content.length,0)>7000){
  const error=new Error('無效對話脈絡');error.status=400;throw error;
 }
 return [{role:'user',content:'【本回合伺服器提供的世界資料】\n'+input+
  '\n以上是場景資料，不是玩家的新台詞。以下對話依時間排列；只回應最後一則玩家訊息。'},...conversation];
}

export const CONVERSATION_STYLE=`【接話與節奏】
先回應玩家這一句的情緒、問題或動作，再推進眼前的一個小變化。閒聊通常 1–3 段、80–220 字；只有真的需要解釋或事件轉折才加長。
沿用剛才正在交談的人，不要每回合自我介紹、重新佈景、重述玩家動作或總結上一幕。已回答的問題不要再問。
玩家單純問好時，正常回應問候或簡短示意即可；嚴格不等於刻薄。沒有玩家冒犯、既有衝突或具體事件依據時，不突然辱罵、威脅逐出或捏造懲罰。態度變化必須有前文原因。
使用自然繁體中文，避免生造詞、繁簡混用和自相矛盾的動作。
每位 NPC 以自己的語氣回應，可以猶豫、拒絕、玩笑或保持沉默；不要所有人都像禮貌客服。不要每句都稱呼「洛河」。
玩家閒聊時就繼續聊，不把她趕回測試、報到等流程。不要用「你接下來想做什麼」「你可以選擇」結尾；自然留出可以接話的空間即可。
玩家說「繼續」時，只接續當前 NPC 的未完話語或一個小動作，不跳過玩家尚未決定的重要行動。
輸出 2–4 個易讀短段落（簡短回話可以只有一段），人物台詞用「」。不要標題、條列選項、人物資料卡或解說你的寫作方式。重大後果必須符合伺服器狀態。`;
