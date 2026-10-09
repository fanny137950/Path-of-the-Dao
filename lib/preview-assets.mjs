/** Static assets for a private preview when the host cannot upload asset JWTs. */
export function previewAssets({ inline, images, origin, revision, fetcher = fetch }) {
  return async function serve(request, ctx = {}, cache) {
    const url = new URL(request.url);
    const entry = Object.hasOwn(inline, url.pathname) ? inline[url.pathname] : null;
    const isImage = images.includes(url.pathname);
    if (!entry && !isImage) return null;
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    if (entry) return new Response(request.method === 'HEAD' ? null : entry.body, { headers: {
      'Content-Type': entry.type, 'X-Content-Type-Options': 'nosniff',
      'Cache-Control': url.pathname.startsWith('/_next/static/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    } });
    const key = new Request(`${url.origin}${url.pathname}?release=${revision}`);
    let response = await cache?.match(key);
    if (!response) {
      // This is a fixed, public repository revision. Never forward visitor headers.
      const upstream = await fetcher(origin + url.pathname, { headers: { 'User-Agent': 'Wendao-Preview', Accept: 'image/png' }, redirect: 'manual' });
      if (!upstream.ok || !(upstream.headers.get('content-type') || '').startsWith('image/')) return new Response('Artwork temporarily unavailable', { status: 502 });
      response = new Response(upstream.body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
      if (cache && ctx.waitUntil) ctx.waitUntil(cache.put(key, response.clone()));
    }
    return request.method === 'HEAD' ? new Response(null, response) : response;
  };
}
