import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import {Document,Packer,Paragraph,HeadingLevel,Table,TableCell,TableRow} from 'docx'

process.env.DATABASE_URL||='postgres://test:test@127.0.0.1:5432/test'
process.env.JWT_SECRET||='document-reader-test-secret-value-123456'
process.env.DOCUMENT_STORAGE_PATH||='test-reader-storage'
const {renderReadableVersion}=await import('../src/document-reader.js')
const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const root=path.resolve(process.env.DOCUMENT_STORAGE_PATH)
await fsp.mkdir(root,{recursive:true})

const version=(name,mime)=>({original_name:name,stored_name:name,storage_path:name,mime_type:mime})
test.after(async()=>fsp.rm(root,{recursive:true,force:true}))

test('TXT reader preserves safe readable text',async()=>{
  await fsp.writeFile(path.join(root,'sample.txt'),'First paragraph\n\nSecond <script>alert(1)</script>')
  const result=await renderReadableVersion(version('sample.txt','text/plain'))
  assert.equal(result.format,'text')
  assert.match(result.html,/First paragraph/)
  assert.doesNotMatch(result.html,/<script>/)
})

test('Markdown reader renders structure and removes executable markup',async()=>{
  await fsp.writeFile(path.join(root,'sample.md'),'# Policy\n\n- One\n- Two\n\n<script>alert(1)</script>\n[Safe](https://example.org)')
  const result=await renderReadableVersion(version('sample.md','text/markdown'))
  assert.equal(result.format,'markdown')
  assert.match(result.html,/<h1>Policy<\/h1>/)
  assert.match(result.html,/<ul>/)
  assert.doesNotMatch(result.html,/<script|alert\(1\)/)
  assert.match(result.html,/rel="noopener noreferrer"/)
})

test('DOCX reader safely preserves headings, paragraphs and tables',async()=>{
  const document=new Document({sections:[{children:[new Paragraph({text:'Operations Guide',heading:HeadingLevel.HEADING_1}),new Paragraph('Controlled paragraph'),new Table({rows:[new TableRow({children:[new TableCell({children:[new Paragraph('Cell')]}),new TableCell({children:[new Paragraph('Value')]})]})]})]}]})
  await fsp.writeFile(path.join(root,'sample.docx'),await Packer.toBuffer(document))
  const result=await renderReadableVersion(version('sample.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
  assert.equal(result.format,'docx')
  assert.match(result.html,/<h1>Operations Guide<\/h1>/)
  assert.match(result.html,/<table>/)
  assert.doesNotMatch(result.html,/<script|<iframe/)
})

test('reader rejects a missing stored file',async()=>{
  await assert.rejects(()=>renderReadableVersion(version('missing.txt','text/plain')),error=>error.code==='ENOENT')
})

test('reader routes enforce authorization and support PDF byte ranges',()=>{
  assert.match(app,/if\(!await canReadKnowledge\(req\.user,req\.params\.id\)\)return res\.status\(403\)/)
  assert.match(app,/Accept-Ranges':'bytes'/)
  assert.match(app,/Content-Range/)
  assert.match(app,/\/api\/documents\/:id\/versions\/:versionId\/reader/)
  assert.match(app,/X-Content-Type-Options':'nosniff'/)
})
