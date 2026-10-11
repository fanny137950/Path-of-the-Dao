/** Optional drafts, never automatic actions or assertions about an outcome. */
export function replySuggestions(world){
 const present=Object.values(world.npcs||{}).filter(actor=>actor.where===world.location);
 const speaker=present.find(actor=>actor.name===world.scene?.activeSpeaker)||present[0];
 const recent=world.messages?.filter(m=>m.role==='assistant').at(-1)?.content||'';
 const person=speaker?.name;
 const suggestions=[];
 if(person){
  if(/別以為|趕緊|趕緒|否則|耽誤|斥責|不耐煩|皺眉|皱眉/.test(recent))
   suggestions.push({label:'回應他的態度',text:`我問${person}：「我只是想打聲招呼，為什麼這麼說？」`});
  else suggestions.push({label:'接著聊聊',text:`我問${person}：「你今天一直在這裡忙嗎？」`});
 }
 if(world.location==='太虛宗山門'&&world.protagonist?.spiritualRoot==='未測定'){
  if(world.scene?.focus==='測靈石')suggestions.push({label:'開始測靈根',text:'我把手掌按在面前的測靈石上，開始測試。'});
  else suggestions.push({label:'問問測試方式',text:person?`我問${person}：「靈根測試要怎麼做？有什麼需要注意的？」`:'我看看附近的靈根測試是怎麼進行的。'});
 }else if(person)suggestions.push({label:'追問剛才的話',text:`我問${person}：「你剛才那句話是什麼意思？」`});
 suggestions.push({label:'看看周圍',text:'我暫時不說話，留意周圍正在發生的事。'});
 return suggestions.slice(0,3);
}
