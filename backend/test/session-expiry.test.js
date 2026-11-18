import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionExpiryFromMinutes } from '../src/session-expiry.js'

test('valid system session minute settings are converted to JWT duration strings', () => {
  assert.equal(sessionExpiryFromMinutes(15), '15m')
  assert.equal(sessionExpiryFromMinutes(480), '480m')
  assert.equal(sessionExpiryFromMinutes('1440'), '1440m')
})

test('missing or invalid session minute values safely use the configured JWT fallback', () => {
  for (const value of [undefined, null, '', 0, 14, 1441, 15.5, 'not-a-number']) {
    assert.equal(sessionExpiryFromMinutes(value, '8h'), '8h')
  }
  assert.equal(sessionExpiryFromMinutes(120, '12h'), '120m')
})
