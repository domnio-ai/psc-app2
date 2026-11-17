# REDESY

PSC Research Department Assignment, Knowledge, Research and Document Management System.

## Stack

- React 19 + TypeScript + Vite
- Node.js + Express
- PostgreSQL
- JWT authentication and role-based access control

## Local setup

1. Copy `backend/.env.example` to `backend/.env` and replace all placeholder secrets.
2. Install dependencies:

   ```powershell
   npm install
   npm --prefix backend install
   ```

3. Create or migrate the database:

   ```powershell
   npm --prefix backend run db:setup
   ```

   For an existing App2 database that already has its core tables, apply the meeting attachment upgrade without reseeding users:

   ```powershell
   npm --prefix backend run db:migrate:meeting-documents
   ```

4. Start the API:

   ```powershell
   npm --prefix backend start
   ```

5. In another terminal, start the frontend:

   ```powershell
   npm run dev -- --configLoader runner --host 127.0.0.1
   ```

Open `http://127.0.0.1:5173`. The API health endpoint is
`http://127.0.0.1:8000/api/health`.

## Validation

```powershell
npm --prefix backend run check
.\node_modules\.bin\tsc.cmd -b --pretty false
.\node_modules\.bin\vite.cmd build --configLoader runner
```

## Production

Use the production Compose file and the maintained template. Follow the host
deployment, database initialization, migration, TLS, and backup steps in
[HOST_DEPLOYMENT.md](HOST_DEPLOYMENT.md). Do not use `db:setup` on production:
it creates demo users with a shared default password.

See [ADMIN_GUIDE.md](ADMIN_GUIDE.md) and [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md)
for ongoing operations and data recovery.
