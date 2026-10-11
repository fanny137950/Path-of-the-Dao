import test from 'node:test';
import assert from 'node:assert/strict';
import {GM_INSTRUCTIONS,currentTurnDirective} from '../server/gm-prompt.mjs';
import {gmContext,initialV3World,commitV3Turn,validatedWorld} from '../server/world.mjs';

test('GM contract prioritizes current executed action, while dialogue remains dialogue',()=>{
 const w=initialV3World('gm-contract-action');
 assert.match(GM_INSTRUCTIONS,/立即嘗試的行動/);
 assert.match(GM_INSTRUCTIONS,/當回合/);
 assert.match(GM_INSTRUCTIONS,/最近場景原話優先/);
 assert.match(currentTurnDirective(w,'打他'),/已指定立即執行的動作/);
 assert.match(currentTurnDirective(w,'拿起茶杯砸過去'),/已指定立即執行的動作/);
 assert.match(currentTurnDirective(w,'你很欠打'),/自然對話/);
 assert.match(currentTurnDirective(w,'繼續'),/GM 主動續演/);
 assert.match(currentTurnDirective(w,'直接進到收徒',{sceneJump:true}),/不是洛河口頭台詞/);
});
test('recent dialogue and latest action precede optional quest memory',()=>{
 let w=initialV3World('gm-context-priority');
 for(let i=1;i<=8;i++)
  w=commitV3Turn(w,'我跟韓煜說第'+i+'句','韓煜回答第'+i+'句：「來啊。」','prompt-contract-'+i);
 const input=gmContext(w,'打他');
 assert.match(input,/韓煜回答第8句/);
 assert.match(input,/【洛河最新輸入】打他/);
 assert.ok(input.indexOf('【目前場景對話')<input.indexOf('【洛河最新輸入】'));
 assert.ok(input.indexOf('【洛河最新輸入】')<input.indexOf('【世界排程'));
 assert.ok(input.length<=11800);
});
test('long scenes preserve the newest turn plus latest input and world facts',()=>{
 let w=initialV3World('gm-contract-long');
 w.protagonist.spiritualRoot='金靈根';
 for(let i=0;i<30;i++)w=commitV3Turn(w,
  '一段討論'+i+'：'+'這些事情很重要。'.repeat(10),
  '韓守一詳細回答'+i+'：'+'說明今天的安排。'.repeat(13),'prompt-contract-long-'+i);
 const c=gmContext(w,'我現在舉起拳頭打他');
 assert.match(c,/詳細回答29/);
 assert.match(c,/【洛河最新輸入】我現在舉起拳頭打他/);
 assert.match(c,/靈根金靈根/);
 assert.ok(c.length<=11800);
 const copy=validatedWorld(JSON.parse(JSON.stringify(w)));
 assert.equal(copy.messages.length,w.messages.length);
 assert.equal(copy.events.length,w.events.length);
});

test('closing a conversation is contextual pacing, not automatically player speech',()=>{
 const w=initialV3World('close-exchange');
 assert.match(currentTurnDirective(w,'就這樣'),/結束這段交流/);
 assert.match(currentTurnDirective(w,'我說：「就這樣。」'),/自然對話/);
 assert.match(GM_INSTRUCTIONS,/suggestions/);
 assert.match(GM_INSTRUCTIONS,/不要僅增加氣氛/);
});

test('completed assessment notes remain in GM context after long dialogue',()=>{
 let w=initialV3World('assessment-progress');
 const narration='韓守一將初評結果記錄完畢。';
 w=commitV3Turn(w,'繼續',narration+'<!--GM_STATE:'+JSON.stringify({taskUpdates:[{
  id:'twelve-peaks-selection',status:'取得進展',note:'初評已完成，等待接引代表回覆拜師意願',evidence:narration
 }]})+'-->','assessment');
 for(let i=0;i<10;i++)w=commitV3Turn(w,'聊聊'+i,'韓守一說明場區的往事。'.repeat(50),'chat'+i);
 const ctx=gmContext(validatedWorld(JSON.parse(JSON.stringify(w))),'繼續');
 assert.match(ctx,/初評已完成，等待接引代表回覆拜師意願/);
 assert.ok(ctx.length<=11800);
});
