import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,validatedWorld,commitV3Turn,gmContext,parseGMResult,playerWorld} from '../server/world.mjs';
import {initialEventCalendar,addScheduledEvent,advanceEventCalendar,eventCalendarForGM} from '../server/event-calendar.mjs';

test('sect recruitment and twelve-peak selection have fixed start, end and stages',()=>{
 const world=initialV3World('calendar-seed');
 const [recruitment,selection]=world.eventCalendar.events;
 assert.deepEqual([recruitment.start,recruitment.end],[480,1080]);
 assert.deepEqual([selection.start,selection.end],[780,2400]);
 assert.ok(selection.stages.some(s=>s.at===1980));
 assert.match(eventCalendarForGM(world),/第1日 13:00/);
 assert.match(gmContext(world,'接下來十二峰開始收徒'),/十二峰收徒初選/);
 assert.equal(playerWorld(world).eventCalendar,undefined);
});

test('milestones occur only upon crossing their exact game-time, once',()=>{
 const world=initialV3World('calendar-cross');
 const after=commitV3Turn(world,'留在原地等待','山門弟子照常整理名冊。','calendar-1',{advanceMinutes:360});
 const ids=after.events.filter(e=>e.source==='event-calendar').map(e=>e.id);
 assert.deepEqual(ids,['calendar:sect-recruitment:preliminary','calendar:twelve-peaks-selection:open']);
 assert.equal(after.eventCalendar.events[1].state,'active');
 assert.ok(after.npcs.registrar.knowledge.includes('calendar:twelve-peaks-selection:open'));
 assert.ok(!after.npcs.shen.knowledge.includes('calendar:twelve-peaks-selection:open'));
 assert.deepEqual(world.eventCalendar.events[1].completed,[]);
 const later=commitV3Turn(after,'觀察','廣場有人核對名冊。','calendar-2');
 assert.equal(later.events.filter(e=>e.id==='calendar:twelve-peaks-selection:open').length,1);
});

test('new events must be planned with ordered stages and a valid deadline',()=>{
 const world=initialV3World('calendar-valid');
 const planned={id:'escort-mission-1',name:'護送宗門信件',type:'任務',
  location:'太虛宗山門',start:600,end:810,participants:['registrar'],
  stages:[{id:'depart',at:600,title:'接到委託',detail:'韓守一派出接引弟子'},
   {id:'limit',at:810,title:'提交期限',detail:'未完成將交給其他弟子'}]};
 const count=world.eventCalendar.events.length;
 addScheduledEvent(world,planned,world.minute);
 assert.equal(world.eventCalendar.events.length,count+1);
 assert.throws(()=>addScheduledEvent(world,planned,world.minute),/重複/);
 assert.throws(()=>addScheduledEvent(initialV3World('bad'),{...planned,start:100},480),/時間/);
 assert.throws(()=>addScheduledEvent(initialV3World('bad2'),{...planned,
  stages:[planned.stages[1],planned.stages[0]]},480),/時間/);
 assert.throws(()=>addScheduledEvent(initialV3World('bad3'),{...planned,
  participants:['not-present-id']},480),/參與者/);
});

test('GM may propose timed mission in validated structured metadata',()=>{
 const world=initialV3World('gm-plan');
 const proposal={id:'herb-job-1',name:'藥材交付',type:'委託',
  location:'太虛宗山門',start:490,end:780,participants:['registrar'],
  stages:[{id:'accept',at:490,title:'領取工作',detail:'派出人手'},
   {id:'deadline',at:780,title:'交付期限',detail:'如無結果由執事轉派'}]};
 const raw='韓守一將事情記入待辦名冊。\n<!--GM_STATE:'+JSON.stringify({schedules:[proposal]})+'-->';
 const parsed=parseGMResult(raw);
 assert.equal(parsed.schedules.length,1);
 const count=world.eventCalendar.events.length;
 const after=commitV3Turn(world,'請說說今日的工作',raw,'calendar-gm-1');
 assert.equal(after.eventCalendar.events.length,count+1);
 assert.equal(after.eventCalendar.events.find(e=>e.id==='herb-job-1').end,780);
 assert.equal(after.messages.at(-1).content,'韓守一將事情記入待辦名冊。');
 const reloaded=validatedWorld(JSON.parse(JSON.stringify(after)));
 assert.ok(reloaded.eventCalendar.events.some(e=>e.id==='herb-job-1'));
 assert.match(eventCalendarForGM(reloaded),/藥材交付/);
});

test('invalid GM schedule never enters canonical state',()=>{
 const world=initialV3World('gm-invalid');
 const raw='韓守一說會再查。\n<!--GM_STATE:'+JSON.stringify({schedules:[{
   id:'bad-no-times',name:'永遠不結束的任務',type:'任務',location:'太虛宗山門',
   start:510,end:500,participants:['registrar'],stages:[]} ]})+'-->';
 const initial=world.eventCalendar.events.length;
 const after=commitV3Turn(world,'有新工作嗎',raw,'calendar-invalid-1');
 assert.equal(after.eventCalendar.events.length,initial);
});

test('loading older worlds does not replay elapsed scheduled milestones',()=>{
 const world=initialV3World('calendar-old');
 delete world.eventCalendar;
 world.day=3;world.minute=600;
 validatedWorld(world);
 assert.equal(world.eventCalendar.events[0].state,'completed');
 assert.equal(world.eventCalendar.events[1].state,'completed');
 const before=world.events.length;
 advanceEventCalendar(world,world.minute+2*1440,world.minute+2*1440+90);
 assert.equal(world.events.length,before);
});
