import assert from 'node:assert/strict'
import test from 'node:test'
import {renderReportExport} from '../src/reports/report-export.js'

const model={
  title:'Work Status',generatedAt:'2026-08-20T18:35:11.000Z',period:{from:'2026-08-01',to:'2026-08-20'},
  scope:{type:'division',division:'Research'},recordCount:2,
  kpis:[{label:'Total work items',value:2},{label:'Completed',value:1},{label:'Active',value:1},{label:'Overdue',value:0}],
  columns:['work_type','title','status','due_date','created_at'],
  rows:[
    {work_type:'Assignment',title:'Policy Review',status:'In Progress',due_date:'2026-08-21',created_at:'2026-08-20T18:35:11.000Z'},
    {work_type:'Task',title:'Evidence Review',status:'Completed',due_date:'2026-08-22',created_at:'2026-08-19T09:00:00.000Z'},
  ],
}

test('institutional report renderer creates all supported export formats',async()=>{
  const pdf=await renderReportExport('pdf',model)
  const docx=await renderReportExport('docx',model)
  const xlsx=await renderReportExport('xlsx',model)
  assert.equal(pdf.buffer.subarray(0,4).toString(),'%PDF')
  assert.equal(docx.buffer.subarray(0,2).toString(),'PK')
  assert.equal(xlsx.buffer.subarray(0,2).toString(),'PK')
  assert.ok(pdf.buffer.length>2000)
  assert.ok(docx.buffer.length>5000)
  assert.ok(xlsx.buffer.length>5000)
})

test('unsupported export formats are rejected',async()=>{
  await assert.rejects(()=>renderReportExport('txt',model),/Unsupported report export format/)
})

test('PDF exports honour the selected Letter page size',async()=>{
  const pdf=await renderReportExport('pdf',{...model,paperSize:'Letter'})
  assert.match(pdf.buffer.toString('latin1'),/MediaBox \[0 0 792 612\]/)
})
