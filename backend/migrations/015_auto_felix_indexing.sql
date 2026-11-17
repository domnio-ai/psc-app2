-- Every approved App2 repository document becomes available to Felix automatically.
-- Draft, rejected, archived and permission-restricted records remain outside the
-- authorized retrieval flow enforced by the App2 and Felix APIs.
ALTER TABLE knowledge_items ALTER COLUMN felix_enabled SET DEFAULT TRUE;

CREATE OR REPLACE FUNCTION enable_felix_for_published_document() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status='Published' THEN
    NEW.felix_enabled=TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS knowledge_items_auto_enable_felix ON knowledge_items;
CREATE TRIGGER knowledge_items_auto_enable_felix
BEFORE INSERT OR UPDATE OF status ON knowledge_items
FOR EACH ROW EXECUTE FUNCTION enable_felix_for_published_document();

-- One-time backfill for documents approved before automatic indexing became policy.
UPDATE knowledge_items
SET felix_enabled=TRUE,updated_at=NOW()
WHERE status='Published' AND is_archived=FALSE AND felix_enabled=FALSE;
