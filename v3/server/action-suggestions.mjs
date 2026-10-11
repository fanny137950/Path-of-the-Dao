/**
 * Suggestions are OPTIONAL ways of expressing PLAYER actions, not world commands.
 * Never manufacture canon, new NPC knowledge, a completed event, or a choice
 * whose object is not in the visible current scene.
 */
const compact=x=>String(x??'').slice(-1800);
const offer=(label,text,kind='action')=>({label,text,kind});
const UNIQUE=(arr)=>arr.filter((x,i)=>arr.findIndex(y=>y.text===x.text)===i).slice(0,4);
export function suggestedActions(world){
 const last=[...(world.messages||[])].reverse().find(m=>m.role==='assistant');
 const narrative=compact(last?.content).replace(/<!--GM_STATE:[\s\S]*$/,'');
 const location=String(world.location||'');
 const focus=String(world.scene?.focus||'');
 const isRecruitment=location==='太虛宗山門';
 const untested=world.protagonist?.spiritualRoot==='未測定';
 const stone=/(測靈石|靈根測試石|測試石|測靈臺|測靈台)/.test(narrative)||focus==='測靈石';
 const ready=stone&&/(放|按|貼|觸|碰|手掌|掌心|石面|測試)/.test(narrative);
 const options=[];
 if(isRecruitment&&untested&&ready){
  options.push(offer('將手放上測靈石','我將手掌按在測靈石上，接受測試。'));
  options.push(offer('詢問測試規則','我先問韓守一：「測試時有哪些要注意的？」'));
 }else if(isRecruitment&&untested&&/(韓守一|收徒|名冊|登記)/.test(narrative)){
  options.push(offer('開始靈根測試','我對韓守一說：「我準備好了，開始測試吧。」'));
  options.push(offer('詢問收徒方式','我問韓守一：「測完靈根後，會怎麼安排弟子？」'));
 }else if(isRecruitment&&!untested){
  options.push(offer('詢問測試結果','我問韓守一：「這次測出的靈根意味著什麼？」'));
  if(/(韓守一|執事|名冊)/.test(narrative))options.push(offer('詢問接下來的安排','我問韓守一：「接下來的收徒流程是什麼？」'));
 }else if(/(演武場|切磋|劍坪|比試)/.test(narrative)){
  options.push(offer('觀察對手的動作','我仔細觀察對方的站姿與出手習慣，暫不出招。'));
 }else if(/(藏經樓|古籍|典籍)/.test(narrative)){
  options.push(offer('查看附近書目','我查看眼前能借閱的書目，不擅闖禁區。'));
 }
 // Universal choices must not dictate player speech, teleport, or auto-resolve.
 options.push(offer('先觀察四周','我暫時不行動，觀察在場人物的動作與周圍變化。'));
 // Distinct from player actions: invites GM to progress independent NPC/world
 // beats while keeping protagonist choices under player control.
 options.push(offer('交給 GM 推進','繼續','advance'));
 return UNIQUE(options);
}
