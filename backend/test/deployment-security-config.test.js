import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const config=readFileSync(new URL('../src/config.js',import.meta.url),'utf8')
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const example=readFileSync(new URL('../.env.example',import.meta.url),'utf8')

test('production CORS does not silently admit development origins',()=>{
  assert.match(config,/environment==='production'\?\[\]:localFrontendOrigins/)
  assert.match(config,/FRONTEND_ORIGIN must not use localhost in production/)
})

test('public login directory is disabled by default and never exposed in production',()=>{
  assert.match(config,/EXPOSE_LOGIN_DIRECTORY==='true'&&environment!=='production'/)
  assert.match(app,/if\(!config\.exposeLoginDirectory\)return res\.json\(\[\]\)/)
  assert.match(example,/EXPOSE_LOGIN_DIRECTORY=false/)
})

test('production Felix failures do not disclose upstream error details',()=>{
  assert.match(app,/config\.environment==='production'\?\{\}:\{details:error\.message\}/)
})
