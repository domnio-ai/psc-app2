import test from 'node:test'
import assert from 'node:assert/strict'
import { createMailService } from '../src/mail-service.js'

const baseSmtp = (overrides = {}) => ({
  enabled: true,
  host: 'smtp.example.test',
  port: 587,
  secure: false,
  user: 'unit-test-user',
  password: 'unit-test-password',
  from: 'redesy@example.test',
  ...overrides,
})

const message = { to: 'recipient@example.test', subject: 'Test', text: 'Offline unit test' }

test('SMTP disabled rejects delivery before constructing a transport', async () => {
  let transportCalls = 0
  const service = createMailService(baseSmtp({ enabled: false }), async () => {
    transportCalls += 1
    throw new Error('Transport must not be created when SMTP is disabled.')
  })

  assert.equal(service.mailStatus().ready, false)
  await assert.rejects(service.sendMail(message), error => error.statusCode === 503)
  assert.equal(transportCalls, 0)
})

test('incomplete SMTP configuration rejects delivery before constructing a transport', async () => {
  let transportCalls = 0
  const service = createMailService(baseSmtp({ password: '' }), async () => {
    transportCalls += 1
    throw new Error('Transport must not be created for incomplete SMTP configuration.')
  })

  assert.equal(service.mailStatus().ready, false)
  await assert.rejects(service.sendMail(message), error => error.statusCode === 503)
  assert.equal(transportCalls, 0)
})

test('enabled SMTP verifies and sends through the supplied transport factory', async () => {
  const calls = []
  const service = createMailService(baseSmtp(), async options => {
    calls.push({ kind: 'create', options })
    return {
      verify: async () => { calls.push({ kind: 'verify' }) },
      sendMail: async mail => {
        calls.push({ kind: 'send', mail })
        return { messageId: 'offline-test-message', accepted: ['recipient@example.test'] }
      },
    }
  })

  assert.equal(service.mailStatus().ready, true)
  const result = await service.sendMail(message)
  assert.equal(result.messageId, 'offline-test-message')
  assert.deepEqual(calls.map(call => call.kind), ['create', 'verify', 'send'])
})