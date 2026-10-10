import HISTORY from '../../data/character-history.json' with {type:'json'};
export const EXPRESSIONS=['calm','joy','displeased','worried','sad','surprised'];
export const EXPRESSION_LABELS={calm:'平靜',joy:'喜悅',displeased:'不悅',worried:'擔憂',sad:'悲傷',surprised:'驚訝'};
// These modest, authored episodes are the only new historical anchors the
// director may elaborate. Dialogue embellishments remain attributed claims.
export function historyFor(id){return HISTORY[id]||[];}
export function performanceOf(beat,cast,target,allowedHistory=historyFor(beat.speaker).map(h=>h.id)){
 const to=beat.to??(beat.speaker==='player'?target:'player');
 if(to!==null&&!['all','player',...cast].includes(to))throw Error('接話對象不在場');
 const expression=beat.expression??'calm';
 if(!EXPRESSIONS.includes(expression))throw Error('表情不在已登記範圍');
 const delivery=beat.delivery??'';
 if(typeof delivery!=='string'||delivery.length>80)throw Error('演出描述過長');
 const historyRefs=beat.historyRefs??[];
 if(!Array.isArray(historyRefs)||historyRefs.length>3||historyRefs.some(id=>!allowedHistory.includes(id)))throw Error('人物往事缺少正式依據');
 return {to,expression,delivery,historyRefs};
}
// Presentation never changes the addressed character or creates another turn.
export function playbackMessages(messages,visibleThrough){return visibleThrough==null?messages:messages.filter(m=>m.seq<=visibleThrough);}
export function currentPerformance(messages,target){const m=messages.findLast(m=>m.speaker!=='narrator');return {speaker:m?.speaker||target,expression:m?.performance?.expression||'calm',delivery:m?.performance?.delivery||'',to:m?.performance?.to||null};}
export function portraitSource(art,id,expression='calm'){return art.expressions?.[id]?.[expression]||art.portraits[id]||art.portraits.shen;}
