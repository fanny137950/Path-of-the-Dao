import sqlite3,pathlib,json,unittest
class DatabaseTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for p in sorted(pathlib.Path('drizzle').glob('*.sql')):self.db.executescript(p.read_text())
  self.db.execute('INSERT INTO worlds VALUES (?,?,?,?,?,?)',('a','owner','test',0,'{"events":[],"items":1}','now'))
 def test_only_one_competing_revision_commits(self):
  x=self.db.execute('UPDATE worlds SET revision=1,state=? WHERE id=? AND owner=? AND revision=0',('{"events":[1],"items":0}','a','owner'))
  self.assertEqual(x.rowcount,1)
  x=self.db.execute('UPDATE worlds SET revision=1,state=? WHERE id=? AND owner=? AND revision=0',('{}','a','owner'))
  self.assertEqual(x.rowcount,0)
  self.assertEqual(json.loads(self.db.execute('SELECT state FROM worlds').fetchone()[0])['items'],0)
 def test_wrong_owner_cannot_write(self):
  x=self.db.execute('UPDATE worlds SET state=? WHERE id=? AND owner=?',('{}','a','other'))
  self.assertEqual(x.rowcount,0)
 def test_snapshot_survives_live_world_change(self):
  self.db.execute("INSERT INTO saves SELECT 's',owner,id,'before',state,'now' FROM worlds")
  self.db.execute("UPDATE worlds SET state='{}'")
  self.assertEqual(json.loads(self.db.execute('SELECT state FROM saves').fetchone()[0])['items'],1)
 def test_failed_transaction_leaves_state_intact(self):
  self.db.commit()
  try:
   with self.db:
    self.db.execute("UPDATE worlds SET state='{}'")
    self.db.execute("INSERT INTO worlds VALUES ('a','x','duplicate',0,'{}','now')")
  except sqlite3.IntegrityError:pass
  self.assertEqual(json.loads(self.db.execute('SELECT state FROM worlds').fetchone()[0])['items'],1)
 def event(self):
  self.db.execute("INSERT INTO event_ledger VALUES ('a','e',1,'speech','home','hello','witness','{}')")
 def test_event_history_is_immutable(self):
  self.event()
  for sql in ["UPDATE event_ledger SET content='changed'","DELETE FROM event_ledger"]:
   with self.assertRaises(sqlite3.IntegrityError):self.db.execute(sql)
 def test_knowledge_cannot_reference_other_world(self):
  self.event()
  self.db.execute("INSERT INTO worlds VALUES ('b','owner','test',0,'{}','now')")
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("INSERT INTO actor_knowledge VALUES ('b','shen','e',1,'witnessed')")
 def test_revision_receipt_conflict_rolls_back_batch(self):
  self.db.execute("INSERT INTO turn_commits VALUES ('a','first',1,'{}')")
  self.db.commit()
  try:
   with self.db:
    self.db.execute("UPDATE worlds SET state='changed'")
    self.db.execute("INSERT INTO turn_commits VALUES ('a','second',1,'{}')")
  except sqlite3.IntegrityError:pass
  self.assertNotEqual(self.db.execute('SELECT state FROM worlds').fetchone()[0],'changed')
 def test_truth_is_immutable(self):
  self.db.execute("INSERT INTO sealed_truths VALUES ('a','truth','hash','{}')")
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("UPDATE sealed_truths SET data='guess'")
unittest.main()
