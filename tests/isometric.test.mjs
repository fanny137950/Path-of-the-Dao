import {test} from 'node:test';import assert from 'node:assert/strict';import {project,unproject} from '../lib/game/isometric.mjs';
test('等角投影的點擊座標可準確轉回世界位置',()=>{for(const p of [{x:0,z:10},{x:-34,z:34},{x:15,z:-13},{x:4.2,z:3.9}]){const back=unproject(project(p));assert(Math.abs(back.x-p.x)<1e-10);assert(Math.abs(back.z-p.z)<1e-10)}});
test('畫面上下左右映射到相應世界方向',()=>{const p=project({x:0,z:0});assert.deepEqual(unproject({x:p.x,y:p.y-15}),{x:-3,z:-3});assert.deepEqual(unproject({x:p.x+30,y:p.y}),{x:3,z:-3})});
