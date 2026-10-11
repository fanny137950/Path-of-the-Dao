/**
 * Scene continuity is not a story rail: this only tracks the concrete objects
 * and conversation focus that the player can presently refer to.
 * Each world stores its own scene independently of the wider world location.
 */
const brief=(value,max=330)=>typeof value==='string'?value.trim().slice(-max):'';
const HAND_ON_STONE=/^(?:(?:我|洛河)?(?:把)?(?:手|手掌|掌心|手指)?)(?:放|按|貼|碰|摸|伸)(?:上去|上面|上|到上面|到石頭上|上去了)(?:了)?[。.!！]?$/;
const STONE=/測靈石|靈根測試石|測試石/;
const HAND_ACTION=/把手|手掌|掌心|指尖|伸手|按上|放上|貼上|觸碰/;

export function initialScene(){
 return {focus:'收徒登記',lastBeat:'韓守一已核對洛河的姓名，洛河可自由與他交談或參加測試。',
  activeSpeaker:'韓守一',at:'太虛宗山門'};
}
export function sceneOf(world){
 const old=world.scene;
 if(old&&typeof old==='object'&&typeof old.focus==='string'&&typeof old.lastBeat==='string')return old;
 const fallback=initialScene();
 const last=[...(world.messages||[])].reverse().find(m=>m?.role==='assistant'&&typeof m.content==='string');
 if(last)return updateScene({...fallback},last.content,world.location);
 return fallback;
}
export function updateScene(scene,narration,location){
 const next={...scene,lastBeat:brief(narration),at:location};
 if(STONE.test(narration)&&HAND_ACTION.test(narration))next.focus='測靈石';
 else if(/(?:完成|確認|測得|測出).{0,15}(?:靈根|測試結果)/.test(narration))next.focus='測試結果';
 else if(/(?:報到處|領取日課冊|領取住處)/.test(narration))next.focus='外門報到';
 // A change of world location invalidates stale physical interaction focus.
 if(scene.at&&scene.at!==location&&!STONE.test(narration))next.focus='當前地點';
 if(/韓守一/.test(narration))next.activeSpeaker='韓守一';
 else if(/許秋雁/.test(narration))next.activeSpeaker='許秋雁';
 else if(/沈滄月/.test(narration))next.activeSpeaker='沈滄月';
 else if(/晏清辭/.test(narration))next.activeSpeaker='晏清辭';
 return next;
}
export function resolvePlayerReference(world,text){
 const raw=String(text||'').trim();
 const scene=sceneOf(world);
 if(scene.focus==='測靈石'&&HAND_ON_STONE.test(raw))
  return {raw,interpreted:'洛河把手掌按在面前的測靈石上，開始靈根測試。',kind:'touch-spirit-stone'};
 return {raw,interpreted:raw,kind:'literal'};
}
export function sceneContext(world,text){
 const scene=sceneOf(world),resolution=resolvePlayerReference(world,text);
 return '【連續場景錨點】大地點：'+world.location+'；場景焦點：'+scene.focus+
  '；目前交談者：'+scene.activeSpeaker+'。上一段實際場景：'+brief(scene.lastBeat,340)+
  '\n【玩家動作指代】'+(resolution.kind==='literal'?'照玩家原文理解。':
    '玩家短句「'+resolution.raw+'」已依上一回合物件指代為「'+resolution.interpreted+
     '」。這是玩家將手放在石頭上，不是玩家搬動石頭；請直接完成測試結果，不要再次要求她放手。');
}
