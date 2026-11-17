import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAdminIdentity, validateAdminPassword } from '../src/admin-bootstrap-policy.js'

test('initial administrator identity is normalized and bounded', () => {
  assert.deepEqual(normalizeAdminIdentity('  REDESY Administrator  ', '  ADMIN@EXAMPLE.GO.KE '), {
    name: 'REDESY Administrator',
    email: 'admin@example.go.ke',
  })
  assert.throws(() => normalizeAdminIdentity('Al', 'admin@example.go.ke'), /Name must be/)
  assert.throws(() => normalizeAdminIdentity('Valid Name', 'invalid'), /valid email/)
})

test('initial administrator password follows the application password policy', () => {
  assert.equal(validateAdminPassword('RedesyPass123'), 'RedesyPass123')
  for (const password of ['Short1A', 'lowercase123', 'UPPERCASE123', 'NoDigitsHere']) {
    assert.throws(() => validateAdminPassword(password), /Password must be/)
  }
})
