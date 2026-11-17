BEGIN;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS schedule_approval_status varchar(32) NOT NULL DEFAULT 'Approved';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS schedule_approver_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS schedule_approval_decided_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS schedule_approval_decided_at timestamptz;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS schedule_approval_comments text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS schedule_approval_submitted_at timestamptz;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS resource_links jsonb NOT NULL DEFAULT '[]'::jsonb;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='meetings_schedule_approval_status_check') THEN
    ALTER TABLE meetings ADD CONSTRAINT meetings_schedule_approval_status_check
      CHECK (schedule_approval_status IN ('Pending Approval','Approved','Returned','Rejected'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_meetings_schedule_approver_pending
  ON meetings(schedule_approver_id, schedule_approval_submitted_at DESC)
  WHERE schedule_approval_status='Pending Approval';
CREATE TABLE IF NOT EXISTS meeting_schedule_approval_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approver_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointed_by uuid NOT NULL REFERENCES users(id),
  starts_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CHECK (subject_user_id <> approver_user_id),
  CHECK (expires_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_meeting_schedule_appointments_subject_active
  ON meeting_schedule_approval_appointments(subject_user_id, approver_user_id, expires_at DESC)
  WHERE revoked_at IS NULL;
COMMIT;