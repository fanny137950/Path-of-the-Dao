import test from 'node:test';
import assert from 'node:assert/strict';
import { generateJSON } from '../lib/story/providers.mjs';
import { interpret } from '../lib/story/dialogue.mjs';
import { prepareScene } from '../lib/story/scene.mjs';
import { initialStory } from '../lib/story/world.mjs';
import { INTENT_RESPONSE_SCHEMA, SCENE_RESPONSE_SCHEMA } from '../lib/story/output-schemas.mjs';
const connection = { provider: 'gemini', model: 'gemini-3.6-flash', key: 'test-key-not-real' };
test('Gemini uses compatible JSON mode without hard schema and reads only final answer parts', async () => {
  const result = await generateJSON(connection, 'system', {}, async (url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.generationConfig.maxOutputTokens, 8192);
    assert.equal(body.generationConfig.responseSchema, undefined);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert(!init.body.includes(connection.key));
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [
      { thought: true, text: 'private analysis, not JSON' }, { text: '{"kind":' }, { text: '"continue"}' },
    ] } }] });
  }, { responseSchema: INTENT_RESPONSE_SCHEMA });
  assert.deepEqual(result, { kind: 'continue' });
});
test('Gemini HTTP 400 diagnostics are safe and never automatically retry', async () => {
  const cases = [
    ['Invalid JSON payload: response_schema too complex', '結構化輸出'],
    ['maxOutputTokens exceeds allowed limit', '輸出長度'],
    ['API key not valid: private-key', '金鑰無效'],
    ['Input token count exceeds limit: private-story', '輸入長度'],
    ['Developer instruction is not enabled', '系統指令'],
    ['Unknown error containing private-key and private-story', '未能安全判定'],
  ];
  for (const [message, expected] of cases) {
    let calls = 0;
    await assert.rejects(generateJSON(connection, '', {}, async () => {
      calls++;
      return Response.json({ error: { code: 400, message } }, { status: 400 });
    }), error => error.message.includes(expected) && !/private-key|private-story/.test(error.message));
    assert.equal(calls, 1);
  }
});
test('truncated response never commits state or triggers extra provider calls, even if JSON parses', async () => {
  const state = initialStory('truncated-gemini'), before = JSON.stringify(state);
  let calls = 0;
  await assert.rejects(prepareScene({ state, text: '繼續', target: 'shen', connection, generate: (c, s, i, transport, options) => {
    assert.deepEqual(options.responseSchema, SCENE_RESPONSE_SCHEMA);
    return generateJSON(c, s, i, async () => {
      calls++;
      return Response.json({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"beats":[{"speaker":"shen","text":"先歇一會。"}]}' }] } }] });
    }, options);
  } }), /資料被截斷/);
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(state), before);
});
test('Gemini content blocks and invalid JSON remain failures without leaking provider text', async () => {
  for (const response of [
    { promptFeedback: { blockReason: 'SAFETY' } },
    { candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: 'private provider response' }] } }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"beats":[' }] } }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'null' }] } }] },
  ]) {
    await assert.rejects(generateJSON(connection, '', {}, async () => Response.json(response)), error => /正式回合未提交/.test(error.message) && !error.message.includes('private provider response'));
  }
});
test('intent parsing and scene generation each request their own schema', async () => {
  await interpret(connection, { text: '你好' }, async (c, s, i, transport, options) => {
    assert.deepEqual(options.responseSchema, INTENT_RESPONSE_SCHEMA);
    return { kind: 'speak', target: 'shen' };
  });
  const result = await prepareScene({ state: initialStory('schema-scene'), text: '繼續', target: 'shen', connection, generate: async (c, s, i, transport, options) => {
    assert.deepEqual(options.responseSchema, SCENE_RESPONSE_SCHEMA);
    return { beats: [{ speaker: 'shen', text: '先坐下，喝口茶。' }], stopReason: 'natural' };
  } });
  assert.equal(result.state.revision, 1);
});
