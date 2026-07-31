# PSC App2 Backend API

PostgreSQL API for member authentication, roles, assignments, collaborators, comments, alerts, analytics and audit history.

## Local setup

1. Copy `.env.example` to `.env` and replace the database password and JWT secret.
2. Create a PostgreSQL database and restricted login named `psc_app2`.
3. Run `npm install`.
4. Run `npm run db:setup`.
5. Run `npm run dev`.

The API runs at `http://localhost:8000`. Check `/api/health` to verify the database connection. The seeded local password is `PSC@2026`; it must be changed before deployment.

## Email delivery

1. Install the mail transport with `npm install nodemailer`.
2. Add the approved SMTP host, port, account, password and sender values from `.env.example` to `.env`.
3. Keep `SMTP_ENABLED=false` until the credentials have been approved and tested.
4. Restart the backend, enable SMTP, then use **Settings → Email Notifications → Send test email to me**.

SMTP credentials belong only in `backend/.env`; never commit them to Git. Microsoft 365 tenants may require an application-specific SMTP account or OAuth policy approval from ICT.

## Permissions

- Administrator: roles, all assignments, alerts, analytics and audit logs.
- Research Manager: members, assignment allocation, alerts and analytics.
- Research Officer: assigned work, updates and collaboration.
- Reviewer: assigned reviews, comments and review status.
