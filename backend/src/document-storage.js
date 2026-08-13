import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import {config} from './config.js'

const allowed=new Map([
  ['.pdf',new Set(['application/pdf'])],
  ['.docx',new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream'])],
  ['.txt',new Set(['text/plain','application/octet-stream'])],
  ['.md',new Set(['text/markdown','text/plain','application/octet-stream'])]
])
const safeOriginalName=value=>path.basename(String(value||'document')).replace(/[\u0000-\u001f<>:"/\\|?*]/g,'_').slice(0,255)

export function validateDocumentUpload(bytes,originalName,mimeType){
  if(!Buffer.isBuffer(bytes)||!bytes.length)throw Object.assign(new Error('Choose a non-empty document.'),{status:400})
  if(bytes.length>config.maxUploadMb*1024*1024)throw Object.assign(new Error(`Documents may not exceed ${config.maxUploadMb} MB.`),{status:413})
  const cleanName=safeOriginalName(originalName)
  const extension=path.extname(cleanName).toLowerCase()
  if(!allowed.has(extension))throw Object.assign(new Error('Supported document types are PDF, DOCX, TXT and MD.'),{status:415})
  const type=String(mimeType||'application/octet-stream').toLowerCase().split(';')[0]
  if(!allowed.get(extension).has(type))throw Object.assign(new Error(`The file type does not match its ${extension} extension.`),{status:415})
  if(extension==='.pdf'&&!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw Object.assign(new Error('The uploaded file is not a valid PDF.'),{status:415})
  if(extension==='.docx'&&!(bytes[0]===0x50&&bytes[1]===0x4b))throw Object.assign(new Error('The uploaded file is not a valid DOCX package.'),{status:415})
  return {originalName:cleanName,extension,mimeType:type,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}
}

export async function storeDocument(bytes,extension){
  const root=path.resolve(config.documentStoragePath)
  await fs.mkdir(root,{recursive:true})
  const storedName=`document-${crypto.randomUUID()}${extension}`
  const target=path.resolve(root,storedName)
  if(path.dirname(target)!==root)throw new Error('Unsafe storage target.')
  await fs.writeFile(target,bytes,{flag:'wx'})
  return {storedName,storagePath:storedName,absolutePath:target}
}
export const resolveDocumentPath=storagePath=>{
  const root=path.resolve(config.documentStoragePath)
  const target=path.resolve(root,path.basename(storagePath))
  if(path.dirname(target)!==root)throw Object.assign(new Error('Unsafe document path.'),{status:400})
  return target
}
export const deleteStoredDocument=storagePath=>fs.unlink(resolveDocumentPath(storagePath)).catch(()=>{})
