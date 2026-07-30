# PSC App2

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

Copy `.env.production.example` to `.env.production`, set strong secrets, and run:

```powershell
docker compose --env-file .env.production up --build -d
```

The web application is exposed on port `8080` by default. PostgreSQL is not
published to the host.

See [ADMIN_GUIDE.md](ADMIN_GUIDE.md) and [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md).
