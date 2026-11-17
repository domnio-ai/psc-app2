# REDESY deployment

This project has two separate Docker Compose deployments:

- `docker-compose.yml` with `.env.training` is for a controlled training/LAN host.
- `docker-compose.production.yml` with `.env.production` is for the final hosted service.

Each deployment uses different PostgreSQL and upload volumes. Never point the production service at training data or share its database credentials.

## Training host

On the Windows training host, confirm the LAN address in `.env.training` is current and reachable from trainee devices. Start the existing configuration:

```powershell
docker compose --env-file .env.training -f docker-compose.yml up --build -d
docker compose --env-file .env.training -f docker-compose.yml ps
```

Open `http://<training-host-LAN-IP>:<APP_PORT>` from a device on the same protected network. Restrict the host firewall to the training network. This mode uses HTTP, so do not expose it directly to the public internet or use real sensitive production records. SMTP and background workers are disabled by default.

## Final hosted deployment

Use a supported Linux server or managed container host with Docker Engine and the Docker Compose plugin. Configure a DNS name and HTTPS reverse proxy/load balancer (for example, Caddy, nginx, or the hosting provider's managed ingress). Terminate TLS there and proxy to `127.0.0.1:8080`; do not publish PostgreSQL or the API port publicly.

On the host:

1. Deploy a reviewed, version-controlled release of this repository. Do not use a working directory containing unreviewed changes.
2. Copy `.env.production.template` to `.env.production`; set unique, randomly generated database and JWT secrets, the public HTTPS origin, and the chosen host port. Keep the file readable only by the deployment account.
3. Set `FRONTEND_ORIGIN` to the exact public HTTPS origin, without a path. Enable SMTP or background workers only after their provider settings, operational ownership, and data handling are confirmed.
4. Validate the resolved Compose configuration without printing or sharing secrets:

   ```sh
   docker compose --env-file .env.production -f docker-compose.production.yml config -q
   ```

5. Build and start the services:

   ```sh
   docker compose --env-file .env.production -f docker-compose.production.yml up --build -d
   docker compose --env-file .env.production -f docker-compose.production.yml ps
   ```

6. Confirm `https://<public-host>/api/health` reports a healthy API with a connected database, then verify login, document upload/download, and the workflows needed for release.

The API container starts the application but intentionally does not bootstrap or seed the database. Before launch, initialize a new production database from a reviewed schema and migration bundle for the exact release, and create the initial administrator through an approved provisioning procedure. The repository currently has a demo-oriented `db:setup` script that seeds sample accounts; do not run it against a live database. Back up and rehearse restoration of PostgreSQL and uploads before importing real data.

## Operations and rollback

- Back up the database and `/app/uploads` together using a consistent maintenance procedure. Test restores in an isolated environment.
- Keep deployment secrets, database backups, and uploaded documents out of the repository and image build context.
- Review logs with `docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=200 api web`.
- Roll back by redeploying the previous reviewed application release. Restore a database backup only under the approved recovery procedure; an older application release may not understand newer schema changes.
- The included containers do not provide TLS certificates, managed database service, automated off-site backups, monitoring, or high availability. Supply these through the hosting platform and its operational procedures.
