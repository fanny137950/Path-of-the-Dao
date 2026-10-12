import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn,playerWorld,validatedWorld,parseGMResult} from '../server/world.mjs';
import {suggestedActions} from '../server/action-suggestions.mjs';
const narration='韓守一指向測靈石：「把手按在這裡。」';
const action={label:'觸碰測靈石',text:'我把手按在測靈石上。',evidence:'韓守一指向測靈石'};
const reply=(suggestions)=>narration+'\n<!--GM_STATE:'+JSON.stringify({suggestions})+'-->';

test('only GM-authored actions survive commit, save reload and player projection',()=>{
 const w=commitV3Turn(initialV3World('gm-actions'),'我要測試',reply([action]),'a');
 const restored=validatedWorld(JSON.parse(JSON.stringify(w)));
 assert.deepEqual(playerWorld(restored).suggestions,[{label:action.label,text:action.text,kind:'action'}]);
 assert.equal(playerWorld(restored).messages.at(-1).content,narration);
 assert.equal(w.messages.at(-2).content,'我要測試');
 assert.equal(w.protagonist.spiritualRoot,'未測定'); // A suggestion is not an executed action.
 assert.equal(w.events.length,1);
});

test('missing AI suggestions yield safe generic options instead of stale choices',()=>{
 const w=commitV3Turn(initialV3World('clear-actions'),'我要測試',reply([action]),'a');
 for(const raw of [reply([]),narration,narration+'<!--GM_STATE:{broken-->',narration+'<!--GM_STATE:null-->']){
  const next=commitV3Turn(w,'繼續',raw,'b');
  assert.equal(suggestedActions(next).length,3);
  assert.ok(suggestedActions(next).every(x=>x.kind==='action'&&!x.text.includes('測靈石')));
 }
 assert.equal(suggestedActions(initialV3World('legacy-actions')).length,3);
});

test('reject invalid, duplicate, ungrounded and excessive suggestions',()=>{
 const more=[1,2,3,4].map(n=>({...action,label:'選項'+n,text:'我詢問測試細節'+n}));
 const items=[null,{}, {...action,evidence:'只有後台知道的秘密'}, {...action,label:'x'.repeat(33)}, {...action,text:'<script>'},action,action,...more];
 const parsed=parseGMResult(reply(items));
 assert.equal(parsed.suggestions.length,4);
 assert.equal(parsed.suggestions[0].text,action.text);
 assert.equal(new Set(parsed.suggestions.map(x=>x.text)).size,4);
});

test('private state and recruitment keywords never manufacture shortcuts',()=>{
 const w=initialV3World('no-keywords');
 w.messages.push({role:'assistant',content:'接引代表等待展示，各峰在核對名冊。'});
 w.npcs.registrar.privateNotes.push('隱藏入門手續');
 w.eventCalendar.events.find(e=>e.id==='twelve-peaks-selection').state='active';
 assert.equal(suggestedActions(w).length,3);
 const before=JSON.stringify(w);
 playerWorld(w);
 assert.equal(JSON.stringify(w),before);
});
