import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const setup=fs.readFileSync(new URL('../src/setup-database.js',import.meta.url),'utf8')
const productionMigrate=fs.readFileSync(new URL('../src/migrate-production.js',import.meta.url),'utf8')

test('database setup cannot recreate deleted demo work unless explicitly requested',()=>{
  assert.match(setup,/process\.env\.APP2_SEED_DEMO_WORK==='true'/)
  assert.match(setup,/if\(process\.env\.APP2_SEED_DEMO_WORK==='true'\)\{[\s\S]*const seeds=/)
})

test('fresh production databases load the verified baseline SQL before creating the migration ledger',()=>{
  assert.match(productionMigrate,/const \{ baselineSql, migrations \} = await loadProductionMigrationPlan\(\)/);
  assert.match(productionMigrate,/await client\.query\(baselineSql\)/);
  assert.match(productionMigrate,/CREATE TABLE \$\{migrationTable\}/);
});
