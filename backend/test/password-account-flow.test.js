import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('self-service password recovery sends a generic, rate-limited email without returning tokens', async () => {
  const app = await read('../src/app.js')
  const forgot = app.slice(app.indexOf("app.post('/api/auth/forgot-password'"), app.indexOf("app.post('/api/auth/reset-password'"))
  assert.match(forgot, /passwordResetRateLimit/)
  assert.match(forgot, /passwordLinkService\.sendPasswordLink\(user,\{purpose:'reset'\}\)/)
  assert.match(forgot, /If an active account matches that email address/)
  assert.doesNotMatch(forgot, /response\.resetToken|resetToken:/)
})

test('password reset validates an active user and consumes every outstanding token', async () => {
  const app = await read('../src/app.js')
  const reset = app.slice(app.indexOf("app.post('/api/auth/reset-password'"), app.indexOf('const supervisorRoleFor'))
  assert.match(reset, /u\.active=TRUE/)
  assert.match(reset, /expires_at>NOW\(\)/)
  assert.match(reset, /FOR UPDATE OF t/)
  assert.match(reset, /must_change_password=FALSE,token_version=token_version\+1/)
  assert.match(reset, /WHERE user_id=\$1 AND used_at IS NULL/)
  assert.match(reset, /PASSWORD_RESET_COMPLETED/)
})

test('new user creation stores a random inaccessible initial secret and emails a setup link', async () => {
  const app = await read('../src/app.js')
  const create = app.slice(app.indexOf("app.post('/api/users',authenticate"), app.indexOf("app.patch('/api/users/:id'"))
  assert.match(create, /authorize\('System Admin'\)/)
  assert.match(create, /crypto\.randomBytes\(48\)/)
  assert.match(create, /passwordLinkService\.sendPasswordLink\(created,\{purpose:'setup'\}\)/)
  assert.match(create, /setup_email_sent:setupEmailSent/)
  assert.doesNotMatch(create, /temporaryPassword|temporary_password/)
})

test('manager user-administration exception never grants access to the role-change endpoint', async () => {
  const auth = await read('../src/auth.js')
  const allowlist = auth.split('\n').find(line => line.includes('const userAdministrationPath='))
  assert.ok(allowlist, 'manager user-administration path allowlist must exist')
  assert.doesNotMatch(allowlist, /role/, 'role changes must remain System Admin only')
  assert.match(allowlist, /reset-password/, 'scoped managers may still request password resets')
})

test('administrator password reset sends a single-use link and returns no password', async () => {
  const app = await read('../src/app.js')
  const reset = app.slice(app.indexOf("app.post('/api/users/:id/reset-password'"), app.indexOf("app.get('/api/assignments'"))
  assert.match(reset, /canManageUser/)
  assert.match(reset, /must_change_password=TRUE,token_version=token_version\+1/)
  assert.match(reset, /passwordLinkService\.sendPasswordLink\(target/)
  assert.doesNotMatch(reset, /temporaryPassword|temporary_password/)
})

test('frontend consumes the email-link fragment, clears it from browser history and no longer displays temporary passwords', async () => {
  const [front, api] = await Promise.all([read('../../src/App.tsx'), read('../../src/api.ts')])
  assert.match(front, /new URLSearchParams\(fragment\)\.get\("resetToken"\)/)
  assert.match(front, /window\.history\.replaceState/)
  assert.match(front, /Send \/ resend setup link/)
  const accountModal = front.slice(front.indexOf("{createdAccount && ("), front.indexOf("{userEditor && ("))
  assert.doesNotMatch(accountModal, /clipboard|Copy password|temporaryCredential|temporaryPassword|temporary_password/)
  assert.doesNotMatch(front, /temporaryCredential|temporaryPassword|temporary_password|createdAccount\.password/)
  assert.doesNotMatch(api, /temporaryPassword|temporary_password|resetToken\?:/)
})

test('mail service preserves the branded password-link HTML message', async () => {
  const mail = await read('../src/mail-service.js')
  assert.match(mail, /html = null/)
  assert.match(mail, /html: html \|\|/)
})

test('quick role changes validate the target role against its existing reporting line', async () => {
  const app = await read('../src/app.js')
  const roleChange = app.slice(app.indexOf("app.patch('/api/users/:id/role'"), app.indexOf("app.post('/api/users/:id/reset-password'"))
  assert.match(roleChange, /SELECT role,supervisor_id FROM users WHERE id=\$1 FOR UPDATE/)
  assert.match(roleChange, /validateSupervisor\(client,req\.validated\.role,current\.supervisor_id,req\.params\.id\)/)
  assert.match(roleChange, /authorize\('System Admin'\)/)
})
