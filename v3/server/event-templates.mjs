/**
 * World-calendar templates are author-owned recurring opportunities.
 * They are NOT tasks accepted by Luohe, do not guarantee an NPC outcome,
 * and are not automatically disclosed in the player's private quest journal.
 *
 * A provisional game-calendar year is 365 days until the lore calendar is set.
 */
export const GAME_YEAR_DAYS=365;
const DAY=1440;
const YEAR=GAME_YEAR_DAYS*DAY;
export const BUILTIN_EVENT_TEMPLATES=Object.freeze([
 {id:'recruitment-cycle',name:'太虛宗收徒大典',category:'預設活動',intervalYears:3,
  anchor:480,days:2,location:'太虛宗山門',participants:['registrar','guide'],
  note:'每三年開啟一次宗門收徒及十二峰初選；不是每三年自動收洛河為徒。',
  phases:[
   {id:'register',offset:0,title:'山門開放報名與測靈根'},
   {id:'selection',offset:300,title:'十二峰接引代表開始初選'},
   {id:'closing',offset:2*DAY-1,title:'本屆收徒接引收尾'}]},
 {id:'annual-discourse',name:'十二峰年度論道',category:'預設活動',intervalYears:1,
  anchor:29*DAY+540,days:2,location:'太虛宗主峰',participants:[],
  note:'各峰交流心得、比試與講論；參加者及論道結果應按當年情況判定。',
  phases:[
   {id:'notice',offset:0,title:'年度論道正式開幕'},
   {id:'sessions',offset:DAY,title:'各峰交流與論道進行'},
   {id:'closing',offset:2*DAY-1,title:'論道閉幕及記錄整理'}]},
 {id:'annual-expedition',name:'宗門年度出峰歷練',category:'預設活動',intervalYears:1,
  anchor:89*DAY+480,days:7,location:'太虛宗主峰',participants:[],
  note:'宗門開放外出歷練／探險委託窗口；洛河是否受邀、報名、出發、成功都不是預設事實。',
  phases:[
   {id:'notice',offset:0,title:'歷練委託與可參與隊伍公告'},
   {id:'departure',offset:DAY,title:'符合資格的隊伍依規定出發'},
   {id:'report',offset:7*DAY-1,title:'本期探險紀錄與回報期限'}]},
]);
const abs=(v)=>Number.isInteger(v)&&v>=0;
const templateEvent=(template,index)=>{
 const start=template.anchor+index*template.intervalYears*YEAR;
 return {
  id:'builtin-'+template.id+'-y'+(1+index*template.intervalYears),
  name:template.name,type:'宗門活動',location:template.location,
  start,end:start+template.days*DAY,participants:[...template.participants],
  public:true,stages:template.phases.map(p=>({id:p.id,at:start+p.offset,
   title:p.title,detail:template.note})),
  state:'scheduled',completed:[],createdAt:480,source:'預設任務',
  origin:'builtin',templateId:template.id,cycle:index+1,repeatYears:template.intervalYears,
  description:template.note,
 };
};
/** Add bounded number of planned occurrences, without rewriting prior cycles.
 * Caller must invoke before advancing clock so any crossed stages settle. */
export function seedRecurringEvents(calendar,from,to){
 if(!calendar||!Array.isArray(calendar.events))return 0;
 if(!abs(from)||!abs(to)||to<from)return 0;
 const known=new Set(calendar.events.map(e=>e.id));
 let count=0;
 for(const template of BUILTIN_EVENT_TEMPLATES){
  const stride=template.intervalYears*YEAR;
  // Initial recruitment already has legacy dedicated events. Seed from year 4.
  const minimum=template.id==='recruitment-cycle'?1:0;
  const first=Math.max(minimum,Math.floor((from-template.anchor)/stride)-1);
  const last=Math.min(first+90,Math.max(minimum,Math.ceil((to-template.anchor)/stride)+1));
  for(let i=first;i<=last;i++){
   if(i<minimum)continue;
   const ev=templateEvent(template,i);
   // Include currently active as well as future events, but no ancient replay.
   if(ev.end<=from||known.has(ev.id))continue;
   calendar.events.push(ev);known.add(ev.id);count++;
  }
 }
 return count;
}
export const eventSourceCategory=event=>{
 if(event?.origin==='builtin'||event?.source==='預設任務'||event?.source==='宗門預定日程')
  return '預設任務';
 if(event?.source==='GM新事件排程')return 'AI 新增任務';
 if(event?.source==='開發者新增任務')return '開發者任務';
 return '其他事件';
};
