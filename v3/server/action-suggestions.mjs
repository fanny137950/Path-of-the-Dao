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
  if(result.length===4)break;
 }
 return result;
}
export function suggestedActions(world){
 const last=world.messages?.at(-1);
 if(last?.role!=='assistant')return [];
 const validated=validateSuggestions(last.suggestions,visibleNarrative(last.content))
  .map(({label,text,kind})=>({label,text,kind}));
 // Safe fallbacks for responses from models that omit structured suggestions.
 // These propose player *intent*, not outcomes, facts, NPC knowledge or locations.
 if(validated.length)return validated;
 return [
  {label:'仔細觀察',text:'先仔細觀察眼前的情況，不急著做決定。',kind:'action'},
  {label:'了解更多',text:'詢問目前能夠交談的人，想知道更多眼前事情的細節。',kind:'action'},
  {label:'靜待片刻',text:'暫時不表態，留在原處看看接下來會發生什麼。',kind:'action'},
 ];

}
