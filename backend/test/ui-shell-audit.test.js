import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8')

test('deployment UI shell keeps a single auditable global stylesheet manifest', () => {
  const entry = read('../../src/main.tsx')
  const manifest = read('../../src/app-styles.css')
  const sourceRoot = fileURLToPath(new URL('../../src/', import.meta.url))
  const imports = [...manifest.matchAll(/^@import\s+["'](.+\.css)["'];/gm)].map(match => match[1])

  assert.match(entry, /import "\.\/app-styles\.css"/)
  assert.equal((entry.match(/\.css["']/g) || []).length, 1)
  assert.ok(imports.length > 80)
  assert.equal(new Set(imports).size, imports.length)
  for (const source of imports) {
    assert.ok(fs.existsSync(path.resolve(sourceRoot, source)), `Missing stylesheet ${source}`)
  }
  assert.match(manifest, /app2-executive-tokens\.css["'];\s*@import "\.\/styles\/app2-executive-components\.css["'];\s*@import "\.\/styles\/app2-primitives\.css/)
})

test('document shell has responsive metadata, a font fallback and a skip-navigation target', () => {
  const html = read('../../index.html')
  const styles = read('../../src/styles.css')
  const app = read('../../src/App.tsx')
  const shell = read('../../src/app-shell.css')

  assert.match(html, /name="viewport"/)
  assert.match(html, /name="description"/)
  assert.match(html, /fonts\.googleapis\.com\/css2\?.*display=swap/)
  assert.doesNotMatch(styles, /@import\s+url\(['"]https:\/\/fonts\.googleapis\.com/)
  assert.match(app, /className="skip-to-main" href="#app-main-content"/)
  assert.match(app, /id="app-main-content" tabIndex=\{?-1\}?/)
  assert.match(shell, /\.skip-to-main:focus/)
})

test('selected App2 theme updates the browser theme colour and report builder avoids nested main landmarks', () => {
  const theme = read('../../src/theme-preferences.ts')
  const app = read('../../src/App.tsx')
  const css = read('../../src/document-builders-phase6-8.css')

  assert.match(theme, /meta\[name="theme-color"\]/)
  assert.match(theme, /getPropertyValue\("--app-background"\)/)
  assert.match(app, /<div className="builder-layout">/)
  assert.doesNotMatch(css, /\.structured-document-builder>main/)
})
