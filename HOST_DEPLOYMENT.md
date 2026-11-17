# REDESY host deployment runbook

This is the production host path. It is separate from the Wi-Fi training stack
and its `.env.training` settings. No production deployment has been performed.

## Windows host layout

The REDESY images are Linux containers (`node:alpine`, Nginx Alpine, and
PostgreSQL). For a Windows Server host, run them inside an Ubuntu Server LTS
virtual machine with Docker Engine and the Compose plugin. Use Hyper-V or the
organization's approved hypervisor, and give the VM a stable LAN address via
an external virtual switch or an approved network configuration. Run the
Compose commands below inside the Linux VM over SSH or its console.

Do not configure Windows containers for this Compose stack. Microsoft notes
that Linux containers require a Linux VM on Windows, and Docker Desktop is not
supported on Windows Server ([Microsoft Linux container guidance](https://learn.microsoft.com/en-us/virtualization/windowscontainers/deploy-containers/linux-containers),
[Docker Desktop support FAQ](https://docs.docker.com/desktop/troubleshoot-and-support/faqs/windowsfaqs/)).
If the machine is Windows 10/11 Pro or Enterprise instead of Windows Server,
Docker Desktop with WSL 2 can run Linux containers, but for an always-on
production host the Linux VM layout keeps the app's runtime on a standard
Linux server environment.

The simplest network path is to terminate HTTPS in a reverse proxy inside the
Linux VM and keep `APP_BIND_ADDRESS=127.0.0.1`. Point DNS at the VM address.
If the organization requires a Windows/IIS proxy or separate load balancer,
have it forward to the VM and adjust the app bind address and firewall so port
8080 accepts traffic only from that trusted proxy. Never publish PostgreSQL
port 5432 to the LAN.

## Readiness status

The production Compose configuration, a checksum-pinned PostgreSQL 17
initializer, and a one-time interactive administrator bootstrap are prepared.
The full backend suite passed 1,362/1,362 on 2026-11-04, and the existing
curated PostgreSQL 17 migration report passed in the development environment.
On 2026-11-04, both new database commands passed an isolated PostgreSQL 17.11
integration run, including API health and the required first-login password
change. Production Compose images also build successfully. The target host,
TLS proxy, backups, and restore process still need staging acceptance before
users are given access.

## Runtime dependency audit

After compatible security updates, `npm audit --omit=dev` reports 9 moderate
and 0 high/critical advisories. They are in the ExcelJS 4.4.0 archive/UUID
dependency chain used for XLSX report exports. The forced npm fix suggests a
breaking downgrade to ExcelJS 3.4.0 and still reports the same advisories, so
that downgrade was not applied. Have the deployment security owner review this
remaining export dependency risk before enabling the production service.

`npm run db:setup` is not a production initializer. It inserts demo identities,
hard-codes a shared initial password, and seeds sample content. The dedicated
`db:migrate:production` command applies the pinned consolidated schema and the
curated migration sequence without creating users or demo content. It supports
an empty PostgreSQL 17 database only and refuses a nonempty database that has
no REDESY migration ledger. `db:bootstrap:admin` creates one named System Admin
only when the ledger matches the full pinned migration set and the users table
is empty. It prompts for the account password without echoing it and marks the
account for a password change at first login. The current startup health check
confirms API/database connectivity; it does not confirm that the schema is
complete.

## Host prerequisites

- A supported Linux host with Docker Engine and the Docker Compose plugin.
- A DNS name whose TLS certificate and reverse proxy are managed on this host.
- Persistent storage with enough capacity for PostgreSQL, uploads, and backups.
- A deployment operator authorized to enter the first administrator account
  and password in the interactive bootstrap terminal.
- A maintenance window and a tested restore point before schema changes.

## Configure without exposing secrets

1. Copy `.env.production.template` to `.env.production` on the host. Keep this
   file outside source control and restrict it to the deployment operator.
2. Replace the database password and JWT secret with independent random values.
   Use URI-safe hexadecimal strings for `POSTGRES_PASSWORD`, because Compose
   embeds it in `DATABASE_URL`. For example, on Linux generate each value with
   `openssl rand -hex 32` and store it directly in the private env file. Never
   put real values in shell history, tickets, or chat.
3. Set `FRONTEND_ORIGIN` to the exact public HTTPS origin (scheme and hostname,
   with no path). Leave `APP_BIND_ADDRESS=127.0.0.1` when the TLS reverse proxy
   is on this host. The web service is the only published container port;
   PostgreSQL and the API stay on the private Compose network.
4. Keep optional workers and SMTP disabled until their production behavior and
   provider settings are reviewed.

## Build and start the empty stack

From the release directory on the host:

```sh
docker compose --env-file .env.production -f docker-compose.production.yml config --quiet
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up -d db
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml run --rm api npm run db:migrate:production
docker compose --env-file .env.production -f docker-compose.production.yml run --rm -it api npm run db:bootstrap:admin
```

The migration command accepts only PostgreSQL 17 and a truly empty database on
first run. It validates source checksums, applies the schema and migrations
under transactions, and records the applied checksums. If this command refuses
the database, stop and investigate; do not delete the volume or remove the
guard. This command sequence passed on a disposable PostgreSQL 17.11 database.
Do not open the proxy to users until the administrator bootstrap process and
staging acceptance are complete. API health alone does not prove schema
readiness. Once those gates are satisfied, start and check services:

```sh
docker compose --env-file .env.production -f docker-compose.production.yml up -d api web
docker compose --env-file .env.production -f docker-compose.production.yml ps
curl --fail http://127.0.0.1:8080/api/health
```

Configure the host reverse proxy to serve HTTPS and proxy to `127.0.0.1:8080`.
Preserve the original host and forwarded protocol headers. Verify the public
HTTPS page, `/api/health`, login, uploads, and role boundaries before opening
access. Apply firewall rules for HTTPS at the proxy; do not publish database
port 5432. The app does not configure host TLS.

## Release and rollback

- Record the release commit/image identifiers and retain the previous release.
- Before each schema change, take a database and uploads backup as described in
  [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md), then verify that the backup files
  are non-empty and stored off-host.
- Apply only reviewed, versioned migrations to a restored staging copy first.
  Capture schema version and migration checksums. Do not run the demo seeder.
- Roll back application images only when compatible with the migrated schema.
  Database rollback requires a tested restore; do not assume image rollback
  reverses a migration.

## Current gates before production

1. The disposable PostgreSQL 17.11 run passed fresh initialization, rerun,
   migration ledger checks, and refusal of a nonempty database without a
   ledger. The initializer does not adopt or upgrade an existing database.
2. The one-time administrator flow passed, including duplicate-bootstrap
   refusal, audit entry, and mandatory first-login password change.
3. Complete a full staging acceptance pass, including the target proxy/TLS,
   auth, file upload/download, email behavior if enabled, backup/restore, and
   rollback.
4. Have the deployment security owner review or mitigate the remaining
   moderate ExcelJS dependency advisories before enabling production XLSX
   exports.
5. Supply DNS/TLS/reverse-proxy details, host OS/version, backup destination,
   retention policy, and operational owner.
