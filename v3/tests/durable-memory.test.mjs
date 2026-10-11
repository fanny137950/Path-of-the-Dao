import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn,validatedWorld,gmContext} from '../server/world.mjs';
import {hydrateDurableMemory,recallDurableMemory,updateDurableMemory} from '../server/durable-memory.mjs';

test('important promise survives storage reload and stays source-linked',()=>{
 const first=initialV3World('durable');
 const world=commitV3Turn(first,'我答應韓守一三日後帶刻有松紋的木劍','韓守一點了點頭，說：「我記下這個約定。」','durable-1');
 assert.equal(world.memoryLedger.entries.length,1);
 const entry=world.memoryLedger.entries[0];
 assert.equal(entry.eventId,'turn:1');
 assert.deepEqual(entry.witnesses,['registrar']);
 assert.ok(entry.kinds.includes('promise'));
 const saved=validatedWorld(JSON.parse(JSON.stringify(world)));
 assert.match(recallDurableMemory(saved,'木劍'),/松紋的木劍/);
 assert.match(gmContext(saved,'你還記得木劍嗎'),/松紋的木劍/);
 assert.equal(saved.memoryLedger.entries.length,1);
});

test('unwitnessed thoughts never become another NPC memory',()=>{
 const initial=initialV3World('private');
 const world=commitV3Turn(initial,'我心想：答應明天偷偷離開山門','韓守一依舊在翻名冊。','durable-private');
 assert.deepEqual(world.memoryLedger.entries[0].witnesses,[]);
 assert.equal(recallDurableMemory(world,'離開山門',{actorId:'registrar'}),'');
 assert.match(recallDurableMemory(world,'離開山門'),/偷偷離開山門/);
});

test('offscreen secrets are excluded and NPC scopes remain independent',()=>{
 const world=initialV3World('offscreen');
 world.events.push({id:'offscreen:key',type:'offscreen',text:'祕密事件',reply:'',witnesses:['shen']});
 hydrateDurableMemory(world);
 assert.equal(world.memoryLedger.entries.length,0);
 const next=commitV3Turn(world,'我答應韓守一明天再來','韓守一表示同意。','durable-2');
 assert.match(recallDurableMemory(next,'明天再來',{actorId:'registrar'}),/明天再來/);
 assert.equal(recallDurableMemory(next,'明天再來',{actorId:'shen'}),'');
});

test('old saves hydrate important history without duplicate events',()=>{
 let world=initialV3World('migrate');
 world=commitV3Turn(world,'我向韓守一道歉','韓守一接受了道歉。','durable-3');
 delete world.memoryLedger;
 validatedWorld(world);
 validatedWorld(world);
 assert.equal(world.memoryLedger.entries.length,1);
 updateDurableMemory(world,world.events[0]);
 assert.equal(world.memoryLedger.entries.length,1);
});

test('ordinary non-significant conversations do not flood the ledger',()=>{
 const world=commitV3Turn(initialV3World('quiet'),'今天天氣不錯','韓守一看看天色。','durable-4');
 assert.equal(world.memoryLedger.entries.length,0);
});

test('provider classification text cannot become historical facts',()=>{
 const world=initialV3World('reject');
 world.events.push({id:'turn:legacy',type:'conversation',text:'我答應保密',reply:'User Safety: safe',witnesses:['registrar'],revision:1,day:1,minute:490});
 hydrateDurableMemory(world);
 assert.equal(world.memoryLedger.entries.length,0);
});
