import { readFileSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const revision = process.env.WENDAO_ART_REVISION || '095ce25c83e4b0b0b070f4088f76e0124e5ac05c';
if (!/^[a-f0-9]{40}$/.test(revision)) throw Error('A full public artwork revision is required');
const client = path.join(root, 'dist/client');
const server = path.join(root, 'dist/server');
const inline = {}, images = [];
const types = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
function collect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '_headers') continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { collect(file); continue; }
    const name = '/' + path.relative(client, file).split(path.sep).join('/');
    const bytes = readFileSync(file);
    if (name.startsWith('/art/') && name.endsWith('.png')) {
      const committed = execFileSync('git', ['show', `${revision}:public${name}`], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
      if (!bytes.equals(committed)) throw Error(`Artwork differs from pinned public revision: ${name}`);
      images.push(name);
    } else {
      const type = types[path.extname(name)];
      if (!type) throw Error(`Unsupported preview asset: ${name}`);
      inline[name] = { type, body: bytes.toString('utf8') };
    }
  }
}
collect(client);
const config = JSON.parse(readFileSync(path.join(server, 'wrangler.standalone.json'), 'utf8'));
delete config.assets;
config.main = 'preview-entry.js';
copyFileSync(path.join(root, 'lib/preview-assets.mjs'), path.join(server, 'preview-assets.mjs'));
writeFileSync(path.join(server, 'preview-manifest.js'), `export default ${JSON.stringify({inline, images, revision, origin: `https://raw.githubusercontent.com/fanny137950/Path-of-the-Dao/${revision}/public`})};\n`);
writeFileSync(path.join(server, 'preview-entry.js'), `import app from './index.js';\nimport manifest from './preview-manifest.js';\nimport {previewAssets} from './preview-assets.mjs';\nconst serve = previewAssets(manifest);\nexport default {async fetch(request, env, ctx) {return await serve(request, ctx, caches.default) || app.fetch(request, env, ctx);}};\n`);
writeFileSync(path.join(server, 'wrangler.preview.json'), JSON.stringify(config, null, 2) + '\n');
console.log(`Prepared private preview: ${Object.keys(inline).length} embedded assets, ${images.length} pinned public images.`);
