import test from 'node:test';
import assert from 'node:assert/strict';
import {GM_INSTRUCTIONS} from '../server/gm-prompt.mjs';
import {initialV3World,commitV3Turn,parseGMResult,developerWorld,playerWorld,validatedWorld} from '../server/world.mjs';

test('GM follows original roleplay contract, records instead of driving plot',()=>{
 assert.match(GM_INSTRUCTIONS,/玩家擁有洛河的最終決策權/);
 assert.match(GM_INSTRUCTIONS,/玩家不是所有事件的中心/);
 assert.match(GM_INSTRUCTIONS,/不公開不必要的檢定/);
 assert.match(GM_INSTRUCTIONS,/對話必須自然、連續、有生活感/);
 assert.match(GM_INSTRUCTIONS,/每回合/);
 assert.match(GM_INSTRUCTIONS,/taskUpdates/);
 assert.match(GM_INSTRUCTIONS,/沒有變動的欄位省略/);
});
test('narrated NPC changes and task progress are saved independently',()=>{
 const world=initialV3World('simple-gm-record');
 const story='韓煜被洛河一拳打中臉頰，韓守一出面勸阻時被推倒擦傷。韓守一皺眉，神情不悅，決定重新核對名冊。';
 const answer=story+'\n<!--GM_STATE:'+JSON.stringify({
  changes:[{id:'registrar',mood:'不悅',status:'輕傷',goal:'重新核對名冊',evidence:'韓守一出面勸阻時被推倒擦傷。韓守一皺眉，神情不悅，決定重新核對名冊'}],
  taskUpdates:[{id:'sect-recruitment',status:'受阻',note:'現場短暫混亂，執事需要重新核對名冊',
   evidence:'決定重新核對名冊'}]
 })+'-->';
 const next=commitV3Turn(world,'我去跟韓守一講話',answer,'simple-gm-record-1');
 assert.equal(next.npcs.registrar.mood,'不悅');
 assert.equal(next.npcs.registrar.status,'輕傷');
 assert.equal(next.npcs.registrar.goal,'重新核對名冊');
 const progress=next.eventCalendar.events.find(e=>e.id==='sect-recruitment').progressLog;
 assert.equal(progress.length,1);
 assert.equal(progress[0].status,'受阻');
 assert.equal(progress[0].note,'現場短暫混亂，執事需要重新核對名冊');
 assert.equal(world.npcs.registrar.status,'健康');
 assert.equal(world.eventCalendar.events[0].progressLog,undefined);
 assert.doesNotMatch(playerWorld(next).messages.at(-1).content,/GM_STATE/);
 assert.ok(developerWorld(next).eventCalendar.events.find(e=>e.id==='sect-recruitment').progressLog);
 const restored=validatedWorld(JSON.parse(JSON.stringify(next)));
 assert.deepEqual(restored.eventCalendar.events[0].progressLog,progress);
});
test('unsupported claims and unknown tasks cannot rewrite records',()=>{
 const world=initialV3World('simple-gm-unsafe');
 const answer='韓守一繼續查看名冊。'+'\n<!--GM_STATE:'+JSON.stringify({
  changes:[
   {id:'registrar',status:'重傷',goal:'無期限離開宗門',evidence:'虛構受傷'},
   {id:'shen',mood:'憤怒',evidence:'韓守一繼續查看名冊'}
  ],
  taskUpdates:[{id:'unknown-task',status:'完成',note:'無此任務',evidence:'韓守一繼續查看名冊'},
   {id:'sect-recruitment',status:'完成',note:'任務自動結束',evidence:'不存在的證據'}]
 })+'-->';
 const next=commitV3Turn(world,'我跟韓守一說話',answer,'simple-gm-unsafe-1');
 assert.equal(next.npcs.registrar.status,'健康');
 assert.notEqual(next.npcs.registrar.goal,'無期限離開宗門');
 assert.equal(next.npcs.shen.mood,world.npcs.shen.mood);
 assert.equal(next.eventCalendar.events[0].progressLog,undefined);
 assert.equal(next.eventCalendar.events[0].state,'active'); // The clock advances normally after 08:00.
 assert.equal(parseGMResult('單純對話').taskUpdates.length,0);
});
test('existing NPC memories and clock remain readable when legacy daily plans exist',()=>{
 const world=initialV3World('simple-gm-migrate');
 world.npcAgency.dailyPlans={'2':{registrar:{title:'原本的舊日程'}}};
 world.dailyTick.records.push({id:'daily:2',day:2,rangeStartDay:2,rangeEndDay:2,activityCount:0});
 const restored=validatedWorld(JSON.parse(JSON.stringify(world)));
 assert.ok(restored.npcAgency.dailyPlans['2'].registrar);
 assert.equal(restored.dailyTick.records.length,1);
});
