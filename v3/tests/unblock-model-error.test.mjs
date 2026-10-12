import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../app/v3/page.tsx',import.meta.url),'utf8');
test('permission/model configuration errors release pending turn instead of locking composer',()=>{
 assert.match(source,/\[400,401,403,413,422,503\]\.includes\(res\.status\)/);
 assert.match(source,/rememberPending\(null\)/);
 assert.match(source,/\[403,503\]\.includes\(res\.status\)\)setSettings\(true\)/);
});
test('older pending turns can be checked against saved request identity and explicitly canceled',()=>{
 assert.match(source,/async function cancelPending\(\)/);
 assert.match(source,/latest\.confirmedRequestId===waiting\.requestId/);
 assert.match(source,/latest\.revision!==waiting\.revision/);
 assert.match(source,/取消待確認／修改模型/);
 assert.match(source,/rememberPending\(null\);\s*setText\(waiting\.op/);
});
