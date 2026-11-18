import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createAuthRateLimiter } from '../src/auth-rate-limit.js'

const response = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  setHeader(name, value) { this.headers[name] = value; },
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
})

test('authentication limiter throttles one identity without prematurely blocking other users on the same IP', () => {
  let current = 100_000
  const limit = createAuthRateLimiter({
    windowMs: 60_000,
    maxIpAttempts: 4,
    maxIdentityAttempts: 2,
    now: () => current,
  })
  const run = email => {
    const res = response()
    let nextCalled = false
    limit({ ip: '10.0.0.10', body: { email } }, res, () => { nextCalled = true; })
    return { res, nextCalled }
  }

  assert.equal(run('staff@example.test').nextCalled, true)
  assert.equal(run('staff@example.test').nextCalled, true)
  const blockedIdentity = run('staff@example.test')
  assert.equal(blockedIdentity.res.statusCode, 429)
  assert.equal(blockedIdentity.res.headers['Retry-After'], '60')
  assert.equal(blockedIdentity.nextCalled, false)

  assert.equal(run('another@example.test').nextCalled, true)
  assert.equal(run('another@example.test').nextCalled, true)
  const blockedIp = run('third@example.test')
  assert.equal(blockedIp.res.statusCode, 429)
})

test('authentication limiter releases expired windows', () => {
  let current = 1_000
  const limit = createAuthRateLimiter({
    windowMs: 1_000,
    maxIpAttempts: 1,
    maxIdentityAttempts: 1,
    now: () => current,
  })
  const run = () => {
    const res = response()
    let nextCalled = false
    limit({ ip: '127.0.0.1', body: { email: 'a@example.test' } }, res, () => { nextCalled = true; })
    return { res, nextCalled }
  }

  assert.equal(run().nextCalled, true)
  assert.equal(run().res.statusCode, 429)
  current += 1_001
  assert.equal(run().nextCalled, true)
})

test('login and password-reset endpoints use authentication rate limits', async () => {
  const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8')
  assert.match(app, /app\.post\('\/api\/auth\/login',loginRateLimit,validate\(loginSchema\)/)
  assert.match(app, /app\.post\('\/api\/auth\/forgot-password',passwordResetRateLimit,validate\(/)
  assert.match(app, /app\.post\('\/api\/auth\/reset-password',passwordResetRateLimit,validate\(/)
  assert.match(app, /createAuthRateLimiter\(\{windowMs:15\*60\*1000,maxIpAttempts:100,maxIdentityAttempts:10\}\)/)
  assert.match(app, /createAuthRateLimiter\(\{windowMs:15\*60\*1000,maxIpAttempts:60,maxIdentityAttempts:5\}\)/)
})

test('Docker deployments trust only the explicitly configured Nginx proxy hop', async () => {
  const [app, config, trainingCompose, productionCompose] = await Promise.all([
    readFile(new URL('../src/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/config.js', import.meta.url), 'utf8'),
    readFile(new URL('../../docker-compose.yml', import.meta.url), 'utf8'),
    readFile(new URL('../../docker-compose.production.yml', import.meta.url), 'utf8'),
  ])
  assert.match(config, /TRUST_PROXY_HOPS\|\|0/)
  assert.match(config, /TRUST_PROXY_HOPS must be an integer/)
  assert.match(app, /if\(config\.trustProxyHops>0\)app\.set\('trust proxy',config\.trustProxyHops\)/)
  assert.match(trainingCompose, /TRUST_PROXY_HOPS: "1"/)
  assert.match(productionCompose, /TRUST_PROXY_HOPS: "1"/)
})
