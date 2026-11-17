CREATE TABLE IF NOT EXISTS meeting_schedule_approval_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approver_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointed_by uuid NOT NULL REFERENCES users(id),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_schedule_approval_appointments_distinct_users CHECK(subject_user_id<>approver_user_id),
  CONSTRAINT meeting_schedule_approval_appointments_expiry CHECK(expires_at>starts_at)
);
CREATE INDEX IF NOT EXISTS idx_meeting_schedule_appointments_subject_active
  ON meeting_schedule_approval_appointments(subject_user_id,approver_user_id,expires_at DESC)
  WHERE revoked_at IS NULL;