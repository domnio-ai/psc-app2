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