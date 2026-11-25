import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createPasswordLinkService } from '../src/password-link-service.js'

const createHarness = ({ sendMail = async () => ({ accepted: ['staff@example.test'] }) } = {}) => {
  const queries = []
  const transactions = async callback => callback({
    async query(sql, params = []) {
      queries.push({ sql, params })
      return { rowCount: 1, rows: [] }
    },
  })
  const service = createPasswordLinkService({
    transaction: transactions,
    sendMail,
    frontendOrigin: 'https://app.example.test',
    randomBytes: size => Buffer.alloc(size, 7),
  })
  return { service, queries }
}

test('password setup email stores only a hash and sends a single-use 30-minute fragment link', async () => {
  let sent
  const { service, queries } = createHarness({
    sendMail: async message => {
      sent = message
      return { accepted: ['STAFF@example.test'] }
    },
  })

  const result = await service.sendPasswordLink({
    id: 'user-1',
    name: 'PSC Staff',
    email: 'staff@example.test',
  }, { purpose: 'setup' })

  const rawToken = Buffer.alloc(32, 7).toString('hex')
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex')
  assert.deepEqual(result, { accepted: true, expiresInMinutes: 30 })
  assert.match(sent.subject, /Set up your PSC REDESY account/)
  assert.match(sent.text, /#resetToken=/)
  assert.match(sent.text, new RegExp(rawToken))
  assert.match(sent.html, new RegExp(rawToken))
  assert.match(sent.html, /Set up password/)
  assert.match(sent.html, /PSC Staff/)
  assert.equal(queries.length, 2)
  assert.match(queries[0].sql, /used_at=NOW\(\).*user_id=\$1/)
  assert.match(queries[1].sql, /expires_at.*30 minutes/)
  assert.equal(queries[1].params[1], hash)
  assert.notEqual(queries[1].params[1], rawToken)
})

test('reset email escapes user-controlled HTML and identifies a password reset', async () => {
  let sent
  const { service } = createHarness({
    sendMail: async message => {
      sent = message
      return { accepted: ['staff@example.test'] }
    },
  })
  await service.sendPasswordLink({
    id: 'user-2',
    name: '<img src=x onerror=alert(1)>',
    email: 'staff@example.test',
  })
  assert.match(sent.subject, /Reset your PSC REDESY password/)
  assert.match(sent.html, /&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.doesNotMatch(sent.html, /<img src=x/)
})

test('delivery failure invalidates the newly issued token and never returns it', async () => {
  const { service, queries } = createHarness({
    sendMail: async () => { throw Object.assign(new Error('provider secret details'), { statusCode: 502 }) },
  })
  await assert.rejects(
    service.sendPasswordLink({ id: 'user-3', email: 'staff@example.test' }),
    error => {
      assert.equal(error.message, 'Password link email could not be delivered.')
      assert.equal(error.code, 'PASSWORD_LINK_DELIVERY_FAILED')
      assert.equal(error.statusCode, 502)
      assert.doesNotMatch(error.message, /provider secret details/)
      return true
    },
  )
  assert.equal(queries.length, 3)
  assert.match(queries[2].sql, /WHERE token_hash=\$1 AND used_at IS NULL/)
})

test('recipient rejection is treated as failed delivery', async () => {
  const { service, queries } = createHarness({
    sendMail: async () => ({ accepted: [], rejected: ['staff@example.test'] }),
  })
  await assert.rejects(service.sendPasswordLink({ id: 'user-4', email: 'staff@example.test' }), /could not be delivered/)
  assert.equal(queries.length, 3)
})

test('service validates its dependencies and account identity', () => {
  assert.throws(() => createPasswordLinkService({}), /requires transaction and sendMail/)
  const { service } = createHarness()
  assert.rejects(service.sendPasswordLink({ id: 'user-5' }), /user id and registered email/)
})
