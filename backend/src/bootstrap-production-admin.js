import bcrypt from 'bcryptjs'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { db } from './db.js'
import { normalizeAdminIdentity, validateAdminPassword } from './admin-bootstrap-policy.js'
import { baseline, loadProductionMigrationPlan } from './production-migration-plan.js'

const lockA = 987654321
const lockB = 18

function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      reject(new Error('Run this command with an interactive terminal (-it); passwords are never accepted as arguments or environment variables.'))
      return
    }

    let value = ''
    let done = false
    const finish = (error, result) => {
      if (done) return
      done = true
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      stdout.write('\n')
      if (error) reject(error)
      else resolve(result)
    }
    const onData = chunk => {
      for (const character of chunk) {
        if (character === '\u0003') return finish(new Error('Bootstrap cancelled.'))
        if (character === '\r' || character === '\n') return finish(null, value)
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1)
        else if (character >= ' ') value += character
      }
    }

    stdout.write(prompt)
    stdin.setEncoding('utf8')
    stdin.setRawMode(true)
    stdin.on('data', onData)
    stdin.resume()
  })
}

async function askIdentity() {
  const terminal = createInterface({ input: stdin, output: stdout })
  try {
    return normalizeAdminIdentity(
      await terminal.question('Administrator full name: '),
      await terminal.question('Administrator email: '),
    )
  } finally {
    terminal.close()
  }
}

async function verifyMigrationLedger(client, expectedEntries) {
  const ledger = await client.query("SELECT to_regclass('public.redesy_schema_migrations') AS name")
  if (!ledger.rows[0]?.name) throw new Error('REDESY migrations have not been applied.')
  const result = await client.query('SELECT migration_id, sha256 FROM public.redesy_schema_migrations ORDER BY migration_id')
  const applied = new Map(result.rows.map(row => [row.migration_id, row.sha256.trim().toUpperCase()]))
  if (applied.size !== expectedEntries.length) throw new Error('Migration ledger does not match the pinned production plan.')
  for (const entry of expectedEntries) {
    if (applied.get(entry.id) !== entry.sha256) throw new Error('Migration ledger does not match the pinned production plan.')
  }
}

async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') throw new Error('Set NODE_ENV=production to bootstrap the production administrator.')
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Run with an interactive terminal (-it); no password argument or environment variable is accepted.')
  }

  const { migrations } = await loadProductionMigrationPlan()
  const expectedEntries = [
    { id: baseline.id, sha256: baseline.sha256 },
    ...migrations.map(({ id, sha256 }) => ({ id, sha256 })),
  ]

  const client = await db.connect()
  let locked = false
  try {
    const version = await client.query('SHOW server_version_num')
    const serverVersion = Number(version.rows[0]?.server_version_num)
    if (!Number.isInteger(serverVersion) || serverVersion < 170000 || serverVersion >= 180000) {
      throw new Error('Administrator bootstrap is validated only for PostgreSQL 17.')
    }
    await client.query('SELECT pg_advisory_lock($1, $2)', [lockA, lockB])
    locked = true
    await verifyMigrationLedger(client, expectedEntries)

    const users = await client.query('SELECT count(*)::int AS count FROM users')
    if (users.rows[0].count !== 0) throw new Error('Users already exist; the one-time administrator bootstrap is disabled.')

    const identity = await askIdentity()
    const password = validateAdminPassword(await askHidden('Administrator password (input hidden): '))
    const confirmation = await askHidden('Confirm administrator password (input hidden): ')
    if (password !== confirmation) throw new Error('The passwords did not match; no account was created.')
    const passwordHash = await bcrypt.hash(password, 12)

    await client.query('BEGIN')
    try {
      const created = await client.query(
        `INSERT INTO users(name,email,password_hash,role,division,must_change_password)
         VALUES($1,$2,$3,'System Admin','ICT',TRUE)
         RETURNING id`,
        [identity.name, identity.email, passwordHash],
      )
      await client.query(
        `INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)
         VALUES($1,'INITIAL_ADMIN_BOOTSTRAPPED','user',$2,$3::jsonb)`,
        [created.rows[0].id, created.rows[0].id, JSON.stringify({ method: 'interactive-console', mustChangePassword: true })],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
    console.log('Initial System Admin created. The account must change its password at first login.')
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1, $2)', [lockA, lockB]).catch(() => {})
    client.release()
  }
}

try {
  await bootstrap()
} catch (error) {
  console.error(`Initial administrator bootstrap failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  await db.end()
}
