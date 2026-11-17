import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const reader = fs.readFileSync(path.join(root, 'src/DocumentReader.tsx'), 'utf8')
const css = fs.readFileSync(
  path.join(root, 'src/modules/repository/repository-reader-document.css'),
  'utf8',
)

test('Assignment Draft enters the controlled report styling path', () => {
  const match = reader.match(/const isAssignmentReport = (\/[^/]+\/i)\.test\(/)
  assert.ok(match, 'Assignment report classifier must remain explicit')

  const literal = match[1]
  const lastSlash = literal.lastIndexOf('/')
  const classifier = new RegExp(literal.slice(1, lastSlash), literal.slice(lastSlash + 1))

  assert.equal(classifier.test('Assignment Draft'), true)
  assert.equal(classifier.test('Assignment Report Draft'), true)
  assert.equal(classifier.test('Final Assignment Report'), true)
  assert.equal(classifier.test('Task Report'), false)
  assert.equal(classifier.test('Research Draft'), false)
})

test('iframe styles are owned by the dedicated CSS module', () => {
  assert.match(reader, /repository-reader-document\.css\?inline/)
  assert.match(reader, /const css = repositoryReaderDocumentCss;/)
  assert.match(reader, /style\.textContent = css;/)
  assert.doesNotMatch(reader, /const css = String\.raw`/)
})

test('assignment drafts have a PSC cover and document-control styling', () => {
  assert.match(reader, /app2-repository-report-cover/)
  assert.match(reader, /app2-repository-document-control/)
  assert.match(css, /\.app2-repository-report-cover/)
  assert.match(css, /\.app2-repository-document-control/)
})

test('plain report section headings have executive hierarchy and PSC gold accents', () => {
  assert.match(css, /body h2,\s*body \.body h2,\s*body \.section h2,\s*body \.app2-repository-report-content h2/)
  assert.match(css, /border-left: 5px solid #c89b2c/)
  assert.match(css, /background: linear-gradient\(90deg, #eef3f8 0%, #ffffff 88%\)/)
  assert.match(css, /body h3,/)
})

test('reader keeps iframe isolation and audited clipboard handling', () => {
  assert.match(reader, /sandbox="allow-same-origin"/)
  assert.match(reader, /frameDocument\.addEventListener\("copy"/)
  assert.match(reader, /mode: "BLOCKED_NATIVE"/)
  assert.match(reader, /api\.logDocumentCopy\(token, document\.id/)
})

test('report document styling retains responsive and print rules', () => {
  assert.match(css, /@media \(max-width: 760px\)/)
  assert.match(css, /@media print/)
})