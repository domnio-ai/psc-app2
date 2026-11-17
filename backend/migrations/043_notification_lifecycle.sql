ALTER TABLE notifications ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS close_reason VARCHAR(80);

CREATE INDEX IF NOT EXISTS notifications_lifecycle_idx
  ON notifications(user_id, closed_at, created_at DESC)
  WHERE closed_at IS NOT NULL;
