import {resolvePlayerReference} from './scene-context.mjs';
/** Minimal irreversible-rule checks. Nothing here forces a story stage. */
const ROOTS=['風靈根','風水雙靈根','金靈根','水靈根','木靈根','火靈根','土靈根','水木雙靈根','純風靈根'];
export function preseededRoot(id){
 let hash=2166136261;
 for(const ch of String(id)){hash=Math.imul(hash^ch.charCodeAt(0),16777619);}
 return ROOTS[(hash>>>0)%ROOTS.length];
}
export function pendingRootResult(world,text){
 if(world.protagonist.spiritualRoot!=='未測定'||world.location!=='太虛宗山門')return null;
 const resolved=resolvePlayerReference(world,text);
 const input=resolved.interpreted;
 if(/(?:不按|不放|不要|不碰|不測|先別|先不|拒絕|收回手|只是問|假裝|沒有按|沒按)/.test(input))return null;
 const actorAction=/(?:手|掌|指).{0,14}(?:貼|按|放|觸|碰|摸|伸)/.test(input)||
  /(?:貼|按|放|觸|碰|摸).{0,14}(?:測靈石|靈石|石面|測試石)/.test(input)||
  /(?:測靈根|接受靈根測試)/.test(input);
 return actorAction?preseededRoot(world.id):null;
}
export function rootResultConfirmed(world,text,narration){
 const root=pendingRootResult(world,text);
 return root&&narration.includes(root)&&/(?:測靈|靈根|測試|石面)/.test(narration)?root:null;
}
