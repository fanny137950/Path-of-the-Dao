import {env} from 'cloudflare:workers';
import {GAME_RELEASE,GAME_RELEASE_NAME} from '../../../../v3/release.mjs';
export const dynamic='force-dynamic';
export function GET(){
 const sha=(env as unknown as Record<string,unknown>).GAME_BUILD_SHA;
 return Response.json({release:GAME_RELEASE,name:GAME_RELEASE_NAME,revision:typeof sha==='string'&&/^[a-f0-9]{40}$/i.test(sha)?sha:null},{headers:{'Cache-Control':'no-store'}});
}
