import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,validatedWorld,commitV3Turn,developerWorld,developerTaskChange,playerWorld} from '../server/world.mjs';
import {GAME_YEAR_DAYS,eventSourceCategory} from '../server/event-templates.mjs';
import {advanceEventCalendar,eventCalendarForGM} from '../server/event-calendar.mjs';

test('recurring three-year recruitment and annual peak-discourse/expedition are planned',()=>{
 const w=initialV3World('recurring-seed');
 const list=w.eventCalendar.events;
 assert.ok(list.some(e=>e.id==='sect-recruitment'));
 const cycle=list.find(e=>e.id==='builtin-recruitment-cycle-y4');
 assert.equal(cycle.start,480+3*GAME_YEAR_DAYS*1440);
 assert.equal(cycle.repeatYears,3);
 assert.equal(eventSourceCategory(cycle),'預設任務');
 for(const id of ['annual-discourse','annual-expedition']){
  const event=list.find(e=>e.templateId===id&&e.cycle===1);
  assert.ok(event,id);
  assert.equal(event.repeatYears,1);
  assert.ok(event.stages.length>=2);
 }
 const admin=developerWorld(w);
 assert.equal(admin.eventTemplates.length,3);
 assert.equal(admin.gameYearDays,365);
 assert.equal(playerWorld(w).eventTemplates,undefined);
 assert.equal(playerWorld(w).eventCalendar,undefined);
});

test('annual template survives reload and does not duplicate on repeated calendar checks',()=>{
 const w=initialV3World('recurring-save');
 const n=w.eventCalendar.events.length;
 for(let i=0;i<4;i++)validatedWorld(w);
 assert.equal(w.eventCalendar.events.length,n);
 const restored=validatedWorld(JSON.parse(JSON.stringify(w)));
 assert.equal(restored.eventCalendar.events.length,n);
 assert.match(eventCalendarForGM(restored,4000),/預設任務/);
});

test('annual event advances without Luohe, exactly once at scheduled phases',()=>{
 const w=initialV3World('recurring-yearly');
 const debate=w.eventCalendar.events.find(e=>e.id==='builtin-annual-discourse-y1');
 const from=debate.start-10,to=debate.start+1441;
 advanceEventCalendar(w,from,to);
 assert.deepEqual(debate.completed,['notice','sessions']);
 assert.equal(debate.state,'active');
 const ids=w.events.filter(e=>e.id?.startsWith('calendar:'+debate.id)).map(e=>e.id);
 assert.deepEqual(ids,['calendar:'+debate.id+':notice','calendar:'+debate.id+':sessions']);
 advanceEventCalendar(w,from,to);
 assert.equal(w.events.filter(e=>e.id?.startsWith('calendar:'+debate.id)).length,2);
 assert.equal(w.protagonist.realm,'凡人');
});

test('future annual cycles materialize across years, recruitment every third year',()=>{
 const w=initialV3World('recurring-years');
 const from=480,to=4*GAME_YEAR_DAYS*1440+600;
 advanceEventCalendar(w,from,to);
 const events=w.eventCalendar.events;
 const year1=events.find(e=>e.id==='builtin-annual-discourse-y1');
 const year2=events.find(e=>e.id==='builtin-annual-discourse-y2');
 const year4=events.find(e=>e.id==='builtin-recruitment-cycle-y4');
 assert.equal(year1.state,'completed');
 assert.equal(year2.state,'completed');
 assert.equal(year4.state,'active');
 assert.ok(!events.some(e=>e.id==='builtin-recruitment-cycle-y2'));
 const ids=events.map(e=>e.id);
 assert.equal(new Set(ids).size,ids.length);
});

test('AI generated tasks are distinguishable; developer-created tasks remain separate',()=>{
 const w=initialV3World('recurring-ai');
 const now=480;
 const proposal={id:'ai-herb-walk',name:'靈草採樣委託',type:'委託',location:'太虛宗山門',
  start:500,end:900,participants:['registrar'],stages:[
   {id:'start',at:500,title:'開始採集',detail:'執事安排採集'},
   {id:'finish',at:900,title:'期限截止',detail:'提交採集結果'}]};
 const raw='韓守一將採樣委託登錄在冊。\n<!--GM_STATE:'+JSON.stringify({schedules:[proposal]})+'-->';
 const next=commitV3Turn(w,'今天有委託嗎',raw,'annual-ai-1');
 const ai=next.eventCalendar.events.find(e=>e.id==='ai-herb-walk');
 assert.equal(eventSourceCategory(ai),'AI 新增任務');
 const dev=developerTaskChange(w,'create',{...proposal,id:'dev-herb-walk'},'authorized');
 assert.equal(eventSourceCategory(dev.eventCalendar.events.find(e=>e.id==='dev-herb-walk')),'開發者任務');
 assert.throws(()=>developerTaskChange(w,'cancel',{id:'builtin-annual-discourse-y1'},'authorized'),/不可直接取消/);
});
