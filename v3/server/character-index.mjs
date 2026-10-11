/**
 * Deterministic read-only directory hierarchy for the V3 developer panel.
 * Characters stay keyed by permanent ID. Affiliation (peak) is not physical location.
 */
const DEFAULT_PEAKS=[
 '主峰','棲風峰','赤霄峰','天劍峰','丹霞峰','玄機峰','靈獸峰','鑄天峰',
 '戒律峰','青雲峰','望月峰','長明峰',
];
const RANK_LABELS=[
 '宗主與掌門','峰主','長老與護法','親傳弟子','內門弟子','外門弟子',
 '宗門執事與職務人員','其他人物',
];
const REALM_ORDER=['凡人','鍛體','聚氣','築基','金丹','元嬰','化神','洞虛','合道','渡劫'];
const REALM_STAGES=['初期','中期','後期','圓滿'];
const norm=value=>String(value??'').trim().toLocaleLowerCase('zh-Hant');

function rankOf(character){
 const role=String(character.role||'');
 if(/宗主|掌門/.test(role))return 0;
 if(/峰主/.test(role))return 1;
 if(/長老|護法|太上/.test(role))return 2;
 if(/親傳/.test(role))return 3;
 if(/內門/.test(role))return 4;
 if(/外門/.test(role))return 5;
 if(/執事|接引|管事|守衛/.test(role))return 6;
 return 7;
}
function realmWeight(realm){
 const value=String(realm||'');
 const order=REALM_ORDER.findLastIndex(r=>value.startsWith(r));
 const stage=REALM_STAGES.findIndex(s=>value.endsWith(s));
 return Math.max(0,order)*5+Math.max(0,stage);
}
function matches(character,query){
 if(!query)return true;
 return norm([
  character.name,character.id,character.peak,character.role,character.realm,
  character.roots,character.where,character.mood,character.aptitude?.grade,
  character.personality, ...(character.traits||[]), ...(character.methods||[]),
 ].join(' ')).includes(query);
}
function sortPeople(a,b){
 return realmWeight(b.realm)-realmWeight(a.realm)
  ||String(a.name).localeCompare(String(b.name),'zh-Hant');
}
function category(peak,knownPeaks){
 if(peak==='山門'||peak==='太虛宗'||knownPeaks.includes(peak))return 'taixu';
 if(peak==='青石鎮')return 'family';
 if(['大周仙朝','天劍山','萬獸谷','北荒妖庭'].includes(peak))return peak;
 return 'others';
}
const GROUP_ORDER=[
 ['taixu','太虛宗'],
 ['family','青石鎮 · 洛河家人'],
 ['大周仙朝','大周仙朝'],
 ['天劍山','天劍山'],
 ['萬獸谷','萬獸谷'],
 ['北荒妖庭','北荒妖庭'],
 ['others','其他勢力／未分類'],
];

export function organizeCharacters(characters,opts={}){
 const peaks=(opts.peaks||DEFAULT_PEAKS)
  .map(p=>typeof p==='string'?p:p?.name).filter(Boolean);
 const all=Object.values(characters||{}).filter(p=>p&&typeof p==='object');
 const q=norm(opts.query);
 const visible=all.filter(p=>matches(p,q));
 const groups=[];
 for(const [id,name] of GROUP_ORDER){
  const subset=visible.filter(c=>category(c.peak,peaks)===id);
  if(!subset.length)continue;
  const names=id==='taixu'
   ?['山門',...peaks.filter(p=>subset.some(c=>c.peak===p))]
   : [...new Set(subset.map(c=>c.peak||'未歸屬'))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
  const sections=[];
  for(const peak of names){
   const members=subset.filter(c=>id==='taixu'&&peak==='山門'
    ?c.peak==='山門'||c.peak==='太虛宗'
    :c.peak===peak);
   if(!members.length)continue;
   const ranks=[];
   for(let i=0;i<RANK_LABELS.length;i++){
    const people=members.filter(c=>rankOf(c)===i).sort(sortPeople);
    if(people.length)ranks.push({id:String(i),name:RANK_LABELS[i],people});
   }
   sections.push({id:peak,name:peak==='山門'?'山門／宗門執事':peak,
    count:members.length,ranks});
  }
  groups.push({id,name,count:subset.length,sections});
 }
 return groups;
}
export function countCharacters(groups){
 return (groups||[]).reduce((n,g)=>n+g.count,0);
}
