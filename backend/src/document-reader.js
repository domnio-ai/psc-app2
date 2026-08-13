import fs from 'node:fs/promises'
import mammoth from 'mammoth'
import {marked} from 'marked'
import sanitizeHtml from 'sanitize-html'
import {resolveDocumentPath} from './document-storage.js'

const cleanHtml=value=>sanitizeHtml(String(value||''),{
  allowedTags:['h1','h2','h3','h4','h5','h6','p','br','strong','b','em','i','u','s','ul','ol','li','blockquote','pre','code','table','thead','tbody','tr','th','td','a','hr'],
  allowedAttributes:{a:['href','title','target','rel'],th:['colspan','rowspan'],td:['colspan','rowspan']},
  allowedSchemes:['http','https','mailto'],
  transformTags:{a:(_tag,attributes)=>({tagName:'a',attribs:{...attributes,target:'_blank',rel:'noopener noreferrer'}})},
  disallowedTagsMode:'discard'
})
const textHtml=value=>String(value||'').split(/\r?\n/).map(line=>line.trim()?`<p>${line.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</p>`:'<br>').join('')
const plain=value=>sanitizeHtml(String(value||''),{allowedTags:[],allowedAttributes:{}}).replace(/\s+/g,' ').trim()

export async function renderReadableVersion(version){
  const filePath=resolveDocumentPath(version.storage_path||version.stored_name)
  const extension=String(version.original_name).toLowerCase().split('.').pop()
  if(version.mime_type==='application/pdf'||extension==='pdf')return {format:'pdf',filePath}
  if(extension==='docx'){
    const result=await mammoth.convertToHtml({path:filePath},{includeDefaultStyleMap:true,ignoreEmptyParagraphs:false})
    const html=cleanHtml(result.value)
    return {format:'docx',html,text:plain(html),warnings:result.messages.map(message=>message.message)}
  }
  const source=(await fs.readFile(filePath,'utf8')).slice(0,5_000_000)
  if(extension==='md'||version.mime_type==='text/markdown'){
    const html=cleanHtml(await marked.parse(source,{async:true,gfm:true,breaks:true}))
    return {format:'markdown',html,text:plain(html)}
  }
  return {format:'text',html:textHtml(source),text:source}
}
