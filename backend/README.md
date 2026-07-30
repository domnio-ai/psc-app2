# PSC App2 Backend API

PostgreSQL API for member authentication, roles, assignments, collaborators, comments, alerts, analytics and audit history.

## Local setup

1. Copy `.env.example` to `.env` and replace the database password and JWT secret.
2. Create a PostgreSQL database and restricted login named `psc_app2`.
3. Run `npm install`.
4. Run `npm run db:setup`.
5. Run `npm run dev`.

The API runs at `http://localhost:8000`. Check `/api/health` to verify the database connection. The seeded local password is `PSC@2026`; it must be changed before deployment.

## Permissions

- Administrator: roles, all assignments, alerts, analytics and audit logs.
- Research Manager: members, assignment allocation, alerts and analytics.
- Research Officer: assigned work, updates and collaboration.
- Reviewer: assigned reviews, comments and review status.
