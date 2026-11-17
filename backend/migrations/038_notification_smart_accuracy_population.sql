-- APP2 Notifications V1.2 - Smart Inbox Accuracy + Population
-- Adds authoritative workflow category and corrects priority semantics.
-- Existing notifications are NEVER retroactively queued for email.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS notification_category VARCHAR(24) NOT NULL DEFAULT 'Information';

DO $$ BEGIN
  ALTER TABLE notifications ADD CONSTRAINT notifications_category_check
    CHECK(notification_category IN('Action','Review','Reminder','Information'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS notifications_user_category_state_idx
  ON notifications(user_id,notification_category,archived_at,created_at DESC);

CREATE OR REPLACE FUNCTION app2_notification_category(
  p_title TEXT,
  p_entity_type TEXT,
  p_reminder_kind TEXT DEFAULT NULL
) RETURNS VARCHAR
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_reminder_kind,'')<>'' THEN 'Reminder'
    WHEN COALESCE(p_title,'') IN (
      'Assignment report review assigned',
      'Research section requires approval',
      'Research report awaiting review',
      'Draft research report ready for review',
      'Document awaiting review',
      'Document review assigned',
      'Research review assigned',
      'Document deletion approval required',
      'Document improvement reviewer assigned',
      'Assignment proposal awaiting approval'
    ) THEN 'Review'
    WHEN COALESCE(p_title,'') IN (
      'New research assignment',
      'New approved research assignment',
      'Research lead assignment',
      'Research project assigned',
      'Assigned task',
      'Research final report ready to publish',
      'Assignment report changes requested',
      'Assignment report rejected',
      'Research report changes requested',
      'Research report rejected',
      'Document returned for correction',
      'Document deletion rejected',
      'Document improvement assigned'
    ) THEN 'Action'
    WHEN COALESCE(p_title,'') ~* '(due soon|due tomorrow|overdue|milestone due|milestone overdue|review due soon|review overdue|disposition action due|improvement overdue)$'
      THEN 'Reminder'
    ELSE 'Information'
  END
$$;

CREATE OR REPLACE FUNCTION app2_classify_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  txt TEXT := lower(coalesce(NEW.title,'')||' '||coalesce(NEW.body,''));
  category VARCHAR;
BEGIN
  category := app2_notification_category(NEW.title,NEW.entity_type,NEW.reminder_kind);
  NEW.notification_category := category;

  IF txt ~ '(security|password|account locked|unauthori[sz]ed|critical security)' THEN
    NEW.priority := 'Critical';
  ELSIF category IN('Action','Review','Reminder') THEN
    NEW.priority := 'High';
  ELSIF NEW.title IN (
    'Previously approved notice',
    'Assignment completed',
    'Assignment status update',
    'Research status update',
    'Research report approved',
    'Research completed',
    'Final Assignment Report published',
    'Document approved',
    'Document deletion approved',
    'Record superseded'
  ) THEN
    NEW.priority := 'Informational';
  ELSE
    NEW.priority := COALESCE(NULLIF(NEW.priority,''),'Normal');
  END IF;

  IF NEW.priority IN('Critical','High') THEN
    NEW.important_at := COALESCE(NEW.important_at,NOW());
    NEW.email_eligible := TRUE;
    IF NEW.email_status='Not Required' THEN NEW.email_status := 'Pending'; END IF;
    NEW.next_email_attempt_at := COALESCE(NEW.next_email_attempt_at,NOW());
  ELSE
    NEW.email_eligible := FALSE;
    NEW.email_status := 'Not Required';
    NEW.next_email_attempt_at := NULL;
  END IF;

  RETURN NEW;
END $$;

-- Correct the current inbox taxonomy and visible priority without emailing old history.
UPDATE notifications
SET notification_category=app2_notification_category(title,entity_type,reminder_kind),
    priority=CASE
      WHEN lower(coalesce(title,'')||' '||coalesce(body,'')) ~ '(security|password|account locked|unauthori[sz]ed|critical security)'
        THEN 'Critical'
      WHEN app2_notification_category(title,entity_type,reminder_kind) IN('Action','Review','Reminder')
        THEN 'High'
      WHEN title IN (
        'Previously approved notice','Assignment completed','Assignment status update',
        'Research status update','Research report approved','Research completed',
        'Final Assignment Report published','Document approved',
        'Document deletion approved','Record superseded'
      ) THEN 'Informational'
      ELSE CASE WHEN priority='Critical' THEN 'Critical' ELSE 'Normal' END
    END,
    email_eligible=FALSE,
    email_status=CASE WHEN email_sent_at IS NOT NULL THEN 'Sent' ELSE 'Not Required' END,
    next_email_attempt_at=NULL
WHERE email_sent_at IS NULL;

-- Keep already-sent delivery audit intact while fixing its category/priority.
UPDATE notifications
SET notification_category=app2_notification_category(title,entity_type,reminder_kind),
    priority=CASE
      WHEN lower(coalesce(title,'')||' '||coalesce(body,'')) ~ '(security|password|account locked|unauthori[sz]ed|critical security)' THEN 'Critical'
      WHEN app2_notification_category(title,entity_type,reminder_kind) IN('Action','Review','Reminder') THEN 'High'
      ELSE priority
    END
WHERE email_sent_at IS NOT NULL;
