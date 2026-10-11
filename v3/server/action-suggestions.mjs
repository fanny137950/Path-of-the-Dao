/** GM-authored, optional drafts attached only to the latest narration.
 * Evidence grounds each draft in player-visible prose, never private records.
 * Missing/invalid metadata means no buttons, including for older saves.
 */
import {visibleNarrative} from './narrative.mjs';
export function validateSuggestions(value,narration){
 if(!Array.isArray(value))return [];
 const result=[];
 for(const item of value.slice(0,12)){
  if(!item||typeof item!=='object')continue;
  const {label,text,evidence}=item;
  if(typeof label!=='string'||typeof text!=='string'||typeof evidence!=='string')continue;
  if(!label.trim()||label.length>32||!text.trim()||text.length>240||evidence.trim().length<4||evidence.length>160)continue;
  if(!narration.includes(evidence)||/[<>\r\n]/.test(label+text+evidence))continue;
  if(result.some(x=>x.text===text.trim()||x.label===label.trim()))continue;
  result.push({label:label.trim(),text:text.trim(),evidence,kind:'action'});
  if(result.length===3)break;
 }
 return result;
}
export function suggestedActions(world){
 const last=world.messages?.at(-1);
 if(last?.role!=='assistant')return [];
 return validateSuggestions(last.suggestions,visibleNarrative(last.content))
  .map(({label,text,kind})=>({label,text,kind}));
}
