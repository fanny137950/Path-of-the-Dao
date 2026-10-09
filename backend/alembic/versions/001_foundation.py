from alembic import op
from backend.app.models import Base
revision='001';down_revision=None

def upgrade():
 op.execute('CREATE EXTENSION IF NOT EXISTS vector')
 Base.metadata.create_all(op.get_bind())
 op.execute("CREATE FUNCTION reject_history_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'History is immutable'; END $$")
 for table in ['events','truths']:
  op.execute(f'CREATE TRIGGER immutable_{table} BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION reject_history_change()')
def downgrade():
 raise RuntimeError('Historical data must be explicitly archived; destructive downgrade disabled')
