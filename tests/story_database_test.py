import sqlite3, pathlib, json, unittest, time
class StoryDatabaseTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:');self.db.execute('PRAGMA foreign_keys=ON')
  for p in sorted(pathlib.Path('drizzle').glob('*.sql')):self.db.executescript(p.read_text())
  self.db.execute('INSERT INTO worlds VALUES (?,?,?,?,?,?)',('a','owner','story',0,json.dumps({'mode':'story-v1','items':1}),'now'))
  self.db.commit()
 def claim(self,request='r',lease='lease',expires=None):
  self.db.execute('INSERT INTO story_requests VALUES (?,?,?,?,?,?,?,?)',('a',request,'fingerprint','processing',lease,expires or int(time.time()*1000)+120000,0,None));self.db.commit()
 def commit(self,request='r',revision=1,lease='lease'):
  self.db.execute('INSERT INTO turn_commits VALUES (?,?,?,?)',('a',request,revision,json.dumps({'lease':lease})))
  self.db.execute('UPDATE worlds SET revision=?,state=? WHERE id=?',(revision,json.dumps({'mode':'story-v1','items':0}),'a'))
 def test_successful_receipt_and_consumption_are_atomic(self):
  self.claim()
  with self.db:self.commit()
  self.assertEqual(self.db.execute('SELECT revision FROM worlds').fetchone()[0],1)
  self.assertEqual(self.db.execute('SELECT count(*) FROM turn_commits').fetchone()[0],1)
 def test_retry_does_not_consume_twice(self):
  self.claim()
  with self.db:self.commit()
  with self.assertRaises(sqlite3.IntegrityError):
   with self.db:self.commit()
  self.assertEqual(self.db.execute('SELECT revision FROM worlds').fetchone()[0],1)
 def test_competing_revision_rejected_before_mutation(self):
  self.claim();self.claim('other','newlease')
  with self.db:self.commit()
  with self.assertRaises(sqlite3.IntegrityError):
   with self.db:self.commit('other',1,'newlease')
  self.assertEqual(self.db.execute('SELECT count(*) FROM turn_commits').fetchone()[0],1)
 def test_expired_lease_and_old_worker_cannot_commit(self):
  self.claim(expires=1)
  with self.assertRaises(sqlite3.IntegrityError):
   with self.db:self.commit()
  self.db.execute("UPDATE story_requests SET lease='replacement',expires=?",(int(time.time()*1000)+120000,));self.db.commit()
  with self.assertRaises(sqlite3.IntegrityError):
   with self.db:self.commit()
  self.assertEqual(self.db.execute('SELECT revision FROM worlds').fetchone()[0],0)
 def test_mid_batch_failure_rolls_back_receipt_and_world(self):
  self.claim()
  with self.assertRaises(sqlite3.IntegrityError):
   with self.db:
    self.commit();self.db.execute("INSERT INTO actor_knowledge VALUES ('a','shen','nonexistent',0,'witnessed')")
  self.assertEqual(self.db.execute('SELECT revision FROM worlds').fetchone()[0],0)
  self.assertEqual(self.db.execute('SELECT count(*) FROM turn_commits').fetchone()[0],0)
 def add_message(self,seq,content,audience):
  self.db.execute('INSERT INTO story_messages(world,id,seq,minute,location,speaker,kind,content,audience,event) VALUES (?,?,?,?,?,?,?,?,?,?)',('a',f'a:m{seq}',seq,seq,'home','player','dialogue',content,json.dumps(audience),None))
 def test_full_dialogue_immutable_and_npc_private_filter(self):
  self.add_message(1,'shared',['player','shen']);self.add_message(2,'private thought',['player'])
  rows=self.db.execute("SELECT content FROM story_messages WHERE world='a' AND EXISTS(SELECT 1 FROM json_each(audience) WHERE value='shen')").fetchall()
  self.assertEqual(rows,[('shared',)])
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("UPDATE story_messages SET content='rewritten'")
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute('DELETE FROM story_messages')
 def test_old_checkpoint_branch_copies_only_prior_events_and_dialogue(self):
  self.db.execute("INSERT INTO worlds VALUES ('b','owner','branch',0,'{\"mode\":\"story-v1\"}','now')")
  for n in range(1,4):
   e={'id':f'a:e{n}','timeline':'a','knowers':['player','shen'],'content':f'event{n}'}
   self.db.execute('INSERT INTO event_ledger VALUES (?,?,?,?,?,?,?,?)',('a',e['id'],n,'speech','home',e['content'],'witness',json.dumps(e,separators=(',',':'))))
   self.db.execute('INSERT INTO actor_knowledge VALUES (?,?,?,?,?)',('a','shen',e['id'],n,'witnessed'))
   self.add_message(n,f'message{n}',['player','shen'])
  self.db.execute("INSERT INTO event_ledger SELECT 'b','b'||substr(id,2),minute,type,location,content,source,replace(replace(data,'a:','b:'),'\"timeline\":\"a\"','\"timeline\":\"b\"') FROM event_ledger WHERE world='a' AND CAST(substr(id,4) AS INTEGER)<=2")
  self.db.execute("INSERT INTO actor_knowledge SELECT 'b',actor,'b'||substr(event,2),acquired,status FROM actor_knowledge WHERE world='a' AND CAST(substr(event,4) AS INTEGER)<=2")
  self.db.execute("INSERT INTO story_messages SELECT 'b','b'||substr(id,2),seq,minute,location,speaker,kind,content,audience,event,performance FROM story_messages WHERE world='a' AND seq<=2")
  self.assertEqual(self.db.execute("SELECT id FROM event_ledger WHERE world='b' ORDER BY id").fetchall(),[('b:e1',),('b:e2',)])
  self.assertEqual(self.db.execute("SELECT count(*) FROM story_messages WHERE world='b'").fetchone()[0],2)
  self.assertEqual(json.loads(self.db.execute("SELECT data FROM event_ledger WHERE world='b' LIMIT 1").fetchone()[0])['timeline'],'b')
 def test_performance_survives_history_and_branch_without_private_emotion(self):
  performance={'to':'jiang','expression':'calm','delivery':'平靜地放下茶杯','historyRefs':['shen:teaching-notes:v1']}
  self.db.execute('INSERT INTO story_messages(world,id,seq,minute,location,speaker,kind,content,audience,event,performance) VALUES (?,?,?,?,?,?,?,?,?,?,?)',('a','a:m1',1,1,'home','shen','dialogue','先坐下',json.dumps(['player','shen','jiang']),None,json.dumps(performance)))
  self.db.execute("INSERT INTO worlds VALUES ('b','owner','branch',0,'{}','now')")
  self.db.execute("INSERT INTO story_messages SELECT 'b','b:m1',seq,minute,location,speaker,kind,content,audience,event,performance FROM story_messages WHERE world='a'")
  row=self.db.execute("SELECT performance FROM story_messages WHERE world='b'").fetchone()[0]
  self.assertEqual(json.loads(row),performance)
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("UPDATE story_messages SET performance='{}' WHERE world='a'")
 def test_legacy_message_defaults_to_empty_performance(self):
  self.add_message(1,'舊版原文',['player','shen'])
  self.assertEqual(self.db.execute("SELECT performance FROM story_messages").fetchone()[0],'{}')
 def test_hundred_turn_retrieval_important_fact_and_knowledge_join(self):
  for n in range(101):
   ty='personal-memory' if n==0 else 'speech';content='我害怕被遺忘' if n==0 else '普通閒聊'
   e={'id':f'a:e{n}','type':ty,'content':content};self.db.execute('INSERT INTO event_ledger VALUES (?,?,?,?,?,?,?,?)',('a',e['id'],n,ty,'home',content,'對話原文',json.dumps(e)))
   self.db.execute('INSERT INTO actor_knowledge VALUES (?,?,?,?,?)',('a','shen',e['id'],n,'witnessed'))
  rows=self.db.execute("SELECT e.content FROM event_ledger e JOIN actor_knowledge k ON e.world=k.world AND e.id=k.event WHERE e.world='a' AND k.actor='shen' AND e.type='personal-memory'").fetchall()
  self.assertEqual(rows,[('我害怕被遺忘',)])
  self.assertEqual(self.db.execute("SELECT count(*) FROM actor_knowledge WHERE actor='gu'").fetchone()[0],0)
if __name__=='__main__':unittest.main()
