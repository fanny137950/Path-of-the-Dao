import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn,playerWorld,validatedWorld,gmContext} from '../server/world.mjs';
import {fastForwardRequest,fastForwardText,fastForwardDirective,currentDecision} from '../server/fast-forward.mjs';
import {turnIdentity,checkTurnRequest} from '../server/turn-request.mjs';
import {GM_INSTRUCTIONS} from '../server/gm-prompt.mjs';
const fresh=()=>({...initialV3World('pacing-test'),gmManaged:true});
const raw=(narrative,state)=>narrative+'\n<!--GM_STATE:'+JSON.stringify(state)+'-->';
const request={limitMinutes:1440,target:'收徒典禮'};
const scene='午間，沈滄月走到接引台前：「要入棲風峰，先說說妳想學什麼。」';
const choice={question:'要向沈滄月提出拜師請求，還是先問清她的教導方式？',evidence:'先說說妳想學什麼'};
const state={elapsedMinutes:120,decision:choice,suggestions:[{label:'提出拜師請求',text:'我想拜妳為師。',evidence:'沈滄月走到接引台前'},{label:'先問教導方式',text:'妳會如何教弟子？',evidence:'先說說妳想學什麼'}]};
const advance=w=>commitV3Turn(w,fastForwardText(request),raw(scene,state),'fast',{fastForward:request});

test('fast-forward commits actual elapsed time and stops before choosing a master',()=>{
 const before=fresh(),snapshot=structuredClone(before),next=advance(before);
 assert.equal(next.minute-before.minute,120);
 assert.equal(next.protagonist.master,before.protagonist.master);
 assert.deepEqual(before,snapshot);
 const view=playerWorld(validatedWorld(JSON.parse(JSON.stringify(next))));
 assert.equal(view.decision.question,choice.question);assert.equal(view.suggestions.length,2);
 assert.equal(view.messages.at(-1).fastForward.elapsedMinutes,120);
 assert.equal(view.messages.at(-1).fastForward.limitMinutes,1440);
 assert.equal(view.messages.at(-1).fastForward.stoppedForDecision,true);
 assert.match(next.events.at(-1).rawAnswer,/GM_STATE/);
});

test('a pending choice blocks further skip but accepts a freely written refusal and then resumes',()=>{
 const waiting=advance(fresh());
 assert.throws(()=>commitV3Turn(waiting,'再快進',raw('又過了一天。',{elapsedMinutes:1440,decision:null}),'skip-choice',{fastForward:request}),e=>e.status===422&&/需要你決定/.test(e.message));
 const refused=commitV3Turn(waiting,'我暫時不拜師，先留在台下看。',raw('沈滄月點頭，轉向下一名弟子。洛河退回人群。',{elapsedMinutes:2,decision:null}),'free-choice');
 assert.equal(currentDecision(refused),null);assert.deepEqual(playerWorld(refused).suggestions,[]);
 const next=commitV3Turn(refused,fastForwardText(request),raw('午後的接引漸漸結束，人群散去。',{elapsedMinutes:60,decision:null}),'resume',{fastForward:request});
 assert.equal(next.minute-refused.minute,60);
});

test('time bounds, missing decisions, invalid evidence and unauthorised affiliation changes never alter save',()=>{
 const w=fresh(),snapshot=structuredClone(w);
 for(const bad of [{decision:null},{elapsedMinutes:1441,decision:null},{elapsedMinutes:-1,decision:null},{elapsedMinutes:30},{elapsedMinutes:30,decision:{question:'問題',evidence:'不在正文的引文'}},{elapsedMinutes:0,decision:null},{elapsedMinutes:30,decision:null,protagonist:{master:'沈滄月',evidence:'師父沈滄月收洛河為徒'}}]){
  assert.throws(()=>commitV3Turn(w,'快進',raw('師父沈滄月收洛河為徒。',bad),'bad',{fastForward:request}),e=>e.status===422);
  assert.deepEqual(w,snapshot);
 }
});

test('an immediate meaningful choice is allowed at zero elapsed time; quiet days need no choices',()=>{
 const next=commitV3Turn(fresh(),'快進',raw(scene,{...state,elapsedMinutes:0}),'now',{fastForward:request});
 assert.equal(next.minute,480);assert.ok(currentDecision(next));
 const calm=commitV3Turn(fresh(),'快進',raw('這一天照常度過，洛河翻完了借來的入門冊。',{elapsedMinutes:1440,decision:null}),'quiet',{fastForward:request});
 assert.equal(calm.day,2);assert.equal(calm.minute,480);assert.equal(playerWorld(calm).decision,null);
});

test('retries preserve pacing identity even after a choice is pending',()=>{
 const w=advance(fresh()),text=fastForwardText(request);
 const body={op:'fast-forward',...request,mode:'demo',model:'openrouter/free',revision:0};
 const identity=turnIdentity(body,text);w.events.at(-1).request=identity;
 assert.deepEqual(checkTurnRequest(w,'fast',identity),{replayed:true});
 for(const changes of [{limitMinutes:43200},{target:'拜師完成'},{op:'turn'}])assert.equal(checkTurnRequest(w,'fast',turnIdentity({...body,...changes},text)).status,409);
});

test('GM receives a ceiling, explicit agency rules and world deadlines inside that ceiling',()=>{
 assert.throws(()=>fastForwardRequest({limitMinutes:99}),/上限/);
 assert.throws(()=>fastForwardRequest({limitMinutes:1440,target:'字'.repeat(161)}),/160/);
 assert.deepEqual(fastForwardRequest({limitMinutes:1440,target:'  收徒典禮  '}),request);
 const prompt=fastForwardDirective(request);assert.match(prompt,/幕外節奏/);assert.match(prompt,/不表示同意/);assert.match(prompt,/提早停下/);
 assert.match(GM_INSTRUCTIONS,/拒絕、離開、提出第四種做法/);
 const w=fresh();w.memorySystem={version:1,working:null,threads:[{id:'letter',title:'來信',summary:'尚待回覆',status:'open',participants:['registrar'],playerKnown:false,truth:'秘密',dueAt:600,revision:1}]};
 assert.match(gmContext(w,'快進',{advanceMinutes:1440}),/"dueForReview":true/);
 assert.doesNotMatch(JSON.stringify(playerWorld(w)),/秘密/);
});

test('older saves without decisions remain playable; choices attach only to their own latest scene',()=>{
 const w=fresh();assert.equal(playerWorld(w).decision,null);
 const waiting=advance(w);
 const continued=commitV3Turn(waiting,'我想先問一個問題','沈滄月側過頭：「問吧。」','old-format');
 assert.equal(currentDecision(continued),null);
 assert.ok(waiting.messages.at(-1).decision);
});
