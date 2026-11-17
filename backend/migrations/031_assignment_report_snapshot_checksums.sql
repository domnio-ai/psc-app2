ALTER TABLE generated_document_versions ADD COLUMN IF NOT EXISTS snapshot_sha256 VARCHAR(64);
UPDATE generated_document_versions
SET snapshot_sha256=encode(digest(convert_to(sections::text,'UTF8'),'sha256'),'hex')
WHERE snapshot_sha256 IS NULL;
ALTER TABLE generated_document_versions ALTER COLUMN snapshot_sha256 SET NOT NULL;
UPDATE generated_document_versions v SET status=d.status
FROM generated_documents d
WHERE v.document_id=d.id AND v.version_number=d.version
  AND d.status IN('Submitted','Under Review','Approved','Final')
  AND v.status IS DISTINCT FROM d.status;
CREATE INDEX IF NOT EXISTS generated_document_versions_status_idx
  ON generated_document_versions(document_id,status,version_number DESC);
