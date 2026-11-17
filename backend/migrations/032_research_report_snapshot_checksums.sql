ALTER TABLE research_report_versions ADD COLUMN IF NOT EXISTS snapshot_sha256 VARCHAR(64);
UPDATE research_report_versions
SET snapshot_sha256=encode(digest(convert_to(report_snapshot::text,'UTF8'),'sha256'),'hex')
WHERE snapshot_sha256 IS NULL;
ALTER TABLE research_report_versions ALTER COLUMN snapshot_sha256 SET NOT NULL;
