ALTER TABLE notifications ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS important_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'Normal';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action VARCHAR(80);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_workspace VARCHAR(80);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_tab VARCHAR(80);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_key VARCHAR(240);

DO $$ BEGIN
  ALTER TABLE notifications ADD CONSTRAINT notifications_priority_check
    CHECK(priority IN('High','Normal','Informational'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS notifications_inbox_idx
  ON notifications(user_id,archived_at,read_at,created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_important_idx
  ON notifications(user_id,important_at,created_at DESC)
  WHERE important_at IS NOT NULL AND archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_key_idx
  ON notifications(user_id,event_key)
  WHERE event_key IS NOT NULL;
