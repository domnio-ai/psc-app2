import { db } from './db.js'
import { baseline, loadProductionMigrationPlan } from './production-migration-plan.js'

const lockA = 987654321
const lockB = 17
const migrationTable = 'public.redesy_schema_migrations'

async function getApplied(client, id) {
  const result = await client.query(
    `SELECT sha256 FROM ${migrationTable} WHERE migration_id = $1`,
    [id],
  )
  return result.rows[0]?.sha256?.trim().toUpperCase() ?? null
}

async function applyProductionMigrations() {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Set NODE_ENV=production to run the production migration command.')
  }

  const { baselineSql, migrations } = await loadProductionMigrationPlan()
  const baseHash = baseline.sha256

  const client = await db.connect()
  let locked = false
  try {
    const version = await client.query('SHOW server_version_num')
    const serverVersion = Number(version.rows[0]?.server_version_num)
    if (!Number.isInteger(serverVersion) || serverVersion < 170000 || serverVersion >= 180000) {
      throw new Error('Production migrations are validated only for PostgreSQL 17.')
    }

    await client.query('SELECT pg_advisory_lock($1, $2)', [lockA, lockB])
    locked = true

    const ledger = await client.query("SELECT to_regclass('public.redesy_schema_migrations') AS name")
    if (!ledger.rows[0]?.name) {
      const objects = await client.query(`
        SELECT count(*)::int AS count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S','f')
      `)
      if (objects.rows[0].count !== 0) {
        throw new Error('Database is not empty and has no REDESY migration ledger; refusing to modify it.')
      }

      await client.query('BEGIN')
      try {
        await client.query(baselineSql)
        await client.query(`
          CREATE TABLE ${migrationTable} (
            migration_id text PRIMARY KEY,
            sha256 char(64) NOT NULL,
            applied_at timestamptz NOT NULL DEFAULT now()
          )
        `)
        await client.query(
          `INSERT INTO ${migrationTable}(migration_id, sha256) VALUES ($1, $2)`,
          [baseline.id, baseHash],
        )
        await client.query('COMMIT')
        console.log(`Applied ${baseline.id}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }

    const appliedBaseline = await getApplied(client, baseline.id)
    if (appliedBaseline !== baseHash) {
      throw new Error('Database baseline is missing or its checksum differs; refusing to continue.')
    }

    for (const migration of migrations) {
      const existingHash = await getApplied(client, migration.id)
      if (existingHash !== null) {
        if (existingHash !== migration.sha256) {
          throw new Error(`Applied checksum differs for ${migration.id}; refusing to continue.`)
        }
        continue
      }

      await client.query('BEGIN')
      try {
        await client.query(migration.sql)
        await client.query(
          `INSERT INTO ${migrationTable}(migration_id, sha256) VALUES ($1, $2)`,
          [migration.id, migration.sha256],
        )
        await client.query('COMMIT')
        console.log(`Applied ${migration.id}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
    console.log('Production schema migrations are current. No users or demo data were seeded.')
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1, $2)', [lockA, lockB]).catch(() => {})
    client.release()
  }
}

try {
  await applyProductionMigrations()
} catch (error) {
  console.error(`Production database migration failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  await db.end()
}
