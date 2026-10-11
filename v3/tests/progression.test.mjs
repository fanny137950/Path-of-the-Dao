import test from 'node:test';
import assert from 'node:assert/strict';
import {
 initialProgress,progressOf,spiritualRootForWorld,prepareProgress,
 suggestedActions,progressFacts,demoProgressReply
} from '../server/progression.mjs';
import {initialV3World,validatedWorld,commitV3Turn,playerWorld,gmContext} from '../server/world.mjs';

const doTurn=(world,player,request)=>commitV3Turn(world,player,prepareProgress(world,player).cutscene||demoProgressReply(world,player),request);
test('new V3 players have contextual optional actions and an untested spirit root',()=>{
 const w=initialV3World('00000000-0000-0000-0000-000000000001');
 assert.equal(progressOf(w).phase,'test_ready');
 assert.equal(w.protagonist.spiritualRoot,'未測定');
 assert.deepEqual(suggestedActions(w).map(x=>x.id),['test','ask','observe']);
 assert.equal(playerWorld(w).choices[0].text,'我走到測靈石前，把手掌按上去。');
 assert.match(w.messages[0].content,/測靈石/);
 assert.match(progressFacts(w,'你好'),/無需再問姓名或年齡/);
});

test('ambiguous short input puts hand on the stone, tests roots once, and advances',()=>{
 const start=initialV3World('00000000-0000-0000-0000-000000000002');
 const prepared=prepareProgress(start,'手放上去');
 assert.equal(prepared.kind,'root-test');
 assert.ok(prepared.cutscene.includes(prepared.root));
 const tested=commitV3Turn(start,'手放上去',prepared.cutscene,'test-1');
 assert.equal(tested.progress.phase,'result_known');
 assert.equal(tested.protagonist.spiritualRoot,spiritualRootForWorld(start.id));
 assert.deepEqual(playerWorld(tested).choices.map(x=>x.id),['take','root','peak']);
 assert.equal(tested.events[0].milestone,'root-test');
 assert.equal(tested.npcs.registrar.memories.length,1);
 assert.match(tested.messages.at(-1).content,/初試合格/);
 assert.equal(prepareProgress(tested,'手放上去').kind,'conversation');
 assert.equal(start.protagonist.spiritualRoot,'未測定');
});

test('do not advance when user refuses to touch the stone',()=>{
 const w=initialV3World('no');
 for(const msg of ['我不按測靈石','先別碰','我不要測靈根','我還沒按上去']){
  assert.equal(prepareProgress(w,msg).kind,'conversation',msg);
 }
});

test('full guided onboarding advances without re-asking for earlier steps',()=>{
 let w=initialV3World('00000000-0000-0000-0000-000000000003');
 w=doTurn(w,'我走到測靈石前，把手掌按上去。','stage-test');
 w=doTurn(w,'我接過韓守一遞來的報到木牌。','stage-token');
 assert.equal(w.progress.phase,'admitted');
 assert.equal(w.protagonist.spiritualRoot,spiritualRootForWorld(w.id));
 assert.deepEqual(playerWorld(w).choices.map(x=>x.id),['go','peak','friends']);
 w=doTurn(w,'我拿著木牌前往外門報到處。','stage-go');
 assert.equal(w.progress.phase,'outer_checkin');
 assert.equal(w.location,'外門報到處');
 assert.ok(w.npcs.guide.memories.length>0);
 assert.deepEqual(playerWorld(w).choices.map(x=>x.id),['checkin','daily','peers']);
 w=doTurn(w,'我將木牌交給接引弟子，請她幫我登記住處。','stage-checkin');
 assert.equal(w.progress.phase,'onboarded');
 assert.deepEqual(playerWorld(w).choices.map(x=>x.id),['classes','training','friends']);
 assert.match(w.messages.at(-1).content,/明早辰時/);
 assert.equal(w.events.length,4);
 assert.deepEqual(w.events.map(x=>x.milestone),['root-test','token-accepted','outer-arrival','onboarding-complete']);
 assert.match(gmContext(w,'我翻開日課冊'),/初試與報到早已結束/);
 assert.equal(w.npcs.shen.memories.length,0);
});

test('typing arbitrary words cannot skip admission or invent hidden results',()=>{
 let w=initialV3World('guard');
 const no=doTurn(w,'我直接去外門報到，不測靈根','skip');
 assert.equal(no.progress.phase,'test_ready');
 assert.equal(no.protagonist.spiritualRoot,'未測定');
 const w2=doTurn(w,'我伸手觸碰測靈石','ok');
 assert.equal(prepareProgress(w2,'我前往外門報到處').kind,'conversation');
 assert.equal(w2.progress.phase,'result_known');
});

test('old saves with known roots are upgraded without overwriting their prior result',()=>{
 const w=initialV3World('legacy');
 delete w.progress;
 w.protagonist.spiritualRoot='雷靈根';
 const loaded=validatedWorld(w);
 assert.equal(loaded.progress.phase,'result_known');
 assert.equal(loaded.protagonist.spiritualRoot,'雷靈根');
 assert.equal(prepareProgress(loaded,'我把手按上去').kind,'conversation');
});
test('suggestion objects are new copies and cannot mutate server choices',()=>{
 const w=initialV3World('copy');
 const first=suggestedActions(w);
 first[0].text='作弊，直接改成化神';
 assert.notEqual(suggestedActions(w)[0].text,first[0].text);
});
