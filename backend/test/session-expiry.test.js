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

test('login and password-change tokens use the saved system session duration', async () => {
  const app = await (await import('node:fs/promises')).readFile(
    new URL('../src/app.js', import.meta.url),
    'utf8',
  )
  const auth = await (await import('node:fs/promises')).readFile(
    new URL('../src/auth.js', import.meta.url),
    'utf8',
  )
  assert.match(auth, /createToken=\(user,expiresIn=config\.jwtExpiresIn\)/)
  assert.match(app, /SELECT session_minutes FROM system_settings WHERE id=1/)
  assert.match(app, /sessionExpiryFromMinutes\(setting\?\.session_minutes,config\.jwtExpiresIn\)/)
  assert.match(app, /token:await createSessionToken\(user\)/)
  assert.match(app, /token:await createSessionToken\(updated\)/)
})
