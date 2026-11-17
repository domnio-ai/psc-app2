import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const auth=readFileSync(new URL('../src/auth.js',import.meta.url),'utf8')
const app=readFileSync(new URL('../../src/App.tsx',import.meta.url),'utf8')

test('backend authentication blocks ordinary API access while password change is required',()=>{
  assert.ok(auth.includes('u.must_change_password'))
  assert.ok(auth.includes('if(user.must_change_password){'))
  assert.ok(auth.includes("req.method==='GET'&&req.path==='/api/auth/me'"))
  assert.ok(auth.includes("req.method==='POST'&&(req.path==='/api/auth/change-password'||req.path==='/api/auth/logout')"))
  assert.ok(auth.includes("code:'PASSWORD_CHANGE_REQUIRED'"))
})

test('saved sessions resume mandatory password change without loading workspace data',()=>{
  assert.ok(app.includes('if (profile.mustChangePassword)'))
  assert.match(app,/if \(profile\.mustChangePassword\) \{[\s\S]*?return;\s*\}\s*return loadLiveData\(stored\.token, profile\);/)
})

test('initial login does not load workspace data before mandatory password change',()=>{
  assert.match(app,/if \(result\.user\.must_change_password\) \{[\s\S]*?return;\s*\}\s*await loadLiveData\(result\.token, profile\);/)
})

test('successful mandatory change unlocks workspace only after server success',()=>{
  assert.match(app,/if \(completingMandatoryChange\) \{[\s\S]*?setPasswordMode\(null\);[\s\S]*?await loadLiveData\(result\.token, profile\);/)
})

test('mandatory modal cannot be dismissed and offers sign-out; sign-out clears modal state',()=>{
  assert.ok(app.includes('{!user?.mustChangePassword && ('))
  assert.ok(app.includes('{user?.mustChangePassword && ('))
  assert.ok(app.includes('<button className="sign-in" type="button" onClick={signOut}>'))
  assert.match(app,/const clearSession = \(message = ""\) => \{[\s\S]*?setPasswordMode\(null\);/)
})