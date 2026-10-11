import {visibleNarrative} from './narrative.mjs';
import {pendingRootResult} from './action-rules.mjs';

/**
 * Prevent a single low-quality free model turn from leaving an already-touched
 * spirit stone unresolved. This only resolves objective results, not story rails.
 *
 * A refused/blocked action remains refused; the GM is free to have NPCs object.
 */
export function stabilizeDecisiveAction(world,playerText,raw){
 const root=pendingRootResult(world,playerText);
 if(!root)return raw;
 const narrative=visibleNarrative(raw);
 if(/(?:不准|不許|攔住|阻止|擋下|拒絕|尚未|還沒|未能|無法|沒有碰到|沒能接觸|來不及)/.test(narrative))
  return raw;
 // The GM successfully narrated the correct objective result.
 if(narrative.includes(root)&&/(?:測靈石|靈根|測試|石面|晶石)/.test(narrative))
  return raw;
 // A free model may put the entire stone into Luohe's hands or stall before
 // determining the root. A narrow canonical fallback beats writing a false
 // completed test into NPC memories and later chapters.
 return '洛河將手掌按在測靈石表面。石中的陣紋依次亮起，光芒逐漸穩定。\n\n'+
  '韓守一仔細查看記錄，將結果寫入玉簡。\n\n「'+root+'。」他抬起頭，語氣平實。'+
  '「測試完成了。你若有疑問，可以現在問我。」\n\n'+
  '一旁的弟子正準備迎接下一位測試者，山門仍舊熱鬧。';
}
