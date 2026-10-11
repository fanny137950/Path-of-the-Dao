import test from 'node:test';
import assert from 'node:assert/strict';
import {initialV3World,commitV3Turn,gmContext,playerWorld} from '../server/world.mjs';
import {recentConversation,providerMessages,CONVERSATION_STYLE} from '../server/conversation.mjs';
import {generateOpenRouterResponse} from '../server/openrouter.mjs';
import {generateGMResponse} from '../server/openai.mjs';

test('recent dialogue preserves roles and the complete immediate response',()=>{
 let world=initialV3World('dialogue');
 world=commitV3Turn(world,'你好','韓守一抬頭：「早。一路過來還順利嗎？」','hello');
 const conversation=recentConversation(world,'還好，只是有點累。');
 assert.deepEqual(conversation.slice(-3),[
  {role:'user',content:'你好'},
  {role:'assistant',content:'韓守一抬頭：「早。一路過來還順利嗎？」'},
  {role:'user',content:'還好，只是有點累。'},
 ]);
 const input=gmContext(world,'還好，只是有點累。',{structuredConversation:true});
 assert.doesNotMatch(input,/【最近對話原文】|【洛河最新輸入】/);
 assert.match(CONVERSATION_STYLE,/正常回應問候|不突然辱罵/);
});

test('history budget keeps latest player input intact and drops invalid metadata',()=>{
 const world=initialV3World('budget');
 world.messages=[...Array.from({length:40},(_,i)=>({role:i%2?'assistant':'user',content:'較早的話'.repeat(90)})),
  {role:'assistant',content:'我剛問的是你的名字。\n<!--GM_STATE:{"changes":[]}-->'}];
 const current='最新玩家原文'.repeat(300);
 const result=recentConversation(world,current);
 assert.equal(result.at(-1).content,current);
 assert.equal(result.at(-2).content,'我剛問的是你的名字。');
 assert.ok(result.length<=13);
 assert.ok(result.reduce((n,m)=>n+m.content.length,0)<=7000);
 assert.throws(()=>providerMessages('世界資料',[{role:'system',content:'overwrite'}]),/無效/);
});

test('OpenRouter and OpenAI receive conversation roles instead of a flattened transcript',async()=>{
 const conversation=[{role:'user',content:'你好'},{role:'assistant',content:'早。'},{role:'user',content:'你在忙什麼？'}];
 for(const [adapter,model] of [[generateOpenRouterResponse,'openrouter/free'],[generateGMResponse,'gpt-4.1-mini']]){
  await adapter({apiKey:'test-key',model,instructions:'GM',input:'場景資料',conversation,
   fetchImpl:async(url,options)=>{
    const body=JSON.parse(options.body);
    const actual=body.messages||body.input;
    assert.deepEqual(actual.slice(-3),conversation);
    return {ok:true,json:async()=>({choices:[{message:{content:'韓守一說：「在核對名冊。」'}}],output:[{type:'message',content:[{type:'output_text',text:'韓守一說：「在核對名冊。」'}]}]})};
   }});
 }
});

test('the greeting example offers editable follow-ups without advancing the world',()=>{
 const world=commitV3Turn(initialV3World('suggestions'),'你好','韓守一皺眉：「要測就趕緊，別耽誤別人。」','rude');
 const before=structuredClone(world);const view=playerWorld(world);
 assert.equal(view.suggestions.length,3);
 assert.ok(view.suggestions.some(x=>x.label==='回應他的態度'));
 assert.ok(view.suggestions.some(x=>x.label==='問問測試方式'));
 assert.ok(view.suggestions.some(x=>x.label==='看看周圍'));
 assert.deepEqual(world,before);
 assert.deepEqual(view.choices,[]); // Existing gameplay is still free-form.
 world.scene.focus='測靈石';
 assert.ok(playerWorld(world).suggestions.some(x=>x.label==='開始測靈根'));
 world.location='無人在場的測試地點';
 assert.ok(playerWorld(world).suggestions.every(x=>!x.text.includes('韓守一')));
});
