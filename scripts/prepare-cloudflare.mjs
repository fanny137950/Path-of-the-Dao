import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export function standaloneConfig(base, { account, database, name = 'wendao-living-world', local = false }) {
  if (!/^[a-z][a-z0-9-]{0,62}$/.test(name)) throw Error('Invalid Worker name');
  const placeholder = '00000000-0000-4000-8000-000000000000';
  if (!local && (!/^[a-f0-9]{32}$/i.test(account || '') || !/^[a-f0-9-]{36}$/i.test(database || '') || database === placeholder)) throw Error('A real Cloudflare account ID and D1 database ID are required');
  if (!base.main || !base.assets?.directory) throw Error('Build output is missing; build the project first');
  return {
    ...base, name, topLevelName: name, ...(local ? {} : { account_id: account }), workers_dev: true,
    vars: { AUTH_MODE: 'standalone', GAME_OWNER_ID: 'standalone-owner', GAME_DEVELOPER_USER_IDS: 'standalone-owner' },
    d1_databases: [{ binding: 'DB', database_name: name, database_id: local ? placeholder : database, migrations_dir: '../../drizzle' }],
    services: [], r2_buckets: [],
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const base = JSON.parse(readFileSync(path.join(root, 'dist/server/wrangler.json'), 'utf8'));
  const config = standaloneConfig(base, { account: process.env.CLOUDFLARE_ACCOUNT_ID, database: process.env.WENDAO_D1_DATABASE_ID, name: process.env.WENDAO_WORKER_NAME || 'wendao-living-world', local: process.argv.includes('--local') });
  writeFileSync(path.join(root, 'dist/server/wrangler.standalone.json'), JSON.stringify(config, null, 2) + '\n');
  console.log(`Prepared ${process.argv.includes('--local') ? 'LOCAL TEST' : 'production'} standalone Worker configuration.`);
}
