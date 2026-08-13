BEGIN;

CREATE TABLE IF NOT EXISTS document_categories(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  parent_id UUID REFERENCES document_categories(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO document_categories(name) VALUES
 ('Policies & Guidelines'),('Acts & Regulations'),('Circulars'),('Research Reports'),
 ('Assignment Reports'),('Manuals & SOPs'),('Strategic Documents'),
 ('Meeting & Workshop Reports'),('Templates'),('Reference Materials')
ON CONFLICT(name) DO NOTHING;

CREATE TABLE IF NOT EXISTS document_tags(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(60) NOT NULL,
  normalized_name VARCHAR(60) NOT NULL UNIQUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS document_tag_links(
  knowledge_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES document_tags(id) ON DELETE CASCADE,
  PRIMARY KEY(knowledge_id,tag_id)
);

ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES document_categories(id);
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS directorate VARCHAR(160);
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS document_type VARCHAR(100) NOT NULL DEFAULT 'Document';
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS subject VARCHAR(300) NOT NULL DEFAULT '';
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS classification VARCHAR(20) NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS felix_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_classification_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_classification_check CHECK(classification IN('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED'));

ALTER TABLE knowledge_versions ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE knowledge_versions ADD COLUMN IF NOT EXISTS sha256_hash CHAR(64);
ALTER TABLE knowledge_versions ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE knowledge_versions ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE knowledge_versions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
UPDATE knowledge_versions v SET storage_path=v.stored_name, is_current=(v.version_number=k.current_version)
FROM knowledge_items k WHERE k.id=v.knowledge_id;
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_versions_hash_idx ON knowledge_versions(sha256_hash) WHERE sha256_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_versions_one_current_idx ON knowledge_versions(knowledge_id) WHERE is_current;

CREATE TABLE IF NOT EXISTS document_permissions(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(40),
  permission VARCHAR(20) NOT NULL CHECK(permission IN('READ','WRITE','REVIEW')),
  granted_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK((user_id IS NOT NULL) <> (role IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS document_permissions_user_idx ON document_permissions(knowledge_id,user_id,permission) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS document_permissions_role_idx ON document_permissions(knowledge_id,role,permission) WHERE role IS NOT NULL;

CREATE TABLE IF NOT EXISTS document_text_content(
  version_id UUID PRIMARY KEY REFERENCES knowledge_versions(id) ON DELETE CASCADE,
  knowledge_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  extracted_text TEXT NOT NULL DEFAULT '',
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english',extracted_text)) STORED,
  extraction_status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK(extraction_status IN('Pending','Completed','Unsupported','Failed')),
  extraction_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS document_text_search_idx ON document_text_content USING GIN(search_vector);

COMMIT;
