// @ts-nocheck
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {testConnection,PROVIDERS} from '../../../lib/story/providers.mjs';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'拒絕跨來源操作'},{status:403});if(!await getChatGPTUser())return Response.json({error:'請先登入'},{status:401});const raw=await request.text();if(raw.length>5000)throw Error('請求過長');const b=JSON.parse(raw);if(!PROVIDERS[b.provider])throw Error('不支援的 Provider');if(b.op!=='test')return Response.json({configured:!!env[PROVIDERS[b.provider].key],connected:false,status:'untested',message:'請測試連線。帳號登入與 AI 模型連線分開管理。'});return Response.json(await testConnection(b,env),{headers:{'Cache-Control':'no-store'}});}catch(e){return Response.json({connected:false,status:'error',error:e.message},{status:400});}}
