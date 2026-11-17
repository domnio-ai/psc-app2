import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd().endsWith(`${path.sep}backend`)?path.resolve(process.cwd(),'..'):process.cwd()
const backend=fs.readFileSync(path.join(root,'backend/src/app.js'),'utf8')

test('blank approved Task Reports remain blank/freeform in final repository publication',()=>{
  assert.match(backend,/const approvedReportMode=approvedSnapshot\.report_mode\?\?current\.report_mode\?\?'structured'/)
  assert.match(backend,/const approvedBlankContent=sanitizeTaskReportHtml\(approvedSnapshot\.blank_content\?\?current\.blank_content\)/)
  assert.match(backend,/const repositorySections=approvedReportMode==='blank'/)
  assert.match(backend,/\{title:'',content:approvedBlankContent,heading:false\}/)
  assert.doesNotMatch(
    backend,
    /const repositorySections=\[\s*\{title:'Task Purpose'/
  )
})

test('structured Task Reports retain the governed final publication outline',()=>{
  assert.match(backend,/\{title:'Task Purpose',content:plainTaskReportText\(approvedTask\.task_purpose\|\|approvedTask\.description\)\}/)
  assert.match(backend,/\{title:'Key Findings',content:sanitizeTaskReportHtml\(approvedTask\.contribution_findings\)\}/)
  assert.match(backend,/\{title:'Recommendations',content:sanitizeTaskReportHtml\(approvedTask\.contribution_recommendations\)\}/)
})

test('DOCX builder can omit a heading for intentional freeform blank-report content',()=>{
  assert.match(backend,/section\.heading===false\?body:/)
  assert.match(backend,/new Paragraph\(\{text:section\.title,heading:HeadingLevel\.HEADING_1\}\)/)
})

test('finalization still consumes the immutable approved Task Report snapshot',()=>{
  assert.match(backend,/SELECT \* FROM task_report_versions WHERE task_id=\$1 AND version_number=\$2 AND status='Approved'/)
  assert.match(backend,/const approvedSnapshot=/)
  assert.match(backend,/const approvedTask=\{\.\.\.current,\.\.\.approvedSnapshot\}/)
  assert.match(backend,/buildPscTaskFinalPdf\(repositoryTitle,\{[\s\S]*?\},repositorySections\)/); assert.match(backend,/const mimeType='application\/pdf'/)
})
