import test from 'node:test';
import assert from 'node:assert/strict';
import { previewAssets } from '../lib/preview-assets.mjs';
const base = { inline: { '/_next/static/app.js': { body: 'export default 1', type: 'text/javascript' } }, images: ['/art/scene.png'], origin: 'https://raw.githubusercontent.com/owner/repo/commit/public', revision: 'commit' };
test('preview serves built assets but leaves private application routes to authentication', async () => {
  const serve = previewAssets(base);
  assert.equal(await serve(new Request('https://game.test/api/story')), null);
  assert.equal(await serve(new Request('https://game.test/toString')), null);
  const response = await serve(new Request('https://game.test/_next/static/app.js'));
  assert.equal(await response.text(), 'export default 1');
  assert.match(response.headers.get('cache-control'), /immutable/);
  assert.equal((await serve(new Request('https://game.test/_next/static/app.js', { method: 'POST' }))).status, 405);
});
test('preview image fetch is allowlisted, pinned and never forwards authentication', async () => {
  let calls = 0;
  const serve = previewAssets({ ...base, fetcher: async (url, options) => {
    calls++;
    assert.equal(url, base.origin + '/art/scene.png');
    assert.equal(options.headers.Cookie, undefined);
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.redirect, 'manual');
    return new Response('PNG', { headers: { 'Content-Type': 'image/png' } });
  } });
  const response = await serve(new Request('https://game.test/art/scene.png?secret=never-forward', { headers: { Cookie: 'private-session', Authorization: 'private-token' } }));
  assert.equal(await response.text(), 'PNG');
  assert.equal(await serve(new Request('https://game.test/art/unknown.png')), null);
  assert.equal(calls, 1);
});
test('preview rejects upstream errors and supports HEAD', async () => {
  const serve = previewAssets({ ...base, fetcher: async () => new Response('missing', { status: 404 }) });
  assert.equal((await serve(new Request('https://game.test/art/scene.png'))).status, 502);
  assert.equal(await (await serve(new Request('https://game.test/_next/static/app.js', { method: 'HEAD' }))).text(), '');
});
