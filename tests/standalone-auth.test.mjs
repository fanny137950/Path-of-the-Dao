import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, verifySession, safeReturn, standaloneRequest } from '../lib/auth/standalone.mjs';
import { standaloneConfig } from '../scripts/prepare-cloudflare.mjs';
const now = 1800000000000;
function environment() {
  const attempts = new Map();
  return { GAME_LOGIN_PASSWORD: 'test-only-private-password', GAME_SESSION_SECRET: 'test-only-session-signing-secret-123456', DB: { prepare(query) { return { bind(key) { return { async first() { const count = (attempts.get(key) || 0) + 1; attempts.set(key, count); return { attempts: count }; }, async run() { return {}; } }; } }; } } };
}
function request(path = '/api/story', options = {}) { return new Request('https://game.example' + path, options); }
function login(password, extra = {}) { return request('/signin-with-chatgpt', { method: 'POST', headers: { origin: 'https://game.example', 'content-type': 'application/x-www-form-urlencoded', ...extra }, body: new URLSearchParams({ password, return_to: '/' }) }); }
test('standalone rejects spoofed Sites identity, but leaves the original request body usable', async () => {
  const r = await standaloneRequest(request('/api/story', { method: 'POST', headers: { 'oai-authenticated-user-id': 'victim', 'Oai-Authenticated-User-Email': 'victim@example.com' }, body: '{"op":"list"}' }), environment(), now);
  assert(r instanceof Request); assert.equal(r.headers.get('oai-authenticated-user-id'), null); assert.equal(await r.text(), '{"op":"list"}');
});
test('signed session authenticates only the configured owner and expires', async () => {
  const env = environment(), token = await createSession(env, now);
  assert(await verifySession(token, env, now)); assert(!await verifySession(token, env, now + 8 * 86400000));
  const r = await standaloneRequest(request('/api/story', { headers: { cookie: '__Host-wendao-session=' + token, 'oai-authenticated-user-id': 'victim' } }), env, now);
  assert.equal(r.headers.get('oai-authenticated-user-id'), 'standalone-owner');
  assert(!await verifySession(token, { ...env, GAME_OWNER_ID: 'another-owner' }, now));
});
test('tampering or rotating either credential invalidates sessions', async () => {
  const env = environment(), token = await createSession(env, now);
  for (const invalid of ['broken', token + '.extra', 'x' + token, token.split('.')[0] + '.AAAA']) assert(!await verifySession(invalid, env, now));
  assert(!await verifySession(token, { ...env, GAME_LOGIN_PASSWORD: 'changed-test-only-password' }, now));
  assert(!await verifySession(token, { ...env, GAME_SESSION_SECRET: 'different-test-only-signing-secret-123456' }, now));
});
test('login succeeds with a Secure HttpOnly host cookie, and wrong password stays unauthenticated', async () => {
  const env = environment(); const bad = await standaloneRequest(login('wrong'), env, now); assert.equal(bad.status, 401); assert(!bad.headers.has('set-cookie'));
  const good = await standaloneRequest(login(env.GAME_LOGIN_PASSWORD), env, now); assert.equal(good.status, 303); assert.equal(good.headers.get('location'), '/');
  const cookie = good.headers.get('set-cookie'); for (const flag of ['__Host-wendao-session=', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert(cookie.includes(flag));
  assert(!cookie.includes(env.GAME_LOGIN_PASSWORD));
});
test('cross-origin login/logout and oversized login bodies are rejected', async () => {
  const env = environment(); assert.equal((await standaloneRequest(login(env.GAME_LOGIN_PASSWORD, { origin: 'https://attacker.example' }), env, now)).status, 403);
  assert.equal((await standaloneRequest(login('x'.repeat(5000)), env, now)).status, 413);
  assert.equal((await standaloneRequest(request('/signout-with-chatgpt'), env, now)).status, 405);
  assert.equal((await standaloneRequest(request('/signout-with-chatgpt', { method: 'POST', headers: { origin: 'https://attacker.example' } }), env, now)).status, 403);
  const logout = await standaloneRequest(request('/signout-with-chatgpt', { method: 'POST', headers: { origin: 'https://game.example' } }), env, now);
  assert.equal(logout.status, 303); assert(logout.headers.get('set-cookie').includes('Max-Age=0'));
});
test('persistent attempt counter limits guessing; missing database fails closed', async () => {
  const env = environment(); for (let i = 0; i < 10; i++) assert.equal((await standaloneRequest(login('wrong'), env, now)).status, 401);
  assert.equal((await standaloneRequest(login(env.GAME_LOGIN_PASSWORD), env, now)).status, 429);
  assert.equal((await standaloneRequest(login(env.GAME_LOGIN_PASSWORD), { ...env, DB: undefined }, now)).status, 503);
  const broken = { ...env, DB: { prepare() { throw Error('database unavailable'); } } };
  assert.equal((await standaloneRequest(login(env.GAME_LOGIN_PASSWORD), broken, now)).status, 503);
});
test('short/unconfigured credentials and duplicate cookies cannot authenticate', async () => {
  const env = environment(), token = await createSession(env, now);
  for (const bad of [{ ...env, GAME_SESSION_SECRET: '' }, { ...env, GAME_LOGIN_PASSWORD: 'weak' }]) {
    assert(!await verifySession(token, bad, now)); assert.equal((await standaloneRequest(request('/signin-with-chatgpt'), bad, now)).status, 503);
  }
  const r = await standaloneRequest(request('/api/story', { headers: { cookie: `__Host-wendao-session=${token}; __Host-wendao-session=${token}` } }), env, now);
  assert.equal(r.headers.get('oai-authenticated-user-id'), null);
});
test('login redirect cannot escape the site or return to an auth loop', async () => {
  for (const value of ['https://evil.example', '//evil.example', '/\\evil.example', '/signin-with-chatgpt', '/signout-with-chatgpt', '/callback', null]) assert.equal(safeReturn(value), '/');
  assert.equal(safeReturn('/legacy?x=1#top'), '/legacy?x=1#top');
  const response = await standaloneRequest(request('/signin-with-chatgpt?return_to=' + encodeURIComponent('/"><script>alert(1)</script>')), environment(), now);
  assert(!(await response.text()).includes('<script>')); assert(response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));assert.equal(response.headers.get('referrer-policy'),'same-origin');
});
test('production config requires real IDs and standalone auth; local mode is explicit', () => {
  const base = { main: 'index.js', assets: { directory: '../client' }, vars: { SHOULD_NOT_COPY: 'legacy' } };
  assert.throws(() => standaloneConfig(base, {}));
  assert.throws(() => standaloneConfig(base, { account: 'a'.repeat(32), database: '00000000-0000-4000-8000-000000000000' }));
  const c = standaloneConfig(base, { account: 'a'.repeat(32), database: '11111111-1111-4111-8111-111111111111' });
  assert.equal(c.vars.AUTH_MODE, 'standalone'); assert.equal(c.vars.SHOULD_NOT_COPY, undefined); assert.equal(c.d1_databases[0].migrations_dir, '../../drizzle');
  assert.equal(standaloneConfig(base, { local: true }).account_id, undefined);
});
