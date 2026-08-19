import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import {createReadStream} from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import mammoth from 'mammoth'
import sanitizeHtml from 'sanitize-html'
import PDFDocument from 'pdfkit'
import {Document as WordDocument,HeadingLevel,Packer,Paragraph,TextRun} from 'docx'
import {z} from 'zod'
import {config} from './config.js'
import {authenticate,authorize,createToken,roles} from './auth.js'
import {audit} from './audit.js'
import {query,transaction} from './db.js'
import {mailStatus,sendMail} from './mailer.js'
import {enqueueFelixDocumentIndex} from './felix-index-worker.js'
import {deleteStoredDocument,resolveDocumentPath,storeDocument,validateDocumentUpload} from './document-storage.js'
import {renderReadableVersion} from './document-reader.js'
import {auditReportAccess,categories as reportCategories,deleteReportView,recordReportExport,reportCatalogue,reportData,reportPermissions,reportSummary,reportViews,saveReportView,setFavourite} from './reports/report-service.js'
import {renderReportExport} from './reports/report-export.js'

const escapeHtml=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')

const syncAssignmentStatusFromTasks=async(client,assignmentId,userId)=>{
  const assignment=(await client.query('SELECT status FROM assignments WHERE id=$1 FOR UPDATE',[assignmentId])).rows[0]
  if(!assignment||['Completed','Ready for Review'].includes(assignment.status))return assignment?.status||null
  const summary=(await client.query(`SELECT COUNT(*)::int total,
    COUNT(*) FILTER(WHERE status='Not Started')::int not_started,
    COUNT(*) FILTER(WHERE status IN('In Progress','Blocked','Completed'))::int active
    FROM assignment_tasks WHERE assignment_id=$1 AND archived_at IS NULL`,[assignmentId])).rows[0]
  const nextStatus=summary.total>0&&summary.active>0?'In Progress':'Not Started'
  if(nextStatus===assignment.status)return nextStatus
  await client.query('UPDATE assignments SET status=$1,updated_at=NOW() WHERE id=$2',[nextStatus,assignmentId])
  await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[assignmentId,userId,'STATUS_SYNCHRONIZED',JSON.stringify({status:nextStatus,source:'tasks'})])
  return nextStatus
}

const app=express()
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({origin(origin,callback){if(!origin||config.frontendOrigins.includes(origin))return callback(null,true);callback(new Error('This browser origin is not permitted to access App2.'))}}))
app.use('/api/assignments/:id/attachments',express.raw({type:'application/octet-stream',limit:`${config.maxUploadMb}mb`}))
app.use('/api/knowledge',express.raw({type:'application/octet-stream',limit:`${config.maxUploadMb}mb`}))
app.use('/api/knowledge/:id/versions',express.raw({type:'application/octet-stream',limit:`${config.maxUploadMb}mb`}))
app.use('/api/research-imports',express.raw({type:'application/octet-stream',limit:`${config.maxUploadMb}mb`}))
app.use('/api/documents',express.raw({type:'application/octet-stream',limit:`${config.maxUploadMb}mb`}))
app.use('/api/assignment-reports/:id/import',express.raw({type:'application/octet-stream',limit:`${config.maxUploadMb}mb`}))
app.use(express.json({limit:'1mb'}))
app.use('/api/felix', authenticate, async (req, res) => {
  try {
    const startedAt=Date.now()
    // The App2 mount strips "/felix" from req.url. Chat must target the
    // authenticated scoped pipeline, never the legacy repository-wide /api/chat.
    const target = req.url === '/chat'
      ? `${config.aiResearchUrl}/api/felix/chat`
      : `${config.aiResearchUrl}/api${req.url}`
    const hasBody = !['GET', 'HEAD'].includes(req.method)

    // Health checks should fail quickly.
    // Chat/retrieval requests need more time for local AI inference.
    const timeoutMs = req.url === '/health' ? 5000 : 120000

    const response = await fetch(target, {
      method: req.method,
      headers: {
        Authorization: req.headers.authorization,
        'Content-Type': 'application/json'
      },
      body: hasBody ? JSON.stringify(req.body || {}) : undefined,
      signal: AbortSignal.timeout(timeoutMs)
    })

    const text = await response.text()

    if(req.method==='POST'&&req.url==='/chat'){
      let payload={};try{payload=JSON.parse(text)}catch{}
      await query('INSERT INTO felix_report_metrics(user_id,mode,query_length,response_ok,source_count,confidence,response_ms)VALUES($1,$2,$3,$4,$5,$6,$7)',[req.user.id,String(req.body?.mode||'Auto'),String(req.body?.message||'').length,response.ok,Array.isArray(payload?.sources)?payload.sources.length:0,Number.isFinite(Number(payload?.confidence))?Number(payload.confidence):null,Date.now()-startedAt]).catch(error=>console.error('Felix metric capture failed:',error.message))
    }

    res
      .status(response.status)
      .type(response.headers.get('content-type') || 'application/json')
      .send(text)

  } catch (error) {
    console.error('Felix proxy error:', error)

    res.status(503).json({
      error: 'Felix request could not be completed.',
      details: error.message
    })
  }

})

const validate=schema=>(req,res,next)=>{const result=schema.safeParse(req.body);if(!result.success)return res.status(400).json({error:'Please correct the submitted information.',details:result.error.flatten()});req.validated=result.data;next()}
const loginSchema=z.object({email:z.string().email().max(255),password:z.string().min(8).max(128)})
const passwordSchema=z.string()
  .min(10)
  .max(128)
  .regex(/[A-Z]/,'Include an uppercase letter.')
  .regex(/[a-z]/,'Include a lowercase letter.')
  .regex(/[0-9]/,'Include a number.')
const testEmailSchema=z.object({email:z.string().email().max(255)})
const assignmentSchema=z.object({title:z.string().min(4).max(240),description:z.string().max(5000).default(''),division:z.string().min(2).max(160),dueDate:z.string().nullable().optional(),priority:z.enum(['Low','Normal','High','Critical']).default('Normal'),memberIds:z.array(z.string().uuid()).default([])})
const assignmentTaskSchema=z.object({
  title:z.string().min(2).max(240),
  description:z.string().max(5000).default(''),
  ownerId:z.string().uuid().nullable().default(null),
  priority:z.enum(['Low','Normal','High','Critical']).default('Normal'),
  status:z.enum(['Not Started','In Progress','Blocked','Completed']).default('Not Started'),
  progress:z.number().int().min(0).max(100).default(0),
  startDate:z.string().nullable().default(null),
  dueDate:z.string().nullable().default(null),
  notes:z.string().max(5000).default(''),
  expectedContribution:z.string().max(5000).default(''),
  assignmentPart:z.string().max(2000).default(''),
  assignmentSectionId:z.string().uuid().nullable().default(null),
  taskPurpose:z.string().max(5000).default(''),
  specificInstructions:z.string().max(10000).default(''),
  expectedFindings:z.string().max(5000).default(''),
  expectedOutput:z.string().max(200).default('Task Report'),
  evidenceRequired:z.string().max(5000).default(''),
  reviewerId:z.string().uuid().nullable().default(null),
  targetDocumentId:z.string().uuid().nullable().default(null),
  targetSectionId:z.string().uuid().nullable().default(null)
})
const assignmentSectionStatus=z.enum(['Not Started','In Progress','Blocked','Ready for Integration','Completed'])
const assignmentSectionBaseSchema=z.object({
  title:z.string().trim().min(2).max(250),
  description:z.string().max(8000).default(''),
  leadId:z.string().uuid().nullable().default(null),
  startDate:z.string().nullable().default(null),
  dueDate:z.string().nullable().default(null),
  status:assignmentSectionStatus.default('Not Started'),
  progress:z.number().int().min(0).max(100).default(0),
  isMandatory:z.boolean().default(true)
})
const assignmentSectionSchema=assignmentSectionBaseSchema.superRefine((value,context)=>{if(value.startDate&&value.dueDate&&value.dueDate<value.startDate)context.addIssue({code:'custom',path:['dueDate'],message:'Due date cannot be before the start date.'})})
const assignmentSectionUpdateSchema=assignmentSectionBaseSchema.partial().superRefine((value,context)=>{if(value.startDate&&value.dueDate&&value.dueDate<value.startDate)context.addIssue({code:'custom',path:['dueDate'],message:'Due date cannot be before the start date.'})})
const assignmentSectionReorderSchema=z.array(z.object({id:z.string().uuid(),sectionOrder:z.number().int().positive()})).min(1).max(100)
const assignmentTaskContributionSchema=z.object({
  contributionTitle:z.string().max(300).default(''),
  contributionSummary:z.string().max(12000).default(''),
  contributionFindings:z.string().max(12000).default(''),
  contributionRecommendations:z.string().max(12000).default(''),
  evidenceReviewed:z.string().max(12000).default(''),
  contributionChallenges:z.string().max(12000).default(''),
  contributionNextActions:z.string().max(12000).default(''),
  workNotes:z.string().max(12000).default(''),
  contributionStatus:z.enum(['Draft','Ready for Integration','Integrated','Accepted']).default('Draft')
})
const assignmentTaskContributionReviewSchema=z.object({
  decision:z.enum(['Changes Requested','Rejected','Approved']),
  comments:z.string().max(4000).default('')
})
const assignmentTaskContributionPreviewSchema=z.object({
  contributionTitle:z.string().max(300).default(''),
  contributionSummary:z.string().max(12000).default(''),
  contributionFindings:z.string().max(12000).default(''),
  contributionRecommendations:z.string().max(12000).default(''),
  evidenceReviewed:z.string().max(12000).default(''),
  contributionChallenges:z.string().max(12000).default(''),
  contributionNextActions:z.string().max(12000).default(''),
  workNotes:z.string().max(12000).default('')
})
const assignmentTaskContributionSectionSchema=z.object({sectionKey:z.enum(['title','workCompleted','evidence','findings','recommendations','challenges','nextActions']),status:z.enum(['Draft','In Review','Final']),content:z.string().max(750000).default('')})
const assignmentTaskRequestSchema=z.object({
  title:z.string().min(2).max(240),
  description:z.string().max(5000).default(''),
  suggestedOwnerId:z.string().uuid().nullable().default(null),
  priority:z.enum(['Low','Normal','High','Critical']).default('Normal'),
  dueDate:z.string().nullable().default(null),
  reason:z.string().min(2).max(5000)
})
const assignmentTaskRequestDecisionSchema=z.object({
  decision:z.enum(['Approved','Rejected']),
  comments:z.string().max(4000).default(''),
  title:z.string().min(2).max(240).optional(),
  description:z.string().max(5000).optional(),
  ownerId:z.string().uuid().nullable().optional(),
  priority:z.enum(['Low','Normal','High','Critical']).optional(),
  startDate:z.string().nullable().optional(),
  dueDate:z.string().nullable().optional(),
  notes:z.string().max(5000).optional()
})
const knowledgeSchema=z.object({title:z.string().min(3).max(240),description:z.string().max(5000).default(''),category:z.string().min(2).max(120),categoryId:z.string().uuid().nullable().optional(),tags:z.array(z.string().min(1).max(60)).max(30).default([]),author:z.string().max(200).nullable().optional(),documentDate:z.string().nullable().optional(),sourceType:z.enum(['Internet','Research','Assignment','Task','App2 Report','External Upload','App2 Upload']),sourceUrl:z.string().max(2000).default(''),originEntityId:z.string().uuid().nullable().optional(),directorate:z.string().max(160).nullable().optional(),documentType:z.string().min(2).max(100).default('Document'),subject:z.string().max(300).default(''),classification:z.enum(['PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED']).default('INTERNAL'),felixEnabled:z.boolean().default(false)})
const decodeHeader=value=>{const text=String(value||'');try{return decodeURIComponent(text)}catch{return text}}
const sanitizeReportHtml=value=>String(value||'').replace(/<(script|style|iframe|object|embed|form|svg|math)[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<(?!\/?(?:p|br|h[1-6]|strong|b|em|i|ul|ol|li)\b)[^>]*>/gi,'').replace(/\s[^\s=>]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'').replace(/<!--[\s\S]*?-->/g,'').trim()
const decodeTaskReportEntities=value=>String(value||'')
  .replace(/&#(\d+);/g,(_,code)=>{try{return String.fromCodePoint(Number(code))}catch{return ''}})
  .replace(/&#x([0-9a-f]+);/gi,(_,code)=>{try{return String.fromCodePoint(parseInt(code,16))}catch{return ''}})
  .replace(/&nbsp;/gi,' ')
  .replace(/&amp;/gi,'&')
  .replace(/&lt;/gi,'<')
  .replace(/&gt;/gi,'>')
  .replace(/&quot;/gi,'"')
  .replace(/&apos;|&#0*39;/gi,"'")
const plainTaskReportText=value=>decodeTaskReportEntities(String(value??'')
  .replace(/<\s*br\s*\/?\s*>/gi,'\n')
  .replace(/<\s*li\b[^>]*>/gi,'• ')
  .replace(/<\/\s*(?:p|div|li|h[1-6]|tr|section|article)\s*>/gi,'\n')
  .replace(/<[^>]+>/g,''))
  .replace(/\u00a0/g,' ')
  .replace(/\r/g,'')
  .replace(/[ \t]+\n/g,'\n')
  .replace(/\n[ \t]+/g,'\n')
  .replace(/[ \t]{2,}/g,' ')
  .replace(/\n{3,}/g,'\n\n')
  .trim()
const escapeContributionHtml=value=>String(value??'')
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;")
const contributionParagraphs=value=>{
  const text=String(value||'').trim()
  if(!text)return '<p class="empty">Not provided.</p>'
  return text.split(/\r?\n/).filter(Boolean).map(line=>`<p>${escapeContributionHtml(line)}</p>`).join('')
}
const buildTaskContributionReport=({task,assignment,ownerName,preparedBy,override={}})=>{
  const title=plainTaskReportText(override.contributionTitle??task.contribution_title)||`${task.title} — Contribution Report`
  const summary=plainTaskReportText(override.contributionSummary??task.contribution_summary)
  const findings=plainTaskReportText(override.contributionFindings??task.contribution_findings)
  const recommendations=plainTaskReportText(override.contributionRecommendations??task.contribution_recommendations)
  const evidenceReviewed=plainTaskReportText(override.evidenceReviewed??task.evidence_reviewed)
  const challenges=plainTaskReportText(override.contributionChallenges??task.contribution_challenges)
  const nextActions=plainTaskReportText(override.contributionNextActions??task.contribution_next_actions)
  const workNotes=plainTaskReportText(override.workNotes??task.notes)
  const generated=new Date()
  const generatedText=new Intl.DateTimeFormat('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'}).format(generated)
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>${escapeContributionHtml(title)}</title><style>
  *{box-sizing:border-box}body{margin:0;background:#eef1f3;color:#1f252a;font-family:Arial,Helvetica,sans-serif}
  .page{width:min(900px,calc(100% - 36px));margin:22px auto;background:#fff;box-shadow:0 10px 34px rgba(0,0,0,.12)}
  .head{background:#252a2f;color:#fff;padding:28px 34px;border-bottom:5px solid #c89b2c}.eyebrow{color:#e3bf5f;font-size:12px;font-weight:800;letter-spacing:.08em}
  h1{margin:7px 0 6px;font-size:28px}.sub{color:#cbd0d4;font-size:13px}
  .meta{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:#dfe3e6;border-bottom:1px solid #dfe3e6}.meta div{background:#f7f8f9;padding:12px 18px}
  .meta small{display:block;color:#697078;text-transform:uppercase;font-size:10px;font-weight:800;letter-spacing:.06em;margin-bottom:4px}.meta strong{font-size:13px}
  .body{padding:24px 34px 34px}.section{margin:0 0 24px}.section h2{font-size:16px;margin:0 0 9px;padding-bottom:7px;border-bottom:2px solid #e5e7e9;color:#2c3136}
  .section p{margin:6px 0;line-height:1.55;font-size:14px}.callout{padding:14px 16px;border-left:4px solid #c89b2c;background:#faf7ed}
  .empty{color:#899097;font-style:italic}.footer{padding:14px 34px;background:#f4f5f6;border-top:1px solid #e0e3e5;font-size:11px;color:#687078}
  @media print{body{background:#fff}.page{width:100%;margin:0;box-shadow:none}}
  </style></head><body><article class="page">
  <header class="head"><div class="eyebrow">APP2 · TASK CONTRIBUTION REPORT</div><h1>${escapeContributionHtml(title)}</h1><div class="sub">${escapeContributionHtml(task.title)}</div></header>
  <section class="meta">
    <div><small>Assignment</small><strong>${escapeContributionHtml(assignment?.title||'Current assignment')}</strong></div>
    <div><small>Assigned member</small><strong>${escapeContributionHtml(ownerName||'Unassigned')}</strong></div>
    <div><small>Exact assignment part</small><strong>${escapeContributionHtml(task.assignment_part||'Not yet specified')}</strong></div>
    <div><small>Feeds into output</small><strong>${escapeContributionHtml(task.target_document_title||'General Assignment Contribution')}</strong></div>
    <div><small>Target output section</small><strong>${escapeContributionHtml(task.target_section_title||'Not yet mapped')}</strong></div>
    <div><small>Prepared by</small><strong>${escapeContributionHtml(preparedBy||ownerName||'App2 user')}</strong></div>
    <div><small>Generated</small><strong>${escapeContributionHtml(generatedText)}</strong></div>
  </section>
  <main class="body">
    <section class="section"><h2>Task Purpose</h2><div class="callout">${contributionParagraphs(task.task_purpose||task.description)}</div></section>
    <section class="section"><h2>Instructions</h2>${contributionParagraphs(task.specific_instructions)}</section>
    <section class="section"><h2>Expected Contribution</h2><div class="callout">${contributionParagraphs(task.expected_contribution)}</div></section>
    <section class="section"><h2>Work Completed</h2>${contributionParagraphs(summary||workNotes)}</section>
    <section class="section"><h2>Evidence Reviewed</h2>${contributionParagraphs(evidenceReviewed)}</section>
    <section class="section"><h2>Key Findings</h2>${contributionParagraphs(findings)}</section>
    <section class="section"><h2>Challenges and Limitations</h2>${contributionParagraphs(challenges)}</section>
    <section class="section"><h2>Recommendations</h2>${contributionParagraphs(recommendations)}</section>
    <section class="section"><h2>Next Actions</h2>${contributionParagraphs(nextActions)}</section>
  </main>
  <footer class="footer">Generated by App2 from the task contribution record. Review this report before sending it for integration.</footer>
  </article></body></html>`
  return {title,html}
}
const canAccessAssignment=async(user,id)=>['Administrator','Research Manager'].includes(user.role)||(await query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[id,user.id])).rowCount>0
const canAccessResearch=async(user,id)=>['Administrator','Research Manager'].includes(user.role)||(await query('SELECT 1 FROM research_projects p WHERE p.id=$1 AND(p.lead_id=$2 OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=p.id AND rc.user_id=$2) OR EXISTS(SELECT 1 FROM research_reviewers rr WHERE rr.project_id=p.id AND rr.reviewer_id=$2 AND rr.active=TRUE))',[id,user.id])).rowCount>0
const canEditResearch=async(user,id)=>{
  if(['Administrator','Research Manager'].includes(user.role)) return true

  const result=await query(
    `SELECT 1
       FROM research_projects p
      WHERE p.id=$1
        AND (
          p.lead_id=$2
          OR EXISTS (
            SELECT 1
              FROM research_collaborators rc
             WHERE rc.project_id=p.id
               AND rc.user_id=$2
               AND COALESCE(rc.role, 'Researcher') <> 'Reviewer'
          )
        )`,
    [id,user.id]
  )

  return result.rowCount>0
}
const researchHasControlledEvidence=async id=>Boolean((await query(`SELECT 1
  FROM research_projects p
  WHERE p.id=$1
    AND (
      EXISTS(SELECT 1 FROM research_sources rs WHERE rs.project_id=p.id)
      OR EXISTS(
        SELECT 1
        FROM research_knowledge_links rkl
        JOIN knowledge_items k ON k.id=rkl.knowledge_item_id
        WHERE rkl.project_id=p.id AND k.status='Published' AND COALESCE(k.is_archived,FALSE)=FALSE
      )
    )
  LIMIT 1`,[id])).rowCount)
const knowledgeManagers=['Administrator','Research Manager']
const canManageKnowledge=user=>knowledgeManagers.includes(user.role)
const canReviewKnowledge=user=>[...knowledgeManagers,'Reviewer'].includes(user.role)
const activeExternalResearchForKnowledge=async knowledgeId=>(await query("SELECT id,status FROM external_research_imports WHERE knowledge_id=$1 AND status NOT IN('Published','Rejected')",[knowledgeId])).rows[0]||null
const canReadKnowledge=async(user,id)=>canReviewKnowledge(user)||(await query("SELECT 1 FROM knowledge_items k WHERE k.id=$1 AND(k.status='Published' OR k.created_by=$2 OR EXISTS(SELECT 1 FROM document_permissions p WHERE p.knowledge_id=k.id AND p.permission='READ' AND(p.user_id=$2 OR p.role=$3)))",[id,user.id,user.role])).rowCount>0
const canDownloadKnowledge=async(user,id)=>{
  if(canReviewKnowledge(user))return true
  const result=await query(`SELECT k.created_by,
    EXISTS(SELECT 1 FROM document_permissions p WHERE p.knowledge_id=k.id) has_rules,
    EXISTS(SELECT 1 FROM document_permissions p WHERE p.knowledge_id=k.id AND p.permission='DOWNLOAD' AND(p.user_id=$2 OR p.role=$3)) can_download
    FROM knowledge_items k WHERE k.id=$1`,[id,user.id,user.role])
  const item=result.rows[0]
  return Boolean(item&&(item.created_by===user.id||!item.has_rules||item.can_download))
}
const rejectDuplicateKnowledgeUpload=async(req,res,next)=>{try{if(!Buffer.isBuffer(req.body)||!req.body.length)return next();const incoming=crypto.createHash('sha256').update(req.body).digest('hex');const duplicate=(await query('SELECT v.id version_id,v.version_number,v.created_at upload_date,k.id document_id,k.title FROM knowledge_versions v JOIN knowledge_items k ON k.id=v.knowledge_id WHERE v.sha256_hash=$1 LIMIT 1',[incoming])).rows[0];if(duplicate)return res.status(409).json({error:`This exact file is already stored as “${duplicate.title}” (version ${duplicate.version_number}).`,duplicate:{...duplicate,sha256_hash:incoming}});const candidates=(await query('SELECT v.stored_name,v.storage_path,v.version_number,v.id version_id,v.created_at upload_date,k.id document_id,k.title FROM knowledge_versions v JOIN knowledge_items k ON k.id=v.knowledge_id WHERE v.sha256_hash IS NULL AND v.size_bytes=$1',[req.body.length])).rows;for(const candidate of candidates){try{const bytes=await fs.readFile(resolveDocumentPath(candidate.storage_path||candidate.stored_name));if(crypto.createHash('sha256').update(bytes).digest('hex')===incoming)return res.status(409).json({error:`This exact file is already stored as “${candidate.title}” (version ${candidate.version_number}).`,duplicate:{...candidate,sha256_hash:incoming}})}catch{}}req.documentHash=incoming;next()}catch(error){next(error)}}
app.post('/api/knowledge',authenticate,rejectDuplicateKnowledgeUpload)
app.post('/api/knowledge/:id/versions',authenticate,rejectDuplicateKnowledgeUpload)
app.get('/api/knowledge/versions/:versionId/download',authenticate,async(req,res,next)=>{try{const row=(await query('SELECT knowledge_id FROM knowledge_versions WHERE id=$1',[req.params.versionId])).rows[0];if(!row)return res.status(404).json({error:'Document version not found.'});if(!await canDownloadKnowledge(req.user,row.knowledge_id))return res.status(403).json({error:'You do not have download permission for this document.'});next()}catch(error){next(error)}})
app.delete('/api/knowledge/:id',authenticate,(_req,res)=>res.status(405).json({error:'Direct deletion is disabled. Submit a deletion request for manager approval.'}))

app.get('/api/health',async(_req,res,next)=>{try{await query('SELECT 1');res.json({status:'healthy',service:'psc-app2-api',database:'connected'})}catch(error){next(error)}})
app.get('/api/reports',authenticate,async(req,res,next)=>{try{res.json(await reportCatalogue(req.user))}catch(error){next(error)}})
app.get('/api/reports/categories',authenticate,(_req,res)=>res.json(reportCategories()))
app.get('/api/reports-summary',authenticate,async(req,res,next)=>{try{res.json(await reportSummary(req.user))}catch(error){next(error)}})
app.get('/api/reports/:key',authenticate,async(req,res,next)=>{try{const catalogue=await reportCatalogue(req.user);const item=catalogue.find(report=>report.key===req.params.key);if(!item)return res.status(404).json({error:'Report not found or unavailable to your role.'});res.json(item)}catch(error){next(error)}})
app.get('/api/reports/:key/data',authenticate,async(req,res,next)=>{try{const result=await reportData(req.user,req.params.key,req.query);await auditReportAccess(req.user,req.params.key);res.json(result)}catch(error){if(error.auditDenied)await auditReportAccess(req.user,req.params.key,true).catch(()=>{});next(error)}})
app.post('/api/reports/:key/favourite',authenticate,async(req,res,next)=>{try{res.json(await setFavourite(req.user,req.params.key,true))}catch(error){next(error)}})
app.delete('/api/reports/:key/favourite',authenticate,async(req,res,next)=>{try{res.json(await setFavourite(req.user,req.params.key,false))}catch(error){next(error)}})
app.get('/api/report-schedules',authenticate,async(req,res,next)=>{try{const all=req.user.role==='Administrator';res.json((await query(`SELECT * FROM report_schedules WHERE $1 OR owner_id=$2 ORDER BY enabled DESC,next_run_at`,[all,req.user.id])).rows)}catch(error){next(error)}})
app.post('/api/report-schedules',authenticate,validate(z.object({reportKey:z.string().min(2).max(100),name:z.string().min(2).max(120),format:z.enum(['pdf','docx','xlsx']),frequency:z.enum(['Daily','Weekly','Monthly']),recipientEmails:z.array(z.string().email()).min(1).max(20),filters:z.record(z.string(),z.union([z.string(),z.number(),z.boolean()])).default({}),nextRunAt:z.string().datetime()})),async(req,res,next)=>{try{if(!reportPermissions(req.user).includes('GENERATE_REPORTS')&&!reportPermissions(req.user).includes('EXPORT_REPORTS'))return res.status(403).json({error:'You cannot schedule reports.'});const v=req.validated,row=(await query('INSERT INTO report_schedules(owner_id,report_key,name,format,frequency,recipient_emails,filters,next_run_at)VALUES($1,$2,$3,$4,$5,$6,$7,$8)RETURNING *',[req.user.id,v.reportKey,v.name,v.format,v.frequency,v.recipientEmails,v.filters,v.nextRunAt])).rows[0];res.status(201).json(row)}catch(error){next(error)}})
app.patch('/api/report-schedules/:id',authenticate,validate(z.object({enabled:z.boolean()})),async(req,res,next)=>{try{const admin=req.user.role==='Administrator',row=(await query('UPDATE report_schedules SET enabled=$1,updated_at=NOW() WHERE id=$2 AND($3 OR owner_id=$4)RETURNING *',[req.validated.enabled,req.params.id,admin,req.user.id])).rows[0];if(!row)return res.status(404).json({error:'Schedule not found.'});res.json(row)}catch(error){next(error)}})
app.delete('/api/report-schedules/:id',authenticate,async(req,res,next)=>{try{const removed=await query('DELETE FROM report_schedules WHERE id=$1 AND($2 OR owner_id=$3)RETURNING id',[req.params.id,req.user.role==='Administrator',req.user.id]);if(!removed.rowCount)return res.status(404).json({error:'Schedule not found.'});res.json({id:req.params.id})}catch(error){next(error)}})
app.get('/api/reports/:key/decisions',authenticate,authorize('Administrator','Research Manager'),async(req,res,next)=>{try{res.json((await query('SELECT d.*,u.name created_by_name,ru.name resolved_by_name FROM report_decisions d JOIN users u ON u.id=d.created_by LEFT JOIN users ru ON ru.id=d.resolved_by WHERE report_key=$1 ORDER BY status,created_at DESC',[req.params.key])).rows)}catch(error){next(error)}})
app.post('/api/reports/:key/decisions',authenticate,authorize('Administrator','Research Manager'),validate(z.object({title:z.string().min(3).max(240),decision:z.string().min(3).max(5000),filters:z.record(z.string(),z.union([z.string(),z.number(),z.boolean()])).default({}),dueDate:z.string().nullable().default(null)})),async(req,res,next)=>{try{const v=req.validated,row=(await query('INSERT INTO report_decisions(report_key,title,decision,filters,due_date,created_by)VALUES($1,$2,$3,$4,$5,$6)RETURNING *',[req.params.key,v.title,v.decision,v.filters,v.dueDate,req.user.id])).rows[0];res.status(201).json(row)}catch(error){next(error)}})
app.patch('/api/reports/:key/decisions/:id/resolve',authenticate,authorize('Administrator','Research Manager'),async(req,res,next)=>{try{const row=(await query("UPDATE report_decisions SET status='Resolved',resolved_by=$1,resolved_at=NOW() WHERE id=$2 AND report_key=$3 RETURNING *",[req.user.id,req.params.id,req.params.key])).rows[0];if(!row)return res.status(404).json({error:'Decision not found.'});res.json(row)}catch(error){next(error)}})
app.post('/api/reports/:key/signoff',authenticate,authorize('Administrator','Research Manager'),validate(z.object({filters:z.record(z.string(),z.union([z.string(),z.number(),z.boolean()])).default({}),comments:z.string().max(4000).default('')})),async(req,res,next)=>{try{const result=await reportData(req.user,req.params.key,{...req.validated.filters,page:1,pageSize:100}),snapshot={title:result.report.title,period:result.period,kpis:result.kpis,rows:result.rows,generatedAt:result.generatedAt},hash=crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),row=(await query('INSERT INTO report_signoffs(report_key,filters,report_snapshot,report_hash,signed_by,comments)VALUES($1,$2,$3,$4,$5,$6)RETURNING *',[req.params.key,req.validated.filters,snapshot,hash,req.user.id,req.validated.comments])).rows[0];res.status(201).json(row)}catch(error){next(error)}})
app.get('/api/reports/:key/signoffs',authenticate,async(req,res,next)=>{try{res.json((await query('SELECT s.id,s.report_key,s.report_hash,s.status,s.signed_at,s.comments,u.name signed_by_name FROM report_signoffs s JOIN users u ON u.id=s.signed_by WHERE s.report_key=$1 ORDER BY s.signed_at DESC LIMIT 50',[req.params.key])).rows)}catch(error){next(error)}})
app.patch('/api/admin/report-definitions/:key',authenticate,authorize('Administrator'),validate(z.object({enabled:z.boolean(),accessNote:z.string().max(1000).default('')})),async(req,res,next)=>{try{const row=(await query('INSERT INTO report_definition_overrides(report_key,enabled,access_note,updated_by)VALUES($1,$2,$3,$4)ON CONFLICT(report_key)DO UPDATE SET enabled=EXCLUDED.enabled,access_note=EXCLUDED.access_note,updated_by=EXCLUDED.updated_by,updated_at=NOW()RETURNING *',[req.params.key,req.validated.enabled,req.validated.accessNote,req.user.id])).rows[0];res.json(row)}catch(error){next(error)}})
app.get('/api/admin/report-monitoring',authenticate,authorize('Administrator'),async(_req,res,next)=>{try{const [exports,schedules,failures,signoffs]=await Promise.all([query("SELECT COUNT(*)::int total,COUNT(*)FILTER(WHERE created_at>=NOW()-INTERVAL '24 hours')::int recent FROM report_exports"),query("SELECT COUNT(*)::int total,COUNT(*)FILTER(WHERE enabled)::int enabled,COUNT(*)FILTER(WHERE last_status='Failed')::int failed FROM report_schedules"),query("SELECT report_key,format,created_at FROM report_exports ORDER BY created_at DESC LIMIT 20"),query("SELECT COUNT(*)::int total FROM report_signoffs WHERE status='Signed Off'")]);res.json({exports:exports.rows[0],schedules:schedules.rows[0],recentExports:failures.rows,signoffs:signoffs.rows[0].total,mail:mailStatus()})}catch(error){next(error)}})
app.get('/api/reports/:key/views',authenticate,async(req,res,next)=>{try{res.json(await reportViews(req.user,req.params.key))}catch(error){next(error)}})
app.post('/api/reports/:key/views',authenticate,validate(z.object({name:z.string().min(1).max(120),filters:z.record(z.string(),z.union([z.string(),z.number(),z.boolean()])).default({}),isDefault:z.boolean().default(false)})),async(req,res,next)=>{try{res.status(201).json(await saveReportView(req.user,req.params.key,req.validated))}catch(error){next(error)}})
app.delete('/api/reports/:key/views/:id',authenticate,async(req,res,next)=>{try{res.json(await deleteReportView(req.user,req.params.key,req.params.id))}catch(error){next(error)}})
app.get('/api/reports/:key/export',authenticate,async(req,res,next)=>{try{if(!reportPermissions(req.user).includes('EXPORT_REPORTS'))return res.status(403).json({error:'You do not have permission to export reports.'});const format=String(req.query.format||'pdf').toLowerCase();const result=await reportData(req.user,req.params.key,{...req.query,page:1,pageSize:100});if(!result.available)return res.status(409).json({error:result.notices?.[0]||'Report is unavailable.'});const rendered=await renderReportExport(format,result.exportModel);await recordReportExport(req.user,req.params.key,format,result.filters,result.rows.length);const safe=result.report.title.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();res.setHeader('Content-Type',rendered.type);res.setHeader('Content-Disposition',`attachment; filename="${safe}.${rendered.extension}"`);res.send(rendered.buffer)}catch(error){next(error)}})
app.post('/api/auth/login',validate(loginSchema),async(req,res,next)=>{try{const result=await query('SELECT id,name,email,password_hash,role,division,status,active,token_version,must_change_password FROM users WHERE lower(email)=lower($1)',[req.validated.email]);const user=result.rows[0];if(!user||!user.active||!await bcrypt.compare(req.validated.password,user.password_hash)){await query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)VALUES($1,'LOGIN_FAILED','session',$2,$3)",[user?.id||null,user?.id||null,JSON.stringify({email:req.validated.email})]);return res.status(401).json({error:'Login unsuccessful. Verify your official PSC email and password. If the problem continues, recover your password or ask an administrator to confirm that your account is active.'})}delete user.password_hash;await query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)VALUES($1::uuid,'LOGIN_SUCCEEDED','session',$1::uuid::text,$2)",[user.id,JSON.stringify({email:user.email,role:user.role})]);res.json({token:createToken(user),user})}catch(error){next(error)}})
app.get('/api/auth/me',authenticate,(req,res)=>res.json(req.user))
app.post('/api/auth/logout',authenticate,async(req,res,next)=>{try{await transaction(async client=>{await client.query('UPDATE users SET token_version=token_version+1,updated_at=NOW() WHERE id=$1',[req.user.id]);await audit(client,req.user.id,'LOGOUT','session',req.user.id,{})});res.status(204).end()}catch(error){next(error)}})
app.post('/api/auth/change-password',authenticate,validate(z.object({currentPassword:z.string().min(8).max(128),newPassword:passwordSchema})),async(req,res,next)=>{try{const current=(await query('SELECT password_hash FROM users WHERE id=$1',[req.user.id])).rows[0];if(!current||!await bcrypt.compare(req.validated.currentPassword,current.password_hash))return res.status(400).json({error:'The current password is incorrect.'});if(await bcrypt.compare(req.validated.newPassword,current.password_hash))return res.status(400).json({error:'Choose a password different from the current password.'});const hash=await bcrypt.hash(req.validated.newPassword,12);const updated=(await query('UPDATE users SET password_hash=$1,must_change_password=FALSE,token_version=token_version+1,updated_at=NOW() WHERE id=$2 RETURNING id,name,email,role,division,status,token_version,must_change_password',[hash,req.user.id])).rows[0];res.json({token:createToken(updated),user:updated})}catch(error){next(error)}})
app.post('/api/auth/forgot-password',validate(z.object({email:z.string().email().max(255)})),async(req,res,next)=>{try{const user=(await query('SELECT id FROM users WHERE lower(email)=lower($1) AND active=TRUE',[req.validated.email])).rows[0];let resetToken;if(user){resetToken=crypto.randomBytes(32).toString('hex');const tokenHash=crypto.createHash('sha256').update(resetToken).digest('hex');await transaction(async client=>{await client.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL',[user.id]);await client.query("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 minutes')",[user.id,tokenHash])})}const response={message:'If the account exists, password reset instructions have been prepared.'};if(config.environment!=='production'&&resetToken)response.resetToken=resetToken;res.json(response)}catch(error){next(error)}})
app.post('/api/auth/reset-password',validate(z.object({token:z.string().length(64),newPassword:passwordSchema})),async(req,res,next)=>{try{const tokenHash=crypto.createHash('sha256').update(req.validated.token).digest('hex');const result=await transaction(async client=>{const reset=(await client.query('SELECT id,user_id FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW() FOR UPDATE',[tokenHash])).rows[0];if(!reset)return null;const hash=await bcrypt.hash(req.validated.newPassword,12);await client.query('UPDATE users SET password_hash=$1,token_version=token_version+1,updated_at=NOW() WHERE id=$2',[hash,reset.user_id]);await client.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE id=$1',[reset.id]);return true});if(!result)return res.status(400).json({error:'This password reset link is invalid or has expired.'});res.json({message:'Password updated. You can now sign in.'})}catch(error){next(error)}})

app.get('/api/users',authenticate,authorize('Administrator','Research Manager'),async(_req,res,next)=>{try{const result=await query(`SELECT u.id,u.name,u.email,u.role,u.division,u.status,u.active,COUNT(am.assignment_id) FILTER(WHERE a.status!='Completed')::int active_assignments,COUNT(am.assignment_id) FILTER(WHERE a.status='Completed')::int completed_assignments FROM users u LEFT JOIN assignment_members am ON am.user_id=u.id LEFT JOIN assignments a ON a.id=am.assignment_id GROUP BY u.id ORDER BY u.name`);res.json(result.rows)}catch(error){next(error)}})
app.post('/api/users',authenticate,authorize('Administrator'),validate(z.object({name:z.string().min(3).max(160),email:z.string().email().max(255),role:z.enum(roles),division:z.string().min(2).max(160),temporaryPassword:passwordSchema.optional()})),async(req,res,next)=>{try{const temporaryPassword=req.validated.temporaryPassword||`Psc!${crypto.randomBytes(6).toString('base64url')}9`;const passwordHash=await bcrypt.hash(temporaryPassword,12);const created=await transaction(async client=>{const row=(await client.query('INSERT INTO users(name,email,password_hash,role,division,must_change_password) VALUES($1,lower($2),$3,$4,$5,TRUE) RETURNING id,name,email,role,division,status,active,must_change_password',[req.validated.name.trim(),req.validated.email.trim(),passwordHash,req.validated.role,req.validated.division.trim()])).rows[0];await audit(client,req.user.id,'USER_CREATED','user',row.id,{email:row.email,role:row.role,division:row.division});return row});res.status(201).json({...created,temporary_password:temporaryPassword})}catch(error){if(error.code==='23505')return res.status(409).json({error:'An account already exists for this email address.'});next(error)}})
app.patch('/api/users/:id',authenticate,authorize('Administrator'),validate(z.object({name:z.string().min(3).max(160),email:z.string().email().max(255),role:z.enum(roles),division:z.string().min(2).max(160),status:z.enum(['Available','Busy','Away']),active:z.boolean()})),async(req,res,next)=>{try{const updated=await transaction(async client=>{const current=(await client.query('SELECT role,active FROM users WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!current)return {kind:'missing'};const removesAdministrator=current.role==='Administrator'&&(req.validated.role!=='Administrator'||!req.validated.active);if(removesAdministrator){const count=Number((await client.query("SELECT COUNT(*) total FROM users WHERE role='Administrator' AND active=TRUE")).rows[0].total);if(count<=1)return {kind:'last-admin'}}const row=(await client.query('UPDATE users SET name=$1,email=lower($2),role=$3,division=$4,status=$5,active=$6,token_version=CASE WHEN active<>$6 THEN token_version+1 ELSE token_version END,updated_at=NOW() WHERE id=$7 RETURNING id,name,email,role,division,status,active,must_change_password',[req.validated.name.trim(),req.validated.email.trim(),req.validated.role,req.validated.division.trim(),req.validated.status,req.validated.active,req.params.id])).rows[0];await audit(client,req.user.id,'USER_UPDATED','user',row.id,{role:row.role,division:row.division,status:row.status,active:row.active});return {kind:'updated',row}});if(updated.kind==='missing')return res.status(404).json({error:'Member not found.'});if(updated.kind==='last-admin')return res.status(409).json({error:'The final active administrator cannot be demoted or deactivated.'});res.json(updated.row)}catch(error){if(error.code==='23505')return res.status(409).json({error:'That email address is already in use.'});next(error)}})
app.patch('/api/users/:id/role',authenticate,authorize('Administrator'),validate(z.object({role:z.enum(roles)})),async(req,res,next)=>{try{const updated=await transaction(async client=>{const current=(await client.query('SELECT role FROM users WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!current)return {kind:'missing'};if(current.role==='Administrator'&&req.validated.role!=='Administrator'){const count=Number((await client.query("SELECT COUNT(*) total FROM users WHERE role='Administrator' AND active=TRUE")).rows[0].total);if(count<=1)return {kind:'last-admin'}}const row=(await client.query('UPDATE users SET role=$1,updated_at=NOW() WHERE id=$2 RETURNING id,name,email,role,division,status,active',[req.validated.role,req.params.id])).rows[0];await audit(client,req.user.id,'ROLE_CHANGED','user',req.params.id,req.validated);return {kind:'updated',row}});if(updated.kind==='missing')return res.status(404).json({error:'Member not found.'});if(updated.kind==='last-admin')return res.status(409).json({error:'The final active administrator cannot be demoted.'});res.json(updated.row)}catch(error){next(error)}})
app.post('/api/users/:id/reset-password',authenticate,authorize('Administrator'),async(req,res,next)=>{try{const temporaryPassword=`Psc!${crypto.randomBytes(6).toString('base64url')}9`;const hash=await bcrypt.hash(temporaryPassword,12);const updated=await transaction(async client=>{const row=(await client.query('UPDATE users SET password_hash=$1,must_change_password=TRUE,token_version=token_version+1,updated_at=NOW() WHERE id=$2 RETURNING id,name,email',[hash,req.params.id])).rows[0];if(row)await audit(client,req.user.id,'USER_PASSWORD_RESET','user',row.id,{email:row.email});return row});if(!updated)return res.status(404).json({error:'Member not found.'});res.json({message:'Temporary password created. Existing sessions were ended.',temporaryPassword})}catch(error){next(error)}})

app.get('/api/assignments',authenticate,async(req,res,next)=>{try{const all=['Administrator','Research Manager'].includes(req.user.role);const result=await query(`SELECT a.*,creator.name created_by_name,ral.project_id research_id,rp.title research_title,ral.relation_type research_relation_type,COALESCE(json_agg(json_build_object('id',u.id,'name',u.name,'role',am.member_role)) FILTER(WHERE u.id IS NOT NULL),'[]') members FROM assignments a JOIN users creator ON creator.id=a.created_by LEFT JOIN assignment_members am ON am.assignment_id=a.id LEFT JOIN users u ON u.id=am.user_id LEFT JOIN research_assignment_links ral ON ral.assignment_id=a.id LEFT JOIN research_projects rp ON rp.id=ral.project_id WHERE $1::boolean OR EXISTS(SELECT 1 FROM assignment_members mine WHERE mine.assignment_id=a.id AND mine.user_id=$2) GROUP BY a.id,creator.name,ral.project_id,rp.title,ral.relation_type ORDER BY a.created_at DESC`,[all,req.user.id]);res.json(result.rows)}catch(error){next(error)}})
app.post('/api/assignments',authenticate,authorize('Administrator','Research Manager'),validate(assignmentSchema),async(req,res,next)=>{try{const created=await transaction(async client=>{const {title,description,division,dueDate,priority,memberIds}=req.validated;const result=await client.query('INSERT INTO assignments(title,description,division,due_date,priority,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[title,description,division,dueDate||null,priority,req.user.id]);for(const id of memberIds)await client.query('INSERT INTO assignment_members(assignment_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[result.rows[0].id,id]);if(memberIds.length)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT id,'New assignment',$1,'assignment',$2 FROM users WHERE id=ANY($3::uuid[]) AND active=TRUE",[`You have been assigned “${title}”${dueDate?` due ${dueDate}`:''}.`,result.rows[0].id,memberIds]);await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details) VALUES($1,$2,$3,$4)',[result.rows[0].id,req.user.id,'CREATED',JSON.stringify({title,memberIds})]);await audit(client,req.user.id,'ASSIGNMENT_CREATED','assignment',result.rows[0].id,{title,memberIds});return result.rows[0]});res.status(201).json(created)}catch(error){next(error)}})
app.patch('/api/assignments/:id',authenticate,authorize('Administrator','Research Manager'),validate(assignmentSchema.omit({memberIds:true})),async(req,res,next)=>{try{const {title,description,division,dueDate,priority}=req.validated;const result=await transaction(async client=>{const updated=(await client.query('UPDATE assignments SET title=$1,description=$2,division=$3,due_date=$4,priority=$5,updated_at=NOW() WHERE id=$6 RETURNING *',[title,description,division,dueDate||null,priority,req.params.id])).rows[0];if(updated)await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details) VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'UPDATED',JSON.stringify({title,division,dueDate,priority})]);return updated});if(!result)return res.status(404).json({error:'Assignment not found.'});res.json(result)}catch(error){next(error)}})
app.delete('/api/assignments/:id',authenticate,authorize('Administrator','Research Manager'),async(req,res,next)=>{try{const files=(await query('SELECT stored_name FROM assignment_attachments WHERE assignment_id=$1',[req.params.id])).rows;const result=await query('DELETE FROM assignments WHERE id=$1 RETURNING id',[req.params.id]);if(!result.rowCount)return res.status(404).json({error:'Assignment not found.'});await Promise.all(files.map(file=>fs.unlink(path.resolve(config.uploadDir,file.stored_name)).catch(()=>{})));res.status(204).end()}catch(error){next(error)}})
app.patch('/api/assignments/:id/status',authenticate,validate(z.object({status:z.enum(['Not Started','In Progress','Ready for Review','Completed','Overdue'])})),async(req,res,next)=>{try{if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You are not assigned to this work.'});if(req.validated.status==='Completed'&&!['Administrator','Research Manager','Reviewer'].includes(req.user.role))return res.status(403).json({error:'Only a reviewer or manager can approve completed work.'});const result=await transaction(async client=>{const updated=(await client.query('UPDATE assignments SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',[req.validated.status,req.params.id])).rows[0];if(updated)await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details) VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,req.validated.status==='Completed'?'APPROVED':'STATUS_CHANGED',JSON.stringify({status:req.validated.status})]);if(updated&&req.validated.status==='Completed')await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT DISTINCT user_id,'Assignment completed',$1,'assignment_completed',$2 FROM assignment_members WHERE assignment_id=$2",[`“${updated.title}” has been marked completed.`,updated.id]);return updated});if(!result)return res.status(404).json({error:'Assignment not found.'});res.json(result)}catch(error){next(error)}})
app.post('/api/assignments/:id/members',authenticate,authorize('Administrator','Research Manager'),validate(z.object({userId:z.string().uuid(),memberRole:z.enum(['Lead','Contributor','Reviewer']).default('Contributor')})),async(req,res,next)=>{try{await transaction(async client=>{await client.query('INSERT INTO assignment_members(assignment_id,user_id,member_role) VALUES($1,$2,$3) ON CONFLICT(assignment_id,user_id) DO UPDATE SET member_role=EXCLUDED.member_role',[req.params.id,req.validated.userId,req.validated.memberRole]);const assignment=(await client.query('SELECT title,due_date FROM assignments WHERE id=$1',[req.params.id])).rows[0];if(assignment)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'Assignment allocated',$2,'assignment',$3)",[req.validated.userId,`You were added to “${assignment.title}” as ${req.validated.memberRole}${assignment.due_date?` (due ${assignment.due_date})`:''}.`,req.params.id]);await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details) VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'MEMBER_ASSIGNED',JSON.stringify(req.validated)])});res.status(204).end()}catch(error){next(error)}})
app.get('/api/assignments/:id/sections',authenticate,async(req,res,next)=>{try{if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot view this assignment structure.'});res.json((await query(`SELECT s.*,lead.name lead_name,creator.name created_by_name
FROM assignment_sections s
LEFT JOIN users lead ON lead.id=s.lead_id
JOIN users creator ON creator.id=s.created_by
WHERE s.assignment_id=$1 AND s.archived_at IS NULL
ORDER BY s.section_order,s.created_at`,[req.params.id])).rows)}catch(error){next(error)}})
app.post('/api/assignments/:id/sections',authenticate,authorize('Administrator','Research Manager'),validate(assignmentSectionSchema),async(req,res,next)=>{try{const v=req.validated;const created=await transaction(async client=>{const assignment=(await client.query('SELECT id FROM assignments WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!assignment)throw Object.assign(new Error('Assignment not found.'),{statusCode:404});if(v.leadId&&!await client.query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[req.params.id,v.leadId]).then(result=>result.rowCount))throw Object.assign(new Error('Section lead must be a member of this assignment.'),{statusCode:400});const sectionOrder=Number((await client.query('SELECT COALESCE(MAX(section_order),0)+1 next_order FROM assignment_sections WHERE assignment_id=$1 AND archived_at IS NULL',[req.params.id])).rows[0].next_order);const row=(await client.query(`INSERT INTO assignment_sections(assignment_id,title,description,section_order,lead_id,start_date,due_date,status,progress,is_mandatory,created_by)
VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[req.params.id,v.title,v.description,sectionOrder,v.leadId,v.startDate,v.dueDate,v.status,v.progress,v.isMandatory,req.user.id])).rows[0];await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'SECTION_CREATED',JSON.stringify({sectionId:row.id,title:row.title,sectionOrder})]);await audit(client,req.user.id,'ASSIGNMENT_SECTION_CREATED','assignment_section',row.id,{assignmentId:req.params.id,title:row.title,sectionOrder});return row});res.status(201).json(created)}catch(error){next(error)}})
app.post('/api/assignments/:id/sections/starter',authenticate,authorize('Administrator','Research Manager'),async(req,res,next)=>{try{const titles=['Background & Context','Current State Assessment','Stakeholder Engagement','Technical Assessment','Risks & Constraints','Findings','Recommendations','Implementation Plan'];const rows=await transaction(async client=>{const assignment=(await client.query('SELECT id FROM assignments WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!assignment)throw Object.assign(new Error('Assignment not found.'),{statusCode:404});const existing=Number((await client.query('SELECT COUNT(*) total FROM assignment_sections WHERE assignment_id=$1 AND archived_at IS NULL',[req.params.id])).rows[0].total);if(existing)throw Object.assign(new Error('Starter Structure is available only when the assignment has no active sections.'),{statusCode:409});const created=[];for(const [index,title] of titles.entries())created.push((await client.query(`INSERT INTO assignment_sections(assignment_id,title,section_order,created_by)VALUES($1,$2,$3,$4)RETURNING *`,[req.params.id,title,index+1,req.user.id])).rows[0]);await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'STARTER_STRUCTURE_CREATED',JSON.stringify({sectionIds:created.map(section=>section.id),titles})]);await audit(client,req.user.id,'ASSIGNMENT_STARTER_STRUCTURE_CREATED','assignment',req.params.id,{sections:titles});return created});res.status(201).json(rows)}catch(error){next(error)}})
app.patch('/api/assignments/:id/sections/reorder',authenticate,authorize('Administrator','Research Manager'),validate(assignmentSectionReorderSchema),async(req,res,next)=>{try{const rows=await transaction(async client=>{const active=(await client.query('SELECT id FROM assignment_sections WHERE assignment_id=$1 AND archived_at IS NULL FOR UPDATE',[req.params.id])).rows.map(row=>row.id);if(active.length!==req.validated.length||active.some(id=>!req.validated.some(item=>item.id===id)))throw Object.assign(new Error('Reorder must include every active assignment section exactly once.'),{statusCode:400});for(const item of req.validated)await client.query('UPDATE assignment_sections SET section_order=$1,updated_at=NOW() WHERE id=$2 AND assignment_id=$3',[item.sectionOrder,item.id,req.params.id]);await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'SECTIONS_REORDERED',JSON.stringify({order:req.validated})]);await audit(client,req.user.id,'ASSIGNMENT_SECTIONS_REORDERED','assignment',req.params.id,{order:req.validated});return (await client.query(`SELECT s.*,lead.name lead_name,creator.name created_by_name FROM assignment_sections s LEFT JOIN users lead ON lead.id=s.lead_id JOIN users creator ON creator.id=s.created_by WHERE s.assignment_id=$1 AND s.archived_at IS NULL ORDER BY s.section_order,s.created_at`,[req.params.id])).rows});res.json(rows)}catch(error){next(error)}})
app.patch('/api/assignments/:id/sections/:sectionId',authenticate,validate(assignmentSectionUpdateSchema),async(req,res,next)=>{try{if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot update this assignment section.'});const manager=['Administrator','Research Manager'].includes(req.user.role);const keys=Object.keys(req.body||{});const row=await transaction(async client=>{const current=(await client.query('SELECT * FROM assignment_sections WHERE id=$1 AND assignment_id=$2 AND archived_at IS NULL FOR UPDATE',[req.params.sectionId,req.params.id])).rows[0];if(!current)throw Object.assign(new Error('Assignment section not found.'),{statusCode:404});if(!manager&&(current.lead_id!==req.user.id||keys.some(key=>!['status','progress'].includes(key))))throw Object.assign(new Error('Only a manager may change section structure. The section lead may update status and progress.'),{statusCode:403});const next={title:req.validated.title??current.title,description:req.validated.description??current.description,leadId:req.validated.leadId===undefined?current.lead_id:req.validated.leadId,startDate:req.validated.startDate===undefined?current.start_date:req.validated.startDate,dueDate:req.validated.dueDate===undefined?current.due_date:req.validated.dueDate,status:req.validated.status??current.status,progress:req.validated.progress??current.progress,isMandatory:req.validated.isMandatory??current.is_mandatory};if(next.startDate&&next.dueDate&&String(next.dueDate)<String(next.startDate))throw Object.assign(new Error('Due date cannot be before the start date.'),{statusCode:400});if(next.leadId&&!await client.query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[req.params.id,next.leadId]).then(result=>result.rowCount))throw Object.assign(new Error('Section lead must be a member of this assignment.'),{statusCode:400});const updated=(await client.query(`UPDATE assignment_sections SET title=$1,description=$2,lead_id=$3,start_date=$4,due_date=$5,status=$6,progress=$7,is_mandatory=$8,updated_at=NOW() WHERE id=$9 RETURNING *`,[next.title,next.description,next.leadId,next.startDate,next.dueDate,next.status,next.progress,next.isMandatory,current.id])).rows[0];await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'SECTION_UPDATED',JSON.stringify({sectionId:updated.id,title:updated.title,status:updated.status,progress:updated.progress})]);await audit(client,req.user.id,'ASSIGNMENT_SECTION_UPDATED','assignment_section',updated.id,{assignmentId:req.params.id,status:updated.status,progress:updated.progress});return updated});res.json(row)}catch(error){next(error)}})
app.post('/api/assignments/:id/sections/:sectionId/archive',authenticate,authorize('Administrator','Research Manager'),async(req,res,next)=>{try{const archived=await transaction(async client=>{const row=(await client.query('UPDATE assignment_sections SET archived_at=NOW(),archived_by=$1,updated_at=NOW() WHERE id=$2 AND assignment_id=$3 AND archived_at IS NULL RETURNING *',[req.user.id,req.params.sectionId,req.params.id])).rows[0];if(!row)throw Object.assign(new Error('Assignment section not found.'),{statusCode:404});await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'SECTION_ARCHIVED',JSON.stringify({sectionId:row.id,title:row.title})]);await audit(client,req.user.id,'ASSIGNMENT_SECTION_ARCHIVED','assignment_section',row.id,{assignmentId:req.params.id,title:row.title});return row});res.json(archived)}catch(error){next(error)}})
app.get('/api/assignments/:id/tasks',authenticate,async(req,res,next)=>{try{if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot view tasks for this assignment.'});res.json((await query(`SELECT t.*,u.name owner_name,reviewer.name reviewer_name,gd.title target_document_title,gds.title target_section_title,assignment_section.title assignment_section_title,
repo.id repository_document_id,repo.title repository_document_title,repo.created_at repository_document_created_at
FROM assignment_tasks t
LEFT JOIN users u ON u.id=t.owner_id
LEFT JOIN users reviewer ON reviewer.id=t.reviewer_id
LEFT JOIN generated_documents gd ON gd.id=t.target_document_id
LEFT JOIN generated_document_sections gds ON gds.id=t.target_section_id
LEFT JOIN assignment_sections assignment_section ON assignment_section.id=t.assignment_section_id
LEFT JOIN LATERAL(
  SELECT k.id,k.title,k.created_at
  FROM repository_entity_links rel
  JOIN knowledge_items k ON k.id=rel.knowledge_id
  WHERE rel.entity_type='task' AND rel.entity_id=t.id
    AND k.document_type='Task Final Report' AND k.status='Published' AND k.is_archived=FALSE
  ORDER BY k.created_at DESC LIMIT 1
) repo ON TRUE
WHERE t.assignment_id=$1 AND t.archived_at IS NULL
ORDER BY t.created_at`,[req.params.id])).rows)}catch(error){next(error)}})
app.post('/api/assignments/:id/tasks',authenticate,authorize('Administrator','Research Manager'),validate(assignmentTaskSchema),async(req,res,next)=>{try{const v=req.validated;const row=await transaction(async client=>{if(v.ownerId){
  const member=(await client.query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[req.params.id,v.ownerId])).rowCount
  if(!member)throw Object.assign(new Error('Selected task owner is not a member of this assignment.'),{statusCode:400})
}
if(v.targetDocumentId){
  const document=(await client.query("SELECT 1 FROM generated_documents WHERE id=$1 AND context='Assignment' AND context_id=$2",[v.targetDocumentId,req.params.id])).rowCount
  if(!document)throw Object.assign(new Error('Selected contribution output does not belong to this assignment.'),{statusCode:400})
}
if(v.targetSectionId){
  const section=(await client.query('SELECT 1 FROM generated_document_sections WHERE id=$1 AND document_id=$2',[v.targetSectionId,v.targetDocumentId])).rowCount
  if(!section)throw Object.assign(new Error('Selected contribution section does not belong to the chosen output.'),{statusCode:400})
}
if(v.assignmentSectionId){
  const assignmentSection=(await client.query('SELECT 1 FROM assignment_sections WHERE id=$1 AND assignment_id=$2 AND archived_at IS NULL',[v.assignmentSectionId,req.params.id])).rowCount
  if(!assignmentSection)throw Object.assign(new Error('Selected assignment section is not active in this assignment.'),{statusCode:400})
}
if(v.reviewerId){
  if(v.ownerId&&v.ownerId===v.reviewerId)throw Object.assign(new Error('The task assignee cannot review their own work.'),{statusCode:400})
  const reviewer=(await client.query(`SELECT u.id FROM users u
    WHERE u.id=$1 AND u.active=TRUE AND u.role IN('Research Officer','Reviewer','Research Manager')
      AND (u.role='Research Manager' OR EXISTS(
        SELECT 1 FROM assignment_members am WHERE am.assignment_id=$2 AND am.user_id=u.id
      ))`,[v.reviewerId,req.params.id])).rowCount
  if(!reviewer)throw Object.assign(new Error('Choose another active assignment member or Research Manager as reviewer.'),{statusCode:400})
}
const created=(await client.query(`INSERT INTO assignment_tasks(
  assignment_id,title,description,owner_id,priority,status,progress,start_date,due_date,notes,created_by,
  expected_contribution,assignment_part,target_document_id,target_section_id,assignment_section_id,
  task_purpose,specific_instructions,expected_findings,expected_output,evidence_required,reviewer_id
)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)RETURNING *`,
[req.params.id,v.title,v.description,v.ownerId,v.priority,v.status,v.progress,v.startDate,v.dueDate,v.notes,req.user.id,
v.expectedContribution,v.assignmentPart,v.targetDocumentId,v.targetSectionId,v.assignmentSectionId,v.taskPurpose,v.specificInstructions,v.expectedFindings,v.expectedOutput,v.evidenceRequired,v.reviewerId])).rows[0];
const assignment=(await client.query('SELECT title FROM assignments WHERE id=$1',[req.params.id])).rows[0]
if(v.ownerId){
  await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'New task contribution assigned',$2,'assignment_task',$3)",
    [v.ownerId,`You have been assigned “${created.title}” for “${assignment?.title||'an assignment'}”.${v.expectedContribution?` Expected contribution: ${v.expectedContribution}`:''}`,created.id])
}
if(v.reviewerId){
  await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Task review assigned',$2,'assignment_task',$3)",
    [v.reviewerId,`You are the assigned reviewer for “${created.title}” in “${assignment?.title||'an assignment'}”. The review becomes actionable when the assignee submits the task contribution.`,created.id])
}
await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'TASK_CREATED',JSON.stringify({taskId:created.id,title:created.title,reviewerId:v.reviewerId||null})]);await syncAssignmentStatusFromTasks(client,req.params.id,req.user.id);await audit(client,req.user.id,'ASSIGNMENT_TASK_CREATED','assignment_task',created.id,{assignmentId:req.params.id,title:created.title});return created});res.status(201).json(row)}catch(error){next(error)}})
app.patch('/api/assignments/:id/tasks/:taskId',authenticate,validate(assignmentTaskSchema),async(req,res,next)=>{try{if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot update this task.'});const current=(await query('SELECT owner_id,archived_at,contribution_status FROM assignment_tasks WHERE id=$1 AND assignment_id=$2',[req.params.taskId,req.params.id])).rows[0];if(!current)return res.status(404).json({error:'Task not found.'});if(current.archived_at)return res.status(409).json({error:'Archived tasks cannot be edited.'});if(!['Administrator','Research Manager'].includes(req.user.role)&&current.owner_id!==req.user.id)return res.status(403).json({error:'Only the task owner or a manager can update this task.'});const v=req.validated;if(v.status==='Completed'&&current.contribution_status!=='Accepted')return res.status(409).json({error:'A task is completed only after its submitted report is accepted.'});const manager=['Administrator','Research Manager'].includes(req.user.role);const row=await transaction(async client=>{
if(manager&&v.ownerId){
  const member=(await client.query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[req.params.id,v.ownerId])).rowCount
  if(!member)throw Object.assign(new Error('Selected task owner is not a member of this assignment.'),{statusCode:400})
}
if(manager&&v.targetDocumentId){
  const document=(await client.query("SELECT 1 FROM generated_documents WHERE id=$1 AND context='Assignment' AND context_id=$2",[v.targetDocumentId,req.params.id])).rowCount
  if(!document)throw Object.assign(new Error('Selected contribution output does not belong to this assignment.'),{statusCode:400})
}
if(manager&&v.targetSectionId){
  const section=(await client.query('SELECT 1 FROM generated_document_sections WHERE id=$1 AND document_id=$2',[v.targetSectionId,v.targetDocumentId])).rowCount
  if(!section)throw Object.assign(new Error('Selected contribution section does not belong to the chosen output.'),{statusCode:400})
}
if(manager&&v.assignmentSectionId){
  const assignmentSection=(await client.query('SELECT 1 FROM assignment_sections WHERE id=$1 AND assignment_id=$2 AND archived_at IS NULL',[v.assignmentSectionId,req.params.id])).rowCount
  if(!assignmentSection)throw Object.assign(new Error('Selected assignment section is not active in this assignment.'),{statusCode:400})
}
if(manager&&v.reviewerId){const reviewer=(await client.query("SELECT 1 FROM users u LEFT JOIN assignment_members am ON am.user_id=u.id AND am.assignment_id=$2 WHERE u.id=$1 AND u.active=TRUE AND (u.role IN('Reviewer','Research Manager','Administrator') OR am.member_role IN('Lead','Reviewer'))",[v.reviewerId,req.params.id])).rowCount;if(!reviewer)throw Object.assign(new Error('Choose the assignment Team Lead, assigned Reviewer or an active manager.'),{statusCode:400})}
const updated=(await client.query(`UPDATE assignment_tasks SET
  title=CASE WHEN $1 THEN $2 ELSE title END,
  description=CASE WHEN $1 THEN $3 ELSE description END,
  owner_id=CASE WHEN $1 THEN $4 ELSE owner_id END,
  priority=CASE WHEN $1 THEN $5 ELSE priority END,
  status=$6,progress=$7,start_date=$8,
  due_date=CASE WHEN $1 THEN $9 ELSE due_date END,
  notes=$10,
  expected_contribution=CASE WHEN $1 THEN $11 ELSE expected_contribution END,
  assignment_part=CASE WHEN $1 THEN $12 ELSE assignment_part END,
  target_document_id=CASE WHEN $1 THEN $13 ELSE target_document_id END,
  target_section_id=CASE WHEN $1 THEN $14 ELSE target_section_id END,
  assignment_section_id=CASE WHEN $1 THEN $15 ELSE assignment_section_id END,
  task_purpose=CASE WHEN $1 THEN $16 ELSE task_purpose END,
  specific_instructions=CASE WHEN $1 THEN $17 ELSE specific_instructions END,
  expected_findings=CASE WHEN $1 THEN $18 ELSE expected_findings END,
  expected_output=CASE WHEN $1 THEN $19 ELSE expected_output END,
  evidence_required=CASE WHEN $1 THEN $20 ELSE evidence_required END,
  reviewer_id=CASE WHEN $1 THEN $21 ELSE reviewer_id END,
  updated_at=NOW()
WHERE id=$22 AND assignment_id=$23 RETURNING *`,
[manager,v.title,v.description,v.ownerId,v.priority,v.status,v.progress,v.startDate,v.dueDate,v.notes,
v.expectedContribution,v.assignmentPart,v.targetDocumentId,v.targetSectionId,v.assignmentSectionId,v.taskPurpose,v.specificInstructions,v.expectedFindings,v.expectedOutput,v.evidenceRequired,v.reviewerId,req.params.taskId,req.params.id])).rows[0];if(updated.status==='Completed'&&updated.contribution_status==='Draft'){await client.query("UPDATE assignment_tasks SET contribution_status='Ready for Integration',contribution_ready_at=COALESCE(contribution_ready_at,NOW()),updated_at=NOW() WHERE id=$1",[updated.id]);updated.contribution_status='Ready for Integration';updated.contribution_ready_at=updated.contribution_ready_at||new Date().toISOString();if(updated.reviewer_id)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Completed task ready for assignment review',$2,'assignment_task',$3)",[updated.reviewer_id,`Review the completed task “${updated.title}” and integrate it into its assignment contribution.`,updated.id])}await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'TASK_UPDATED',JSON.stringify({taskId:updated.id,status:updated.status,progress:updated.progress,assignmentSectionId:updated.assignment_section_id})]);await syncAssignmentStatusFromTasks(client,req.params.id,req.user.id);await audit(client,req.user.id,'ASSIGNMENT_TASK_UPDATED','assignment_task',updated.id,{status:updated.status,progress:updated.progress,assignmentSectionId:updated.assignment_section_id});return updated});res.json(row)}catch(error){next(error)}})

app.get('/api/assignments/:id/task-requests',authenticate,async(req,res,next)=>{
  try{
    if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot view task requests for this assignment.'})
    const result=await query(`SELECT r.*,requester.name requested_by_name,owner.name suggested_owner_name,reviewer.name reviewed_by_name,t.title task_title
      FROM assignment_task_requests r
      JOIN users requester ON requester.id=r.requested_by
      LEFT JOIN users owner ON owner.id=r.suggested_owner_id
      LEFT JOIN users reviewer ON reviewer.id=r.reviewed_by
      LEFT JOIN assignment_tasks t ON t.id=r.task_id
      WHERE r.assignment_id=$1
      ORDER BY CASE WHEN r.status='Pending' THEN 0 ELSE 1 END,r.created_at DESC`,[req.params.id])
    res.json(result.rows)
  }catch(error){next(error)}
})
app.post('/api/assignments/:id/task-requests',authenticate,validate(assignmentTaskRequestSchema),async(req,res,next)=>{
  try{
    const membership=(await query("SELECT member_role FROM assignment_members WHERE assignment_id=$1 AND user_id=$2",[req.params.id,req.user.id])).rows[0]
    if(!membership||membership.member_role!=='Lead')return res.status(403).json({error:'Only the assigned Team Lead can request a task.'})
    const v=req.validated
    if(v.suggestedOwnerId){
      const owner=(await query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[req.params.id,v.suggestedOwnerId])).rowCount
      if(!owner)return res.status(400).json({error:'The suggested assignee must already be a member of this assignment.'})
    }
    const created=await transaction(async client=>{
      const row=(await client.query(`INSERT INTO assignment_task_requests(assignment_id,requested_by,title,description,suggested_owner_id,priority,due_date,reason)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[req.params.id,req.user.id,v.title,v.description,v.suggestedOwnerId,v.priority,v.dueDate,v.reason])).rows[0]
      const assignment=(await client.query('SELECT title FROM assignments WHERE id=$1',[req.params.id])).rows[0]
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT id,'Task request awaiting approval',$1,'assignment_task_request',$2 FROM users WHERE role IN('Administrator','Research Manager') AND active=TRUE",[`${req.user.name} requested a task for “${assignment?.title||'an assignment'}”: ${v.title}.`,row.id])
      finalizationStage='write-history'
    await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'TASK_REQUESTED',JSON.stringify({requestId:row.id,title:row.title})])
      await audit(client,req.user.id,'ASSIGNMENT_TASK_REQUESTED','assignment_task_request',row.id,{assignmentId:req.params.id,title:row.title})
      return row
    })
    res.status(201).json(created)
  }catch(error){next(error)}
})
app.patch('/api/assignments/:id/task-requests/:requestId',authenticate,authorize('Administrator','Research Manager'),validate(assignmentTaskRequestDecisionSchema),async(req,res,next)=>{
  try{
    const v=req.validated
    const result=await transaction(async client=>{
      const request=(await client.query('SELECT * FROM assignment_task_requests WHERE id=$1 AND assignment_id=$2 FOR UPDATE',[req.params.requestId,req.params.id])).rows[0]
      if(!request)return {kind:'missing'}
      if(request.status!=='Pending')return {kind:'closed',request}
      if(v.decision==='Rejected'){
        const updated=(await client.query("UPDATE assignment_task_requests SET status='Rejected',reviewed_by=$1,reviewed_at=NOW(),review_comments=$2,updated_at=NOW() WHERE id=$3 RETURNING *",[req.user.id,v.comments,request.id])).rows[0]
        await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'Task request declined',$2,'assignment_task_request',$3)",[request.requested_by,`Your task request “${request.title}” was declined${v.comments?`: ${v.comments}`:'.'}`,request.id])
        await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'TASK_REQUEST_REJECTED',JSON.stringify({requestId:request.id,comments:v.comments})])
        await audit(client,req.user.id,'ASSIGNMENT_TASK_REQUEST_REJECTED','assignment_task_request',request.id,{assignmentId:req.params.id,comments:v.comments})
        return {kind:'updated',row:updated}
      }
      const taskTitle=v.title??request.title
      const taskDescription=v.description??request.description
      const taskOwner=v.ownerId===undefined?request.suggested_owner_id:v.ownerId
      const taskPriority=v.priority??request.priority
      const taskDueDate=v.dueDate===undefined?request.due_date:v.dueDate
      if(taskOwner){
        const owner=(await client.query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[req.params.id,taskOwner])).rowCount
        if(!owner)return {kind:'bad-owner'}
      }
      const task=(await client.query(`INSERT INTO assignment_tasks(assignment_id,title,description,owner_id,priority,status,progress,start_date,due_date,notes,created_by)
        VALUES($1,$2,$3,$4,$5,'Not Started',0,$6,$7,$8,$9) RETURNING *`,
        [req.params.id,taskTitle,taskDescription,taskOwner,taskPriority,v.startDate??null,taskDueDate,v.notes??'',req.user.id])).rows[0]
      const updated=(await client.query("UPDATE assignment_task_requests SET status='Approved',reviewed_by=$1,reviewed_at=NOW(),review_comments=$2,task_id=$3,updated_at=NOW() WHERE id=$4 RETURNING *",[req.user.id,v.comments,task.id,request.id])).rows[0]
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'Task request approved',$2,'assignment_task_request',$3)",[request.requested_by,`Your task request “${request.title}” was approved and converted to task “${task.title}”.`,request.id])
      if(taskOwner)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'New task assigned',$2,'assignment_task',$3)",[taskOwner,`You have been assigned “${task.title}”.`,task.id])
      await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'TASK_REQUEST_APPROVED',JSON.stringify({requestId:request.id,taskId:task.id,title:task.title})])
      await audit(client,req.user.id,'ASSIGNMENT_TASK_REQUEST_APPROVED','assignment_task_request',request.id,{assignmentId:req.params.id,taskId:task.id,title:task.title})
      return {kind:'updated',row:{...updated,task}}
    })
    if(result.kind==='missing')return res.status(404).json({error:'Task request not found.'})
    if(result.kind==='closed')return res.status(409).json({error:'This task request has already been decided.'})
    if(result.kind==='bad-owner')return res.status(400).json({error:'The selected task owner must be a member of this assignment.'})
    res.json(result.row)
  }catch(error){next(error)}
})




app.get('/api/task-reviews/:taskId/context',authenticate,async(req,res,next)=>{try{
  const row=(await query(`SELECT
      t.*,
      owner.name owner_name,
      reviewer.name reviewer_name,
      gd.title target_document_title,
      gds.title target_section_title,
      assignment_section.title assignment_section_title,
      a.title assignment_title,
      a.description assignment_description,
      a.division assignment_division,
      a.status assignment_status,
      a.priority assignment_priority,
      a.due_date assignment_due_date,
      a.created_by assignment_created_by,
      a.created_at assignment_created_at,
      a.updated_at assignment_updated_at
    FROM assignment_tasks t
    JOIN assignments a ON a.id=t.assignment_id
    LEFT JOIN users owner ON owner.id=t.owner_id
    LEFT JOIN users reviewer ON reviewer.id=t.reviewer_id
    LEFT JOIN generated_documents gd ON gd.id=t.target_document_id
    LEFT JOIN generated_document_sections gds ON gds.id=t.target_section_id
    LEFT JOIN assignment_sections assignment_section ON assignment_section.id=t.assignment_section_id
    WHERE t.id=$1::uuid AND t.archived_at IS NULL`,[req.params.taskId])).rows[0]
  if(!row)return res.status(404).json({error:'Task review item not found.'})
  const manager=['Administrator','Research Manager'].includes(req.user.role)
  if(!manager&&row.reviewer_id!==req.user.id){
    return res.status(403).json({error:'Only the reviewer assigned to this task can open this review.'})
  }
  const assignment={
    id:row.assignment_id,
    title:row.assignment_title,
    description:row.assignment_description||'',
    division:row.assignment_division||'',
    status:row.assignment_status,
    priority:row.assignment_priority,
    due_date:row.assignment_due_date,
    created_by:row.assignment_created_by,
    created_at:row.assignment_created_at,
    updated_at:row.assignment_updated_at,
    members:[]
  }
  const task={...row}
  delete task.assignment_title
  delete task.assignment_description
  delete task.assignment_division
  delete task.assignment_status
  delete task.assignment_priority
  delete task.assignment_due_date
  delete task.assignment_created_by
  delete task.assignment_created_at
  delete task.assignment_updated_at
  res.json({assignment,task})
}catch(error){next(error)}})

app.post('/api/assignments/:id/tasks/:taskId/contribution-preview',authenticate,validate(assignmentTaskContributionPreviewSchema),async(req,res,next)=>{try{
  const task=(await query(`SELECT t.*,u.name owner_name,gd.title target_document_title,gds.title target_section_title
    FROM assignment_tasks t LEFT JOIN users u ON u.id=t.owner_id
    LEFT JOIN generated_documents gd ON gd.id=t.target_document_id
    LEFT JOIN generated_document_sections gds ON gds.id=t.target_section_id
    WHERE t.id=$1 AND t.assignment_id=$2`,[req.params.taskId,req.params.id])).rows[0]
  if(!task)return res.status(404).json({error:'Task not found.'})
  const manager=['Administrator','Research Manager'].includes(req.user.role)
  const teamLead=(await query("SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2 AND member_role='Lead'",[req.params.id,req.user.id])).rowCount>0
  const exactReviewer=task.reviewer_id===req.user.id
  if(!manager&&!teamLead&&!exactReviewer&&task.owner_id!==req.user.id)return res.status(403).json({error:'Only the task owner, assigned reviewer, team lead or a manager can preview this contribution.'})
  const assignment=(await query('SELECT title FROM assignments WHERE id=$1',[req.params.id])).rows[0]
  res.json(buildTaskContributionReport({task,assignment,ownerName:task.owner_name,preparedBy:req.user.name||task.owner_name,override:req.validated}))
}catch(error){next(error)}})

app.get('/api/assignments/:id/tasks/:taskId/contribution-report',authenticate,async(req,res,next)=>{try{
  const task=(await query(`SELECT t.*,u.name owner_name,gd.title target_document_title,gds.title target_section_title
    FROM assignment_tasks t LEFT JOIN users u ON u.id=t.owner_id
    LEFT JOIN generated_documents gd ON gd.id=t.target_document_id
    LEFT JOIN generated_document_sections gds ON gds.id=t.target_section_id
    WHERE t.id=$1 AND t.assignment_id=$2`,[req.params.taskId,req.params.id])).rows[0]
  if(!task)return res.status(404).json({error:'Task not found.'})
  const manager=['Administrator','Research Manager'].includes(req.user.role)
  const teamMember=(await query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[req.params.id,req.user.id])).rowCount>0
  if(!manager&&!teamMember&&task.reviewer_id!==req.user.id)return res.status(403).json({error:'You cannot view this task contribution report.'})
  const assignment=(await query('SELECT title FROM assignments WHERE id=$1',[req.params.id])).rows[0]
  const report=buildTaskContributionReport({task,assignment,ownerName:task.owner_name,preparedBy:task.owner_name})
  res.json({html:report.html,title:report.title,version:Number(task.contribution_report_version||0),generatedAt:new Date().toISOString(),status:task.contribution_status})
}catch(error){next(error)}})

app.patch('/api/assignments/:id/tasks/:taskId/contribution',authenticate,validate(assignmentTaskContributionSchema),async(req,res,next)=>{try{
  const current=(await query(`SELECT t.*,u.name owner_name,gd.title target_document_title,gds.title target_section_title
    FROM assignment_tasks t LEFT JOIN users u ON u.id=t.owner_id
    LEFT JOIN generated_documents gd ON gd.id=t.target_document_id
    LEFT JOIN generated_document_sections gds ON gds.id=t.target_section_id
    WHERE t.id=$1 AND t.assignment_id=$2`,[req.params.taskId,req.params.id])).rows[0]
  if(!current)return res.status(404).json({error:'Task not found.'})
  if(current.owner_id!==req.user.id)return res.status(403).json({error:'Only the task owner can edit or submit this task report. Reviewers must use the formal review decision controls.'})
  if(current.status==='Blocked')return res.status(409).json({error:'This task report was rejected and is locked. A manager must reopen it for revision before you can edit it.'})
  if(current.contribution_status!=='Draft')return res.status(409).json({error:'This submitted task report is locked while it is under review. Wait for the reviewer decision or requested changes.'})
  const v=req.validated
  const clean={
    ...v,
    contributionTitle:plainTaskReportText(v.contributionTitle),
    contributionSummary:plainTaskReportText(v.contributionSummary),
    contributionFindings:plainTaskReportText(v.contributionFindings),
    contributionRecommendations:plainTaskReportText(v.contributionRecommendations),
    evidenceReviewed:plainTaskReportText(v.evidenceReviewed),
    contributionChallenges:plainTaskReportText(v.contributionChallenges),
    contributionNextActions:plainTaskReportText(v.contributionNextActions),
    workNotes:plainTaskReportText(v.workNotes)
  }
  if(['Integrated','Accepted'].includes(v.contributionStatus))return res.status(403).json({error:'Use the formal reviewer decision workflow to approve or finalise a task report.'})
  let submissionReviewer=null
  if(v.contributionStatus==='Ready for Integration'){
    if(!current.reviewer_id)return res.status(409).json({error:'Assign a reviewer before submitting this task report.'})
    submissionReviewer=(await query('SELECT id,name,active FROM users WHERE id=$1',[current.reviewer_id])).rows[0]
    if(!submissionReviewer||!submissionReviewer.active)return res.status(409).json({error:'The assigned reviewer is inactive or unavailable. Ask the assignment manager to choose another reviewer.'})
    if(current.owner_id===submissionReviewer.id)return res.status(409).json({error:'The task owner cannot review their own report. Choose another reviewer before submission.'})
  }
  const assignment=(await query('SELECT title FROM assignments WHERE id=$1',[req.params.id])).rows[0]
  const reportTask={...current,notes:clean.workNotes,contribution_title:clean.contributionTitle,contribution_summary:clean.contributionSummary,contribution_findings:clean.contributionFindings,contribution_recommendations:clean.contributionRecommendations,evidence_reviewed:clean.evidenceReviewed,contribution_challenges:clean.contributionChallenges,contribution_next_actions:clean.contributionNextActions}
  const generated=buildTaskContributionReport({task:reportTask,assignment,ownerName:current.owner_name,preparedBy:req.user.name||current.owner_name})
  const row=await transaction(async client=>{
    const updated=(await client.query(`UPDATE assignment_tasks SET
      contribution_title=$1::text,contribution_summary=$2::text,contribution_findings=$3::text,contribution_recommendations=$4::text,
      evidence_reviewed=$5::text,contribution_challenges=$6::text,contribution_next_actions=$7::text,notes=$8::text,
      contribution_status=$9::varchar,contribution_updated_at=NOW(),
      contribution_ready_at=CASE WHEN $9='Ready for Integration' AND contribution_ready_at IS NULL THEN NOW() ELSE contribution_ready_at END,
      contribution_integrated_at=CASE WHEN $9 IN('Integrated','Accepted') THEN NOW() ELSE contribution_integrated_at END,
      contribution_integrated_by=CASE WHEN $9::varchar IN('Integrated','Accepted') THEN $10::uuid ELSE contribution_integrated_by END,
      contribution_report_html=CASE WHEN $9::varchar IN('Draft','Ready for Integration') THEN $11::text ELSE contribution_report_html END,
      contribution_report_version=CASE WHEN $9='Ready for Integration' THEN contribution_report_version+1 ELSE contribution_report_version END,
      contribution_report_generated_at=CASE WHEN $9::varchar IN('Draft','Ready for Integration') THEN NOW() ELSE contribution_report_generated_at END,
      updated_at=NOW()
      WHERE id=$12 AND assignment_id=$13 RETURNING *`,
      [clean.contributionTitle,clean.contributionSummary,clean.contributionFindings,clean.contributionRecommendations,clean.evidenceReviewed,clean.contributionChallenges,clean.contributionNextActions,clean.workNotes,v.contributionStatus,null,generated.html,req.params.taskId,req.params.id])).rows[0]
    await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',
      [req.params.id,req.user.id,v.contributionStatus==='Draft'?'TASK_CONTRIBUTION_DRAFT_SAVED':'TASK_CONTRIBUTION_UPDATED',JSON.stringify({taskId:updated.id,title:updated.title,contributionStatus:updated.contribution_status})])
    await audit(client,req.user.id,v.contributionStatus==='Draft'?'ASSIGNMENT_TASK_CONTRIBUTION_DRAFT_SAVED':'ASSIGNMENT_TASK_CONTRIBUTION_UPDATED','assignment_task',updated.id,{assignmentId:req.params.id,contributionStatus:updated.contribution_status})
    if(v.contributionStatus==='Ready for Integration'){
      const body=`${req.user.name||current.owner_name||'A team member'} submitted the task report for “${updated.title}” in “${assignment?.title||'the assignment'}”. Review this submitted version and approve, request changes, or reject it.`
      await client.query(
        "INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Task report ready for review',$2,'assignment_task',$3)",
        [submissionReviewer.id,body,updated.id]
      )
      await client.query(
        'INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',
        [req.params.id,req.user.id,'TASK_REPORT_SUBMITTED_TO_REVIEWER',JSON.stringify({
          taskId:updated.id,
          reviewerId:submissionReviewer.id,
          reviewerName:submissionReviewer.name,
          reportVersion:Number(updated.contribution_report_version||0)
        })]
      )
      await audit(client,req.user.id,'TASK_REPORT_SUBMITTED_TO_REVIEWER','assignment_task',updated.id,{
        assignmentId:req.params.id,
        reviewerId:submissionReviewer.id,
        reviewerName:submissionReviewer.name,
        reportVersion:Number(updated.contribution_report_version||0)
      })
    }
    return updated
  })
  const joined=(await query(`SELECT t.*,u.name owner_name,reviewer.name reviewer_name,gd.title target_document_title,gds.title target_section_title,assignment_section.title assignment_section_title
    FROM assignment_tasks t LEFT JOIN users u ON u.id=t.owner_id
    LEFT JOIN users reviewer ON reviewer.id=t.reviewer_id
    LEFT JOIN generated_documents gd ON gd.id=t.target_document_id
    LEFT JOIN generated_document_sections gds ON gds.id=t.target_section_id
    LEFT JOIN assignment_sections assignment_section ON assignment_section.id=t.assignment_section_id
    WHERE t.id=$1`,[row.id])).rows[0]
  res.json(joined)
}catch(error){next(error)}})

app.post('/api/assignments/:id/tasks/:taskId/contribution-review',authenticate,validate(assignmentTaskContributionReviewSchema),async(req,res,next)=>{
  let reviewStage='load-task'
  try{
    const current=(await query(`SELECT t.*,owner.name owner_name,reviewer.name reviewer_name,a.title assignment_title
      FROM assignment_tasks t
      LEFT JOIN users owner ON owner.id=t.owner_id
      LEFT JOIN users reviewer ON reviewer.id=t.reviewer_id
      JOIN assignments a ON a.id=t.assignment_id
      WHERE t.id=$1::uuid AND t.assignment_id=$2::uuid AND t.archived_at IS NULL`,[req.params.taskId,req.params.id])).rows[0]
    if(!current)return res.status(404).json({error:'Task not found.'})
    if(current.owner_id===req.user.id)return res.status(403).json({error:'You cannot review your own task report.'})
    if(current.reviewer_id!==req.user.id)return res.status(403).json({error:'Only the reviewer assigned to this task can approve, request changes, or reject this submitted report.'})
    if(current.contribution_status!=='Ready for Integration')return res.status(409).json({error:'This task report is not currently awaiting a review decision.'})

    const decision=req.validated.decision
    const comments=req.validated.comments.trim()
    if(['Changes Requested','Rejected'].includes(decision)&&!comments){
      return res.status(400).json({error:decision==='Rejected'?'A rejection reason is required.':'Add clear review comments before requesting changes.'})
    }

    const updated=await transaction(async client=>{
      reviewStage='update-decision'
      let row
      if(decision==='Approved'){
        row=(await client.query(`UPDATE assignment_tasks SET
          contribution_status='Integrated',
          status='In Progress',
          contribution_integrated_at=NOW(),
          contribution_integrated_by=$1::uuid,
          updated_at=NOW()
          WHERE id=$2::uuid
            AND assignment_id=$3::uuid
            AND reviewer_id=$1::uuid
            AND contribution_status='Ready for Integration'
          RETURNING *`,[req.user.id,req.params.taskId,req.params.id])).rows[0]
      }else if(decision==='Rejected'){
        row=(await client.query(`UPDATE assignment_tasks SET
          contribution_status='Draft',
          status='Blocked',
          updated_at=NOW()
          WHERE id=$1::uuid
            AND assignment_id=$2::uuid
            AND reviewer_id=$3::uuid
            AND contribution_status='Ready for Integration'
          RETURNING *`,[req.params.taskId,req.params.id,req.user.id])).rows[0]
      }else{
        row=(await client.query(`UPDATE assignment_tasks SET
          contribution_status='Draft',
          status='In Progress',
          updated_at=NOW()
          WHERE id=$1::uuid
            AND assignment_id=$2::uuid
            AND reviewer_id=$3::uuid
            AND contribution_status='Ready for Integration'
          RETURNING *`,[req.params.taskId,req.params.id,req.user.id])).rows[0]
      }
      if(!row)throw Object.assign(new Error('This task report changed before the decision was saved. Refresh My Reviews and try again.'),{statusCode:409})

      const action=decision==='Approved'?'TASK_REPORT_APPROVED':decision==='Rejected'?'TASK_REPORT_REJECTED':'TASK_REPORT_CHANGES_REQUESTED'
      const historyDetails=JSON.stringify({taskId:row.id,title:row.title,decision,comments,reviewerId:req.user.id,reportVersion:Number(row.contribution_report_version||0)})

      await client.query(
        "UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=$1::uuid AND entity_type='assignment_task' AND entity_id=$2::text AND read_at IS NULL",
        [req.user.id,row.id]
      )

      reviewStage='history'
      await client.query(`INSERT INTO assignment_history(assignment_id,user_id,action,details)
        VALUES($1::uuid,$2::uuid,$3::varchar,$4::jsonb)`,[req.params.id,req.user.id,action,historyDetails])

      if(row.owner_id){
        reviewStage='owner-notification'
        const notificationTitle=decision==='Approved'?'Task report approved':decision==='Rejected'?'Task report rejected':'Changes requested on task report'
        const notificationBody=decision==='Approved'
          ? `Your task report for “${row.title}” was approved. The assigned reviewer will now generate the final report.`
          : decision==='Rejected'
            ? `Your task report for “${row.title}” was rejected. Reason: ${comments}. A manager must reopen the task before further editing.`
            : `Changes were requested on “${row.title}”. ${comments}`
        await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
          VALUES($1::uuid,$2::varchar,$3::text,'assignment_task',$4::uuid)`,[row.owner_id,notificationTitle,notificationBody,row.id])
      }

      if(decision==='Rejected'){
        reviewStage='manager-notification'
        const managerBody=`“${row.title}” was rejected by ${req.user.name||'the assigned reviewer'}. Review the reason and reopen for revision or reassign the task.`
        await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
          SELECT DISTINCT u.id,'Rejected task requires management action',$1::text,'assignment_task',$2::uuid
          FROM users u
          LEFT JOIN assignment_members am ON am.user_id=u.id AND am.assignment_id=$3::uuid
          WHERE u.active=TRUE
            AND u.id<>$4::uuid
            AND (u.role IN('Administrator','Research Manager') OR am.member_role='Lead')`,[managerBody,row.id,req.params.id,req.user.id])
      }

      if(decision==='Approved'){
        reviewStage='finalizer-notification'
        await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
          VALUES($1::uuid,'Final task report ready to generate',$2::text,'assignment_task',$3::uuid)`,[
          req.user.id,`“${row.title}” is approved. Generate the final report to complete the task.`,row.id
        ])
      }

      reviewStage='audit'
      const auditDetails=JSON.stringify({assignmentId:req.params.id,comments,reportVersion:Number(row.contribution_report_version||0),decision})
      await client.query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)
        VALUES($1::uuid,$2::varchar,'assignment_task',$3::uuid,$4::jsonb)`,[
        req.user.id,
        decision==='Approved'?'ASSIGNMENT_TASK_REPORT_APPROVED':decision==='Rejected'?'ASSIGNMENT_TASK_REPORT_REJECTED':'ASSIGNMENT_TASK_REPORT_CHANGES_REQUESTED',
        row.id,
        auditDetails
      ])
      return row
    })

    reviewStage='reload-task'
    const joined=(await query(`SELECT t.*,u.name owner_name,reviewer.name reviewer_name,gd.title target_document_title,gds.title target_section_title,assignment_section.title assignment_section_title
      FROM assignment_tasks t
      LEFT JOIN users u ON u.id=t.owner_id
      LEFT JOIN users reviewer ON reviewer.id=t.reviewer_id
      LEFT JOIN generated_documents gd ON gd.id=t.target_document_id
      LEFT JOIN generated_document_sections gds ON gds.id=t.target_section_id
      LEFT JOIN assignment_sections assignment_section ON assignment_section.id=t.assignment_section_id
      WHERE t.id=$1::uuid`,[updated.id])).rows[0]
    res.json(joined)
  }catch(error){
    console.error('TASK_REPORT_REVIEW_FAILED',{stage:reviewStage,taskId:req.params.taskId,assignmentId:req.params.id,userId:req.user?.id,message:error?.message})
    if(error?.statusCode)return next(error)
    return res.status(500).json({error:`Reviewer workflow failed at ${reviewStage}: ${error?.message||'Unknown database error.'}`})
  }
})


app.post('/api/assignments/:id/tasks/:taskId/reopen-after-rejection',authenticate,async(req,res,next)=>{try{
  const current=(await query(`SELECT t.*,a.title assignment_title FROM assignment_tasks t JOIN assignments a ON a.id=t.assignment_id WHERE t.id=$1 AND t.assignment_id=$2 AND t.archived_at IS NULL`,[req.params.taskId,req.params.id])).rows[0]
  if(!current)return res.status(404).json({error:'Task not found.'})
  const manager=['Administrator','Research Manager'].includes(req.user.role)
  const teamLead=(await query("SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2 AND member_role='Lead'",[req.params.id,req.user.id])).rowCount>0
  if(!manager&&!teamLead)return res.status(403).json({error:'Only the assignment Team Lead or a manager can reopen a rejected task.'})
  const rejection=(await query(`SELECT id,details FROM assignment_history WHERE assignment_id=$1 AND action='TASK_REPORT_REJECTED' AND details->>'taskId'=$2 ORDER BY created_at DESC LIMIT 1`,[req.params.id,req.params.taskId])).rows[0]
  if(!rejection||current.status!=='Blocked'||current.contribution_status!=='Draft')return res.status(409).json({error:'This task is not currently awaiting management action after rejection.'})
  const row=await transaction(async client=>{
    const updated=(await client.query("UPDATE assignment_tasks SET status='In Progress',updated_at=NOW() WHERE id=$1 AND assignment_id=$2 RETURNING *",[req.params.taskId,req.params.id])).rows[0]
    await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'TASK_REPORT_REOPENED',JSON.stringify({taskId:updated.id,title:updated.title,rejectionHistoryId:rejection.id})])
    if(updated.owner_id)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Rejected task reopened for revision',$2,'assignment_task',$3)",[updated.owner_id,`“${updated.title}” has been reopened for revision. Update the draft, preview it, and resubmit to the assigned reviewer.`,updated.id])
    await audit(client,req.user.id,'ASSIGNMENT_TASK_REPORT_REOPENED','assignment_task',updated.id,{assignmentId:req.params.id,rejectionHistoryId:rejection.id})
    return updated
  })
  const joined=(await query(`SELECT t.*,u.name owner_name,reviewer.name reviewer_name,gd.title target_document_title,gds.title target_section_title,assignment_section.title assignment_section_title
    FROM assignment_tasks t LEFT JOIN users u ON u.id=t.owner_id
    LEFT JOIN users reviewer ON reviewer.id=t.reviewer_id
    LEFT JOIN generated_documents gd ON gd.id=t.target_document_id
    LEFT JOIN generated_document_sections gds ON gds.id=t.target_section_id
    LEFT JOIN assignment_sections assignment_section ON assignment_section.id=t.assignment_section_id
    WHERE t.id=$1`,[row.id])).rows[0]
  res.json(joined)
}catch(error){next(error)}})

// APP2_TASK_FINAL_REPORT_TYPED_SQL_V2
app.post('/api/assignments/:id/tasks/:taskId/contribution-finalize',authenticate,async(req,res,next)=>{let storedFinalPath;let finalizationStage='load-task';try{
  const current=(await query(`SELECT t.*,owner.name owner_name,reviewer.name reviewer_name,a.title assignment_title,a.division assignment_division
    FROM assignment_tasks t
    LEFT JOIN users owner ON owner.id=t.owner_id
    LEFT JOIN users reviewer ON reviewer.id=t.reviewer_id
    JOIN assignments a ON a.id=t.assignment_id
    WHERE t.id=$1 AND t.assignment_id=$2 AND t.archived_at IS NULL`,[req.params.taskId,req.params.id])).rows[0]
  if(!current)return res.status(404).json({error:'Task not found.'})
  if(current.owner_id===req.user.id)return res.status(403).json({error:'The task owner cannot generate the approved final report.'})
  const manager=['Administrator','Research Manager'].includes(req.user.role)
  const teamLead=(await query("SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2 AND member_role='Lead'",[req.params.id,req.user.id])).rowCount>0
  const exactReviewer=current.reviewer_id===req.user.id
  if(!exactReviewer&&!teamLead&&!manager)return res.status(403).json({error:'Only the assigned reviewer, assignment Team Lead or a manager can generate the final task report.'})

  // Idempotent retry: if finalisation already completed, return the existing repository record.
  if(current.contribution_status==='Accepted'){
    const repository=(await query(`SELECT k.id,k.title FROM knowledge_items k
      JOIN repository_entity_links rel ON rel.knowledge_id=k.id
      WHERE rel.entity_type='task' AND rel.entity_id=$1 AND k.document_type='Task Final Report' AND k.status='Published'
      ORDER BY k.created_at DESC LIMIT 1`,[current.id])).rows[0]||null
    const joined=(await query(`SELECT t.*,u.name owner_name,reviewer.name reviewer_name,gd.title target_document_title,gds.title target_section_title,assignment_section.title assignment_section_title
      FROM assignment_tasks t LEFT JOIN users u ON u.id=t.owner_id
      LEFT JOIN users reviewer ON reviewer.id=t.reviewer_id
      LEFT JOIN generated_documents gd ON gd.id=t.target_document_id
      LEFT JOIN generated_document_sections gds ON gds.id=t.target_section_id
      LEFT JOIN assignment_sections assignment_section ON assignment_section.id=t.assignment_section_id
      WHERE t.id=$1`,[current.id])).rows[0]
    return res.json({...joined,repository_document_id:repository?.id||null,repository_document_title:repository?.title||null})
  }

  if(current.contribution_status!=='Integrated')return res.status(409).json({error:'Approve the submitted task report before generating the final report.'})
  const assignment={title:current.assignment_title}
  const report=buildTaskContributionReport({task:current,assignment,ownerName:current.owner_name,preparedBy:current.owner_name})
  const approvalDate=new Date(current.contribution_integrated_at||Date.now())
  const approvalTime=new Intl.DateTimeFormat('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'}).format(approvalDate)
  const reviewerName=current.reviewer_name||req.user.name||'Authorised reviewer'
  const approvalBlock=`<section class="section"><h2>Review and Approval</h2><div class="callout"><p><strong>Status:</strong> FINAL — APPROVED</p><p><strong>Reviewed and approved by:</strong> ${escapeContributionHtml(reviewerName)}</p><p><strong>Approval date:</strong> ${escapeContributionHtml(approvalTime)}</p><p><strong>Task report version:</strong> ${Number(current.contribution_report_version||1)}</p></div></section>`
  const finalHtml=report.html.replace('</main>',`${approvalBlock}</main>`).replace('Generated by App2 from the task contribution record. Review this report before sending it for integration.','Final task report generated by App2 from the reviewer-approved task contribution record.')

  // Generate the immutable repository copy as DOCX. The final repository record is published immediately
  // because the same reviewer has already approved the submitted task report.
  const repositoryTitle=plainTaskReportText(current.contribution_title)||`${current.title} — Final Task Report`
  const repositorySections=[
    {title:'Task Purpose',content:plainTaskReportText(current.task_purpose||current.description)},
    {title:'Instructions',content:plainTaskReportText(current.specific_instructions)},
    {title:'Expected Contribution',content:plainTaskReportText(current.expected_contribution)},
    {title:'Work Completed',content:plainTaskReportText(current.contribution_summary||current.notes)},
    {title:'Evidence Reviewed',content:plainTaskReportText(current.evidence_reviewed)},
    {title:'Key Findings',content:plainTaskReportText(current.contribution_findings)},
    {title:'Challenges and Limitations',content:plainTaskReportText(current.contribution_challenges)},
    {title:'Recommendations',content:plainTaskReportText(current.contribution_recommendations)},
    {title:'Next Actions',content:plainTaskReportText(current.contribution_next_actions)},
    {title:'Review and Approval',content:`Status: FINAL — APPROVED\nReviewed and approved by: ${reviewerName}\nApproval date: ${approvalTime}\nTask report version: ${Number(current.contribution_report_version||1)}`}
  ]
  finalizationStage='generate-docx'
  const finalDocx=await buildDocx(repositoryTitle,{
    Assignment:current.assignment_title,
    Task:current.title,
    'Prepared by':current.owner_name||'Task owner',
    'Reviewed and approved by':reviewerName,
    Status:'FINAL — APPROVED',
    Version:Number(current.contribution_report_version||1),
    'Approval date':approvalTime
  },repositorySections)
  const safeBase=String(current.title||'task-report').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,90)||'task-report'
  const originalName=`${safeBase}-final-v${Number(current.contribution_report_version||1)}.docx`
  finalizationStage='store-docx'
  const stored=await storeDocument(finalDocx,'.docx')
  storedFinalPath=stored.absolutePath
  const sha256=crypto.createHash('sha256').update(finalDocx).digest('hex')
  const mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  finalizationStage='publish-repository'
  const result=await transaction(async client=>{
    const locked=(await client.query('SELECT contribution_status FROM assignment_tasks WHERE id=$1 AND assignment_id=$2 FOR UPDATE',[req.params.taskId,req.params.id])).rows[0]
    if(!locked)throw Object.assign(new Error('Task not found.'),{statusCode:404})
    if(locked.contribution_status!=='Integrated')throw Object.assign(new Error('This task report is no longer awaiting final generation. Refresh the workspace.'),{statusCode:409})

    const category=(await client.query("SELECT id FROM document_categories WHERE name='Assignment Reports' LIMIT 1")).rows[0]||null
    const description=`Final approved task report for “${current.title}” under assignment “${current.assignment_title}”. Prepared by ${current.owner_name||'the task owner'} and approved by ${reviewerName}.`
    const tags=['final-report','task-report','approved']
    const item=(await client.query(`INSERT INTO knowledge_items(
      title,description,category,category_id,tags,author,document_date,status,created_by,approved_by,approved_at,current_version,
      source_type,source_url,directorate,document_type,subject,classification,felix_enabled,reviewed_by,reviewed_at
    )VALUES($1,$2,'Assignment Reports',$3,$4,$5,CURRENT_DATE,'Published',$6,$6,NOW(),1,'Task','',$7,'Task Final Report',$8,'INTERNAL',TRUE,$6,NOW()) RETURNING *`,[
      repositoryTitle,description,category?.id||null,tags,current.owner_name||null,req.user.id,current.assignment_division||null,current.assignment_title
    ])).rows[0]
    const version=(await client.query(`INSERT INTO knowledge_versions(
      knowledge_id,version_number,uploader_id,original_name,stored_name,storage_path,mime_type,size_bytes,sha256_hash,is_current,approved_by,approved_at,notes
    )VALUES($1,1,$2,$3,$4,$5,$6,$7,$8,TRUE,$2,NOW(),'Automatically generated from reviewer-approved task report') RETURNING *`,[
      item.id,req.user.id,originalName,stored.storedName,stored.storagePath,mimeType,finalDocx.length,sha256
    ])).rows[0]

    finalizationStage='publish-tags'
    for(const tag of tags){
      const tagRow=(await client.query('INSERT INTO document_tags(name,normalized_name,created_by)VALUES($1::varchar,lower($1::text)::varchar,$2::uuid)ON CONFLICT(normalized_name)DO UPDATE SET name=EXCLUDED.name RETURNING id',[tag,req.user.id])).rows[0]
      await client.query('INSERT INTO document_tag_links(knowledge_id,tag_id)VALUES($1::uuid,$2::uuid)ON CONFLICT DO NOTHING',[item.id,tagRow.id])
    }
    finalizationStage='link-repository-source'
    await client.query("INSERT INTO repository_entity_links(knowledge_id,entity_type,entity_id,linked_by)VALUES($1::uuid,'task',$2::uuid,$3::uuid)ON CONFLICT DO NOTHING",[item.id,current.id,req.user.id])
    await client.query("INSERT INTO repository_entity_links(knowledge_id,entity_type,entity_id,linked_by)VALUES($1::uuid,'assignment',$2::uuid,$3::uuid)ON CONFLICT DO NOTHING",[item.id,req.params.id,req.user.id])
    await client.query('INSERT INTO knowledge_assignment_links(knowledge_id,assignment_id,linked_by)VALUES($1::uuid,$2::uuid,$3::uuid)ON CONFLICT DO NOTHING',[item.id,req.params.id,req.user.id])

    finalizationStage='complete-task'
    const row=(await client.query(`UPDATE assignment_tasks SET
      contribution_status='Accepted',
      status='Completed',
      progress=100,
      contribution_report_html=$1,
      contribution_report_generated_at=NOW(),
      contribution_updated_at=NOW(),
      updated_at=NOW()
      WHERE id=$2 AND assignment_id=$3 RETURNING *`,[finalHtml,req.params.taskId,req.params.id])).rows[0]
    await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[
      req.params.id,req.user.id,'TASK_FINAL_REPORT_GENERATED',JSON.stringify({taskId:row.id,title:row.title,reviewerId:req.user.id,reportVersion:Number(row.contribution_report_version||0),repositoryDocumentId:item.id,repositoryVersionId:version.id})
    ])
    await client.query(
      "UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=$1::uuid AND entity_type='assignment_task' AND entity_id=$2::text AND read_at IS NULL",
      [req.user.id,row.id]
    )
    finalizationStage='notify-owner'
    if(row.owner_id){
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Task completed',$2,'assignment_task',$3)",[
        row.owner_id,`The final approved report for “${row.title}” has been generated, published to the Document Repository, and the task is complete.`,row.id
      ])
    }
    finalizationStage='audit-final-report'
    await audit(client,req.user.id,'ASSIGNMENT_TASK_FINAL_REPORT_GENERATED','assignment_task',row.id,{assignmentId:req.params.id,reportVersion:Number(row.contribution_report_version||0),repositoryDocumentId:item.id})
    await audit(client,req.user.id,'DOCUMENT_AUTO_PUBLISHED_FROM_TASK','knowledge',item.id,{assignmentId:req.params.id,taskId:row.id,version:1,sha256,approvedBy:req.user.id})
    finalizationStage='enqueue-felix-index'
    await enqueueFelixDocumentIndex(client,item.id,1,req.user.id)
    finalizationStage='sync-assignment-status'
    await syncAssignmentStatusFromTasks(client,req.params.id,req.user.id)
    return {row,item}
  })
  finalizationStage='load-final-task'
  storedFinalPath=null
  const joined=(await query(`SELECT t.*,u.name owner_name,reviewer.name reviewer_name,gd.title target_document_title,gds.title target_section_title,assignment_section.title assignment_section_title
    FROM assignment_tasks t LEFT JOIN users u ON u.id=t.owner_id
    LEFT JOIN users reviewer ON reviewer.id=t.reviewer_id
    LEFT JOIN generated_documents gd ON gd.id=t.target_document_id
    LEFT JOIN generated_document_sections gds ON gds.id=t.target_section_id
    LEFT JOIN assignment_sections assignment_section ON assignment_section.id=t.assignment_section_id
    WHERE t.id=$1`,[result.row.id])).rows[0]
  finalizationStage='respond'
  res.json({...joined,repository_document_id:result.item.id,repository_document_title:result.item.title})
}catch(error){if(storedFinalPath)await fs.unlink(storedFinalPath).catch(()=>{});error.message=`Final report generation failed at ${finalizationStage}: ${error.message}`;next(error)}})

app.patch('/api/assignments/:id/tasks/:taskId/contribution-section',authenticate,validate(assignmentTaskContributionSectionSchema),async(req,res,next)=>{try{
  if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot update this task report section.'})
  const current=(await query('SELECT owner_id,reviewer_id,status,contribution_status FROM assignment_tasks WHERE id=$1 AND assignment_id=$2',[req.params.taskId,req.params.id])).rows[0]
  if(!current)return res.status(404).json({error:'Task not found.'})
  const {sectionKey,status,content}=req.validated
  if(current.owner_id!==req.user.id)return res.status(403).json({error:'Only the task owner can edit task-report content. Reviewers record decisions without rewriting the submitted report.'})
  if(current.status==='Blocked'||current.contribution_status!=='Draft')return res.status(409).json({error:'This task report is locked for the current workflow stage.'})
  if(status!=='Draft')return res.status(403).json({error:'Section review state is controlled by the formal task-report workflow.'})
  const columns={title:'contribution_title',workCompleted:'contribution_summary',evidence:'evidence_reviewed',findings:'contribution_findings',recommendations:'contribution_recommendations',challenges:'contribution_challenges',nextActions:'contribution_next_actions'}
  const column=columns[sectionKey]
  const cleanedContent=plainTaskReportText(content)
  const sectionContent=sectionKey==='title'?cleanedContent.slice(0,300):cleanedContent
  const updated=await transaction(async client=>{const row=(await client.query(`UPDATE assignment_tasks SET ${column}=$3::text,contribution_section_statuses=jsonb_set(COALESCE(contribution_section_statuses,'{}'::jsonb),ARRAY[$4::text],to_jsonb($5::text),true),contribution_updated_at=NOW(),updated_at=NOW() WHERE id=$1 AND assignment_id=$2 RETURNING *`,[req.params.taskId,req.params.id,sectionContent,sectionKey,status])).rows[0];await audit(client,req.user.id,'TASK_REPORT_SECTION_SAVED','assignment_task',row.id,{assignmentId:req.params.id,sectionKey,status});return row})
  res.json(updated)
}catch(error){next(error)}})

app.post('/api/assignments/:id/tasks/:taskId/archive',authenticate,authorize('Administrator','Research Manager'),async(req,res,next)=>{try{
  const row=await transaction(async client=>{
    const task=(await client.query('SELECT * FROM assignment_tasks WHERE id=$1 AND assignment_id=$2 FOR UPDATE',[req.params.taskId,req.params.id])).rows[0]
    if(!task)return null
    if(task.archived_at)return task
    const updated=(await client.query('UPDATE assignment_tasks SET archived_at=NOW(),archived_by=$1,updated_at=NOW() WHERE id=$2 AND assignment_id=$3 RETURNING *',[req.user.id,req.params.taskId,req.params.id])).rows[0]
    await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'TASK_ARCHIVED',JSON.stringify({taskId:updated.id,title:updated.title})])
    await syncAssignmentStatusFromTasks(client,req.params.id,req.user.id)
    await audit(client,req.user.id,'ASSIGNMENT_TASK_ARCHIVED','assignment_task',updated.id,{assignmentId:req.params.id,title:updated.title})
    return updated
  })
  if(!row)return res.status(404).json({error:'Task not found.'})
  res.json(row)
}catch(error){next(error)}})
app.delete('/api/assignments/:id/tasks/:taskId',authenticate,authorize('Administrator','Research Manager'),validate(z.object({reason:z.string().trim().min(10).max(1000)})),async(req,res,next)=>{try{
  const result=await transaction(async client=>{
    const task=(await client.query(`SELECT t.*,EXISTS(
      SELECT 1 FROM repository_entity_links rel
      WHERE rel.entity_type='task' AND rel.entity_id=t.id
    ) has_repository_record
    FROM assignment_tasks t WHERE t.id=$1 AND t.assignment_id=$2 FOR UPDATE`,[req.params.taskId,req.params.id])).rows[0]
    if(!task)return null
    if(task.status==='Completed'||task.contribution_status!=='Draft'||task.has_repository_record){
      throw Object.assign(new Error('This task has entered the formal reporting record and cannot be deleted. Archive it instead.'),{statusCode:409})
    }
    const reason=req.validated.reason.trim()
    await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'TASK_DELETED',JSON.stringify({taskId:task.id,title:task.title,status:task.status,ownerId:task.owner_id,reason})])
    await audit(client,req.user.id,'ASSIGNMENT_TASK_DELETED','assignment_task',task.id,{assignmentId:req.params.id,title:task.title,status:task.status,ownerId:task.owner_id,reason})
    if(task.owner_id&&task.owner_id!==req.user.id){
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Task deleted',$2,'assignment',$3)",[task.owner_id,`The task “${task.title}” was deleted by ${req.user.name||'an authorised manager'}. Reason: ${reason}`,req.params.id])
    }
    await client.query('DELETE FROM assignment_tasks WHERE id=$1 AND assignment_id=$2',[req.params.taskId,req.params.id])
    await syncAssignmentStatusFromTasks(client,req.params.id,req.user.id)
    return task
  })
  if(!result)return res.status(404).json({error:'Task not found.'})
  res.status(204).end()
}catch(error){if(error.statusCode)return res.status(error.statusCode).json({error:error.message});next(error)}})

app.get('/api/assignments/:id/reviews',authenticate,async(req,res,next)=>{try{if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot view reviews for this assignment.'});res.json((await query('SELECT r.*,u.name reviewer_name FROM assignment_reviews r JOIN users u ON u.id=r.reviewer_id WHERE r.assignment_id=$1 ORDER BY r.created_at DESC',[req.params.id])).rows)}catch(error){next(error)}})
app.post('/api/assignments/:id/reviews',authenticate,validate(z.object({decision:z.enum(['Submitted','Under Review','Changes Requested','Approved']),comments:z.string().max(4000).default('')})),async(req,res,next)=>{
  try{
    if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot review this assignment.'})
    if(req.validated.decision!=='Submitted'&&!['Administrator','Research Manager','Reviewer'].includes(req.user.role))return res.status(403).json({error:'Only a reviewer or manager can record a review decision.'})
    const row=await transaction(async client=>{
      const assignment=(await client.query('SELECT * FROM assignments WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]
      if(!assignment)throw Object.assign(new Error('Assignment not found.'),{status:404})
      const latest=(await client.query('SELECT decision FROM assignment_reviews WHERE assignment_id=$1 ORDER BY created_at DESC LIMIT 1',[req.params.id])).rows[0]?.decision||null
      const allowed={Submitted:[null,'Changes Requested'],'Under Review':['Submitted'],'Changes Requested':['Under Review'],Approved:['Under Review']}
      if(!allowed[req.validated.decision].includes(latest))throw Object.assign(new Error(`The “${req.validated.decision}” action is not valid after ${latest||'no submission'}. Refresh the Review tab.`),{status:409})
      if(req.validated.decision==='Submitted'){
        const readiness=(await client.query(`SELECT
          COUNT(*)::int active_tasks,
          COUNT(*) FILTER(WHERE t.status!='Completed')::int open_tasks,
          COUNT(*) FILTER(WHERE t.contribution_status<>'Accepted')::int pending_reports
          FROM assignment_tasks t WHERE t.assignment_id=$1 AND t.archived_at IS NULL`,[req.params.id])).rows[0]
        if(!readiness.active_tasks||readiness.open_tasks||readiness.pending_reports)throw Object.assign(new Error(`Assignment is not ready for review: assign at least one task, complete all work, and accept every task report. Current blockers: ${readiness.open_tasks} open task(s) and ${readiness.pending_reports} report(s) awaiting acceptance.`),{status:409})
      }
      if(req.validated.decision==='Changes Requested'&&!req.validated.comments.trim())throw Object.assign(new Error('Explain the required changes before returning the assignment.'),{status:400})
      const created=(await client.query('INSERT INTO assignment_reviews(assignment_id,reviewer_id,decision,comments)VALUES($1,$2,$3,$4)RETURNING *',[req.params.id,req.user.id,req.validated.decision,req.validated.comments])).rows[0]
      const status=req.validated.decision==='Submitted'||req.validated.decision==='Under Review'?'Ready for Review':req.validated.decision==='Changes Requested'?'In Progress':'Completed'
      await client.query('UPDATE assignments SET status=$1,updated_at=NOW() WHERE id=$2',[status,req.params.id])
      await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,`REVIEW_${req.validated.decision.toUpperCase().replaceAll(' ','_')}`,JSON.stringify({reviewId:created.id,comments:req.validated.comments})])
      await audit(client,req.user.id,'ASSIGNMENT_REVIEW_RECORDED','assignment_review',created.id,{assignmentId:req.params.id,decision:req.validated.decision,previousDecision:latest,status})
      return created
    })
    res.status(201).json(row)
  }catch(error){if(error.status)return res.status(error.status).json({error:error.message});next(error)}
})
app.get('/api/assignments/:id/comments',authenticate,async(req,res,next)=>{try{const result=await query('SELECT c.id,c.body,c.created_at,u.id author_id,u.name author_name FROM assignment_comments c JOIN users u ON u.id=c.author_id WHERE c.assignment_id=$1 ORDER BY c.created_at',[req.params.id]);res.json(result.rows)}catch(error){next(error)}})
app.post('/api/assignments/:id/comments',authenticate,validate(z.object({body:z.string().min(1).max(4000)})),async(req,res,next)=>{try{if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot comment on this assignment.'});const result=await transaction(async client=>{const created=(await client.query('INSERT INTO assignment_comments(assignment_id,author_id,body) VALUES($1,$2,$3) RETURNING *',[req.params.id,req.user.id,req.validated.body])).rows[0];await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details) VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'COMMENTED',JSON.stringify({commentId:created.id})]);return created});res.status(201).json(result)}catch(error){next(error)}})
app.get('/api/assignments/:id/history',authenticate,async(req,res,next)=>{try{if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot view this assignment.'});res.json((await query('SELECT h.id,h.action,h.details,h.created_at,u.name user_name FROM assignment_history h LEFT JOIN users u ON u.id=h.user_id WHERE h.assignment_id=$1 ORDER BY h.created_at DESC',[req.params.id])).rows)}catch(error){next(error)}})
app.get('/api/assignments/:id/attachments',authenticate,async(req,res,next)=>{try{if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot view this assignment.'});res.json((await query('SELECT a.id,a.original_name,a.mime_type,a.size_bytes,a.created_at,u.name uploader_name FROM assignment_attachments a JOIN users u ON u.id=a.uploader_id WHERE a.assignment_id=$1 ORDER BY a.created_at DESC',[req.params.id])).rows)}catch(error){next(error)}})
app.post('/api/assignments/:id/attachments',authenticate,async(req,res,next)=>{try{if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot attach files to this assignment.'});let submittedName=String(req.headers['x-file-name']||'attachment.bin');try{submittedName=decodeURIComponent(submittedName)}catch{}const originalName=path.basename(submittedName).slice(0,255);if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({error:'Choose a non-empty file to upload.'});const storedName=`${crypto.randomUUID()}${path.extname(originalName).slice(0,12)}`;const uploadDir=path.resolve(config.uploadDir);await fs.mkdir(uploadDir,{recursive:true});await fs.writeFile(path.join(uploadDir,storedName),req.body,{flag:'wx'});const created=await transaction(async client=>{const row=(await client.query('INSERT INTO assignment_attachments(assignment_id,uploader_id,original_name,stored_name,mime_type,size_bytes) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,original_name,mime_type,size_bytes,created_at',[req.params.id,req.user.id,originalName,storedName,String(req.headers['x-file-type']||'application/octet-stream').slice(0,160),req.body.length])).rows[0];await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details) VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'FILE_ATTACHED',JSON.stringify({attachmentId:row.id,name:originalName})]);return row});res.status(201).json(created)}catch(error){next(error)}})
app.get('/api/attachments/:id/download',authenticate,async(req,res,next)=>{try{const attachment=(await query('SELECT * FROM assignment_attachments WHERE id=$1',[req.params.id])).rows[0];if(!attachment)return res.status(404).json({error:'Attachment not found.'});if(!await canAccessAssignment(req.user,attachment.assignment_id))return res.status(403).json({error:'You cannot download this file.'});res.setHeader('Content-Type',attachment.mime_type);res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(attachment.original_name)}`);res.sendFile(path.resolve(config.uploadDir,attachment.stored_name))}catch(error){next(error)}})

app.get('/api/knowledge',authenticate,async(req,res,next)=>{try{const search=String(req.query.search||'').trim();const category=String(req.query.category||'').trim();const status=String(req.query.status||'').trim();const privileged=canReviewKnowledge(req.user);const result=await query(`SELECT k.*,u.name created_by_name,approver.name approved_by_name,COALESCE((SELECT json_agg(json_build_object('id',a.id,'title',a.title)) FROM knowledge_assignment_links l JOIN assignments a ON a.id=l.assignment_id WHERE l.knowledge_id=k.id),'[]') assignments,(SELECT COUNT(*)::int FROM knowledge_downloads d WHERE d.knowledge_id=k.id) download_count FROM knowledge_items k JOIN users u ON u.id=k.created_by LEFT JOIN users approver ON approver.id=k.approved_by WHERE($1::boolean OR k.status='Published' OR k.created_by=$2)AND($3='' OR k.category=$3)AND($4='' OR k.status=$4)AND($5='' OR to_tsvector('english',k.title||' '||k.description||' '||COALESCE(k.author,''))@@plainto_tsquery('english',$5) OR $5=ANY(k.tags)) ORDER BY k.updated_at DESC`,[privileged,req.user.id,category,status,search]);res.json(result.rows)}catch(error){next(error)}})
app.post('/api/knowledge',authenticate,async(req,res,next)=>{
  let storedPath
  try{
    if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({error:'Choose a non-empty file to upload.'})
    const checked=validateDocumentUpload(req.body,decodeHeader(req.headers['x-file-name']||'document.bin'),req.headers['x-file-type'])
    const {originalName}=checked
    const parsed=knowledgeSchema.safeParse({title:decodeHeader(req.headers['x-title']),description:decodeHeader(req.headers['x-description']),category:decodeHeader(req.headers['x-category']),categoryId:req.headers['x-category-id']||null,tags:decodeHeader(req.headers['x-tags']).split(',').map(tag=>tag.trim()).filter(Boolean),author:req.headers['x-author']?decodeHeader(req.headers['x-author']):null,documentDate:req.headers['x-document-date']?decodeHeader(req.headers['x-document-date']):null,sourceType:decodeHeader(req.headers['x-source-type']||'App2 Upload'),sourceUrl:decodeHeader(req.headers['x-source-url']||''),originEntityId:req.headers['x-origin-entity-id']?String(req.headers['x-origin-entity-id']):null,directorate:req.headers['x-directorate']?decodeHeader(req.headers['x-directorate']):null,documentType:decodeHeader(req.headers['x-document-type']||'Document'),subject:decodeHeader(req.headers['x-subject']||''),classification:decodeHeader(req.headers['x-classification']||'INTERNAL'),felixEnabled:String(req.headers['x-felix-enabled']).toLowerCase()!=='false'})
    if(!parsed.success)return res.status(400).json({error:'Please correct the document metadata.',details:parsed.error.flatten()})
    const {title,description,category,categoryId,tags,author,documentDate,sourceType,sourceUrl,originEntityId,directorate,documentType,subject,classification,felixEnabled}=parsed.data
    if(sourceType==='Internet'&&!/^https?:\/\//i.test(sourceUrl))return res.status(400).json({error:'Internet documents require a valid source URL.'})
    if(['Research','Assignment','Task','App2 Report'].includes(sourceType)&&!originEntityId)return res.status(400).json({error:`${sourceType} documents must identify their originating App2 record.`})
    const entityType=sourceType==='Research'?'research':sourceType==='Assignment'?'assignment':sourceType==='Task'?'task':sourceType==='App2 Report'?'report':null
    if(originEntityId&&!canManageKnowledge(req.user)){
      const permitted=entityType==='assignment'?await canAccessAssignment(req.user,originEntityId):entityType==='research'?await canAccessResearch(req.user,originEntityId):entityType==='task'?Boolean((await query('SELECT 1 FROM assignment_tasks t WHERE t.id=$1 AND(t.owner_id=$2 OR EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=t.assignment_id AND am.user_id=$2))',[originEntityId,req.user.id])).rowCount):entityType==='report'?Boolean((await query('SELECT 1 FROM generated_documents WHERE id=$1 AND(created_by=$2 OR reviewer_id=$2)',[originEntityId,req.user.id])).rowCount):true
      if(!permitted)return res.status(403).json({error:'You cannot link this source record.'})
    }
    const stored=await storeDocument(req.body,checked.extension);storedPath=stored.absolutePath
    const created=await transaction(async client=>{
      const item=(await client.query('INSERT INTO knowledge_items(title,description,category,category_id,tags,author,document_date,source_type,source_url,created_by,current_version,directorate,document_type,subject,classification,felix_enabled)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,$11,$12,$13,$14,$15)RETURNING *',[title,description,category,categoryId,[...new Set(tags)],author||null,documentDate||null,sourceType,sourceUrl,req.user.id,directorate,documentType,subject,classification,felixEnabled])).rows[0]
      const version=(await client.query('INSERT INTO knowledge_versions(knowledge_id,version_number,uploader_id,original_name,stored_name,storage_path,mime_type,size_bytes,sha256_hash,is_current)VALUES($1,1,$2,$3,$4,$5,$6,$7,$8,TRUE)RETURNING id,version_number,original_name,mime_type,size_bytes,sha256_hash,is_current,notes,created_at',[item.id,req.user.id,originalName,stored.storedName,stored.storagePath,checked.mimeType,req.body.length,checked.sha256])).rows[0]
      for(const tag of [...new Set(tags.map(value=>value.trim()).filter(Boolean))]){const tagRow=(await client.query('INSERT INTO document_tags(name,normalized_name,created_by)VALUES($1,lower($1),$2)ON CONFLICT(normalized_name)DO UPDATE SET name=EXCLUDED.name RETURNING id',[tag,req.user.id])).rows[0];await client.query('INSERT INTO document_tag_links(knowledge_id,tag_id)VALUES($1,$2)ON CONFLICT DO NOTHING',[item.id,tagRow.id])}
      if(entityType&&originEntityId)await client.query('INSERT INTO repository_entity_links(knowledge_id,entity_type,entity_id,linked_by)VALUES($1,$2,$3,$4)ON CONFLICT DO NOTHING',[item.id,entityType,originEntityId,req.user.id])
      if(entityType==='assignment'&&originEntityId)await client.query('INSERT INTO knowledge_assignment_links(knowledge_id,assignment_id,linked_by)VALUES($1,$2,$3)ON CONFLICT DO NOTHING',[item.id,originEntityId,req.user.id])
      await audit(client,req.user.id,'DOCUMENT_UPLOADED','knowledge',item.id,{title,category,classification,felixEnabled,version:1,sha256:checked.sha256,sourceType,sourceUrl,entityType,originEntityId})
      return {...item,version}
    })
    res.status(201).json(created)
  }catch(error){if(storedPath)await fs.unlink(storedPath).catch(()=>{});next(error)}
})
app.patch('/api/knowledge/:id',authenticate,validate(knowledgeSchema),async(req,res,next)=>{try{const existing=(await query('SELECT * FROM knowledge_items WHERE id=$1',[req.params.id])).rows[0];if(!existing)return res.status(404).json({error:'Knowledge item not found.'});if(!canManageKnowledge(req.user)&&existing.created_by!==req.user.id)return res.status(403).json({error:'You cannot edit this knowledge item.'});if(existing.status==='Published'&&!canManageKnowledge(req.user))return res.status(403).json({error:'Only a manager can edit published knowledge.'});const {title,description,category,tags,author,documentDate}=req.validated;const updated=await transaction(async client=>{const row=(await client.query('UPDATE knowledge_items SET title=$1,description=$2,category=$3,tags=$4,author=$5,document_date=$6,updated_at=NOW() WHERE id=$7 RETURNING *',[title,description,category,[...new Set(tags.map(tag=>tag.trim()))],author||null,documentDate||null,req.params.id])).rows[0];await audit(client,req.user.id,'KNOWLEDGE_UPDATED','knowledge',req.params.id,{title,category});return row});res.json(updated)}catch(error){next(error)}})
app.post('/api/knowledge/:id/versions',authenticate,async(req,res,next)=>{let storedPath;try{const item=(await query('SELECT * FROM knowledge_items WHERE id=$1',[req.params.id])).rows[0];if(!item)return res.status(404).json({error:'Knowledge item not found.'});if(!canManageKnowledge(req.user)&&item.created_by!==req.user.id)return res.status(403).json({error:'You cannot upload a version for this item.'});const checked=validateDocumentUpload(req.body,decodeHeader(req.headers['x-file-name']||'document.bin'),req.headers['x-file-type']);const duplicate=(await query('SELECT v.id,v.version_number,k.id document_id,k.title,v.created_at upload_date FROM knowledge_versions v JOIN knowledge_items k ON k.id=v.knowledge_id WHERE v.sha256_hash=$1',[checked.sha256])).rows[0];if(duplicate)return res.status(409).json({error:`This exact file is already stored as “${duplicate.title}” (version ${duplicate.version_number}).`,duplicate:{...duplicate,sha256_hash:checked.sha256}});const stored=await storeDocument(req.body,checked.extension);storedPath=stored.absolutePath;const created=await transaction(async client=>{const locked=(await client.query('SELECT current_version FROM knowledge_items WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];const number=locked.current_version+1;await client.query('UPDATE knowledge_versions SET is_current=FALSE WHERE knowledge_id=$1',[req.params.id]);const row=(await client.query('INSERT INTO knowledge_versions(knowledge_id,version_number,uploader_id,original_name,stored_name,storage_path,mime_type,size_bytes,sha256_hash,notes,is_current) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE) RETURNING id,version_number,original_name,mime_type,size_bytes,sha256_hash,is_current,notes,created_at',[req.params.id,number,req.user.id,checked.originalName,stored.storedName,stored.storagePath,checked.mimeType,req.body.length,checked.sha256,String(req.headers['x-version-notes']||'').slice(0,1000)])).rows[0];await client.query("UPDATE knowledge_items SET current_version=$1,status=CASE WHEN status='Published' THEN 'Draft' ELSE status END,approved_by=NULL,approved_at=NULL,updated_at=NOW() WHERE id=$2",[number,req.params.id]);await audit(client,req.user.id,'DOCUMENT_VERSION_UPLOADED','knowledge',req.params.id,{version:number,name:checked.originalName,sha256:checked.sha256});return row});res.status(201).json(created)}catch(error){if(storedPath)await fs.unlink(storedPath).catch(()=>{});next(error)}})
app.get('/api/knowledge/:id/versions',authenticate,async(req,res,next)=>{try{if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot view this knowledge item.'});res.json((await query('SELECT v.id,v.version_number,v.original_name,v.mime_type,v.size_bytes,v.notes,v.created_at,u.name uploader_name FROM knowledge_versions v JOIN users u ON u.id=v.uploader_id WHERE v.knowledge_id=$1 ORDER BY v.version_number DESC',[req.params.id])).rows)}catch(error){next(error)}})
app.get('/api/knowledge/versions/:versionId/download',authenticate,async(req,res,next)=>{try{const version=(await query('SELECT v.*,k.status,k.created_by FROM knowledge_versions v JOIN knowledge_items k ON k.id=v.knowledge_id WHERE v.id=$1',[req.params.versionId])).rows[0];if(!version)return res.status(404).json({error:'Document version not found.'});if(!await canReadKnowledge(req.user,version.knowledge_id))return res.status(403).json({error:'You cannot download this document.'});await transaction(async client=>{await client.query('INSERT INTO knowledge_downloads(knowledge_id,version_id,user_id) VALUES($1,$2,$3)',[version.knowledge_id,version.id,req.user.id]);await audit(client,req.user.id,'DOCUMENT_DOWNLOADED','knowledge',version.knowledge_id,{versionId:version.id,version:version.version_number})});res.setHeader('Content-Type',version.mime_type);res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(version.original_name)}`);res.sendFile(resolveDocumentPath(version.storage_path||version.stored_name))}catch(error){next(error)}})
app.patch('/api/knowledge/:id/status',authenticate,validate(z.object({status:z.enum(['Draft','Pending Approval','Published','Rejected','Archived']),reason:z.string().max(1000).optional()})),async(req,res,next)=>{try{const item=(await query('SELECT * FROM knowledge_items WHERE id=$1',[req.params.id])).rows[0];if(!item)return res.status(404).json({error:'Knowledge item not found.'});if(await activeExternalResearchForKnowledge(req.params.id))return res.status(409).json({error:'This document is controlled by the Imported Research reader. Record review decisions from Research Repository > Imported Research.'});const target=req.validated.status;if(['Published','Rejected','Archived'].includes(target)&&!canReviewKnowledge(req.user))return res.status(403).json({error:'Only a reviewer or manager can approve, reject, or archive knowledge.'});if(['Draft','Pending Approval'].includes(target)&&!canManageKnowledge(req.user)&&item.created_by!==req.user.id)return res.status(403).json({error:'You cannot submit this knowledge item.'});if(target==='Published'&&item.current_version<1)return res.status(400).json({error:'Upload a document version before publishing.'});const updated=await transaction(async client=>{const approved=target==='Published';const row=(await client.query("UPDATE knowledge_items SET status=$1,is_archived=($1='Archived'),reviewed_by=CASE WHEN $1 IN('Published','Rejected') THEN $2 ELSE reviewed_by END,reviewed_at=CASE WHEN $1 IN('Published','Rejected') THEN NOW() ELSE reviewed_at END,approved_by=$3,approved_at=$4,rejection_reason=$5,updated_at=NOW() WHERE id=$6 RETURNING *",[target,req.user.id,approved?req.user.id:null,approved?new Date():null,target==='Rejected'?(req.validated.reason||'Not approved'):null,req.params.id])).rows[0];if(approved)await client.query('UPDATE knowledge_versions SET approved_by=$1,approved_at=NOW() WHERE knowledge_id=$2 AND is_current=TRUE',[req.user.id,row.id]);await audit(client,req.user.id,`DOCUMENT_${target.toUpperCase().replaceAll(' ','_')}`,'knowledge',req.params.id,{reason:req.validated.reason});if(target==='Published'&&row.felix_enabled)await enqueueFelixDocumentIndex(client,row.id,row.current_version,req.user.id);if(target==='Archived')await client.query("UPDATE felix_document_index_jobs SET status='Failed',last_error='Document archived',updated_at=NOW() WHERE knowledge_id=$1 AND status IN('Pending','Processing','Completed')",[row.id]);return row});res.json(updated)}catch(error){next(error)}})
app.patch('/api/knowledge/:id/approve',authenticate,authorize('Administrator','Research Manager','Reviewer'),validate(z.object({approved:z.boolean().default(true),reason:z.string().max(1000).optional()})),async(req,res,next)=>{try{if(await activeExternalResearchForKnowledge(req.params.id))return res.status(409).json({error:'This document is controlled by the Imported Research reader. Approve, request revision, or reject it there.'});const target=req.validated.approved?'Published':'Rejected';const updated=await transaction(async client=>{const item=(await client.query('SELECT * FROM knowledge_items WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!item)return null;if(target==='Published'&&item.current_version<1)throw new Error('Upload a document version before publishing.');const row=(await client.query('UPDATE knowledge_items SET status=$1,is_archived=FALSE,reviewed_by=$2,reviewed_at=NOW(),approved_by=$3,approved_at=$4,rejection_reason=$5,updated_at=NOW() WHERE id=$6 RETURNING *',[target,req.user.id,target==='Published'?req.user.id:null,target==='Published'?new Date():null,target==='Rejected'?(req.validated.reason||'Not approved'):null,req.params.id])).rows[0];if(target==='Published')await client.query('UPDATE knowledge_versions SET approved_by=$1,approved_at=NOW() WHERE knowledge_id=$2 AND is_current=TRUE',[req.user.id,row.id]);await audit(client,req.user.id,target==='Published'?'DOCUMENT_APPROVED':'DOCUMENT_REJECTED','knowledge',req.params.id,{reason:req.validated.reason});if(target==='Published'&&row.felix_enabled)await enqueueFelixDocumentIndex(client,row.id,row.current_version,req.user.id);return row});if(!updated)return res.status(404).json({error:'Knowledge item not found.'});res.json(updated)}catch(error){next(error)}})
app.post('/api/knowledge/:id/assignments',authenticate,validate(z.object({assignmentId:z.string().uuid()})),async(req,res,next)=>{try{if(!canManageKnowledge(req.user)&&!await canAccessAssignment(req.user,req.validated.assignmentId))return res.status(403).json({error:'You cannot link this assignment.'});await transaction(async client=>{await client.query('INSERT INTO knowledge_assignment_links(knowledge_id,assignment_id,linked_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[req.params.id,req.validated.assignmentId,req.user.id]);await audit(client,req.user.id,'KNOWLEDGE_ASSIGNMENT_LINKED','knowledge',req.params.id,{assignmentId:req.validated.assignmentId})});res.status(204).end()}catch(error){next(error)}})
app.delete('/api/knowledge/:id/assignments/:assignmentId',authenticate,async(req,res,next)=>{try{if(!canManageKnowledge(req.user)&&!await canAccessAssignment(req.user,req.params.assignmentId))return res.status(403).json({error:'You cannot unlink this assignment.'});await transaction(async client=>{await client.query('DELETE FROM knowledge_assignment_links WHERE knowledge_id=$1 AND assignment_id=$2',[req.params.id,req.params.assignmentId]);await audit(client,req.user.id,'KNOWLEDGE_ASSIGNMENT_UNLINKED','knowledge',req.params.id,{assignmentId:req.params.assignmentId})});res.status(204).end()}catch(error){next(error)}})
app.get('/api/knowledge/:id/downloads',authenticate,authorize('Administrator','Research Manager'),async(req,res,next)=>{try{res.json((await query('SELECT d.id,d.downloaded_at,v.version_number,v.original_name,u.name user_name FROM knowledge_downloads d JOIN knowledge_versions v ON v.id=d.version_id JOIN users u ON u.id=d.user_id WHERE d.knowledge_id=$1 ORDER BY d.downloaded_at DESC',[req.params.id])).rows)}catch(error){next(error)}})

const externalResearchImportMetaSchema=z.object({
  title:z.string().trim().min(3).max(240),
  description:z.string().max(5000).default(''),
  author:z.string().max(200).default(''),
  institution:z.string().max(200).default(''),
  directorate:z.string().max(160).default(''),
  researchType:z.string().trim().min(2).max(100).default('Research Report'),
  researchDate:z.string().nullable().default(null),
  tags:z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  classification:z.enum(['PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED']).default('INTERNAL'),
  reviewerIds:z.array(z.string().uuid()).min(1).max(5),
  felixEnabled:z.boolean().default(true)
})
const canReviewExternalResearchImport=async(user,id)=>{
  if(['Administrator','Research Manager'].includes(user.role))return true
  return (await query('SELECT 1 FROM external_research_import_reviewers WHERE import_id=$1 AND reviewer_id=$2 AND active=TRUE',[id,user.id])).rowCount>0
}
const canAccessExternalResearchImport=async(user,id)=>{
  if(['Administrator','Research Manager'].includes(user.role))return true
  return (await query(`SELECT 1 FROM external_research_imports i
    WHERE i.id=$1 AND(i.submitted_by=$2 OR EXISTS(
      SELECT 1 FROM external_research_import_reviewers r
      WHERE r.import_id=i.id AND r.reviewer_id=$2 AND r.active=TRUE
    ))`,[id,user.id])).rowCount>0
}
const loadExternalResearchImport=async(id,user)=>{
  const management=['Administrator','Research Manager'].includes(user.role)
  return (await query(`SELECT i.id,i.knowledge_id,i.submitted_by,i.institution,i.research_type,i.status,i.revision_ready,i.submitted_at,i.updated_at,i.published_at,
    k.title,k.description,k.author,k.document_date,k.directorate,k.classification,k.tags,k.current_version,k.felix_enabled,k.status document_status,
    submitter.name submitted_by_name,
    v.id current_version_id,v.original_name,v.mime_type,v.size_bytes,
    COALESCE((SELECT json_agg(json_build_object('id',r.id,'reviewer_id',r.reviewer_id,'name',u.name,'role',u.role,'division',u.division,'assigned_at',r.assigned_at) ORDER BY u.name)
      FROM external_research_import_reviewers r JOIN users u ON u.id=r.reviewer_id WHERE r.import_id=i.id AND r.active=TRUE),'[]'::json) reviewers,
    COALESCE((SELECT json_agg(json_build_object('id',rv.id,'version_number',rv.version_number,'decision',rv.decision,'notes',rv.notes,'created_at',rv.created_at,'reviewer_id',rv.reviewer_id,'reviewer_name',ru.name) ORDER BY rv.created_at DESC)
      FROM external_research_import_reviews rv JOIN users ru ON ru.id=rv.reviewer_id WHERE rv.import_id=i.id),'[]'::json) reviews,
    COALESCE((SELECT json_agg(json_build_object('id',kv.id,'version_number',kv.version_number,'original_name',kv.original_name,'mime_type',kv.mime_type,'size_bytes',kv.size_bytes,'notes',kv.notes,'created_at',kv.created_at,'uploader_name',vu.name,'is_current',kv.is_current) ORDER BY kv.version_number DESC)
      FROM knowledge_versions kv JOIN users vu ON vu.id=kv.uploader_id WHERE kv.knowledge_id=i.knowledge_id),'[]'::json) versions,
    ($2::boolean OR i.submitted_by=$3) can_upload_revision,
    ($2::boolean OR EXISTS(SELECT 1 FROM external_research_import_reviewers er WHERE er.import_id=i.id AND er.reviewer_id=$3 AND er.active=TRUE)) can_review
    FROM external_research_imports i
    JOIN knowledge_items k ON k.id=i.knowledge_id
    JOIN users submitter ON submitter.id=i.submitted_by
    LEFT JOIN knowledge_versions v ON v.knowledge_id=k.id AND v.is_current=TRUE
    WHERE i.id=$1`,[id,management,user.id])).rows[0]
}

app.get('/api/research-imports',authenticate,async(req,res,next)=>{try{
  const management=['Administrator','Research Manager'].includes(req.user.role)
  const rows=(await query(`SELECT i.id,i.knowledge_id,i.submitted_by,i.institution,i.research_type,i.status,i.revision_ready,i.submitted_at,i.updated_at,i.published_at,
    k.title,k.description,k.author,k.document_date,k.directorate,k.classification,k.tags,k.current_version,k.felix_enabled,k.status document_status,
    submitter.name submitted_by_name,v.id current_version_id,v.original_name,v.mime_type,v.size_bytes,
    COALESCE((SELECT json_agg(json_build_object('id',r.id,'reviewer_id',r.reviewer_id,'name',u.name,'role',u.role,'division',u.division,'assigned_at',r.assigned_at) ORDER BY u.name)
      FROM external_research_import_reviewers r JOIN users u ON u.id=r.reviewer_id WHERE r.import_id=i.id AND r.active=TRUE),'[]'::json) reviewers,
    ($1::boolean OR i.submitted_by=$2) can_upload_revision,
    ($1::boolean OR EXISTS(SELECT 1 FROM external_research_import_reviewers er WHERE er.import_id=i.id AND er.reviewer_id=$2 AND er.active=TRUE)) can_review
    FROM external_research_imports i
    JOIN knowledge_items k ON k.id=i.knowledge_id
    JOIN users submitter ON submitter.id=i.submitted_by
    LEFT JOIN knowledge_versions v ON v.knowledge_id=k.id AND v.is_current=TRUE
    WHERE $1::boolean OR i.submitted_by=$2 OR EXISTS(SELECT 1 FROM external_research_import_reviewers er WHERE er.import_id=i.id AND er.reviewer_id=$2 AND er.active=TRUE)
    ORDER BY i.updated_at DESC`,[management,req.user.id])).rows
  res.json(rows)
}catch(error){next(error)}})

app.get('/api/research-imports/:id',authenticate,async(req,res,next)=>{try{
  if(!await canAccessExternalResearchImport(req.user,req.params.id))return res.status(403).json({error:'You cannot access this imported research record.'})
  const row=await loadExternalResearchImport(req.params.id,req.user)
  if(!row)return res.status(404).json({error:'Imported research record not found.'})
  res.json(row)
}catch(error){next(error)}})

app.post('/api/research-imports',authenticate,rejectDuplicateKnowledgeUpload,async(req,res,next)=>{
  let storedPath
  try{
    if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({error:'Choose the completed research file to import.'})
    const checked=validateDocumentUpload(req.body,decodeHeader(req.headers['x-file-name']||'research.pdf'),req.headers['x-file-type'])
    const reviewerIds=decodeHeader(req.headers['x-reviewer-ids']||'').split(',').map(value=>value.trim()).filter(Boolean)
    const parsed=externalResearchImportMetaSchema.safeParse({
      title:decodeHeader(req.headers['x-title']),description:decodeHeader(req.headers['x-description']||''),author:decodeHeader(req.headers['x-author']||''),institution:decodeHeader(req.headers['x-institution']||''),directorate:decodeHeader(req.headers['x-directorate']||''),researchType:decodeHeader(req.headers['x-research-type']||'Research Report'),researchDate:req.headers['x-research-date']?decodeHeader(req.headers['x-research-date']):null,tags:decodeHeader(req.headers['x-tags']||'').split(',').map(value=>value.trim()).filter(Boolean),classification:decodeHeader(req.headers['x-classification']||'INTERNAL'),reviewerIds,felixEnabled:String(req.headers['x-felix-enabled']).toLowerCase()!=='false'
    })
    if(!parsed.success)return res.status(400).json({error:'Please correct the imported research metadata.',details:parsed.error.flatten()})
    const meta=parsed.data
    const reviewers=(await query("SELECT id,name,role FROM users WHERE id=ANY($1::uuid[]) AND active=TRUE AND role IN('Reviewer','Research Manager','Administrator')",[meta.reviewerIds])).rows
    if(reviewers.length!==new Set(meta.reviewerIds).size)return res.status(400).json({error:'Choose only active authorised reviewers or research managers.'})
    const stored=await storeDocument(req.body,checked.extension);storedPath=stored.absolutePath
    const importId=crypto.randomUUID()
    const ids=await transaction(async client=>{
      const item=(await client.query(`INSERT INTO knowledge_items(title,description,category,tags,author,document_date,source_type,source_url,created_by,current_version,directorate,document_type,subject,classification,felix_enabled,status,reviewer_id)
        VALUES($1,$2,'Research',$3,$4,$5,'External Upload','',$6,1,$7,'Research Report',$8,$9,$10,'Pending Approval',$11) RETURNING *`,[meta.title,meta.description,[...new Set(meta.tags)],meta.author||null,meta.researchDate||null,req.user.id,meta.directorate||null,meta.researchType,meta.classification,meta.felixEnabled,meta.reviewerIds[0]])).rows[0]
      const version=(await client.query('INSERT INTO knowledge_versions(knowledge_id,version_number,uploader_id,original_name,stored_name,storage_path,mime_type,size_bytes,sha256_hash,notes,is_current)VALUES($1,1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE)RETURNING *',[item.id,req.user.id,checked.originalName,stored.storedName,stored.storagePath,checked.mimeType,req.body.length,checked.sha256,'Initial external research import'])).rows[0]
      await client.query('INSERT INTO external_research_imports(id,knowledge_id,submitted_by,institution,research_type,status)VALUES($1,$2,$3,$4,$5,\'Pending Review\')',[importId,item.id,req.user.id,meta.institution||null,meta.researchType])
      for(const reviewerId of [...new Set(meta.reviewerIds)]){
        await client.query('INSERT INTO external_research_import_reviewers(import_id,reviewer_id,assigned_by)VALUES($1,$2,$3)',[importId,reviewerId,req.user.id])
        await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Imported research ready for review',$2,'external_research_import',$3)",[reviewerId,`Review imported research “${meta.title}”. Open Research Repository > Imported Research.`,importId])
      }
      for(const tag of [...new Set(meta.tags)]){const tagRow=(await client.query('INSERT INTO document_tags(name,normalized_name,created_by)VALUES($1,lower($1),$2)ON CONFLICT(normalized_name)DO UPDATE SET name=EXCLUDED.name RETURNING id',[tag,req.user.id])).rows[0];await client.query('INSERT INTO document_tag_links(knowledge_id,tag_id)VALUES($1,$2)ON CONFLICT DO NOTHING',[item.id,tagRow.id])}
      await audit(client,req.user.id,'EXTERNAL_RESEARCH_IMPORTED','external_research_import',importId,{knowledgeId:item.id,title:meta.title,reviewerIds:meta.reviewerIds,version:1,sha256:checked.sha256})
      return {importId,knowledgeId:item.id,versionId:version.id}
    })
    storedPath=null
    const row=await loadExternalResearchImport(ids.importId,req.user)
    res.status(201).json(row)
  }catch(error){if(storedPath)await fs.unlink(storedPath).catch(()=>{});next(error)}
})

app.post('/api/research-imports/:id/start-review',authenticate,async(req,res,next)=>{try{
  if(!await canReviewExternalResearchImport(req.user,req.params.id))return res.status(403).json({error:'Only an assigned reviewer or research manager can review this import.'})
  const result=await transaction(async client=>{
    const current=(await client.query('SELECT * FROM external_research_imports WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]
    if(!current)return null
    if(!['Pending Review','Resubmitted'].includes(current.status))throw Object.assign(new Error(`Review cannot start while the import is ${current.status}.`),{status:409})
    const version=Number((await client.query('SELECT current_version FROM knowledge_items WHERE id=$1',[current.knowledge_id])).rows[0]?.current_version||1)
    const row=(await client.query("UPDATE external_research_imports SET status='Under Review',updated_at=NOW() WHERE id=$1 RETURNING *",[current.id])).rows[0]
    await client.query("INSERT INTO external_research_import_reviews(import_id,version_number,reviewer_id,decision,notes)VALUES($1,$2,$3,'Review Started','')",[current.id,version,req.user.id])
    await audit(client,req.user.id,'EXTERNAL_RESEARCH_REVIEW_STARTED','external_research_import',current.id,{version})
    return row
  })
  if(!result)return res.status(404).json({error:'Imported research record not found.'})
  res.json(await loadExternalResearchImport(req.params.id,req.user))
}catch(error){if(error.status)return res.status(error.status).json({error:error.message});next(error)}})

app.post('/api/research-imports/:id/decision',authenticate,validate(z.object({decision:z.enum(['Request Revision','Approve','Reject']),notes:z.string().max(5000).default('')})),async(req,res,next)=>{try{
  if(!await canReviewExternalResearchImport(req.user,req.params.id))return res.status(403).json({error:'Only an assigned reviewer or research manager can record this decision.'})
  if(['Request Revision','Reject'].includes(req.validated.decision)&&!req.validated.notes.trim())return res.status(400).json({error:'Review notes are required for revision requests and rejection.'})
  const outcome=await transaction(async client=>{
    const current=(await client.query('SELECT * FROM external_research_imports WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]
    if(!current)return null
    if(current.status!=='Under Review')throw Object.assign(new Error(`A decision cannot be recorded while the import is ${current.status}. Start the review first.`),{status:409})
    const item=(await client.query('SELECT * FROM knowledge_items WHERE id=$1 FOR UPDATE',[current.knowledge_id])).rows[0]
    const version=Number(item.current_version||1)
    const decision=req.validated.decision
    const eventDecision=decision==='Approve'?'Approved':decision==='Reject'?'Rejected':'Revision Requested'
    await client.query('INSERT INTO external_research_import_reviews(import_id,version_number,reviewer_id,decision,notes)VALUES($1,$2,$3,$4,$5)',[current.id,version,req.user.id,eventDecision,req.validated.notes.trim()])
    if(decision==='Request Revision'){
      await client.query("UPDATE external_research_imports SET status='Revision Requested',revision_ready=FALSE,updated_at=NOW() WHERE id=$1",[current.id])
      await client.query("UPDATE knowledge_items SET status='Pending Approval',approved_by=NULL,approved_at=NULL,rejection_reason=NULL,reviewed_by=$1,reviewed_at=NOW(),updated_at=NOW() WHERE id=$2",[req.user.id,current.knowledge_id])
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Revision requested for imported research',$2,'external_research_import',$3)",[current.submitted_by,`Revision requested for “${item.title}”. Open the imported research reader to view the reviewer notes and upload a revised version.`,current.id])
      await audit(client,req.user.id,'EXTERNAL_RESEARCH_REVISION_REQUESTED','external_research_import',current.id,{version,notes:req.validated.notes})
      return {published:false}
    }
    if(decision==='Reject'){
      await client.query("UPDATE external_research_imports SET status='Rejected',revision_ready=FALSE,updated_at=NOW() WHERE id=$1",[current.id])
      await client.query("UPDATE knowledge_items SET status='Rejected',reviewed_by=$1,reviewed_at=NOW(),approved_by=NULL,approved_at=NULL,rejection_reason=$2,updated_at=NOW() WHERE id=$3",[req.user.id,req.validated.notes.trim(),current.knowledge_id])
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Imported research rejected',$2,'external_research_import',$3)",[current.submitted_by,`Imported research “${item.title}” was rejected. Review notes remain available in the reader.`,current.id])
      await audit(client,req.user.id,'EXTERNAL_RESEARCH_REJECTED','external_research_import',current.id,{version,notes:req.validated.notes})
      return {published:false}
    }
    await client.query("UPDATE external_research_imports SET status='Published',revision_ready=FALSE,published_at=NOW(),updated_at=NOW() WHERE id=$1",[current.id])
    const updated=(await client.query("UPDATE knowledge_items SET status='Published',reviewed_by=$1,reviewed_at=NOW(),approved_by=$1,approved_at=NOW(),rejection_reason=NULL,updated_at=NOW() WHERE id=$2 RETURNING *",[req.user.id,current.knowledge_id])).rows[0]
    await client.query('UPDATE knowledge_versions SET approved_by=$1,approved_at=NOW() WHERE knowledge_id=$2 AND is_current=TRUE',[req.user.id,current.knowledge_id])
    await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Imported research approved and published',$2,'external_research_import',$3)",[current.submitted_by,`“${item.title}” is now an approved Research document in the central Document Repository.`,current.id])
    await audit(client,req.user.id,'EXTERNAL_RESEARCH_APPROVED_PUBLISHED','external_research_import',current.id,{knowledgeId:current.knowledge_id,version})
    if(updated.felix_enabled)await enqueueFelixDocumentIndex(client,updated.id,updated.current_version,req.user.id)
    return {published:true}
  })
  if(!outcome)return res.status(404).json({error:'Imported research record not found.'})
  res.json(await loadExternalResearchImport(req.params.id,req.user))
}catch(error){if(error.status)return res.status(error.status).json({error:error.message});next(error)}})

app.post('/api/research-imports/:id/revisions',authenticate,rejectDuplicateKnowledgeUpload,async(req,res,next)=>{
  let storedPath
  try{
    const access=(await query('SELECT * FROM external_research_imports WHERE id=$1',[req.params.id])).rows[0]
    if(!access)return res.status(404).json({error:'Imported research record not found.'})
    if(!['Administrator','Research Manager'].includes(req.user.role)&&access.submitted_by!==req.user.id)return res.status(403).json({error:'Only the uploader or a research manager can upload the requested revision.'})
    if(access.status!=='Revision Requested')return res.status(409).json({error:'A revised version can only be uploaded after a reviewer requests revision.'})
    if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({error:'Choose the revised research file.'})
    const checked=validateDocumentUpload(req.body,decodeHeader(req.headers['x-file-name']||'research-revision.pdf'),req.headers['x-file-type'])
    const stored=await storeDocument(req.body,checked.extension);storedPath=stored.absolutePath
    const created=await transaction(async client=>{
      const current=(await client.query('SELECT * FROM external_research_imports WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]
      if(current.status!=='Revision Requested')throw Object.assign(new Error('The review state changed. Refresh the reader before uploading.'),{status:409})
      const item=(await client.query('SELECT current_version FROM knowledge_items WHERE id=$1 FOR UPDATE',[current.knowledge_id])).rows[0]
      const number=Number(item.current_version||0)+1
      await client.query('UPDATE knowledge_versions SET is_current=FALSE WHERE knowledge_id=$1',[current.knowledge_id])
      const version=(await client.query('INSERT INTO knowledge_versions(knowledge_id,version_number,uploader_id,original_name,stored_name,storage_path,mime_type,size_bytes,sha256_hash,notes,is_current)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE)RETURNING *',[current.knowledge_id,number,req.user.id,checked.originalName,stored.storedName,stored.storagePath,checked.mimeType,req.body.length,checked.sha256,String(req.headers['x-version-notes']||'Revision uploaded after reviewer request').slice(0,1000)])).rows[0]
      await client.query("UPDATE knowledge_items SET current_version=$1,status='Pending Approval',approved_by=NULL,approved_at=NULL,rejection_reason=NULL,updated_at=NOW() WHERE id=$2",[number,current.knowledge_id])
      await client.query('UPDATE external_research_imports SET revision_ready=TRUE,updated_at=NOW() WHERE id=$1',[current.id])
      await audit(client,req.user.id,'EXTERNAL_RESEARCH_REVISION_UPLOADED','external_research_import',current.id,{version:number,versionId:version.id,sha256:checked.sha256})
      return version
    })
    storedPath=null
    res.status(201).json(created)
  }catch(error){if(storedPath)await fs.unlink(storedPath).catch(()=>{});if(error.status)return res.status(error.status).json({error:error.message});next(error)}
})

app.post('/api/research-imports/:id/resubmit',authenticate,async(req,res,next)=>{try{
  const result=await transaction(async client=>{
    const current=(await client.query('SELECT * FROM external_research_imports WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]
    if(!current)return null
    if(!['Administrator','Research Manager'].includes(req.user.role)&&current.submitted_by!==req.user.id)throw Object.assign(new Error('Only the uploader or a research manager can resubmit this revision.'),{status:403})
    if(current.status!=='Revision Requested'||!current.revision_ready)throw Object.assign(new Error('Upload the requested revised version before resubmitting.'),{status:409})
    const version=Number((await client.query('SELECT current_version FROM knowledge_items WHERE id=$1',[current.knowledge_id])).rows[0]?.current_version||1)
    await client.query("UPDATE external_research_imports SET status='Resubmitted',revision_ready=FALSE,updated_at=NOW() WHERE id=$1",[current.id])
    await client.query("INSERT INTO external_research_import_reviews(import_id,version_number,reviewer_id,decision,notes)VALUES($1,$2,$3,'Resubmitted','Revised version resubmitted for review.')",[current.id,version,req.user.id])
    const title=(await client.query('SELECT title FROM knowledge_items WHERE id=$1',[current.knowledge_id])).rows[0]?.title||'Imported research'
    const reviewers=(await client.query('SELECT reviewer_id FROM external_research_import_reviewers WHERE import_id=$1 AND active=TRUE',[current.id])).rows
    for(const reviewer of reviewers)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Imported research resubmitted',$2,'external_research_import',$3)",[reviewer.reviewer_id,`A revised version of “${title}” is ready for review.`,current.id])
    await audit(client,req.user.id,'EXTERNAL_RESEARCH_RESUBMITTED','external_research_import',current.id,{version})
    return current.id
  })
  if(!result)return res.status(404).json({error:'Imported research record not found.'})
  res.json(await loadExternalResearchImport(req.params.id,req.user))
}catch(error){if(error.status)return res.status(error.status).json({error:error.message});next(error)}})


const noticeSchema=z.object({title:z.string().min(3).max(200),body:z.string().min(3).max(4000),severity:z.enum(['Information','Important','Urgent']).default('Information'),audienceRole:z.enum(roles).nullable().default(null),eventStart:z.string().datetime().nullable().default(null),eventEnd:z.string().datetime().nullable().default(null),expiresAt:z.string().datetime()}).superRefine((value,ctx)=>{if(value.eventEnd&&!value.eventStart)ctx.addIssue({code:'custom',path:['eventEnd'],message:'Event start is required when an end is provided.'});if(value.eventStart&&value.eventEnd&&new Date(value.eventEnd)<new Date(value.eventStart))ctx.addIssue({code:'custom',path:['eventEnd'],message:'Event end must be after the event start.'});if(new Date(value.expiresAt)<=new Date())ctx.addIssue({code:'custom',path:['expiresAt'],message:'Notice expiry must be in the future.'})})
app.get('/api/alerts',authenticate,async(req,res,next)=>{try{const manager=['Administrator','Research Manager'].includes(req.user.role);const result=await query(`SELECT a.*,u.name created_by_name,r.name reviewed_by_name,(a.created_by=$2) can_manage FROM alerts a JOIN users u ON u.id=a.created_by LEFT JOIN users r ON r.id=a.reviewed_by WHERE(($1 AND TRUE)OR a.status='Published' OR a.created_by=$2)AND(a.audience_role IS NULL OR a.audience_role=$3 OR a.created_by=$2)AND(a.expires_at IS NULL OR a.expires_at>NOW() OR a.created_by=$2) ORDER BY CASE a.status WHEN 'Pending Approval' THEN 0 WHEN 'Published' THEN 1 ELSE 2 END,a.created_at DESC`,[manager,req.user.id,req.user.role]);res.json(result.rows)}catch(error){next(error)}})
app.post('/api/alerts',authenticate,validate(noticeSchema),async(req,res,next)=>{try{const v=req.validated;const created=await transaction(async client=>{const row=(await client.query("INSERT INTO alerts(title,body,severity,audience_role,event_start,event_end,expires_at,created_by,status)VALUES($1,$2,$3,$4,$5,$6,$7,$8,'Pending Approval')RETURNING *",[v.title.trim(),v.body.trim(),v.severity,v.audienceRole,v.eventStart,v.eventEnd,v.expiresAt,req.user.id])).rows[0];await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)SELECT id,'Notice awaiting approval',$1,'notice',$2 FROM users WHERE active=TRUE AND role IN('Administrator','Research Manager')",[`“${row.title}” was submitted by ${req.user.name}.`,row.id]);await audit(client,req.user.id,'NOTICE_SUBMITTED','notice',row.id,{title:row.title,expiresAt:v.expiresAt});return row});res.status(201).json(created)}catch(error){next(error)}})
app.patch('/api/alerts/:id/review',authenticate,authorize('Administrator','Research Manager'),validate(z.object({approved:z.boolean(),reason:z.string().max(1000).default('')})),async(req,res,next)=>{try{const result=await transaction(async client=>{const row=(await client.query("UPDATE alerts SET status=$1,reviewed_by=$2,reviewed_at=NOW(),rejection_reason=$3 WHERE id=$4 AND status='Pending Approval' RETURNING *",[req.validated.approved?'Published':'Rejected',req.user.id,req.validated.approved?null:req.validated.reason.trim(),req.params.id])).rows[0];if(!row)return null;await client.query('INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,$2,$3,$4,$5)',[row.created_by,req.validated.approved?'Notice approved':'Notice returned for correction',req.validated.approved?`“${row.title}” is now published on the Notice Board.`:`“${row.title}” was not approved: ${req.validated.reason||'No reason supplied.'}`,'notice',row.id]);if(req.validated.approved)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)SELECT id,'New Notice Board post',$1,'notice',$2 FROM users WHERE active=TRUE AND id<>$3",[`“${row.title}” has been published.`,row.id,row.created_by]);await audit(client,req.user.id,req.validated.approved?'NOTICE_APPROVED':'NOTICE_REJECTED','notice',row.id,{reason:req.validated.reason});return row});if(!result)return res.status(404).json({error:'Pending notice not found.'});res.json(result)}catch(error){next(error)}})
app.patch('/api/alerts/:id/pin',authenticate,authorize('Administrator','Research Manager'),validate(z.object({pinned:z.boolean()})),async(req,res,next)=>{try{const row=(await query("UPDATE alerts SET is_pinned=$1,pinned_at=CASE WHEN $1 THEN NOW() ELSE NULL END,pinned_by=CASE WHEN $1 THEN $2 ELSE NULL END WHERE id=$3 AND status='Published' AND expires_at>NOW() RETURNING *",[req.validated.pinned,req.user.id,req.params.id])).rows[0];if(!row)return res.status(404).json({error:'An active published notice is required.'});await query('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)VALUES($1,$2,$3,$4,$5)',[req.user.id,req.validated.pinned?'NOTICE_PINNED':'NOTICE_UNPINNED','notice',row.id,JSON.stringify({title:row.title})]);res.json(row)}catch(error){next(error)}})
app.delete('/api/alerts/:id',authenticate,async(req,res,next)=>{try{const result=await transaction(async client=>{const notice=(await client.query('SELECT * FROM alerts WHERE id=$1',[req.params.id])).rows[0];if(!notice)return null;const manager=['Administrator','Research Manager'].includes(req.user.role);if(!manager&&notice.created_by!==req.user.id)throw Object.assign(new Error('You can delete only notices you submitted.'),{status:403});if(!manager&&notice.status==='Published')throw Object.assign(new Error('Only management can delete a published notice.'),{status:403});await client.query("DELETE FROM notifications WHERE entity_type='notice' AND entity_id=$1",[notice.id]);await client.query('DELETE FROM alerts WHERE id=$1',[notice.id]);await audit(client,req.user.id,'NOTICE_DELETED','notice',notice.id,{title:notice.title,status:notice.status});return notice});if(!result)return res.status(404).json({error:'Notice not found.'});res.status(204).end()}catch(error){if(error.status)return res.status(error.status).json({error:error.message});next(error)}})
app.get('/api/alerts/:id/comments',authenticate,async(req,res,next)=>{try{const visible=(await query("SELECT 1 FROM alerts WHERE id=$1 AND status='Published' AND(audience_role IS NULL OR audience_role=$2)AND(expires_at IS NULL OR expires_at>NOW())",[req.params.id,req.user.role])).rowCount;if(!visible)return res.status(404).json({error:'Published notice not found.'});const result=await query('SELECT c.id,c.alert_id,c.body,c.created_at,c.user_id,u.name user_name,u.role user_role FROM alert_comments c JOIN users u ON u.id=c.user_id WHERE c.alert_id=$1 ORDER BY c.created_at ASC',[req.params.id]);res.json(result.rows)}catch(error){next(error)}})
app.post('/api/alerts/:id/comments',authenticate,validate(z.object({body:z.string().trim().min(1).max(2000)})),async(req,res,next)=>{try{const result=await transaction(async client=>{const notice=(await client.query("SELECT id,title,created_by FROM alerts WHERE id=$1 AND status='Published' AND(audience_role IS NULL OR audience_role=$2)AND(expires_at IS NULL OR expires_at>NOW())",[req.params.id,req.user.role])).rows[0];if(!notice)return null;const row=(await client.query('INSERT INTO alert_comments(alert_id,user_id,body)VALUES($1,$2,$3)RETURNING *',[notice.id,req.user.id,req.validated.body])).rows[0];if(notice.created_by!==req.user.id)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'New notice comment',$2,'notice',$3)",[notice.created_by,`${req.user.name} commented on “${notice.title}”.`,notice.id]);await audit(client,req.user.id,'NOTICE_COMMENTED','notice',notice.id,{});return {...row,user_name:req.user.name,user_role:req.user.role}});if(!result)return res.status(404).json({error:'Published notice not found.'});res.status(201).json(result)}catch(error){next(error)}})
app.get('/api/calendar',authenticate,async(req,res,next)=>{try{const all=['Administrator','Research Manager'].includes(req.user.role);const [assignments,tasks,milestones,reviews,notices,events]=await Promise.all([query(`SELECT a.id,a.title,a.due_date start_at,'assignment' type,a.status,a.id entity_id FROM assignments a WHERE a.due_date IS NOT NULL AND($1 OR a.created_by=$2 OR EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=a.id AND am.user_id=$2))`,[all,req.user.id]),query(`SELECT t.id,t.title,t.due_date start_at,'task' type,t.status,t.assignment_id entity_id FROM assignment_tasks t JOIN assignments a ON a.id=t.assignment_id WHERE t.due_date IS NOT NULL AND t.archived_at IS NULL AND($1 OR t.owner_id=$2 OR EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=a.id AND am.user_id=$2))`,[all,req.user.id]),query(`SELECT m.id,m.title,m.due_date start_at,'research_milestone' type,m.status,m.project_id entity_id FROM research_milestones m JOIN research_projects p ON p.id=m.project_id WHERE m.due_date IS NOT NULL AND($1 OR p.lead_id=$2 OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=p.id AND rc.user_id=$2))`,[all,req.user.id]),query(`SELECT d.id,d.title,d.review_due_date start_at,'document_review' type,d.status,d.id entity_id FROM generated_documents d WHERE d.review_due_date IS NOT NULL AND(d.created_by=$1 OR d.reviewer_id=$1)`,[req.user.id]),query("SELECT id,title,COALESCE(event_start,reviewed_at,created_at) start_at,event_end end_at,'notice' type,severity status,(event_start IS NOT NULL) is_dated_event,id entity_id FROM alerts WHERE status='Published' AND(audience_role IS NULL OR audience_role=$1)AND(expires_at IS NULL OR expires_at>NOW())",[req.user.role]),query("SELECT e.id,e.title,e.description,e.start_at,e.end_at,'custom_event' type,e.event_type status,e.id entity_id,e.created_by,u.name created_by_name,(e.created_by=$1 OR $2) can_manage FROM calendar_events e JOIN users u ON u.id=e.created_by",[req.user.id,req.user.role==='Administrator'])]);res.json([...assignments.rows,...tasks.rows,...milestones.rows,...reviews.rows,...notices.rows,...events.rows].sort((a,b)=>new Date(a.start_at)-new Date(b.start_at)))}catch(error){next(error)}})
const calendarEventSchema=z.object({title:z.string().trim().min(3).max(200),description:z.string().max(4000).default(''),startAt:z.string().datetime(),endAt:z.string().datetime().nullable().default(null),eventType:z.enum(['Meeting','Reminder','Deadline','Activity']).default('Meeting')}).superRefine((value,ctx)=>{if(value.endAt&&new Date(value.endAt)<new Date(value.startAt))ctx.addIssue({code:'custom',path:['endAt'],message:'Event end must be after the start.'})})
app.post('/api/calendar/events',authenticate,validate(calendarEventSchema),async(req,res,next)=>{try{const v=req.validated;const row=(await query('INSERT INTO calendar_events(title,description,start_at,end_at,event_type,created_by)VALUES($1,$2,$3,$4,$5,$6)RETURNING *',[v.title,v.description.trim(),v.startAt,v.endAt,v.eventType,req.user.id])).rows[0];await query('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)VALUES($1,$2,$3,$4,$5)',[req.user.id,'CALENDAR_EVENT_CREATED','calendar_event',row.id,JSON.stringify({title:row.title})]);res.status(201).json({...row,type:'custom_event',status:row.event_type,can_manage:true,created_by_name:req.user.name})}catch(error){next(error)}})
app.patch('/api/calendar/events/:id',authenticate,validate(calendarEventSchema),async(req,res,next)=>{try{const existing=(await query('SELECT * FROM calendar_events WHERE id=$1',[req.params.id])).rows[0];if(!existing)return res.status(404).json({error:'Calendar event not found.'});if(existing.created_by!==req.user.id&&req.user.role!=='Administrator')return res.status(403).json({error:'Only the event creator or an Administrator can edit this event.'});const v=req.validated;const row=(await query('UPDATE calendar_events SET title=$1,description=$2,start_at=$3,end_at=$4,event_type=$5,updated_at=NOW() WHERE id=$6 RETURNING *',[v.title,v.description.trim(),v.startAt,v.endAt,v.eventType,existing.id])).rows[0];await query('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)VALUES($1,$2,$3,$4,$5)',[req.user.id,'CALENDAR_EVENT_UPDATED','calendar_event',row.id,JSON.stringify({title:row.title})]);res.json({...row,type:'custom_event',status:row.event_type,can_manage:true,created_by_name:req.user.name})}catch(error){next(error)}})
app.delete('/api/calendar/events/:id',authenticate,async(req,res,next)=>{try{const existing=(await query('SELECT * FROM calendar_events WHERE id=$1',[req.params.id])).rows[0];if(!existing)return res.status(404).json({error:'Calendar event not found.'});if(existing.created_by!==req.user.id&&req.user.role!=='Administrator')return res.status(403).json({error:'Only the event creator or an Administrator can delete this event.'});await query('DELETE FROM calendar_events WHERE id=$1',[existing.id]);await query('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)VALUES($1,$2,$3,$4,$5)',[req.user.id,'CALENDAR_EVENT_DELETED','calendar_event',existing.id,JSON.stringify({title:existing.title})]);res.status(204).end()}catch(error){next(error)}})
app.get('/api/analytics/reports',authenticate,authorize('Administrator','Research Manager'),async(req,res,next)=>{
  try{
    const filters=z.object({from:z.string().optional().default(''),to:z.string().optional().default(''),division:z.string().max(160).optional().default(''),status:z.string().max(40).optional().default('')}).parse({from:String(req.query.from||''),to:String(req.query.to||''),division:String(req.query.division||''),status:String(req.query.status||'')})
    const values=[filters.from||null,filters.to||null,filters.division,filters.status]
    const where="($1::date IS NULL OR a.created_at::date>=$1::date)AND($2::date IS NULL OR a.created_at::date<=$2::date)AND($3='' OR a.division=$3)AND($4='' OR a.status=$4)"
    const [summary,assignmentStatuses,divisions,documents,research,reviewers,trends,people]=await Promise.all([
      query(`SELECT COUNT(*)::int total,COUNT(*)FILTER(WHERE a.status='Completed')::int completed,COUNT(*)FILTER(WHERE a.status='Overdue' OR(a.due_date<CURRENT_DATE AND a.status!='Completed'))::int overdue,ROUND(COALESCE(100.0*COUNT(*)FILTER(WHERE a.status='Completed')/NULLIF(COUNT(*),0),0),1)::float completion_rate,(SELECT COUNT(*)::int FROM generated_documents WHERE status IN('Submitted','Under Review')) generated_document_reviews,(SELECT COUNT(*)::int FROM generated_documents WHERE status IN('Approved','Final')) approved_generated_documents FROM assignments a WHERE ${where}`,values),
      query(`SELECT a.status,COUNT(*)::int total FROM assignments a WHERE ${where} GROUP BY a.status ORDER BY total DESC`,values),
      query(`SELECT a.division,COUNT(*)::int total,COUNT(*)FILTER(WHERE a.status='Completed')::int completed FROM assignments a WHERE ${where} GROUP BY a.division ORDER BY total DESC`,values),
      query("SELECT k.status,COUNT(*)::int total FROM knowledge_items k WHERE($1::date IS NULL OR k.created_at::date>=$1::date)AND($2::date IS NULL OR k.created_at::date<=$2::date)GROUP BY k.status ORDER BY total DESC",values.slice(0,2)),
      query("SELECT p.status,COUNT(*)::int total FROM research_projects p WHERE($1::date IS NULL OR p.created_at::date>=$1::date)AND($2::date IS NULL OR p.created_at::date<=$2::date)GROUP BY p.status ORDER BY total DESC",values.slice(0,2)),
      query("SELECT u.id,u.name,(SELECT COUNT(*)::int FROM document_reviews r WHERE r.actor_id=u.id AND r.action='APPROVED' AND($1::date IS NULL OR r.created_at::date>=$1::date)AND($2::date IS NULL OR r.created_at::date<=$2::date))approved,(SELECT COUNT(*)::int FROM document_reviews r WHERE r.actor_id=u.id AND r.action='REJECTED' AND($1::date IS NULL OR r.created_at::date>=$1::date)AND($2::date IS NULL OR r.created_at::date<=$2::date))rejected,(SELECT COUNT(*)::int FROM knowledge_items k WHERE k.reviewer_id=u.id AND k.status='Pending Approval')pending FROM users u WHERE u.role IN('Reviewer','Research Manager')ORDER BY pending DESC,approved DESC",values.slice(0,2)),
      query("SELECT TO_CHAR(DATE_TRUNC('month',a.created_at),'Mon YYYY') AS month_label,DATE_TRUNC('month',a.created_at) AS bucket,COUNT(*)::int AS created,COUNT(*)FILTER(WHERE a.status='Completed')::int AS completed FROM assignments a WHERE a.created_at>=DATE_TRUNC('month',CURRENT_DATE)-INTERVAL '5 months' GROUP BY DATE_TRUNC('month',a.created_at) ORDER BY bucket"),
      query(`SELECT u.id,u.name,u.role,u.division,COUNT(a.id)::int assigned,COUNT(a.id)FILTER(WHERE a.status='Completed')::int completed,COUNT(a.id)FILTER(WHERE a.status='Overdue' OR(a.due_date<CURRENT_DATE AND a.status!='Completed'))::int overdue,ROUND(COALESCE(100.0*COUNT(a.id)FILTER(WHERE a.status='Completed')/NULLIF(COUNT(a.id),0),0),1)::float completion_rate FROM users u LEFT JOIN assignment_members am ON am.user_id=u.id LEFT JOIN assignments a ON a.id=am.assignment_id AND($1::date IS NULL OR a.created_at::date>=$1::date)AND($2::date IS NULL OR a.created_at::date<=$2::date)AND($3='' OR a.division=$3)AND($4='' OR a.status=$4) WHERE u.active=TRUE GROUP BY u.id ORDER BY completion_rate DESC,completed DESC,u.name`,values)
    ])
    const documentTotals=documents.rows.reduce((acc,row)=>({...acc,[row.status]:row.total}),{})
    const researchTotals=research.rows.reduce((acc,row)=>({...acc,[row.status]:row.total}),{})
    res.json({filters,summary:{...summary.rows[0],pending_reviews:documentTotals['Pending Approval']||0,published_documents:documentTotals.Published||0,active_research:(researchTotals.Active||0)+(researchTotals['Under Review']||0)},assignmentStatuses:assignmentStatuses.rows,divisions:divisions.rows,documentStatuses:documents.rows,researchStatuses:research.rows,reviewers:reviewers.rows,trends:trends.rows.map(row=>({...row,month:row.month_label})),people:people.rows})
  }catch(error){next(error)}
})
app.get('/api/analytics/overview',authenticate,authorize('Administrator','Research Manager'),async(_req,res,next)=>{try{const [statuses,workloads,members]=await Promise.all([query('SELECT status,COUNT(*)::int total FROM assignments GROUP BY status'),query(`SELECT u.id,u.name,COUNT(am.assignment_id) FILTER(WHERE a.status!='Completed')::int active FROM users u LEFT JOIN assignment_members am ON am.user_id=u.id LEFT JOIN assignments a ON a.id=am.assignment_id GROUP BY u.id ORDER BY active DESC`),query('SELECT role,COUNT(*)::int total FROM users WHERE active=TRUE GROUP BY role')]);res.json({assignmentStatuses:statuses.rows,workloads:workloads.rows,membersByRole:members.rows})}catch(error){next(error)}})
const researchSchema=z.object({title:z.string().min(4).max(240),
  leadId:z.string().uuid().nullable().optional(),summary:z.string().max(6000).default(''),researchQuestion:z.string().max(3000).default(''),objectives:z.string().max(5000).default(''),methodology:z.string().max(5000).default(''),startDate:z.string().nullable().optional(),endDate:z.string().nullable().optional(),assignmentId:z.string().uuid().nullable().optional(),collaboratorIds:z.array(z.string().uuid()).default([]),reviewerIds:z.array(z.string().uuid()).max(10).default([]),knowledgeIds:z.array(z.string().uuid()).default([])})
app.get('/api/research',authenticate,async(req,res,next)=>{try{
  const all=['Administrator','Research Manager'].includes(req.user.role)
  const rows=await query(`SELECT p.*,u.name lead_name,
    COALESCE((SELECT json_agg(json_build_object('id',c.id,'name',c.name,'role',rc.role) ORDER BY c.name) FROM research_collaborators rc JOIN users c ON c.id=rc.user_id WHERE rc.project_id=p.id AND COALESCE(rc.role,'Researcher')<>'Reviewer'),'[]'::json) collaborators,
    COALESCE((SELECT json_agg(json_build_object('id',m.id,'title',m.title,'description',m.description,'owner_id',m.owner_id,'owner_name',mo.name,'due_date',m.due_date,'priority',m.priority,'status',m.status) ORDER BY m.due_date NULLS LAST,m.created_at) FROM research_milestones m LEFT JOIN users mo ON mo.id=m.owner_id WHERE m.project_id=p.id),'[]'::json) milestones,
    COALESCE((SELECT json_agg(json_build_object('id',r.id,'reviewer_id',r.reviewer_id,'name',ru.name,'role',ru.role,'division',ru.division,'review_role',r.review_role,'assigned_at',r.assigned_at) ORDER BY ru.name) FROM research_reviewers r JOIN users ru ON ru.id=r.reviewer_id WHERE r.project_id=p.id AND r.active=TRUE),'[]'::json) reviewers,
    COALESCE((SELECT json_agg(json_build_object('id',a.id,'title',a.title,'description',a.description,'division',a.division,'due_date',a.due_date,'priority',a.priority,'status',a.status,'relation_type',ral.relation_type,'linked_at',ral.linked_at) ORDER BY a.created_at DESC) FROM research_assignment_links ral JOIN assignments a ON a.id=ral.assignment_id WHERE ral.project_id=p.id),'[]'::json) assignments
    FROM research_projects p JOIN users u ON u.id=p.lead_id
    WHERE $1 OR p.lead_id=$2 OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=p.id AND rc.user_id=$2) OR EXISTS(SELECT 1 FROM research_reviewers rr WHERE rr.project_id=p.id AND rr.reviewer_id=$2 AND rr.active=TRUE)
    ORDER BY p.updated_at DESC`,[all,req.user.id])
  res.json(rows.rows)
}catch(error){next(error)}})
app.post('/api/research',authenticate,authorize('Administrator','Research Manager'),validate(researchSchema),async(req,res,next)=>{
  try{
    const created=await transaction(async client=>{
      const v=req.validated

      const p=(await client.query(
        'INSERT INTO research_projects(title,summary,research_question,objectives,methodology,start_date,end_date,lead_id,assignment_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
        [
          v.title,
          v.summary,
          v.researchQuestion,
          v.objectives,
          v.methodology,
          v.startDate||null,
          v.endDate||null,
          v.leadId||req.user.id,
          v.assignmentId||null
        ]
      )).rows[0]

      if(v.reviewerIds.includes(p.lead_id))throw Object.assign(new Error('The research lead cannot review their own project.'),{statusCode:400})
      const reviewerIds=[...new Set(v.reviewerIds)]
      if(reviewerIds.length){
        const valid=(await client.query("SELECT id FROM users WHERE id=ANY($1::uuid[]) AND active=TRUE AND role IN('Reviewer','Research Manager','Administrator')",[reviewerIds])).rows.map(row=>row.id)
        if(valid.length!==reviewerIds.length)throw Object.assign(new Error('Choose only active authorized reviewers.'),{statusCode:400})
      }
      for(const id of v.collaboratorIds.filter(id=>!reviewerIds.includes(id)))
        await client.query(
          'INSERT INTO research_collaborators(project_id,user_id,role)VALUES($1,$2,$3)ON CONFLICT DO NOTHING',
          [p.id,id,'Researcher']
        )
      for(const id of reviewerIds){
        await client.query('INSERT INTO research_reviewers(project_id,reviewer_id,assigned_by)VALUES($1,$2,$3)ON CONFLICT(project_id,reviewer_id) DO UPDATE SET active=TRUE,assigned_by=EXCLUDED.assigned_by,assigned_at=NOW()',[p.id,id,req.user.id])
        await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Research review assigned',$2,'research',$3)",[id,`You were assigned to review research project “${p.title}”.`,p.id])
      }
      if(v.assignmentId){
        await client.query("INSERT INTO research_assignment_links(project_id,assignment_id,relation_type,linked_by)VALUES($1,$2,'Originating assignment',$3)ON CONFLICT(assignment_id) DO NOTHING",[p.id,v.assignmentId,req.user.id])
      }
      await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[p.id,req.user.id,'RESEARCH_CREATED',JSON.stringify({leadId:p.lead_id,collaboratorIds:v.collaboratorIds,reviewerIds,assignmentId:v.assignmentId||null})])
      await audit(client,req.user.id,'RESEARCH_CREATED','research_project',p.id,{title:p.title,leadId:p.lead_id,reviewerIds})

      for(const id of v.knowledgeIds)
        await client.query(
          'INSERT INTO research_knowledge_links(project_id,knowledge_item_id)VALUES($1,$2)ON CONFLICT DO NOTHING',
          [p.id,id]
        )

      return p
    })

    res.status(201).json(created)
  }catch(error){
    next(error)
  }
})
const researchPlanSchema=z.object({summary:z.string().max(6000),researchQuestion:z.string().max(3000),objectives:z.string().max(5000),methodology:z.string().max(5000),startDate:z.string().nullable(),endDate:z.string().nullable()})
app.patch('/api/research/:id/plan',authenticate,validate(researchPlanSchema),async(req,res,next)=>{try{
  const project=(await query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  const canEdit=['Administrator','Research Manager'].includes(req.user.role)||project.lead_id===req.user.id
  if(!canEdit)return res.status(403).json({error:'Only the research lead or a research manager can edit the approved research plan.'})
  const v=req.validated
  if(v.startDate&&v.endDate&&v.endDate<v.startDate)return res.status(400).json({error:'Research end date must be on or after its start date.'})
  const updated=await transaction(async client=>{const row=(await client.query('UPDATE research_projects SET summary=$1,research_question=$2,objectives=$3,methodology=$4,start_date=$5,end_date=$6,updated_at=NOW() WHERE id=$7 RETURNING *',[v.summary,v.researchQuestion,v.objectives,v.methodology,v.startDate||null,v.endDate||null,req.params.id])).rows[0];await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'RESEARCH_PLAN_UPDATED',JSON.stringify({questionDefined:Boolean(v.researchQuestion.trim()),objectivesDefined:Boolean(v.objectives.trim()),methodologyDefined:Boolean(v.methodology.trim())})]);await audit(client,req.user.id,'RESEARCH_PLAN_UPDATED','research_project',req.params.id,{status:project.status});return row})
  res.json(updated)
}catch(error){next(error)}})
const researchTeamSchema=z.object({leadId:z.string().uuid(),collaborators:z.array(z.object({userId:z.string().uuid(),role:z.enum(['Researcher','Analyst','Reviewer','Subject Matter Expert'])})).max(30)})
app.patch('/api/research/:id/team',authenticate,authorize('Administrator','Research Manager'),validate(researchTeamSchema),async(req,res,next)=>{try{
  const project=(await query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  const v=req.validated
  if(v.collaborators.some(item=>item.userId===v.leadId))return res.status(400).json({error:'The lead researcher cannot also be listed as a collaborator.'})
  const userIds=[v.leadId,...v.collaborators.map(item=>item.userId)]
  const validUsers=(await query("SELECT id FROM users WHERE id=ANY($1::uuid[]) AND active=TRUE AND role IN('Research Officer','Research Manager','Reviewer')",[userIds])).rows.map(item=>item.id)
  if(validUsers.length!==new Set(userIds).size)return res.status(400).json({error:'Choose only active research officers, managers or reviewers for the project team.'})
  const updated=await transaction(async client=>{await client.query('UPDATE research_projects SET lead_id=$1,updated_at=NOW() WHERE id=$2',[v.leadId,req.params.id]);await client.query('DELETE FROM research_collaborators WHERE project_id=$1',[req.params.id]);for(const member of v.collaborators)await client.query('INSERT INTO research_collaborators(project_id,user_id,role)VALUES($1,$2,$3)',[req.params.id,member.userId,member.role]);await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'RESEARCH_TEAM_UPDATED',JSON.stringify({leadId:v.leadId,collaboratorCount:v.collaborators.length})]);await audit(client,req.user.id,'RESEARCH_TEAM_UPDATED','research_project',req.params.id,{previousLeadId:project.lead_id,leadId:v.leadId,collaborators:v.collaborators});return (await client.query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]})
  res.json(updated)
}catch(error){next(error)}})
const researchReviewerSchema=z.object({reviewerIds:z.array(z.string().uuid()).max(10)})
app.patch('/api/research/:id/reviewers',authenticate,authorize('Administrator','Research Manager'),validate(researchReviewerSchema),async(req,res,next)=>{try{
  const project=(await query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  const reviewerIds=[...new Set(req.validated.reviewerIds)]
  if(reviewerIds.includes(project.lead_id))return res.status(400).json({error:'The research lead cannot review their own project.'})
  if(reviewerIds.length){const valid=(await query("SELECT id FROM users WHERE id=ANY($1::uuid[]) AND active=TRUE AND role IN('Reviewer','Research Manager','Administrator')",[reviewerIds])).rows;if(valid.length!==reviewerIds.length)return res.status(400).json({error:'Choose only active authorized reviewers.'})}
  await transaction(async client=>{
    await client.query('UPDATE research_reviewers SET active=FALSE WHERE project_id=$1',[project.id])
    for(const id of reviewerIds){
      await client.query('INSERT INTO research_reviewers(project_id,reviewer_id,assigned_by,active)VALUES($1,$2,$3,TRUE)ON CONFLICT(project_id,reviewer_id) DO UPDATE SET active=TRUE,assigned_by=EXCLUDED.assigned_by,assigned_at=NOW()',[project.id,id,req.user.id])
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Research review assigned',$2,'research',$3)",[id,`You are an assigned reviewer for “${project.title}”.`,project.id])
    }
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[project.id,req.user.id,'RESEARCH_REVIEWERS_UPDATED',JSON.stringify({reviewerIds})])
    await audit(client,req.user.id,'RESEARCH_REVIEWERS_UPDATED','research_project',project.id,{reviewerIds})
  })
  res.json({reviewerIds})
}catch(error){next(error)}})

const researchAssignmentLinkSchema=z.object({assignmentId:z.string().uuid(),relationType:z.string().trim().min(2).max(60).default('Research Work')})
app.post('/api/research/:id/assignments/link',authenticate,authorize('Administrator','Research Manager'),validate(researchAssignmentLinkSchema),async(req,res,next)=>{try{
  const project=(await query('SELECT id,title FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  const assignment=(await query('SELECT id,title FROM assignments WHERE id=$1',[req.validated.assignmentId])).rows[0]
  if(!assignment)return res.status(404).json({error:'Assignment not found.'})
  const existing=(await query('SELECT project_id FROM research_assignment_links WHERE assignment_id=$1',[assignment.id])).rows[0]
  if(existing&&existing.project_id!==project.id)return res.status(409).json({error:'This assignment is already linked to another research project.'})
  await transaction(async client=>{
    await client.query('INSERT INTO research_assignment_links(project_id,assignment_id,relation_type,linked_by)VALUES($1,$2,$3,$4)ON CONFLICT(project_id,assignment_id) DO UPDATE SET relation_type=EXCLUDED.relation_type',[project.id,assignment.id,req.validated.relationType,req.user.id])
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[project.id,req.user.id,'RESEARCH_ASSIGNMENT_LINKED',JSON.stringify({assignmentId:assignment.id,title:assignment.title,relationType:req.validated.relationType})])
    await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[assignment.id,req.user.id,'LINKED_TO_RESEARCH',JSON.stringify({researchId:project.id,researchTitle:project.title})])
    await audit(client,req.user.id,'RESEARCH_ASSIGNMENT_LINKED','research_project',project.id,{assignmentId:assignment.id})
  })
  res.status(201).json({assignmentId:assignment.id})
}catch(error){next(error)}})

app.delete('/api/research/:id/assignments/:assignmentId',authenticate,authorize('Administrator','Research Manager'),async(req,res,next)=>{try{
  const link=(await query('SELECT * FROM research_assignment_links WHERE project_id=$1 AND assignment_id=$2',[req.params.id,req.params.assignmentId])).rows[0]
  if(!link)return res.status(404).json({error:'Research assignment link not found.'})
  await transaction(async client=>{
    await client.query('DELETE FROM research_assignment_links WHERE id=$1',[link.id])
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'RESEARCH_ASSIGNMENT_UNLINKED',JSON.stringify({assignmentId:req.params.assignmentId})])
    await audit(client,req.user.id,'RESEARCH_ASSIGNMENT_UNLINKED','research_project',req.params.id,{assignmentId:req.params.assignmentId})
  })
  res.status(204).end()
}catch(error){next(error)}})

app.post('/api/research/:id/assignments',authenticate,authorize('Administrator','Research Manager'),validate(assignmentSchema),async(req,res,next)=>{try{
  const project=(await query('SELECT id,title FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  const created=await transaction(async client=>{
    const {title,description,division,dueDate,priority,memberIds}=req.validated
    const result=await client.query('INSERT INTO assignments(title,description,division,due_date,priority,created_by)VALUES($1,$2,$3,$4,$5,$6)RETURNING *',[title,description,division,dueDate||null,priority,req.user.id])
    const assignment=result.rows[0]
    for(const id of memberIds)await client.query('INSERT INTO assignment_members(assignment_id,user_id)VALUES($1,$2)ON CONFLICT DO NOTHING',[assignment.id,id])
    await client.query("INSERT INTO research_assignment_links(project_id,assignment_id,relation_type,linked_by)VALUES($1,$2,'Research Work',$3)",[project.id,assignment.id,req.user.id])
    if(memberIds.length)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)SELECT id,'New research assignment',$1,'assignment',$2 FROM users WHERE id=ANY($3::uuid[]) AND active=TRUE",[`You have been assigned “${title}” under research project “${project.title}”${dueDate?` due ${dueDate}`:''}.`,assignment.id,memberIds])
    await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[assignment.id,req.user.id,'CREATED_FROM_RESEARCH',JSON.stringify({researchId:project.id,researchTitle:project.title,memberIds})])
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[project.id,req.user.id,'RESEARCH_ASSIGNMENT_CREATED',JSON.stringify({assignmentId:assignment.id,title})])
    await audit(client,req.user.id,'ASSIGNMENT_CREATED','assignment',assignment.id,{title,memberIds,researchId:project.id})
    return assignment
  })
  res.status(201).json(created)
}catch(error){next(error)}})

app.patch('/api/research/:id/status',authenticate,validate(z.object({status:z.enum(['Planning','Active','Under Review','Completed','Archived'])})),async(req,res,next)=>{  try{
    const project=(await query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
    if(!project)return res.status(404).json({error:'Research project not found.'})
    const isManager=['Administrator','Research Manager'].includes(req.user.role)
    const isParticipant=project.lead_id===req.user.id||(await query('SELECT 1 FROM research_collaborators WHERE project_id=$1 AND user_id=$2',[req.params.id,req.user.id])).rowCount>0
    const isAssignedReviewer=(await query('SELECT 1 FROM research_reviewers WHERE project_id=$1 AND reviewer_id=$2 AND active=TRUE',[req.params.id,req.user.id])).rowCount>0
    if(!isManager&&!isParticipant&&!isAssignedReviewer)return res.status(403).json({error:'You are not authorized to update this research project.'})
    if(req.validated.status==='Under Review'&&(!project.research_question.trim()||!project.objectives.trim()||!project.methodology.trim()))return res.status(409).json({error:'Define the research question, objectives and methodology before review.'})
    if(req.validated.status==='Under Review'&&(await query('SELECT 1 FROM research_milestones WHERE project_id=$1 LIMIT 1',[req.params.id])).rowCount===0)return res.status(409).json({error:'Add at least one accountable research milestone before review.'})
    if(req.validated.status==='Under Review'&&(await query('SELECT 1 FROM research_reviewers WHERE project_id=$1 AND active=TRUE LIMIT 1',[req.params.id])).rowCount===0)return res.status(409).json({error:'Assign at least one formal research reviewer before submitting for review.'})
    if(req.validated.status==='Active'&&!isManager)return res.status(403).json({error:'Only a research manager can approve an active research project.'})
    if(req.validated.status==='Completed'){
      if(!isManager&&!isAssignedReviewer)return res.status(403).json({error:'Only an assigned research reviewer or manager can approve completed research.'})
      if((await query("SELECT 1 FROM research_milestones WHERE project_id=$1 AND status!='Completed' LIMIT 1",[req.params.id])).rowCount)return res.status(409).json({error:'Complete every research milestone before closing the project.'})
      if(!await researchHasControlledEvidence(req.params.id))return res.status(409).json({error:'Add at least one controlled research source or link a published Repository document before closing the project.'})
      if((await query("SELECT 1 FROM research_report_sections WHERE project_id=$1 AND status!='Approved' LIMIT 1",[req.params.id])).rowCount)return res.status(409).json({error:'Approve every required research report section before closing the project.'})
      if((await query("SELECT 1 FROM generated_documents WHERE context='Research' AND context_id=$1 AND status IN('Approved','Final') LIMIT 1",[req.params.id])).rowCount===0)return res.status(409).json({error:'An approved or final controlled research document is required before closing the project.'})
    }
    const row=await transaction(async client=>{const updated=(await client.query('UPDATE research_projects SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',[req.validated.status,req.params.id])).rows[0];await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'STATUS_UPDATED',JSON.stringify({from:project.status,to:updated.status})]);await audit(client,req.user.id,'RESEARCH_STATUS_UPDATED','research_project',updated.id,{from:project.status,to:updated.status});return updated})
    res.json(row)
  }catch(error){next(error)}
})
app.delete('/api/research/:id',authenticate,authorize('Administrator','Research Manager'),validate(z.object({reason:z.string().trim().min(5).max(2000)})),async(req,res,next)=>{try{
  const project=(await query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  if(project.status!=='Archived')return res.status(409).json({error:'Archive the research project before permanently deleting it.'})
  await transaction(async client=>{
    await audit(client,req.user.id,'RESEARCH_PROJECT_DELETED','research_project',project.id,{title:project.title,reason:req.validated.reason})
    await client.query('DELETE FROM research_projects WHERE id=$1',[project.id])
  })
  res.status(204).end()
}catch(error){
  if(error.code==='23503')return res.status(409).json({error:'This research project still has controlled records that prevent permanent deletion. Keep it archived instead.'})
  next(error)
}})
const researchMilestoneSchema=z.object({title:z.string().min(3).max(200),description:z.string().max(3000).default(''),ownerId:z.string().uuid(),dueDate:z.string().min(10).max(10),priority:z.enum(['Low','Normal','High','Critical']).default('Normal')})
app.post('/api/research/:id/milestones',authenticate,validate(researchMilestoneSchema),async(req,res,next)=>{try{if(!await canEditResearch(req.user,req.params.id))return res.status(403).json({error:'Only the working research team or a manager can add milestones.'});const v=req.validated;const accountable=(await query('SELECT 1 FROM research_projects p WHERE p.id=$1 AND(p.lead_id=$2 OR EXISTS(SELECT 1 FROM research_collaborators WHERE project_id=p.id AND user_id=$2))',[req.params.id,v.ownerId])).rowCount;if(!accountable)return res.status(400).json({error:'Milestone owner must be the research lead or a project collaborator.'});const row=await transaction(async client=>{const created=(await client.query('INSERT INTO research_milestones(project_id,title,description,owner_id,due_date,priority)VALUES($1,$2,$3,$4,$5,$6)RETURNING *',[req.params.id,v.title,v.description,v.ownerId,v.dueDate,v.priority])).rows[0];await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'MILESTONE_CREATED',JSON.stringify({milestoneId:created.id,title:created.title,ownerId:created.owner_id,dueDate:created.due_date})]);return created});res.status(201).json(row)}catch(error){next(error)}})
app.patch('/api/research/:id/milestones/:milestoneId',authenticate,validate(z.object({status:z.enum(['Pending','In Progress','Completed'])})),async(req,res,next)=>{try{if(!await canAccessResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot update this milestone.'});const milestone=(await query('SELECT * FROM research_milestones WHERE id=$1 AND project_id=$2',[req.params.milestoneId,req.params.id])).rows[0];if(!milestone)return res.status(404).json({error:'Milestone not found.'});if(milestone.owner_id!==req.user.id&&!['Administrator','Research Manager'].includes(req.user.role))return res.status(403).json({error:'Only the milestone owner or a research manager can update its status.'});const row=await transaction(async client=>{const updated=(await client.query('UPDATE research_milestones SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',[req.validated.status,milestone.id])).rows[0];await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'MILESTONE_UPDATED',JSON.stringify({milestoneId:updated.id,status:updated.status})]);return updated});res.json(row)}catch(error){next(error)}})
const researchRepositoryLinkSchema=z.object({knowledgeId:z.string().uuid()})
app.get('/api/research/:id/repository-documents',authenticate,async(req,res,next)=>{try{
  if(!await canAccessResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot view Repository evidence for this research project.'})
  const rows=(await query(`SELECT k.id,k.title,k.description,k.category,k.document_type,k.subject,k.classification,k.status,k.current_version,k.created_at,k.updated_at,k.created_by,
      creator.name created_by_name,rkl.linked_at,linker.name linked_by_name,
      COALESCE((SELECT MAX(v.version_number) FROM knowledge_versions v WHERE v.knowledge_id=k.id),0) latest_version,
      COALESCE((SELECT v.original_name FROM knowledge_versions v WHERE v.knowledge_id=k.id ORDER BY v.version_number DESC LIMIT 1),'') original_name
    FROM research_knowledge_links rkl
    JOIN knowledge_items k ON k.id=rkl.knowledge_item_id
    JOIN users creator ON creator.id=k.created_by
    LEFT JOIN users linker ON linker.id=rkl.linked_by
    WHERE rkl.project_id=$1 AND k.status='Published' AND COALESCE(k.is_archived,FALSE)=FALSE
    ORDER BY rkl.linked_at DESC,k.title`,[req.params.id])).rows
  const visible=[]
  for(const row of rows)if(await canReadKnowledge(req.user,row.id))visible.push(row)
  res.json(visible)
}catch(error){next(error)}})
app.post('/api/research/:id/repository-documents/link',authenticate,validate(researchRepositoryLinkSchema),async(req,res,next)=>{try{
  if(!await canEditResearch(req.user,req.params.id))return res.status(403).json({error:'Only the working research team or a manager can link Repository evidence.'})
  const project=(await query('SELECT id,title FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  const document=(await query("SELECT id,title,status,is_archived FROM knowledge_items WHERE id=$1",[req.validated.knowledgeId])).rows[0]
  if(!document)return res.status(404).json({error:'Repository document not found.'})
  if(document.status!=='Published'||document.is_archived)return res.status(409).json({error:'Only published, non-archived Repository documents can be linked as research evidence.'})
  if(!await canReadKnowledge(req.user,document.id))return res.status(403).json({error:'You do not have permission to use this Repository document.'})
  const existing=(await query('SELECT 1 FROM research_knowledge_links WHERE project_id=$1 AND knowledge_item_id=$2',[project.id,document.id])).rowCount
  if(existing)return res.status(409).json({error:'This Repository document is already linked to the research project.'})
  await transaction(async client=>{
    await client.query('INSERT INTO research_knowledge_links(project_id,knowledge_item_id,linked_by)VALUES($1,$2,$3)',[project.id,document.id,req.user.id])
    await client.query("INSERT INTO repository_entity_links(knowledge_id,entity_type,entity_id,linked_by)VALUES($1,'research',$2,$3)ON CONFLICT(knowledge_id,entity_type,entity_id) DO NOTHING",[document.id,project.id,req.user.id])
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[project.id,req.user.id,'REPOSITORY_EVIDENCE_LINKED',JSON.stringify({knowledgeId:document.id,title:document.title})])
    await audit(client,req.user.id,'RESEARCH_REPOSITORY_EVIDENCE_LINKED','research_project',project.id,{knowledgeId:document.id,title:document.title})
  })
  res.status(201).json({knowledgeId:document.id,title:document.title})
}catch(error){next(error)}})
app.delete('/api/research/:id/repository-documents/:knowledgeId',authenticate,async(req,res,next)=>{try{
  if(!await canEditResearch(req.user,req.params.id))return res.status(403).json({error:'Only the working research team or a manager can unlink Repository evidence.'})
  const linked=(await query(`SELECT rkl.knowledge_item_id,k.title FROM research_knowledge_links rkl JOIN knowledge_items k ON k.id=rkl.knowledge_item_id WHERE rkl.project_id=$1 AND rkl.knowledge_item_id=$2`,[req.params.id,req.params.knowledgeId])).rows[0]
  if(!linked)return res.status(404).json({error:'Research Repository evidence link not found.'})
  await transaction(async client=>{
    await client.query('DELETE FROM research_knowledge_links WHERE project_id=$1 AND knowledge_item_id=$2',[req.params.id,req.params.knowledgeId])
    await client.query("DELETE FROM repository_entity_links WHERE knowledge_id=$1 AND entity_type='research' AND entity_id=$2",[req.params.knowledgeId,req.params.id])
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'REPOSITORY_EVIDENCE_UNLINKED',JSON.stringify({knowledgeId:req.params.knowledgeId,title:linked.title})])
    await audit(client,req.user.id,'RESEARCH_REPOSITORY_EVIDENCE_UNLINKED','research_project',req.params.id,{knowledgeId:req.params.knowledgeId,title:linked.title})
  })
  res.status(204).end()
}catch(error){next(error)}})

const researchSourceSchema=z.object({sourceType:z.enum(['Journal Article','Report','Policy Document','Legislation','Institutional Report','Dataset','Website','Book','Interview','Field Evidence']),title:z.string().min(2).max(300),author:z.string().max(240).default(''),publisher:z.string().max(240).default(''),publicationDate:z.string().nullable().default(null),url:z.string().max(2000).default(''),identifier:z.string().max(160).default(''),notes:z.string().max(5000).default(''),provenance:z.enum(['Internal','External','Primary Evidence','Secondary Evidence']),quality:z.enum(['Unrated','Low','Moderate','High']),relevance:z.enum(['Background','Supporting','Core'])})
app.get('/api/research/:id/sources',authenticate,async(req,res,next)=>{try{if(!await canAccessResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot view sources for this research project.'});res.json((await query('SELECT s.*,u.name created_by_name FROM research_sources s JOIN users u ON u.id=s.created_by WHERE s.project_id=$1 ORDER BY s.created_at DESC',[req.params.id])).rows)}catch(error){next(error)}})
app.post('/api/research/:id/sources',authenticate,validate(researchSourceSchema),async(req,res,next)=>{try{if(!await canEditResearch(req.user,req.params.id))return res.status(403).json({error:'Only the working research team or a manager can add research sources.'});const v=req.validated;const duplicate=(await query("SELECT 1 FROM research_sources WHERE project_id=$1 AND(lower(title)=lower($2) OR($3<>'' AND lower(identifier)=lower($3))) LIMIT 1",[req.params.id,v.title,v.identifier])).rowCount;if(duplicate)return res.status(409).json({error:'This research source is already recorded for the project.'});const row=await transaction(async client=>{const created=(await client.query('INSERT INTO research_sources(project_id,source_type,title,author,publisher,publication_date,url,identifier,notes,provenance,quality,relevance,created_by)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)RETURNING *',[req.params.id,v.sourceType,v.title,v.author,v.publisher,v.publicationDate,v.url,v.identifier,v.notes,v.provenance,v.quality,v.relevance,req.user.id])).rows[0];await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'SOURCE_ADDED',JSON.stringify({sourceId:created.id,title:created.title,type:created.source_type,provenance:created.provenance,quality:created.quality,relevance:created.relevance})]);await audit(client,req.user.id,'RESEARCH_SOURCE_ADDED','research_source',created.id,{projectId:req.params.id,title:created.title,provenance:created.provenance,quality:created.quality,relevance:created.relevance});return created});res.status(201).json(row)}catch(error){next(error)}})
const researchSourceGovernanceSchema=z.object({provenance:z.enum(['Internal','External','Primary Evidence','Secondary Evidence']),quality:z.enum(['Unrated','Low','Moderate','High']),relevance:z.enum(['Background','Supporting','Core'])})
app.patch('/api/research/:id/sources/:sourceId',authenticate,validate(researchSourceGovernanceSchema),async(req,res,next)=>{try{if(!await canAccessResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot update this research source.'});const source=(await query('SELECT * FROM research_sources WHERE id=$1 AND project_id=$2',[req.params.sourceId,req.params.id])).rows[0];if(!source)return res.status(404).json({error:'Research source not found.'});if(source.created_by!==req.user.id&&!['Administrator','Research Manager','Reviewer'].includes(req.user.role))return res.status(403).json({error:'Only the source owner, reviewer or manager can update evidence governance.'});const v=req.validated;const updated=await transaction(async client=>{const row=(await client.query('UPDATE research_sources SET provenance=$1,quality=$2,relevance=$3 WHERE id=$4 RETURNING *',[v.provenance,v.quality,v.relevance,source.id])).rows[0];await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'SOURCE_GOVERNANCE_UPDATED',JSON.stringify({sourceId:source.id,title:source.title,...v})]);await audit(client,req.user.id,'RESEARCH_SOURCE_GOVERNANCE_UPDATED','research_source',source.id,v);return row});res.json(updated)}catch(error){next(error)}})
app.delete('/api/research/:id/sources/:sourceId',authenticate,async(req,res,next)=>{try{if(!await canAccessResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot remove this research source.'});const source=(await query('SELECT * FROM research_sources WHERE id=$1 AND project_id=$2',[req.params.sourceId,req.params.id])).rows[0];if(!source)return res.status(404).json({error:'Research source not found.'});if(source.created_by!==req.user.id&&!['Administrator','Research Manager'].includes(req.user.role))return res.status(403).json({error:'Only the source owner or a research manager can remove this evidence record.'});await transaction(async client=>{await client.query('DELETE FROM research_sources WHERE id=$1',[source.id]);await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'SOURCE_REMOVED',JSON.stringify({sourceId:source.id,title:source.title})]);await audit(client,req.user.id,'RESEARCH_SOURCE_REMOVED','research_source',source.id,{projectId:req.params.id,title:source.title})});res.status(204).end()}catch(error){next(error)}})
app.get('/api/research/:id/activity',authenticate,async(req,res,next)=>{try{if(!await canAccessResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot view activity for this research project.'});res.json((await query('SELECT a.*,u.name user_name FROM research_activity a LEFT JOIN users u ON u.id=a.user_id WHERE a.project_id=$1 ORDER BY a.created_at DESC',[req.params.id])).rows)}catch(error){next(error)}})
app.get('/api/document-templates',authenticate,async(req,res,next)=>{try{const context=z.enum(['Assignment','Research']).parse(String(req.query.context||''));if(context==='Assignment')await ensureAssignmentFinalReportTemplate();res.json((await query("SELECT t.*,creator.name created_by_name,approver.name approved_by_name FROM document_templates t LEFT JOIN users creator ON creator.id=t.created_by LEFT JOIN users approver ON approver.id=t.approved_by WHERE t.context=$1 AND(t.active=TRUE OR $2::boolean) ORDER BY t.name",[context,['Administrator','Research Manager'].includes(req.user.role)])).rows)}catch(error){next(error)}})
app.post('/api/document-templates',authenticate,authorize('Administrator','Research Manager'),validate(z.object({name:z.string().min(3).max(200),context:z.enum(['Assignment','Research']),description:z.string().max(2000).default(''),sections:z.array(z.object({key:z.string().min(1).max(100),title:z.string().min(2).max(200)})).min(1).max(30)})),async(req,res,next)=>{try{const v=req.validated;const key=`${v.context.toLowerCase()}-${v.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${Date.now()}`;const row=await transaction(async client=>{const created=(await client.query("INSERT INTO document_templates(template_key,name,context,description,sections,governance_status,created_by)VALUES($1,$2,$3,$4,$5,'Draft',$6)RETURNING *",[key,v.name,v.context,v.description,JSON.stringify(v.sections),req.user.id])).rows[0];await audit(client,req.user.id,'DOCUMENT_TEMPLATE_CREATED','document_template',created.id,{name:created.name,context:created.context});return created});res.status(201).json(row)}catch(error){next(error)}})
app.patch('/api/document-templates/:id/governance',authenticate,authorize('Administrator','Research Manager'),validate(z.object({status:z.enum(['Draft','Standard','Approved','Retired']),active:z.boolean()})),async(req,res,next)=>{try{const row=await transaction(async client=>{const updated=(await client.query('UPDATE document_templates SET governance_status=$1,active=$2,approved_by=CASE WHEN $1=\'Approved\' THEN $3 ELSE approved_by END,updated_at=NOW() WHERE id=$4 RETURNING *',[req.validated.status,req.validated.active,req.user.id,req.params.id])).rows[0];if(updated)await audit(client,req.user.id,'DOCUMENT_TEMPLATE_GOVERNANCE_UPDATED','document_template',updated.id,req.validated);return updated});if(!row)return res.status(404).json({error:'Template not found.'});res.json(row)}catch(error){next(error)}})
const wordDocument=(title,metadata,sections)=>`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:2.2cm}body{font-family:Arial,sans-serif;color:#111;line-height:1.5}h1{text-align:center;margin:80px 0 30px}h2{page-break-before:auto;border-bottom:1px solid #777;padding-bottom:6px}.meta{width:100%;border-collapse:collapse;margin:25px 0 60px}.meta td{border:1px solid #999;padding:8px}.draft{color:#a22;font-weight:bold}</style></head><body><h1>${sanitizeReportHtml(title)}</h1><table class="meta">${Object.entries(metadata).map(([key,value])=>`<tr><td><b>${sanitizeReportHtml(key)}</b></td><td>${sanitizeReportHtml(value)}</td></tr>`).join('')}</table>${sections.map(section=>`<h2>${sanitizeReportHtml(section.title)}</h2>${section.content||'<p>&nbsp;</p>'}`).join('')}</body></html>`
const reportPlainText=value=>String(value||'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(td|th)>/gi,'\t').replace(/<\/tr>/gi,'\n').replace(/<\/p>|<\/li>|<\/h[1-6]>/gi,'\n').replace(/<li[^>]*>/gi,'• ').replace(/<[^>]+>/g,'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim()
const buildDocx=async(title,metadata,sections)=>Packer.toBuffer(new WordDocument({sections:[{properties:{},children:[
  new Paragraph({text:title,heading:HeadingLevel.TITLE}),
  new Paragraph({text:'Document Control',heading:HeadingLevel.HEADING_1}),
  ...Object.entries(metadata).map(([key,value])=>new Paragraph({children:[new TextRun({text:`${key}: `,bold:true}),new TextRun(String(value||''))]})),
  new Paragraph(''),
  ...sections.flatMap(section=>[new Paragraph({text:section.title,heading:HeadingLevel.HEADING_1}),...reportPlainText(section.content).split(/\n+/).map(text=>new Paragraph(text))])
]}]}))
const assignmentFinalReportSections=[
  {key:'executive_summary',title:'Executive Summary'},
  {key:'background',title:'Background and Assignment Mandate'},
  {key:'objectives',title:'Objectives and Scope'},
  {key:'work_undertaken',title:'Approach and Work Undertaken'},
  {key:'evidence_reviewed',title:'Evidence Reviewed'},
  {key:'key_findings',title:'Key Findings'},
  {key:'gaps_risks',title:'Gaps, Risks and Constraints'},
  {key:'conclusion',title:'Conclusions'},
  {key:'recommendations',title:'Recommendations'},
  {key:'action_matrix',title:'Implementation Action Matrix'},
  {key:'references',title:'References and Supporting Evidence'},
  {key:'appendices',title:'Appendices / Source Register'},
  {key:'review_approval',title:'Review and Approval Record'}
]
const ensureAssignmentFinalReportTemplate=async()=>{
  await query(`INSERT INTO document_templates(template_key,name,context,description,sections,version,governance_status,active)
    VALUES('assignment-final-report','Final Assignment Report','Assignment','PSC controlled final assignment report with document control, approved task-report provenance, findings, recommendations, implementation actions and formal approval record.',$1::jsonb,2,'Standard',TRUE)
    ON CONFLICT(template_key) DO UPDATE SET
      name=EXCLUDED.name,
      description=EXCLUDED.description,
      sections=EXCLUDED.sections,
      version=GREATEST(document_templates.version,EXCLUDED.version),
      governance_status=CASE WHEN document_templates.governance_status='Retired' THEN document_templates.governance_status ELSE 'Standard' END,
      active=CASE WHEN document_templates.governance_status='Retired' THEN document_templates.active ELSE TRUE END,
      updated_at=NOW()`,[JSON.stringify(assignmentFinalReportSections)])
  return (await query("SELECT * FROM document_templates WHERE template_key='assignment-final-report' LIMIT 1")).rows[0]||null
}
const compiledParagraph=value=>{const text=String(value||'').trim();return text?`<p>${escapeHtml(text).replaceAll('\n','<br>')}</p>`:''}
const compiledTaskBlocks=(tasks,field,label)=>tasks.map(task=>{const value=plainTaskReportText(task[field]);if(!value)return '';return `<article data-source-task-id="${task.id}"><h3>${escapeHtml(task.contribution_title||task.title)}</h3><p><strong>Prepared by:</strong> ${escapeHtml(task.owner_name||'Task owner')}</p><h4>${escapeHtml(label)}</h4>${compiledParagraph(value)}</article>`}).filter(Boolean).join('<hr>')
const compiledActionMatrix=tasks=>{const rows=tasks.map((task,index)=>{const action=plainTaskReportText(task.contribution_next_actions);if(!action)return '';return `<tr data-source-task-id="${task.id}"><td>${index+1}</td><td>${escapeHtml(action).replaceAll('\n','<br>')}</td><td>${escapeHtml(task.owner_name||'To confirm')}</td><td>${escapeHtml(task.due_date||'To confirm')}</td><td>${escapeHtml(task.contribution_title||task.title)}</td></tr>`}).filter(Boolean).join('');return rows?`<table><thead><tr><th>#</th><th>Action / Follow-up</th><th>Responsible Officer</th><th>Target Date</th><th>Source Task</th></tr></thead><tbody>${rows}</tbody></table>`:'<p>No implementation actions were recorded in the approved task reports. The Assignment Lead should add the required actions, responsible officers and target dates before submission.</p>'}
const compileAssignmentSectionContent=({section,tasks,assignment,knowledge,reportType})=>{
  const key=String(section.key||'').toLowerCase()
  const accepted=`${tasks.length} approved task report${tasks.length===1?'':'s'}`
  const taskTitles=tasks.map(task=>`<li>${escapeHtml(task.contribution_title||task.title)} — ${escapeHtml(task.owner_name||'Task owner')}</li>`).join('')
  if(['executive_summary','executive-summary'].includes(key))return `<p>This ${reportType==='Final'?'final assignment report':'progress report'} consolidates ${accepted} for <strong>${escapeHtml(assignment.title)}</strong>.</p>${taskTitles?`<ul>${taskTitles}</ul>`:''}`
  if(key==='background')return compiledParagraph(assignment.description||`Assignment mandate: ${assignment.title}`)
  if(['objectives','assignment_objectives'].includes(key))return `<p><strong>Assignment objective and scope:</strong></p>${compiledParagraph(assignment.description||'Complete the approved assignment work within the approved scope and deliver the required institutional outputs.')}`
  if(['work_undertaken','activities_undertaken','outputs'].includes(key))return compiledTaskBlocks(tasks,'contribution_summary','Approach and work completed')
  if(key==='evidence_reviewed')return compiledTaskBlocks(tasks,'evidence_reviewed','Evidence reviewed')
  if(['key_findings','key_achievements'].includes(key))return compiledTaskBlocks(tasks,'contribution_findings','Key findings')
  if(['gaps_risks','challenges_risks','issues'].includes(key))return compiledTaskBlocks(tasks,'contribution_challenges','Gaps, risks and challenges')
  if(['recommendations','corrective_actions'].includes(key))return compiledTaskBlocks(tasks,'contribution_recommendations','Recommendations')
  if(['action_matrix','next_steps','next-steps'].includes(key))return `<p><strong>Implementation actions consolidated from approved task reports.</strong> Confirm ownership, target dates and priorities before formal submission.</p>${compiledActionMatrix(tasks)}`
  if(['progress','progress_against_plan'].includes(key))return `<p><strong>${tasks.length}</strong> approved task report${tasks.length===1?'':'s'} incorporated into this report.</p>${taskTitles?`<ul>${taskTitles}</ul>`:''}`
  if(key==='conclusion')return `<p>The report consolidates ${accepted}. The Assignment Lead should state the overall conclusion arising from the approved findings, evidence and assignment objectives before formal review.</p>`
  if(key==='references'){const taskRefs=tasks.map(task=>`<li>Final Task Report: ${escapeHtml(task.contribution_title||task.title)} — ${escapeHtml(task.owner_name||'Task owner')}</li>`).join('');const repoRefs=knowledge.map(item=>`<li>Repository evidence: ${escapeHtml(item.title)} · ${escapeHtml(item.category||'Document')}</li>`).join('');return taskRefs||repoRefs?`<ul>${taskRefs}${repoRefs}</ul>`:''}
  if(key==='appendices'){const taskRefs=tasks.map((task,index)=>`<li>Appendix ${index+1}: Final Task Report — ${escapeHtml(task.contribution_title||task.title)} (${escapeHtml(task.owner_name||'Task owner')})</li>`).join('');const repoRefs=knowledge.map((item,index)=>`<li>Supporting Evidence ${index+1}: ${escapeHtml(item.title)} · ${escapeHtml(item.category||'Document')}</li>`).join('');return taskRefs||repoRefs?`<p>This source register records the approved inputs used to compile the Final Assignment Report.</p><ul>${taskRefs}${repoRefs}</ul>`:'<p>No appendices or supporting sources have been registered.</p>'}
  if(key==='review_approval')return '<p>To be completed automatically when the formal reviewer approves and publishes the final report.</p>'
  return ''
}
const buildPdf=(title,metadata,sections)=>new Promise((resolve,reject)=>{const pdf=new PDFDocument({size:'A4',margin:60,info:{Title:title,Author:'Public Service Commission'}}),chunks=[];pdf.on('data',chunk=>chunks.push(chunk));pdf.on('end',()=>resolve(Buffer.concat(chunks)));pdf.on('error',reject);pdf.fontSize(22).text(title,{align:'center'}).moveDown();pdf.fontSize(10);for(const [key,value] of Object.entries(metadata))pdf.font('Helvetica-Bold').text(`${key}: `,{continued:true}).font('Helvetica').text(String(value||''));pdf.moveDown();for(const section of sections){if(pdf.y>700)pdf.addPage();pdf.font('Helvetica-Bold').fontSize(15).text(section.title).moveDown(.4);pdf.font('Helvetica').fontSize(11).text(reportPlainText(section.content)||'').moveDown()}pdf.end()})
app.get('/api/document-templates/:id/download',authenticate,async(req,res,next)=>{try{const assignmentId=z.string().uuid().parse(String(req.query.assignmentId||''));if(!await canAccessAssignment(req.user,assignmentId))return res.status(403).json({error:'You cannot download a template for this assignment.'});const [template,assignment]=await Promise.all([query("SELECT * FROM document_templates WHERE id=$1 AND context='Assignment' AND active=TRUE AND governance_status IN('Standard','Approved')",[req.params.id]),query(`SELECT a.*,lead.name lead_name FROM assignments a LEFT JOIN assignment_members am ON am.assignment_id=a.id AND am.member_role='Lead' LEFT JOIN users lead ON lead.id=am.user_id WHERE a.id=$1 LIMIT 1`,[assignmentId])]);const t=template.rows[0],a=assignment.rows[0];if(!t||!a)return res.status(404).json({error:'Approved template or assignment not found.'});const html=wordDocument(t.name,{Organization:'Public Service Commission','Report Type':t.template_key==='assignment-final-report'?'Final Assignment Report':t.name,'Assignment Reference':`ASG-${a.id.replace(/[^a-f0-9]/gi,'').slice(0,6).toUpperCase()}`,'Assignment Title':a.title,Division:a.division||'Not specified','Assignment Lead':a.lead_name||'Unassigned','Reporting Period':`${new Date(a.created_at).toISOString().slice(0,10)} to ${a.due_date||'Open'}`,Classification:'INTERNAL',Status:'DRAFT',Date:new Date().toISOString().slice(0,10),'Template Version':String(t.version)},t.sections.map(section=>({...section,content:''})));res.setHeader('Content-Type','application/msword; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="${t.template_key}-v${t.version}.doc"`);res.send(html)}catch(error){next(error)}})

/* APP2_GENERATED_DOCUMENT_CORE_API_V1 */
const assignmentDocumentRole=async(user,document)=>{
  if(['Administrator','Research Manager'].includes(user.role))return 'Manager'
  if(document?.context!=='Assignment'||!document?.context_id||!user?.id)return null
  const membership=(await query(`SELECT member_role FROM assignment_members WHERE assignment_id=$1::uuid AND user_id=$2::uuid LIMIT 1`,[document.context_id,user.id])).rows[0]
  const memberRole=String(membership?.member_role||'').trim().toLowerCase()
  if(memberRole==='lead')return 'Lead'
  if(memberRole==='reviewer')return 'Reviewer'
  if(memberRole)return 'Contributor'
  const legacy=(await query(`SELECT a.created_by,(SELECT COUNT(*)::int FROM assignment_members am WHERE am.assignment_id=a.id AND am.member_role='Lead') lead_count FROM assignments a WHERE a.id=$1::uuid`,[document.context_id])).rows[0]
  if(legacy&&Number(legacy.lead_count||0)===0&&legacy.created_by===user.id)return 'Lead'
  return null
}
const loadGeneratedDocumentAccess=async(user,id)=>{
  const document=(await query(`SELECT d.*,t.name template_name,t.template_key,t.governance_status template_status,
    creator.name created_by_name,reviewer.name reviewer_name,submitter.name submitted_by_name,approver.name approved_by_name
    FROM generated_documents d
    JOIN document_templates t ON t.id=d.template_id
    JOIN users creator ON creator.id=d.created_by
    LEFT JOIN users reviewer ON reviewer.id=d.reviewer_id
    LEFT JOIN users submitter ON submitter.id=d.submitted_by
    LEFT JOIN users approver ON approver.id=d.approved_by
    WHERE d.id=$1::uuid`,[id])).rows[0]
  if(!document)return {document:null,allowed:false}
  let allowed=['Administrator','Research Manager'].includes(user.role)||document.created_by===user.id||document.reviewer_id===user.id
  if(!allowed&&document.context==='Assignment')allowed=await canAccessAssignment(user,document.context_id)
  if(!allowed&&document.context==='Research')allowed=await canAccessResearch(user,document.context_id)
  return {document,allowed}
}
app.get('/api/generated-documents',authenticate,async(req,res,next)=>{try{
  const context=z.enum(['Assignment','Research']).parse(String(req.query.context||''))
  const contextId=z.string().uuid().parse(String(req.query.contextId||''))
  const manager=['Administrator','Research Manager'].includes(req.user.role)
  const baseAccess=context==='Assignment'?await canAccessAssignment(req.user,contextId):await canAccessResearch(req.user,contextId)
  const rows=(await query(`SELECT d.*,t.name template_name,t.template_key,creator.name created_by_name,reviewer.name reviewer_name,
    (SELECT COUNT(*)::int FROM generated_document_sections s WHERE s.document_id=d.id) section_count,
    (SELECT COUNT(*)::int FROM generated_document_sections s WHERE s.document_id=d.id AND s.section_status IN('Ready','Complete')) ready_sections,
    repo.id repository_document_id,repo.title repository_document_title,
    imported.id external_import_id,imported.original_name external_import_name,imported.mime_type external_import_mime_type,
    imported.version_number external_import_version,imported.status external_import_status
    FROM generated_documents d
    JOIN document_templates t ON t.id=d.template_id
    JOIN users creator ON creator.id=d.created_by
    LEFT JOIN users reviewer ON reviewer.id=d.reviewer_id
    LEFT JOIN LATERAL(
      SELECT id,original_name,mime_type,version_number,status
      FROM assignment_report_imports i
      WHERE i.document_id=d.id AND i.is_current=TRUE
      ORDER BY i.version_number DESC LIMIT 1
    ) imported ON TRUE
    LEFT JOIN LATERAL(
      SELECT k.id,k.title FROM repository_entity_links rel
      JOIN knowledge_items k ON k.id=rel.knowledge_id
      WHERE rel.entity_type='report' AND rel.entity_id=d.id AND k.status='Published' AND k.is_archived=FALSE
      ORDER BY k.created_at DESC LIMIT 1
    ) repo ON TRUE
    WHERE d.context=$1 AND d.context_id=$2::uuid
      AND($3::boolean OR $4::boolean OR d.created_by=$5::uuid OR d.reviewer_id=$5::uuid)
    ORDER BY d.updated_at DESC`,[context,contextId,manager,baseAccess,req.user.id])).rows
  res.json(rows)
}catch(error){next(error)}})
app.get('/api/generated-documents/:id',authenticate,async(req,res,next)=>{try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document)return res.status(404).json({error:'Report not found.'})
  if(!allowed)return res.status(403).json({error:'You cannot view this report.'})
  const role=document.context==='Assignment'?await assignmentDocumentRole(req.user,document):null
  const sections=(await query(`SELECT s.*,owner.name owner_name,updater.name updated_by_name,locker.name locked_by_name,l.expires_at lock_expires_at
    FROM generated_document_sections s
    LEFT JOIN users owner ON owner.id=s.owner_id
    LEFT JOIN users updater ON updater.id=s.updated_by
    LEFT JOIN generated_document_section_locks l ON l.section_id=s.id AND l.expires_at>NOW()
    LEFT JOIN users locker ON locker.id=l.locked_by
    WHERE s.document_id=$1::uuid ORDER BY s.section_order`,[document.id])).rows
  const externalImport=document.context==='Assignment'
    ?(await query(`SELECT i.id,i.version_number,i.original_name,i.mime_type,i.size_bytes,i.sha256_hash,i.status,i.created_at,u.name uploader_name
       FROM assignment_report_imports i JOIN users u ON u.id=i.uploader_id
       WHERE i.document_id=$1::uuid AND i.is_current=TRUE
       ORDER BY i.version_number DESC LIMIT 1`,[document.id])).rows[0]||null
    :null
  const editableStage=!['Submitted','Under Review','Approved','Final'].includes(document.status)
  const canEditReport=Boolean(editableStage&&(role==='Lead'||role==='Manager'||document.created_by===req.user.id))
  const canSubmitReport=Boolean(editableStage&&(['Lead','Manager'].includes(role)||document.created_by===req.user.id))
  const canReviewReport=Boolean(['Submitted','Under Review'].includes(document.status)&&document.reviewer_id===req.user.id&&document.created_by!==req.user.id)
  const canFinalizeReport=Boolean(document.status==='Approved'&&(document.reviewer_id===req.user.id||['Lead','Manager'].includes(role)))
  res.json({...document,current_user_role:role,can_edit_report:canEditReport,can_submit_report:canSubmitReport,can_review_report:canReviewReport,can_finalize_report:canFinalizeReport,external_import:externalImport,sections})
}catch(error){next(error)}})
app.get('/api/generated-documents/:id/control',authenticate,async(req,res,next)=>{try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document)return res.status(404).json({error:'Report not found.'})
  if(!allowed)return res.status(403).json({error:'You cannot view this report control record.'})
  const [versions,reviews,comments,references]=await Promise.all([
    query(`SELECT v.*,u.name created_by_name FROM generated_document_versions v JOIN users u ON u.id=v.created_by WHERE v.document_id=$1::uuid ORDER BY v.version_number DESC`,[document.id]),
    query(`SELECT r.*,u.name reviewer_name FROM generated_document_reviews r JOIN users u ON u.id=r.reviewer_id WHERE r.document_id=$1::uuid ORDER BY r.created_at DESC`,[document.id]),
    query(`SELECT c.*,u.name author_name,s.title section_title FROM generated_document_comments c JOIN users u ON u.id=c.author_id LEFT JOIN generated_document_sections s ON s.id=c.section_id WHERE c.document_id=$1::uuid ORDER BY c.created_at DESC`,[document.id]),
    query(`SELECT * FROM generated_document_references WHERE document_id=$1::uuid ORDER BY created_at DESC`,[document.id])
  ])
  res.json({versions:versions.rows,reviews:reviews.rows,comments:comments.rows,references:references.rows})
}catch(error){next(error)}})
app.patch('/api/generated-documents/:id/sections/:sectionId',authenticate,validate(z.object({content:z.string().max(500000),completion:z.number().int().min(0).max(100),sectionStatus:z.enum(['Not Started','In Progress','Ready','Needs Changes','Complete']).optional()})),async(req,res,next)=>{try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document)return res.status(404).json({error:'Report not found.'})
  if(!allowed)return res.status(403).json({error:'You cannot edit this report.'})
  if(['Submitted','Under Review','Approved','Final'].includes(document.status))return res.status(409).json({error:'This report version is locked for review.'})
  const role=document.context==='Assignment'?await assignmentDocumentRole(req.user,document):null
  const section=(await query('SELECT * FROM generated_document_sections WHERE id=$1::uuid AND document_id=$2::uuid',[req.params.sectionId,document.id])).rows[0]
  if(!section)return res.status(404).json({error:'Report section not found.'})
  if(document.context==='Assignment'&&!['Lead','Manager'].includes(role)&&document.created_by!==req.user.id&&section.owner_id!==req.user.id)return res.status(403).json({error:'Only the section owner, report author, Assignment Lead or manager can edit this section.'})
  const updated=(await transaction(async client=>{
    const row=(await client.query(`UPDATE generated_document_sections SET content=$1::text,completion=$2::integer,section_status=COALESCE($3::varchar(30),section_status),updated_by=$4::uuid,updated_at=NOW() WHERE id=$5::uuid AND document_id=$6::uuid RETURNING *`,[req.validated.content,req.validated.completion,req.validated.sectionStatus||null,req.user.id,section.id,document.id])).rows[0]
    await client.query('UPDATE generated_documents SET last_updated_by=$1::uuid,updated_at=NOW() WHERE id=$2::uuid',[req.user.id,document.id])
    return row
  }))
  res.json(updated)
}catch(error){next(error)}})
app.post('/api/generated-documents/:id/sections/:sectionId/lock',authenticate,async(req,res,next)=>{try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document)return res.status(404).json({error:'Report not found.'})
  if(!allowed)return res.status(403).json({error:'You cannot edit this report.'})
  const section=(await query('SELECT id FROM generated_document_sections WHERE id=$1::uuid AND document_id=$2::uuid',[req.params.sectionId,document.id])).rows[0]
  if(!section)return res.status(404).json({error:'Report section not found.'})
  const active=(await query('SELECT locked_by,expires_at FROM generated_document_section_locks WHERE section_id=$1::uuid AND expires_at>NOW()',[section.id])).rows[0]
  if(active&&active.locked_by!==req.user.id)return res.status(409).json({error:'This section is currently being edited by another user.'})
  const expiresAt=new Date(Date.now()+10*60*1000)
  await query(`INSERT INTO generated_document_section_locks(section_id,document_id,locked_by,expires_at)VALUES($1::uuid,$2::uuid,$3::uuid,$4::timestamptz)
    ON CONFLICT(section_id)DO UPDATE SET locked_by=EXCLUDED.locked_by,locked_at=NOW(),expires_at=EXCLUDED.expires_at`,[section.id,document.id,req.user.id,expiresAt.toISOString()])
  res.json({expires_at:expiresAt.toISOString()})
}catch(error){next(error)}})
app.delete('/api/generated-documents/:id/sections/:sectionId/lock',authenticate,async(req,res,next)=>{try{
  await query('DELETE FROM generated_document_section_locks WHERE section_id=$1::uuid AND document_id=$2::uuid AND locked_by=$3::uuid',[req.params.sectionId,req.params.id,req.user.id])
  res.status(204).end()
}catch(error){next(error)}})
app.patch('/api/generated-documents/:id/sections/:sectionId/owner',authenticate,validate(z.object({ownerId:z.string().uuid().nullable()})),async(req,res,next)=>{try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document)return res.status(404).json({error:'Report not found.'})
  const role=document.context==='Assignment'?await assignmentDocumentRole(req.user,document):null
  if(!allowed||document.context!=='Assignment'||!['Lead','Manager'].includes(role))return res.status(403).json({error:'Only the Assignment Lead or manager can assign report sections.'})
  const row=(await query('UPDATE generated_document_sections SET owner_id=$1::uuid,updated_by=$2::uuid,updated_at=NOW() WHERE id=$3::uuid AND document_id=$4::uuid RETURNING *',[req.validated.ownerId,req.user.id,req.params.sectionId,document.id])).rows[0]
  if(!row)return res.status(404).json({error:'Report section not found.'})
  res.json(row)
}catch(error){next(error)}})
app.post('/api/generated-documents/:id/comments',authenticate,validate(z.object({sectionId:z.string().uuid().nullable().default(null),body:z.string().trim().min(1).max(4000)})),async(req,res,next)=>{try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document)return res.status(404).json({error:'Report not found.'})
  if(!allowed)return res.status(403).json({error:'You cannot comment on this report.'})
  const row=(await query('INSERT INTO generated_document_comments(document_id,section_id,author_id,body,version_number)VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5)RETURNING *',[document.id,req.validated.sectionId,req.user.id,req.validated.body,document.version])).rows[0]
  res.status(201).json(row)
}catch(error){next(error)}})
app.patch('/api/generated-documents/:id/comments/:commentId/resolve',authenticate,validate(z.object({resolved:z.boolean()})),async(req,res,next)=>{try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document)return res.status(404).json({error:'Report not found.'})
  if(!allowed)return res.status(403).json({error:'You cannot update this comment.'})
  const row=(await query('UPDATE generated_document_comments SET resolved=$1 WHERE id=$2::uuid AND document_id=$3::uuid RETURNING *',[req.validated.resolved,req.params.commentId,document.id])).rows[0]
  if(!row)return res.status(404).json({error:'Comment not found.'})
  res.json(row)
}catch(error){next(error)}})
app.post('/api/generated-documents/:id/references',authenticate,validate(z.object({sourceType:z.string().max(40),title:z.string().trim().min(1).max(300),author:z.string().max(240).default(''),publicationYear:z.number().int().nullable().default(null),publisher:z.string().max(240).default(''),url:z.string().max(3000).default(''),identifier:z.string().max(160).default(''),citationStyle:z.enum(['APA','Harvard','Chicago']).default('APA')})),async(req,res,next)=>{try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document)return res.status(404).json({error:'Report not found.'})
  if(!allowed)return res.status(403).json({error:'You cannot add references to this report.'})
  const v=req.validated
  const row=(await query(`INSERT INTO generated_document_references(document_id,source_type,title,author,publication_year,publisher,url,identifier,citation_style,created_by)
    VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10::uuid) RETURNING *`,[document.id,v.sourceType,v.title,v.author,v.publicationYear,v.publisher,v.url,v.identifier,v.citationStyle,req.user.id])).rows[0]
  res.status(201).json(row)
}catch(error){next(error)}})

app.get('/api/generated-documents/:id/export',authenticate,async(req,res,next)=>{
  try{
    const format=String(req.query.format||'docx').toLowerCase()
    if(!['docx','pdf','doc'].includes(format))return res.status(400).json({error:'Supported export formats: docx and pdf.'})
    const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
    if(!document)return res.status(404).json({error:'Report not found.'})
    if(!allowed||document.context!=='Assignment')return res.status(403).json({error:'You cannot download this assignment report.'})
    const [assignment,sections]=await Promise.all([query('SELECT * FROM assignments WHERE id=$1',[document.context_id]),query('SELECT title,content FROM generated_document_sections WHERE document_id=$1 ORDER BY section_order',[document.id])])
    const a=assignment.rows[0]
    if(!a)return res.status(404).json({error:'Assignment not found.'})
    const metadata={Reference:document.reference,'Assignment Reference':`ASG-${a.id.replace(/[^a-f0-9]/gi,'').slice(0,6).toUpperCase()}`,'Assignment Title':a.title,Division:a.division,Version:String(document.version),Status:document.status,Classification:document.classification,Date:new Date().toISOString().slice(0,10)}
    const safeName=`${document.reference}-${document.status.toLowerCase().replaceAll(' ','-')}`
    if(format==='pdf'){
      const buffer=await buildPdf(document.title,metadata,sections.rows)
      res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${safeName}.pdf"`);res.send(buffer)
    }else if(format==='docx'){
      const buffer=await buildDocx(document.title,metadata,sections.rows)
      res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.wordprocessingml.document');res.setHeader('Content-Disposition',`attachment; filename="${safeName}.docx"`);res.send(buffer)
    }else{
      const html=wordDocument(document.title,metadata,sections.rows)
      res.setHeader('Content-Type','application/msword; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="${safeName}.doc"`);res.send(html)
    }
    await transaction(client=>audit(client,req.user.id,'ASSIGNMENT_REPORT_DOWNLOADED','generated_document',document.id,{format,version:document.version,status:document.status}))
  }catch(error){next(error)}
})
app.post('/api/assignment-reports/:id/import',authenticate,async(req,res,next)=>{let storedPath;try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document||document.context!=='Assignment')return res.status(404).json({error:'Assignment report not found.'})
  if(!allowed)return res.status(403).json({error:'You cannot access this assignment report.'})
  if(['Submitted','Under Review','Approved','Final'].includes(document.status))return res.status(409).json({error:'This report version is locked. Create or reopen a revision before importing another report.'})
  const role=await assignmentDocumentRole(req.user,document)
  if(!['Lead','Manager','Contributor'].includes(role||'')&&document.created_by!==req.user.id)return res.status(403).json({error:'Only an assignment contributor, Assignment Lead, report author or manager can import an external report.'})
  let submittedName=String(req.headers['x-file-name']||'assignment-report.pdf')
  try{submittedName=decodeURIComponent(submittedName)}catch{}
  const checked=validateDocumentUpload(req.body,submittedName,req.headers['x-file-type'])
  if(!['.pdf','.docx'].includes(checked.extension))return res.status(415).json({error:'External reports for formal review must be PDF or DOCX.'})
  const stored=await storeDocument(req.body,checked.extension);storedPath=stored.absolutePath
  const created=await transaction(async client=>{
    const nextVersion=(await client.query('SELECT COALESCE(MAX(version_number),0)::int+1 next_version FROM assignment_report_imports WHERE document_id=$1::uuid',[document.id])).rows[0].next_version
    await client.query('UPDATE assignment_report_imports SET is_current=FALSE WHERE document_id=$1::uuid AND is_current=TRUE',[document.id])
    const row=(await client.query(`INSERT INTO assignment_report_imports(document_id,assignment_id,uploader_id,version_number,original_name,stored_name,storage_path,mime_type,size_bytes,sha256_hash,status,is_current)
      VALUES($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::varchar(255),$6::varchar(255),$7::text,$8::varchar(160),$9::bigint,$10::varchar(64),'Draft',TRUE)
      RETURNING id,version_number,original_name,mime_type,size_bytes,sha256_hash,status,created_at`,[
      document.id,document.context_id,req.user.id,nextVersion,checked.originalName,stored.storedName,stored.storagePath,checked.mimeType,req.body.length,checked.sha256
    ])).rows[0]
    await client.query(`UPDATE generated_documents
      SET status=CASE WHEN status='Changes Requested' THEN 'Revised' ELSE 'Draft' END,last_updated_by=$1::uuid,updated_at=NOW()
      WHERE id=$2::uuid`,[req.user.id,document.id])
    await audit(client,req.user.id,'ASSIGNMENT_REPORT_IMPORTED','generated_document',document.id,{importId:row.id,version:row.version_number,name:row.original_name,mimeType:row.mime_type,sha256:row.sha256_hash})
    return row
  })
  storedPath=null
  res.status(201).json(created)
}catch(error){if(storedPath)await fs.unlink(storedPath).catch(()=>{});if(error.status)return res.status(error.status).json({error:error.message});next(error)}})

app.get('/api/assignment-reports/:id/import/current/file',authenticate,async(req,res,next)=>{try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document||document.context!=='Assignment')return res.status(404).json({error:'Assignment report not found.'})
  if(!allowed)return res.status(403).json({error:'You cannot access this assignment report.'})
  const imported=(await query(`SELECT * FROM assignment_report_imports WHERE document_id=$1::uuid AND is_current=TRUE ORDER BY version_number DESC LIMIT 1`,[document.id])).rows[0]
  if(!imported)return res.status(404).json({error:'No external report has been imported for this report.'})
  const disposition=imported.mime_type==='application/pdf'?'inline':'attachment'
  res.setHeader('Content-Type',imported.mime_type)
  res.setHeader('Content-Disposition',`${disposition}; filename*=UTF-8''${encodeURIComponent(imported.original_name)}`)
  res.sendFile(resolveDocumentPath(imported.storage_path||imported.stored_name))
}catch(error){next(error)}})


app.get('/api/assignment-reports/:id/import/current/reader',authenticate,async(req,res,next)=>{try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document||document.context!=='Assignment')return res.status(404).json({error:'Assignment report not found.'})
  if(!allowed)return res.status(403).json({error:'You cannot access this assignment report.'})
  const imported=(await query(`SELECT * FROM assignment_report_imports WHERE document_id=$1::uuid AND is_current=TRUE ORDER BY version_number DESC LIMIT 1`,[document.id])).rows[0]
  if(!imported)return res.status(404).json({error:'No external report has been imported for this report.'})
  if(imported.mime_type==='application/pdf')return res.status(415).json({error:'PDF reports are displayed directly in the read-only PDF reader.'})
  if(imported.mime_type!=='application/vnd.openxmlformats-officedocument.wordprocessingml.document')return res.status(415).json({error:'Only DOCX reports can be converted into the document reader.'})
  const bytes=await fs.readFile(resolveDocumentPath(imported.storage_path||imported.stored_name))
  const converted=await mammoth.convertToHtml({buffer:bytes})
  const html=sanitizeHtml(converted.value||'',{
    allowedTags:['p','br','strong','b','em','i','u','ol','ul','li','h1','h2','h3','h4','h5','h6','table','thead','tbody','tr','th','td','blockquote','a'],
    allowedAttributes:{a:['href','title'],th:['colspan','rowspan'],td:['colspan','rowspan']},
    allowedSchemes:['http','https','mailto']
  })
  res.json({html,fileName:imported.original_name,mimeType:imported.mime_type})
}catch(error){next(error)}})

app.delete('/api/assignment-reports/:id/import/current',authenticate,async(req,res,next)=>{try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document||document.context!=='Assignment')return res.status(404).json({error:'Assignment report not found.'})
  if(!allowed)return res.status(403).json({error:'You cannot access this assignment report.'})
  if(!['Draft','Revised','Changes Requested'].includes(document.status))return res.status(409).json({error:'A submitted or approved report import cannot be discarded.'})
  const role=await assignmentDocumentRole(req.user,document)
  if(!['Lead','Manager'].includes(role||'')&&document.created_by!==req.user.id)return res.status(403).json({error:'Only the Assignment Lead, report author or authorised manager can discard this imported draft.'})
  const current=(await query(`SELECT * FROM assignment_report_imports WHERE document_id=$1::uuid AND is_current=TRUE ORDER BY version_number DESC LIMIT 1`,[document.id])).rows[0]
  if(!current)return res.status(404).json({error:'No imported report is waiting for review.'})
  await transaction(async client=>{
    await client.query(`UPDATE assignment_report_imports SET is_current=FALSE,status='Discarded' WHERE id=$1::uuid`,[current.id])
    await audit(client,req.user.id,'ASSIGNMENT_REPORT_IMPORT_DISCARDED','generated_document',document.id,{importId:current.id,version:current.version_number,name:current.original_name})
  })
  await deleteStoredDocument(current.storage_path||current.stored_name)
  res.json({discarded:true})
}catch(error){next(error)}})

app.post('/api/assignment-reports/:id/submit',authenticate,validate(z.object({reviewerId:z.string().uuid(),reviewDueDate:z.string().nullable().default(null),comments:z.string().max(4000).default('')})),async(req,res,next)=>{try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document||document.context!=='Assignment')return res.status(404).json({error:'Assignment report not found.'})
  const role=await assignmentDocumentRole(req.user,document)
  if(!allowed||(!['Lead','Manager'].includes(role)&&document.created_by!==req.user.id))return res.status(403).json({error:'Only the Assignment Lead, report author or an authorised manager can submit the report.'})
  if(!['Draft','Revised','Changes Requested'].includes(document.status))return res.status(409).json({error:'Only a draft or returned revision can be submitted for review.'})
  const reviewer=(await query('SELECT id,name,active FROM users WHERE id=$1::uuid',[req.validated.reviewerId])).rows[0]
  if(!reviewer||!reviewer.active)return res.status(409).json({error:'Choose an active reviewer.'})
  if(reviewer.id===req.user.id)return res.status(409).json({error:'The report author/submitting officer cannot review their own report.'})
  const result=await transaction(async client=>{
    const sections=(await client.query('SELECT section_key,title,section_order,content,completion,section_status,owner_id FROM generated_document_sections WHERE document_id=$1::uuid ORDER BY section_order',[document.id])).rows
    const imported=(await client.query(`SELECT id,version_number,original_name,mime_type,size_bytes,sha256_hash,status
      FROM assignment_report_imports WHERE document_id=$1::uuid AND is_current=TRUE ORDER BY version_number DESC LIMIT 1`,[document.id])).rows[0]||null
    if(!imported){
      const meaningful=sections.map(item=>String(item.content||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim()).join(' ').trim()
      if(!sections.length||meaningful.length<100)throw Object.assign(new Error('Add meaningful report content before submitting it for review, or import a complete PDF/DOCX report.'),{status:409})
    }
    const snapshot=imported
      ?{source:'external-import',importId:imported.id,importVersion:imported.version_number,originalName:imported.original_name,mimeType:imported.mime_type,sha256:imported.sha256_hash,sections}
      :sections
    await client.query(`INSERT INTO generated_document_versions(document_id,version_number,sections,change_note,status,template_version,created_by)
      VALUES($1::uuid,$2::integer,$3::jsonb,$4::text,'Submitted',$5::integer,$6::uuid)
      ON CONFLICT(document_id,version_number)DO NOTHING`,[document.id,document.version,JSON.stringify(snapshot),req.validated.comments,document.template_version,req.user.id])
    const updated=(await client.query(`UPDATE generated_documents SET status='Submitted',reviewer_id=$1::uuid,review_due_date=$2::date,
      submitted_by=$3::uuid,submitted_at=NOW(),updated_at=NOW() WHERE id=$4::uuid RETURNING *`,
      [reviewer.id,req.validated.reviewDueDate||null,req.user.id,document.id])).rows[0]
    if(imported)await client.query("UPDATE assignment_report_imports SET status='Submitted' WHERE id=$1::uuid",[imported.id])
    await client.query(`INSERT INTO generated_document_reviews(document_id,version_number,reviewer_id,decision,comments)
      VALUES($1::uuid,$2::integer,$3::uuid,'Submitted',$4::text)`,[document.id,document.version,reviewer.id,req.validated.comments])
    await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
      VALUES($1::uuid,'Assignment report review assigned',$2::text,'generated_document',$3::uuid)`,
      [reviewer.id,`Review “${document.title}” for the assignment.`,document.id])
    await audit(client,req.user.id,'ASSIGNMENT_REPORT_SUBMITTED','generated_document',document.id,{version:document.version,reviewerId:reviewer.id,reviewerName:reviewer.name,source:imported?'external-import':'app-editor'})
    return updated
  })
  res.json(result)
}catch(error){if(error.status)return res.status(error.status).json({error:error.message});next(error)}})

app.post('/api/assignments/:id/reports/compile',authenticate,validate(z.object({templateId:z.string().uuid(),title:z.string().min(3).max(300),taskIds:z.array(z.string().uuid()).min(1).max(100),knowledgeIds:z.array(z.string().uuid()).max(100).default([]),reportType:z.enum(['Progress','Final']).default('Progress')})),async(req,res,next)=>{try{
  const role=await assignmentDocumentRole(req.user,{context:'Assignment',context_id:req.params.id})
  if(!['Lead','Manager'].includes(role))return res.status(403).json({error:'Only the Assignment Lead or an authorised manager can compile an assignment report.'})
  const assignment=(await query('SELECT * FROM assignments WHERE id=$1',[req.params.id])).rows[0]
  if(!assignment)return res.status(404).json({error:'Assignment not found.'})
  const template=(await query("SELECT * FROM document_templates WHERE id=$1 AND context='Assignment' AND active=TRUE AND governance_status IN('Standard','Approved')",[req.validated.templateId])).rows[0]
  if(!template)return res.status(400).json({error:'Choose an approved Assignment report template.'})
  if(req.validated.reportType==='Final'&&template.template_key!=='assignment-final-report')return res.status(400).json({error:'The Final Assignment Report must use the approved final-report template.'})
  const allTasks=(await query(`SELECT t.*,u.name owner_name,reviewer.name reviewer_name,repo.id repository_document_id,repo.title repository_document_title
    FROM assignment_tasks t
    LEFT JOIN users u ON u.id=t.owner_id
    LEFT JOIN users reviewer ON reviewer.id=t.reviewer_id
    LEFT JOIN LATERAL(
      SELECT k.id,k.title
      FROM knowledge_items k
      JOIN repository_entity_links rel ON rel.knowledge_id=k.id
      WHERE rel.entity_type='task' AND rel.entity_id=t.id
        AND k.document_type='Task Final Report' AND k.status='Published' AND k.is_archived=FALSE
      ORDER BY k.created_at DESC LIMIT 1
    ) repo ON TRUE
    WHERE t.assignment_id=$1 AND t.archived_at IS NULL
    ORDER BY t.created_at`,[assignment.id])).rows
  const selectedIds=[...new Set(req.validated.taskIds)]
  const tasks=allTasks.filter(task=>selectedIds.includes(task.id)&&task.contribution_status==='Accepted')
  if(tasks.length!==selectedIds.length)return res.status(409).json({error:'Only final approved task reports can be included.'})
  const untraceable=tasks.filter(task=>!task.repository_document_id)
  if(untraceable.length)return res.status(409).json({error:`${untraceable.length} final task report${untraceable.length===1?' is':'s are'} missing an immutable Repository record. Open the affected task report(s) and complete final publication before compiling an assignment report.`})
  if(req.validated.reportType==='Final'){
    if(!allTasks.length)return res.status(409).json({error:'Create and complete the assignment tasks before compiling the final report.'})
    const outstanding=allTasks.filter(task=>task.contribution_status!=='Accepted')
    if(outstanding.length)return res.status(409).json({error:`Final Assignment Report is locked: ${outstanding.length} task report${outstanding.length===1?' is':'s are'} not final.`})
    if(tasks.length!==allTasks.length)return res.status(409).json({error:'The Final Assignment Report must include every final task report.'})
  }
  let knowledge=[]
  if(req.validated.knowledgeIds.length){
    knowledge=(await query("SELECT id,title,category,status FROM knowledge_items WHERE id=ANY($1::uuid[]) AND status='Published' AND is_archived=FALSE",[req.validated.knowledgeIds])).rows
    if(knowledge.length!==new Set(req.validated.knowledgeIds).size)return res.status(409).json({error:'Use only current published Repository evidence.'})
  }
  const result=await transaction(async client=>{
    const reference=`ASG-RPT-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const document=(await client.query("INSERT INTO generated_documents(template_id,template_version,context,context_id,title,reference,classification,status,created_by,last_updated_by)VALUES($1,$2,'Assignment',$3,$4,$5,'Official','Draft',$6,$6)RETURNING *",[template.id,template.version,assignment.id,req.validated.title,reference,req.user.id])).rows[0]
    for(const task of tasks){
      await client.query(`INSERT INTO assignment_report_sources(
        document_id,task_id,task_title,task_owner_id,task_owner_name,reviewer_id,reviewer_name,task_report_version,task_approved_at,repository_document_id,repository_document_title
      )VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT(document_id,task_id) DO NOTHING`,[
        document.id,task.id,task.title,task.owner_id||null,task.owner_name||null,task.reviewer_id||null,task.reviewer_name||null,
        Number(task.contribution_report_version||1),task.contribution_integrated_at||null,task.repository_document_id||null,task.repository_document_title||null
      ])
    }
    const sections=template.sections||[]
    for(const [index,section] of sections.entries()){
      const content=compileAssignmentSectionContent({section,tasks,assignment,knowledge,reportType:req.validated.reportType})
      const systemReady=section.key==='review_approval'
      await client.query("INSERT INTO generated_document_sections(document_id,section_key,title,section_order,content,completion,section_status,updated_by)VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[document.id,section.key,section.title,index+1,content,systemReady?100:content?60:0,systemReady?'Ready':content?'In Progress':'Not Started',req.user.id])
    }
    for(const knowledgeId of [...new Set(req.validated.knowledgeIds)])await client.query("INSERT INTO repository_entity_links(knowledge_id,entity_type,entity_id,linked_by)VALUES($1,'assignment',$2,$3)ON CONFLICT DO NOTHING",[knowledgeId,assignment.id,req.user.id])
    await audit(client,req.user.id,'ASSIGNMENT_REPORT_COMPILED','generated_document',document.id,{assignmentId:assignment.id,reportType:req.validated.reportType,taskIds:selectedIds,knowledgeIds:req.validated.knowledgeIds,sourceSnapshots:tasks.map(task=>({taskId:task.id,taskReportVersion:Number(task.contribution_report_version||1),repositoryDocumentId:task.repository_document_id||null,approvedAt:task.contribution_integrated_at||null}))})
    return document
  })
  res.status(201).json(result)
}catch(error){if(error.status)return res.status(error.status).json({error:error.message});next(error)}})
app.post('/api/assignment-reports/:id/sections/:sectionId/tasks/:taskId',authenticate,async(req,res,next)=>{try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document||document.context!=='Assignment')return res.status(404).json({error:'Assignment report not found.'})
  const role=await assignmentDocumentRole(req.user,document)
  if(!allowed||!['Lead','Manager'].includes(role))return res.status(403).json({error:'Only the Assignment Team Lead or a manager can add task reports.'})
  if(['Submitted','Under Review','Approved','Final'].includes(document.status))return res.status(409).json({error:'This assignment report is not editable.'})
  const result=await transaction(async client=>{
    const section=(await client.query('SELECT * FROM generated_document_sections WHERE id=$1 AND document_id=$2 FOR UPDATE',[req.params.sectionId,document.id])).rows[0]
    if(!section)throw Object.assign(new Error('Report section not found.'),{status:404})
    const task=(await client.query("SELECT t.*,u.name owner_name FROM assignment_tasks t LEFT JOIN users u ON u.id=t.owner_id WHERE t.id=$1 AND t.assignment_id=$2 AND (t.status='Completed' OR t.progress=100 OR t.contribution_status='Accepted')",[req.params.taskId,document.context_id])).rows[0]
    if(!task)throw Object.assign(new Error('Choose a completed task from this assignment.'),{status:409})
    const marker=`data-task-report-id="${task.id}"`
    if(String(section.content||'').includes(marker))throw Object.assign(new Error('This task report is already included in the selected section.'),{status:409})
    const contribution=`<section ${marker}><h3>${escapeHtml(task.contribution_title||task.title)}</h3><p><strong>Task:</strong> ${escapeHtml(task.title)} &nbsp; <strong>Prepared by:</strong> ${escapeHtml(task.owner_name||'Task owner')}</p><h4>Work completed</h4><p>${escapeHtml(task.contribution_summary||'')}</p><h4>Evidence reviewed</h4><p>${escapeHtml(task.evidence_reviewed||'')}</p><h4>Key findings</h4><p>${escapeHtml(task.contribution_findings||'')}</p><h4>Recommendations</h4><p>${escapeHtml(task.contribution_recommendations||'')}</p></section>`
    const content=`${section.content||''}${section.content?'<hr>':''}${contribution}`
    const updated=(await client.query("UPDATE generated_document_sections SET content=$1,completion=GREATEST(completion,60),section_status=CASE WHEN section_status='Not Started' THEN 'In Progress' ELSE section_status END,updated_by=$2,updated_at=NOW() WHERE id=$3 RETURNING *",[content,req.user.id,section.id])).rows[0]
    await client.query('UPDATE assignment_tasks SET target_document_id=$1,target_section_id=$2,assignment_part=$3,updated_at=NOW() WHERE id=$4',[document.id,section.id,section.title,task.id])
    await client.query('UPDATE generated_documents SET updated_at=NOW(),last_updated_by=$1 WHERE id=$2',[req.user.id,document.id])
    await audit(client,req.user.id,'TASK_REPORT_ADDED_TO_ASSIGNMENT_SECTION','generated_document',document.id,{taskId:task.id,sectionId:section.id})
    return updated
  })
  res.json(result)
}catch(error){if(error.status)return res.status(error.status).json({error:error.message});next(error)}})
app.post('/api/assignment-reports/:id/review',authenticate,validate(z.object({decision:z.enum(['Under Review','Changes Requested','Rejected','Approved']),comments:z.string().max(4000).default('')})),async(req,res,next)=>{try{
  const {document}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document||document.context!=='Assignment')return res.status(404).json({error:'Assignment report not found.'})
  const manager=['Administrator','Research Manager'].includes(req.user.role)
  if(document.reviewer_id!==req.user.id&&!manager)return res.status(403).json({error:'This report is assigned to another reviewer.'})
  if(document.created_by===req.user.id)return res.status(403).json({error:'You cannot review a report you created.'})
  if(!['Submitted','Under Review'].includes(document.status)&&req.validated.decision!=='Under Review')return res.status(409).json({error:'Only a submitted report can receive a formal review decision.'})
  if(['Changes Requested','Rejected'].includes(req.validated.decision)&&!req.validated.comments.trim())return res.status(400).json({error:req.validated.decision==='Rejected'?'Explain why the report is being rejected.':'Explain the changes required.'})
  const updated=await transaction(async client=>{
    let row
    if(req.validated.decision==='Approved'){
      row=(await client.query(`UPDATE generated_documents SET status='Approved',approved_by=$1::uuid,approved_at=NOW(),updated_at=NOW()
        WHERE id=$2::uuid RETURNING *`,[req.user.id,document.id])).rows[0]
      await client.query("UPDATE assignment_report_imports SET status='Approved' WHERE document_id=$1::uuid AND is_current=TRUE",[document.id])
    }else if(req.validated.decision==='Changes Requested'){
      row=(await client.query(`UPDATE generated_documents SET status='Changes Requested',version=version+1,approved_by=NULL,approved_at=NULL,updated_at=NOW()
        WHERE id=$1::uuid RETURNING *`,[document.id])).rows[0]
      await client.query("UPDATE generated_document_sections SET section_status='Needs Changes',completion=LEAST(completion,90) WHERE document_id=$1::uuid AND section_status IN('Ready','Complete')",[document.id])
      await client.query("UPDATE assignment_report_imports SET status='Changes Requested' WHERE document_id=$1::uuid AND is_current=TRUE",[document.id])
    }else{
      row=(await client.query(`UPDATE generated_documents SET status='Under Review',updated_at=NOW() WHERE id=$1::uuid RETURNING *`,[document.id])).rows[0]
      await client.query("UPDATE assignment_report_imports SET status='Under Review' WHERE document_id=$1::uuid AND is_current=TRUE",[document.id])
    }
    await client.query(`INSERT INTO generated_document_reviews(document_id,version_number,reviewer_id,decision,comments)
      VALUES($1::uuid,$2::integer,$3::uuid,$4::varchar(40),$5::text)`,
      [document.id,document.version,req.user.id,req.validated.decision,req.validated.comments])
    await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
      VALUES($1::uuid,$2::varchar(180),$3::text,'generated_document',$4::uuid)`,
      [document.created_by,req.validated.decision==='Changes Requested'?'Assignment report changes requested':'Assignment report approved',`“${document.title}” is now ${req.validated.decision}. ${req.validated.comments}`,document.id])
    await audit(client,req.user.id,`ASSIGNMENT_REPORT_${req.validated.decision.toUpperCase().replaceAll(' ','_')}`,'generated_document',document.id,{version:document.version,comments:req.validated.comments})
    return row
  })
  res.json(updated)
}catch(error){next(error)}})

app.post('/api/assignment-reports/:id/finalize',authenticate,async(req,res,next)=>{let storedFinalPath;try{
  const document=(await query(`SELECT d.*,t.name template_name,creator.name created_by_name,reviewer.name reviewer_name,
    a.title assignment_title,a.division assignment_division,a.created_at assignment_created_at,a.due_date assignment_due_date,
    lead.name lead_name,
    (SELECT string_agg(team_user.name, ', ' ORDER BY CASE WHEN team_member.member_role='Lead' THEN 0 ELSE 1 END,team_user.name)
      FROM assignment_members team_member JOIN users team_user ON team_user.id=team_member.user_id
      WHERE team_member.assignment_id=a.id) team_names
    FROM generated_documents d
    JOIN document_templates t ON t.id=d.template_id
    JOIN users creator ON creator.id=d.created_by
    LEFT JOIN users reviewer ON reviewer.id=d.reviewer_id
    JOIN assignments a ON a.id=d.context_id
    LEFT JOIN assignment_members am ON am.assignment_id=a.id AND am.member_role='Lead'
    LEFT JOIN users lead ON lead.id=am.user_id
    WHERE d.id=$1::uuid AND d.context='Assignment' LIMIT 1`,[req.params.id])).rows[0]
  if(!document)return res.status(404).json({error:'Assignment report not found.'})
  const role=await assignmentDocumentRole(req.user,document)
  if(document.reviewer_id!==req.user.id&&!['Lead','Manager'].includes(role||''))return res.status(403).json({error:'Only the assigned reviewer, Assignment Lead or authorised manager can generate the approved final report.'})
  if(document.status==='Final'){
    const existing=(await query(`SELECT k.id,k.title FROM repository_entity_links rel JOIN knowledge_items k ON k.id=rel.knowledge_id
      WHERE rel.entity_type='report' AND rel.entity_id=$1::uuid AND k.status='Published'
      ORDER BY k.created_at DESC LIMIT 1`,[document.id])).rows[0]
    return res.json({report:document,repository_document_id:existing?.id||null,repository_document_title:existing?.title||null})
  }
  if(document.status!=='Approved')return res.status(409).json({error:'Approve the Assignment Report before generating the final repository copy.'})
  const tasks=(await query("SELECT id FROM assignment_tasks WHERE assignment_id=$1::uuid AND archived_at IS NULL AND contribution_status<>'Accepted'",[document.context_id])).rows
  if(tasks.length)return res.status(409).json({error:'Every active task must have a final approved task report before the Final Assignment Report can be published.'})
  const currentImport=(await query(`SELECT * FROM assignment_report_imports
    WHERE document_id=$1::uuid AND is_current=TRUE AND status='Approved'
    ORDER BY version_number DESC LIMIT 1`,[document.id])).rows[0]||null

  const approvalTime=new Intl.DateTimeFormat('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'}).format(new Date(document.approved_at||Date.now()))
  const repositoryTitle=document.title.replace(/\s*[—-]\s*Draft Assignment Report$/i,'').trim()||`${document.assignment_title} — Final Assignment Report`
  const safeBase=String(document.assignment_title||'assignment-report').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,90)||'assignment-report'

  let finalBytes,mimeType,originalName,extension
  if(currentImport){
    finalBytes=await fs.readFile(resolveDocumentPath(currentImport.storage_path||currentImport.stored_name))
    mimeType=currentImport.mime_type
    extension=path.extname(currentImport.original_name).toLowerCase()||'.pdf'
    originalName=`${safeBase}-final-v${document.version}${extension}`
  }else{
    const sections=(await query('SELECT title,content,section_key FROM generated_document_sections WHERE document_id=$1::uuid ORDER BY section_order',[document.id])).rows
    const finalSections=[...sections.filter(section=>section.section_key!=='review_approval'),{title:'Review and Approval Record',content:`Status: FINAL — APPROVED
Reviewed and approved by: ${document.reviewer_name||'Assigned reviewer'}
Approval date: ${approvalTime}
Controlled report version: ${document.version}`}]
    const assignmentReference=`ASG-${String(document.context_id).replace(/[^a-f0-9]/gi,'').slice(0,6).toUpperCase()}`
    const reportingStart=document.assignment_created_at?new Intl.DateTimeFormat('en-KE',{dateStyle:'medium',timeZone:'Africa/Nairobi'}).format(new Date(document.assignment_created_at)):'Not specified'
    const reportingEnd=document.assignment_due_date?new Intl.DateTimeFormat('en-KE',{dateStyle:'medium',timeZone:'Africa/Nairobi'}).format(new Date(document.assignment_due_date)):'Open'
    finalBytes=await buildDocx(repositoryTitle,{
      Organization:'Public Service Commission','Report Type':'Final Assignment Report','Assignment Reference':assignmentReference,
      'Assignment Title':document.assignment_title,Division:document.assignment_division||'Not specified',
      'Assignment Lead':document.lead_name||'Not specified','Team Members':document.team_names||document.lead_name||'Not specified',
      'Reporting Period':`${reportingStart} – ${reportingEnd}`,'Report Reference':document.reference,
      'Controlled Version':String(document.version),Classification:document.classification||'Official',
      'Prepared / Compiled by':document.created_by_name,'Reviewed and Approved by':document.reviewer_name||'Assigned reviewer',
      'Approval Date':approvalTime,Status:'FINAL — APPROVED'
    },finalSections)
    mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    extension='.docx'
    originalName=`${safeBase}-final-v${document.version}.docx`
  }

  const stored=await storeDocument(finalBytes,extension);storedFinalPath=stored.absolutePath
  const sha256=crypto.createHash('sha256').update(finalBytes).digest('hex')
  const result=await transaction(async client=>{
    const locked=(await client.query('SELECT status FROM generated_documents WHERE id=$1::uuid FOR UPDATE',[document.id])).rows[0]
    if(!locked||locked.status!=='Approved')throw Object.assign(new Error('This report is no longer awaiting final generation. Refresh the workspace.'),{statusCode:409})
    const category=(await client.query("SELECT id FROM document_categories WHERE name='Assignment Reports' LIMIT 1")).rows[0]||null
    const description=`Final approved assignment report for “${document.assignment_title}”. Prepared by ${document.created_by_name} and approved by ${document.reviewer_name||'the assigned reviewer'}.`
    const tags=['final-report','assignment-report','approved']
    const item=(await client.query(`INSERT INTO knowledge_items(
      title,description,category,category_id,tags,author,document_date,status,created_by,approved_by,approved_at,current_version,
      source_type,source_url,directorate,document_type,subject,classification,felix_enabled,reviewed_by,reviewed_at)
      VALUES($1::varchar(300),$2::text,'Assignment Reports',$3::uuid,$4::text[],$5::varchar(240),CURRENT_DATE,'Published',
      $6::uuid,$6::uuid,NOW(),1,'Assignment','',$7::varchar(180),'Assignment Final Report',$8::varchar(300),'INTERNAL',TRUE,$6::uuid,NOW())
      RETURNING *`,[repositoryTitle,description,category?.id||null,tags,document.lead_name||document.created_by_name,req.user.id,document.assignment_division||null,document.assignment_title])).rows[0]
    const version=(await client.query(`INSERT INTO knowledge_versions(
      knowledge_id,version_number,uploader_id,original_name,stored_name,storage_path,mime_type,size_bytes,sha256_hash,is_current,approved_by,approved_at,notes)
      VALUES($1::uuid,1,$2::uuid,$3::varchar(255),$4::varchar(255),$5::text,$6::varchar(160),$7::bigint,$8::varchar(64),TRUE,$2::uuid,NOW(),$9::text)
      RETURNING *`,[item.id,req.user.id,originalName,stored.storedName,stored.storagePath,mimeType,finalBytes.length,sha256,currentImport?'Published from the exact reviewer-approved imported report':'Automatically generated from the reviewer-approved Final Assignment Report'])).rows[0]
    for(const tag of tags){
      const tagRow=(await client.query(`INSERT INTO document_tags(name,normalized_name,created_by)
        VALUES($1::varchar(120),lower($1::varchar(120)),$2::uuid)
        ON CONFLICT(normalized_name)DO UPDATE SET name=EXCLUDED.name RETURNING id`,[tag,req.user.id])).rows[0]
      await client.query('INSERT INTO document_tag_links(knowledge_id,tag_id)VALUES($1::uuid,$2::uuid)ON CONFLICT DO NOTHING',[item.id,tagRow.id])
    }
    await client.query("INSERT INTO repository_entity_links(knowledge_id,entity_type,entity_id,linked_by)VALUES($1::uuid,'report',$2::uuid,$3::uuid)ON CONFLICT DO NOTHING",[item.id,document.id,req.user.id])
    await client.query("INSERT INTO repository_entity_links(knowledge_id,entity_type,entity_id,linked_by)VALUES($1::uuid,'assignment',$2::uuid,$3::uuid)ON CONFLICT DO NOTHING",[item.id,document.context_id,req.user.id])
    await client.query('INSERT INTO knowledge_assignment_links(knowledge_id,assignment_id,linked_by)VALUES($1::uuid,$2::uuid,$3::uuid)ON CONFLICT DO NOTHING',[item.id,document.context_id,req.user.id])
    const final=(await client.query("UPDATE generated_documents SET status='Final',updated_at=NOW() WHERE id=$1::uuid RETURNING *",[document.id])).rows[0]
    if(currentImport)await client.query("UPDATE assignment_report_imports SET status='Final' WHERE id=$1::uuid",[currentImport.id])
    await client.query("UPDATE assignments SET status='Completed',updated_at=NOW() WHERE id=$1::uuid",[document.context_id])
    await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1::uuid,$2::uuid,$3::varchar(80),$4::jsonb)',[document.context_id,req.user.id,'ASSIGNMENT_FINAL_REPORT_GENERATED',JSON.stringify({generatedDocumentId:document.id,repositoryDocumentId:item.id,repositoryVersionId:version.id,version:document.version,source:currentImport?'external-import':'app-editor'})])
    await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1::uuid,'Final Assignment Report published',$2::text,'generated_document',$3::uuid)",[document.created_by,`The Final Assignment Report for “${document.assignment_title}” has been published to the Document Repository.`,document.id])
    await audit(client,req.user.id,'ASSIGNMENT_FINAL_REPORT_GENERATED','generated_document',document.id,{assignmentId:document.context_id,repositoryDocumentId:item.id,version:document.version,source:currentImport?'external-import':'app-editor'})
    await audit(client,req.user.id,'DOCUMENT_AUTO_PUBLISHED_FROM_ASSIGNMENT','knowledge',item.id,{assignmentId:document.context_id,generatedDocumentId:document.id,sha256})
    await enqueueFelixDocumentIndex(client,item.id,1,req.user.id)
    return {final,item}
  })
  storedFinalPath=null
  res.json({report:result.final,repository_document_id:result.item.id,repository_document_title:result.item.title})
}catch(error){if(storedFinalPath)await fs.unlink(storedFinalPath).catch(()=>{});if(error.statusCode)return res.status(error.statusCode).json({error:error.message});next(error)}})

app.get('/api/research/:id/comments',authenticate,async(req,res,next)=>{

  try{
    const canAccess=await canAccessResearch(req.user,req.params.id)

    if(!canAccess)
      return res.status(403).json({
        error:'You cannot view this research discussion.'
      })

    const rows=await query(
      `SELECT
         rc.id,
         rc.body,
         rc.category,
         rc.resolved,
         rc.resolved_at,
         rc.created_at,
         u.id author_id,
         u.name author_name
       FROM research_comments rc
       JOIN users u ON u.id=rc.author_id
       WHERE rc.project_id=$1
       ORDER BY rc.created_at`,
      [req.params.id]
    )

    res.json(rows.rows)
  }catch(error){
    next(error)
  }
})


app.post(
  '/api/research/:id/comments',
  authenticate,
  validate(
    z.object({
      body:z.string().min(1).max(4000),
      category:z.enum(['Update','Question','Decision','Review Note']).default('Update')
    })

  ),
  async(req,res,next)=>{
    try{
      const canAccess=await canAccessResearch(req.user,req.params.id)

      if(!canAccess)
        return res.status(403).json({
          error:'You cannot comment on this research project.'
        })

      const created=(
        await query(
          `INSERT INTO research_comments(
             project_id,
             author_id,
             body,
             category
           )
           VALUES($1,$2,$3,$4)
           RETURNING id,project_id,author_id,body,category,resolved,created_at`,
          [
            req.params.id,
            req.user.id,
            req.validated.body.trim(),
            req.validated.category
          ]
        )
      ).rows[0]

      await query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'DISCUSSION_POSTED',JSON.stringify({commentId:created.id,category:created.category})])
      res.status(201).json(created)
    }catch(error){
      next(error)
    }
  }
)
app.patch('/api/research/:id/comments/:commentId/resolve',authenticate,validate(z.object({resolved:z.boolean()})),async(req,res,next)=>{try{if(!await canAccessResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot update this discussion item.'});const comment=(await query('SELECT * FROM research_comments WHERE id=$1 AND project_id=$2',[req.params.commentId,req.params.id])).rows[0];if(!comment)return res.status(404).json({error:'Discussion item not found.'});if(!['Administrator','Research Manager'].includes(req.user.role)&&comment.author_id!==req.user.id)return res.status(403).json({error:'Only the author or a research manager can resolve this item.'});const updated=await transaction(async client=>{const row=(await client.query('UPDATE research_comments SET resolved=$1,resolved_by=CASE WHEN $1 THEN $2 ELSE NULL END,resolved_at=CASE WHEN $1 THEN NOW() ELSE NULL END WHERE id=$3 RETURNING *',[req.validated.resolved,req.user.id,comment.id])).rows[0];await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,req.validated.resolved?'DISCUSSION_RESOLVED':'DISCUSSION_REOPENED',JSON.stringify({commentId:comment.id,category:comment.category})]);return row});res.json(updated)}catch(error){next(error)}})
const defaultResearchReportSections = [
  ['executive-summary','Executive Summary',1],
  ['introduction','Introduction',2],
  ['background','Background',3],
  ['research-question','Research Question',4],
  ['objectives','Objectives',5],
  ['methodology','Methodology',6],
  ['findings','Findings',7],
  ['discussion-analysis','Discussion and Analysis',8],
  ['conclusions','Conclusions',9],
  ['recommendations','Recommendations',10],
  ['references','References',11],
  ['appendices','Appendices',12]
]


app.get('/api/research/:id/report',authenticate,async(req,res,next)=>{
  try{
    res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma','no-cache')
    res.set('Expires','0')
    const canAccess=await canAccessResearch(req.user,req.params.id)

    if(!canAccess){
      return res.status(403).json({
        error:'You cannot access this research report.'
      })
    }

    for(const [sectionKey,title,sectionOrder] of defaultResearchReportSections){
      await query(
        `INSERT INTO research_report_sections(
           project_id,
           section_key,
           title,
           section_order
         )
         VALUES($1,$2,$3,$4)
         ON CONFLICT(project_id,section_key) DO NOTHING`,
        [
          req.params.id,
          sectionKey,
          title,
          sectionOrder
        ]
      )
    }

    const sections=await query(
      `SELECT
         rrs.id,
         rrs.section_key,
         rrs.title,
         rrs.content,
         rrs.section_order,
         rrs.status,
         rrs.owner_id,
         rrs.reviewer_id,
         rrs.updated_at,
         u.name updated_by_name,
         owner.name owner_name,
         reviewer.name reviewer_name
       FROM research_report_sections rrs
       LEFT JOIN users u ON u.id=rrs.updated_by
       LEFT JOIN users owner ON owner.id=rrs.owner_id
       LEFT JOIN users reviewer ON reviewer.id=rrs.reviewer_id
       WHERE rrs.project_id=$1
       ORDER BY rrs.section_order`,
      [req.params.id]
    )

    res.json(sections.rows)
  }catch(error){
    next(error)
  }
})


app.patch(
  '/api/research/:id/report/:sectionId',
  authenticate,
  validate(
    z.object({
      title:z.string().min(1).max(250).optional(),
      content:z.string().max(100000).optional(),
      status:z.enum([
        'Not Started',
        'Draft',
        'In Progress',
        'Ready for Review',
        'Approved'
      ]).optional(),
      ownerId:z.string().uuid().nullable().optional(),
      reviewerId:z.string().uuid().nullable().optional()
    })
  ),
  async(req,res,next)=>{
    try{
      const canAccess=await canAccessResearch(req.user,req.params.id)

      if(!canAccess){
        return res.status(403).json({
          error:'You cannot edit this research report.'
        })
      }

      const current=(
        await query(
          `SELECT *
           FROM research_report_sections
           WHERE id=$1
             AND project_id=$2`,
          [
            req.params.sectionId,
            req.params.id
          ]
        )
      ).rows[0]

      if(!current){
        return res.status(404).json({
          error:'Report section was not found.'
        })
      }
      const latestSubmission=(await query("SELECT status FROM research_report_versions WHERE project_id=$1 AND status IN('Submitted','Approved','Rejected') ORDER BY version_number DESC LIMIT 1",[req.params.id])).rows[0]
      if(latestSubmission?.status==='Submitted'&&(req.validated.content!==undefined||req.validated.title!==undefined||req.validated.ownerId!==undefined||req.validated.reviewerId!==undefined||req.validated.status!==undefined))return res.status(409).json({error:'This submitted research report version is locked while it is under review. Record the decision on the submitted version instead of editing sections.'})
      if(['Approved','Rejected'].includes(latestSubmission?.status)&&(req.validated.content!==undefined||req.validated.title!==undefined||req.validated.status!==undefined))return res.status(409).json({error:latestSubmission.status==='Approved'?'The approved research report is locked.':'The rejected research report version is locked. Use Request changes when a new author revision is required.'})
      const project=(await query('SELECT id,title,lead_id FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
      const isManager=['Administrator','Research Manager'].includes(req.user.role)
      const isAssignedReviewer=(await query('SELECT 1 FROM research_reviewers WHERE project_id=$1 AND reviewer_id=$2 AND active=TRUE',[req.params.id,req.user.id])).rowCount>0
      const canManageSection=isManager||project?.lead_id===req.user.id
      if(req.validated.status==='Approved'&&!isManager&&!isAssignedReviewer)return res.status(403).json({error:'Only an assigned research reviewer or research manager can approve a report section.'})
      if(isAssignedReviewer&&!canManageSection&&(req.validated.title!==undefined||req.validated.content!==undefined||req.validated.ownerId!==undefined||req.validated.reviewerId!==undefined))return res.status(403).json({error:'Reviewers assess submitted research content but cannot rewrite or reassign the author’s report section.'})
      if(isAssignedReviewer&&!canManageSection&&req.validated.status&&req.validated.status!=='Approved')return res.status(403).json({error:'Assigned reviewers may approve submitted report sections but cannot change authoring workflow states.'})
      if(current.owner_id&&current.owner_id!==req.user.id&&!canManageSection&&!isAssignedReviewer)return res.status(403).json({error:'This report section is assigned to another team member.'})
      if(req.validated.ownerId!==undefined&&!canManageSection)return res.status(403).json({error:'Only the research lead or manager can assign report sections.'})
      if(req.validated.ownerId&&(await query('SELECT 1 FROM research_projects p WHERE p.id=$1 AND(p.lead_id=$2 OR EXISTS(SELECT 1 FROM research_collaborators WHERE project_id=p.id AND user_id=$2))',[req.params.id,req.validated.ownerId])).rowCount===0)return res.status(400).json({error:'Assign this section to a member of the research team.'})
      if(req.validated.reviewerId!==undefined&&!canManageSection)return res.status(403).json({error:'Only the research lead or manager can assign a section reviewer.'})
      if(req.validated.reviewerId&&(await query("SELECT 1 FROM users WHERE id=$1 AND active=TRUE AND role IN('Reviewer','Research Manager','Administrator')",[req.validated.reviewerId])).rowCount===0)return res.status(400).json({error:'Choose an active Reviewer, Research Manager or Administrator.'})

      const updated=(
        await query(
          `UPDATE research_report_sections
           SET
             title=$1,
             content=$2,
             status=$3,
             owner_id=$4,
             reviewer_id=$5,
             updated_by=$6,
             updated_at=NOW()
           WHERE id=$7
           RETURNING *`,
          [
            req.validated.title??current.title,
            req.validated.content??current.content,
            req.validated.status??current.status,
            req.validated.ownerId===undefined?current.owner_id:req.validated.ownerId,
            req.validated.reviewerId===undefined?current.reviewer_id:req.validated.reviewerId,
            req.user.id,
            current.id
          ]
        )
      ).rows[0]

      if(updated.status==='Ready for Review'&&updated.reviewer_id&&(current.status!=='Ready for Review'||current.reviewer_id!==updated.reviewer_id)){
        const owner=(await query('SELECT name FROM users WHERE id=$1',[updated.owner_id||req.user.id])).rows[0]
        await query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Research section requires approval',$2,'research_report_section',$3)",[updated.reviewer_id,`Action required: review and approve “${updated.title}” in research project “${project.title}”. Submitted by ${owner?.name||req.user.name}. Open the Research workspace, select Report, then choose this section.`,project.id])
      }
      await query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'REPORT_SECTION_UPDATED',JSON.stringify({sectionId:current.id,status:updated.status,ownerId:updated.owner_id,reviewerId:updated.reviewer_id,notificationSent:updated.status==='Ready for Review'&&Boolean(updated.reviewer_id)})])
      res.json(updated)
    }catch(error){
      next(error)
    }
  }
)

app.get('/api/research/:id/report/versions',authenticate,async(req,res,next)=>{try{
  if(!await canAccessResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot view research report versions.'})
  const rows=(await query(`SELECT v.*,reviewer.name reviewer_name,submitter.name submitted_by_name,reviewed.name reviewed_by_name
    FROM research_report_versions v
    LEFT JOIN users reviewer ON reviewer.id=v.reviewer_id
    LEFT JOIN users submitter ON submitter.id=v.submitted_by
    LEFT JOIN users reviewed ON reviewed.id=v.reviewed_by
    WHERE v.project_id=$1 ORDER BY v.version_number DESC`,[req.params.id])).rows
  res.json(rows)
}catch(error){next(error)}})

app.post('/api/research/:id/report/submit',authenticate,validate(z.object({title:z.string().min(3).max(300),reviewerId:z.string().uuid()})),async(req,res,next)=>{try{
  const project=(await query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  const canSubmit=['Administrator','Research Manager'].includes(req.user.role)||project.lead_id===req.user.id
  if(!canSubmit)return res.status(403).json({error:'Only the research lead or research manager can submit the report for review.'})
  const reviewer=(await query("SELECT u.id,u.name FROM users u JOIN research_reviewers rr ON rr.reviewer_id=u.id AND rr.project_id=$2 AND rr.active=TRUE WHERE u.id=$1 AND u.active=TRUE",[req.validated.reviewerId,project.id])).rows[0]
  if(!reviewer)return res.status(400).json({error:'Choose a formal reviewer assigned to this research project.'})
  if(reviewer.id===req.user.id)return res.status(400).json({error:'The person submitting the research report cannot review the same submission.'})
  const sections=(await query('SELECT id,section_key,title,content,section_order,status,owner_id,reviewer_id FROM research_report_sections WHERE project_id=$1 ORDER BY section_order',[project.id])).rows
  if(!sections.some(section=>String(section.content||'').trim()))return res.status(409).json({error:'Write and save report content before submission.'})
  const active=(await query("SELECT id,status FROM research_report_versions WHERE project_id=$1 AND status='Submitted' ORDER BY version_number DESC LIMIT 1",[project.id])).rows[0]
  if(active)return res.status(409).json({error:'A research report version is already awaiting reviewer decision.'})
  const row=await transaction(async client=>{
    await client.query('SELECT id FROM research_projects WHERE id=$1 FOR UPDATE',[project.id]); const latest=(await client.query('SELECT COALESCE(MAX(version_number),0)::int n FROM research_report_versions WHERE project_id=$1',[project.id])).rows[0]
    const previous=(await client.query("SELECT id FROM research_report_versions WHERE project_id=$1 AND status='Changes Requested' ORDER BY version_number DESC LIMIT 1",[project.id])).rows[0]
    const created=(await client.query(`INSERT INTO research_report_versions(project_id,version_number,title,report_snapshot,created_by,status,reviewer_id,submitted_by,submitted_at,parent_version_id)
      VALUES($1,$2,$3,$4,$5,'Submitted',$6,$5,NOW(),$7) RETURNING *`,[project.id,latest.n+1,req.validated.title,JSON.stringify({sections}),req.user.id,reviewer.id,previous?.id||null])).rows[0]
    await client.query("UPDATE research_report_sections SET status='Ready for Review',reviewer_id=$2,updated_at=NOW() WHERE project_id=$1 AND content<>''",[project.id,reviewer.id])
    await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Research report awaiting review',$2,'research',$3)",[reviewer.id,`Version ${created.version_number} of “${project.title}” is ready for your review.`,project.id])
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[project.id,req.user.id,'REPORT_SUBMITTED_FOR_REVIEW',JSON.stringify({versionId:created.id,versionNumber:created.version_number,reviewerId:reviewer.id})])
    await audit(client,req.user.id,'RESEARCH_REPORT_SUBMITTED','research_report_version',created.id,{projectId:project.id,versionNumber:created.version_number,reviewerId:reviewer.id})
    return {...created,reviewer_name:reviewer.name,submitted_by_name:req.user.name}
  })
  res.status(201).json(row)
}catch(error){next(error)}})

app.post('/api/research/:id/report/versions/:versionId/decision',authenticate,validate(z.object({decision:z.enum(['Approved','Changes Requested','Rejected']),comments:z.string().max(4000).default('')})),async(req,res,next)=>{try{
  if(req.validated.decision!=='Approved'&&!req.validated.comments.trim())return res.status(400).json({error:'Add reviewer comments explaining the required action.'})
  const version=(await query('SELECT * FROM research_report_versions WHERE id=$1 AND project_id=$2',[req.params.versionId,req.params.id])).rows[0]
  if(!version)return res.status(404).json({error:'Research report version not found.'})
  if(version.status!=='Submitted')return res.status(409).json({error:'Only a submitted research report version can receive a review decision.'})
  const isManager=['Administrator','Research Manager'].includes(req.user.role)
  if(!isManager&&version.reviewer_id!==req.user.id)return res.status(403).json({error:'This research report is assigned to another reviewer.'})
  const project=(await query('SELECT id,title,lead_id FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  const row=await transaction(async client=>{
    const updated=(await client.query('UPDATE research_report_versions SET status=$1,reviewed_by=$2,reviewed_at=NOW(),review_comments=$3 WHERE id=$4 RETURNING *',[req.validated.decision,req.user.id,req.validated.comments,version.id])).rows[0]
    if(req.validated.decision==='Approved')await client.query("UPDATE research_report_sections SET status='Approved',updated_at=NOW() WHERE project_id=$1 AND content<>''",[project.id])
    else if(req.validated.decision==='Changes Requested')await client.query("UPDATE research_report_sections SET status=CASE WHEN content='' THEN 'Draft' ELSE 'In Progress' END,updated_at=NOW() WHERE project_id=$1",[project.id])
    if(project?.lead_id)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,$2,$3,'research',$4)",[project.lead_id,req.validated.decision==='Approved'?'Research report approved':req.validated.decision==='Changes Requested'?'Research report changes requested':'Research report rejected',req.validated.decision==='Approved'?`Version ${version.version_number} of “${project.title}” was approved.`:`Version ${version.version_number} of “${project.title}”: ${req.validated.comments}`,project.id])
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[project.id,req.user.id,req.validated.decision==='Approved'?'REPORT_APPROVED':req.validated.decision==='Changes Requested'?'REPORT_CHANGES_REQUESTED':'REPORT_REJECTED',JSON.stringify({versionId:version.id,versionNumber:version.version_number,comments:req.validated.comments})])
    await audit(client,req.user.id,'RESEARCH_REPORT_REVIEW_DECISION','research_report_version',version.id,{projectId:project.id,decision:req.validated.decision,comments:req.validated.comments})
    return updated
  })
  res.json(row)
}catch(error){next(error)}})

app.post('/api/research/:id/report/generate',authenticate,validate(z.object({title:z.string().min(3).max(300),classification:z.enum(['Official','Internal','Confidential','Public']).default('Official'),templateId:z.string().uuid().nullable().default(null),mode:z.enum(['Draft','Final']).default('Final'),reviewerId:z.string().uuid().nullable().default(null),knowledgeIds:z.array(z.string().uuid()).max(100).default([])})),async(req,res,next)=>{try{
  const project=(await query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  const canGenerate=['Administrator','Research Manager'].includes(req.user.role)||project.lead_id===req.user.id
  if(!canGenerate)return res.status(403).json({error:'Only the research lead or a research manager can generate the controlled report.'})
  const sections=(await query('SELECT * FROM research_report_sections WHERE project_id=$1 ORDER BY section_order',[req.params.id])).rows
  if(!sections.length)return res.status(409).json({error:'The research report has no sections to generate.'})
  const draftMode=req.validated.mode==='Draft'
  if(draftMode&&!sections.some(section=>section.content.trim()))return res.status(409).json({error:'Write and save at least one report section before generating a draft.'})
  if(!draftMode&&sections.some(section=>section.status!=='Approved'))return res.status(409).json({error:'Approve every required research report section before generating the controlled report.'})
  if(!draftMode&&(await query("SELECT 1 FROM research_report_versions WHERE project_id=$1 AND status='Approved' ORDER BY version_number DESC LIMIT 1",[project.id])).rowCount===0)return res.status(409).json({error:'The complete research report must be submitted and approved as a locked version before final generation.'})
  if(!draftMode&&!await researchHasControlledEvidence(req.params.id))return res.status(409).json({error:'Add at least one controlled research source or link a published Repository document before generating the report.'})
  if(draftMode&&!req.validated.reviewerId)return res.status(400).json({error:'Choose an authorised reviewer before sending the draft report.'})
  if(req.validated.reviewerId){const reviewer=(await query("SELECT id,name FROM users WHERE id=$1 AND active=TRUE AND role IN('Reviewer','Research Manager','Administrator')",[req.validated.reviewerId])).rows[0];if(!reviewer)return res.status(400).json({error:'Choose an active authorised reviewer or manager.'});if(draftMode&&(await query('SELECT 1 FROM research_reviewers WHERE project_id=$1 AND reviewer_id=$2 AND active=TRUE',[project.id,req.validated.reviewerId])).rowCount===0)return res.status(400).json({error:'Choose one of the formal reviewers assigned to this research project.'})}
  if(req.validated.knowledgeIds.length){const available=(await query("SELECT COUNT(*)::int total FROM knowledge_items WHERE id=ANY($1::uuid[]) AND(status='Published' OR $2='Draft')",[req.validated.knowledgeIds,req.validated.mode])).rows[0].total;if(available!==new Set(req.validated.knowledgeIds).size)return res.status(400).json({error:'Final reports may use only published Repository documents.'})}
  const generated=await transaction(async client=>{
    const template=req.validated.templateId?(await client.query("SELECT * FROM document_templates WHERE id=$1 AND context='Research' AND active=TRUE AND governance_status IN('Standard','Approved')",[req.validated.templateId])).rows[0]:(await client.query("SELECT * FROM document_templates WHERE context='Research' AND active=TRUE AND governance_status IN('Standard','Approved') ORDER BY CASE governance_status WHEN 'Approved' THEN 0 ELSE 1 END,name LIMIT 1")).rows[0]
    if(!template)throw Object.assign(new Error('No active Standard or Approved Research template is available.'),{status:409})
    const reference=`RSH-DOC-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const document=(await client.query("INSERT INTO generated_documents(template_id,template_version,context,context_id,title,reference,classification,status,created_by,last_updated_by,reviewer_id,submitted_by,submitted_at)VALUES($1,$2,'Research',$3,$4,$5,$6,$7,$8,$8,$9,CASE WHEN $7='Submitted' THEN $8 ELSE NULL END,CASE WHEN $7='Submitted' THEN NOW() ELSE NULL END)RETURNING *",[template.id,template.version,project.id,req.validated.title,reference,req.validated.classification,draftMode?'Submitted':'Draft',req.user.id,req.validated.reviewerId])).rows[0]
    for(const section of sections){const completion=section.status==='Approved'?100:section.content.trim()?60:0;await client.query("INSERT INTO generated_document_sections(document_id,section_key,title,section_order,content,completion,section_status,owner_id,updated_by)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",[document.id,section.section_key,section.title,section.section_order,section.content,completion,section.status==='Approved'?'Complete':section.content.trim()?'In Progress':'Not Started',section.owner_id,req.user.id])}
    for(const knowledgeId of [...new Set(req.validated.knowledgeIds)]){await client.query("INSERT INTO repository_entity_links(knowledge_id,entity_type,entity_id,linked_by)VALUES($1,'research',$2,$3)ON CONFLICT DO NOTHING",[knowledgeId,project.id,req.user.id]);const item=(await client.query('SELECT title,author,document_date FROM knowledge_items WHERE id=$1',[knowledgeId])).rows[0];await client.query("INSERT INTO generated_document_references(document_id,source_type,title,author,publication_year,publisher,url,identifier,citation_style,created_by)VALUES($1,'Repository Document',$2,$3,$4,'Public Service Commission','','','APA',$5)",[document.id,item.title,item.author||'',item.document_date?new Date(item.document_date).getFullYear():null,req.user.id])}
    if(draftMode){await client.query("INSERT INTO generated_document_reviews(document_id,version_number,reviewer_id,decision,comments)VALUES($1,$2,$3,'Submitted','Draft research report submitted for review.')",[document.id,document.version,req.validated.reviewerId]);await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Draft research report ready for review',$2,'generated_document',$3)",[req.validated.reviewerId,`Review “${document.title}” for research project “${project.title}”.`,document.id])}
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[project.id,req.user.id,draftMode?'DRAFT_REPORT_SUBMITTED':'CONTROLLED_REPORT_GENERATED',JSON.stringify({documentId:document.id,reference,title:document.title,sectionCount:sections.length,reviewerId:req.validated.reviewerId})])
    await audit(client,req.user.id,'RESEARCH_CONTROLLED_REPORT_GENERATED','generated_document',document.id,{projectId:project.id,reference,sectionCount:sections.length,templateId:template.id})
    return {...document,template_name:template.name,created_by_name:req.user.name}
  })
  res.status(201).json(generated)
}catch(error){if(error.status)return res.status(error.status).json({error:error.message});next(error)}})
app.get('/api/audit-logs',authenticate,authorize('Administrator'),async(req,res,next)=>{
  try{
    const filters=z.object({search:z.string().max(200).default(''),userId:z.string().uuid().or(z.literal('')).default(''),action:z.string().max(100).default(''),entityType:z.string().max(80).default(''),from:z.string().default(''),to:z.string().default(''),limit:z.coerce.number().int().min(1).max(500).default(250)}).parse({search:String(req.query.search||''),userId:String(req.query.userId||''),action:String(req.query.action||''),entityType:String(req.query.entityType||''),from:String(req.query.from||''),to:String(req.query.to||''),limit:req.query.limit||250})
    const values=[filters.search,filters.userId||null,filters.action,filters.entityType,filters.from||null,filters.to||null,filters.limit]
    const where="($1='' OR l.action ILIKE '%'||$1||'%' OR l.entity_type ILIKE '%'||$1||'%' OR COALESCE(u.name,'System') ILIKE '%'||$1||'%' OR l.details::text ILIKE '%'||$1||'%')AND($2::uuid IS NULL OR l.user_id=$2)AND($3='' OR l.action=$3)AND($4='' OR l.entity_type=$4)AND($5::date IS NULL OR l.created_at::date>=$5::date)AND($6::date IS NULL OR l.created_at::date<=$6::date)"
    const [items,total,actions,entities]=await Promise.all([
      query(`SELECT l.*,COALESCE(u.name,'System / Unknown')user_name,u.email user_email FROM audit_logs l LEFT JOIN users u ON u.id=l.user_id WHERE ${where} ORDER BY l.created_at DESC LIMIT $7`,values),
      query(`SELECT COUNT(*)::int total FROM audit_logs l LEFT JOIN users u ON u.id=l.user_id WHERE ${where}`,values.slice(0,6)),
      query('SELECT DISTINCT action FROM audit_logs ORDER BY action'),
      query('SELECT DISTINCT entity_type FROM audit_logs ORDER BY entity_type')
    ])
    res.json({items:items.rows,total:total.rows[0].total,actions:actions.rows.map(row=>row.action),entityTypes:entities.rows.map(row=>row.entity_type)})
  }catch(error){next(error)}
})
app.post('/api/document-reviews/:id/submit',authenticate,async(req,res,next)=>{try{if(await activeExternalResearchForKnowledge(req.params.id))return res.status(409).json({error:'Imported research is submitted and resubmitted only from its Research Repository reader.'});const updated=await transaction(async client=>{const item=(await client.query("UPDATE knowledge_items SET status='Pending Approval',approved_by=NULL,approved_at=NULL,rejection_reason=NULL,updated_at=NOW() WHERE id=$1 AND(created_by=$2 OR $3) RETURNING *",[req.params.id,req.user.id,canManageKnowledge(req.user)])).rows[0];if(!item)return null;await client.query("INSERT INTO document_reviews(knowledge_id,reviewer_id,actor_id,action,comments) VALUES($1,$2,$3,$4,'Submitted for review')",[item.id,item.reviewer_id,req.user.id,item.reviewer_id?'RESUBMITTED':'SUBMITTED']);await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT id,'Document awaiting review',$1,'knowledge',$2 FROM users WHERE active=TRUE AND role IN('Reviewer','Research Manager') AND($3::uuid IS NULL OR id=$3)",[`“${item.title}” has been submitted for review.`,item.id,item.reviewer_id||null]);await audit(client,req.user.id,'DOCUMENT_SUBMITTED','knowledge',item.id,{});return item});if(!updated)return res.status(404).json({error:'Document not found or you cannot submit it.'});res.json(updated)}catch(error){next(error)}})
app.get('/api/document-reviews',authenticate,authorize('Administrator','Research Manager','Reviewer'),async(req,res,next)=>{try{const mine=req.user.role==='Reviewer';res.json((await query(`SELECT k.*,creator.name created_by_name,reviewer.name reviewer_name,COALESCE((SELECT json_agg(json_build_object('id',r.id,'action',r.action,'comments',r.comments,'created_at',r.created_at,'actor_name',actor.name) ORDER BY r.created_at DESC) FROM document_reviews r JOIN users actor ON actor.id=r.actor_id WHERE r.knowledge_id=k.id),'[]') review_history FROM knowledge_items k JOIN users creator ON creator.id=k.created_by LEFT JOIN users reviewer ON reviewer.id=k.reviewer_id WHERE k.status='Pending Approval' AND NOT EXISTS(SELECT 1 FROM external_research_imports eri WHERE eri.knowledge_id=k.id AND eri.status NOT IN('Published','Rejected')) AND(NOT $1::boolean OR k.reviewer_id IS NULL OR k.reviewer_id=$2) ORDER BY k.updated_at`,[mine,req.user.id])).rows)}catch(error){next(error)}})
app.patch('/api/document-reviews/:id/assign',authenticate,authorize('Administrator','Research Manager'),validate(z.object({reviewerId:z.string().uuid()})),async(req,res,next)=>{try{if(await activeExternalResearchForKnowledge(req.params.id))return res.status(409).json({error:'Imported research reviewers are assigned contextually from Research Repository, not the generic document review queue.'});const updated=await transaction(async client=>{const reviewer=(await client.query("SELECT id,name FROM users WHERE id=$1 AND role IN('Reviewer','Research Manager','Administrator') AND active=TRUE",[req.validated.reviewerId])).rows[0];if(!reviewer)throw new Error('Choose an active reviewer or manager.');const item=(await client.query("UPDATE knowledge_items SET reviewer_id=$1,status='Pending Approval',updated_at=NOW() WHERE id=$2 RETURNING *",[reviewer.id,req.params.id])).rows[0];if(!item)return null;await client.query("INSERT INTO document_reviews(knowledge_id,reviewer_id,actor_id,action,comments) VALUES($1,$2,$3,'ASSIGNED',$4)",[item.id,reviewer.id,req.user.id,`Assigned to ${reviewer.name}`]);await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'Document review assigned',$2,'knowledge',$3)",[reviewer.id,`You have been assigned to review “${item.title}”.`,item.id]);await audit(client,req.user.id,'DOCUMENT_REVIEW_ASSIGNED','knowledge',item.id,{reviewerId:reviewer.id});return {...item,reviewer_name:reviewer.name}});if(!updated)return res.status(404).json({error:'Document not found.'});res.json(updated)}catch(error){next(error)}})
app.post('/api/document-reviews/:id/decision',authenticate,authorize('Administrator','Research Manager','Reviewer'),validate(z.object({approved:z.boolean(),comments:z.string().max(2000).default('')})),async(req,res,next)=>{
  try{
    if(!req.validated.approved&&!req.validated.comments.trim())return res.status(400).json({error:'Explain what must be corrected before rejecting.'})
    const result=await transaction(async client=>{
      const item=(await client.query('SELECT * FROM knowledge_items WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]
      if(!item)return {kind:'missing'}
      if(item.status!=='Pending Approval')return {kind:'conflict'}
      if(req.user.role==='Reviewer'&&item.reviewer_id&&item.reviewer_id!==req.user.id)return {kind:'forbidden'}
      const status=req.validated.approved?'Published':'Rejected'
      const row=(await client.query('UPDATE knowledge_items SET status=$1,approved_by=$2,approved_at=$3,rejection_reason=$4,updated_at=NOW() WHERE id=$5 RETURNING *',[status,req.validated.approved?req.user.id:null,req.validated.approved?new Date():null,req.validated.approved?null:req.validated.comments,item.id])).rows[0]
      await client.query('INSERT INTO document_reviews(knowledge_id,reviewer_id,actor_id,action,comments) VALUES($1,$2,$3,$4,$5)',[item.id,item.reviewer_id,req.user.id,req.validated.approved?'APPROVED':'REJECTED',req.validated.comments])
      await client.query('INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,$2,$3,$4,$5)',[item.created_by,req.validated.approved?'Document approved':'Document returned for correction',req.validated.approved?`“${item.title}” has been approved and published.`:`“${item.title}” was rejected: ${req.validated.comments}`,'knowledge',item.id])
      await audit(client,req.user.id,req.validated.approved?'KNOWLEDGE_PUBLISHED':'KNOWLEDGE_REJECTED','knowledge',item.id,{comments:req.validated.comments})
      if(req.validated.approved)await enqueueFelixDocumentIndex(client,row.id,row.current_version,req.user.id)
      return {kind:'updated',row}
    })
    if(result.kind==='missing')return res.status(404).json({error:'Document not found.'})
    if(result.kind==='conflict')return res.status(409).json({error:'Only pending documents can be reviewed.'})
    if(result.kind==='forbidden')return res.status(403).json({error:'This review is assigned to another reviewer.'})
    res.json(result.row)
  }catch(error){next(error)}
})
app.get('/api/document-reviews/:id/history',authenticate,async(req,res,next)=>{try{if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot view this review history.'});res.json((await query('SELECT r.id,r.action,r.comments,r.created_at,actor.name actor_name,reviewer.name reviewer_name FROM document_reviews r JOIN users actor ON actor.id=r.actor_id LEFT JOIN users reviewer ON reviewer.id=r.reviewer_id WHERE r.knowledge_id=$1 ORDER BY r.created_at DESC',[req.params.id])).rows)}catch(error){next(error)}})
app.get('/api/dashboard',authenticate,async(req,res,next)=>{
  try{
    const management=['Administrator','Research Manager'].includes(req.user.role)
    const researcher=req.user.role==='Research Officer'
    const reviewerOnly=req.user.role==='Reviewer'

    // Dashboard visibility is deliberately narrower than general workspace visibility.
    // Researchers see only tasks owned by them. Reviewer-only accounts see only
    // reviews assigned to them. Managers retain the organisational overview.
    const assignments=management
      ? await query("SELECT a.id,a.title,a.status,a.priority,a.due_date,a.updated_at,'Assignment' type FROM assignments a WHERE a.status<>'Completed' ORDER BY a.due_date NULLS LAST,a.updated_at DESC LIMIT 20")
      : {rows:[]}

    const tasks=researcher
      ? await query("SELECT t.id,t.assignment_id,t.title,t.status,t.priority,t.due_date,t.updated_at,a.title context_title,'Task' type FROM assignment_tasks t JOIN assignments a ON a.id=t.assignment_id WHERE t.archived_at IS NULL AND t.status<>'Completed' AND t.owner_id=$1 ORDER BY t.due_date NULLS LAST,t.updated_at DESC LIMIT 40",[req.user.id])
      : management
        ? await query("SELECT t.id,t.assignment_id,t.title,t.status,t.priority,t.due_date,t.updated_at,a.title context_title,'Task' type FROM assignment_tasks t JOIN assignments a ON a.id=t.assignment_id WHERE t.archived_at IS NULL AND t.status<>'Completed' ORDER BY t.due_date NULLS LAST,t.updated_at DESC LIMIT 40")
        : {rows:[]}

    const research=management
      ? await query("SELECT p.id,p.title,p.status,p.end_date due_date,p.updated_at,'Research Project' type FROM research_projects p WHERE p.status NOT IN('Completed','Archived') ORDER BY p.end_date NULLS LAST,p.updated_at DESC LIMIT 20")
      : {rows:[]}

    const milestones=management
      ? await query("SELECT m.id,m.project_id,m.title,m.status,m.due_date,m.updated_at,p.title context_title,'Research Milestone' type FROM research_milestones m JOIN research_projects p ON p.id=m.project_id WHERE m.status<>'Completed' ORDER BY m.due_date NULLS LAST LIMIT 20")
      : {rows:[]}

    // Review assignment is contextual rather than a permanent organisational role.
    // Any user may therefore have a personal review queue when explicitly assigned.
    const reviews=await query(`
      SELECT * FROM (
        SELECT
          gd.id,
          gd.title,
          gd.status,
          gd.review_due_date due_date,
          gd.updated_at,
          gd.context review_context,
          gd.context_id,
          COALESCE(a.title,p.title,gd.context) context_title,
          COALESCE(submitter.name,creator.name) owner_name,
          'Review' type
        FROM generated_documents gd
        LEFT JOIN assignments a ON gd.context='Assignment' AND a.id=gd.context_id
        LEFT JOIN research_projects p ON gd.context='Research' AND p.id=gd.context_id
        LEFT JOIN users submitter ON submitter.id=gd.submitted_by
        LEFT JOIN users creator ON creator.id=gd.created_by
        WHERE gd.reviewer_id=$1 AND gd.status IN('Submitted','Under Review','Revised')

        UNION ALL

        SELECT
          t.id,
          t.title,
          t.contribution_status status,
          t.due_date,
          t.updated_at,
          'Assignment Task' review_context,
          t.assignment_id context_id,
          a.title context_title,
          owner.name owner_name,
          'Review' type
        FROM assignment_tasks t
        JOIN assignments a ON a.id=t.assignment_id
        LEFT JOIN users owner ON owner.id=t.owner_id
        WHERE t.reviewer_id=$1
          AND t.archived_at IS NULL
          AND t.contribution_status='Ready for Integration'

        UNION ALL

        SELECT
          k.id,
          k.title,
          k.status,
          NULL::date due_date,
          k.updated_at,
          'Knowledge' review_context,
          k.id context_id,
          'Document Repository' context_title,
          creator.name owner_name,
          'Review' type
        FROM knowledge_items k
        JOIN users creator ON creator.id=k.created_by
        WHERE k.reviewer_id=$1 AND k.status='Pending Approval'
      ) assigned_reviews
      ORDER BY due_date NULLS LAST,updated_at DESC
      LIMIT 30
    `,[req.user.id])

    const [notifications,activity,team,repository]=await Promise.all([
      query('SELECT id,title,body,entity_type,entity_id,created_at FROM notifications WHERE user_id=$1 AND read_at IS NULL ORDER BY created_at DESC LIMIT 20',[req.user.id]),
      query('SELECT id,title,body,entity_type,entity_id,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10',[req.user.id]),
      management?query("SELECT role,COUNT(*)::int count FROM users WHERE active=TRUE GROUP BY role ORDER BY role"):Promise.resolve({rows:[]}),
      management?query("SELECT status,COUNT(*)::int count FROM knowledge_items WHERE status IN('Pending Approval','Published') GROUP BY status"):Promise.resolve({rows:[]})
    ])

    const today=new Date();today.setHours(0,0,0,0)
    const sourceRows=management
      ? [...assignments.rows,...tasks.rows,...research.rows,...milestones.rows,...reviews.rows]
      : researcher
        ? [...tasks.rows,...reviews.rows]
        : reviewerOnly
          ? [...reviews.rows]
          : [...reviews.rows]

    const normalized=sourceRows.map(item=>{
      const reviewDestination=item.review_context==='Assignment'||item.review_context==='Assignment Task'
        ? 'Assignments'
        : item.review_context==='Research'
          ? 'Research Repository'
          : 'Documents'
      return {
        id:item.id,
        type:item.type,
        title:item.title,
        status:item.status,
        dueDate:item.due_date?(()=>{const date=new Date(item.due_date);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`})():null,
        nextAction:item.type==='Review'?(item.status==='Integrated'?'Generate final report':'Review'):item.type==='Task'?'Continue task':item.type==='Research Project'||item.type==='Research Milestone'?'Open research':'Open assignment',
        destination:item.type==='Review'?reviewDestination:item.type==='Research Project'||item.type==='Research Milestone'?'Research Repository':'Assignments',
        contextId:item.type==='Review'?(item.context_id||item.id):(item.assignment_id||item.project_id||item.id),
        contextTitle:item.context_title||null,
        ownerName:item.owner_name||null,
        updatedAt:item.updated_at
      }
    })

    const unique=[...new Map(normalized.map(item=>[`${item.type}:${item.id}`,item])).values()]

    // Personal review assignments must never be crowded out by organisation-wide
    // management records. Reviews are actionable work assigned to the signed-in
    // user, so surface them first and then fill the remaining dashboard slots with
    // the most urgent non-review work.
    const reviewWork=unique
      .filter(item=>item.type==='Review')
      .sort((a,b)=>{
        const ad=a.dueDate?new Date(`${a.dueDate}T00:00:00`).getTime():Number.POSITIVE_INFINITY
        const bd=b.dueDate?new Date(`${b.dueDate}T00:00:00`).getTime():Number.POSITIVE_INFINITY
        return ad-bd||new Date(b.updatedAt||0).getTime()-new Date(a.updatedAt||0).getTime()
      })
    const otherWork=unique
      .filter(item=>item.type!=='Review')
      .sort((a,b)=>{
        const ad=a.dueDate?new Date(`${a.dueDate}T00:00:00`).getTime():Number.POSITIVE_INFINITY
        const bd=b.dueDate?new Date(`${b.dueDate}T00:00:00`).getTime():Number.POSITIVE_INFINITY
        return ad-bd||new Date(b.updatedAt||0).getTime()-new Date(a.updatedAt||0).getTime()
      })
    const dashboardWork=[...reviewWork,...otherWork]

    const deadlines=unique.filter(item=>item.dueDate).map(item=>{const date=new Date(`${item.dueDate}T00:00:00`);const days=Math.round((date.getTime()-today.getTime())/86400000);return {...item,days,group:days<0?'Overdue':days===0?'Today':days===1?'Tomorrow':days<=7?'This Week':'Later'}}).sort((a,b)=>a.days-b.days)

    const overdueSource=researcher?tasks.rows:reviewerOnly?reviews.rows:assignments.rows
    const overdue=overdueSource.filter(item=>item.status!=='Completed'&&item.due_date&&new Date(item.due_date)<today).length
    const almostDue=deadlines.filter(item=>item.days>=0&&item.days<=7).length
    const assignmentAttention=researcher
      ? tasks.rows.filter(item=>item.status==='Ready for Review').length
      : management
        ? assignments.rows.filter(item=>item.status==='Ready for Review').length
        : 0

    const quickActions=researcher
      ? [
          {label:'My Tasks',destination:'Assignments'},
          {label:'My Research',destination:'Research Repository'},
          {label:'My Evidence',destination:'Document Repository'},
          {label:'Notifications',destination:'Notifications'}
        ]
      : reviewerOnly
        ? [
            {label:'My Reviews',destination:'Documents'},
            {label:'Review Deadlines',destination:'Calendar'},
            {label:'Notifications',destination:'Notifications'}
          ]
        : [
            {label:'New Assignment',destination:'Assignments'},
            {label:'New Research',destination:'Research Repository'},
            {label:'Upload to Repository',destination:'Document Repository'},
            {label:'Review Queue',destination:'Documents'}
          ]

    res.json({
      generatedAt:new Date().toISOString(),role:req.user.role,
      attention:{assignments:assignmentAttention,reviews:reviews.rows.length,overdue,notifications:notifications.rows.length,almostDue},
      myWork:dashboardWork.slice(0,20),deadlines:deadlines.slice(0,20),recentActivity:activity.rows,quickActions,
      management:management?{
        team:{total:team.rows.reduce((sum,row)=>sum+row.count,0),roles:Object.fromEntries(team.rows.map(row=>[row.role,row.count]))},
        assignments:{active:assignments.rows.length,overdue},
        research:{active:research.rows.length},
        repository:{awaitingPublication:Number(repository.rows.find(row=>row.status==='Pending Approval')?.count||0),published:Number(repository.rows.find(row=>row.status==='Published')?.count||0)}
      }:null
    })
  }catch(error){next(error)}
})

app.get('/api/notifications',authenticate,async(req,res,next)=>{
  try{
    await transaction(async client=>{
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT am.user_id,'Assigned task','You are assigned to “'||a.title||'” ('||a.status||')'||CASE WHEN a.due_date IS NOT NULL THEN ', due '||TO_CHAR(a.due_date,'DD Mon YYYY') ELSE '' END||'.','assignment',a.id FROM assignments a JOIN assignment_members am ON am.assignment_id=a.id WHERE am.user_id=$1 AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=am.user_id AND n.entity_id=a.id::text AND n.title IN('Assigned task','New assignment','Assignment allocated'))",[req.user.id])
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT am.user_id,'Assignment status update','“'||a.title||'” is now '||a.status||'.','assignment_status',a.id FROM assignments a JOIN assignment_members am ON am.assignment_id=a.id WHERE am.user_id=$1 AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=am.user_id AND n.entity_id=a.id::text AND n.title='Assignment status update' AND n.body='“'||a.title||'” is now '||a.status||'.')",[req.user.id])
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT am.user_id,'Assignment completed','“'||a.title||'” has been completed and retained in your activity history.','assignment_completed',a.id FROM assignments a JOIN assignment_members am ON am.assignment_id=a.id WHERE am.user_id=$1 AND a.status='Completed' AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=am.user_id AND n.entity_id=a.id::text AND n.title='Assignment completed')",[req.user.id])
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT am.user_id,'Assignment due soon','“'||a.title||'” is due on '||TO_CHAR(a.due_date,'DD Mon YYYY')||'. Please review and update its progress.','assignment_due',a.id FROM assignments a JOIN assignment_members am ON am.assignment_id=a.id WHERE am.user_id=$1 AND a.status NOT IN('Completed','Overdue') AND a.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+2 AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=am.user_id AND n.entity_id=a.id::text AND n.title='Assignment due soon' AND n.body LIKE '%'||TO_CHAR(a.due_date,'DD Mon YYYY')||'%')",[req.user.id])
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT am.user_id,'Assignment overdue','“'||a.title||'” was due on '||TO_CHAR(a.due_date,'DD Mon YYYY')||'. Immediate action is required.','assignment_overdue',a.id FROM assignments a JOIN assignment_members am ON am.assignment_id=a.id WHERE am.user_id=$1 AND a.status!='Completed' AND a.due_date<CURRENT_DATE AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=am.user_id AND n.entity_id=a.id::text AND n.title='Assignment overdue' AND n.body LIKE '%'||TO_CHAR(a.due_date,'DD Mon YYYY')||'%')",[req.user.id])
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT $1,'Previously approved notice','“'||a.title||'” was approved and published on the Notice Board.','notice',a.id FROM alerts a WHERE a.status='Published' AND(a.audience_role IS NULL OR a.audience_role=$2) AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=$1 AND n.entity_type='notice' AND n.entity_id=a.id::text)",[req.user.id,req.user.role])
    })
    res.json((await query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[req.user.id])).rows)
  }catch(error){next(error)}
})
app.patch('/api/notifications/:id/read',authenticate,async(req,res,next)=>{try{const row=(await query('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=$1 AND user_id=$2 RETURNING *',[req.params.id,req.user.id])).rows[0];if(!row)return res.status(404).json({error:'Notification not found.'});res.json(row)}catch(error){next(error)}})
app.patch('/api/notifications/read-all',authenticate,async(req,res,next)=>{try{const result=await query('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=$1 AND read_at IS NULL',[req.user.id]);res.json({updated:result.rowCount})}catch(error){next(error)}})
app.delete('/api/notifications/read',authenticate,async(req,res,next)=>{try{const result=await query('DELETE FROM notifications WHERE user_id=$1 AND read_at IS NOT NULL',[req.user.id]);res.json({deleted:result.rowCount})}catch(error){next(error)}})
app.get('/api/document-deletion-requests',authenticate,async(req,res,next)=>{try{const management=canManageKnowledge(req.user);res.json((await query(`SELECT dr.*,requester.name requested_by_name,reviewer.name reviewed_by_name FROM document_deletion_requests dr JOIN users requester ON requester.id=dr.requested_by LEFT JOIN users reviewer ON reviewer.id=dr.reviewed_by WHERE $1 OR dr.requested_by=$2 ORDER BY CASE dr.status WHEN 'Pending' THEN 0 ELSE 1 END,dr.created_at DESC`,[management,req.user.id])).rows)}catch(error){next(error)}})

app.post('/api/documents/:id/deletion-requests',authenticate,validate(z.object({reason:z.string().min(5).max(2000)})),async(req,res,next)=>{try{if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot request deletion of this document.'});const created=await transaction(async client=>{const item=(await client.query('SELECT id,title,status FROM knowledge_items WHERE id=$1',[req.params.id])).rows[0];if(!item)return null;const row=(await client.query('INSERT INTO document_deletion_requests(knowledge_id,knowledge_title,requested_by,reason)VALUES($1,$2,$3,$4)RETURNING *',[item.id,item.title,req.user.id,req.validated.reason.trim()])).rows[0];await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)SELECT id,'Document deletion approval required',$1,'document_deletion_request',$2 FROM users WHERE active=TRUE AND role IN('Administrator','Research Manager') AND id<>$3",[`Deletion has been requested for “${item.title}”: ${req.validated.reason.trim()}`,row.id,req.user.id]);await audit(client,req.user.id,'DOCUMENT_DELETION_REQUESTED','knowledge',item.id,{requestId:row.id,title:item.title,reason:req.validated.reason.trim()});return row});if(!created)return res.status(404).json({error:'Document not found.'});res.status(201).json(created)}catch(error){if(error.code==='23505')return res.status(409).json({error:'A deletion request is already awaiting a manager decision for this document.'});next(error)}})

app.post('/api/document-deletion-requests/:id/decision',authenticate,authorize('Administrator','Research Manager'),validate(z.object({approved:z.boolean(),comments:z.string().max(2000).default('')})),async(req,res,next)=>{try{const result=await transaction(async client=>{const request=(await client.query('SELECT dr.*,k.id document_id,k.title document_title FROM document_deletion_requests dr LEFT JOIN knowledge_items k ON k.id=dr.knowledge_id WHERE dr.id=$1 FOR UPDATE OF dr',[req.params.id])).rows[0];if(!request)return {kind:'missing'};if(request.status!=='Pending')return {kind:'conflict'};if(!req.validated.approved){const row=(await client.query("UPDATE document_deletion_requests SET status='Rejected',reviewed_by=$1,review_comments=$2,reviewed_at=NOW()WHERE id=$3 RETURNING *",[req.user.id,req.validated.comments.trim(),request.id])).rows[0];await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Document deletion rejected',$2,'document_deletion_request',$3)",[request.requested_by,`Your request to delete “${request.knowledge_title}” was rejected${req.validated.comments.trim()?`: ${req.validated.comments.trim()}`:'.'}`,request.id]);await audit(client,req.user.id,'DOCUMENT_DELETION_REJECTED','knowledge',request.knowledge_id,{requestId:request.id,comments:req.validated.comments});return {kind:'rejected',row,files:[]}}
      if(!request.document_id)return {kind:'missing-document'};const files=(await client.query('SELECT stored_name FROM knowledge_versions WHERE knowledge_id=$1',[request.document_id])).rows;await client.query("UPDATE document_deletion_requests SET status='Approved',reviewed_by=$1,review_comments=$2,reviewed_at=NOW()WHERE id=$3",[req.user.id,req.validated.comments.trim(),request.id]);await audit(client,req.user.id,'DOCUMENT_DELETION_APPROVED','knowledge',request.document_id,{requestId:request.id,title:request.knowledge_title,versions:files.length,comments:req.validated.comments});await client.query('DELETE FROM knowledge_items WHERE id=$1',[request.document_id]);await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Document deletion approved',$2,'document_deletion_request',$3)",[request.requested_by,`“${request.knowledge_title}” and all stored versions were deleted after manager approval.`,request.id]);return {kind:'approved',row:{...request,status:'Approved'},files}});if(result.kind==='missing')return res.status(404).json({error:'Deletion request not found.'});if(result.kind==='conflict')return res.status(409).json({error:'This deletion request has already been decided.'});if(result.kind==='missing-document')return res.status(409).json({error:'The document is already unavailable.'});if(result.kind==='approved')await Promise.all(result.files.map(file=>fs.unlink(path.resolve(config.uploadDir,file.stored_name)).catch(()=>{})));res.json(result.row)}catch(error){next(error)}})

app.get('/api/repository/origins',authenticate,async(req,res,next)=>{try{const management=['Administrator','Research Manager'].includes(req.user.role);const rows=(await query(`SELECT id,title,type FROM(
SELECT a.id,a.title,'Assignment' type FROM assignments a WHERE $2 OR a.created_by=$1 OR EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=a.id AND am.user_id=$1)
UNION ALL SELECT t.id,t.title,'Task' type FROM assignment_tasks t WHERE t.archived_at IS NULL AND($2 OR t.owner_id=$1 OR EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=t.assignment_id AND am.user_id=$1))
UNION ALL SELECT p.id,p.title,'Research' type FROM research_projects p WHERE $2 OR p.lead_id=$1 OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=p.id AND rc.user_id=$1)
UNION ALL SELECT gd.id,gd.title,'App2 Report' type FROM generated_documents gd WHERE $2 OR gd.created_by=$1 OR gd.reviewer_id=$1
)origins ORDER BY type,title`,[req.user.id,management])).rows;res.json(rows)}catch(error){next(error)}})

app.get('/api/documents',authenticate,async(req,res,next)=>{try{res.json((await query(`SELECT k.*,u.name created_by_name,reviewer.name reviewer_name,approver.name approved_by_name,l.locked_at,l.expires_at,lu.name locked_by_name,fj.status felix_index_status,fj.attempts felix_index_attempts,fj.last_error felix_index_error,fj.updated_at felix_index_updated_at,
COALESCE((SELECT json_agg(json_build_object('type',rel.entity_type,'id',rel.entity_id,'title',CASE rel.entity_type WHEN 'assignment' THEN(SELECT title FROM assignments WHERE id=rel.entity_id)WHEN 'task' THEN(SELECT title FROM assignment_tasks WHERE id=rel.entity_id)WHEN 'research' THEN(SELECT title FROM research_projects WHERE id=rel.entity_id)WHEN 'report' THEN(SELECT title FROM generated_documents WHERE id=rel.entity_id)END))FROM repository_entity_links rel WHERE rel.knowledge_id=k.id),'[]') origin_links,
COALESCE((SELECT json_agg(DISTINCT person.name)FROM repository_entity_links rel JOIN LATERAL(SELECT usr.name FROM users usr WHERE(rel.entity_type='assignment' AND EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=rel.entity_id AND am.user_id=usr.id))OR(rel.entity_type='task' AND EXISTS(SELECT 1 FROM assignment_tasks task WHERE task.id=rel.entity_id AND task.owner_id=usr.id))OR(rel.entity_type='research' AND(EXISTS(SELECT 1 FROM research_projects rp WHERE rp.id=rel.entity_id AND rp.lead_id=usr.id)OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=rel.entity_id AND rc.user_id=usr.id)))OR(rel.entity_type='report' AND EXISTS(SELECT 1 FROM generated_documents gd WHERE gd.id=rel.entity_id AND gd.created_by=usr.id)))person ON TRUE WHERE rel.knowledge_id=k.id),'[]') worked_by
FROM knowledge_items k JOIN users u ON u.id=k.created_by LEFT JOIN users reviewer ON reviewer.id=k.reviewer_id LEFT JOIN users approver ON approver.id=k.approved_by LEFT JOIN document_locks l ON l.knowledge_id=k.id AND l.expires_at>NOW() LEFT JOIN users lu ON lu.id=l.locked_by LEFT JOIN LATERAL(SELECT status,attempts,last_error,updated_at FROM felix_document_index_jobs WHERE knowledge_id=k.id AND version_number=k.current_version ORDER BY id DESC LIMIT 1)fj ON TRUE WHERE k.status='Published' OR k.created_by=$1 OR $2 ORDER BY k.updated_at DESC`,[req.user.id,['Administrator','Research Manager','Reviewer'].includes(req.user.role)])).rows)}catch(error){next(error)}})
app.get('/api/document-categories',authenticate,async(_req,res,next)=>{try{res.json((await query('SELECT id,name,description,parent_id,is_active FROM document_categories WHERE is_active=TRUE ORDER BY name')).rows)}catch(error){next(error)}})
app.post('/api/document-categories',authenticate,authorize('Administrator','Research Manager'),validate(z.object({name:z.string().trim().min(2).max(120),description:z.string().max(2000).default(''),parentId:z.string().uuid().nullable().default(null)})),async(req,res,next)=>{try{const row=(await query('INSERT INTO document_categories(name,description,parent_id)VALUES($1,$2,$3)RETURNING *',[req.validated.name,req.validated.description,req.validated.parentId])).rows[0];res.status(201).json(row)}catch(error){if(error.code==='23505')return res.status(409).json({error:'That category already exists.'});next(error)}})
app.get('/api/document-tags',authenticate,async(_req,res,next)=>{try{res.json((await query('SELECT id,name FROM document_tags ORDER BY normalized_name')).rows)}catch(error){next(error)}})
app.post('/api/document-tags',authenticate,validate(z.object({name:z.string().trim().min(1).max(60)})),async(req,res,next)=>{try{res.status(201).json((await query('INSERT INTO document_tags(name,normalized_name,created_by)VALUES($1,lower($1),$2)ON CONFLICT(normalized_name)DO UPDATE SET name=EXCLUDED.name RETURNING id,name',[req.validated.name,req.user.id])).rows[0])}catch(error){next(error)}})
app.get('/api/documents/:id',authenticate,async(req,res,next)=>{try{if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot view this document.'});const document=(await query(`SELECT k.*,c.name category_name,creator.name created_by_name,reviewer.name reviewed_by_name,approver.name approved_by_name,
 COALESCE((SELECT json_agg(json_build_object('id',t.id,'name',t.name)ORDER BY t.name)FROM document_tag_links l JOIN document_tags t ON t.id=l.tag_id WHERE l.knowledge_id=k.id),'[]') normalized_tags,
 COALESCE((SELECT json_agg(json_build_object('id',v.id,'version_number',v.version_number,'original_filename',v.original_name,'mime_type',v.mime_type,'file_size',v.size_bytes,'sha256_hash',v.sha256_hash,'is_current',v.is_current,'approved_at',v.approved_at,'uploaded_at',v.created_at,'change_notes',v.notes,'uploaded_by',u.name)ORDER BY v.version_number DESC)FROM knowledge_versions v JOIN users u ON u.id=v.uploader_id WHERE v.knowledge_id=k.id),'[]') versions
 FROM knowledge_items k LEFT JOIN document_categories c ON c.id=k.category_id JOIN users creator ON creator.id=k.created_by LEFT JOIN users reviewer ON reviewer.id=k.reviewed_by LEFT JOIN users approver ON approver.id=k.approved_by WHERE k.id=$1`,[req.params.id])).rows[0];if(!document)return res.status(404).json({error:'Document not found.'});res.json(document)}catch(error){next(error)}})
const readerHeaders=res=>res.set({'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'self'; sandbox allow-same-origin",'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'})
const loadReaderVersion=async(documentId,versionId=null)=>(await query(`SELECT v.*,k.title,k.description,k.category,k.directorate,k.author,k.document_date,k.current_version,k.status,k.classification,k.tags,k.created_at document_created_at,u.name uploaded_by
  FROM knowledge_versions v JOIN knowledge_items k ON k.id=v.knowledge_id JOIN users u ON u.id=v.uploader_id
  WHERE k.id=$1 AND($2::uuid IS NULL AND v.is_current=TRUE OR v.id=$2::uuid)`,[documentId,versionId])).rows[0]
const serveDocumentReader=async(req,res,next)=>{try{
  if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot read this document.'})
  const version=await loadReaderVersion(req.params.id,req.params.versionId||null)
  if(!version)return res.status(404).json({error:'Document version not found.'})
  const rendered=await renderReadableVersion(version)
  const metadata={documentId:req.params.id,versionId:version.id,title:version.title,description:version.description,category:version.category,directorate:version.directorate,author:version.author,documentDate:version.document_date,version:version.version_number,isCurrent:version.is_current,status:version.status,classification:version.classification,tags:version.tags,uploadedBy:version.uploaded_by,uploadedAt:version.created_at,canDownload:await canDownloadKnowledge(req.user,req.params.id)}
  readerHeaders(res)
  if(rendered.format!=='pdf')return res.json({...rendered,metadata})
  const stat=await fs.stat(rendered.filePath)
  const range=req.headers.range
  res.set({'Content-Type':'application/pdf','Accept-Ranges':'bytes','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(version.original_name)}`})
  if(range){const match=/bytes=(\d*)-(\d*)/.exec(String(range));if(!match)return res.status(416).set('Content-Range',`bytes */${stat.size}`).end();const start=match[1]?Number(match[1]):0;const end=match[2]?Math.min(Number(match[2]),stat.size-1):stat.size-1;if(start>end||start>=stat.size)return res.status(416).set('Content-Range',`bytes */${stat.size}`).end();res.status(206).set({'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':String(end-start+1)});return createReadStream(rendered.filePath,{start,end}).pipe(res)}
  res.set('Content-Length',String(stat.size));createReadStream(rendered.filePath).pipe(res)
}catch(error){if(error.code==='ENOENT')return res.status(404).json({error:'The stored document file is missing.'});next(error)}}
app.get('/api/documents/:id/reader',authenticate,serveDocumentReader)
app.get('/api/documents/:id/versions/:versionId/reader',authenticate,serveDocumentReader)
app.get('/api/documents/:id/preview',authenticate,async(req,res,next)=>{try{if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot preview this document.'});const version=(await query('SELECT v.* FROM knowledge_versions v JOIN knowledge_items k ON k.id=v.knowledge_id WHERE k.id=$1 AND v.is_current=TRUE',[req.params.id])).rows[0];if(!version)return res.status(404).json({error:'Current document version not found.'});const file=resolveDocumentPath(version.storage_path||version.stored_name);if(['text/plain','text/markdown'].includes(version.mime_type)){const content=await fs.readFile(file,'utf8');return res.type('text/plain').send(content.slice(0,2_000_000))}if(version.mime_type==='application/pdf'){res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(version.original_name)}`);return res.type('application/pdf').sendFile(file)}const extracted=(await query('SELECT extracted_text,extraction_status FROM document_text_content WHERE version_id=$1',[version.id])).rows[0];res.json({type:'extracted-text',content:extracted?.extracted_text||'',status:extracted?.extraction_status||'Pending',filename:version.original_name})}catch(error){next(error)}})
app.get('/api/documents/:id/download',authenticate,async(req,res,next)=>{try{const version=(await query('SELECT id,original_name FROM knowledge_versions WHERE knowledge_id=$1 AND is_current=TRUE',[req.params.id])).rows[0];if(!version)return res.status(404).json({error:'Current document version not found.'});req.params.versionId=version.id;res.redirect(307,`/api/knowledge/versions/${version.id}/download`)}catch(error){next(error)}})
const documentWorkflow=(status,action)=>async(req,res,next)=>{try{const item=(await query('SELECT * FROM knowledge_items WHERE id=$1',[req.params.id])).rows[0];if(!item)return res.status(404).json({error:'Document not found.'});if(await activeExternalResearchForKnowledge(req.params.id))return res.status(409).json({error:'This document is controlled by the Imported Research reader until that review path is completed.'});const manager=canReviewKnowledge(req.user);if(['Published','Rejected','Archived'].includes(status)&&!manager)return res.status(403).json({error:'A reviewer or manager must perform this action.'});if(status==='Pending Approval'&&!canManageKnowledge(req.user)&&item.created_by!==req.user.id)return res.status(403).json({error:'You cannot submit this document.'});const reason=String(req.body?.reason||'').slice(0,1000);const row=await transaction(async client=>{const updated=(await client.query("UPDATE knowledge_items SET status=$1,is_archived=($1='Archived'),rejection_reason=CASE WHEN $1='Rejected' THEN $2 ELSE NULL END,reviewed_by=CASE WHEN $1 IN('Published','Rejected') THEN $3 ELSE reviewed_by END,reviewed_at=CASE WHEN $1 IN('Published','Rejected') THEN NOW() ELSE reviewed_at END,approved_by=CASE WHEN $1='Published' THEN $3 ELSE NULL END,approved_at=CASE WHEN $1='Published' THEN NOW() ELSE NULL END,updated_at=NOW()WHERE id=$4 RETURNING *",[status,reason,req.user.id,item.id])).rows[0];if(status==='Published')await client.query('UPDATE knowledge_versions SET approved_by=$1,approved_at=NOW() WHERE knowledge_id=$2 AND is_current=TRUE',[req.user.id,item.id]);await audit(client,req.user.id,action,'knowledge',item.id,{reason});if(status==='Published'&&updated.felix_enabled)await enqueueFelixDocumentIndex(client,item.id,item.current_version,req.user.id);if(status==='Archived')await client.query("UPDATE felix_document_index_jobs SET status='Failed',last_error='Document archived',updated_at=NOW()WHERE knowledge_id=$1",[item.id]);return updated});res.json(row)}catch(error){next(error)}}
app.post('/api/documents/:id/submit',authenticate,documentWorkflow('Pending Approval','DOCUMENT_SUBMITTED'))
app.post('/api/documents/:id/approve',authenticate,documentWorkflow('Published','DOCUMENT_APPROVED'))
app.post('/api/documents/:id/reject',authenticate,documentWorkflow('Rejected','DOCUMENT_REJECTED'))
app.post('/api/documents/:id/archive',authenticate,documentWorkflow('Archived','DOCUMENT_ARCHIVED'))
app.post('/api/documents/:id/restore',authenticate,authorize('Administrator','Research Manager'),async(req,res,next)=>{try{const row=await transaction(async client=>{const updated=(await client.query("UPDATE knowledge_items SET status='Draft',is_archived=FALSE,approved_by=NULL,approved_at=NULL,updated_at=NOW()WHERE id=$1 RETURNING *",[req.params.id])).rows[0];if(updated)await audit(client,req.user.id,'DOCUMENT_RESTORED','knowledge',req.params.id,{});return updated});if(!row)return res.status(404).json({error:'Document not found.'});res.json(row)}catch(error){next(error)}})
app.post('/api/documents/:id/felix/:mode',authenticate,authorize('Administrator','Research Manager'),async(req,res,next)=>{try{if(!['enable','disable'].includes(req.params.mode))return res.status(404).json({error:'Unknown Felix action.'});const enabled=req.params.mode==='enable';const row=await transaction(async client=>{const updated=(await client.query('UPDATE knowledge_items SET felix_enabled=$1,updated_at=NOW()WHERE id=$2 RETURNING *',[enabled,req.params.id])).rows[0];if(!updated)return null;await audit(client,req.user.id,enabled?'DOCUMENT_FELIX_ENABLED':'DOCUMENT_FELIX_DISABLED','knowledge',updated.id,{});if(enabled&&updated.status==='Published'&&!updated.is_archived)await enqueueFelixDocumentIndex(client,updated.id,updated.current_version,req.user.id);if(!enabled)await client.query("UPDATE felix_document_index_jobs SET status='Failed',last_error='Felix disabled',updated_at=NOW()WHERE knowledge_id=$1",[updated.id]);return updated});if(!row)return res.status(404).json({error:'Document not found.'});res.json(row)}catch(error){next(error)}})
app.post('/api/documents/:id/ask-felix',authenticate,validate(z.object({message:z.string().trim().min(2).max(4000)})),async(req,res,next)=>{try{if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot ask Felix about this document.'});const document=(await query("SELECT k.id,k.title,k.current_version,v.id version_id,v.version_number FROM knowledge_items k JOIN knowledge_versions v ON v.knowledge_id=k.id AND v.is_current=TRUE WHERE k.id=$1 AND k.status='Published' AND k.felix_enabled=TRUE AND k.is_archived=FALSE",[req.params.id])).rows[0];if(!document)return res.status(409).json({error:'Felix can only answer from the current approved, Felix-enabled version.'});const response=await fetch(`${config.aiResearchUrl}/api/felix/chat`,{method:'POST',headers:{Authorization:req.headers.authorization,'Content-Type':'application/json'},body:JSON.stringify({message:req.validated.message,document_id:document.id,retrieval_mode:'document',mode:'Research'}) ,signal:AbortSignal.timeout(120000)});const payload=await response.json().catch(()=>({error:'Felix returned an invalid response.'}));if(!response.ok)return res.status(response.status).json(payload);res.json({...payload,document:{id:document.id,title:document.title,version:document.version_number,version_id:document.version_id}})}catch(error){next(error)}})
app.post('/api/documents/:id/felix-assessment',authenticate,validate(z.object({mode:z.enum(['audit','clarification','research','critical','management','implementation','risk','executive','follow_up']).default('audit')})),async(req,res,next)=>{try{if(!await canReadKnowledge(req.user,req.params.id))return res.status(404).json({error:'The approved document is not available.'});const document=(await query("SELECT id FROM knowledge_items WHERE id=$1 AND status='Published' AND felix_enabled=TRUE AND is_archived=FALSE",[req.params.id])).rows[0];if(!document)return res.status(409).json({error:'Felix can only assess the current approved, indexed version.'});const response=await fetch(`${config.aiResearchUrl}/api/felix/documents/${document.id}/assessment`,{method:'POST',headers:{Authorization:req.headers.authorization,'Content-Type':'application/json'},body:JSON.stringify(req.validated),signal:AbortSignal.timeout(30000)});const payload=await response.json().catch(()=>({error:'Felix returned an invalid assessment.'}));if(!response.ok)return res.status(response.status).json(payload);res.json(payload)}catch(error){next(error)}})
app.post('/api/documents/:id/checkout',authenticate,async(req,res,next)=>{try{const row=(await query(`INSERT INTO document_locks(knowledge_id,locked_by)VALUES($1,$2)ON CONFLICT(knowledge_id)DO UPDATE SET locked_by=EXCLUDED.locked_by,locked_at=NOW(),expires_at=NOW()+INTERVAL '2 hours' WHERE document_locks.expires_at<NOW() OR document_locks.locked_by=$2 RETURNING *`,[req.params.id,req.user.id])).rows[0];if(!row)return res.status(409).json({error:'This document is checked out by another user.'});res.json(row)}catch(error){next(error)}})
app.post('/api/documents/:id/checkin',authenticate,async(req,res,next)=>{try{const result=await query('DELETE FROM document_locks WHERE knowledge_id=$1 AND(locked_by=$2 OR $3)RETURNING *',[req.params.id,req.user.id,['Administrator','Research Manager'].includes(req.user.role)]);if(!result.rowCount)return res.status(403).json({error:'You do not hold this document lock.'});res.status(204).end()}catch(error){next(error)}})
app.patch('/api/documents/:id/retention',authenticate,authorize('Administrator','Research Manager'),validate(z.object({retentionUntil:z.string().nullable(),archive:z.boolean().default(false)})),async(req,res,next)=>{try{res.json((await query("UPDATE knowledge_items SET retention_until=$1,status=CASE WHEN $2 THEN 'Archived' ELSE status END,updated_at=NOW() WHERE id=$3 RETURNING *",[req.validated.retentionUntil,req.validated.archive,req.params.id])).rows[0])}catch(error){next(error)}})
app.get('/api/settings/email-status',authenticate,authorize('Administrator'),(_req,res)=>res.json(mailStatus()))
app.post('/api/settings/test-email',authenticate,authorize('Administrator'),validate(testEmailSchema),async(req,res,next)=>{try{const result=await sendMail({to:req.validated.email,subject:'PSC App2 email delivery test',text:`This test confirms that PSC App2 can deliver email notifications to ${req.validated.email}.`});await query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)VALUES($1,'TEST_EMAIL_SENT','settings','email',$2)",[req.user.id,JSON.stringify({recipient:req.validated.email,messageId:result.messageId})]);res.json({message:`Test email sent successfully to ${req.validated.email}.`,...result})}catch(error){next(error)}})
const systemSettingsSchema=z.object({organizationName:z.string().min(3).max(200),departmentName:z.string().min(3).max(200),supportEmail:z.string().email().max(255),sessionMinutes:z.number().int().min(15).max(1440),maxUploadMb:z.number().int().min(1).max(500),defaultRetentionDays:z.number().int().min(30).max(7300),documentCategories:z.array(z.string().min(2).max(100)).min(1).max(30),maintenanceMode:z.boolean(),emailNotifications:z.boolean()})
const preferenceSchema=z.object({emailNotifications:z.boolean(),inAppNotifications:z.boolean(),compactLayout:z.boolean(),themeMode:z.enum(['Dark','Light','System','Gold Grey','Navy Blue']),accentColor:z.enum(['Gold','Blue','Green'])})
app.get('/api/settings',authenticate,async(req,res,next)=>{try{const [system,preferences,health]=await Promise.all([query('SELECT organization_name,department_name,support_email,session_minutes,max_upload_mb,default_retention_days,document_categories,maintenance_mode,email_notifications,updated_at FROM system_settings WHERE id=1'),query('SELECT email_notifications,in_app_notifications,compact_layout,theme_mode,accent_color,updated_at FROM user_preferences WHERE user_id=$1',[req.user.id]),query('SELECT NOW() database_time')]);res.json({system:system.rows[0],preferences:preferences.rows[0]||{email_notifications:true,in_app_notifications:true,compact_layout:false,theme_mode:'Gold Grey',accent_color:'Gold'},health:{api:'healthy',database:'connected',environment:config.environment,database_time:health.rows[0].database_time,configured_upload_limit_mb:config.maxUploadMb,configured_session:config.jwtExpiresIn}})}catch(error){next(error)}})
app.get('/api/settings/updates',authenticate,async(_req,res,next)=>{try{const database=await query('SELECT current_database() database,VERSION() version,NOW() checked_at');res.json({application:'PSC App2',applicationVersion:'0.1.0',apiVersion:'0.1.0',runtime:process.version,database:database.rows[0].database,databaseVersion:String(database.rows[0].version).split(' on ')[0],status:'Installed services healthy',updateChannel:'Manual / GitHub',automaticUpdates:false,checkedAt:database.rows[0].checked_at})}catch(error){next(error)}})
app.patch('/api/settings/system',authenticate,authorize('Administrator'),validate(systemSettingsSchema),async(req,res,next)=>{try{const v=req.validated;const updated=await transaction(async client=>{const row=(await client.query('UPDATE system_settings SET organization_name=$1,department_name=$2,support_email=$3,session_minutes=$4,max_upload_mb=$5,default_retention_days=$6,document_categories=$7,maintenance_mode=$8,email_notifications=$9,updated_by=$10,updated_at=NOW() WHERE id=1 RETURNING *',[v.organizationName,v.departmentName,v.supportEmail,v.sessionMinutes,v.maxUploadMb,v.defaultRetentionDays,[...new Set(v.documentCategories.map(value=>value.trim()))],v.maintenanceMode,v.emailNotifications,req.user.id])).rows[0];await audit(client,req.user.id,'SYSTEM_SETTINGS_UPDATED','settings','1',{maintenanceMode:v.maintenanceMode,sessionMinutes:v.sessionMinutes,maxUploadMb:v.maxUploadMb});return row});res.json(updated)}catch(error){next(error)}})
app.patch('/api/settings/preferences',authenticate,validate(preferenceSchema),async(req,res,next)=>{try{const v=req.validated;const row=(await query('INSERT INTO user_preferences(user_id,email_notifications,in_app_notifications,compact_layout,theme_mode,accent_color)VALUES($1,$2,$3,$4,$5,$6)ON CONFLICT(user_id)DO UPDATE SET email_notifications=$2,in_app_notifications=$3,compact_layout=$4,theme_mode=$5,accent_color=$6,updated_at=NOW()RETURNING *',[req.user.id,v.emailNotifications,v.inAppNotifications,v.compactLayout,v.themeMode,v.accentColor])).rows[0];res.json(row)}catch(error){next(error)}})

app.use((_req,res)=>res.status(404).json({error:'API endpoint not found.'}))
app.use((error,_req,res,_next)=>{console.error(error);const status=Number(error.statusCode||error.status)||500;res.status(status).json({error:status>=500&&config.environment==='production'?'The service could not complete your request.':error.message})})
export default app
