import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn,gmContext} from '../server/world.mjs';
import {isContinueIntent,nextBeatDirective,assessContinueReply,retryContinueDirective} from '../server/gm-initiative.mjs';

test('plain continue means GM progression, not an inferred protagonist decision',()=>{
 assert.ok(isContinueIntent('繼續'));
 assert.ok(isContinueIntent('然後呢？'));
 assert.ok(isContinueIntent('交給 GM 推進'));
 assert.ok(!isContinueIntent('繼續往山上走'));
 assert.ok(!isContinueIntent('師父，請你繼續'));
});

test('tested-root scene must progress working NPCs without starting future peak selection',()=>{
 let w=initialV3World('initiative-root');
 w.protagonist.spiritualRoot='金靈根';
 w=commitV3Turn(w,'很強嗎','韓守一解釋靈根品級，最後問你還有什麼疑問嗎？','quality-1');
 const guidance=nextBeatDirective(w,'繼續');
 assert.match(guidance,/已測靈根/);
 assert.match(guidance,/不固定退回登記或測試流程/);
 assert.match(guidance,/尚未到點/);
 assert.match(guidance,/第1日 12:00/);
 assert.match(gmContext(w,'繼續'),/金靈根/);
 assert.equal(nextBeatDirective(w,'我問金靈根強不強'),'');
});

test('continuation quality check catches two variants of circular choice prompts',()=>{
 const bad='韓守一將筆放下，說了這些規矩。今日尚有其他新人。你還有什麼問題嗎？';
 const repetitive='韓守一整理著名冊。他說後續會進入初評，你沒急著去下一環節？還是想在這多待會，或者有什麼想問的？';
 assert.deepEqual(assessContinueReply('繼續',bad),{ok:false,reason:'stock-question-without-progress'});
 assert.deepEqual(assessContinueReply('繼續',repetitive),{ok:false,reason:'stock-question-without-progress'});
 assert.match(retryContinueDirective(assessContinueReply('繼續',bad)),/不能只是改掉最後問號/);
});

test('do not reject character questions with concrete new NPC action or normal player dialogue',()=>{
 const good='韓守一合起名冊，喊道：「下一位！」一名少年挨近測靈石，將報名卷遞給他。韓守一問：「你叫什麼名字？」';
 assert.equal(assessContinueReply('繼續',good).ok,true);
 assert.equal(assessContinueReply('你覺得如何？','韓守一問：「還有什麼問題？」').ok,true);
 assert.equal(assessContinueReply('繼續','你想怎麼做？').ok,false);
 assert.equal(assessContinueReply('繼續','韓守一說話了。').ok,false);
});

test('calendar direction remains relative to saved time and current location',()=>{
 const w=initialV3World('calendar-cue');
 w.minute=840;
 w.eventCalendar.events[1].state='active';
 w.eventCalendar.events[1].completed=['open'];
 const instruction=nextBeatDirective(w,'繼續');
 assert.match(instruction,/第1日 15:00/);
 assert.doesNotMatch(instruction,/第1日 13:00.*尚未到點/);
 w.location='藏經樓';
 assert.doesNotMatch(nextBeatDirective(w,'繼續'),/預定第1日 15:00/);
});
