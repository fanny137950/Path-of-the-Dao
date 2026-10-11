import test from 'node:test';
import assert from 'node:assert/strict';
import { generateGMResponse, AIProviderError } from '../server/openai.mjs';

test('rejects missing API key before request', async () => {
  await assert.rejects(generateGMResponse({apiKey:'',model:'gpt-4.1-mini',instructions:'GM',input:'你好'}), AIProviderError);
});

test('extracts response and usage without storing key', async () => {
  let called = false;
  const result = await generateGMResponse({
    apiKey: 'test-key',
    model: 'gpt-4.1-mini',
    instructions: '你是 GM',
    input: '洛河走進大殿',
    fetchImpl: async (url, opts) => {
      called = true;
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(opts.headers.Authorization, 'Bearer test-key');
      assert.equal(JSON.parse(opts.body).store, false);
      return {ok:true,json:async()=>({model:'gpt-4.1-mini',output:[{type:'message',content:[{type:'output_text',text:'沈滄月抬起頭。'}]}],usage:{input_tokens:40,output_tokens:12,total_tokens:52}})};
    },
  });
  assert.equal(called,true);
  assert.equal(result.text,'沈滄月抬起頭。');
  assert.equal(result.usage.totalTokens,52);
  assert.equal(JSON.stringify(result).includes('test-key'),false);
});

test('rejects invalid model IDs', async () => {
  await assert.rejects(generateGMResponse({apiKey:'x',model:'bad model',instructions:'GM',input:'你好'}), /無效模型/);
});
