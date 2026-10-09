#!/usr/bin/env python3
"""Provision a standalone private game and deploy it using existing credentials.

Credentials are read from environment variables, never from command-line flags.
The original ChatGPT-hosted site and its database are outside this script's scope.
"""
import json, os, pathlib, re, secrets, subprocess, sys, urllib.request, urllib.error

ROOT = pathlib.Path(__file__).resolve().parent.parent
STATE = ROOT / '.sites-runtime' / 'cloudflare'
CONFIG = 'dist/server/wrangler.standalone.json'

def run(args, *, input=None, env=None):
    result = subprocess.run(args, cwd=ROOT, input=input, text=True, env=env)
    if result.returncode:
        raise RuntimeError(f'Command failed ({result.returncode}): {args[0]} {args[1]}')

def api(method, path, data=None, allow_missing=False):
    body = None if data is None else json.dumps(data).encode()
    request = urllib.request.Request('https://api.cloudflare.com/client/v4' + path, data=body,
        method=method, headers={'Authorization': 'Bearer ' + os.environ['CLOUDFLARE_API_TOKEN'], 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        if allow_missing and error.code == 404:
            return None
        raise RuntimeError(f'Cloudflare API {method} failed with HTTP {error.code}; verify account access and token permissions.') from None
    except urllib.error.URLError:
        raise RuntimeError('Cloudflare API could not be reached; verify network access.') from None
    if not payload.get('success'):
        codes = [str(item.get('code')) for item in payload.get('errors', [])]
        raise RuntimeError('Cloudflare API rejected the request (codes: ' + ', '.join(codes) + ').')
    return payload.get('result')

def private_json(path, data):
    # No credential values are printed or written into repository configuration.
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as file:
        json.dump(data, file)

def main():
    account = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '')
    if not re.fullmatch(r'[a-fA-F0-9]{32}', account) or not os.environ.get('CLOUDFLARE_API_TOKEN'):
        raise RuntimeError('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN securely in environment settings first.')
    name = os.environ.get('WENDAO_WORKER_NAME', 'wendao-living-world')
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,62}', name):
        raise RuntimeError('Invalid WENDAO_WORKER_NAME.')
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    target_file = STATE / 'deployment.json'
    target = json.loads(target_file.read_text()) if target_file.exists() else None
    if target and (target['account'] != account or target['name'] != name):
        raise RuntimeError('Saved deployment belongs to a different account or Worker. Use a separate checkout for another target.')
    prefix = f'/accounts/{account}'
    existing = api('GET', prefix + '/workers/scripts/' + name + '/settings', allow_missing=True) is not None
    if existing and not target:
        raise RuntimeError('This Worker name already exists without a matching local deployment record. Select a new WENDAO_WORKER_NAME to avoid overwriting another site.')
    subdomain = api('GET', prefix + '/workers/subdomain').get('subdomain')
    if not subdomain:
        raise RuntimeError('Activate a workers.dev subdomain in Cloudflare Workers & Pages, then retry.')
    # Validate before creating infrastructure or publishing.
    run(['node', '--test', *[str(p.relative_to(ROOT)) for p in sorted((ROOT / 'tests').glob('*.test.mjs'))]])
    run(['python', 'tests/database_test.py'])
    run(['python', 'tests/story_database_test.py'])
    run(['python', 'tests/deployment_test.py'])
    run(['node', 'node_modules/typescript/bin/tsc', '--noEmit'])
    run(['bash', 'scripts/sites-env.sh', '--', 'npm', 'run', 'build'])
    if target:
        database = target['database']
        api('GET', prefix + '/d1/database/' + database)
    else:
        matches = api('GET', prefix + '/d1/database?name=' + name)
        if matches:
            raise RuntimeError('A D1 database with this name already exists without a matching deployment record. Choose a new WENDAO_WORKER_NAME; no existing database was modified.')
        database = api('POST', prefix + '/d1/database', {'name': name, 'primary_location_hint': 'apac'})['uuid']
        target = {'account': account, 'name': name, 'database': database, 'url': f'https://{name}.{subdomain}.workers.dev'}
        private_json(target_file, target)
    env = {**os.environ, 'WENDAO_D1_DATABASE_ID': database, 'WENDAO_WORKER_NAME': name, 'CI': 'true'}
    run(['node', 'scripts/prepare-cloudflare.mjs'], env=env)
    config = CONFIG
    if os.environ.get('WENDAO_ASSET_MODE') == 'embedded-preview':
        run(['node', 'scripts/prepare-preview.mjs'], env=env)
        config = 'dist/server/wrangler.preview.json'
    def wrangler(*args, input=None):
        run(['bash', 'scripts/sites-env.sh', '--', 'node', 'node_modules/wrangler/bin/wrangler.js', *args, '--config', config], input=input, env=env)
    secret_file = STATE / 'worker-secrets.json'
    if not secret_file.exists():
        if existing:
            raise RuntimeError('Local initial-login material is missing. Existing Worker secrets were preserved; recover deployment state or explicitly configure credentials in Cloudflare before continuing.')
        private_json(secret_file, {'GAME_LOGIN_PASSWORD': secrets.token_urlsafe(24), 'GAME_SESSION_SECRET': secrets.token_urlsafe(48)})
    secret_values = json.loads(secret_file.read_text())
    # Apply additive migrations first; the deployed Worker fails closed until its
    # secrets are present, including during the first deployment.
    wrangler('d1', 'migrations', 'apply', 'DB', '--remote')
    wrangler('deploy')
    if not target.get('secrets_uploaded'):
        wrangler('secret', 'bulk', input=json.dumps(secret_values))
        target['secrets_uploaded'] = True
        target_file.write_text(json.dumps(target))
    login_file = STATE / 'owner-login.txt'
    if not login_file.exists():
        with os.fdopen(os.open(login_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as file:
            file.write(target['url'] + '\n\n世界登入密碼：\n' + secret_values['GAME_LOGIN_PASSWORD'] + '\n')
    print('Published Worker: ' + target['url'])
    print('Initial login is in the private file: ' + str(login_file))
    print('Verify login and persistence at the published URL before declaring deployment complete.')

if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, ValueError, KeyError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
