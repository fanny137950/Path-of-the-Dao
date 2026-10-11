import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn,gmContext,validatedWorld} from '../server/world.mjs';
import {currentSceneEvents,sceneConversationForGM,episodicMemoriesForGM} from '../server/conversation-memory.mjs';

const turn=(world,index,player,reply)=>
 commitV3Turn(world,player,reply,'memory-phase1-'+index);

test('active scene retains detailed recent dialogue beyond previous 22-message cap',()=>{
 let world=initialV3World('scene-full');
 for(let i=1;i<=18;i++)
  world=turn(world,i,'我與韓守一討論話題'+i+'：今日宗門的日常。','韓守一詳細說明第'+i+'個話題：規矩仍在，但可以慢慢聽。');
 const transcript=sceneConversationForGM(world,'還記得嗎',4700);
 assert.match(transcript,/話題18/);
 assert.match(transcript,/話題13/);
 assert.match(transcript,/第18個話題/);
 assert.equal(currentSceneEvents(world).length,18);
 assert.match(gmContext(world,'我想繼續剛才第18個話題'),/話題18/);
});

test('history can recover an old promise without fabricating new claims',()=>{
 let world=initialV3World('long-memory');
 world=turn(world,1,'我答應韓守一三日後帶來刻著松紋的木劍','韓守一點頭：「我記住了，三日後見。」');
 for(let i=2;i<36;i++)world=turn(world,i,'我和韓守一閒聊今日排隊的人數'+i,'韓守一回了一句話。');
 const context=gmContext(world,'你還記得我們約好的松紋木劍嗎');
 assert.match(context,/松紋木劍/);
 assert.match(context,/三日後/);
 assert.ok(context.length<=11800);
 const after=validatedWorld(structuredClone(world));
 assert.match(gmContext(after,'說好的木劍呢'),/松紋木劍/);
});

test('scene changes on travel even if old destination scene was long',()=>{
 let world=initialV3World('travel-memory');
 world=turn(world,1,'韓守一你要記住這個「松枝信物」','韓守一答應記下信物。');
 const travel='洛河從山門出發，終於抵達棲風峰。\n<!--GM_STATE:{"move":{"to":"棲風峰","evidence":"終於抵達棲風峰"}}-->';
 world=turn(world,2,'我前往棲風峰',travel);
 assert.equal(world.location,'棲風峰');
 assert.equal(currentSceneEvents(world).length,1);
 assert.doesNotMatch(sceneConversationForGM(world,'我現在在哪裡'),/韓守一答應記下信物/);
 assert.match(episodicMemoriesForGM(world,'松枝信物'),/松枝信物/);
});

test('unwitnessed hidden offscreen truth must not become conversational memory',()=>{
 let world=initialV3World('privacy-memory');
 world=turn(world,1,'我心想：神祕暗號是青玉星','韓守一沒有察覺洛河心底的想法。');
 // GM may know the player's own thoughts, but not promote them to witnesses.
 assert.deepEqual(world.events[0].witnesses,[]);
 assert.deepEqual(world.npcs.registrar.memories,[]);
 world.events.push({id:'hidden-plan',type:'offscreen',text:'不該讀取的後台密語：赤雀',reply:'',hidden:true});
 const context=episodicMemoriesForGM(world,'赤雀');
 assert.doesNotMatch(context,/赤雀/);
 assert.doesNotMatch(sceneConversationForGM(world,'赤雀'),/後台密語/);
});

test('large scene keeps latest player input and GM agency instructions within cap',()=>{
 let world=initialV3World('length');
 for(let i=1;i<=45;i++)
  world=turn(world,i,'聊天'+i+'：'+('我再仔細問一遍宗門以前的慣例。'.repeat(9)),
   '韓守一回答了這些問題。'+('他翻過名冊。'.repeat(20)));
 const ctx=gmContext(world,'我現在改問一句全新的重要問題：可否轉交書信？');
 assert.ok(ctx.length<=11800,ctx.length);
 assert.match(ctx,/【洛河最新輸入】我現在改問一句全新的重要問題/);
 assert.match(ctx,/【GM主動性】/);
 assert.match(ctx,/聊天45/);
});

test('background time skip begins a new scene at same location',()=>{
 let world=initialV3World('time-cut');
 world=turn(world,1,'我說早安','韓守一回了早安。');
 world=commitV3Turn(world,'留在原地等待','人群換了幾批。','time-cut-id',{advanceMinutes:360});
 assert.equal(currentSceneEvents(world).length,1);
 assert.doesNotMatch(sceneConversationForGM(world,'剛剛發生什麼'),/回了早安/);
});
