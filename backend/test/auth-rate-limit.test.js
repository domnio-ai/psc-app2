import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createAuthRateLimiter } from '../src/auth-rate-limit.js'

const response = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  setHeader(name, value) { this.headers[name] = value },
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this },
})

test('password recovery limiter throttles repeated requests by email identity', () => {
  let current = 100_000
  const limit = createAuthRateLimiter({
    windowMs: 60_000,
    maxIpAttempts: 10,
    maxIdentityAttempts: 2,
    now: () => current,
  })
  const run = email => {
    const res = response()
    let nextCalled = false
    limit({ ip: '10.0.0.10', body: { email } }, res, () => { nextCalled = true })
    return { res, nextCalled }
  }

  assert.equal(run('staff@example.test').nextCalled, true)
  assert.equal(run(' STAFF@example.test ').nextCalled, true)
  const blocked = run('staff@example.test')
  assert.equal(blocked.res.statusCode, 429)
  assert.equal(blocked.res.headers['Retry-After'], '60')
  assert.equal(blocked.nextCalled, false)
  assert.equal(run('other@example.test').nextCalled, true)
  current += 60_001
  assert.equal(run('staff@example.test').nextCalled, true)
})

test('password reset token rate limit hashes identity keys and enforces an IP ceiling', () => {
  const limit = createAuthRateLimiter({
    windowMs: 1_000,
    maxIpAttempts: 1,
    maxIdentityAttempts: 5,
    now: () => 10_000,
  })
  const buckets = new Map()
  const fakeReq = { ip: '127.0.0.1', body: { token: 'a'.repeat(64) } }
  const res = response()
  limit(fakeReq, res, () => {})
  const identityBucket = [...buckets.keys()].find(key => key.startsWith('identity:'))
  assert.equal(identityBucket, undefined)
})

test('forgot-password and reset-password routes apply a password recovery limiter', async () => {
  const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8')
  assert.match(app, /app\.post\('\/api\/auth\/forgot-password',passwordResetRateLimit,validate\(/)
  assert.match(app, /app\.post\('\/api\/auth\/reset-password',passwordResetRateLimit,validate\(/)
  assert.match(app, /createAuthRateLimiter\(\{windowMs:15\*60\*1000,maxIpAttempts:60,maxIdentityAttempts:5\}\)/)
})
