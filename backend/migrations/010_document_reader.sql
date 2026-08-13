BEGIN;
ALTER TABLE document_permissions DROP CONSTRAINT IF EXISTS document_permissions_permission_check;
ALTER TABLE document_permissions ADD CONSTRAINT document_permissions_permission_check CHECK(permission IN('READ','DOWNLOAD','WRITE','REVIEW'));
COMMIT;
