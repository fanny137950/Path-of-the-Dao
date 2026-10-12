import test from 'node:test';
import assert from 'node:assert/strict';
import {serverAIConfig,publicAIConfig,chooseServerAI} from '../server/server-ai.mjs';

test('site AI is disabled until authorized, and secrets never reach the browser',()=>{
 const env={OPENAI_API_KEY:'sk-secret',OPENROUTER_API_KEY:'sk-or-secret',
  V3_AI_USER_IDS:'owner-1,owner-2',V3_OPENAI_MODELS:'gpt-4.1-mini,gpt-4.1',
  V3_OPENROUTER_MODELS:'openrouter/free'};
 const owner=serverAIConfig(env,'owner-1');
 assert.equal(owner.providers.ai.ready,true);
 assert.equal(chooseServerAI(owner,'ai','gpt-4.1').apiKey,'sk-secret');
 const publicView=publicAIConfig(owner);
 assert.equal(JSON.stringify(publicView).includes('secret'),false);
 assert.equal(publicView.providers.ai.ready,true);
 const stranger=serverAIConfig(env,'other-user');
 assert.equal(publicAIConfig(stranger).providers.ai.ready,false);
 assert.throws(()=>chooseServerAI(stranger,'ai','gpt-4.1'),/尚未獲得/);
});
test('model selection cannot cause arbitrary charges or bypass allowlist',()=>{
 const env={V3_AI_USER_IDS:'user',OPENAI_API_KEY:'sk-secret',
  V3_OPENAI_MODELS:'gpt-4.1-mini',OPENROUTER_API_KEY:'sk-or-secret'};
 const config=serverAIConfig(env,'user');
 assert.deepEqual(config.providers.ai.models,['gpt-4.1-mini']);
 assert.throws(()=>chooseServerAI(config,'ai','gpt-5-pro'),/允許清單/);
 assert.throws(()=>chooseServerAI(config,'openrouter','anthropic/paid'),/允許清單/);
 assert.equal(chooseServerAI(config,'openrouter','openrouter/free').model,'openrouter/free');
 assert.throws(()=>chooseServerAI(config,'demo','gpt-4.1-mini'),/尚未在伺服器設定/);
});
test('blank secrets and missing allowlist never grant access',()=>{
 const config=serverAIConfig({OPENAI_API_KEY:'sk-secret'},'user');
 assert.equal(config.allowed,false);
 assert.equal(config.providers.ai.ready,false);
 const allowed=serverAIConfig({V3_AI_USER_IDS:'user'},'user');
 assert.equal(allowed.providers.ai.ready,false);
 assert.throws(()=>chooseServerAI(allowed,'ai','gpt-4.1-mini'),/尚未在伺服器設定/);
});
