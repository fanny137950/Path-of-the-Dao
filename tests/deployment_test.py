import contextlib, importlib.util, io, json, os, pathlib, tempfile, unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('deployment', pathlib.Path(__file__).resolve().parents[1] / 'scripts/deploy-cloudflare.py')
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)

class DeploymentTests(unittest.TestCase):
 def setUp(self):
  self.temp = tempfile.TemporaryDirectory()
  self.root = pathlib.Path(self.temp.name)
  self.state = self.root / 'private-state'
  self.calls = []
  self.existing = False
  self.fail_migration = False
  self.patches = [patch.object(deploy, 'ROOT', self.root), patch.object(deploy, 'STATE', self.state), patch.object(deploy, 'api', self.api), patch.object(deploy, 'run', self.run_command), patch.dict(os.environ, {'CLOUDFLARE_ACCOUNT_ID':'a'*32, 'CLOUDFLARE_API_TOKEN':'test-only-not-a-real-token', 'WENDAO_WORKER_NAME':'wendao-test'})]
  for p in self.patches:p.start()
 def tearDown(self):
  for p in reversed(self.patches):p.stop()
  self.temp.cleanup()
 def api(self, method, path, data=None, allow_missing=False):
  self.calls.append(('api',method,path))
  if path.endswith('/settings'):return {} if self.existing else None
  if path.endswith('/workers/subdomain'):return {'subdomain':'example'}
  if '?name=' in path:return []
  if method=='POST' and path.endswith('/d1/database'):return {'uuid':'11111111-1111-4111-8111-111111111111'}
  if '/d1/database/' in path:return {'uuid':'11111111-1111-4111-8111-111111111111'}
  raise AssertionError((method,path))
 def run_command(self,args,**kwargs):
  self.calls.append(('run',args))
  if self.fail_migration and 'migrations' in args:raise RuntimeError('test migration failure')
 def test_missing_credentials_stop_before_any_remote_operation(self):
  with patch.dict(os.environ, {'CLOUDFLARE_API_TOKEN':''}):
   with self.assertRaisesRegex(RuntimeError,'securely'):deploy.main()
  self.assertEqual(self.calls,[])
 def test_existing_unknown_worker_is_not_overwritten(self):
  self.existing=True
  with self.assertRaisesRegex(RuntimeError,'avoid overwriting'):deploy.main()
  self.assertTrue(all(c[0]=='api' and c[1]=='GET' for c in self.calls))
 def test_migration_failure_prevents_code_publication(self):
  self.fail_migration=True
  with self.assertRaisesRegex(RuntimeError,'migration failure'):deploy.main()
  self.assertFalse(any(c[0]=='run' and 'deploy' in c[1] for c in self.calls))
  self.assertFalse(any(c[0]=='run' and 'bulk' in c[1] for c in self.calls))
 def test_repeat_deployment_reuses_database_and_does_not_reset_password(self):
  output=io.StringIO()
  with contextlib.redirect_stdout(output):deploy.main()
  secret_file=self.state/'worker-secrets.json'
  private=json.loads(secret_file.read_text())
  self.assertNotIn(private['GAME_LOGIN_PASSWORD'],output.getvalue())
  self.assertEqual(secret_file.stat().st_mode & 0o777,0o600)
  runs=[c[1] for c in self.calls if c[0]=='run']
  migration=next(i for i,r in enumerate(runs) if 'migrations' in r)
  publication=next(i for i,r in enumerate(runs) if 'deploy' in r)
  self.assertLess(migration,publication)
  self.calls=[];self.existing=True
  with contextlib.redirect_stdout(io.StringIO()):deploy.main()
  self.assertFalse(any(c[0]=='api' and c[1]!='GET' for c in self.calls))
  self.assertFalse(any(c[0]=='run' and 'bulk' in c[1] for c in self.calls))
  self.assertEqual(json.loads(secret_file.read_text()),private)

if __name__=='__main__':unittest.main()
