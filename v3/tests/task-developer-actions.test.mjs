import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn,developerWorld,developerTaskChange,playerWorld} from '../server/world.mjs';
import {suggestedActions} from '../server/action-suggestions.mjs';

test('post-test shortcuts must not repeat old result or next-step questions',()=>{
 let world=initialV3World('actions-post-test');
 world.protagonist.spiritualRoot='純風靈根';
 world.messages.push({role:'assistant',content:'韓守一說：「測試結果已記錄。下一步要整理名冊。」'});
 const suggestions=suggestedActions(world);
 assert.ok(!suggestions.some(s=>/(?:詢問測試結果|詢問接下來的安排|先觀察四周)/.test(s.label)));
 assert.ok(suggestions.some(s=>s.kind==='advance'));
 assert.equal(suggestions.length,1);
});

test('contextual shortcuts only match current scene and must not repeat recent exact action',()=>{
 const world=initialV3World('actions-object');
 world.messages.push({role:'assistant',content:'韓守一指向測靈石：「把手按在這裡。」'});
 assert.ok(suggestedActions(world).some(s=>s.label==='將手放上測靈石'));
 const used='我將手掌按在測靈石上，接受測試。';
 world.messages.push({role:'user',content:used});
 assert.ok(!suggestedActions(world).some(s=>s.text===used));
 world.protagonist.spiritualRoot='純風靈根';
 assert.ok(!suggestedActions(world).some(s=>s.label==='將手放上測靈石'));
});

test('selection shortcut is based on real active calendar, never future-only plan',()=>{
 const world=initialV3World('actions-calendar');
 world.protagonist.spiritualRoot='純風靈根';
 world.messages.push({role:'assistant',content:'各峰代表正在名冊旁進行初選。'});
 assert.ok(!suggestedActions(world).some(s=>s.label==='觀察各峰代表'));
 world.eventCalendar.events.find(e=>e.id==='twelve-peaks-selection').state='active';
 assert.ok(suggestedActions(world).some(s=>s.label==='觀察各峰代表'));
});

test('developer data includes full GM task data without leaking to the player',()=>{
 const world=initialV3World('task-private');
 const admin=developerWorld(world);
 assert.ok(admin.eventCalendar.events.length>=2);
 assert.equal(admin.livingArcs[0].truth.includes('抄錄差錯'),true);
 assert.equal(playerWorld(world).eventCalendar,undefined);
 assert.equal(playerWorld(world).livingArcs,undefined);
});

test('authorized developer task creation, cancellation, auditing and immutable original',()=>{
 const world=initialV3World('task-new');
 const draft={id:'dev-custom-001',name:'山門信使任務',type:'委託',location:'太虛宗山門',
  start:540,end:690,participants:['registrar'],public:false,
  stages:[{id:'begin',at:540,title:'出發',detail:'派出信使'},
   {id:'deadline',at:690,title:'期限截止',detail:'移交其他人員'}]};
 const count=world.eventCalendar.events.length;
 const next=developerTaskChange(world,'create',draft,'admin');
 assert.equal(next.revision,1);
 assert.equal(world.eventCalendar.events.length,count);
 assert.equal(next.eventCalendar.events.find(e=>e.id===draft.id).name,'山門信使任務');
 assert.equal(next.developerAudit.at(-1).operation,'task-create');
 const canceled=developerTaskChange(next,'cancel',{id:'dev-custom-001'},'admin');
 assert.equal(canceled.eventCalendar.events.find(e=>e.id===draft.id).state,'cancelled');
 assert.equal(canceled.eventCalendar.events.find(e=>e.id===draft.id).cancelledAt,480);
 assert.equal(canceled.developerAudit.at(-1).operation,'task-cancel');
 assert.throws(()=>developerTaskChange(canceled,'cancel',{id:'dev-custom-001'}),/不能重複/);
 assert.throws(()=>developerTaskChange(world,'create',{...draft,end:530},'admin'),/時間/);
 assert.throws(()=>developerTaskChange(world,'create',{...draft,participants:['unknown']},'admin'),/參與者/);
});

test('already canceled event must not emit future stages',()=>{
 let world=initialV3World('task-canceled');
 const draft={id:'cancel-once-001',name:'臨時委託',type:'任務',location:'太虛宗山門',start:600,end:900,participants:[],stages:[{id:'open',at:600,title:'開始',detail:'開始'},{id:'end',at:900,title:'結束',detail:'結束'}]};
 world=developerTaskChange(world,'create',draft,'admin');
 world=developerTaskChange(world,'cancel',{id:'cancel-once-001'},'admin');
 const after=commitV3Turn(world,'原地等一天','山門照常開放。','task-wait',{advanceMinutes:1440});
 assert.equal(after.events.filter(e=>e.id?.startsWith('calendar:cancel-once-001:')).length,0);
});
