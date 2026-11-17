import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "..");
const projectRoot = path.resolve(backendRoot, "..");

test("API container startup does not run database bootstrap", async () => {
  const dockerfile = await fs.readFile(path.join(backendRoot, "Dockerfile"), "utf8");
  assert.match(dockerfile, /COPY migrations \.\/migrations/);
  assert.match(dockerfile, /CMD \["node", "src\/server\.js"\]/);
  assert.doesNotMatch(dockerfile, /setup-database\.js/);
});

test("Felix indexing and scheduled report workers can be disabled", async () => {
  const server = await fs.readFile(path.join(backendRoot, "src", "server.js"), "utf8");
  assert.match(server, /FELIX_INDEX_WORKER_ENABLED==='false'\?\(\)=>\{\}:startFelixIndexWorker\(\)/);
  assert.match(server, /REPORT_SCHEDULER_ENABLED==='false'\?\(\)=>\{\}:startReportScheduler\(\)/);
});

test("LAN training Compose publishes only web and has no host AI or SMTP secrets", async () => {
  const compose = await fs.readFile(path.join(projectRoot, "docker-compose.yml"), "utf8");
  assert.match(compose, /APP_BIND_ADDRESS/);
  assert.match(compose, /APP_PORT/);
  assert.match(compose, /FELIX_INDEX_WORKER_ENABLED: "false"/);
  assert.match(compose, /REPORT_SCHEDULER_ENABLED: "false"/);
  assert.match(compose, /SMTP_ENABLED: "false"/);
  assert.doesNotMatch(compose, /host\.docker\.internal|AI_RESEARCH_URL|SMTP_PASSWORD|SMTP_HOST/);
  assert.equal((compose.match(/^\s+ports:\s*$/gm) || []).length, 1);
  assert.match(compose, /uploads_data:\/app\/uploads/);
  assert.match(compose, /DOCUMENT_STORAGE_PATH/);
  assert.match(compose, /psc_app2_training_postgres_data/);
  assert.match(compose, /psc_app2_training_uploads_data/);
});

test("backend Docker build context excludes environment secrets and uploads", async () => {
  const dockerignore = await fs.readFile(path.join(backendRoot, ".dockerignore"), "utf8");
  assert.match(dockerignore, /^\.env\*$/m);
  assert.match(dockerignore, /^uploads$/m);
  assert.match(dockerignore, /^node_modules$/m);
});