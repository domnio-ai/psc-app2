BEGIN;

ALTER TABLE repository_entity_links
  ADD COLUMN IF NOT EXISTS relationship_type VARCHAR(24) NOT NULL DEFAULT 'Related to',
  ADD COLUMN IF NOT EXISTS pinned_version_id UUID REFERENCES knowledge_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

ALTER TABLE repository_entity_links
  DROP CONSTRAINT IF EXISTS repository_entity_links_relationship_type_check;
ALTER TABLE repository_entity_links
  ADD CONSTRAINT repository_entity_links_relationship_type_check
  CHECK(relationship_type IN(
    'Evidence for','Reference for','Source for','Supports',
    'Produced by','Supersedes','Related to','Annex to'
  ));

CREATE INDEX IF NOT EXISTS repository_entity_links_relationship_idx
  ON repository_entity_links(relationship_type,entity_type,entity_id);

COMMIT;
