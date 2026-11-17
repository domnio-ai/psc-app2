CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(240) NOT NULL,
  meeting_type varchar(80) NOT NULL DEFAULT 'Departmental',
  description text NOT NULL DEFAULT '',
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  venue varchar(300),
  meeting_link text,
  status varchar(40) NOT NULL DEFAULT 'Scheduled',
  created_by uuid NOT NULL REFERENCES users(id),
  chair_id uuid REFERENCES users(id),
  secretary_id uuid REFERENCES users(id),
  reviewer_id uuid REFERENCES users(id),
  calendar_event_id uuid REFERENCES calendar_events(id) ON DELETE SET NULL,
  schedule_approval_status varchar(32) NOT NULL DEFAULT 'Approved',
  schedule_approver_id uuid REFERENCES users(id) ON DELETE SET NULL,
  schedule_approval_decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  schedule_approval_decided_at timestamptz,
  schedule_approval_comments text,
  schedule_approval_submitted_at timestamptz,
  resource_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meetings_time_check CHECK (end_at IS NULL OR end_at >= start_at)
);
CREATE INDEX IF NOT EXISTS idx_meetings_start_at ON meetings(start_at);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by);

CREATE TABLE IF NOT EXISTS meeting_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  guest_name varchar(240),
  guest_email varchar(320),
  participant_role varchar(80) NOT NULL DEFAULT 'Member',
  response_status varchar(40) NOT NULL DEFAULT 'Invited',
  attendance_status varchar(40) NOT NULL DEFAULT 'Not marked',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(meeting_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting ON meeting_participants(meeting_id);

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

CREATE TABLE IF NOT EXISTS meeting_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  original_filename varchar(500) NOT NULL,
  stored_path text NOT NULL,
  mime_type varchar(160) NOT NULL,
  size_bytes bigint NOT NULL CHECK(size_bytes>0),
  uploaded_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meeting_attachments_meeting ON meeting_attachments(meeting_id,created_at);

CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  item_no integer NOT NULL,
  title varchar(300) NOT NULL,
  background text NOT NULL DEFAULT '',
  owner_id uuid REFERENCES users(id),
  duration_minutes integer,
  status varchar(40) NOT NULL DEFAULT 'Planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(meeting_id,item_no)
);

CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  status varchar(40) NOT NULL DEFAULT 'Queued',
  original_filename varchar(500) NOT NULL,
  stored_path text NOT NULL,
  language varchar(40),
  model_name varchar(120),
  error_message text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_meeting ON meeting_transcripts(meeting_id,created_at DESC);

CREATE TABLE IF NOT EXISTS meeting_transcript_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id uuid NOT NULL REFERENCES meeting_transcripts(id) ON DELETE CASCADE,
  segment_no integer NOT NULL,
  start_seconds numeric(12,3) NOT NULL DEFAULT 0,
  end_seconds numeric(12,3) NOT NULL DEFAULT 0,
  speaker_label varchar(120),
  text text NOT NULL,
  corrected_text text,
  corrected_by uuid REFERENCES users(id),
  corrected_at timestamptz,
  UNIQUE(transcript_id,segment_no)
);

CREATE TABLE IF NOT EXISTS meeting_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  version_no integer NOT NULL DEFAULT 1,
  status varchar(40) NOT NULL DEFAULT 'Draft',
  content text NOT NULL DEFAULT '',
  reviewer_id uuid REFERENCES users(id),
  review_comments text,
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(meeting_id,version_no)
);

CREATE TABLE IF NOT EXISTS meeting_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agenda_item_id uuid REFERENCES meeting_agenda_items(id) ON DELETE SET NULL,
  decision_no integer NOT NULL,
  text text NOT NULL,
  recorded_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(meeting_id,decision_no)
);

CREATE TABLE IF NOT EXISTS meeting_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  title varchar(300) NOT NULL,
  description text NOT NULL DEFAULT '',
  owner_id uuid REFERENCES users(id),
  due_date date,
  status varchar(40) NOT NULL DEFAULT 'Open',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meeting_actions_owner ON meeting_actions(owner_id,status,due_date);
