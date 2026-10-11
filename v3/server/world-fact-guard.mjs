/**
 * Strict, narrow guard for factual narrative assertions, not for characters'
 * possible lies, conjectures or private opinions.
 */
const ROOTS=['純風靈根','風水雙靈根','風金雙靈根','水木雙靈根','火土雙靈根','金土雙靈根','風木雙靈根','冰金雙靈根','水靈根','火靈根','金靈根','木靈根','土靈根','風靈根'];
const cut=s=>String(s||'').replace(/<!--GM_STATE:[\s\S]*?-->\s*$/,'');
const segments=text=>cut(text).split(/[。！？\n]/u).map(x=>x.trim()).filter(Boolean);
const uncertain=s=>/(?:聽說|据说|據說|似乎|難道|莫非|以為|誤認|猜測|傳聞|如果|假如|可能|有人說|不是|並非|並不|錯認|錯誤|誤會|謠言|謠傳|自稱)/u.test(s);
export function checkWorldFacts(world,reply){
 const errors=[],canonical=world?.protagonist?.spiritualRoot;
 if(canonical&&canonical!=='未測定'&&canonical!=='未知'){
  for(const sentence of segments(reply)){
   if(uncertain(sentence)||/^[「『]/u.test(sentence)||/：「/u.test(sentence))continue;
   const assertion=sentence.match(/(?:洛河|你的|她的|你這|妳的|你是|妳是|測試結果|測靈石顯示|靈根屬性)[^，；：]{0,32}(?:靈根(?:是|為|屬)|(?:是|為|屬於|顯示|測出|測得))\s*(純風靈根|風水雙靈根|風金雙靈根|水木雙靈根|火土雙靈根|金土雙靈根|風木雙靈根|冰金雙靈根|[金木水火土風]靈根)/u);
   if(assertion&&assertion[1]!==canonical&&ROOTS.includes(assertion[1]))
    errors.push({code:'wrong-root',detail:'洛河既定為'+canonical+'，卻斷言'+assertion[1]});
  }
 }
 const now=(world.day-1)*1440+world.minute;
 for(const e of world.eventCalendar?.events||[]){
  if(e.state==='cancelled'||e.start<=now||e.start>now+1440)continue;
  const name=e.id==='twelve-peaks-selection'?'十二峰初選':e.name;
  if(cut(reply).includes(name)&&/(?:已經|已|正式)(?:開始|開幕|啟動)/.test(cut(reply).slice(cut(reply).indexOf(name),cut(reply).indexOf(name)+40))&&
    !/尚未|未曾|不曾|將在|預定/.test(cut(reply)))
   errors.push({code:'future-event',detail:name+'尚未開始'});
 }
 return {ok:errors.length===0,errors};
}
export function correctionDirective(check){
 return '\n\n【世界事實校驗不通過】上一份草稿有以下矛盾：'+
 check.errors.map(e=>e.detail).join('；')+
 '。請重新生成整回合，保留自然對話與NPC獨立性，切勿改寫已確定資料或把未到時的活動說成開始。伺服器尚未保存上一份草稿。';
}
