import test from 'node:test';
import assert from 'node:assert/strict';
import {assessActionResolution,isDecisiveAttack,actionResolutionDirective} from '../server/action-resolution.mjs';

const actualFailure='韓煜的眉梢笑意越發濃厚，似乎對你的提議相當有興趣，但話鋒一轉，他靠近一步，聲音低沉又帶著幾分挑釁：「真敢動手？小子，這可不是鬧著玩的。你要讓我信服你的本事，先動動你的手腳吧。」灰布衣少年在一旁看著。韓守一說：「這裡不是打架的地方。」韓煜半開玩笑地說：「來吧，洛河，要不先試試你的拳頭，讓我知道你說的欠打是什麼味道？」他雙眼微眯，等著你的動作。';
test('打他 is an action; dialogue taunts are not its resolution',()=>{
 assert.equal(isDecisiveAttack('打他'),true);
 assert.equal(isDecisiveAttack('揍韓煜'),true);
 assert.equal(isDecisiveAttack('你很欠打'),false);
 assert.equal(isDecisiveAttack('你要不要打他'),false);
 const status=assessActionResolution('打他',actualFailure);
 assert.equal(status.ok,false,JSON.stringify(status));
 assert.match(actionResolutionDirective('打他',status),/擊中、閃避、格擋或遭制止/);
});
test('actual defense, hit, and immediate intervention are valid outcomes',()=>{
 for(const narrative of [
  '洛河揮拳朝韓煜面門打去，韓煜側身躲開，她的拳頭落空。',
  '洛河一腳踢中韓煜的膝側，韓守一立即上前制止。',
  '洛河剛揮拳，便被韓守一扣住手腕，拳頭未能碰到韓煜。',
  '洛河出拳，韓煜抬掌格擋，兩人各退一步。',
 ]){
  assert.equal(assessActionResolution('打他',narrative).ok,true,narrative);
 }
});
test('unrelated natural dialogues are not restricted',()=>{
 assert.equal(assessActionResolution('你是誰','「我叫韓煜。」').ok,true);
 assert.equal(assessActionResolution('繼續','韓守一繼續整理名冊。').ok,true);
 assert.equal(assessActionResolution('打他','韓煜只是冷笑一聲，又問：「你敢不敢？」').ok,false);
});
