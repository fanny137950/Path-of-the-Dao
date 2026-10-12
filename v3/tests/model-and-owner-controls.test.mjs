import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GM_INSTRUCTIONS,SCENE_PACING} from '../server/gm-prompt.mjs';
const route=readFileSync(new URL('../../app/api/v3/world/route.ts',import.meta.url),'utf8');
const connection=readFileSync(new URL('../../app/api/v3/connection/route.ts',import.meta.url),'utf8');
const page=readFileSync(new URL('../../app/v3/page.tsx',import.meta.url),'utf8');
test('GM favors complete, living scenes over terse answers',()=>{
 assert.match(SCENE_PACING,/3～7 個有內容的自然段落/);
 assert.match(SCENE_PACING,/不代表只回一句/);
 assert.match(SCENE_PACING,/不用刻意灌水/);
 assert.ok(GM_INSTRUCTIONS.includes(SCENE_PACING));
});
test('selected provider and actual model are connected to player UI',()=>{
 assert.match(route,/chooseServerAI\(serverAIConfig\(env,user\.userId\),mode,body\.model\)/);
 assert.match(route,/usedModel=result\.model/);
 assert.match(route,/usage,usedModel/);
 assert.match(connection,/body\.mode==='ai'/);
 assert.match(connection,/generateGMResponse\(args\)/);
 assert.match(connection,/generateOpenRouterResponse\(args\)/);
 assert.match(page,/上回合實際使用/);
 assert.match(page,/JSON\.stringify\(\{model:model\.trim\(\),mode\}\)/);
 assert.doesNotMatch(page,/setApiKey\(/);
});
test('own-world developer inspector and history deletion enforce account ownership',()=>{
 assert.match(route,/readWorld\(id,user\.userId\)/);
 assert.match(route,/readWorld\(body\.world,user\.userId\)/);
 assert.doesNotMatch(route,/GAME_DEVELOPER_USER_IDS/);
 assert.match(route,/body\.op==='delete-history'/);
 assert.match(route,/body\.confirm!=='DELETE_MY_V3_HISTORY'/);
 assert.match(route,/DELETE FROM worlds WHERE owner=\? AND json_extract\(state,'\$\.mode'\)='v3'/);
 assert.match(page,/window\.prompt\('為防止誤刪/);
 assert.match(page,/永久清除我所有 V3 世界線及對話紀錄/);
});
