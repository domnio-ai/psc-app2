import fs from 'node:fs/promises'
import mammoth from 'mammoth'
import {marked} from 'marked'
import sanitizeHtml from 'sanitize-html'
import {resolveDocumentPath} from './document-storage.js'
import {sanitizeTaskReportHtml} from './task-report-formatting.js'

const cleanHtml=value=>sanitizeHtml(String(value||''),{
  allowedTags:['h1','h2','h3','h4','h5','h6','p','br','strong','b','em','i','u','s','ul','ol','li','blockquote','pre','code','table','caption','thead','tbody','tfoot','tr','th','td','a','hr','img','figure','figcaption','span','div'],
  allowedAttributes:{
    '*':['class'],
    a:['href','title','target','rel'],
    img:['src','alt','title','width','height'],
    th:['colspan','rowspan','scope'],
    td:['colspan','rowspan']
  },
  allowedSchemes:['http','https','mailto','data'],
  allowedSchemesByTag:{img:['data','http','https']},
  transformTags:{a:(_tag,attributes)=>({tagName:'a',attribs:{...attributes,target:'_blank',rel:'noopener noreferrer'}})},
  disallowedTagsMode:'discard'
})
const textHtml=value=>String(value||'').split(/\r?\n/).map(line=>line.trim()?`<p>${line.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</p>`:'<br>').join('')
const plain=value=>sanitizeHtml(String(value||''),{allowedTags:[],allowedAttributes:{}}).replace(/\s+/g,' ').trim()
const assignmentDraftTextHtml=value=>{
  const source=String(value||'').replace(/\r\n?/g,'\n')
  const lines=source.split('\n')
  const firstIndex=lines.findIndex(line=>line.trim())
  if(firstIndex>=0){
    const first=lines[firstIndex]
    const marker=/-\s*REPORT DRAFT\b/i.exec(first)
    if(marker){
      const remainder=first.slice(marker.index+marker[0].length).trim()
      lines.splice(firstIndex,1,...(remainder?[remainder]:[]))
    }
  }
  const headings=[
    'BACKGROUND AND ASSIGNMENT MANDATE','OBJECTIVES AND SCOPE','APPROACH AND WORK UNDERTAKEN',
    'GAPS, RISKS AND CONSTRAINTS','REFERENCES AND SUPPORTING EVIDENCE','IMPLEMENTATION ACTION MATRIX',
    'APPENDICES / SOURCE REGISTER','REVIEW AND APPROVAL RECORD','EVIDENCE REVIEWED','KEY FINDINGS',
    'EXECUTIVE SUMMARY','CONCLUSIONS','RECOMMENDATIONS','APPENDICES','BACKGROUND','OBJECTIVES'
  ]
  const headingPattern=new RegExp(`\\b(${headings.join('|')})\\b`,'i')
  const escape=value=>String(value||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  const blocks=[]
  for(const rawLine of lines){
    let line=rawLine.trim()
    if(!line)continue
    line=line.replace(/Reference:\s*\S+/gi,'').replace(/Status:\s*\S+/gi,'').replace(/Saved:\s*\S+/gi,'').trim()
    if(!line)continue
    const match=headingPattern.exec(line)
    if(match){
      const before=line.slice(0,match.index).trim()
      const heading=line.slice(match.index,match.index+match[0].length).trim()
      const after=line.slice(match.index+match[0].length).trim()
      if(before)blocks.push(`<p>${escape(before)}</p>`)
      blocks.push(`<h2 class="app2-task-report-section-title">${escape(heading)}</h2>`)
      if(after)blocks.push(`<p>${escape(after)}</p>`)
      headingPattern.lastIndex=0
      continue
    }
    headingPattern.lastIndex=0
    if(/^[A-Z][A-Z0-9 \t&/(),.'’–—-]{2,100}$/.test(line)&&/[A-Z]{3}/.test(line))
      blocks.push(`<h2 class="app2-task-report-section-title">${escape(line)}</h2>`)
    else blocks.push(`<p>${escape(line)}</p>`)
  }
  return `<div class="app2-task-report-draft"><div class="app2-repository-report-content">${blocks.join('')}</div></div>`
}

export async function renderReadableVersion(version){
  const filePath=resolveDocumentPath(version.storage_path||version.stored_name)
  const extension=String(version.original_name).toLowerCase().split('.').pop()
  if(version.mime_type==='application/pdf'||extension==='pdf')return {format:'pdf',filePath}
  if(extension==='docx'){
    const styleMap=[
      "p[style-name='Title'] => h1.app2-docx-title:fresh",
      "p[style-name='Subtitle'] => p.app2-docx-subtitle:fresh",
      "p[style-name='Heading 1'] => h1.app2-docx-h1:fresh",
      "p[style-name='Heading 2'] => h2.app2-docx-h2:fresh",
      "p[style-name='Heading 3'] => h3.app2-docx-h3:fresh",
      "p[style-name='Heading 4'] => h4.app2-docx-h4:fresh",
      "p[style-name='Quote'] => blockquote.app2-docx-quote:fresh",
      "p[style-name='Intense Quote'] => blockquote.app2-docx-quote:fresh",
      "p[style-name='Caption'] => p.app2-docx-caption:fresh"
    ]
    const result=await mammoth.convertToHtml(
      {path:filePath},
      {
        includeDefaultStyleMap:true,
        ignoreEmptyParagraphs:false,
        styleMap,
        convertImage:mammoth.images.imgElement(async image=>{
          const buffer=await image.read()
          return {src:`data:${image.contentType};base64,${buffer.toString('base64')}`}
        })
      }
    )
    const html=cleanHtml(result.value)
    return {format:'docx',html,text:plain(html),warnings:result.messages.map(message=>message.message)}
  }
  const source=(await fs.readFile(filePath,'utf8')).slice(0,5_000_000)
  if(extension==='html'||String(version.mime_type||'').split(';')[0].trim().toLowerCase()==='text/html'){
    const html=sanitizeTaskReportHtml(source)
    return {format:'html',html,text:plain(html)}
  }
  if(extension==='md'||version.mime_type==='text/markdown'){
    const html=cleanHtml(await marked.parse(source,{async:true,gfm:true,breaks:true}))
    return {format:'markdown',html,text:plain(html)}
  }
  // Report drafts can be saved with a generic text filename or MIME type. If the
  // content is recognizably HTML, render it through the report sanitizer instead
  // of escaping the tags into the reader as visible source text.
  if(/<\/?(?:p|div|span|h[1-6]|table|thead|tbody|tr|td|th|ul|ol|li|strong|em|br)\b/i.test(source)){
    const html=sanitizeTaskReportHtml(source)
    return {format:'html',html,text:plain(html)}
  }
  if(extension==='txt'&&version.document_type==='Assignment Report Draft'){
    const html=assignmentDraftTextHtml(source)
    return {format:'html',html,text:plain(html)}
  }
  return {format:'text',html:textHtml(source),text:source}
}
