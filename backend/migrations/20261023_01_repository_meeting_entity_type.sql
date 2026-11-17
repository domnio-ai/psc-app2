-- App2 Repository relationship contract: add meeting as a first-class linked entity.
-- Additive migration; preserves assignment/task/research/report and all existing rows.
BEGIN;
ALTER TABLE public.repository_entity_links
  DROP CONSTRAINT IF EXISTS repository_entity_links_entity_type_check;
ALTER TABLE public.repository_entity_links
  ADD CONSTRAINT repository_entity_links_entity_type_check
  CHECK (entity_type IN ('assignment','task','research','report','meeting'));
COMMIT;
