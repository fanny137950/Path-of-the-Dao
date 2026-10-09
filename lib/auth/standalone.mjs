const COOKIE = '__Host-wendao-session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();
const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const decode = text => Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
const digest = text => crypto.subtle.digest('SHA-256', encoder.encode(text));
const owner = env => env.GAME_OWNER_ID || 'standalone-owner';
function configured(env) {
  return typeof env.GAME_LOGIN_PASSWORD === 'string' && env.GAME_LOGIN_PASSWORD.length >= 16 &&
    typeof env.GAME_SESSION_SECRET === 'string' && env.GAME_SESSION_SECRET.length >= 32 && env.DB;
}
async function signingKey(env) {
  // Changing either secret revokes all existing sessions.
  const key = await digest(`${env.GAME_SESSION_SECRET}\0${env.GAME_LOGIN_PASSWORD}`);
  return crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function createSession(env, now = Date.now()) {
  const payload = encode(encoder.encode(JSON.stringify({ sub: owner(env), exp: Math.floor(now / 1000) + SESSION_SECONDS, aud: 'wendao-owner-v1' })));
  const signature = encode(await crypto.subtle.sign('HMAC', await signingKey(env), encoder.encode(payload)));
  return `${payload}.${signature}`;
}
export async function verifySession(token, env, now = Date.now()) {
  if (!configured(env) || typeof token !== 'string' || token.length > 2048) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    if (!await crypto.subtle.verify('HMAC', await signingKey(env), decode(parts[1]), encoder.encode(parts[0]))) return false;
    const payload = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    return payload.sub === owner(env) && payload.aud === 'wendao-owner-v1' && Number.isInteger(payload.exp) && payload.exp > Math.floor(now / 1000);
  } catch { return false; }
}
function cookieToken(request) {
  const values = (request.headers.get('cookie') || '').split(';').map(x => x.trim()).filter(x => x.startsWith(`${COOKIE}=`));
  return values.length === 1 ? values[0].slice(COOKIE.length + 1) : '';
}
export function safeReturn(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const url = new URL(value, 'https://game.invalid');
    if (url.origin !== 'https://game.invalid' || ['/signin-with-chatgpt', '/signout-with-chatgpt', '/callback'].includes(url.pathname)) return '/';
    return url.pathname + url.search + url.hash;
  } catch { return '/'; }
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function loginPage(returnTo, error = '', status = 200) {
  return new Response(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登入 · 問道九州</title><style>body{margin:0;background:#112631;color:#ecdfbf;font-family:system-ui;min-height:100dvh;display:grid;place-items:center}main{box-sizing:border-box;width:min(424px,calc(100vw - 32px));padding:28px;border:1px solid #9f8b5f;border-radius:16px}h1{font-weight:400;letter-spacing:.2em}p,small{line-height:1.7}label,input,button{display:block;box-sizing:border-box;width:100%}input,button{margin:12px 0;padding:14px;border:1px solid #9f8b5f;border-radius:6px;font-size:16px}button{background:#d4ba7e;color:#112631;cursor:pointer}.error{color:#ffbdac}</style><main><small>WEN DAO JIU ZHOU</small><h1>重返山中</h1><p>輸入此私人世界的登入密碼。<br>這與 AI 模型的 API 金鑰不同。</p>${error ? `<p class="error" role="alert">${escape(error)}</p>` : ''}<form method="post" action="/signin-with-chatgpt"><input type="hidden" name="return_to" value="${escape(returnTo)}"><label for="password">世界登入密碼</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256" autofocus><button type="submit">進入世界</button></form><small>此為獨立部署的私人單人版本。</small></main></html>`, {
    status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" },
  });
}
function redirect(path, token, clear = false) {
  return new Response(null, { status: 303, headers: {
    Location: path, 'Cache-Control': 'no-store',
    'Set-Cookie': `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${clear ? 0 : SESSION_SECONDS}`,
  } });
}
async function smallBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); throw new Error('body too large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
async function allowAttempt(request, env, now) {
  const window = Math.floor(now / 900000), expires = (window + 1) * 900000;
  // Cloudflare supplies this header at its trusted edge; the raw IP is not stored.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `${window}:${encode(await digest(`${env.GAME_SESSION_SECRET}\0${ip}`))}`;
  const increment = key => env.DB.prepare('INSERT INTO auth_login_limits (key,attempts,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(key, expires).first();
  const [client, global] = await Promise.all([increment(key), increment(`${window}:global`)]);
  await env.DB.prepare('DELETE FROM auth_login_limits WHERE expires < ?').bind(now).run();
  return client.attempts <= 10 && global.attempts <= 200;
}
/** Returns an authenticated Request for the app, or a response for auth routes. */
export async function standaloneRequest(request, env, now = Date.now()) {
  const url = new URL(request.url), headers = new Headers(request.headers);
  // Never accept a visitor-supplied Sites identity on the independent host.
  for (const name of [...headers.keys()]) if (name.startsWith('oai-authenticated-user-')) headers.delete(name);
  const signIn = url.pathname === '/signin-with-chatgpt', signOut = url.pathname === '/signout-with-chatgpt';
  if ((signIn || signOut) && !['GET', 'POST'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: signIn ? 'GET, POST' : 'POST' } });
  if (signIn || signOut) {
    if (!configured(env)) return loginPage('/', '登入服務尚未完成設定，請稍後再試。', 503);
    if (request.method === 'POST' && request.headers.get('origin') !== url.origin) return new Response('拒絕跨來源登入操作', { status: 403 });
    if (signOut) {
      if (request.method !== 'POST') return new Response('請以登出按鈕送出。', { status: 405, headers: { Allow: 'POST' } });
      return redirect('/', '', true);
    }
    const returnTo = safeReturn(url.searchParams.get('return_to'));
    if (request.method === 'GET') return loginPage(returnTo);
    if (!(request.headers.get('content-type') || '').startsWith('application/x-www-form-urlencoded')) return loginPage('/', '登入資料格式不符。', 415);
    let form;
    try { form = new URLSearchParams(await smallBody(request)); } catch { return loginPage('/', '登入資料過長。', 413); }
    try {
      if (!await allowAttempt(request, env, now)) {
        const response = loginPage(safeReturn(form.get('return_to')), '嘗試次數過多，請十五分鐘後再試。', 429);
        response.headers.set('Retry-After', '900'); return response;
      }
    } catch { return loginPage('/', '登入服務暫時無法使用，請稍後再試。', 503); }
    const supplied = form.get('password') || '';
    const [a, b] = await Promise.all([digest(supplied), digest(env.GAME_LOGIN_PASSWORD)]);
    const expected = new Uint8Array(b); let difference = 0;
    new Uint8Array(a).forEach((byte, i) => { difference |= byte ^ expected[i]; });
    if (!supplied || supplied.length > 256 || difference) return loginPage(safeReturn(form.get('return_to')), '密碼不正確。', 401);
    return redirect(safeReturn(form.get('return_to')), await createSession(env, now));
  }
  if (await verifySession(cookieToken(request), env, now)) {
    headers.set('oai-authenticated-user-id', owner(env));
    headers.set('oai-authenticated-user-email', 'owner@wendao.invalid');
    headers.set('oai-authenticated-user-full-name', encodeURIComponent('玩家'));
    headers.set('oai-authenticated-user-full-name-encoding', 'percent-encoded-utf-8');
  }
  return new Request(request, { headers });
}
