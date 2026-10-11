import test from 'node:test';
import assert from 'node:assert/strict';
import {turnIdentity,checkTurnRequest} from '../server/turn-request.mjs';
import {initialV3World,commitV3Turn} from '../server/world.mjs';

const body={op:'turn',text:'你好',revision:0,mode:'demo',model:'openrouter/free'};
test('new turns require the version the player actually read',()=>{
 const world=initialV3World('request');
 assert.deepEqual(checkTurnRequest(world,'a',turnIdentity(body,body.text)),{replayed:false});
 for(const revision of [undefined,-1,1])
  assert.equal(checkTurnRequest(world,'a',turnIdentity({...body,revision},body.text)).status,409);
});
test('replay after subsequent turns is safe, changed requests are rejected',()=>{
 let world=commitV3Turn(initialV3World('retry'),'你好','韓守一點頭。','a');
 const identity=turnIdentity(body,body.text);
 world.events.find(e=>e.requestId==='a').request=identity;
 world=commitV3Turn(world,'謝謝','韓守一翻開名冊。','b');
 assert.deepEqual(checkTurnRequest(world,'a',identity),{replayed:true});
 for(const changed of [{text:'走開'},{model:'other/model:free'},{mode:'ai'},{revision:2},{op:'advance-time',advanceMinutes:60}])
  assert.equal(checkTurnRequest(world,'a',{...identity,...changed}).status,409);
});
test('time advances retain their duration and canonical text in request identity',()=>{
 const world=initialV3World('wait');
 const wait={...body,op:'advance-time',advanceMinutes:15};
 const text='洛河在目前位置等待一刻鐘。';
 const next=commitV3Turn(world,text,'一刻鐘後，韓守一仍在工作。','wait',{advanceMinutes:15});
 const identity=turnIdentity(wait,text);next.events.find(e=>e.requestId==='wait').request=identity;
 assert.equal(next.minute-world.minute,15);
 assert.deepEqual(checkTurnRequest(next,'wait',identity),{replayed:true});
 assert.equal(checkTurnRequest(next,'wait',turnIdentity({...wait,advanceMinutes:60},text)).status,409);
});
test('legacy receipts remain readable without changing history',()=>{
 const world=commitV3Turn(initialV3World('legacy'),'你好','韓守一點頭。','old');
 const before=structuredClone(world);
 assert.deepEqual(checkTurnRequest(world,'old',turnIdentity(body,body.text)),{replayed:true});
 assert.equal(checkTurnRequest(world,'old',turnIdentity(body,'不同輸入')).status,409);
 assert.deepEqual(world,before);
});
