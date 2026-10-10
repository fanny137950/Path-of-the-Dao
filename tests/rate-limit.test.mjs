import test from 'node:test';
import assert from 'node:assert/strict';
import {rateLimitMessage} from '../lib/story/rate-limit.mjs';
import {generateJSON} from '../lib/story/providers.mjs';
const message=(text,headers={})=>rateLimitMessage({error:{message:text}},new Headers(headers));
test('reports token window and numeric usage, excluding all provider identifiers',()=>{
 const result=message('Rate limit for private-model in org-private on tokens per min (TPM): Limit 30,000, Used 29,000, Requested 2,000. Please try again in 2.5s. secret-key');
 assert.match(result,/每分鐘Token 用量/);assert.match(result,/上限 30000，已用 29000，本次需要 2000/);assert.match(result,/等待 3 秒/);assert(!/private|secret/.test(result));
});
test('oversized requests are not told that waiting alone will fix them',()=>{
 const result=message('Request too large on tokens per min (TPM): Limit 6000, Requested 9000.');
 assert.match(result,/單純等待無法/);assert.match(result,/減少每回合資料/);
});
test('request and daily limits use only relevant reset headers',()=>{
 assert.match(message('requests per min (RPM)',{'x-ratelimit-reset-requests':'1m2.5s','x-ratelimit-reset-tokens':'9h'}),/完整重置約 63 秒/);
 assert.match(message('requests per day (RPD)'),/每日請求次數/);
 assert.match(message('requests per day (RPD)'),/每日額度重置/);
 assert.match(message('rate limit',{'x-ratelimit-reset-tokens':'1m'}),/未提供等待時間/);
});
test('full bucket reset never overrides explicit per-request retry guidance',()=>{
 const result=message('tokens per min (TPM): Limit 100000, Used 98727, Requested 2864. Please try again in 955ms.',{'x-ratelimit-reset-tokens':'11h27m19s'});
 assert.match(result,/等待 1 秒/);assert(!result.includes('41239'));
 const resetOnly=message('tokens per min (TPM)',{'x-ratelimit-reset-tokens':'11h27m19s'});
 assert.match(resetOnly,/完整重置約 41239 秒/);assert(!resetOnly.includes('至少等待'));
});
test('milliseconds retain their units and do not turn into an eleven-hour wait',()=>{
 assert.match(message('tokens per min (TPM)',{'retry-after-ms':'41239'}),/等待 42 秒/);
 assert.match(message('Please try again in 41239ms.'),/等待 42 秒/);
 const actualLong=message('tokens per min (TPM)',{'retry-after':'41239'});
 assert.match(actualLong,/等待 41239 秒/);assert.match(actualLong,/來源：Retry-After/);assert.match(actualLong,/不一致/);
});
test('a token limit without a stated period is not labelled per-minute',()=>{
 const result=rateLimitMessage({error:{type:'tokens',message:'Limit 100000, Used 98727, Requested 2864'}},new Headers());
 assert.match(result,/AI Token 用量/);assert(!result.includes('每分鐘'));
});
test('Retry-After seconds and dates take precedence; malformed values are not echoed',()=>{
 assert.match(message('tokens per min',{'retry-after':'20','x-ratelimit-reset-tokens':'1m'}),/等待 20 秒/);
 const now=Date.parse('2026-10-09T00:00:00Z');
 assert.match(rateLimitMessage({},new Headers({'retry-after':'Fri, 09 Oct 2026 00:00:30 GMT'}),now),/等待 30 秒/);
 assert.match(message('private raw message',{'retry-after':'secret','x-ratelimit-reset-tokens':'private'}),/未提供等待時間/);
});
test('rate limit does not trigger automatic additional API requests',async()=>{
 let calls=0;
 await assert.rejects(generateJSON({provider:'openai',model:'test',key:'not-real'},'',{},async()=>{
  calls++;return Response.json({error:{code:'rate_limit_exceeded',message:'requests per min (RPM): Limit 3, Used 3. Please try again in 20s.'}},{status:429});
 }),/每分鐘請求次數/);
 assert.equal(calls,1);
});
