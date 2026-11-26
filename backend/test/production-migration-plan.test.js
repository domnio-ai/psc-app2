import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { baseline, loadProductionMigrationPlan, migrationSources, unwrapTransaction } from '../src/production-migration-plan.js'

test('production migration manifest matches its pinned PostgreSQL 17 audit sources', async () => {
  const plan = await loadProductionMigrationPlan()
  const actualBaselineLf = createHash('sha256').update(plan.baselineSql, 'utf8').digest('hex').toUpperCase()
  const actualBaselineCrlf = createHash('sha256').update(plan.baselineSql.replace(/\n/g, '\r\n'), 'utf8').digest('hex').toUpperCase()

  assert.ok([actualBaselineLf, actualBaselineCrlf].includes(baseline.sha256), 'baseline pin must match an LF or CRLF representation')
  assert.equal(plan.migrations.length, migrationSources.length + 1)
  assert.deepEqual(
    plan.migrations.map(({ id }) => id),
    [...migrationSources.map(({ id }) => id), 'migration:meetings-v2-live-conference'],
  )
  assert.ok(plan.migrations.every(({ sql }) => sql.trim().length > 0))
})

test('production migration envelope is removed only when balanced at file boundaries', () => {
  assert.equal(unwrapTransaction('BEGIN;\nSELECT 1;\nCOMMIT;'), 'SELECT 1;')
  assert.throws(() => unwrapTransaction('SELECT 1;\nCOMMIT;'), /unsupported transaction wrapper/)
  assert.equal(unwrapTransaction('DO $$ BEGIN PERFORM 1; END $$;'), 'DO $$ BEGIN PERFORM 1; END $$;')
})


test('production migration runner explicitly loads and executes the verified baseline', async () => {
  const runner = await readFile(new URL('../src/migrate-production.js', import.meta.url), 'utf8')
  assert.match(runner, /const \\{ baselineSql, migrations \\} = await loadProductionMigrationPlan\\(\\)/)
  assert.match(runner, /await client\\.query\\(baselineSql\\)/)
  assert.match(runner, /baseline\\.sha256/)
})
