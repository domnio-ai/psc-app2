-- APP2 Notifications Priority + Email + Reminders V1
-- Additive, backward-compatible notification delivery foundation.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_priority_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_priority_check
  CHECK(priority IN('Critical','High','Normal','Informational'));

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_eligible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_status VARCHAR(24) NOT NULL DEFAULT 'Not Required';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_message_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_last_error TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS next_email_attempt_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reminder_kind VARCHAR(40);

DO $$ BEGIN
  ALTER TABLE notifications ADD CONSTRAINT notifications_email_status_check
    CHECK(email_status IN('Not Required','Pending','Sending','Sent','Retry','Suppressed','Failed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS important_email_notifications BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS deadline_reminders BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS notifications_email_queue_idx
  ON notifications(email_status,next_email_attempt_at,created_at)
  WHERE email_eligible=TRUE AND email_status IN('Pending','Retry');

CREATE OR REPLACE FUNCTION app2_classify_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  txt TEXT := lower(coalesce(NEW.title,'')||' '||coalesce(NEW.body,''));
BEGIN
  IF txt ~ '(security|password|account locked|unauthori[sz]ed|critical security)' THEN
    NEW.priority := 'Critical';
  ELSIF txt ~ '(overdue|past due|due today|new assignment|assignment allocated|new task assigned|task review assigned|ready for review|review assigned|approval required|awaiting approval|changes requested|returned for correction|rejected|urgent|immediate action|required reviewer|document deletion approval required|improvement assigned)' THEN
    NEW.priority := 'High';
  ELSIF txt ~ '(completed|approved|published|status update|comment|information|previously approved)' THEN
    IF NEW.priority='Normal' THEN NEW.priority := 'Informational'; END IF;
  END IF;

  IF NEW.priority IN('Critical','High') THEN
    NEW.important_at := COALESCE(NEW.important_at,NOW());
    NEW.email_eligible := TRUE;
    IF NEW.email_status='Not Required' THEN NEW.email_status := 'Pending'; END IF;
    NEW.next_email_attempt_at := COALESCE(NEW.next_email_attempt_at,NOW());
  ELSE
    NEW.email_eligible := FALSE;
    NEW.email_status := 'Not Required';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS app2_notifications_classify_before_insert ON notifications;
CREATE TRIGGER app2_notifications_classify_before_insert
BEFORE INSERT ON notifications
FOR EACH ROW EXECUTE FUNCTION app2_classify_notification();

-- Historical notifications remain in-app only. Do not send old workflow mail after migration.
UPDATE notifications
SET email_eligible=FALSE,
    email_status='Not Required',
    next_email_attempt_at=NULL
WHERE created_at < NOW() - INTERVAL '1 minute'
  AND email_sent_at IS NULL;
