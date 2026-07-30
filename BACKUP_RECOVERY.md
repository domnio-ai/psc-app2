# Backup and Recovery

## Backup contents

A complete recovery set contains:

1. PostgreSQL custom-format dump (`database.dump`)
2. Uploaded files (`uploads/`)
3. Source archive (`psc-app2-source.zip`)
4. `manifest.txt` containing date, commit and checksums

Never include `backend/.env` or production secrets in a source archive.

## PostgreSQL backup

```powershell
pg_dump --format=custom --file database.dump $env:DATABASE_URL
```

## PostgreSQL restore

Restore into a newly created empty database:

```powershell
pg_restore --clean --if-exists --no-owner --dbname $env:DATABASE_URL database.dump
```

Then run:

```powershell
npm --prefix backend run db:setup
```

## Upload recovery

Stop the API, restore the `uploads` directory to the configured `UPLOAD_DIR`,
verify filesystem permissions, then restart the API.

## Verification

1. Confirm `/api/health`.
2. Sign in using a controlled Administrator account.
3. Open an assignment attachment and document version.
4. Verify review history and audit logs.
5. Record the recovery test date and operator.
