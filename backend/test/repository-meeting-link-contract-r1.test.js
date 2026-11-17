// APP2_REPOSITORY_MEETING_LINK_CONTRACT_R1
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const schema = fs.readFileSync(path.join(root, 'backend/src/schema.sql'), 'utf8');
const app = fs.readFileSync(path.join(root, 'backend/src/app.js'), 'utf8');
const meetings = fs.readFileSync(path.join(root, 'backend/src/meetings/meetings-routes.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'backend/migrations/20261023_01_repository_meeting_entity_type.sql'), 'utf8');
test('database schema supports meeting Repository links', () => assert.match(schema, /entity_type\s+VARCHAR\(20\)[\s\S]{0,160}'report'[\s\S]{0,40}'meeting'/i));
test('Repository link validator supports meeting', () => assert.match(app, /entityType\s*:\s*z\.enum\(\s*\[\s*'assignment'\s*,\s*'task'\s*,\s*'research'\s*,\s*'report'\s*,\s*'meeting'\s*\]\s*\)/));
test('minutes synchronization uses meeting entity type', () => assert.match(meetings, /entityType\s*:\s*'meeting'/));
test('migration keeps legacy types and adds meeting', () => { for (const type of ['assignment','task','research','report','meeting']) assert.ok(migration.includes("'" + type + "'")); });
