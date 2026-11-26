BEGIN;
CREATE TABLE IF NOT EXISTS leave_request_attachments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 leave_request_id UUID NOT NULL UNIQUE REFERENCES leave_requests(id) ON DELETE CASCADE,
 original_filename VARCHAR(255) NOT NULL,
 stored_path TEXT NOT NULL,
 mime_type VARCHAR(160) NOT NULL,
 size_bytes BIGINT NOT NULL CHECK(size_bytes>0),
 sha256 CHAR(64) NOT NULL,
 uploaded_by UUID NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS leave_request_attachments_uploaded_by_idx ON leave_request_attachments(uploaded_by,created_at DESC);
COMMIT;
