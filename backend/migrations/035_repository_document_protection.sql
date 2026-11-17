BEGIN;

CREATE TABLE IF NOT EXISTS document_access_policies(
  knowledge_id UUID PRIMARY KEY REFERENCES knowledge_items(id) ON DELETE CASCADE,
  reader_scope VARCHAR(30) NOT NULL DEFAULT 'INHERITED'
    CHECK(reader_scope IN('INHERITED','TEAM','NAMED_USERS','REVIEWER_ONLY','MANAGEMENT_ONLY')),
  allow_download BOOLEAN NOT NULL DEFAULT TRUE,
  allow_copy BOOLEAN NOT NULL DEFAULT TRUE,
  allow_print BOOLEAN NOT NULL DEFAULT TRUE,
  allow_link BOOLEAN NOT NULL DEFAULT TRUE,
  watermark BOOLEAN NOT NULL DEFAULT FALSE,
  restriction_reason TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_access_grants(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  can_download BOOLEAN NOT NULL DEFAULT FALSE,
  can_copy BOOLEAN NOT NULL DEFAULT FALSE,
  can_print BOOLEAN NOT NULL DEFAULT FALSE,
  can_link BOOLEAN NOT NULL DEFAULT FALSE,
  granted_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(knowledge_id,user_id)
);

CREATE INDEX IF NOT EXISTS document_access_grants_knowledge_idx
  ON document_access_grants(knowledge_id,user_id);

COMMIT;
