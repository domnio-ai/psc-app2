import {calendarForUser} from './calendar-service.js'
import {pulseForUser, visibleNotifications, syncTaskDeadlineNotifications} from './pulse-service.js'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import {createReadStream} from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import mammoth from 'mammoth'
import {readFile} from 'node:fs/promises'
import sanitizeHtml from 'sanitize-html'
import {AlignmentType,Document as WordDocument,HeadingLevel,ImageRun,Packer,Paragraph,TextRun} from 'docx'
import {z} from 'zod'
import {config} from './config.js'
import {authenticate,authorize,createToken,isManagementRole,roles} from './auth.js'
import {assignmentTaskScope,canManageAssignment,canManageKnowledge as canManageKnowledgeScope,canManageResearch,canManageUser,canOverseeUser,immediateOversightReviewers,immediateSupervisorForUser,isImmediateSupervisorOf,isOperationalOversightRole,isOrganisationScopeRole,isTeamScopeRole,managedUserIds,reportingOversightManagerIds,userApprovedLeaveConflict} from './scope.js'
import {audit} from './audit.js'
import {query,transaction} from './db.js'
import {mailStatus,sendMail} from './mailer.js'
import {createPasswordLinkService} from './password-link-service.js'
import {createAuthRateLimiter} from './auth-rate-limit.js'
import {createAdminEmailCooldown} from './admin-email-rate-limit.js'
import {deliverPendingInternalEmails,deliverPendingNotificationEmails,scheduleNotificationMaintenance,syncImportantNotificationReminders} from './notification-email-service.js'
import {enqueueFelixDocumentIndex} from './felix-index-worker.js'
import {deleteStoredDocument,resolveDocumentPath,storeDocument,validateDocumentUpload} from './document-storage.js'
import {renderReadableVersion} from './document-reader.js'
import {sanitizeTaskReportHtml,taskReportHtmlToDocxElements,taskReportHtmlToPlainText} from './task-report-formatting.js'
import {buildPscTaskFinalPdf} from './task-report-pdf.js'
import {buildReportReferencesSection,hasAuthoredReferencesSection} from './report-references.js'
import {registerReportRoutes} from './reports/report-routes.js'
import {buildResearchDraftArtifact,saveResearchDraftRepositoryVersion} from './research-draft-repository.js'
import {RESEARCH_PROJECT_STATUSES,researchCurrentSql,researchDueSoonSql,researchLifecycleStatusSql,researchOverdueSql,researchReadyToPublishSql} from './research-status.js'
import {buildAssignmentDraftSnapshot,buildTaskDraftSnapshot,buildTaskReportDraftSnapshot,buildGeneratedReportDraftSnapshot,savePrivateDraftRepositoryVersion,promotePrivateDraftToPublished,archivePrivateOperationalDrafts} from './private-draft-repository.js'
import {emitMessageEventToUser,emitMessageEventToUsers,isMessageUserOnline,messagePresenceSnapshot,registerMessageRealtimeClient,setMessagePresence} from './messages/realtime.js'
import {registerRichMessagingRoutes} from './messages/rich-messaging.js'
import {registerLeaveManagementRoutes} from './users/leave-management.js'

import {registerMeetingsRoutes} from './meetings/meetings-routes.js'

const escapeHtml=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')


const resolveAssignmentTaskReviewer=async(assignmentId,ownerId,requestedReviewerId=null)=>{
  if(!ownerId)throw Object.assign(new Error('Choose a task owner before creating or approving the task.'),{statusCode:400})

  if(requestedReviewerId){
    if(requestedReviewerId===ownerId)throw Object.assign(new Error('The task owner cannot review their own work.'),{statusCode:400})
    if(!await isEligibleAssignmentTaskReviewer(assignmentId,ownerId,requestedReviewerId)){
      throw Object.assign(new Error('Choose an eligible reviewer from the Assignment Lead or the owner\'s authorised oversight scope.'),{statusCode:400})
    }
    return {reviewerId:requestedReviewerId,source:'explicit'}
  }

  const lead=(await query(`SELECT u.id,u.name
    FROM assignment_members am
    JOIN users u ON u.id=am.user_id
    WHERE am.assignment_id=$1
      AND am.member_role='Lead'
      AND u.active=TRUE
    ORDER BY am.assigned_at ASC,am.user_id ASC
    LIMIT 1`,[assignmentId])).rows[0]

  if(lead?.id&&lead.id!==ownerId){
    if(await isEligibleAssignmentTaskReviewer(assignmentId,ownerId,lead.id)){
      return {reviewerId:lead.id,source:'assignment-lead'}
    }
  }

  const supervisor=await immediateSupervisorForUser(ownerId)
  if(supervisor?.id&&supervisor.id!==ownerId){
    if(await isEligibleAssignmentTaskReviewer(assignmentId,ownerId,supervisor.id)){
      return {reviewerId:supervisor.id,source:'immediate-supervisor'}
    }
  }

  throw Object.assign(new Error('APP2 could not resolve a safe reviewer automatically. Select an eligible reviewer before creating or approving this task.'),{statusCode:400})
}
const isAssignmentContextReviewer=async(assignmentId,userId)=>Boolean((await query(`SELECT 1 WHERE EXISTS(SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2 AND member_role='Reviewer') OR EXISTS(SELECT 1 FROM assignment_tasks WHERE assignment_id=$1 AND reviewer_id=$2)`,[assignmentId,userId])).rowCount)
const isResearchContextReviewer=async(projectId,userId)=>Boolean((await query('SELECT 1 FROM research_reviewers WHERE project_id=$1 AND reviewer_id=$2 AND active=TRUE',[projectId,userId])).rowCount)

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


const syncResearchMilestonesFromTasks=async(client,assignmentId,userId)=>{
  const milestones=(await client.query(`UPDATE research_milestones m
    SET status='In Progress',updated_at=NOW()
    WHERE m.status='Pending'
      AND EXISTS(
        SELECT 1
        FROM research_milestone_tasks mt
        JOIN assignment_tasks t ON t.id=mt.task_id
        WHERE mt.milestone_id=m.id
          AND t.assignment_id=$1
          AND t.archived_at IS NULL
          AND t.status IN('In Progress','Blocked','Completed')
      )
    RETURNING m.id,m.project_id,m.title,m.owner_id`,[assignmentId])).rows
  for(const milestone of milestones){
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[milestone.project_id,userId,'MILESTONE_STATUS_SYNCHRONIZED',JSON.stringify({milestoneId:milestone.id,status:'In Progress',source:'linked-task-progress'})])
    await audit(client,userId,'RESEARCH_MILESTONE_STATUS_SYNCHRONIZED','research_milestone',milestone.id,{projectId:milestone.project_id,status:'In Progress',source:'linked-task-progress'})
    if(milestone.owner_id&&milestone.owner_id!==userId)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Research milestone started',$2,'research',$3)",[milestone.owner_id,`Linked task activity has started milestone “${milestone.title}”.`,milestone.project_id])
  }
  return milestones.length
}

const passwordLinkService=createPasswordLinkService({transaction,sendMail,frontendOrigin:config.frontendOrigin})
const passwordResetRateLimit=createAuthRateLimiter({windowMs:15*60*1000,maxIpAttempts:60,maxIdentityAttempts:5})

const app=express()
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({origin(origin,callback){if(!origin||config.frontendOrigins.includes(origin))return callback(null,true);callback(new Error('This browser origin is not permitted to access APP2.'))},exposedHeaders:['Content-Disposition']}))
app.use('/api/assignments/:id/attachments',express.raw({type:'application/octet-stream',limit:`${config.maxUploadMb}mb`}))
app.use('/api/messages/conversations/:id/attachments',express.raw({type:'application/octet-stream',limit:`${config.maxUploadMb}mb`}))
app.use('/api/knowledge',express.raw({type:'application/octet-stream',limit:`${config.maxUploadMb}mb`}))
app.use('/api/knowledge/:id/versions',express.raw({type:'application/octet-stream',limit:`${config.maxUploadMb}mb`}))
app.use('/api/research-imports',express.raw({type:'application/octet-stream',limit:`${config.maxUploadMb}mb`}))
app.use('/api/documents',express.raw({type:'application/octet-stream',limit:`${config.maxUploadMb}mb`}))
app.use('/api/assignment-reports/:id/import',express.raw({type:'application/octet-stream',limit:`${config.maxUploadMb}mb`}))
app.use('/api/meetings/:id/transcription/audio',express.raw({type:'application/octet-stream',limit:`${config.maxUploadMb}mb`}))
app.use('/api/meetings/:id/attachments',express.raw({type:'application/octet-stream',limit:`${config.maxUploadMb}mb`}))
const standardJsonBodyParser=express.json({limit:'1mb'})
// Rich report HTML can include embedded images; keep the request budget aligned
// with the bounded per-section schema instead of rejecting valid larger drafts.
const taskReportJsonBodyParser=express.json({limit:'32mb'})
app.use((req,res,next)=>{
  const isTaskReportBody=/^\/api\/assignments\/[^/]+\/tasks\/[^/]+\/(?:contribution|contribution-preview)$/.test(req.path)
  const isResearchReportSectionBody=/^\/api\/research\/[^/]+\/report\/[^/]+$/.test(req.path)
  const isGeneratedReportSectionBody=/^\/api\/generated-documents\/[^/]+\/sections\/[^/]+$/.test(req.path)
  return ((isTaskReportBody||isResearchReportSectionBody||isGeneratedReportSectionBody)?taskReportJsonBodyParser:standardJsonBodyParser)(req,res,next)
})
app.use((req,res,next)=>{
  res.on('finish',()=>{if(req.path!='/api/settings/test-email')scheduleNotificationMaintenance()})
  next()
})
app.use('/api/felix', authenticate, async (req, res) => {
  try {
    const startedAt=Date.now()
    // The App2 mount strips "/felix" from req.url. Chat must target the
    // authenticated scoped pipeline, never the legacy repository-wide /api/chat.
    const felixScopedPath = req.url === '/chat' || req.url === '/advice'
    const target = felixScopedPath
      ? `${config.aiResearchUrl}/api/felix${req.url}`
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
      ...(config.environment==='production'?{}:{details:error.message})
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
const nairobiToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const governedDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Choose a valid date from the date picker.').refine(value=>value>=nairobiToday(),'Date cannot be before today.').nullable()
const optionalGovernedDate=governedDate.optional()
const governedDatePair=(value,context)=>{if(value.startDate&&value.dueDate&&value.dueDate<value.startDate)context.addIssue({code:'custom',path:['dueDate'],message:'Due date cannot be before the start date.'})}
const governedResearchDatePair=(value,context)=>{if(value.startDate&&value.endDate&&value.endDate<value.startDate)context.addIssue({code:'custom',path:['endDate'],message:'Completion date cannot be before the start date.'})}
const assignmentBaseSchema=z.object({title:z.string().min(4).max(240),description:z.string().max(5000).default(''),objective:z.string().max(5000).default(''),scope:z.string().max(5000).default(''),instructions:z.string().max(10000).default(''),expectedOutput:z.string().min(2).max(300).default('Final Assignment Report'),division:z.string().min(2).max(160),startDate:optionalGovernedDate,dueDate:optionalGovernedDate,priority:z.enum(['Low','Normal','High','Critical']).default('Normal'),memberIds:z.array(z.string().uuid()).default([]),leadId:z.string().uuid().nullable().optional()})
const assignmentSchema=assignmentBaseSchema.superRefine(governedDatePair)
const assignmentUpdateSchema=assignmentBaseSchema.omit({memberIds:true,leadId:true}).superRefine(governedDatePair)
const assignmentTaskBaseSchema=z.object({
  title:z.string().min(2).max(240),
  description:z.string().max(5000).default(''),
  ownerId:z.string().uuid().nullable().default(null),
  priority:z.enum(['Low','Normal','High','Critical']).default('Normal'),
  status:z.enum(['Not Started','In Progress','Blocked','Completed']).default('Not Started'),
  progress:z.number().int().min(0).max(100).default(0),
  startDate:governedDate.default(null),
  dueDate:governedDate.default(null),
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
const assignmentTaskSchema=assignmentTaskBaseSchema.superRefine(governedDatePair)
const assignmentTaskCreationSchema=assignmentTaskBaseSchema.extend({startDate:governedDate.unwrap(),dueDate:governedDate.unwrap()}).superRefine(governedDatePair)
const assignmentSectionStatus=z.enum(['Not Started','In Progress','Blocked','Ready for Integration','Completed'])
const assignmentSectionBaseSchema=z.object({
  title:z.string().trim().min(2).max(250),
  description:z.string().max(8000).default(''),
  leadId:z.string().uuid().nullable().default(null),
  startDate:governedDate.default(null),
  dueDate:governedDate.default(null),
  status:assignmentSectionStatus.default('Not Started'),
  progress:z.number().int().min(0).max(100).default(0),
  isMandatory:z.boolean().default(true)
})
const assignmentSectionSchema=assignmentSectionBaseSchema.superRefine(governedDatePair)
const assignmentSectionUpdateSchema=assignmentSectionBaseSchema.partial().superRefine(governedDatePair)
const assignmentSectionReorderSchema=z.array(z.object({id:z.string().uuid(),sectionOrder:z.number().int().positive()})).min(1).max(100)
const assignmentTaskContributionSchema=z.object({
  contributionTitle:z.string().max(5000000).default(''),
  contributionSummary:z.string().max(5000000).default(''),
  contributionFindings:z.string().max(5000000).default(''),
  contributionRecommendations:z.string().max(5000000).default(''),
  evidenceReviewed:z.string().max(5000000).default(''),
  contributionChallenges:z.string().max(5000000).default(''),
  contributionNextActions:z.string().max(5000000).default(''),
  workNotes:z.string().max(12000).default(''),
  reportMode:z.enum(['structured','blank']).default('structured'),
  blankContent:z.string().max(5000000).default(''),
  expectedContributionUpdatedAt:z.string().max(80).nullable().optional(),
  contributionStatus:z.enum(['Draft','Ready for Integration','Integrated','Accepted']).default('Draft')
})
const assignmentTaskContributionReviewSchema=z.object({
  decision:z.enum(['Changes Requested','Rejected','Approved']),
  comments:z.string().max(4000).default('')
})
const assignmentTaskReviewerSelectionSchema=z.object({
  reviewerId:z.string().uuid()
})
const assignmentTaskContributionPreviewSchema=z.object({
  contributionTitle:z.string().max(5000000).default(''),
  contributionSummary:z.string().max(5000000).default(''),
  contributionFindings:z.string().max(5000000).default(''),
  contributionRecommendations:z.string().max(5000000).default(''),
  evidenceReviewed:z.string().max(5000000).default(''),
  contributionChallenges:z.string().max(5000000).default(''),
  contributionNextActions:z.string().max(5000000).default(''),
  workNotes:z.string().max(12000).default(''),
  reportMode:z.enum(['structured','blank']).default('structured'),
  blankContent:z.string().max(5000000).default('')
})
const assignmentTaskContributionSectionSchema=z.object({sectionKey:z.enum(['title','workCompleted','evidence','findings','recommendations','challenges','nextActions']),status:z.enum(['Draft','In Review','Final']),content:z.string().max(5000000).default('')})
const assignmentTaskRequestSchema=z.object({
  title:z.string().min(2).max(240),
  description:z.string().max(5000).default(''),
  suggestedOwnerId:z.string().uuid().nullable().default(null),
  priority:z.enum(['Low','Normal','High','Critical']).default('Normal'),
  dueDate:governedDate.default(null),
  reason:z.string().min(2).max(5000)
})
const assignmentTaskRequestDecisionSchema=z.object({
  decision:z.enum(['Approved','Rejected']),
  comments:z.string().max(4000).default(''),
  title:z.string().min(2).max(240).optional(),
  description:z.string().max(5000).optional(),
  ownerId:z.string().uuid().nullable().optional(),
  priority:z.enum(['Low','Normal','High','Critical']).optional(),
  startDate:optionalGovernedDate,
  dueDate:optionalGovernedDate,
  notes:z.string().max(5000).optional(),
  reviewerId:z.string().uuid().nullable().optional()
}).superRefine((value,context)=>{
  governedDatePair(value,context)
  if(value.decision==='Approved'){
    if(!value.startDate)context.addIssue({code:'custom',path:['startDate'],message:'Choose a task start date before approval.'})
    if(!value.dueDate)context.addIssue({code:'custom',path:['dueDate'],message:'Choose a task due date before approval.'})
  }
})
const assignmentMemberRequestSchema=z.object({
  userId:z.string().uuid(),
  reason:z.string().trim().min(5).max(2000)
})
const assignmentMemberRequestDecisionSchema=z.object({
  decision:z.enum(['Approved','Rejected']),
  comments:z.string().trim().max(2000).default('')
})
const knowledgeSchema=z.object({title:z.string().min(3).max(240),description:z.string().max(5000).default(''),category:z.string().min(2).max(120),categoryId:z.string().uuid().nullable().optional(),tags:z.array(z.string().min(1).max(60)).max(30).default([]),author:z.string().max(200).nullable().optional(),documentDate:z.string().nullable().optional(),sourceType:z.enum(['Internet','Research','Assignment','Task','App2 Report','External Upload','App2 Upload']),sourceUrl:z.string().max(2000).default(''),originEntityId:z.string().uuid().nullable().optional(),directorate:z.string().max(160).nullable().optional(),documentType:z.string().min(2).max(100).default('Document'),subject:z.string().max(300).default(''),classification:z.enum(['PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED']).default('INTERNAL'),felixEnabled:z.boolean().default(false)})
const decodeHeader=value=>{const text=String(value||'');try{return decodeURIComponent(text)}catch{return text}}
const sanitizeReportHtml=value=>String(value||'').replace(/<(script|style|iframe|object|embed|form|svg|math)[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<(?!\/?(?:p|br|h[1-6]|strong|b|em|i|ul|ol|li)\b)[^>]*>/gi,'').replace(/\s[^\s=>]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'').replace(/<!--[\s\S]*?-->/g,'').trim()
const plainTaskReportText=taskReportHtmlToPlainText
const taskReportSubmissionText=({reportMode,blankContent,contributionSummary,contributionFindings,contributionRecommendations,evidenceReviewed,contributionChallenges,contributionNextActions,workNotes})=>{
  if(reportMode==='blank')return plainTaskReportText(blankContent)
  return [
    contributionSummary,
    evidenceReviewed,
    contributionFindings,
    contributionRecommendations,
    contributionChallenges,
    contributionNextActions,
    workNotes
  ].map(plainTaskReportText).filter(Boolean).join('\n\n').trim()
}
const escapeContributionHtml=value=>String(value??'')
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;")
const contributionParagraphs=value=>{
  const text=String(value||'').trim()
  if(!text)return '<p class="empty">Not provided.</p>'
  return text.split(/\r?\n/).filter(Boolean).map(line=>`<p>${escapeContributionHtml(line)}</p>`).join('')
}
const taskReportContentHtml=value=>{
  const raw=String(value??'').trim()
  if(!raw)return '<p class="empty">Not provided.</p>'
  if(/<\/?(?:p|br|h[1-6]|strong|b|em|i|u|s|ul|ol|li|blockquote|table|thead|tbody|tr|th|td|colgroup|col|a|img|span|div|hr)\b/i.test(raw)||/&(?:amp;)*lt;\s*\/?\s*(?:p|br|h[1-6]|strong|b|em|i|u|s|ul|ol|li|blockquote|table|thead|tbody|tr|th|td|colgroup|col|a|img|span|div|hr)\b/i.test(raw))return sanitizeTaskReportHtml(raw)
  return contributionParagraphs(raw)
}
const buildBlankTaskContributionReport=({title,content,task,assignment,ownerName,preparedBy})=>{
  const safeContent=taskReportContentHtml(content)||'<p class="app2-task-report-empty">&nbsp;</p>'
  const savedAt=task?.contribution_updated_at||task?.updated_at||'Not saved yet'
  const metadata=[
    ['Reference',task?.reference||task?.id||'Not recorded'],
    ['Assignment',assignment?.title||'Not specified'],
    ['Prepared by',preparedBy||ownerName||'Not recorded'],
    ['Status','Draft'],
    ['Saved',savedAt]
  ].map(([label,value])=>`<p class="app2-task-report-meta-item"><strong>${escapeContributionHtml(label)}:</strong><span>${escapeContributionHtml(value||'Not recorded')}</span></p>`).join('')
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>${escapeContributionHtml(title)}</title><style>
  *{box-sizing:border-box}
  body{margin:0;background:#eef1f3;color:#263b50;font-family:Arial,"Segoe UI",sans-serif}
  .page{width:min(1040px,calc(100% - 36px));min-height:800px;margin:22px auto;background:#fff;box-shadow:0 10px 34px rgba(0,0,0,.12);padding:58px clamp(24px,5.5vw,72px) 76px}
  .app2-task-report-draft{width:100%;color:#263b50;font-family:Arial,"Segoe UI",sans-serif}
  .app2-task-report-kicker{margin:0 0 13px;color:#92712b;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
  .app2-task-report-title{margin:0 0 22px;padding:0 0 16px;border-bottom:3px solid #c89b2c;color:#10365f;font-family:Georgia,serif;font-size:32px;line-height:1.2}
  .app2-task-report-meta{display:grid;grid-template-columns:minmax(0,1fr);gap:2px;margin:0 0 28px;padding:13px 15px;border:1px solid #d5e0ea;border-radius:9px;background:#f7fafc}
  .app2-task-report-meta-item{display:grid;grid-template-columns:minmax(135px,.35fr) minmax(0,1fr);gap:12px;margin:4px 0;font-size:13px;line-height:1.45}
  .app2-task-report-section{margin:26px 0 0}
  .app2-task-report-section-title{margin:0;padding:12px 16px;border-left:5px solid #c89b2c;border-radius:0 8px 8px 0;background:#f3f8fc;color:#10365f;font-family:Georgia,serif;font-size:24px;line-height:1.25}
  .app2-task-report-section-content{min-width:0;font-size:14px;line-height:1.7}
  .app2-task-report-section-content p{margin:12px 0}
  .app2-task-report-section-content h1,.app2-task-report-section-content h2,.app2-task-report-section-content h3{margin:18px 0 10px;color:#10365f}
  .app2-task-report-section-content ul,.app2-task-report-section-content ol{margin:12px 0 18px;padding-left:28px}
  .app2-task-report-section-content li{margin:6px 0;line-height:1.65}
  .app2-task-report-section-content table{width:100%;border-collapse:collapse;margin:18px 0}
  .app2-task-report-section-content th,.app2-task-report-section-content td{border:1px solid #c8d5e1;padding:9px 11px;vertical-align:top}
  .app2-task-report-empty{color:#718096;font-style:italic}
  @media print{body{background:#fff}.page{width:100%;min-height:auto;margin:0;box-shadow:none;padding:20mm}}
  .app2-psc-report-brand{display:flex;align-items:center;justify-content:center;gap:14px;margin:0 auto 26px;text-align:left;color:#8B6914;font-family:Arial,sans-serif}
.app2-psc-report-brand img{display:block;max-width:118px;max-height:54px;width:auto;height:auto;object-fit:contain}
.app2-psc-report-brand strong{display:block;letter-spacing:.05em;color:#8B6914;font-size:13px}
.app2-psc-report-brand span{display:block;margin-top:4px;color:#80600D;font-size:10px;letter-spacing:.12em}
.app2-task-report-title,.app2-task-report-section-title{color:#8B6914}
.app2-task-report-section-title{border-bottom:2px solid #C89B2C}
  /* APP2_TASK_REPORT_PREVIEW_STRUCTURE_V2 - keep the existing PSC page/header and structure report content. */
  .page{box-sizing:border-box;width:min(1040px,calc(100% - 32px));max-width:1040px;margin:24px auto;padding:52px clamp(20px,5vw,68px) 72px;overflow-wrap:anywhere}
  .app2-task-report-draft{min-width:0;width:100%;max-width:100%}
  .app2-task-report-title{font-size:clamp(25px,3vw,32px);line-height:1.22;overflow-wrap:anywhere;break-after:avoid}
  .app2-task-report-meta-item{grid-template-columns:minmax(110px,.32fr) minmax(0,1fr);align-items:start;overflow-wrap:anywhere}
  .app2-task-report-section-content{min-width:0;max-width:100%;overflow-wrap:anywhere;word-break:normal}
  .app2-task-report-section-content>*{max-width:100%;box-sizing:border-box}
  .app2-task-report-section-content p{white-space:normal;overflow-wrap:anywhere;line-height:1.75}
  .app2-task-report-section-content h1{font-size:24px;line-height:1.28;margin:28px 0 13px;padding-bottom:9px;border-bottom:2px solid #dbe2e8;break-after:avoid}
  .app2-task-report-section-content h2{font-size:20px;line-height:1.3;margin:27px 0 12px;padding-bottom:7px;border-bottom:1px solid #e0e6eb;break-after:avoid}
  .app2-task-report-section-content h3{font-size:17px;line-height:1.35;margin:22px 0 10px;padding-left:11px;border-left:4px solid #C89B2C;break-after:avoid}
  .app2-task-report-section-content ul,.app2-task-report-section-content ol{padding-left:28px;margin:10px 0 18px}
  .app2-task-report-section-content li{margin:6px 0;line-height:1.65}
  .app2-task-report-section-content table{width:100%;max-width:100%;table-layout:fixed;border-collapse:collapse;overflow-wrap:anywhere}
  .app2-task-report-section-content th,.app2-task-report-section-content td{overflow-wrap:anywhere;word-break:normal}
  .app2-task-report-section-content pre{max-width:100%;white-space:pre-wrap;overflow-wrap:anywhere}
  .app2-task-report-section-content img{max-width:100%;height:auto;object-fit:contain}
  .app2-task-report-section-content .empty,.app2-task-report-empty{color:#718096;font-style:italic}
  @media(max-width:640px){.page{width:calc(100% - 20px);min-height:0;margin:10px auto;padding:30px 18px 44px}.app2-task-report-meta-item{grid-template-columns:1fr;gap:3px}}
  @media print{.page{width:100%;min-height:auto;margin:0;padding:20mm;box-shadow:none}}</style></head><body><article class="page"><div class="app2-psc-report-brand"><img src="/psc-logo.png" alt="Public Service Commission logo" width="118"><div><strong>PUBLIC SERVICE COMMISSION</strong><span>RESEARCH DEPARTMENT</span></div></div><div class="app2-task-report-draft"><p class="app2-task-report-kicker">TASK REPORT · WORKING DRAFT</p><h1 class="app2-task-report-title">${escapeContributionHtml(title)}</h1><div class="app2-task-report-meta">${metadata}</div><section class="app2-task-report-section"><h2 class="app2-task-report-section-title">Report body</h2><div class="app2-task-report-section-content">${safeContent}</div></section></div></article></body></html>`
  return {title,html}
}
const buildTaskContributionReport=({task,assignment,ownerName,preparedBy,override={}})=>{
  const hasExplicitTitle = Object.prototype.hasOwnProperty.call(override, "contributionTitle") && override.contributionTitle !== undefined && override.contributionTitle !== null;
const title = hasExplicitTitle
  ? plainTaskReportText(override.contributionTitle)
  : (plainTaskReportText(task.contribution_title) || `${task.title} — Contribution Report`);
  const summary=String(override.contributionSummary??task.contribution_summary??'')
  const findings=String(override.contributionFindings??task.contribution_findings??'')
  const recommendations=String(override.contributionRecommendations??task.contribution_recommendations??'')
  const evidenceReviewed=String(override.evidenceReviewed??task.evidence_reviewed??'')
  const challenges=String(override.contributionChallenges??task.contribution_challenges??'')
  const nextActions=String(override.contributionNextActions??task.contribution_next_actions??'')
  const workNotes=String(override.workNotes??task.notes??'')
  const reportMode=override.reportMode??task.report_mode??'structured'
  const blankContent=override.blankContent??task.blank_content??''
  if(reportMode==='blank')return buildBlankTaskContributionReport({title,content:blankContent,task,assignment,ownerName,preparedBy})
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
  .app2-psc-report-brand{display:flex;align-items:center;justify-content:center;gap:14px;margin:0 auto 26px;text-align:left;color:#8B6914;font-family:Arial,sans-serif}
.app2-psc-report-brand img{display:block;max-width:118px;max-height:54px;width:auto;height:auto;object-fit:contain}
.app2-psc-report-brand strong{display:block;letter-spacing:.05em;color:#8B6914;font-size:13px}
.app2-psc-report-brand span{display:block;margin-top:4px;color:#80600D;font-size:10px;letter-spacing:.12em}
.app2-task-report-title,.app2-task-report-section-title{color:#8B6914}
.app2-task-report-section-title{border-bottom:2px solid #C89B2C}
</style></head><body><article class="page"><div class="app2-psc-report-brand"><img src="/psc-logo.png" alt="Public Service Commission logo" width="118"><div><strong>PUBLIC SERVICE COMMISSION</strong><span>RESEARCH DEPARTMENT</span></div></div>
  <header class="head"><div class="eyebrow">APP2 · TASK CONTRIBUTION REPORT</div><h1>${escapeContributionHtml(title)}</h1><div class="sub">${escapeContributionHtml(task.title)}</div></header>
  <section class="meta">
    <div><small>Assignment</small><strong>${escapeContributionHtml(assignment?.title||'Current assignment')}</strong></div>
    <div><small>Assigned member</small><strong>${escapeContributionHtml(ownerName||'Unassigned')}</strong></div>
    <div><small>Exact assignment part</small><strong>${escapeContributionHtml(task.assignment_part||'Not yet specified')}</strong></div>
    <div><small>Feeds into output</small><strong>${escapeContributionHtml(task.target_document_title||'General Assignment Contribution')}</strong></div>
    <div><small>Target output section</small><strong>${escapeContributionHtml(task.target_section_title||'Not yet mapped')}</strong></div>
    <div><small>Prepared by</small><strong>${escapeContributionHtml(preparedBy||ownerName||'APP2 user')}</strong></div>
    <div><small>Generated</small><strong>${escapeContributionHtml(generatedText)}</strong></div>
  </section>
  <main class="body">
    <section class="section"><h2>Task Purpose</h2><div class="callout">${contributionParagraphs(task.task_purpose||task.description)}</div></section>
    <section class="section"><h2>Instructions</h2>${contributionParagraphs(task.specific_instructions)}</section>
    <section class="section"><h2>Expected Contribution</h2><div class="callout">${contributionParagraphs(task.expected_contribution)}</div></section>
    <section class="section"><h2>Work Completed</h2>${taskReportContentHtml(summary||workNotes)}</section>
    <section class="section"><h2>Evidence Reviewed</h2>${taskReportContentHtml(evidenceReviewed)}</section>
    <section class="section"><h2>Key Findings</h2>${taskReportContentHtml(findings)}</section>
    <section class="section"><h2>Challenges and Limitations</h2>${taskReportContentHtml(challenges)}</section>
    <section class="section"><h2>Recommendations</h2>${taskReportContentHtml(recommendations)}</section>
    <section class="section"><h2>Next Actions</h2>${taskReportContentHtml(nextActions)}</section>
  </main>
  <footer class="footer">Generated by APP2 from the task contribution record. Review this report before sending it for integration.</footer>
  </article></body></html>`
  return {title,html}
}
const canAccessAssignment=async(user,id)=>isOrganisationScopeRole(user.role)||isTeamScopeRole(user.role)&&await canManageAssignment(user,id)||(await query(`SELECT 1
  FROM assignments a
  WHERE a.id=$1
    AND EXISTS(
      SELECT 1
      FROM assignment_members am
      WHERE am.assignment_id=a.id
        AND am.user_id=$2
    )
  LIMIT 1`,[id,user.id])).rowCount>0
const isEligibleAssignmentTaskReviewer=async(assignmentId,ownerId,reviewerId)=>{
  if(!ownerId||!reviewerId||ownerId===reviewerId)return false
  const reviewer=(await query("SELECT id FROM users WHERE id=$1 AND active=TRUE AND role<>'System Admin'",[reviewerId])).rows[0]
  if(!reviewer)return false
  if((await query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[assignmentId,reviewerId])).rowCount)return true
  return (await immediateOversightReviewers(ownerId)).some(candidate=>candidate.id===reviewerId)
}
const canAccessResearch=async(user,id)=>isOrganisationScopeRole(user.role)||isTeamScopeRole(user.role)&&await canManageResearch(user,id)||(await query('SELECT 1 FROM research_projects p WHERE p.id=$1 AND(p.lead_id=$2 OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=p.id AND rc.user_id=$2) OR EXISTS(SELECT 1 FROM research_reviewers rr WHERE rr.project_id=p.id AND rr.reviewer_id=$2 AND rr.active=TRUE))',[id,user.id])).rowCount>0
const canEditResearch=async(user,id)=>{
  if(isOrganisationScopeRole(user.role)) return true
  if(isTeamScopeRole(user.role)) return canManageResearch(user,id)

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
const researchWorkspaceLockState=async id=>{
  const row=(await query(`SELECT id,version_number,status,reviewer_id,submitted_at,reviewed_at
    FROM research_report_versions
    WHERE project_id=$1
    ORDER BY version_number DESC
    LIMIT 1`,[id])).rows[0]||null
  const locked=Boolean(row&&['Submitted','Approved','Rejected'].includes(row.status))
  return {locked,version:row}
}

const lockedWorkspaceResponse=(res,{domain,status,version=null,reviewer=null,message})=>res.status(423).json({
  error:'WORKSPACE_LOCKED',
  message:message||`This ${domain} workspace is read-only while the governed report is ${status}.`,
  status,
  version,
  reviewer
})

const assignmentWorkspaceLockState=async id=>{
  const assignment=(await query('SELECT id,status FROM assignments WHERE id=$1',[id])).rows[0]||null
  const report=(await query(`SELECT d.id,d.status,d.version,d.reviewer_id,u.name reviewer_name
    FROM generated_documents d LEFT JOIN users u ON u.id=d.reviewer_id
    WHERE d.context='Assignment' AND d.context_id=$1
    ORDER BY d.updated_at DESC LIMIT 1`,[id])).rows[0]||null
  const locked=Boolean(assignment?.status==='Completed'||report&&['Submitted','Under Review','Approved','Final'].includes(report.status))
  return {locked,assignment,report}
}

const taskWorkspaceLockState=async(assignmentId,taskId)=>{
  const task=(await query(`SELECT t.id,t.status,t.contribution_status,t.contribution_report_version,t.reviewer_id,u.name reviewer_name
    FROM assignment_tasks t LEFT JOIN users u ON u.id=t.reviewer_id
    WHERE t.id=$1 AND t.assignment_id=$2 AND t.archived_at IS NULL`,[taskId,assignmentId])).rows[0]||null
  const locked=Boolean(task&&(task.status==='Completed'||['Ready for Integration','Integrated','Accepted'].includes(task.contribution_status)))
  return {locked,task}
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
const knowledgeManagers=['System Admin','Director','Deputy Director','Assistant Director']
const canManageKnowledge=user=>knowledgeManagers.includes(user.role)
const isKnowledgeManagerFor=async(user,id)=>isOrganisationScopeRole(user.role)||isTeamScopeRole(user.role)&&await canManageKnowledgeScope(user,id)
const canReviewKnowledge=user=>knowledgeManagers.includes(user.role)
const privateRepositoryDraftTypes=new Set([
  'Assignment Draft',
  'Task Draft',
  'Task Report Draft',
  'Assignment Report Draft',
  'Meeting Minutes Draft'
])
const isPrivateRepositoryDraft=item=>Boolean(
  item&&
  item.status==='Draft'&&
  privateRepositoryDraftTypes.has(item.document_type)
)
const privateDraftSupervisedUserIds=async supervisorId=>(await query(`
  WITH RECURSIVE supervised AS(
    SELECT id
    FROM users
    WHERE supervisor_id=$1 AND active=TRUE
    UNION
    SELECT u.id
    FROM users u
    JOIN supervised s ON u.supervisor_id=s.id
    WHERE u.active=TRUE
  )
  SELECT id FROM supervised
`,[supervisorId])).rows.map(row=>row.id)
const canAccessPrivateRepositoryDraft=async(user,item)=>{
  if(!item)return false
  if(item.created_by===user.id)return true
  if(!isManagementRole(user.role))return false
  const supervised=await privateDraftSupervisedUserIds(user.id)
  return supervised.includes(item.created_by)
}
const isAssignedKnowledgeReviewer=async(user,id)=>Boolean((await query('SELECT 1 FROM knowledge_items WHERE id=$1 AND reviewer_id=$2',[id,user.id])).rowCount)
const activeExternalResearchForKnowledge=async knowledgeId=>(await query("SELECT id,status FROM external_research_imports WHERE knowledge_id=$1 AND status NOT IN('Published','Rejected')",[knowledgeId])).rows[0]||null

const documentAccessPolicy=async id=>(await query(
  `SELECT knowledge_id,reader_scope,allow_download,allow_copy,allow_print,allow_link,watermark,
    restriction_reason,expires_at,approved_by,updated_by,updated_at
   FROM document_access_policies WHERE knowledge_id=$1`,[id]
)).rows[0]||null

const documentNamedGrant=async(user,id)=>(
  await query(`SELECT * FROM document_access_grants WHERE knowledge_id=$1 AND user_id=$2`,[id,user.id])
).rows[0]||null

const documentProtectionAllowsView=async(user,item)=>{
  const policy=await documentAccessPolicy(item.id)
  if(!policy)return true
  if(policy.expires_at&&new Date(policy.expires_at).getTime()<=Date.now())return false
  if(item.created_by===user.id)return true
  if(isOrganisationScopeRole(user.role)&&policy.reader_scope!=='NAMED_USERS')return true
  if(policy.reader_scope==='INHERITED')return true
  if(policy.reader_scope==='MANAGEMENT_ONLY')return isManagementRole(user.role)
  if(policy.reader_scope==='REVIEWER_ONLY')
    return item.reviewer_id===user.id||item.approved_by===user.id||isManagementRole(user.role)
  if(policy.reader_scope==='TEAM'){
    if(isManagementRole(user.role))return await canManageKnowledgeScope(user,item.id)
    return item.created_by===user.id||item.reviewer_id===user.id
  }
  if(policy.reader_scope==='NAMED_USERS'){
    const grant=await documentNamedGrant(user,item.id)
    return Boolean(grant?.can_view)
  }
  return false
}

const documentProtectionCapability=async(user,id,capability)=>{
  const item=(await query(
    'SELECT id,status,document_type,created_by,reviewer_id,approved_by FROM knowledge_items WHERE id=$1',
    [id]
  )).rows[0]
  if(!item)return false
  if(!await documentProtectionAllowsView(user,item))return false
  const policy=await documentAccessPolicy(id)
  if(!policy)return true
  const grant=await documentNamedGrant(user,id)
  const field={download:'allow_download',copy:'allow_copy',print:'allow_print',link:'allow_link'}[capability]
  const grantField={download:'can_download',copy:'can_copy',print:'can_print',link:'can_link'}[capability]
  if(!field||!grantField)return false
  if(policy.reader_scope==='NAMED_USERS')return Boolean(policy[field]&&grant?.[grantField])
  return Boolean(policy[field])
}

const canReadKnowledge=async(user,id)=>{
  const item=(await query(
    'SELECT id,status,document_type,created_by,reviewer_id,approved_by FROM knowledge_items WHERE id=$1',
    [id]
  )).rows[0]
  if(!item)return false

  if(!await documentProtectionAllowsView(user,item))return false

  if(isPrivateRepositoryDraft(item))return await canAccessPrivateRepositoryDraft(user,item)

  if(isOrganisationScopeRole(user.role))return true
  if(isTeamScopeRole(user.role)){
    const published=item.status==='Published'&&(await query(
      "SELECT 1 FROM knowledge_items WHERE id=$1 AND COALESCE(is_archived,FALSE)=FALSE",
      [id]
    )).rowCount>0
    return published||await canManageKnowledgeScope(user,id)||await isAssignedKnowledgeReviewer(user,id)
  }
  return await isAssignedKnowledgeReviewer(user,id)||(await query("SELECT 1 FROM knowledge_items k WHERE k.id=$1 AND(k.status='Published' OR k.created_by=$2 OR EXISTS(SELECT 1 FROM document_permissions p WHERE p.knowledge_id=k.id AND p.permission='READ' AND(p.user_id=$2 OR p.role=$3)))",[id,user.id,user.role])).rowCount>0
}
const canDownloadKnowledge=async(user,id)=>{
  if(!await documentProtectionCapability(user,id,'download'))return false
  const draftItem=(await query(
    'SELECT id,status,document_type,created_by FROM knowledge_items WHERE id=$1',
    [id]
  )).rows[0]
  if(!draftItem)return false

  if(isPrivateRepositoryDraft(draftItem))return await canAccessPrivateRepositoryDraft(user,draftItem)

  if(isOrganisationScopeRole(user.role))return true
  if(isTeamScopeRole(user.role))return await canManageKnowledgeScope(user,id)
  if(await isAssignedKnowledgeReviewer(user,id))return true
  const result=await query(`SELECT k.created_by,
    EXISTS(SELECT 1 FROM document_permissions p WHERE p.knowledge_id=k.id) has_rules,
    EXISTS(SELECT 1 FROM document_permissions p WHERE p.knowledge_id=k.id AND p.permission='DOWNLOAD' AND(p.user_id=$2 OR p.role=$3)) can_download
    FROM knowledge_items k WHERE k.id=$1`,[id,user.id,user.role])
  const item=result.rows[0]
  return Boolean(item&&(item.created_by===user.id||!item.has_rules||item.can_download))
}
const hasViewedCurrentKnowledgeVersion=async(user,id)=>Boolean((await query(`SELECT 1
  FROM knowledge_items k
  JOIN knowledge_versions v ON v.knowledge_id=k.id AND v.is_current=TRUE
  JOIN audit_logs l ON l.entity_type='knowledge' AND l.entity_id=k.id AND l.user_id=$2 AND l.action='DOCUMENT_VIEWED'
  WHERE k.id=$1 AND COALESCE(l.details->>'versionId','')=v.id::text
  LIMIT 1`,[id,user.id])).rowCount)
const requireDocumentReadBeforeDecision=async(user,id)=>{
  if(await hasViewedCurrentKnowledgeVersion(user,id))return true
  throw Object.assign(new Error('Open and read the current document version before recording a review decision.'),{statusCode:409})
}
const rejectDuplicateKnowledgeUpload=async(req,res,next)=>{try{if(!Buffer.isBuffer(req.body)||!req.body.length)return next();const incoming=crypto.createHash('sha256').update(req.body).digest('hex');const duplicate=(await query('SELECT v.id version_id,v.version_number,v.created_at upload_date,k.id document_id,k.title FROM knowledge_versions v JOIN knowledge_items k ON k.id=v.knowledge_id WHERE v.sha256_hash=$1 LIMIT 1',[incoming])).rows[0];if(duplicate)return res.status(409).json({error:`This exact file is already stored as Ã¢â‚¬Å“${duplicate.title}Ã¢â‚¬Â (version ${duplicate.version_number}).`,duplicate:{...duplicate,sha256_hash:incoming}});const candidates=(await query('SELECT v.stored_name,v.storage_path,v.version_number,v.id version_id,v.created_at upload_date,k.id document_id,k.title FROM knowledge_versions v JOIN knowledge_items k ON k.id=v.knowledge_id WHERE v.sha256_hash IS NULL AND v.size_bytes=$1',[req.body.length])).rows;for(const candidate of candidates){try{const bytes=await fs.readFile(resolveDocumentPath(candidate.storage_path||candidate.stored_name));if(crypto.createHash('sha256').update(bytes).digest('hex')===incoming)return res.status(409).json({error:`This exact file is already stored as Ã¢â‚¬Å“${candidate.title}Ã¢â‚¬Â (version ${candidate.version_number}).`,duplicate:{...candidate,sha256_hash:incoming}})}catch{}}req.documentHash=incoming;next()}catch(error){next(error)}}
app.post('/api/knowledge',authenticate,rejectDuplicateKnowledgeUpload)
app.post('/api/knowledge/:id/versions',authenticate,rejectDuplicateKnowledgeUpload)
app.get('/api/knowledge/versions/:versionId/download',authenticate,async(req,res,next)=>{try{const row=(await query('SELECT knowledge_id FROM knowledge_versions WHERE id=$1',[req.params.versionId])).rows[0];if(!row)return res.status(404).json({error:'Document version not found.'});if(!await canDownloadKnowledge(req.user,row.knowledge_id))return res.status(403).json({error:'You do not have download permission for this document.'});next()}catch(error){next(error)}})
app.delete('/api/knowledge/:id',authenticate,(_req,res)=>res.status(405).json({error:'Direct deletion is disabled. Submit a deletion request for manager approval.'}))


const repositorySavedViewSchema=z.object({
  name:z.string().trim().min(2).max(100),
  filters:z.record(z.any()).default({})
})
const repositoryRetentionScheduleSchema=z.object({
  name:z.string().trim().min(2).max(160),
  recordClass:z.string().trim().min(2).max(120),
  reviewIntervalMonths:z.number().int().min(1).max(240).nullable().default(null),
  retentionYears:z.number().int().min(1).max(100).nullable().default(null),
  dispositionAction:z.enum(['Review','Destroy','Transfer','Permanent']).default('Review'),
  description:z.string().trim().max(3000).default('')
})
const repositoryGovernanceSchema=z.object({
  recordClass:z.string().trim().min(2).max(120),
  retentionScheduleId:z.string().uuid().nullable().default(null),
  nextReviewAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null)
})
const repositorySupersedeSchema=z.object({replacementId:z.string().uuid()})

app.get('/api/repository/saved-views',authenticate,async(req,res,next)=>{try{
  res.json((await query('SELECT id,name,filters,created_at,updated_at FROM repository_saved_views WHERE user_id=$1 ORDER BY updated_at DESC',[req.user.id])).rows)
}catch(error){next(error)}})
app.post('/api/repository/saved-views',authenticate,validate(repositorySavedViewSchema),async(req,res,next)=>{try{
  const row=(await query(`INSERT INTO repository_saved_views(user_id,name,filters) VALUES($1,$2,$3)
    ON CONFLICT(user_id,name) DO UPDATE SET filters=EXCLUDED.filters,updated_at=NOW()
    RETURNING id,name,filters,created_at,updated_at`,[req.user.id,req.validated.name,JSON.stringify(req.validated.filters)])).rows[0]
  res.status(201).json(row)
}catch(error){next(error)}})
app.delete('/api/repository/saved-views/:id',authenticate,async(req,res,next)=>{try{
  await query('DELETE FROM repository_saved_views WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]);res.status(204).end()
}catch(error){next(error)}})

app.get('/api/repository/retention-schedules',authenticate,async(_req,res,next)=>{try{
  res.json((await query(`SELECT s.*,u.name created_by_name FROM repository_retention_schedules s
    LEFT JOIN users u ON u.id=s.created_by WHERE s.active=TRUE ORDER BY s.record_class,s.name`)).rows)
}catch(error){next(error)}})
app.post('/api/repository/retention-schedules',authenticate,authorize('System Admin','Director'),validate(repositoryRetentionScheduleSchema),async(req,res,next)=>{try{
  const v=req.validated
  const row=(await query(`INSERT INTO repository_retention_schedules
    (name,record_class,review_interval_months,retention_years,disposition_action,description,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [v.name,v.recordClass,v.reviewIntervalMonths,v.retentionYears,v.dispositionAction,v.description,req.user.id])).rows[0]
  await query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)
    VALUES($1,'RETENTION_SCHEDULE_CREATED','repository_retention_schedule',$2,$3)`,
    [req.user.id,row.id,JSON.stringify({recordClass:v.recordClass})])
  res.status(201).json(row)
}catch(error){next(error)}})

app.patch('/api/documents/:id/governance',authenticate,authorize('System Admin','Director','Deputy Director','Assistant Director'),validate(repositoryGovernanceSchema),async(req,res,next)=>{try{
  if(!await isKnowledgeManagerFor(req.user,req.params.id))return res.status(403).json({error:'This record is outside your management scope.'})
  const v=req.validated
  const row=(await query(`UPDATE knowledge_items SET record_class=$1,retention_schedule_id=$2,next_review_at=$3::date,
    review_due_at=$3::date,updated_at=NOW() WHERE id=$4 RETURNING *`,
    [v.recordClass,v.retentionScheduleId,v.nextReviewAt,req.params.id])).rows[0]
  if(!row)return res.status(404).json({error:'Record not found.'})
  await query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)
    VALUES($1,'RECORD_GOVERNANCE_UPDATED','knowledge',$2,$3)`,[req.user.id,row.id,JSON.stringify(v)])
  res.json(row)
}catch(error){next(error)}})

app.post('/api/documents/:id/supersede',authenticate,authorize('System Admin','Director','Deputy Director','Assistant Director'),validate(repositorySupersedeSchema),async(req,res,next)=>{try{
  if(req.params.id===req.validated.replacementId)return res.status(400).json({error:'A record cannot supersede itself.'})
  if(!await isKnowledgeManagerFor(req.user,req.params.id)||!await isKnowledgeManagerFor(req.user,req.validated.replacementId))
    return res.status(403).json({error:'Both records must be within your management scope.'})
  const result=await transaction(async client=>{
    const old=(await client.query('SELECT * FROM knowledge_items WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]
    const replacement=(await client.query('SELECT * FROM knowledge_items WHERE id=$1 FOR UPDATE',[req.validated.replacementId])).rows[0]
    if(!old||!replacement)return null
    if(replacement.status!=='Published')throw Object.assign(new Error('The replacement must be a Published record.'),{statusCode:409})
    await client.query(`UPDATE knowledge_items SET status='Archived',records_lifecycle_state='Superseded',
      superseded_at=NOW(),superseded_by=$1,updated_at=NOW() WHERE id=$2`,[replacement.id,old.id])
    await client.query('UPDATE knowledge_items SET supersedes_id=$1,updated_at=NOW() WHERE id=$2',[old.id,replacement.id])
    await audit(client,req.user.id,'RECORD_SUPERSEDED','knowledge',old.id,{replacementId:replacement.id,replacementRecordNumber:replacement.record_number})
    return true
  })
  if(!result)return res.status(404).json({error:'One of the records was not found.'})
  res.json({ok:true})
}catch(error){next(error)}})


const repositoryGovernanceReviewSchema=z.object({
  outcome:z.enum(['Confirm Current','Needs Improvement','Supersede Required']),
  nextReviewAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  comments:z.string().trim().min(3).max(3000)
})

app.post('/api/documents/:id/governance-review',
  authenticate,
  authorize('System Admin','Director','Deputy Director','Assistant Director'),
  validate(repositoryGovernanceReviewSchema),
  async(req,res,next)=>{try{
    if(!await isKnowledgeManagerFor(req.user,req.params.id))
      return res.status(403).json({error:'This record is outside your management scope.'})

    const v=req.validated
    const result=await transaction(async client=>{
      const current=(await client.query(
        `SELECT id,title,status,records_lifecycle_state,created_by,reviewer_id,review_due_at,next_review_at
         FROM knowledge_items WHERE id=$1 FOR UPDATE`,
        [req.params.id]
      )).rows[0]
      if(!current)return null

      const lifecycle=v.outcome==='Confirm Current'
        ?(current.status==='Published'?'Active Record':current.records_lifecycle_state)
        :v.outcome==='Needs Improvement'
          ?'Under Improvement'
          :'Supersession Review'

      const nextDate=v.outcome==='Confirm Current'?v.nextReviewAt:null
      const row=(await client.query(
        `UPDATE knowledge_items SET
          records_lifecycle_state=$1,
          next_review_at=$2::date,
          review_due_at=$2::date,
          disposition_notes=CASE
            WHEN $3='Confirm Current' THEN disposition_notes
            ELSE CONCAT_WS(E'\\n',NULLIF(disposition_notes,''),$4)
          END,
          updated_at=NOW()
         WHERE id=$5 RETURNING *`,
        [lifecycle,nextDate,v.outcome,`Governance review ${v.outcome}: ${v.comments}`,current.id]
      )).rows[0]

      await audit(client,req.user.id,'RECORD_GOVERNANCE_REVIEW_COMPLETED','knowledge',current.id,{
        outcome:v.outcome,nextReviewAt:nextDate,comments:v.comments
      })

      const notifyIds=[current.created_by,current.reviewer_id].filter(Boolean).filter(id=>id!==req.user.id)
      for(const userId of [...new Set(notifyIds)]){
        await client.query(
          `INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
           VALUES($1,'Repository governance review completed',$2,'knowledge',$3)`,
          [userId,`â€œ${current.title}â€ review outcome: ${v.outcome}${nextDate?`. Next review: ${nextDate}`:''}.`,current.id]
        )
      }
      return row
    })

    if(!result)return res.status(404).json({error:'Record not found.'})
    res.json(result)
  }catch(error){next(error)}
})




// APP2_REPOSITORY_GOVERNANCE_RECONCILIATION_V2_9_1
const repositoryReconciliationRows=async(user)=>{
  const organisation=isOrganisationScopeRole(user.role)
  const scopedIds=organisation?[]:await managedUserIds(user)
  const ids=scopedIds.length?scopedIds:[user.id]
  const params=organisation?[]:[ids]
  const scope=organisation?'TRUE':'(k.created_by=ANY($1::uuid[]) OR k.reviewer_id=ANY($1::uuid[]))'

  const records=(await query(`SELECT
      k.id,k.title,k.status,k.record_number,k.record_class,k.document_type,k.created_by,
      k.reviewer_id,k.retention_schedule_id,k.next_review_at,k.review_due_at,
      k.approved_by,k.approved_at,k.created_at,
      reviewer.name reviewer_name,
      schedule.name retention_schedule_name,
      schedule.review_interval_months,
      (
        SELECT jsonb_build_object(
          'actorId',r.actor_id,
          'actorName',u.name,
          'action',r.action,
          'createdAt',r.created_at
        )
        FROM document_reviews r
        JOIN users u ON u.id=r.actor_id
        WHERE r.knowledge_id=k.id AND r.action='APPROVED'
        ORDER BY r.created_at DESC
        LIMIT 1
      ) last_approval,
      (
        SELECT COUNT(*)::int
        FROM document_reviews r
        WHERE r.knowledge_id=k.id AND r.action='APPROVED'
      ) approval_count
    FROM knowledge_items k
    LEFT JOIN users reviewer ON reviewer.id=k.reviewer_id
    LEFT JOIN repository_retention_schedules schedule ON schedule.id=k.retention_schedule_id
    WHERE ${scope}
      AND k.status='Published'
    ORDER BY k.created_at DESC`,params)).rows

  const schedules=(await query(`SELECT id,name,record_class,review_interval_months,retention_years,disposition_action
    FROM repository_retention_schedules
    WHERE active=TRUE
    ORDER BY record_class,name`)).rows

  return records.map(record=>{
    const approval=record.last_approval||null
    const reviewerSuggestion=(!record.reviewer_id && Number(record.approval_count)===1 && approval?.actorId)
      ?{userId:approval.actorId,userName:approval.actorName,source:'single-authoritative-approval'}
      :null

    const exactSchedules=schedules.filter(s=>String(s.record_class||'').trim().toLowerCase()===String(record.record_class||'').trim().toLowerCase())
    const retentionSuggestion=(!record.retention_schedule_id && exactSchedules.length===1)
      ?{scheduleId:exactSchedules[0].id,scheduleName:exactSchedules[0].name,reviewIntervalMonths:exactSchedules[0].review_interval_months,source:'exact-record-class'}
      :null

    const interval=record.review_interval_months||retentionSuggestion?.reviewIntervalMonths||null
    const baseDate=record.approved_at||record.created_at
    const suggestedReviewDate=(!record.next_review_at&&!record.review_due_at&&interval&&baseDate)
      ?new Date(new Date(baseDate).setMonth(new Date(baseDate).getMonth()+Number(interval))).toISOString().slice(0,10)
      :null

    return{
      id:record.id,
      title:record.title,
      recordNumber:record.record_number,
      recordClass:record.record_class,
      reviewerId:record.reviewer_id,
      reviewerName:record.reviewer_name,
      retentionScheduleId:record.retention_schedule_id,
      retentionScheduleName:record.retention_schedule_name,
      nextReviewAt:record.next_review_at||record.review_due_at,
      reviewerSuggestion,
      retentionSuggestion,
      suggestedReviewDate,
      missingReviewer:!record.reviewer_id,
      missingRetention:!record.retention_schedule_id,
      missingReviewDate:!record.next_review_at&&!record.review_due_at
    }
  })
}

app.get('/api/repository/governance-reconciliation',authenticate,async(req,res,next)=>{try{
  const rows=await repositoryReconciliationRows(req.user)
  res.json(rows)
}catch(error){next(error)}})

const repositoryReconcileSchema=z.object({
  reviewerId:z.string().uuid().nullable().optional(),
  retentionScheduleId:z.string().uuid().nullable().optional(),
  nextReviewAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  reviewerSource:z.enum(['single-authoritative-approval','manual-manager-confirmation']).nullable().optional(),
  retentionSource:z.enum(['exact-record-class','manual-manager-confirmation']).nullable().optional()
})

app.post('/api/repository/governance-reconciliation/:id/apply',
  authenticate,
  authorize('System Admin','Director','Deputy Director','Assistant Director'),
  validate(repositoryReconcileSchema),
  async(req,res,next)=>{try{
    if(!await isKnowledgeManagerFor(req.user,req.params.id))
      return res.status(403).json({error:'This record is outside your management scope.'})

    const v=req.validated
    const result=await transaction(async client=>{
      const current=(await client.query(`SELECT * FROM knowledge_items WHERE id=$1 FOR UPDATE`,[req.params.id])).rows[0]
      if(!current)return null
      if(current.status!=='Published')
        throw Object.assign(new Error('Only Published records can be reconciled.'),{statusCode:409})

      if(v.reviewerId&&v.reviewerId===current.created_by)
        throw Object.assign(new Error('Reviewer provenance cannot be reconciled to the record owner.'),{statusCode:409})

      if(v.reviewerSource==='single-authoritative-approval'){
        const approval=(await client.query(`SELECT actor_id,COUNT(*) OVER() total
          FROM document_reviews WHERE knowledge_id=$1 AND action='APPROVED'
          ORDER BY created_at DESC`,[current.id])).rows
        if(approval.length!==1||approval[0].actor_id!==v.reviewerId)
          throw Object.assign(new Error('Reviewer suggestion is no longer uniquely supported by authoritative approval history.'),{statusCode:409})
      }

      if(v.retentionSource==='exact-record-class'&&v.retentionScheduleId){
        const matches=(await client.query(`SELECT id FROM repository_retention_schedules
          WHERE active=TRUE AND LOWER(BTRIM(record_class))=LOWER(BTRIM($1))`,[current.record_class])).rows
        if(matches.length!==1||matches[0].id!==v.retentionScheduleId)
          throw Object.assign(new Error('Retention suggestion is no longer deterministic for this record class.'),{statusCode:409})
      }

      if(v.nextReviewAt&&v.retentionScheduleId){
        const schedule=(await client.query(`SELECT review_interval_months FROM repository_retention_schedules WHERE id=$1`,[v.retentionScheduleId])).rows[0]
        if(!schedule)throw Object.assign(new Error('Retention schedule not found.'),{statusCode:404})
      }

      const row=(await client.query(`UPDATE knowledge_items SET
        reviewer_id=COALESCE($1,reviewer_id),
        retention_schedule_id=COALESCE($2,retention_schedule_id),
        next_review_at=COALESCE($3::date,next_review_at),
        review_due_at=COALESCE($3::date,review_due_at),
        updated_at=NOW()
        WHERE id=$4 RETURNING *`,
        [v.reviewerId||null,v.retentionScheduleId||null,v.nextReviewAt||null,current.id])).rows[0]

      await audit(client,req.user.id,'RECORD_GOVERNANCE_RECONCILED','knowledge',current.id,{
        reviewerId:v.reviewerId||null,
        reviewerSource:v.reviewerSource||null,
        retentionScheduleId:v.retentionScheduleId||null,
        retentionSource:v.retentionSource||null,
        nextReviewAt:v.nextReviewAt||null
      })
      return row
    })
    if(!result)return res.status(404).json({error:'Record not found.'})
    res.json(result)
  }catch(error){next(error)}
})

// APP2_REPOSITORY_ASSURANCE_OVERVIEW_V2_7
const repositoryAssuranceSummaryOutcome=(record,currentVersionExists,relationshipCount,auditCount)=>{
  const published=record.status==='Published'
  const restricted=['CONFIDENTIAL','RESTRICTED'].includes(String(record.classification||'').toUpperCase())
  const activeRecord=(record.records_lifecycle_state||'')==='Active Record'
  const reviewDate=record.next_review_at||record.review_due_at
  const reviewOverdue=Boolean(reviewDate)&&new Date(reviewDate).getTime()<Date.now()
  const statuses=[
    record.record_number?'PASS':'GAP',
    (record.record_class&&record.document_type)?'PASS':'GAP',
    record.reviewer_id?'PASS':published?'WARNING':'GAP',
    record.retention_schedule_id?'PASS':published?'GAP':'WARNING',
    reviewOverdue?'GAP':reviewDate?'PASS':published?'WARNING':'INFO',
    currentVersionExists?'PASS':'GAP',
    record.protection_scope?'PASS':restricted?'GAP':'INFO',
    Number(auditCount)>0?'PASS':'WARNING',
    Number(relationshipCount)>0?'PASS':activeRecord?'WARNING':'INFO',
    published
      ?record.felix_index_status==='Completed'?'PASS':record.felix_enabled?'WARNING':'INFO'
      :'INFO'
  ]
  const gaps=statuses.filter(s=>s==='GAP').length
  const warnings=statuses.filter(s=>s==='WARNING').length
  const overall=gaps>=3?'SIGNIFICANT GAPS':gaps>0?'NEEDS REVISION':warnings>1?'READY WITH MINOR ISSUES':'READY'
  return{gaps,warnings,overall}
}

app.get('/api/documents/assurance-summary',authenticate,async(req,res,next)=>{try{
  const organisation=isOrganisationScopeRole(req.user.role)
  const scopedIds=organisation?[]:await managedUserIds(req.user)
  const ids=scopedIds.length?scopedIds:[req.user.id]
  const params=organisation?[]:[ids]
  const scope=organisation?'TRUE':'(k.created_by=ANY($1::uuid[]) OR k.reviewer_id=ANY($1::uuid[]))'

  const records=(await query(`SELECT k.*,p.reader_scope protection_scope
    FROM knowledge_items k
    LEFT JOIN document_access_policies p ON p.knowledge_id=k.id
    WHERE ${scope}`,params)).rows

  const recordIds=records.map(r=>r.id)
  if(recordIds.length===0)return res.json({
    total:0,
    counts:{READY:0,'READY WITH MINOR ISSUES':0,'NEEDS REVISION':0,'SIGNIFICANT GAPS':0},
    items:[]
  })

  const [versions,relationships,activity]=await Promise.all([
    query(`SELECT knowledge_id,version_number FROM knowledge_versions WHERE knowledge_id=ANY($1::uuid[])`,[recordIds]),
    query(`SELECT knowledge_id,COUNT(*)::int count FROM repository_entity_links WHERE knowledge_id=ANY($1::uuid[]) GROUP BY knowledge_id`,[recordIds]),
    query(`SELECT entity_id::uuid knowledge_id,COUNT(*)::int count FROM audit_logs WHERE entity_type='knowledge' AND entity_id::uuid=ANY($1::uuid[]) GROUP BY entity_id`,[recordIds])
  ])

  const versionMap=new Map()
  for(const row of versions.rows){
    const list=versionMap.get(row.knowledge_id)||[]
    list.push(Number(row.version_number))
    versionMap.set(row.knowledge_id,list)
  }
  const relationshipMap=new Map(relationships.rows.map(r=>[r.knowledge_id,Number(r.count)]))
  const auditMap=new Map(activity.rows.map(r=>[r.knowledge_id,Number(r.count)]))

  const items=records.map(record=>{
    const outcome=repositoryAssuranceSummaryOutcome(
      record,
      (versionMap.get(record.id)||[]).includes(Number(record.current_version)),
      relationshipMap.get(record.id)||0,
      auditMap.get(record.id)||0
    )
    return{
      id:record.id,title:record.title,record_number:record.record_number,status:record.status,
      records_lifecycle_state:record.records_lifecycle_state,...outcome
    }
  })

  const counts={
    READY:items.filter(i=>i.overall==='READY').length,
    'READY WITH MINOR ISSUES':items.filter(i=>i.overall==='READY WITH MINOR ISSUES').length,
    'NEEDS REVISION':items.filter(i=>i.overall==='NEEDS REVISION').length,
    'SIGNIFICANT GAPS':items.filter(i=>i.overall==='SIGNIFICANT GAPS').length
  }
  res.json({total:items.length,counts,items})
}catch(error){next(error)}})

// APP2_REPOSITORY_RECORD_ASSURANCE_V2_6
app.get('/api/documents/:id/assurance',authenticate,async(req,res,next)=>{try{
  if(!await canReadKnowledge(req.user,req.params.id))
    return res.status(403).json({error:'You cannot read this record.'})

  const record=(await query(`SELECT k.*,u.name created_by_name,reviewer.name reviewer_name,
    p.reader_scope protection_scope,p.allow_download,p.allow_copy,p.allow_print,p.allow_link,p.watermark,
    s.name retention_schedule_name
    FROM knowledge_items k
    JOIN users u ON u.id=k.created_by
    LEFT JOIN users reviewer ON reviewer.id=k.reviewer_id
    LEFT JOIN document_access_policies p ON p.knowledge_id=k.id
    LEFT JOIN repository_retention_schedules s ON s.id=k.retention_schedule_id
    WHERE k.id=$1`,[req.params.id])).rows[0]
  if(!record)return res.status(404).json({error:'Record not found.'})

  const [versions,relationships,activity]=await Promise.all([
    query(`SELECT id,version_number,original_name,size_bytes,created_at
      FROM knowledge_versions WHERE knowledge_id=$1 ORDER BY version_number DESC`,[record.id]),
    query(`SELECT COUNT(*)::int count FROM repository_entity_links WHERE knowledge_id=$1`,[record.id]),
    query(`SELECT COUNT(*)::int count FROM audit_logs WHERE entity_type='knowledge' AND entity_id=$1`,[record.id])
  ])

  const versionRows=versions.rows
  const currentVersionExists=versionRows.some(row=>Number(row.version_number)===Number(record.current_version))
  const published=record.status==='Published'
  const restricted=['CONFIDENTIAL','RESTRICTED'].includes(String(record.classification||'').toUpperCase())
  const activeRecord=(record.records_lifecycle_state||'')==='Active Record'
  const reviewDate=record.next_review_at||record.review_due_at
  const hasReviewDate=Boolean(reviewDate)
  const reviewOverdue=Boolean(reviewDate)&&new Date(reviewDate).getTime()<Date.now()
  const hasExplicitProtection=Boolean(record.protection_scope)
  const hasRelationships=Number(relationships.rows[0]?.count||0)>0
  const hasAudit=Number(activity.rows[0]?.count||0)>0

  const checks=[
    {
      key:'record-number',area:'Identity',label:'Official record number',
      status:record.record_number?'PASS':'GAP',
      message:record.record_number?record.record_number:'No official record number has been assigned.',
      actionTab:'Overview'
    },
    {
      key:'classification',area:'Identity',label:'Record classification',
      status:(record.record_class&&record.document_type)?'PASS':'GAP',
      message:(record.record_class&&record.document_type)
        ?`${record.record_class} Â· ${record.document_type}`
        :'Record class or document purpose is incomplete.',
      actionTab:'Review & Retention'
    },
    {
      key:'reviewer',area:'Governance',label:'Reviewer',
      status:record.reviewer_id?'PASS':published?'WARNING':'GAP',
      message:record.reviewer_name||'No reviewer is assigned.',
      actionTab:'Review & Retention'
    },
    {
      key:'retention',area:'Governance',label:'Retention schedule',
      status:record.retention_schedule_id?'PASS':published?'GAP':'WARNING',
      message:record.retention_schedule_name||'No retention schedule is assigned.',
      actionTab:'Review & Retention'
    },
    {
      key:'review-date',area:'Governance',label:'Next governance review',
      status:reviewOverdue?'GAP':hasReviewDate?'PASS':published?'WARNING':'INFO',
      message:reviewOverdue
        ?'The governance review date is overdue.'
        :hasReviewDate
          ?`Next review: ${new Date(reviewDate).toLocaleDateString('en-KE')}`
          :'No governance review date is scheduled.',
      actionTab:'Review & Retention'
    },
    {
      key:'version-current',area:'Integrity',label:'Current version exists',
      status:currentVersionExists?'PASS':'GAP',
      message:currentVersionExists
        ?`Version ${record.current_version} is present in immutable version history.`
        :'The current-version pointer does not match a stored version.',
      actionTab:'Versions'
    },
    {
      key:'version-history',area:'Integrity',label:'Version history',
      status:versionRows.length>0?'PASS':'GAP',
      message:versionRows.length>0
        ?`${versionRows.length} stored version${versionRows.length===1?'':'s'}.`
        :'No immutable document version is stored.',
      actionTab:'Versions'
    },
    {
      key:'protection',area:'Protection',label:'Access policy',
      status:restricted&&!hasExplicitProtection?'GAP':hasExplicitProtection?'PASS':'INFO',
      message:hasExplicitProtection
        ?`${record.protection_scope} access policy is active.`
        :restricted
          ?'Restricted/confidential classification has no explicit access policy.'
          :'Inherited access policy is in use.',
      actionTab:'Protection'
    },
    {
      key:'traceability',area:'Traceability',label:'Audit trail',
      status:hasAudit?'PASS':'WARNING',
      message:hasAudit
        ?`${activity.rows[0].count} repository audit event${Number(activity.rows[0].count)===1?'':'s'} recorded.`
        :'No repository audit activity is recorded yet.',
      actionTab:'Audit'
    },
    {
      key:'relationships',area:'Traceability',label:'Institutional relationships',
      status:hasRelationships?'PASS':activeRecord?'WARNING':'INFO',
      message:hasRelationships
        ?`${relationships.rows[0].count} linked institutional relationship${Number(relationships.rows[0].count)===1?'':'s'}.`
        :'No Assignment, Task, Research or Report relationship is recorded.',
      actionTab:'Relationships'
    },
    {
      key:'felix',area:'Knowledge',label:'Felix indexing',
      status:published
        ?record.felix_index_status==='Completed'?'PASS':record.felix_enabled?'WARNING':'INFO'
        :'INFO',
      message:published
        ?record.felix_index_status==='Completed'
          ?'Published record is indexed for Felix.'
          :record.felix_enabled
            ?`Felix indexing status: ${record.felix_index_status||'Pending'}.`
            :'Felix indexing is disabled for this record.'
        :'Felix indexing is evaluated after publication.',
      actionTab:'Felix'
    }
  ]

  const gaps=checks.filter(check=>check.status==='GAP').length
  const warnings=checks.filter(check=>check.status==='WARNING').length
  const overall=gaps>=3?'SIGNIFICANT GAPS'
    :gaps>0?'NEEDS REVISION'
    :warnings>1?'READY WITH MINOR ISSUES'
    :'READY'

  res.json({
    recordId:record.id,
    overall,
    gaps,
    warnings,
    checkedAt:new Date().toISOString(),
    checks
  })
}catch(error){next(error)}})

app.get('/api/documents/:id/detail',authenticate,async(req,res,next)=>{try{
  if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot read this record.'})
  const record=(await query(`SELECT k.*,u.name created_by_name,reviewer.name reviewer_name,approver.name approved_by_name,
    s.name retention_schedule_name,s.review_interval_months,s.retention_years,s.disposition_action schedule_disposition_action
    FROM knowledge_items k JOIN users u ON u.id=k.created_by
    LEFT JOIN users reviewer ON reviewer.id=k.reviewer_id
    LEFT JOIN users approver ON approver.id=k.approved_by
    LEFT JOIN repository_retention_schedules s ON s.id=k.retention_schedule_id
    WHERE k.id=$1`,[req.params.id])).rows[0]
  if(!record)return res.status(404).json({error:'Record not found.'})
  const [versions,relationships,activity,improvements,protection]=await Promise.all([
    query(`SELECT id,version_number,original_name,mime_type,size_bytes,notes,created_at
      FROM knowledge_versions WHERE knowledge_id=$1 ORDER BY version_number DESC`,[record.id]),
    query(`SELECT rel.*,${repositoryTargetTitleSql} entity_title,v.version_number pinned_version_number,u.name linked_by_name
      FROM repository_entity_links rel LEFT JOIN knowledge_versions v ON v.id=rel.pinned_version_id
      JOIN users u ON u.id=rel.linked_by WHERE rel.knowledge_id=$1 ORDER BY rel.created_at DESC`,[record.id]),
    query(`SELECT l.id,l.action,l.details,l.created_at,COALESCE(u.name,'System / Unknown') user_name
      FROM audit_logs l LEFT JOIN users u ON u.id=l.user_id
      WHERE l.entity_type='knowledge' AND l.entity_id=$1 ORDER BY l.created_at DESC LIMIT 100`,[record.id]),
    query(`SELECT i.*,a.name assignee_name,r.name reviewer_name FROM document_improvement_assignments i
      JOIN users a ON a.id=i.assignee_id JOIN users r ON r.id=i.reviewer_id
      WHERE i.knowledge_id=$1 ORDER BY i.created_at DESC`,[record.id]),
    query('SELECT * FROM document_access_policies WHERE knowledge_id=$1',[record.id])
  ])
  res.json({record,versions:versions.rows,relationships:relationships.rows,activity:activity.rows,improvements:improvements.rows,protection:protection.rows[0]||null})
}catch(error){next(error)}})

app.get('/api/documents/:id/felix-record-context',authenticate,async(req,res,next)=>{try{
  if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot read this record.'})
  const item=(await query(`SELECT id,title,status,record_number,current_version,records_lifecycle_state,superseded_by,next_review_at,review_due_at
    FROM knowledge_items WHERE id=$1`,[req.params.id])).rows[0]
  if(!item)return res.status(404).json({error:'Record not found.'})
  const replacement=item.superseded_by?(await query('SELECT id,title,record_number,current_version,status FROM knowledge_items WHERE id=$1',[item.superseded_by])).rows[0]:null
  const related=(await query(`SELECT rel.relationship_type,rel.entity_type,${repositoryTargetTitleSql} entity_title,v.version_number pinned_version_number
    FROM repository_entity_links rel LEFT JOIN knowledge_versions v ON v.id=rel.pinned_version_id
    WHERE rel.knowledge_id=$1 ORDER BY rel.created_at DESC LIMIT 20`,[item.id])).rows
  const warnings=[]
  if(item.records_lifecycle_state==='Superseded'||item.status==='Archived')warnings.push('This record is not the current active record.')
  if(replacement)warnings.push(`A newer record supersedes this item: ${replacement.record_number||replacement.title}.`)
  const reviewDate=item.next_review_at||item.review_due_at
  if(reviewDate&&new Date(reviewDate).getTime()<Date.now())warnings.push('This record is overdue for governance review.')
  res.json({authoritative:item.status==='Published'&&item.records_lifecycle_state!=='Superseded',currentVersion:item.current_version,
    recordNumber:item.record_number,lifecycle:item.records_lifecycle_state,replacement,warnings,relationships:related})
}catch(error){next(error)}})

app.get('/api/health',async(_req,res,next)=>{try{await query('SELECT 1');res.setHeader('Cache-Control','no-store');res.json({status:'healthy',service:'psc-app2-api',database:'connected',capabilities:{pscTaskReportPdf:true,pdfErrorDiagnostics:'v4'}})}catch(error){next(error)}})
registerReportRoutes(app,{validate,governedDate})
registerLeaveManagementRoutes(app,{authenticate,validate})
app.get('/api/auth/login-directory',async(_req,res,next)=>{try{if(!config.exposeLoginDirectory)return res.json([]);res.set('Cache-Control','no-store');res.json((await query('SELECT name,email,role FROM users WHERE active=TRUE ORDER BY name,email')).rows)}catch(error){next(error)}})
app.post('/api/auth/login',validate(loginSchema),async(req,res,next)=>{try{const result=await query(`SELECT u.id,u.name,u.email,u.password_hash,u.role,u.division,u.status,u.active,u.token_version,u.must_change_password,u.supervisor_id,
  supervisor.name supervisor_name,supervisor.role supervisor_role
  FROM users u LEFT JOIN users supervisor ON supervisor.id=u.supervisor_id
  WHERE lower(u.email)=lower($1)`,[req.validated.email]);const user=result.rows[0];if(!user||!user.active||!await bcrypt.compare(req.validated.password,user.password_hash)){await query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)VALUES($1,'LOGIN_FAILED','session',$2,$3)",[user?.id||null,user?.id||null,JSON.stringify({email:req.validated.email})]);return res.status(401).json({error:'Login unsuccessful. Verify your official PSC email and password. If the problem continues, recover your password or ask an administrator to confirm that your account is active.'})}delete user.password_hash;await query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)VALUES($1::uuid,'LOGIN_SUCCEEDED','session',$1::uuid::text,$2)",[user.id,JSON.stringify({email:user.email,role:user.role})]);res.json({token:createToken(user),user})}catch(error){next(error)}})
app.get('/api/auth/me',authenticate,(req,res)=>res.json(req.user))
app.post('/api/auth/logout',authenticate,async(req,res,next)=>{try{await transaction(async client=>{await client.query('UPDATE users SET token_version=token_version+1,updated_at=NOW() WHERE id=$1',[req.user.id]);await audit(client,req.user.id,'LOGOUT','session',req.user.id,{})});res.status(204).end()}catch(error){next(error)}})
app.post('/api/auth/change-password',authenticate,validate(z.object({currentPassword:z.string().min(8).max(128),newPassword:passwordSchema})),async(req,res,next)=>{try{const current=(await query('SELECT password_hash FROM users WHERE id=$1',[req.user.id])).rows[0];if(!current||!await bcrypt.compare(req.validated.currentPassword,current.password_hash))return res.status(400).json({error:'The current password is incorrect.'});if(await bcrypt.compare(req.validated.newPassword,current.password_hash))return res.status(400).json({error:'Choose a password different from the current password.'});const hash=await bcrypt.hash(req.validated.newPassword,12);const updated=(await query('UPDATE users SET password_hash=$1,must_change_password=FALSE,token_version=token_version+1,updated_at=NOW() WHERE id=$2 RETURNING id,name,email,role,division,status,token_version,must_change_password',[hash,req.user.id])).rows[0];res.json({token:createToken(updated),user:updated})}catch(error){next(error)}})
app.post('/api/auth/forgot-password',passwordResetRateLimit,validate(z.object({email:z.string().email().max(255)})),async(req,res,next)=>{try{
  const user=(await query('SELECT id,name,email FROM users WHERE lower(email)=lower($1) AND active=TRUE',[req.validated.email])).rows[0]
  if(user){
    try{
      await passwordLinkService.sendPasswordLink(user,{purpose:'reset'})
    }catch(error){
      console.error('PASSWORD_RESET_EMAIL_FAILED',{code:error?.code||'EMAIL_DELIVERY_FAILED'})
    }
  }
  res.set('Cache-Control','no-store')
  res.json({message:'If an active account matches that email address, password reset instructions will be sent to its registered email address.'})
}catch(error){next(error)}})
app.post('/api/auth/reset-password',passwordResetRateLimit,validate(z.object({token:z.string().length(64),newPassword:passwordSchema})),async(req,res,next)=>{try{
  const tokenHash=crypto.createHash('sha256').update(req.validated.token).digest('hex')
  const result=await transaction(async client=>{
    const reset=(await client.query('SELECT t.id,t.user_id FROM password_reset_tokens t JOIN users u ON u.id=t.user_id AND u.active=TRUE WHERE t.token_hash=$1 AND t.used_at IS NULL AND t.expires_at>NOW() FOR UPDATE OF t',[tokenHash])).rows[0]
    if(!reset)return null
    const hash=await bcrypt.hash(req.validated.newPassword,12)
    await client.query('UPDATE users SET password_hash=$1,must_change_password=FALSE,token_version=token_version+1,updated_at=NOW() WHERE id=$2',[hash,reset.user_id])
    await client.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL',[reset.user_id])
    await audit(client,reset.user_id,'PASSWORD_RESET_COMPLETED','user',reset.user_id,{})
    return true
  })
  if(!result)return res.status(400).json({error:'This password reset link is invalid or has expired.'})
  res.json({message:'Password updated successfully. You can now sign in.'})
}catch(error){next(error)}})



const supervisorRoleFor={"Deputy Director":"Director","Assistant Director":"Deputy Director","Researcher":"Assistant Director"}
const validateSupervisor=async(client,role,supervisorId,userId=null)=>{const required=supervisorRoleFor[role];if(!required){if(supervisorId)throw Object.assign(new Error(`${role} does not use this reporting tier.`),{statusCode:400});return null}if(!supervisorId)throw Object.assign(new Error(`${role} must report to an active ${required}.`),{statusCode:400});if(supervisorId===userId)throw Object.assign(new Error('A user cannot report to themselves.'),{statusCode:400});const supervisor=(await client.query('SELECT id,name,role,active FROM users WHERE id=$1',[supervisorId])).rows[0];if(!supervisor||!supervisor.active||supervisor.role!==required)throw Object.assign(new Error(`${role} must report to an active ${required}.`),{statusCode:400});return supervisor}
app.get('/api/users',authenticate,authorize('System Admin','Director','Deputy Director','Deputy Director','Assistant Director'),async(req,res,next)=>{try{const scoped=await managedUserIds(req.user),all=scoped===null,ids=scoped||[req.user.id];const result=await query(`SELECT u.id,u.name,u.email,u.role,u.division,u.status,u.active,u.supervisor_id,s.name supervisor_name,s.role supervisor_role,
current_leave.leave_type_name,current_leave.start_date leave_start_date,current_leave.end_date leave_end_date,
CASE WHEN current_leave.id IS NOT NULL THEN 'On Leave' ELSE u.status END availability_status,
COUNT(am.assignment_id) FILTER(WHERE a.status!='Completed')::int active_assignments,COUNT(am.assignment_id) FILTER(WHERE a.status='Completed')::int completed_assignments
FROM users u LEFT JOIN users s ON s.id=u.supervisor_id
LEFT JOIN LATERAL(SELECT lr.id,lr.start_date,lr.end_date,lt.name leave_type_name FROM leave_requests lr JOIN leave_types lt ON lt.code=lr.leave_type_code
 WHERE lr.user_id=u.id AND lr.status='Approved' AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date ORDER BY lr.start_date LIMIT 1) current_leave ON TRUE
LEFT JOIN assignment_members am ON am.user_id=u.id LEFT JOIN assignments a ON a.id=am.assignment_id
WHERE $1::boolean OR u.id=ANY($2::uuid[]) GROUP BY u.id,s.id,current_leave.id,current_leave.leave_type_name,current_leave.start_date,current_leave.end_date ORDER BY CASE u.role WHEN 'Director' THEN 1 WHEN 'Deputy Director' THEN 2 WHEN 'Assistant Director' THEN 3 WHEN 'Researcher' THEN 4 ELSE 5 END,u.name`,[all,ids]);res.json(result.rows)}catch(error){next(error)}})
app.post('/api/users',authenticate,authorize('System Admin'),validate(z.object({name:z.string().min(3).max(160),email:z.string().email().max(255),role:z.enum(roles),division:z.string().min(2).max(160),supervisorId:z.string().uuid().nullable().default(null)})),async(req,res,next)=>{try{
  const initialPasswordHash=await bcrypt.hash(crypto.randomBytes(48).toString('hex'),12)
  const created=await transaction(async client=>{
    const supervisor=await validateSupervisor(client,req.validated.role,req.validated.supervisorId)
    const row=(await client.query('INSERT INTO users(name,email,password_hash,role,division,supervisor_id,must_change_password) VALUES($1,lower($2),$3,$4,$5,$6,TRUE) RETURNING id,name,email,role,division,supervisor_id,status,active,must_change_password',[req.validated.name.trim(),req.validated.email.trim(),initialPasswordHash,req.validated.role,req.validated.division.trim(),supervisor?.id||null])).rows[0]
    await audit(client,req.user.id,'USER_CREATED','user',row.id,{email:row.email,role:row.role,division:row.division,supervisorId:row.supervisor_id})
    return row
  })
  let setupEmailSent=false
  try{
    await passwordLinkService.sendPasswordLink(created,{purpose:'setup'})
    setupEmailSent=true
    await transaction(client=>audit(client,req.user.id,'USER_SETUP_LINK_SENT','user',created.id,{email:created.email}))
  }catch(error){
    console.error('USER_SETUP_EMAIL_FAILED',{userId:created.id,code:error?.code||'EMAIL_DELIVERY_FAILED'})
  }
  res.status(201).json({...created,setup_email_sent:setupEmailSent})
}catch(error){if(error.code==='23505')return res.status(409).json({error:'An account already exists for this email address.'});next(error)}})

app.patch('/api/users/:id',authenticate,authorize('System Admin','Director','Deputy Director','Assistant Director'),validate(z.object({name:z.string().min(3).max(160),email:z.string().email().max(255),role:z.enum(roles),division:z.string().min(2).max(160),supervisorId:z.string().uuid().nullable().default(null),status:z.enum(['Available','Busy','Away']),active:z.boolean()})),async(req,res,next)=>{try{
if(!await canManageUser(req.user,req.params.id))return res.status(403).json({error:'You may edit only users inside your authorised reporting scope.'})
const updated=await transaction(async client=>{
 const current=(await client.query('SELECT id,role,active,supervisor_id FROM users WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]
 if(!current)return {kind:'missing'}
 const admin=req.user.role==='System Admin'
 if(!admin&&current.role==='System Admin')return {kind:'protected'}
 const nextRole=admin?req.validated.role:current.role,nextSupervisor=admin?req.validated.supervisorId:current.supervisor_id,nextActive=admin?req.validated.active:current.active
 if(current.role==='System Admin'&&(nextRole!=='System Admin'||!nextActive)){const count=Number((await client.query("SELECT COUNT(*) total FROM users WHERE role='System Admin' AND active=TRUE")).rows[0].total);if(count<=1)return {kind:'last-admin'}}
 const supervisor=admin?await validateSupervisor(client,nextRole,nextSupervisor,req.params.id):null
 const row=(await client.query(`UPDATE users SET name=$1,email=lower($2),role=$3,division=$4,supervisor_id=$5,status=$6,active=$7,
 token_version=CASE WHEN active<>$7 THEN token_version+1 ELSE token_version END,updated_at=NOW() WHERE id=$8
 RETURNING id,name,email,role,division,supervisor_id,status,active,must_change_password`,
 [req.validated.name.trim(),req.validated.email.trim(),nextRole,req.validated.division.trim(),admin?(supervisor?.id||null):current.supervisor_id,req.validated.status,nextActive,req.params.id])).rows[0]
 await audit(client,req.user.id,'USER_UPDATED','user',row.id,{managerScoped:!admin,role:row.role,division:row.division,status:row.status,active:row.active})
 return {kind:'updated',row}
})
if(updated.kind==='missing')return res.status(404).json({error:'Member not found.'})
if(updated.kind==='protected')return res.status(403).json({error:'System Administrator accounts can only be edited by a System Administrator.'})
if(updated.kind==='last-admin')return res.status(409).json({error:'The final active administrator cannot be demoted or deactivated.'})
res.json(updated.row)
}catch(error){if(error.code==='23505')return res.status(409).json({error:'That email address is already in use.'});next(error)}})
app.patch('/api/users/:id/role',authenticate,authorize('System Admin'),validate(z.object({role:z.enum(roles)})),async(req,res,next)=>{try{const updated=await transaction(async client=>{const current=(await client.query('SELECT role FROM users WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!current)return {kind:'missing'};if(current.role==='System Admin'&&req.validated.role!=='System Admin'){const count=Number((await client.query("SELECT COUNT(*) total FROM users WHERE role='System Admin' AND active=TRUE")).rows[0].total);if(count<=1)return {kind:'last-admin'}}const row=(await client.query('UPDATE users SET role=$1,updated_at=NOW() WHERE id=$2 RETURNING id,name,email,role,division,status,active',[req.validated.role,req.params.id])).rows[0];await audit(client,req.user.id,'ROLE_CHANGED','user',req.params.id,req.validated);return {kind:'updated',row}});if(updated.kind==='missing')return res.status(404).json({error:'Member not found.'});if(updated.kind==='last-admin')return res.status(409).json({error:'The final active administrator cannot be demoted.'});res.json(updated.row)}catch(error){next(error)}})
app.post('/api/users/:id/reset-password',authenticate,authorize('System Admin','Director','Deputy Director','Assistant Director'),validate(z.object({purpose:z.enum(['reset','setup']).default('reset')})),async(req,res,next)=>{try{
  if(!await canManageUser(req.user,req.params.id))return res.status(403).json({error:'You may reset passwords only for users inside your authorised reporting scope.'})
  const target=(await query('SELECT id,name,email,role FROM users WHERE id=$1 AND active=TRUE',[req.params.id])).rows[0]
  if(!target)return res.status(404).json({error:'Active member not found.'})
  if(target.id===req.user.id)return res.status(409).json({error:'Use Change Password for your own account.'})
  if(target.role==='System Admin'&&req.user.role!=='System Admin')return res.status(403).json({error:'Only a System Administrator can reset another System Administrator account.'})
  await transaction(async client=>{
    await client.query('UPDATE users SET must_change_password=TRUE,token_version=token_version+1,updated_at=NOW() WHERE id=$1',[target.id])
    const action=req.validated.purpose==='setup'?'USER_PASSWORD_SETUP_REQUESTED':'USER_PASSWORD_RESET_REQUESTED'
    await audit(client,req.user.id,action,'user',target.id,{managerScoped:req.user.role!=='System Admin'})
  })
  await passwordLinkService.sendPasswordLink(target,{purpose:req.validated.purpose})
  const message=req.validated.purpose==='setup'
    ? 'A secure account setup link was accepted by the email server. The user should check their inbox and spam folder.'
    : 'A secure password reset link was accepted by the email server. The user should check their inbox and spam folder. Existing sessions were ended.'
  res.json({message,email:target.email,expiresInMinutes:30})
}catch(error){
  if(error?.code==='PASSWORD_LINK_DELIVERY_FAILED'||error?.code==='EMAIL_TRANSPORT_FAILED'||error?.statusCode===503){
    return res.status(502).json({error:'The password link could not be emailed. Check the email configuration and try again.'})
  }
  next(error)
}})


app.get('/api/assignments',authenticate,async(req,res,next)=>{try{const scoped=isManagementRole(req.user.role)?await managedUserIds(req.user):[req.user.id],all=scoped===null,scopeIds=scoped||[req.user.id];const result=await query(`SELECT a.*,creator.name created_by_name,ral.project_id research_id,rp.title research_title,ral.relation_type research_relation_type,
COALESCE(json_agg(json_build_object('id',u.id,'name',u.name,'role',am.member_role,
  'supervisor_id',u.supervisor_id,'supervisor_name',member_supervisor.name,'supervisor_role',member_supervisor.role)
  ORDER BY CASE WHEN am.member_role='Lead' THEN 0 ELSE 1 END,am.assigned_at,u.name) FILTER(WHERE u.id IS NOT NULL),'[]') members,
COALESCE(task_state.total_tasks,0)::int task_count,
COALESCE(task_state.completed_tasks,0)::int completed_task_count,
COALESCE(task_state.accepted_reports,0)::int accepted_task_report_count,
final_report.status final_report_status,
CASE
  WHEN COALESCE(task_state.total_tasks,0)=0 AND final_report.id IS NULL THEN 'Ready for Final Report'
  WHEN COALESCE(task_state.completed_tasks,0)<COALESCE(task_state.total_tasks,0) THEN 'In Progress'
  WHEN COALESCE(task_state.accepted_reports,0)<COALESCE(task_state.total_tasks,0) THEN 'Task Reporting'
  WHEN final_report.id IS NULL THEN 'Ready for Final Report'
  WHEN final_report.status='Changes Requested' THEN 'Changes Requested'
  WHEN final_report.status IN('Submitted','Under Review') THEN 'Final Report Review'
  WHEN final_report.status='Approved' THEN 'Approved Â· Finalization Pending'
  WHEN final_report.status='Final' THEN 'Completed'
  ELSE 'Final Report Draft'
END workflow_status
FROM assignments a
JOIN users creator ON creator.id=a.created_by
LEFT JOIN assignment_members am ON am.assignment_id=a.id
LEFT JOIN users u ON u.id=am.user_id
LEFT JOIN users member_supervisor ON member_supervisor.id=u.supervisor_id
LEFT JOIN research_assignment_links ral ON ral.assignment_id=a.id
LEFT JOIN research_projects rp ON rp.id=ral.project_id
LEFT JOIN LATERAL(
  SELECT
    COUNT(*) FILTER(WHERE t.archived_at IS NULL)::int total_tasks,
    COUNT(*) FILTER(WHERE t.archived_at IS NULL AND t.status='Completed')::int completed_tasks,
    COUNT(*) FILTER(WHERE t.archived_at IS NULL AND t.contribution_status='Accepted')::int accepted_reports
  FROM assignment_tasks t
  WHERE t.assignment_id=a.id
) task_state ON TRUE
LEFT JOIN LATERAL(
  SELECT gd.id,gd.status
  FROM generated_documents gd
  JOIN document_templates dt ON dt.id=gd.template_id
  WHERE gd.context='Assignment'
    AND gd.context_id=a.id
    AND dt.template_key='assignment-final-report'
  ORDER BY gd.updated_at DESC,gd.created_at DESC
  LIMIT 1
) final_report ON TRUE
WHERE $1::boolean OR a.created_by=ANY($2::uuid[]) OR EXISTS(SELECT 1 FROM assignment_members mine WHERE mine.assignment_id=a.id AND mine.user_id=ANY($2::uuid[])) OR EXISTS(SELECT 1 FROM assignment_tasks st WHERE st.assignment_id=a.id AND(st.owner_id=ANY($2::uuid[]) OR st.reviewer_id=ANY($2::uuid[])))
GROUP BY a.id,creator.name,ral.project_id,rp.title,ral.relation_type,task_state.total_tasks,task_state.completed_tasks,task_state.accepted_reports,final_report.id,final_report.status
ORDER BY a.created_at DESC`,[all,scopeIds]);res.json(result.rows)}catch(error){next(error)}})
app.post('/api/assignments',authenticate,authorize('System Admin','Director','Deputy Director','Deputy Director','Assistant Director'),validate(assignmentSchema),async(req,res,next)=>{try{const {title,description,objective,scope,instructions,expectedOutput,division,startDate,dueDate,priority}=req.validated;const requestedMembers=[...new Set(req.validated.memberIds)];const leadId=req.validated.leadId||requestedMembers[0]||null;const memberIds=leadId?[leadId,...requestedMembers.filter(id=>id!==leadId)]:requestedMembers;if(memberIds.length&&startDate&&dueDate){for(const memberId of memberIds){const leave=await userApprovedLeaveConflict(memberId,startDate,dueDate);if(leave)return res.status(409).json({error:`${leave.leave_type_name} is approved for a selected team member from ${leave.start_date.toISOString().slice(0,10)} to ${leave.end_date.toISOString().slice(0,10)}. Reassign the work period or choose another available team member.`})}}if(isTeamScopeRole(req.user.role)){const allowed=await managedUserIds(req.user);if(memberIds.some(id=>!allowed.includes(id)))return res.status(403).json({error:'You may allocate assignments only within your reporting subtree.'})}const created=await transaction(async client=>{if(memberIds.length){const activeMembers=Number((await client.query('SELECT COUNT(*)::int total FROM users WHERE id=ANY($1::uuid[]) AND active=TRUE',[memberIds])).rows[0].total);if(activeMembers!==memberIds.length)throw Object.assign(new Error('Choose only active APP2 users for the assignment team.'),{statusCode:400})}const result=await client.query('INSERT INTO assignments(title,description,objective,scope,instructions,expected_output,division,start_date,due_date,priority,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',[title,description,objective,scope,instructions,expectedOutput,division,startDate||null,dueDate||null,priority,req.user.id]);for(const id of memberIds)await client.query('INSERT INTO assignment_members(assignment_id,user_id,member_role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[result.rows[0].id,id,id===leadId?'Lead':'Contributor']);if(memberIds.length)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT id,CASE WHEN id=$4::uuid THEN 'You are leading a new assignment' ELSE 'New assignment' END,$1,'assignment',$2 FROM users WHERE id=ANY($3::uuid[]) AND active=TRUE",[`You have been assigned to Ã¢â‚¬Å“${title}Ã¢â‚¬Â${dueDate?` due ${dueDate}`:''}.${leadId?' The accountable lead is identified in the Assignment Overview.':''}`,result.rows[0].id,memberIds,leadId]);await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details) VALUES($1,$2,$3,$4)',[result.rows[0].id,req.user.id,'CREATED',JSON.stringify({title,memberIds,leadId,directAssignment:memberIds.length===0})]);await audit(client,req.user.id,'ASSIGNMENT_CREATED','assignment',result.rows[0].id,{title,memberIds,leadId,directAssignment:memberIds.length===0});
const repositorySyncJobId=await enqueueRepositorySyncJob(client,{jobKind:'assignment_draft',entityId:result.rows[0].id,parentId:null,actor:req.user});
return {...result.rows[0],repository_sync_job_id:repositorySyncJobId,repository_sync_status:repositorySyncJobId?'pending':'unavailable'}});const repositorySync=await runAndReadRepositorySync(created.repository_sync_job_id);res.status(201).json({...created,...repositorySync})}catch(error){next(error)}})
app.use('/api/assignments/:id',authenticate,async(req,res,next)=>{
  try{
    if(!['POST','PATCH','PUT','DELETE'].includes(req.method))return next()
    const url=req.originalUrl||''
    const governedDecision=/\/tasks\/[^/]+\/(?:contribution-preview|contribution-review|contribution-finalize)(?:\?|$)/.test(url)
    const taskMatch=url.match(/\/tasks\/([0-9a-f-]{36})(?:\/|\?|$)/i)
    if(taskMatch&&!governedDecision){
      const state=await taskWorkspaceLockState(req.params.id,taskMatch[1])
      if(state.locked)return lockedWorkspaceResponse(res,{
        domain:'Task',status:state.task.contribution_status,version:Number(state.task.contribution_report_version||0)||null,
        reviewer:state.task.reviewer_name||null,
        message:`This Task workspace is read-only while its report is ${state.task.contribution_status}. Editing reopens only after an authorised reviewer requests changes.`
      })
    }
    if(governedDecision)return next()
    const state=await assignmentWorkspaceLockState(req.params.id)
    if(!state.locked)return next()
    return lockedWorkspaceResponse(res,{
      domain:'Assignment',status:state.report?.status||state.assignment?.status||'Completed',version:state.report?.version||null,
      reviewer:state.report?.reviewer_name||null,
      message:`This Assignment workspace is read-only while its final report is ${state.report?.status||state.assignment?.status||'Completed'}.`
    })
  }catch(error){next(error)}
})
app.patch('/api/assignments/:id',authenticate,authorize('System Admin','Director','Deputy Director','Deputy Director','Assistant Director'),validate(assignmentUpdateSchema),async(req,res,next)=>{try{if(!await canManageAssignment(req.user,req.params.id))return res.status(403).json({error:'This assignment is outside your authorised reporting scope.'});const {title,description,objective,scope,instructions,expectedOutput,division,startDate,dueDate,priority}=req.validated;const result=await transaction(async client=>{const updated=(await client.query('UPDATE assignments SET title=$1,description=$2,objective=$3,scope=$4,instructions=$5,expected_output=$6,division=$7,start_date=$8,due_date=$9,priority=$10,updated_at=NOW() WHERE id=$11 RETURNING *',[title,description,objective,scope,instructions,expectedOutput,division,startDate||null,dueDate||null,priority,req.params.id])).rows[0];if(updated){
  await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details) VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'UPDATED',JSON.stringify({title,division,startDate,dueDate,priority})])
  const repositorySyncJobId=await enqueueRepositorySyncJob(client,{jobKind:'assignment_draft',entityId:updated.id,parentId:null,actor:req.user});
  return {...updated,repository_sync_job_id:repositorySyncJobId,repository_sync_status:repositorySyncJobId?'pending':'unavailable'}
}
return updated});if(!result)return res.status(404).json({error:'Assignment not found.'});const repositorySync=await runAndReadRepositorySync(result.repository_sync_job_id);res.json({...result,...repositorySync})}catch(error){next(error)}})
app.delete('/api/assignments/:id',authenticate,authorize('System Admin','Deputy Director','Assistant Director'),async(req,res,next)=>{try{if(!await canManageAssignment(req.user,req.params.id))return res.status(403).json({error:'This assignment is outside your authorised reporting scope.'});const files=(await query('SELECT stored_name FROM assignment_attachments WHERE assignment_id=$1',[req.params.id])).rows;const result=await query('DELETE FROM assignments WHERE id=$1 RETURNING id',[req.params.id]);if(!result.rowCount)return res.status(404).json({error:'Assignment not found.'});await Promise.all(files.map(file=>fs.unlink(path.resolve(config.uploadDir,file.stored_name)).catch(()=>{})));res.status(204).end()}catch(error){next(error)}})
app.patch('/api/assignments/:id/status',authenticate,validate(z.object({status:z.enum(['Not Started','In Progress','Ready for Review','Completed','Overdue'])})),async(req,res,next)=>{try{if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You are not assigned to this work.'});if(req.validated.status==='Completed'&&!(isManagementRole(req.user.role)||await isAssignmentContextReviewer(req.params.id,req.user.id)))return res.status(403).json({error:'Only a reviewer or manager can approve completed work.'});const result=await transaction(async client=>{const updated=(await client.query('UPDATE assignments SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',[req.validated.status,req.params.id])).rows[0];if(updated)await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details) VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,req.validated.status==='Completed'?'APPROVED':'STATUS_CHANGED',JSON.stringify({status:req.validated.status})]);if(updated&&req.validated.status==='Completed')await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT DISTINCT user_id,'Assignment completed',$1,'assignment_completed',$2 FROM assignment_members WHERE assignment_id=$2",[`Ã¢â‚¬Å“${updated.title}Ã¢â‚¬Â has been marked completed.`,updated.id]);return updated});if(!result)return res.status(404).json({error:'Assignment not found.'});res.json(result)}catch(error){next(error)}})
app.post('/api/assignments/:id/members',authenticate,authorize('System Admin','Deputy Director','Assistant Director'),validate(z.object({userId:z.string().uuid(),memberRole:z.enum(['Lead','Contributor','Reviewer']).default('Contributor')})),async(req,res,next)=>{try{if(!await canManageAssignment(req.user,req.params.id))return res.status(403).json({error:'This assignment is outside your authorised reporting scope.'});if(isTeamScopeRole(req.user.role)){const allowed=await managedUserIds(req.user);if(!allowed.includes(req.validated.userId))return res.status(403).json({error:'You may add only members from your reporting subtree.'})}await transaction(async client=>{if(req.validated.memberRole==='Lead')await client.query("UPDATE assignment_members SET member_role='Contributor' WHERE assignment_id=$1 AND member_role='Lead' AND user_id<>$2",[req.params.id,req.validated.userId]);await client.query('INSERT INTO assignment_members(assignment_id,user_id,member_role) VALUES($1,$2,$3) ON CONFLICT(assignment_id,user_id) DO UPDATE SET member_role=EXCLUDED.member_role',[req.params.id,req.validated.userId,req.validated.memberRole]);const assignment=(await client.query('SELECT title,due_date FROM assignments WHERE id=$1',[req.params.id])).rows[0];if(assignment)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'Assignment allocated',$2,'assignment',$3)",[req.validated.userId,`You were added to Ã¢â‚¬Å“${assignment.title}Ã¢â‚¬Â as ${req.validated.memberRole}${assignment.due_date?` (due ${assignment.due_date})`:''}.`,req.params.id]);await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details) VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'MEMBER_ASSIGNED',JSON.stringify(req.validated)])});res.status(204).end()}catch(error){next(error)}})
app.get('/api/assignments/:id/member-requests',authenticate,async(req,res,next)=>{try{
  if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot view team-member requests for this assignment.'})
  const rows=(await query(`SELECT r.*,requester.name requested_by_name,requested.name requested_user_name,requested.role requested_user_role,
      requested.division requested_user_division,reviewer.name reviewed_by_name
    FROM assignment_member_requests r
    JOIN users requester ON requester.id=r.requested_by
    JOIN users requested ON requested.id=r.requested_user_id
    LEFT JOIN users reviewer ON reviewer.id=r.reviewed_by
    WHERE r.assignment_id=$1
    ORDER BY CASE WHEN r.status='Pending' THEN 0 ELSE 1 END,r.created_at DESC`,[req.params.id])).rows
  res.json(rows)
}catch(error){next(error)}})
app.post('/api/assignments/:id/member-requests',authenticate,validate(assignmentMemberRequestSchema),async(req,res,next)=>{try{
  const lead=(await query("SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2 AND member_role='Lead'",[req.params.id,req.user.id])).rowCount
  if(!lead)return res.status(403).json({error:'Only the Assignment Lead may request an additional team member.'})
  const candidate=(await query("SELECT id,name,role FROM users WHERE id=$1 AND active=TRUE AND role<>'System Admin'",[req.validated.userId])).rows[0]
  if(!candidate)return res.status(400).json({error:'Choose an active APP2 team member.'})
  if((await query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[req.params.id,candidate.id])).rowCount)return res.status(409).json({error:'This person already belongs to the assignment team.'})
  const supervisor=await immediateSupervisorForUser(req.user.id)
  if(!supervisor)return res.status(409).json({error:'Assign an immediate supervisor to the Assignment Lead before requesting another team member.'})
  const oversightManagerIds=await reportingOversightManagerIds(req.user.id)
  const created=await transaction(async client=>{
    const assignment=(await client.query('SELECT title FROM assignments WHERE id=$1',[req.params.id])).rows[0]
    if(!assignment)throw Object.assign(new Error('Assignment not found.'),{statusCode:404})
    const row=(await client.query(`INSERT INTO assignment_member_requests(assignment_id,requested_by,requested_user_id,reason)
      VALUES($1,$2,$3,$4) RETURNING *`,[req.params.id,req.user.id,candidate.id,req.validated.reason])).rows[0]
    const requestNotificationBody=`${req.user.name} requested ${candidate.name} (${candidate.role}) for â€œ${assignment.title}â€.`
    await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'Assignment team request awaiting approval',$2,'assignment_member_request',$3)",[supervisor.id,requestNotificationBody,row.id])
    for(const managerId of oversightManagerIds){if(managerId===supervisor.id)continue;await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'Assignment team request awaiting approval',$2,'assignment_member_request',$3)",[managerId,requestNotificationBody,row.id])}
    await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details) VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'MEMBER_REQUESTED',JSON.stringify({requestId:row.id,userId:candidate.id,name:candidate.name,reason:req.validated.reason})])
    await audit(client,req.user.id,'ASSIGNMENT_MEMBER_REQUESTED','assignment_member_request',row.id,{assignmentId:req.params.id,userId:candidate.id})
    return {...row,requested_user_name:candidate.name,requested_user_role:candidate.role}
  })
  res.status(201).json(created)
}catch(error){if(error?.code==='23505')return res.status(409).json({error:'A pending request already exists for this team member.'});next(error)}})
app.patch('/api/assignments/:id/member-requests/:requestId',authenticate,validate(assignmentMemberRequestDecisionSchema),async(req,res,next)=>{try{
  const pending=(await query('SELECT requested_by FROM assignment_member_requests WHERE id=$1 AND assignment_id=$2',[req.params.requestId,req.params.id])).rows[0]
  if(!pending)return res.status(404).json({error:'Team-member request not found.'})
  if(!await canOverseeUser(req.user,pending.requested_by))return res.status(403).json({error:"Only an authorised manager in the requester's reporting hierarchy can decide this team request."})
  if(req.validated.decision==='Rejected'&&!req.validated.comments)return res.status(400).json({error:'Add a reason before rejecting the request.'})
  const result=await transaction(async client=>{
    const request=(await client.query('SELECT * FROM assignment_member_requests WHERE id=$1 AND assignment_id=$2 FOR UPDATE',[req.params.requestId,req.params.id])).rows[0]
    if(!request)return {kind:'missing'}
    if(request.status!=='Pending')return {kind:'closed'}
    const assignment=(await client.query('SELECT title FROM assignments WHERE id=$1',[req.params.id])).rows[0]
    const decision=req.validated.decision
    if(decision==='Approved'){
      await client.query("INSERT INTO assignment_members(assignment_id,user_id,member_role) VALUES($1,$2,'Contributor') ON CONFLICT(assignment_id,user_id) DO UPDATE SET member_role=CASE WHEN assignment_members.member_role='Lead' THEN 'Lead' ELSE 'Contributor' END",[req.params.id,request.requested_user_id])
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'Added to assignment team',$2,'assignment',$3)",[request.requested_user_id,`You were approved as a contributor to â€œ${assignment?.title||'an assignment'}â€.`,req.params.id])
    }
    const updated=(await client.query('UPDATE assignment_member_requests SET status=$1,reviewed_by=$2,review_comments=$3,reviewed_at=NOW(),updated_at=NOW() WHERE id=$4 RETURNING *',[decision,req.user.id,req.validated.comments,request.id])).rows[0]
    await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,$2,$3,'assignment_member_request',$4)",[request.requested_by,decision==='Approved'?'Assignment team request approved':'Assignment team request declined',`${decision==='Approved'?'Approved':'Declined'} for â€œ${assignment?.title||'the assignment'}â€${req.validated.comments?`: ${req.validated.comments}`:'.'}`,request.id])
    await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details) VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,decision==='Approved'?'MEMBER_REQUEST_APPROVED':'MEMBER_REQUEST_REJECTED',JSON.stringify({requestId:request.id,userId:request.requested_user_id,comments:req.validated.comments})])
    await audit(client,req.user.id,decision==='Approved'?'ASSIGNMENT_MEMBER_REQUEST_APPROVED':'ASSIGNMENT_MEMBER_REQUEST_REJECTED','assignment_member_request',request.id,{assignmentId:req.params.id,userId:request.requested_user_id})
    return {kind:'updated',row:updated}
  })
  if(result.kind==='missing')return res.status(404).json({error:'Team-member request not found.'})
  if(result.kind==='closed')return res.status(409).json({error:'This team-member request has already been decided.'})
  res.json(result.row)
}catch(error){next(error)}})
app.get('/api/assignments/:id/sections',authenticate,async(req,res,next)=>{try{if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot view this assignment structure.'});res.json((await query(`SELECT s.*,lead.name lead_name,creator.name created_by_name
FROM assignment_sections s
LEFT JOIN users lead ON lead.id=s.lead_id
JOIN users creator ON creator.id=s.created_by
WHERE s.assignment_id=$1 AND s.archived_at IS NULL
ORDER BY s.section_order,s.created_at`,[req.params.id])).rows)}catch(error){next(error)}})
app.post('/api/assignments/:id/sections',authenticate,authorize('System Admin','Deputy Director'),validate(assignmentSectionSchema),async(req,res,next)=>{try{const v=req.validated;const created=await transaction(async client=>{const assignment=(await client.query('SELECT id FROM assignments WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!assignment)throw Object.assign(new Error('Assignment not found.'),{statusCode:404});if(v.leadId&&!await client.query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[req.params.id,v.leadId]).then(result=>result.rowCount))throw Object.assign(new Error('Section lead must be a member of this assignment.'),{statusCode:400});const sectionOrder=Number((await client.query('SELECT COALESCE(MAX(section_order),0)+1 next_order FROM assignment_sections WHERE assignment_id=$1 AND archived_at IS NULL',[req.params.id])).rows[0].next_order);const row=(await client.query(`INSERT INTO assignment_sections(assignment_id,title,description,section_order,lead_id,start_date,due_date,status,progress,is_mandatory,created_by)
VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[req.params.id,v.title,v.description,sectionOrder,v.leadId,v.startDate,v.dueDate,v.status,v.progress,v.isMandatory,req.user.id])).rows[0];await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'SECTION_CREATED',JSON.stringify({sectionId:row.id,title:row.title,sectionOrder})]);await audit(client,req.user.id,'ASSIGNMENT_SECTION_CREATED','assignment_section',row.id,{assignmentId:req.params.id,title:row.title,sectionOrder});return row});res.status(201).json(created)}catch(error){next(error)}})
app.post('/api/assignments/:id/sections/starter',authenticate,authorize('System Admin','Deputy Director'),async(req,res,next)=>{try{const titles=['Background & Context','Current State Assessment','Stakeholder Engagement','Technical Assessment','Risks & Constraints','Findings','Recommendations','Implementation Plan'];const rows=await transaction(async client=>{const assignment=(await client.query('SELECT id FROM assignments WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!assignment)throw Object.assign(new Error('Assignment not found.'),{statusCode:404});const existing=Number((await client.query('SELECT COUNT(*) total FROM assignment_sections WHERE assignment_id=$1 AND archived_at IS NULL',[req.params.id])).rows[0].total);if(existing)throw Object.assign(new Error('Starter Structure is available only when the assignment has no active sections.'),{statusCode:409});const created=[];for(const [index,title] of titles.entries())created.push((await client.query(`INSERT INTO assignment_sections(assignment_id,title,section_order,created_by)VALUES($1,$2,$3,$4)RETURNING *`,[req.params.id,title,index+1,req.user.id])).rows[0]);await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'STARTER_STRUCTURE_CREATED',JSON.stringify({sectionIds:created.map(section=>section.id),titles})]);await audit(client,req.user.id,'ASSIGNMENT_STARTER_STRUCTURE_CREATED','assignment',req.params.id,{sections:titles});return created});res.status(201).json(rows)}catch(error){next(error)}})
app.patch('/api/assignments/:id/sections/reorder',authenticate,authorize('System Admin','Deputy Director'),validate(assignmentSectionReorderSchema),async(req,res,next)=>{try{const rows=await transaction(async client=>{const active=(await client.query('SELECT id FROM assignment_sections WHERE assignment_id=$1 AND archived_at IS NULL FOR UPDATE',[req.params.id])).rows.map(row=>row.id);if(active.length!==req.validated.length||active.some(id=>!req.validated.some(item=>item.id===id)))throw Object.assign(new Error('Reorder must include every active assignment section exactly once.'),{statusCode:400});for(const item of req.validated)await client.query('UPDATE assignment_sections SET section_order=$1,updated_at=NOW() WHERE id=$2 AND assignment_id=$3',[item.sectionOrder,item.id,req.params.id]);await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'SECTIONS_REORDERED',JSON.stringify({order:req.validated})]);await audit(client,req.user.id,'ASSIGNMENT_SECTIONS_REORDERED','assignment',req.params.id,{order:req.validated});return (await client.query(`SELECT s.*,lead.name lead_name,creator.name created_by_name FROM assignment_sections s LEFT JOIN users lead ON lead.id=s.lead_id JOIN users creator ON creator.id=s.created_by WHERE s.assignment_id=$1 AND s.archived_at IS NULL ORDER BY s.section_order,s.created_at`,[req.params.id])).rows});res.json(rows)}catch(error){next(error)}})
app.patch('/api/assignments/:id/sections/:sectionId',authenticate,validate(assignmentSectionUpdateSchema),async(req,res,next)=>{try{if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot update this assignment section.'});const manager=isManagementRole(req.user.role);const keys=Object.keys(req.body||{});const row=await transaction(async client=>{const current=(await client.query('SELECT * FROM assignment_sections WHERE id=$1 AND assignment_id=$2 AND archived_at IS NULL FOR UPDATE',[req.params.sectionId,req.params.id])).rows[0];if(!current)throw Object.assign(new Error('Assignment section not found.'),{statusCode:404});if(!manager&&(current.lead_id!==req.user.id||keys.some(key=>!['status','progress'].includes(key))))throw Object.assign(new Error('Only a manager may change section structure. The section lead may update status and progress.'),{statusCode:403});const next={title:req.validated.title??current.title,description:req.validated.description??current.description,leadId:req.validated.leadId===undefined?current.lead_id:req.validated.leadId,startDate:req.validated.startDate===undefined?current.start_date:req.validated.startDate,dueDate:req.validated.dueDate===undefined?current.due_date:req.validated.dueDate,status:req.validated.status??current.status,progress:req.validated.progress??current.progress,isMandatory:req.validated.isMandatory??current.is_mandatory};if(next.startDate&&next.dueDate&&String(next.dueDate)<String(next.startDate))throw Object.assign(new Error('Due date cannot be before the start date.'),{statusCode:400});if(next.leadId&&!await client.query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[req.params.id,next.leadId]).then(result=>result.rowCount))throw Object.assign(new Error('Section lead must be a member of this assignment.'),{statusCode:400});const updated=(await client.query(`UPDATE assignment_sections SET title=$1,description=$2,lead_id=$3,start_date=$4,due_date=$5,status=$6,progress=$7,is_mandatory=$8,updated_at=NOW() WHERE id=$9 RETURNING *`,[next.title,next.description,next.leadId,next.startDate,next.dueDate,next.status,next.progress,next.isMandatory,current.id])).rows[0];await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'SECTION_UPDATED',JSON.stringify({sectionId:updated.id,title:updated.title,status:updated.status,progress:updated.progress})]);await audit(client,req.user.id,'ASSIGNMENT_SECTION_UPDATED','assignment_section',updated.id,{assignmentId:req.params.id,status:updated.status,progress:updated.progress});return updated});res.json(row)}catch(error){next(error)}})
app.post('/api/assignments/:id/sections/:sectionId/archive',authenticate,authorize('System Admin','Deputy Director'),async(req,res,next)=>{try{const archived=await transaction(async client=>{const row=(await client.query('UPDATE assignment_sections SET archived_at=NOW(),archived_by=$1,updated_at=NOW() WHERE id=$2 AND assignment_id=$3 AND archived_at IS NULL RETURNING *',[req.user.id,req.params.sectionId,req.params.id])).rows[0];if(!row)throw Object.assign(new Error('Assignment section not found.'),{statusCode:404});await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'SECTION_ARCHIVED',JSON.stringify({sectionId:row.id,title:row.title})]);await audit(client,req.user.id,'ASSIGNMENT_SECTION_ARCHIVED','assignment_section',row.id,{assignmentId:req.params.id,title:row.title});return row});res.json(archived)}catch(error){next(error)}})

app.get('/api/tasks',authenticate,async(req,res,next)=>{try{
  const organisation=isOrganisationScopeRole(req.user.role)
  const team=isTeamScopeRole(req.user.role)
  const scopeIds=organisation?[]:team?await managedUserIds(req.user):[req.user.id]

  const result=await query(`SELECT
      t.*,
      owner.name owner_name,
      reviewer.name reviewer_name,
      assignment_section.title assignment_section_title,
      a.title assignment_title,
      a.description assignment_description,
      a.division assignment_division,
      a.status assignment_status,
      a.priority assignment_priority,
      a.due_date assignment_due_date,
      lead_user.name assignment_lead_name,
      repo.id repository_document_id,
      repo.title repository_document_title,
      repo.created_at repository_document_created_at
    FROM assignment_tasks t
    JOIN assignments a ON a.id=t.assignment_id
    LEFT JOIN users owner ON owner.id=t.owner_id
    LEFT JOIN users reviewer ON reviewer.id=t.reviewer_id
    LEFT JOIN assignment_sections assignment_section ON assignment_section.id=t.assignment_section_id
    LEFT JOIN assignment_members lead_member
      ON lead_member.assignment_id=a.id AND lead_member.member_role='Lead'
    LEFT JOIN users lead_user ON lead_user.id=lead_member.user_id
    LEFT JOIN LATERAL(
      SELECT k.id,k.title,k.created_at
      FROM repository_entity_links rel
      JOIN knowledge_items k ON k.id=rel.knowledge_id
      WHERE rel.entity_type='task' AND rel.entity_id=t.id
        AND k.document_type='Task Final Report'
        AND k.status='Published'
        AND k.is_archived=FALSE
      ORDER BY k.created_at DESC
      LIMIT 1
    ) repo ON TRUE
    WHERE t.archived_at IS NULL
      AND(
        $1::boolean
        OR t.owner_id=ANY($2::uuid[])
        OR t.reviewer_id=ANY($2::uuid[])
        OR EXISTS(
          SELECT 1
          FROM assignment_members mine
          WHERE mine.assignment_id=t.assignment_id
            AND mine.user_id=$3::uuid
            AND mine.member_role='Lead'
        )
      )
    ORDER BY
      CASE WHEN t.owner_id=$3::uuid THEN 0
           WHEN t.reviewer_id=$3::uuid THEN 1
           ELSE 2 END,
      CASE WHEN t.status='Completed' THEN 1 ELSE 0 END,
      t.due_date NULLS LAST,
      t.created_at DESC`,
    [organisation,scopeIds,req.user.id]
  )
  res.json(result.rows)
}catch(error){next(error)}})

// TASK V1.9: TASK access is authoritative here; parent ASSIGNMENT access is separate.
app.get('/api/tasks/:taskId/context',authenticate,async(req,res,next)=>{try{
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
    WHERE t.id=$1::uuid AND t.archived_at IS NULL`,
    [req.params.taskId]
  )).rows[0]

  if(!row)return res.status(404).json({error:'Task not found.'})

  const scope=await assignmentTaskScope(req.user,row.assignment_id)
  const permitted=Boolean(
    scope.all ||
    scope.userIds?.includes(row.owner_id) ||
    scope.userIds?.includes(row.reviewer_id)
  )

  if(!permitted)return res.status(403).json({error:'You cannot open this task.'})

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

app.get('/api/assignments/:id/assignable-task-users',authenticate,async(req,res,next)=>{try{
  if(!isManagementRole(req.user.role))return res.status(403).json({error:'Only an authorised manager can load the task assignee pool.'})
  if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot assign tasks for this assignment.'})
  const scoped=await managedUserIds(req.user)
  const all=scoped===null
  const ids=scoped||[req.user.id]
  const rows=(await query(`SELECT
      u.id,u.name,u.email,u.role,u.division,u.status,u.active,u.supervisor_id,
      supervisor.name supervisor_name,supervisor.role supervisor_role,
      current_leave.leave_type_name,
      CASE WHEN current_leave.id IS NOT NULL THEN 'On Leave' ELSE u.status END availability_status,
      EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=$1 AND am.user_id=u.id) assignment_member
    FROM users u
    LEFT JOIN users supervisor ON supervisor.id=u.supervisor_id
    LEFT JOIN LATERAL(
      SELECT lr.id,lt.name leave_type_name
      FROM leave_requests lr JOIN leave_types lt ON lt.code=lr.leave_type_code
      WHERE lr.user_id=u.id AND lr.status='Approved'
        AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
      ORDER BY lr.start_date LIMIT 1
    ) current_leave ON TRUE
    WHERE u.active=TRUE
      AND u.role<>'System Admin'
      AND($2::boolean OR u.id=ANY($3::uuid[]))
    ORDER BY
      CASE WHEN EXISTS(SELECT 1 FROM assignment_members am2 WHERE am2.assignment_id=$1 AND am2.user_id=u.id) THEN 0 ELSE 1 END,
      u.name`,[req.params.id,all,ids])).rows
  res.set('Cache-Control','no-store')
  res.json(rows)
}catch(error){next(error)}})

app.get('/api/assignments/:id/tasks',authenticate,async(req,res,next)=>{try{
  const scope=await assignmentTaskScope(req.user,req.params.id)
  if(!scope.all&&!scope.userIds.length)return res.status(403).json({error:'You cannot view tasks for this assignment.'})
  res.json((await query(`SELECT t.*,u.name owner_name,reviewer.name reviewer_name,gd.title target_document_title,gds.title target_section_title,assignment_section.title assignment_section_title,
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
WHERE t.assignment_id=$1
  AND t.archived_at IS NULL
  AND(
    $2::boolean
    OR t.owner_id=ANY($3::uuid[])
    OR t.reviewer_id=ANY($3::uuid[])
  )
ORDER BY t.created_at`,[req.params.id,scope.all,scope.userIds||[]])).rows)
}catch(error){next(error)}})
app.get('/api/assignments/:id/reviewer-candidates',authenticate,async(req,res,next)=>{try{
  if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot view reviewer candidates for this assignment.'})
  const requestedOwner=String(req.query.ownerId||'').trim()
  const owner=(await query(`SELECT u.id FROM assignment_members am JOIN users u ON u.id=am.user_id AND u.active=TRUE
    WHERE am.assignment_id=$1 AND u.id=COALESCE(NULLIF($2,''),(
      SELECT lead.user_id::text FROM assignment_members lead WHERE lead.assignment_id=$1 AND lead.member_role='Lead' LIMIT 1
    )::text)::uuid`,[req.params.id,requestedOwner])).rows[0]
  if(!owner)return res.status(400).json({error:'Choose an active assignment member as the task owner.'})
  const oversight=await immediateOversightReviewers(owner.id)
  const members=(await query(`SELECT u.id,u.name,u.email,u.role,u.division,u.status,u.active,u.supervisor_id,
      supervisor.name supervisor_name,supervisor.role supervisor_role
    FROM assignment_members am
    JOIN users u ON u.id=am.user_id
    LEFT JOIN users supervisor ON supervisor.id=u.supervisor_id
    WHERE am.assignment_id=$1 AND u.active=TRUE AND u.id<>$2 AND u.role<>'System Admin'`,[req.params.id,owner.id])).rows
  const candidates=[...oversight,...members]
    .filter((candidate,index,items)=>items.findIndex(item=>item.id===candidate.id)===index)
  const eligible=[]
  for(const candidate of candidates){
    if(await isEligibleAssignmentTaskReviewer(req.params.id,owner.id,candidate.id))eligible.push(candidate)
  }
  eligible.sort((left,right)=>left.name.localeCompare(right.name))
  res.json(eligible)
}catch(error){next(error)}})
app.get('/api/assignments/:id/report-reviewers',authenticate,async(req,res,next)=>{try{
  if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot view reviewer options for this assignment report.'})

  const lead=await resolvedAssignmentLead(req.params.id)
  if(!lead)return res.status(409).json({error:'Assign an active Assignment Lead before selecting a report reviewer.'})

  const requesterRole=await assignmentDocumentRole(req.user,{context:'Assignment',context_id:req.params.id})
  if(!['Lead','Manager'].includes(requesterRole||''))return res.status(403).json({error:'Only the Assignment Lead or an authorised manager can choose the formal report reviewer.'})

  const oversight=await immediateOversightReviewers(lead.id)
  const members=(await query(`SELECT u.id,u.name,u.email,u.role,u.division,u.status,u.active,u.supervisor_id,
      supervisor.name supervisor_name,supervisor.role supervisor_role
    FROM assignment_members am
    JOIN users u ON u.id=am.user_id
    LEFT JOIN users supervisor ON supervisor.id=u.supervisor_id
    WHERE am.assignment_id=$1
      AND u.active=TRUE
      AND u.id<>$2
      AND u.role<>'System Admin'`,[req.params.id,lead.id])).rows

  const candidates=[...oversight,...members]
    .filter(candidate=>candidate.id!==lead.id&&candidate.id!==req.user.id)
    .filter((candidate,index,items)=>items.findIndex(item=>item.id===candidate.id)===index)

  const eligible=[]
  for(const candidate of candidates){
    if(await isEligibleAssignmentTaskReviewer(req.params.id,lead.id,candidate.id))eligible.push(candidate)
  }

  eligible.sort((left,right)=>left.name.localeCompare(right.name))
  res.set('Cache-Control','no-store')
  res.json(eligible)
}catch(error){next(error)}})

app.post('/api/assignments/:id/tasks',authenticate,validate(assignmentTaskCreationSchema),async(req,res,next)=>{try{
const manager=isManagementRole(req.user.role)
const teamLead=(await query("SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2 AND member_role='Lead'",[req.params.id,req.user.id])).rowCount>0
if(!manager&&!teamLead)return res.status(403).json({error:'Only the Assignment Lead or an authorised manager can create tasks.'})
if(manager&&!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot create tasks for this assignment.'})
const v=req.validated
if(!v.ownerId)return res.status(400).json({error:'Choose a task owner before creating the task.'})
const ownerUser=(await query("SELECT id,name,role,active FROM users WHERE id=$1",[v.ownerId])).rows[0]
if(!ownerUser||!ownerUser.active||ownerUser.role==='System Admin')return res.status(400).json({error:'Choose an active operational user as the task owner.'})
if(manager&&isTeamScopeRole(req.user.role)){
  const allowed=await managedUserIds(req.user)
  if(!allowed.includes(v.ownerId))return res.status(403).json({error:'The task owner must belong to your reporting subtree.'})
}else if(!manager){
  const member=(await query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[req.params.id,v.ownerId])).rowCount
  if(!member)return res.status(400).json({error:'Assignment Leads may assign tasks only to current assignment members.'})
}
const resolvedReviewer=await resolveAssignmentTaskReviewer(req.params.id,v.ownerId,v.reviewerId)
v.reviewerId=resolvedReviewer.reviewerId
if(manager&&isTeamScopeRole(req.user.role)){
  const allowed=await managedUserIds(req.user)
  for(const id of [v.reviewerId].filter(Boolean)){
    if(!allowed.includes(id))return res.status(403).json({error:'Task reviewers must belong to your reporting subtree.'})
  }
}
const row=await transaction(async client=>{
let ownerAutoEnrolled=false
const ownerMembership=(await client.query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[req.params.id,v.ownerId])).rowCount
if(!ownerMembership){
  if(!manager)throw Object.assign(new Error('Selected task owner is not a member of this assignment.'),{statusCode:400})
  await client.query("INSERT INTO assignment_members(assignment_id,user_id,member_role) VALUES($1,$2,'Contributor') ON CONFLICT(assignment_id,user_id) DO NOTHING",[req.params.id,v.ownerId])
  ownerAutoEnrolled=true
  await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details) VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'TASK_OWNER_AUTO_ENROLLED',JSON.stringify({userId:v.ownerId,name:ownerUser.name,memberRole:'Contributor',source:'direct-task-assignment'})])
  await audit(client,req.user.id,'TASK_OWNER_AUTO_ENROLLED','assignment',req.params.id,{userId:v.ownerId,name:ownerUser.name,memberRole:'Contributor',source:'direct-task-assignment'})
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
  if(!await isEligibleAssignmentTaskReviewer(req.params.id,v.ownerId,v.reviewerId))throw Object.assign(new Error("Choose a reviewer from the assignee's assignment or immediate reporting team."),{statusCode:400})
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
await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'TASK_CREATED',JSON.stringify({taskId:created.id,title:created.title,reviewerId:v.reviewerId,reviewerSource:resolvedReviewer.source,ownerAutoEnrolled})]);await syncAssignmentStatusFromTasks(client,req.params.id,req.user.id);await syncResearchMilestonesFromTasks(client,req.params.id,req.user.id);await audit(client,req.user.id,'ASSIGNMENT_TASK_CREATED','assignment_task',created.id,{assignmentId:req.params.id,title:created.title,reviewerId:v.reviewerId,reviewerSource:resolvedReviewer.source,ownerAutoEnrolled});const repositorySyncJobId=await enqueueRepositorySyncJob(client,{jobKind:'task_draft',entityId:created.id,parentId:req.params.id,actor:req.user});return {...created,repository_sync_job_id:repositorySyncJobId,repository_sync_status:repositorySyncJobId?'pending':'unavailable'}});const repositorySync=await runAndReadRepositorySync(row.repository_sync_job_id);res.status(201).json({...row,...repositorySync})}catch(error){next(error)}})
app.patch('/api/assignments/:id/tasks/:taskId',authenticate,validate(assignmentTaskSchema),async(req,res,next)=>{try{
const current=(await query('SELECT owner_id,reviewer_id,archived_at,contribution_status FROM assignment_tasks WHERE id=$1 AND assignment_id=$2',[req.params.taskId,req.params.id])).rows[0]
if(!current)return res.status(404).json({error:'Task not found.'})
if(current.archived_at)return res.status(409).json({error:'Archived tasks cannot be edited.'})
const manager=isManagementRole(req.user.role)
const taskOwner=current.owner_id===req.user.id

// Standalone TASK owners must be able to update their own TASK without being
// granted access to the parent ASSIGNMENT Workspace. Managers remain subject
// to their existing ASSIGNMENT/hierarchy scope.
if(manager){
  if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot update this task.'})
}else if(!taskOwner){
  return res.status(403).json({error:'Only the task owner or an authorised manager can update this task.'})
}
if(manager&&isTeamScopeRole(req.user.role)){
  const allowed=await managedUserIds(req.user)
  if(current.owner_id&&!allowed.includes(current.owner_id))return res.status(403).json({error:'You may update only tasks owned within your reporting subtree.'})
}
const v=req.validated
if(v.status==='Completed')return res.status(409).json({error:'Task completion is governed by final report publication. Approve the submitted report, then generate and publish the final Task Report.'})
if(manager&&isTeamScopeRole(req.user.role)){const allowed=await managedUserIds(req.user);for(const id of [v.ownerId,v.reviewerId].filter(Boolean)){if(!allowed.includes(id))return res.status(403).json({error:'Task owners and reviewers must belong to your reporting subtree.'})}}const row=await transaction(async client=>{
if(manager&&v.ownerId){
  const selectedOwner=(await client.query("SELECT id,name,role,active FROM users WHERE id=$1",[v.ownerId])).rows[0]
  if(!selectedOwner||!selectedOwner.active||selectedOwner.role==='System Admin')throw Object.assign(new Error('Choose an active operational user as the task owner.'),{statusCode:400})
  const member=(await client.query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[req.params.id,v.ownerId])).rowCount
  if(!member){
    await client.query("INSERT INTO assignment_members(assignment_id,user_id,member_role) VALUES($1,$2,'Contributor') ON CONFLICT(assignment_id,user_id) DO NOTHING",[req.params.id,v.ownerId])
    await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details) VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'TASK_OWNER_AUTO_ENROLLED',JSON.stringify({userId:v.ownerId,name:selectedOwner.name,memberRole:'Contributor',source:'task-reassignment'})])
    await audit(client,req.user.id,'TASK_OWNER_AUTO_ENROLLED','assignment',req.params.id,{userId:v.ownerId,name:selectedOwner.name,memberRole:'Contributor',source:'task-reassignment'})
  }
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
if(manager&&v.reviewerId&&!await isEligibleAssignmentTaskReviewer(req.params.id,v.ownerId||current.owner_id,v.reviewerId))throw Object.assign(new Error("Choose a reviewer from the assignee's assignment or immediate reporting team."),{statusCode:400})
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
v.expectedContribution,v.assignmentPart,v.targetDocumentId,v.targetSectionId,v.assignmentSectionId,v.taskPurpose,v.specificInstructions,v.expectedFindings,v.expectedOutput,v.evidenceRequired,v.reviewerId,req.params.taskId,req.params.id])).rows[0];await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'TASK_UPDATED',JSON.stringify({taskId:updated.id,status:updated.status,progress:updated.progress,assignmentSectionId:updated.assignment_section_id})]);await syncAssignmentStatusFromTasks(client,req.params.id,req.user.id);await syncResearchMilestonesFromTasks(client,req.params.id,req.user.id);
await audit(client,req.user.id,'ASSIGNMENT_TASK_UPDATED','assignment_task',updated.id,{status:updated.status,progress:updated.progress,assignmentSectionId:updated.assignment_section_id});
const repositorySyncJobId=await enqueueRepositorySyncJob(client,{jobKind:'task_draft',entityId:updated.id,parentId:req.params.id,actor:req.user});return {...updated,repository_sync_job_id:repositorySyncJobId,repository_sync_status:repositorySyncJobId?'pending':'unavailable'}});const repositorySync=await runAndReadRepositorySync(row.repository_sync_job_id);res.json({...row,...repositorySync})}catch(error){next(error)}})

app.patch('/api/assignments/:id/tasks/:taskId/reviewer',authenticate,validate(assignmentTaskReviewerSelectionSchema),async(req,res,next)=>{try{
  const current=(await query(`SELECT id,assignment_id,title,owner_id,reviewer_id,created_by,archived_at,contribution_status
    FROM assignment_tasks WHERE id=$1 AND assignment_id=$2`,[req.params.taskId,req.params.id])).rows[0]
  if(!current)return res.status(404).json({error:'Task not found.'})
  if(current.archived_at)return res.status(409).json({error:'Archived tasks cannot change reviewer.'})
  if(current.contribution_status!=='Draft')return res.status(409).json({error:'The reviewer can only be selected while the Task Report is still a Draft.'})

  const manager=isManagementRole(req.user.role)
  const taskOwner=current.owner_id===req.user.id
  if(manager){
    if(!await canAccessAssignment(req.user,req.params.id))return res.status(403).json({error:'You cannot change the reviewer for this task.'})
    if(isTeamScopeRole(req.user.role)){
      const allowed=await managedUserIds(req.user)
      if(current.owner_id&&!allowed.includes(current.owner_id))return res.status(403).json({error:'You may change reviewers only for tasks owned within your reporting subtree.'})
    }
  }else if(!taskOwner){
    return res.status(403).json({error:'Only the task owner or an authorised manager can select the Task Report reviewer.'})
  }

  const reviewerId=req.validated.reviewerId
  if(reviewerId===req.user.id)return res.status(400).json({error:'The person completing or submitting this Task Report cannot review it.'})
  if(current.owner_id&&reviewerId===current.owner_id)return res.status(400).json({error:'The task assignee cannot review their own work.'})
  if(!await isEligibleAssignmentTaskReviewer(req.params.id,current.owner_id,reviewerId))return res.status(400).json({error:"Choose a reviewer from the assignee's assignment or immediate reporting team."})

  const updated=await transaction(async client=>{
    const row=(await client.query(`UPDATE assignment_tasks SET reviewer_id=$1,updated_at=NOW()
      WHERE id=$2 AND assignment_id=$3 RETURNING *`,[reviewerId,req.params.taskId,req.params.id])).rows[0]
    if(current.reviewer_id!==reviewerId){
      const assignment=(await client.query('SELECT title FROM assignments WHERE id=$1',[req.params.id])).rows[0]
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Task review assigned',$2,'assignment_task',$3)",[
        reviewerId,
        `You were selected to review “${current.title}” in “${assignment?.title||'an assignment'}”. The review becomes actionable when the owner submits the Task Report.`,
        current.id
      ])
      await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[
        req.params.id,req.user.id,'TASK_REVIEWER_SELECTED',JSON.stringify({taskId:current.id,reviewerId,previousReviewerId:current.reviewer_id||null})
      ])
      await audit(client,req.user.id,'ASSIGNMENT_TASK_REVIEWER_SELECTED','assignment_task',current.id,{assignmentId:req.params.id,reviewerId,previousReviewerId:current.reviewer_id||null})
    }
    return row
  })
  res.json(updated)
}catch(error){next(error)}})

app.get('/api/assignments/:id/task-requests',authenticate,async(req,res,next)=>{
  try{
    const lead=(await query("SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2 AND member_role='Lead'",[req.params.id,req.user.id])).rowCount>0
    const managementAllowed=isOrganisationScopeRole(req.user.role)||(isTeamScopeRole(req.user.role)&&await canManageAssignment(req.user,req.params.id))
    if(!lead&&!managementAllowed)return res.status(403).json({error:'Only the Assignment Lead or an authorised supervisor can view task requests.'})
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
    const supervisor=await immediateSupervisorForUser(req.user.id)
    if(!supervisor)return res.status(409).json({error:'Assign an immediate supervisor to the Team Lead before requesting management approval.'})
    const oversightManagerIds=await reportingOversightManagerIds(req.user.id)
    const created=await transaction(async client=>{
      const row=(await client.query(`INSERT INTO assignment_task_requests(assignment_id,requested_by,title,description,suggested_owner_id,priority,due_date,reason)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[req.params.id,req.user.id,v.title,v.description,v.suggestedOwnerId,v.priority,v.dueDate,v.reason])).rows[0]
      const assignment=(await client.query('SELECT title FROM assignments WHERE id=$1',[req.params.id])).rows[0]
      const requestNotificationBody=`${req.user.name} requested a task for “${assignment?.title||'an assignment'}”: ${v.title}.`
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Task request awaiting approval',$2,'assignment_task_request',$3)",[supervisor.id,requestNotificationBody,row.id])
      for(const managerId of oversightManagerIds){if(managerId===supervisor.id)continue;await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Task request awaiting approval',$2,'assignment_task_request',$3)",[managerId,requestNotificationBody,row.id])}
      finalizationStage='write-history'
    await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'TASK_REQUESTED',JSON.stringify({requestId:row.id,title:row.title})])
      await audit(client,req.user.id,'ASSIGNMENT_TASK_REQUESTED','assignment_task_request',row.id,{assignmentId:req.params.id,title:row.title})
      return row
    })
    res.status(201).json(created)
  }catch(error){next(error)}
})
app.patch('/api/assignments/:id/task-requests/:requestId',authenticate,validate(assignmentTaskRequestDecisionSchema),async(req,res,next)=>{
  try{
    const oversightRequest=(await query('SELECT requested_by FROM assignment_task_requests WHERE id=$1 AND assignment_id=$2',[req.params.requestId,req.params.id])).rows[0]
    if(!oversightRequest)return res.status(404).json({error:'Task request not found.'})
    if(!await canOverseeUser(req.user,oversightRequest.requested_by))return res.status(403).json({error:"Only an authorised manager in the requester's reporting hierarchy can decide this task request."})
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
      if(!taskOwner)return {kind:'missing-owner'}
      const ownerUser=(await client.query("SELECT id,name,role,active FROM users WHERE id=$1",[taskOwner])).rows[0]
      if(!ownerUser||!ownerUser.active||ownerUser.role==='System Admin')return {kind:'bad-owner'}
      const scoped=await managedUserIds(req.user)
      if(scoped!==null&&!scoped.includes(taskOwner))return {kind:'out-of-scope-owner'}
      let ownerAutoEnrolled=false
      const owner=(await client.query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[req.params.id,taskOwner])).rowCount
      if(!owner){
        await client.query("INSERT INTO assignment_members(assignment_id,user_id,member_role) VALUES($1,$2,'Contributor') ON CONFLICT(assignment_id,user_id) DO NOTHING",[req.params.id,taskOwner])
        ownerAutoEnrolled=true
        await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details) VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'TASK_OWNER_AUTO_ENROLLED',JSON.stringify({userId:taskOwner,name:ownerUser.name,memberRole:'Contributor',source:'task-request-approval'})])
        await audit(client,req.user.id,'TASK_OWNER_AUTO_ENROLLED','assignment',req.params.id,{userId:taskOwner,name:ownerUser.name,memberRole:'Contributor',source:'task-request-approval'})
      }
      const resolvedReviewer=await resolveAssignmentTaskReviewer(req.params.id,taskOwner,v.reviewerId??null)
      const task=(await client.query(`INSERT INTO assignment_tasks(assignment_id,title,description,owner_id,priority,status,progress,start_date,due_date,notes,created_by,reviewer_id)
        VALUES($1,$2,$3,$4,$5,'Not Started',0,$6,$7,$8,$9,$10) RETURNING *`,
        [req.params.id,taskTitle,taskDescription,taskOwner,taskPriority,v.startDate??null,taskDueDate,v.notes??'',req.user.id,resolvedReviewer.reviewerId])).rows[0]
      const updated=(await client.query("UPDATE assignment_task_requests SET status='Approved',reviewed_by=$1,reviewed_at=NOW(),review_comments=$2,task_id=$3,updated_at=NOW() WHERE id=$4 RETURNING *",[req.user.id,v.comments,task.id,request.id])).rows[0]
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'Task request approved',$2,'assignment_task_request',$3)",[request.requested_by,`Your task request “${request.title}” was approved and converted to task “${task.title}”.`,request.id])
      if(taskOwner)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'New task assigned',$2,'assignment_task',$3)",[taskOwner,`You have been assigned “${task.title}”.`,task.id])
      if(resolvedReviewer.reviewerId)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'Task review assigned',$2,'assignment_task',$3)",[resolvedReviewer.reviewerId,`You are the assigned reviewer for “${task.title}”. The review becomes actionable when the task owner submits the report.`,task.id])
      await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'TASK_REQUEST_APPROVED',JSON.stringify({requestId:request.id,taskId:task.id,title:task.title,reviewerId:resolvedReviewer.reviewerId,reviewerSource:resolvedReviewer.source,ownerAutoEnrolled})])
      await audit(client,req.user.id,'ASSIGNMENT_TASK_REQUEST_APPROVED','assignment_task_request',request.id,{assignmentId:req.params.id,taskId:task.id,title:task.title,reviewerId:resolvedReviewer.reviewerId,reviewerSource:resolvedReviewer.source,ownerAutoEnrolled})
      return {kind:'updated',row:{...updated,task}}
    })
    if(result.kind==='missing')return res.status(404).json({error:'Task request not found.'})
    if(result.kind==='closed')return res.status(409).json({error:'This task request has already been decided.'})
    if(result.kind==='missing-owner')return res.status(400).json({error:'Choose a task owner before approving this request.'})
    if(result.kind==='bad-owner')return res.status(400).json({error:'Choose an active operational user as the task owner.'})
    if(result.kind==='out-of-scope-owner')return res.status(403).json({error:'The task owner must belong to your authorised reporting scope.'})
    res.json(result.row)
  }catch(error){next(error)}
})





app.get('/api/task-request-assignments',authenticate,async(req,res,next)=>{try{
  const rows=(await query(`SELECT
      a.id,
      a.title,
      a.due_date,
      a.priority,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id',member.id,
            'name',member.name,
            'role',member.role,
            'division',member.division,
            'member_role',am.member_role
          )
          ORDER BY CASE WHEN am.member_role='Lead' THEN 0 ELSE 1 END,member.name
        ) FILTER(WHERE member.id IS NOT NULL),
        '[]'::jsonb
      ) members
    FROM assignments a
    JOIN assignment_members lead
      ON lead.assignment_id=a.id
     AND lead.user_id=$1::uuid
     AND lead.member_role='Lead'
    LEFT JOIN assignment_members am ON am.assignment_id=a.id
    LEFT JOIN users member ON member.id=am.user_id AND member.active=TRUE
    WHERE a.status NOT IN('Completed','Archived')
    GROUP BY a.id
    ORDER BY a.due_date NULLS LAST,a.created_at DESC`,[req.user.id])).rows
  res.json(rows)
}catch(error){next(error)}})

app.get('/api/task-requests',authenticate,async(req,res,next)=>{try{
  const scoped=await managedUserIds(req.user)
  const organisationWide=req.user.role==='Director'
  const rows=(await query(`SELECT
      r.*,
      requester.name requested_by_name,
      owner.name suggested_owner_name,
      reviewer.name reviewed_by_name,
      task.title task_title,
      a.title assignment_title,
      a.due_date assignment_due_date
    FROM assignment_task_requests r
    JOIN assignments a ON a.id=r.assignment_id
    JOIN users requester ON requester.id=r.requested_by
    LEFT JOIN users owner ON owner.id=r.suggested_owner_id
    LEFT JOIN users reviewer ON reviewer.id=r.reviewed_by
    LEFT JOIN assignment_tasks task ON task.id=r.task_id
    WHERE r.requested_by=$1::uuid
       OR $2::boolean
       OR r.requested_by=ANY($3::uuid[])
    ORDER BY
      CASE WHEN r.status='Pending' THEN 0 ELSE 1 END,
      r.created_at DESC`,[req.user.id,organisationWide,scoped||[]])).rows

  res.json(rows.map(row=>({
    ...row,
    can_decide:row.status==='Pending'&&row.requested_by!==req.user.id&&isOperationalOversightRole(req.user.role)&&(organisationWide||Array.isArray(scoped)&&scoped.includes(row.requested_by)),
    is_mine:row.requested_by===req.user.id
  })))
}catch(error){next(error)}})

app.post('/api/task-requests',authenticate,validate(assignmentTaskRequestSchema.extend({
  assignmentId:z.string().uuid()
})),async(req,res,next)=>{try{
  const v=req.validated
  const membership=(await query("SELECT member_role FROM assignment_members WHERE assignment_id=$1 AND user_id=$2",[v.assignmentId,req.user.id])).rows[0]
  if(!membership||membership.member_role!=='Lead')return res.status(403).json({error:'Only the Assignment Lead can request a task for this assignment.'})

  if(v.suggestedOwnerId){
    const owner=(await query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[v.assignmentId,v.suggestedOwnerId])).rowCount
    if(!owner)return res.status(400).json({error:'The suggested assignee must already be a member of this assignment.'})
  }

  const supervisor=await immediateSupervisorForUser(req.user.id)
  if(!supervisor)return res.status(409).json({error:'Assign an immediate supervisor to the Assignment Lead before requesting approval.'})
  const oversightManagerIds=await reportingOversightManagerIds(req.user.id)

  const created=await transaction(async client=>{
    const row=(await client.query(`INSERT INTO assignment_task_requests(
        assignment_id,requested_by,title,description,suggested_owner_id,priority,due_date,reason
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [v.assignmentId,req.user.id,v.title,v.description,v.suggestedOwnerId,v.priority,v.dueDate,v.reason]
    )).rows[0]

    const assignment=(await client.query('SELECT title,due_date FROM assignments WHERE id=$1',[v.assignmentId])).rows[0]

    const requestNotificationBody=`${req.user.name} requested a task for "${assignment?.title||'an assignment'}": ${v.title}.`
    await client.query(
      "INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Task request awaiting approval',$2,'assignment_task_request',$3)",
      [supervisor.id,requestNotificationBody,row.id]
    )
    for(const managerId of oversightManagerIds){if(managerId===supervisor.id)continue;await client.query(
      "INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Task request awaiting approval',$2,'assignment_task_request',$3)",
      [managerId,requestNotificationBody,row.id]
    )}

    await client.query(
      'INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',
      [v.assignmentId,req.user.id,'TASK_REQUESTED',JSON.stringify({requestId:row.id,title:row.title,source:'standalone-tasks'})]
    )

    await audit(client,req.user.id,'ASSIGNMENT_TASK_REQUESTED','assignment_task_request',row.id,{
      assignmentId:v.assignmentId,
      title:row.title,
      source:'standalone-tasks'
    })

    return {
      ...row,
      assignment_title:assignment?.title||null,
      assignment_due_date:assignment?.due_date||null,
      requested_by_name:req.user.name,
      suggested_owner_name:null,
      reviewed_by_name:null,
      task_title:null,
      can_decide:false,
      is_mine:true
    }
  })

  res.status(201).json(created)
}catch(error){next(error)}})

app.get('/api/task-requests/:requestId/reviewer-candidates',authenticate,async(req,res,next)=>{try{
  const ownerId=String(req.query.ownerId||'')
  if(!/^[0-9a-f-]{36}$/i.test(ownerId))return res.status(400).json({error:'Choose a valid task owner.'})

  const request=(await query(`SELECT r.assignment_id,r.requested_by
    FROM assignment_task_requests r
    WHERE r.id=$1::uuid`,[req.params.requestId])).rows[0]
  if(!request)return res.status(404).json({error:'Task request not found.'})

  const canView=request.requested_by===req.user.id||await canOverseeUser(req.user,request.requested_by)
  if(!canView)return res.status(403).json({error:'You cannot view reviewer options for this task request.'})

  const candidates=await immediateOversightReviewers(ownerId)
  const lead=(await query(`SELECT u.id,u.name,u.role,u.division
    FROM assignment_members am
    JOIN users u ON u.id=am.user_id
    WHERE am.assignment_id=$1
      AND am.member_role='Lead'
      AND u.active=TRUE
    ORDER BY am.assigned_at ASC,am.user_id ASC
    LIMIT 1`,[request.assignment_id])).rows[0]

  const rows=[]
  if(lead&&lead.id!==ownerId)rows.push({...lead,relation:'Assignment Lead'})
  for(const candidate of candidates){
    if(candidate.id===ownerId||rows.some(row=>row.id===candidate.id))continue
    rows.push({...candidate,relation:'Authorised supervisor'})
  }

  res.json(rows)
}catch(error){next(error)}})

app.patch('/api/task-requests/:requestId',authenticate,validate(assignmentTaskRequestDecisionSchema),async(req,res,next)=>{try{
  const oversightRequest=(await query('SELECT assignment_id,requested_by FROM assignment_task_requests WHERE id=$1',[req.params.requestId])).rows[0]
  if(!oversightRequest)return res.status(404).json({error:'Task request not found.'})
  if(!await canOverseeUser(req.user,oversightRequest.requested_by))return res.status(403).json({error:"Only an authorised manager in the requester's reporting hierarchy can decide this task request."})

  const v=req.validated

  const result=await transaction(async client=>{
    const request=(await client.query('SELECT * FROM assignment_task_requests WHERE id=$1 FOR UPDATE',[req.params.requestId])).rows[0]
    if(!request)return {kind:'missing'}
    if(request.status!=='Pending')return {kind:'closed',request}

    if(v.decision==='Rejected'){
      const updated=(await client.query(
        "UPDATE assignment_task_requests SET status='Rejected',reviewed_by=$1,reviewed_at=NOW(),review_comments=$2,updated_at=NOW() WHERE id=$3 RETURNING *",
        [req.user.id,v.comments,request.id]
      )).rows[0]

      await client.query(
        "INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'Task request declined',$2,'assignment_task_request',$3)",
        [request.requested_by,`Your task request "${request.title}" was declined${v.comments?`: ${v.comments}`:'.'}`,request.id]
      )

      await client.query(
        'INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',
        [request.assignment_id,req.user.id,'TASK_REQUEST_REJECTED',JSON.stringify({requestId:request.id,comments:v.comments,source:'standalone-tasks'})]
      )

      await audit(client,req.user.id,'ASSIGNMENT_TASK_REQUEST_REJECTED','assignment_task_request',request.id,{
        assignmentId:request.assignment_id,
        comments:v.comments,
        source:'standalone-tasks'
      })

      return {kind:'updated',row:updated}
    }

    const taskTitle=v.title??request.title
    const taskDescription=v.description??request.description
    const taskOwner=v.ownerId===undefined?request.suggested_owner_id:v.ownerId
    const taskPriority=v.priority??request.priority
    const taskDueDate=v.dueDate===undefined?request.due_date:v.dueDate

    if(!taskOwner)return {kind:'missing-owner'}

    const ownerUser=(await client.query(
      'SELECT id,name,role,active FROM users WHERE id=$1',
      [taskOwner]
    )).rows[0]
    if(!ownerUser||!ownerUser.active||ownerUser.role==='System Admin')return {kind:'bad-owner'}

    // Keep the standalone Tasks Workspace approval path aligned with the
    // assignment-scoped approval path and enforce the supervisor's reporting scope.
    const scoped=await managedUserIds(req.user)
    if(scoped!==null&&!scoped.includes(taskOwner))return {kind:'out-of-scope-owner'}

    let ownerAutoEnrolled=false
    const owner=(await client.query(
      'SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',
      [request.assignment_id,taskOwner]
    )).rowCount
    if(!owner){
      await client.query(
        "INSERT INTO assignment_members(assignment_id,user_id,member_role) VALUES($1,$2,'Contributor') ON CONFLICT(assignment_id,user_id) DO NOTHING",
        [request.assignment_id,taskOwner]
      )
      ownerAutoEnrolled=true
      await client.query(
        'INSERT INTO assignment_history(assignment_id,user_id,action,details) VALUES($1,$2,$3,$4)',
        [request.assignment_id,req.user.id,'TASK_OWNER_AUTO_ENROLLED',JSON.stringify({userId:taskOwner,name:ownerUser.name,memberRole:'Contributor',source:'task-request-approval-standalone'})]
      )
      await audit(client,req.user.id,'TASK_OWNER_AUTO_ENROLLED','assignment',request.assignment_id,{userId:taskOwner,name:ownerUser.name,memberRole:'Contributor',source:'task-request-approval-standalone'})
    }

    const resolvedReviewer=await resolveAssignmentTaskReviewer(      request.assignment_id,
      taskOwner,
      v.reviewerId??null
    )

    const task=(await client.query(`INSERT INTO assignment_tasks(
        assignment_id,title,description,owner_id,priority,status,progress,start_date,due_date,notes,created_by,reviewer_id
      ) VALUES($1,$2,$3,$4,$5,'Not Started',0,$6,$7,$8,$9,$10) RETURNING *`,
      [request.assignment_id,taskTitle,taskDescription,taskOwner,taskPriority,v.startDate??null,taskDueDate,v.notes??'',req.user.id,resolvedReviewer.reviewerId]
    )).rows[0]

    const updated=(await client.query(
      "UPDATE assignment_task_requests SET status='Approved',reviewed_by=$1,reviewed_at=NOW(),review_comments=$2,task_id=$3,updated_at=NOW() WHERE id=$4 RETURNING *",
      [req.user.id,v.comments,task.id,request.id]
    )).rows[0]

    await client.query(
      "INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'Task request approved',$2,'assignment_task_request',$3)",
      [request.requested_by,`Your task request "${request.title}" was approved and converted to task "${task.title}".`,request.id]
    )
    await client.query(
      "INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'New task assigned',$2,'assignment_task',$3)",
      [taskOwner,`You have been assigned "${task.title}".`,task.id]
    )
    await client.query(
      "INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'Task review assigned',$2,'assignment_task',$3)",
      [resolvedReviewer.reviewerId,`You are the assigned reviewer for "${task.title}". The review becomes actionable when the task owner submits the report.`,task.id]
    )

    await client.query(
      'INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',
      [request.assignment_id,req.user.id,'TASK_REQUEST_APPROVED',JSON.stringify({
        requestId:request.id,
        taskId:task.id,
        title:task.title,
        reviewerId:resolvedReviewer.reviewerId,
        reviewerSource:resolvedReviewer.source,
        ownerAutoEnrolled,
        source:'standalone-tasks'
      })]
    )

    await audit(client,req.user.id,'ASSIGNMENT_TASK_REQUEST_APPROVED','assignment_task_request',request.id,{
      assignmentId:request.assignment_id,
      taskId:task.id,
      title:task.title,
      reviewerId:resolvedReviewer.reviewerId,
      reviewerSource:resolvedReviewer.source,
      ownerAutoEnrolled,
      source:'standalone-tasks'
    })

    return {kind:'updated',row:{...updated,task}}
  })

  if(result.kind==='missing')return res.status(404).json({error:'Task request not found.'})
  if(result.kind==='closed')return res.status(409).json({error:'This task request has already been decided.'})
  if(result.kind==='missing-owner')return res.status(400).json({error:'Choose a task owner before approving this request.'})
  if(result.kind==='bad-owner')return res.status(400).json({error:'Choose an active operational user as the task owner.'})
  if(result.kind==='out-of-scope-owner')return res.status(403).json({error:'The task owner must belong to your authorised reporting scope.'})

  const row=result.row
  const assignment=(await query('SELECT title,due_date FROM assignments WHERE id=$1',[oversightRequest.assignment_id])).rows[0]
  const requester=(await query('SELECT name FROM users WHERE id=$1',[oversightRequest.requested_by])).rows[0]
  const owner=(await query('SELECT name FROM users WHERE id=$1',[row.task?.owner_id||row.suggested_owner_id])).rows[0]

  res.json({
    ...row,
    assignment_title:assignment?.title||null,
    assignment_due_date:assignment?.due_date||null,
    requested_by_name:requester?.name||null,
    suggested_owner_name:owner?.name||null,
    reviewed_by_name:req.user.name,
    task_title:row.task?.title||null,
    can_decide:false,
    is_mine:false
  })
}catch(error){next(error)}})

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
  const manager=isManagementRole(req.user.role)
  if(!manager&&row.reviewer_id!==req.user.id){
    return res.status(403).json({error:'Only the reviewer assigned to this task can open this review.'})
  }
  if(row.reviewer_id===req.user.id&&row.contribution_status==='Ready for Integration'){
    const reportVersion=Number(row.contribution_report_version||0)
    await transaction(async client=>{
      const alreadyStarted=(await client.query(`SELECT 1
        FROM assignment_history
        WHERE assignment_id=$1::uuid
          AND action='TASK_REPORT_REVIEW_STARTED'
          AND details->>'taskId'=$2
          AND details->>'reportVersion'=$3
        LIMIT 1`,[row.assignment_id,row.id,String(reportVersion)])).rowCount>0
      if(!alreadyStarted){
        const details=JSON.stringify({
          taskId:row.id,
          title:row.title,
          reviewerId:req.user.id,
          reportVersion
        })
        await client.query(
          'INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1::uuid,$2::uuid,$3::varchar,$4::jsonb)',
          [row.assignment_id,req.user.id,'TASK_REPORT_REVIEW_STARTED',details]
        )
        await audit(client,req.user.id,'TASK_REPORT_REVIEW_STARTED','assignment_task',row.id,{
          assignmentId:row.assignment_id,
          reportVersion
        })
      }
      await client.query(
        "UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=$1::uuid AND entity_type='assignment_task' AND entity_id=$2::text AND read_at IS NULL",
        [req.user.id,row.id]
      )
    })
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
  const manager=isManagementRole(req.user.role)&&await canAccessAssignment(req.user,req.params.id)&&await canManageUser(req.user,task.owner_id)
  const teamLead=(await query("SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2 AND member_role='Lead'",[req.params.id,req.user.id])).rowCount>0
  const exactReviewer=task.reviewer_id===req.user.id
  if(!manager&&!teamLead&&!exactReviewer&&task.owner_id!==req.user.id)return res.status(403).json({error:'Only the task owner, assigned reviewer, team lead or a manager can preview this contribution.'})
  const assignment=(await query('SELECT title FROM assignments WHERE id=$1',[req.params.id])).rows[0]
  const previewOverride={...req.validated}
  const previewTitleRaw=String(previewOverride.contributionTitle||'')
  if(previewOverride.reportMode==='blank'||previewTitleRaw.length>300){
    if(!String(previewOverride.blankContent||'').trim()&&previewTitleRaw.length>300){
      previewOverride.blankContent=previewTitleRaw
    }
    if(previewTitleRaw.length>300){
      previewOverride.reportMode='blank'
      previewOverride.contributionTitle=plainTaskReportText(task.contribution_title||`${task.title} - Task Report`).slice(0,300)
    }
  }
  res.json(buildTaskContributionReport({task,assignment,ownerName:task.owner_name,preparedBy:req.user.name||task.owner_name,override:previewOverride}))
}catch(error){next(error)}})

app.get('/api/assignments/:id/tasks/:taskId/contribution-report',authenticate,async(req,res,next)=>{try{
  const task=(await query(`SELECT t.*,u.name owner_name,gd.title target_document_title,gds.title target_section_title
    FROM assignment_tasks t LEFT JOIN users u ON u.id=t.owner_id
    LEFT JOIN generated_documents gd ON gd.id=t.target_document_id
    LEFT JOIN generated_document_sections gds ON gds.id=t.target_section_id
    WHERE t.id=$1 AND t.assignment_id=$2`,[req.params.taskId,req.params.id])).rows[0]
  if(!task)return res.status(404).json({error:'Task not found.'})
  const manager=isManagementRole(req.user.role)&&await canAccessAssignment(req.user,req.params.id)&&await canManageUser(req.user,task.owner_id)
  const teamMember=(await query('SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2',[req.params.id,req.user.id])).rowCount>0
  if(!manager&&!teamMember&&task.reviewer_id!==req.user.id)return res.status(403).json({error:'You cannot view this task contribution report.'})
  const assignment=(await query('SELECT title FROM assignments WHERE id=$1',[req.params.id])).rows[0]
  const versionNumber=Number(task.contribution_report_version||0)
  if(task.contribution_status!=='Draft'&&versionNumber>0){
    const immutable=(await query(`SELECT html_snapshot,report_snapshot
      FROM task_report_versions
      WHERE task_id=$1 AND version_number=$2
      LIMIT 1`,[task.id,versionNumber])).rows[0]
    if(immutable?.html_snapshot){
      const snapshot=immutable.report_snapshot||{}
      const immutableTitle=plainTaskReportText(snapshot.contribution_title||task.contribution_title)||`${task.title} — Contribution Report`
      return res.json({html:immutable.html_snapshot,title:immutableTitle,version:versionNumber,generatedAt:task.contribution_report_generated_at||null,status:task.contribution_status})
    }
  }
  const report=buildTaskContributionReport({task,assignment,ownerName:task.owner_name,preparedBy:task.owner_name})
  res.json({html:report.html,title:report.title,version:versionNumber,generatedAt:task.contribution_report_generated_at||new Date().toISOString(),status:task.contribution_status})
}catch(error){next(error)}})

app.patch('/api/assignments/:id/tasks/:taskId/contribution',authenticate,validate(assignmentTaskContributionSchema),async(req,res,next)=>{try{
  const current=(await query(`SELECT t.*,u.name owner_name,gd.title target_document_title,gds.title target_section_title
    FROM assignment_tasks t LEFT JOIN users u ON u.id=t.owner_id
    LEFT JOIN generated_documents gd ON gd.id=t.target_document_id
    LEFT JOIN generated_document_sections gds ON gds.id=t.target_section_id
    WHERE t.id=$1 AND t.assignment_id=$2`,[req.params.taskId,req.params.id])).rows[0]
  if(!current)return res.status(404).json({error:'Task not found.'})
  const delegatedManager=isManagementRole(req.user.role)&&await canAccessAssignment(req.user,req.params.id)&&await canManageUser(req.user,current.owner_id)
  if(current.owner_id!==req.user.id&&!delegatedManager)return res.status(403).json({error:'Only the task owner or a manager authorised for the owner may edit or submit this task report. Reviewers must use the formal review decision controls.'})
  if(current.status==='Completed')return res.status(409).json({error:'This task is completed and its report is locked. An authorised manager must reopen it for revision.'})
  if(current.status==='Blocked')return res.status(409).json({error:'This task report was rejected and is locked. A manager must reopen it for revision before you can edit it.'})
  if(current.contribution_status!=='Draft')return res.status(409).json({error:'This submitted task report is locked while it is under review. Wait for the reviewer decision or requested changes.'})
  const v=req.validated
  const normalizedContribution={...v}
  const incomingTitleRaw=String(normalizedContribution.contributionTitle||'')
  if(normalizedContribution.reportMode==='blank'||incomingTitleRaw.length>300){
    if(!String(normalizedContribution.blankContent||'').trim()&&incomingTitleRaw.length>300){
      normalizedContribution.blankContent=incomingTitleRaw
    }
    if(incomingTitleRaw.length>300){
      normalizedContribution.reportMode='blank'
      normalizedContribution.contributionTitle=plainTaskReportText(current.contribution_title||`${current.title} - Task Report`).slice(0,300)
    }
  }
  const clean={
    ...normalizedContribution,
    contributionTitle:plainTaskReportText(normalizedContribution.contributionTitle).slice(0,300),
    contributionSummary:sanitizeTaskReportHtml(normalizedContribution.contributionSummary),
    contributionFindings:sanitizeTaskReportHtml(normalizedContribution.contributionFindings),
    contributionRecommendations:sanitizeTaskReportHtml(normalizedContribution.contributionRecommendations),
    evidenceReviewed:sanitizeTaskReportHtml(normalizedContribution.evidenceReviewed),
    contributionChallenges:sanitizeTaskReportHtml(normalizedContribution.contributionChallenges),
    contributionNextActions:sanitizeTaskReportHtml(normalizedContribution.contributionNextActions),
    workNotes:plainTaskReportText(normalizedContribution.workNotes),
    reportMode:normalizedContribution.reportMode,
    blankContent:sanitizeTaskReportHtml(normalizedContribution.blankContent)
  }
  if(['Integrated','Accepted'].includes(v.contributionStatus))return res.status(403).json({error:'Use the formal reviewer decision workflow to approve or finalise a task report.'})
  let submissionReviewer=null
  if(v.contributionStatus==='Ready for Integration'){
    const submissionText=taskReportSubmissionText(clean)
    if(!submissionText)return res.status(409).json({error:'Add report content before submitting this task report.'})
    if(!current.reviewer_id)return res.status(409).json({error:'Assign a reviewer before submitting this task report.'})
    submissionReviewer=(await query('SELECT id,name,active FROM users WHERE id=$1',[current.reviewer_id])).rows[0]
    if(!submissionReviewer||!submissionReviewer.active)return res.status(409).json({error:'The assigned reviewer is inactive or unavailable. Ask the assignment manager to choose another reviewer.'})
    if(current.owner_id===submissionReviewer.id||req.user.id===submissionReviewer.id)return res.status(409).json({error:'The task owner or the person completing this report cannot review the submitted version. Choose another reviewer before submission.'})
  }
  const assignment=(await query('SELECT title FROM assignments WHERE id=$1',[req.params.id])).rows[0]
  const reportTask={...current,notes:clean.workNotes,contribution_title:clean.contributionTitle,contribution_summary:clean.contributionSummary,contribution_findings:clean.contributionFindings,contribution_recommendations:clean.contributionRecommendations,evidence_reviewed:clean.evidenceReviewed,contribution_challenges:clean.contributionChallenges,contribution_next_actions:clean.contributionNextActions,report_mode:clean.reportMode,blank_content:clean.blankContent}
  const generated=buildTaskContributionReport({task:reportTask,assignment,ownerName:current.owner_name,preparedBy:req.user.name||current.owner_name})
  const row=await transaction(async client=>{
    // Re-check and lock the authoritative row inside the write transaction. A
    // delayed concurrent write must never revert a report that has been submitted.
    const locked=(await client.query(`SELECT id,owner_id,status,contribution_status,contribution_updated_at
      FROM assignment_tasks WHERE id=$1 AND assignment_id=$2 FOR UPDATE`,[req.params.taskId,req.params.id])).rows[0]
    if(!locked)throw Object.assign(new Error('Task not found.'),{statusCode:404})
    const lockedManager=isManagementRole(req.user.role)&&await canAccessAssignment(req.user,req.params.id)&&await canManageUser(req.user,locked.owner_id)
    if(locked.owner_id!==req.user.id&&!lockedManager)throw Object.assign(new Error('Only the task owner or a manager authorised for the owner can edit this task report.'),{statusCode:403})
    if(locked.status==='Completed')throw Object.assign(new Error('This task is completed and its report is locked. An authorised manager must reopen it for revision.'),{statusCode:409})
    if(locked.status==='Blocked')throw Object.assign(new Error('This task report is locked. Ask a manager to reopen it for revision.'),{statusCode:409})
    if(locked.contribution_status!=='Draft')throw Object.assign(new Error('This task report is no longer a draft. Refresh the workspace before continuing.'),{statusCode:409})
    const hasExpectedTimestamp=Object.prototype.hasOwnProperty.call(v,'expectedContributionUpdatedAt')
    if(hasExpectedTimestamp){
      const expectedRaw=v.expectedContributionUpdatedAt
      const expected=expectedRaw===null?null:typeof expectedRaw==='string'?new Date(expectedRaw).getTime():NaN
      const actual=locked.contribution_updated_at?new Date(locked.contribution_updated_at).getTime():null
      if(!hasExpectedTimestamp||(expected!==null&&!Number.isFinite(expected))||expected!==actual){
        throw Object.assign(new Error('The Task Report draft changed in another session. Copy any unsaved text, then reload the task before continuing.'),{statusCode:409})
      }
    }
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
      report_mode=$12::varchar,
      blank_content=$13::text,
      updated_at=NOW()
      WHERE id=$14 AND assignment_id=$15 AND owner_id=$16 AND status<>'Blocked' AND status<>'Completed' AND contribution_status='Draft' RETURNING *`,
      [clean.contributionTitle,clean.contributionSummary,clean.contributionFindings,clean.contributionRecommendations,clean.evidenceReviewed,clean.contributionChallenges,clean.contributionNextActions,clean.workNotes,v.contributionStatus,null,generated.html,clean.reportMode,clean.blankContent,req.params.taskId,req.params.id,locked.owner_id])).rows[0]
    if(!updated)throw Object.assign(new Error('The Task Report changed or was submitted while you were saving. Refresh the workspace before continuing.'),{statusCode:409})
    await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',
      [req.params.id,req.user.id,v.contributionStatus==='Draft'?'TASK_CONTRIBUTION_DRAFT_SAVED':'TASK_CONTRIBUTION_UPDATED',JSON.stringify({taskId:updated.id,title:updated.title,contributionStatus:updated.contribution_status})])
    await audit(client,req.user.id,v.contributionStatus==='Draft'?'ASSIGNMENT_TASK_CONTRIBUTION_DRAFT_SAVED':'ASSIGNMENT_TASK_CONTRIBUTION_UPDATED','assignment_task',updated.id,{assignmentId:req.params.id,contributionStatus:updated.contribution_status})
    if(v.contributionStatus==='Ready for Integration'){
      const snapshotJson=JSON.stringify(reportTask)
      await client.query(`INSERT INTO task_report_versions(task_id,version_number,report_snapshot,html_snapshot,snapshot_sha256,status,submitted_by,reviewer_id)
        VALUES($1,$2,$3::jsonb,$4,encode(digest(convert_to($3::jsonb::text,'UTF8'),'sha256'),'hex'),'Submitted',$5,$6)
        ON CONFLICT(task_id,version_number) DO NOTHING`,[updated.id,Number(updated.contribution_report_version),snapshotJson,generated.html,req.user.id,submissionReviewer.id])
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
    if(v.contributionStatus==='Draft'){
      const repositorySyncJobId=await enqueueRepositorySyncJob(client,{jobKind:'task_report_draft',entityId:updated.id,parentId:req.params.id,actor:req.user});
      updated.repository_sync_job_id=repositorySyncJobId;
      updated.repository_sync_status=repositorySyncJobId?'pending':'unavailable';
    }
    return updated
  })

  // The primary Task Report save and Repository outbox job have committed.
  // Do not render the Repository snapshot on the request path: the existing
  // queue worker handles it after this response, preserving fast Save Draft UX.
  const repositorySync=v.contributionStatus==='Draft'
    ? {
        repository_sync_job_id:row.repository_sync_job_id||null,
        repository_sync_status:row.repository_sync_job_id?'pending':'unavailable',
        repository_sync_message:row.repository_sync_job_id
          ? 'Task Report saved. Repository synchronization is queued and will finish in the background.'
          : 'Task Report saved, but Repository synchronization could not be queued. Contact the APP2 administrator to reconcile the draft.'
      }
    : {repository_sync_status:'not_requested'}

  let joined = row;
  let readbackWarning = '';
  try {
    const savedReadback = (await query(`SELECT t.*,u.name owner_name,reviewer.name reviewer_name,gd.title target_document_title,gds.title target_section_title,assignment_section.title assignment_section_title
    FROM assignment_tasks t LEFT JOIN users u ON u.id=t.owner_id
    LEFT JOIN users reviewer ON reviewer.id=t.reviewer_id
    LEFT JOIN generated_documents gd ON gd.id=t.target_document_id
    LEFT JOIN generated_document_sections gds ON gds.id=t.target_section_id
    LEFT JOIN assignment_sections assignment_section ON assignment_section.id=t.assignment_section_id
    WHERE t.id=$1`,[row.id])).rows[0];
    if (savedReadback) joined = savedReadback;
  } catch (readbackError) {
    readbackWarning = 'The Task Report was saved, but the server could not refresh its readback.';
    console.warn('TASK_REPORT_SAVE_READBACK_FAILED', { taskId: row.id, assignmentId: req.params.id, error: readbackError instanceof Error ? readbackError.message : String(readbackError) });
  }  res.json({...joined,...repositorySync,persistence_status:'saved',persistence_warning:readbackWarning||undefined})
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
    const submittedVersion=(await query('SELECT submitted_by FROM task_report_versions WHERE task_id=$1 AND version_number=$2 AND status=\'Submitted\'',[current.id,Number(current.contribution_report_version||0)])).rows[0]
    if(submittedVersion?.submitted_by===req.user.id)return res.status(403).json({error:'The person who completed and submitted this Task Report cannot review that submitted version.'})

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

      await client.query(`UPDATE task_report_versions SET status=$1,reviewed_by=$2,reviewed_at=NOW(),review_comments=$3
        WHERE task_id=$4 AND version_number=$5 AND status='Submitted'`,[decision,req.user.id,comments,row.id,Number(row.contribution_report_version||0)])

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
            AND (u.role IN('System Admin','Deputy Director') OR am.member_role='Lead')`,[managerBody,row.id,req.params.id,req.user.id])
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
  const manager=isManagementRole(req.user.role)
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
  const manager=isManagementRole(req.user.role)
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
  const approvedVersion=(await query(`SELECT * FROM task_report_versions WHERE task_id=$1 AND version_number=$2 AND status='Approved'`,[current.id,Number(current.contribution_report_version||0)])).rows[0]
  if(!approvedVersion)return res.status(409).json({error:'The immutable approved task report snapshot is unavailable. The reviewer must approve a submitted version before final generation.'})
  const approvedSnapshot=typeof approvedVersion.report_snapshot==='string'?JSON.parse(approvedVersion.report_snapshot):approvedVersion.report_snapshot
  if(!approvedSnapshot||typeof approvedSnapshot!=='object')return res.status(409).json({error:'The approved task report snapshot is invalid and cannot be finalised.'})
  const approvedTask={...current,...approvedSnapshot}
  const assignment={title:current.assignment_title}
  const report=buildTaskContributionReport({task:approvedTask,assignment,ownerName:current.owner_name,preparedBy:current.owner_name})
  const approvalDate=new Date(current.contribution_integrated_at||Date.now())
  const approvalTime=new Intl.DateTimeFormat('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'}).format(approvalDate)
  const reviewerName=current.reviewer_name||req.user.name||'Authorised reviewer'
  const approvalBlock=`<section class="section"><h2>Review and Approval</h2><div class="callout"><p><strong>Status:</strong> FINAL — APPROVED</p><p><strong>Reviewed and approved by:</strong> ${escapeContributionHtml(reviewerName)}</p><p><strong>Approval date:</strong> ${escapeContributionHtml(approvalTime)}</p><p><strong>Task report version:</strong> ${Number(current.contribution_report_version||1)}</p></div></section>`
  const finalHtml=report.html.replace('</main>',`${approvalBlock}</main>`).replace('Generated by APP2 from the task contribution record. Review this report before sending it for integration.','Final task report generated by APP2 from the reviewer-approved task contribution record.')

  // Generate the immutable, PSC-gold PDF repository copy from the reviewer-approved snapshot.
  // The same reviewer approval authorises immediate publication and task completion.
  const repositoryTitle=plainTaskReportText(current.contribution_title)||`${current.title} — Final Task Report`
  const approvedReportMode=approvedSnapshot.report_mode??current.report_mode??'structured'
  const approvedBlankContent=sanitizeTaskReportHtml(approvedSnapshot.blank_content??current.blank_content)
  const approvalSection={title:'Review and Approval',content:`Status: FINAL — APPROVED\nReviewed and approved by: ${reviewerName}\nApproval date: ${approvalTime}\nTask report version: ${Number(current.contribution_report_version||1)}`}
  const repositorySections=approvedReportMode==='blank'
    ? [
        {title:'',content:approvedBlankContent,heading:false},
        approvalSection
      ]
    : [
        {title:'Task Purpose',content:plainTaskReportText(approvedTask.task_purpose||approvedTask.description)},
        {title:'Instructions',content:plainTaskReportText(approvedTask.specific_instructions)},
        {title:'Expected Contribution',content:plainTaskReportText(approvedTask.expected_contribution)},
        {title:'Work Completed',content:sanitizeTaskReportHtml(approvedTask.contribution_summary||approvedTask.notes)},
        {title:'Evidence Reviewed',content:sanitizeTaskReportHtml(approvedTask.evidence_reviewed)},
        {title:'Key Findings',content:sanitizeTaskReportHtml(approvedTask.contribution_findings)},
        {title:'Challenges and Limitations',content:sanitizeTaskReportHtml(approvedTask.contribution_challenges)},
        {title:'Recommendations',content:sanitizeTaskReportHtml(approvedTask.contribution_recommendations)},
        {title:'Next Actions',content:sanitizeTaskReportHtml(approvedTask.contribution_next_actions)},
        approvalSection
      ]
  finalizationStage='generate-pdf'
  const finalPdf=await buildPscTaskFinalPdf(repositoryTitle,{
    Assignment:current.assignment_title,
    Task:current.title,
    'Prepared by':current.owner_name||'Task owner',
    'Reviewed and approved by':reviewerName,
    Status:'FINAL — APPROVED',
    Version:Number(current.contribution_report_version||1),
    'Approval date':approvalTime
  },repositorySections)
  const safeBase=String(current.title||'task-report').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,90)||'task-report'
  const originalName=`${safeBase}-final-v${Number(current.contribution_report_version||1)}.pdf`
  finalizationStage='store-pdf'
  const stored=await storeDocument(finalPdf,'.pdf')
  storedFinalPath=stored.absolutePath
  const sha256=crypto.createHash('sha256').update(finalPdf).digest('hex')
  const mimeType='application/pdf' 

  finalizationStage='publish-repository'
  const result=await transaction(async client=>{
    const locked=(await client.query('SELECT contribution_status FROM assignment_tasks WHERE id=$1 AND assignment_id=$2 FOR UPDATE',[req.params.taskId,req.params.id])).rows[0]
    if(!locked)throw Object.assign(new Error('Task not found.'),{statusCode:404})
    if(locked.contribution_status!=='Integrated')throw Object.assign(new Error('This task report is no longer awaiting final generation. Refresh the workspace.'),{statusCode:409})
    const immutable=(await client.query("SELECT id FROM task_report_versions WHERE task_id=$1 AND version_number=$2 AND status='Approved' FOR UPDATE",[current.id,Number(current.contribution_report_version||0)])).rows[0]
    if(!immutable)throw Object.assign(new Error('The approved immutable task report version is no longer available.'),{statusCode:409})

    const category=(await client.query("SELECT id FROM document_categories WHERE name='Assignment Reports' LIMIT 1")).rows[0]||null
    const description=`Final approved task report for “${current.title}” under assignment “${current.assignment_title}”. Prepared by ${current.owner_name||'the task owner'} and approved by ${reviewerName}.`
    const tags=['final-report','task-report','approved']
    const promotedTaskReport=await promotePrivateDraftToPublished({
      client,
      actor:req.user,
      entityType:'task',
      entityId:current.id,
      draftDocumentType:'Task Report Draft',
      finalDocumentType:'Task Final Report',
      title:repositoryTitle,
      description,
      categoryName:'Assignment Reports',
      categoryId:category?.id||null,
      tags,
      author:current.owner_name||null,
      subject:current.assignment_title,
      sourceType:'Task',
      directorate:current.assignment_division||null,
      classification:'INTERNAL',
      approvedBy:req.user.id,
      approvedAt:new Date(),
      originalName,
      stored,
      mimeType,
      bytes:finalPdf,
      sha256,
      notes:'Automatically generated PSC-branded PDF from reviewer-approved task report',
      assignmentId:req.params.id,
      audit
    })
    const item=promotedTaskReport.item
    const version=promotedTaskReport.version
    await client.query("UPDATE task_report_versions SET status='Finalised',finalised_by=$1,finalised_at=NOW() WHERE id=$2",[req.user.id,immutable.id])
    const archivedTaskDrafts=await archivePrivateOperationalDrafts({
      client,
      actor:req.user,
      entityType:'task',
      entityId:current.id,
      documentTypes:['Task Draft'],
      finalRepositoryDocumentId:item.id,
      audit
    })

    finalizationStage='publish-tags'
    for(const tag of tags){
      const tagRow=(await client.query('INSERT INTO document_tags(name,normalized_name,created_by)VALUES($1::varchar,lower($1::text)::varchar,$2::uuid)ON CONFLICT(normalized_name)DO UPDATE SET name=EXCLUDED.name RETURNING id',[tag,req.user.id])).rows[0]
      await client.query('INSERT INTO document_tag_links(knowledge_id,tag_id)VALUES($1::uuid,$2::uuid)ON CONFLICT DO NOTHING',[item.id,tagRow.id])
    }
    finalizationStage='link-repository-source'
    // Repository origin links are preserved by promotePrivateDraftToPublished.

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
      req.params.id,req.user.id,'TASK_FINAL_REPORT_GENERATED',JSON.stringify({taskId:row.id,title:row.title,reviewerId:req.user.id,reportVersion:Number(row.contribution_report_version||0),repositoryDocumentId:item.id,repositoryVersionId:version.id,preservedDraftLineage:promotedTaskReport.preservedDraftLineage,archivedOperationalDrafts:archivedTaskDrafts.length})
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
    await audit(client,req.user.id,'ASSIGNMENT_TASK_FINAL_REPORT_GENERATED','assignment_task',row.id,{assignmentId:req.params.id,reportVersion:Number(row.contribution_report_version||0),repositoryDocumentId:item.id,preservedDraftLineage:promotedTaskReport.preservedDraftLineage,archivedOperationalDrafts:archivedTaskDrafts.length})
    await audit(client,req.user.id,'DOCUMENT_AUTO_PUBLISHED_FROM_TASK','knowledge',item.id,{assignmentId:req.params.id,taskId:row.id,version:1,sha256,approvedBy:req.user.id})
    finalizationStage='enqueue-felix-index'
    await enqueueFelixDocumentIndex(client,item.id,1,req.user.id)
    finalizationStage='sync-assignment-status'
    await syncAssignmentStatusFromTasks(client,req.params.id,req.user.id)
    await syncResearchMilestonesFromTasks(client,req.params.id,req.user.id)
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
  const delegatedManager=isManagementRole(req.user.role)&&await canManageUser(req.user,current.owner_id)
  if(current.owner_id!==req.user.id&&!delegatedManager)return res.status(403).json({error:'Only the task owner or a manager authorised for the owner can edit task-report content. Reviewers record decisions without rewriting the submitted report.'})
  if(current.status==='Blocked'||current.contribution_status!=='Draft')return res.status(409).json({error:'This task report is locked for the current workflow stage.'})
  if(status!=='Draft')return res.status(403).json({error:'Section review state is controlled by the formal task-report workflow.'})
  const columns={title:'contribution_title',workCompleted:'contribution_summary',evidence:'evidence_reviewed',findings:'contribution_findings',recommendations:'contribution_recommendations',challenges:'contribution_challenges',nextActions:'contribution_next_actions'}
  const column=columns[sectionKey]
  const cleanedContent=plainTaskReportText(content)
  const sectionContent=sectionKey==='title'?cleanedContent.slice(0,300):cleanedContent
  const updated=await transaction(async client=>{const row=(await client.query(`UPDATE assignment_tasks SET ${column}=$3::text,contribution_section_statuses=jsonb_set(COALESCE(contribution_section_statuses,'{}'::jsonb),ARRAY[$4::text],to_jsonb($5::text),true),contribution_updated_at=NOW(),updated_at=NOW() WHERE id=$1 AND assignment_id=$2 RETURNING *`,[req.params.taskId,req.params.id,sectionContent,sectionKey,status])).rows[0];await audit(client,req.user.id,'TASK_REPORT_SECTION_SAVED','assignment_task',row.id,{assignmentId:req.params.id,sectionKey,status});return row})
  res.json(updated)
}catch(error){next(error)}})

app.post('/api/assignments/:id/tasks/:taskId/archive',authenticate,authorize('System Admin','Deputy Director'),async(req,res,next)=>{try{
  const row=await transaction(async client=>{
    const task=(await client.query('SELECT * FROM assignment_tasks WHERE id=$1 AND assignment_id=$2 FOR UPDATE',[req.params.taskId,req.params.id])).rows[0]
    if(!task)return null
    if(task.archived_at)return task
    const hasMilestoneLink=(await client.query('SELECT 1 FROM research_milestone_tasks WHERE task_id=$1 LIMIT 1',[task.id])).rowCount>0
    if(hasMilestoneLink)throw Object.assign(new Error('This task is linked to a research milestone. Unlink it from the milestone before archiving the task.'),{statusCode:409})
    const updated=(await client.query('UPDATE assignment_tasks SET archived_at=NOW(),archived_by=$1,updated_at=NOW() WHERE id=$2 AND assignment_id=$3 RETURNING *',[req.user.id,req.params.taskId,req.params.id])).rows[0]
    await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'TASK_ARCHIVED',JSON.stringify({taskId:updated.id,title:updated.title})])
    await syncAssignmentStatusFromTasks(client,req.params.id,req.user.id)
    await syncResearchMilestonesFromTasks(client,req.params.id,req.user.id)
    await audit(client,req.user.id,'ASSIGNMENT_TASK_ARCHIVED','assignment_task',updated.id,{assignmentId:req.params.id,title:updated.title})
    return updated
  })
  if(!row)return res.status(404).json({error:'Task not found.'})
  res.json(row)
}catch(error){next(error)}})
app.delete('/api/assignments/:id/tasks/:taskId',authenticate,authorize('System Admin','Deputy Director'),validate(z.object({reason:z.string().trim().min(10).max(1000)})),async(req,res,next)=>{try{
  const result=await transaction(async client=>{
    const task=(await client.query(`SELECT t.*,
    EXISTS(
      SELECT 1 FROM repository_entity_links rel
      WHERE rel.entity_type='task' AND rel.entity_id=t.id
    ) has_repository_record,
    EXISTS(
      SELECT 1 FROM assignment_report_sources ars
      WHERE ars.task_id=t.id
    ) has_assignment_report_source,
    EXISTS(
      SELECT 1 FROM research_milestone_tasks mt
      WHERE mt.task_id=t.id
    ) has_milestone_link
    FROM assignment_tasks t WHERE t.id=$1 AND t.assignment_id=$2 FOR UPDATE`,[req.params.taskId,req.params.id])).rows[0]
    if(!task)return null
    if(task.has_milestone_link)throw Object.assign(new Error('This task is linked to a research milestone. Unlink it from the milestone before deleting or archiving the task.'),{statusCode:409})
    if(task.status==='Completed'||task.contribution_status!=='Draft'||task.has_repository_record||task.has_assignment_report_source){
      throw Object.assign(new Error('This task is already part of the formal assignment reporting record and cannot be deleted. Archive it instead so report provenance is preserved.'),{statusCode:409})
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
    const isContextualReviewer=(await query(`SELECT 1 WHERE EXISTS(SELECT 1 FROM assignment_members WHERE assignment_id=$1 AND user_id=$2 AND member_role='Reviewer') OR EXISTS(SELECT 1 FROM assignment_tasks WHERE assignment_id=$1 AND reviewer_id=$2)`,[req.params.id,req.user.id])).rowCount>0
    if(req.validated.decision!=='Submitted'&&!(isManagementRole(req.user.role)||isContextualReviewer))return res.status(403).json({error:'Only an assigned reviewer or manager can record a review decision.'})
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

// Draft repository visibility:
 // - ordinary users: own Draft items only
 // - team/organisation supervisors: Draft items owned within managed scope
 // - Published items retain normal repository visibility
 // Auto-generated private drafts deliberately have reviewer_id=NULL and felix_enabled=FALSE.
app.get('/api/knowledge',authenticate,async(req,res,next)=>{try{const search=String(req.query.search||'').trim();const category=String(req.query.category||'').trim();const status=String(req.query.status||'').trim();const scoped=canManageKnowledge(req.user)?await managedUserIds(req.user):[req.user.id],privileged=scoped===null,scopeIds=scoped||[req.user.id],privateDraftScopeIds=isManagementRole(req.user.role)?await privateDraftSupervisedUserIds(req.user.id):[];const result=await query(`SELECT k.*,u.name created_by_name,reviewer.name reviewer_name,reviewed.name reviewed_by_name,approver.name approved_by_name,COALESCE((SELECT json_agg(json_build_object('id',a.id,'title',a.title)) FROM knowledge_assignment_links l JOIN assignments a ON a.id=l.assignment_id WHERE l.knowledge_id=k.id),'[]') assignments,COALESCE((SELECT json_agg(json_build_object('type',rel.entity_type,'id',rel.entity_id,'title',CASE rel.entity_type WHEN 'assignment' THEN(SELECT title FROM assignments WHERE id=rel.entity_id)WHEN 'task' THEN(SELECT title FROM assignment_tasks WHERE id=rel.entity_id)WHEN 'research' THEN(SELECT title FROM research_projects WHERE id=rel.entity_id)WHEN 'report' THEN(SELECT title FROM generated_documents WHERE id=rel.entity_id)END))FROM repository_entity_links rel WHERE rel.knowledge_id=k.id),'[]') origin_links,COALESCE((SELECT MAX(v.version_number)FROM knowledge_versions v WHERE v.knowledge_id=k.id),0)latest_version,COALESCE((SELECT v.original_name FROM knowledge_versions v WHERE v.knowledge_id=k.id ORDER BY v.version_number DESC LIMIT 1),'')original_name,(SELECT COUNT(*)::int FROM knowledge_downloads d WHERE d.knowledge_id=k.id) download_count FROM knowledge_items k JOIN users u ON u.id=k.created_by LEFT JOIN users reviewer ON reviewer.id=k.reviewer_id LEFT JOIN users reviewed ON reviewed.id=k.reviewed_by LEFT JOIN users approver ON approver.id=k.approved_by WHERE($1::boolean OR k.status='Published' OR k.created_by=$2 OR k.reviewer_id=$2 OR k.created_by=ANY($6::uuid[]) OR k.reviewer_id=ANY($6::uuid[]) OR k.approved_by=ANY($6::uuid[]) OR EXISTS(SELECT 1 FROM document_permissions permission WHERE permission.knowledge_id=k.id AND permission.permission IN('READ','WRITE') AND(permission.user_id=$2 OR permission.role=$7)))AND(
  NOT(
    k.status='Draft' AND
    k.document_type IN('Assignment Draft','Task Draft','Task Report Draft','Assignment Report Draft','Meeting Minutes Draft')
  )
  OR k.created_by=$2
  OR k.created_by=ANY($8::uuid[])
)AND($3='' OR k.category=$3)AND($4='' OR k.status=$4)AND($5='' OR to_tsvector('english',k.title||' '||k.description||' '||COALESCE(k.author,''))@@plainto_tsquery('english',$5) OR $5=ANY(k.tags)) ORDER BY k.updated_at DESC`,[privileged,req.user.id,category,status,search,scopeIds,req.user.role,privateDraftScopeIds]);res.json(result.rows)}catch(error){next(error)}})
app.post('/api/knowledge',authenticate,async(req,res,next)=>{
  let storedPath
  try{
    if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({error:'Choose a non-empty file to upload.'})
    const checked=validateDocumentUpload(req.body,decodeHeader(req.headers['x-file-name']||'document.bin'),req.headers['x-file-type'])
    const {originalName}=checked
    const parsed=knowledgeSchema.safeParse({title:decodeHeader(req.headers['x-title']),description:decodeHeader(req.headers['x-description']),category:decodeHeader(req.headers['x-category']),categoryId:req.headers['x-category-id']||null,tags:decodeHeader(req.headers['x-tags']).split(',').map(tag=>tag.trim()).filter(Boolean),author:req.headers['x-author']?decodeHeader(req.headers['x-author']):null,documentDate:req.headers['x-document-date']?decodeHeader(req.headers['x-document-date']):null,sourceType:decodeHeader(req.headers['x-source-type']||'App2 Upload'),sourceUrl:decodeHeader(req.headers['x-source-url']||''),originEntityId:req.headers['x-origin-entity-id']?String(req.headers['x-origin-entity-id']):null,directorate:req.headers['x-directorate']?decodeHeader(req.headers['x-directorate']):null,documentType:decodeHeader(req.headers['x-document-type']||'Document'),subject:decodeHeader(req.headers['x-subject']||''),classification:decodeHeader(req.headers['x-classification']||'INTERNAL'),felixEnabled:String(req.headers['x-felix-enabled']).toLowerCase()!=='false'}),reviewerId=String(req.headers['x-reviewer-id']||'')
    if(!parsed.success)return res.status(400).json({error:'Please correct the document metadata.',details:parsed.error.flatten()})
    const {title,description,category,categoryId,tags,author,documentDate,sourceType,sourceUrl,originEntityId,directorate,documentType,subject,classification,felixEnabled}=parsed.data
    const governedWorkspaceSource=['Research','Assignment','Task','App2 Report'].includes(sourceType)&&Boolean(originEntityId)
    if(!reviewerId&&!governedWorkspaceSource)return res.status(400).json({error:'Choose a reviewer before uploading this document.'})
    if(reviewerId&&reviewerId===req.user.id)return res.status(400).json({error:'You cannot review your own repository document.'})
    let reviewer=null
    if(reviewerId){
      if(!z.string().uuid().safeParse(reviewerId).success)return res.status(400).json({error:'Choose a valid reviewer before uploading this document.'})
      reviewer=(await query("SELECT id,name FROM users WHERE id=$1 AND active=TRUE",[reviewerId])).rows[0]
      if(!reviewer)return res.status(400).json({error:'Choose an active authorised document reviewer.'})
      if(isTeamScopeRole(req.user.role)){const ids=await managedUserIds(req.user);if(!ids.includes(reviewer.id))return res.status(403).json({error:'Choose a reviewer from your reporting subtree.'})}
    }
    if(sourceType==='Internet'&&!/^https?:\/\//i.test(sourceUrl))return res.status(400).json({error:'Internet documents require a valid source URL.'})
    if(['Research','Assignment','Task','App2 Report'].includes(sourceType)&&!originEntityId)return res.status(400).json({error:`${sourceType} documents must identify their originating APP2 record.`})
    const entityType=sourceType==='Research'?'research':sourceType==='Assignment'?'assignment':sourceType==='Task'?'task':sourceType==='App2 Report'?'report':null
    if(originEntityId){
      const permitted=entityType==='assignment'?await canAccessAssignment(req.user,originEntityId):entityType==='research'?await canAccessResearch(req.user,originEntityId):entityType==='task'?Boolean((await query('SELECT 1 FROM assignment_tasks t WHERE t.id=$1 AND(t.owner_id=$2 OR EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=t.assignment_id AND am.user_id=$2))',[originEntityId,req.user.id])).rowCount):entityType==='report'?Boolean((await query('SELECT 1 FROM generated_documents WHERE id=$1 AND(created_by=$2 OR reviewer_id=$2)',[originEntityId,req.user.id])).rowCount):true
      if(!permitted)return res.status(403).json({error:'You cannot link this source record.'})
    }
    const stored=await storeDocument(req.body,checked.extension);storedPath=stored.absolutePath
    const created=await transaction(async client=>{
      const item=(await client.query('INSERT INTO knowledge_items(title,description,category,category_id,tags,author,document_date,source_type,source_url,created_by,current_version,directorate,document_type,subject,classification,felix_enabled,reviewer_id)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,$11,$12,$13,$14,$15,$16)RETURNING *',[title,description,category,categoryId,[...new Set(tags)],author||null,documentDate||null,sourceType,sourceUrl,req.user.id,directorate,documentType,subject,classification,felixEnabled,reviewer?.id||null])).rows[0]
      item.record_number=await ensureRepositoryRecordNumber(client,item)
      const version=(await client.query('INSERT INTO knowledge_versions(knowledge_id,version_number,uploader_id,original_name,stored_name,storage_path,mime_type,size_bytes,sha256_hash,is_current)VALUES($1,1,$2,$3,$4,$5,$6,$7,$8,TRUE)RETURNING id,version_number,original_name,mime_type,size_bytes,sha256_hash,is_current,notes,created_at',[item.id,req.user.id,originalName,stored.storedName,stored.storagePath,checked.mimeType,req.body.length,checked.sha256])).rows[0]
      for(const tag of [...new Set(tags.map(value=>value.trim()).filter(Boolean))]){const tagRow=(await client.query('INSERT INTO document_tags(name,normalized_name,created_by)VALUES($1,lower($1),$2)ON CONFLICT(normalized_name)DO UPDATE SET name=EXCLUDED.name RETURNING id',[tag,req.user.id])).rows[0];await client.query('INSERT INTO document_tag_links(knowledge_id,tag_id)VALUES($1,$2)ON CONFLICT DO NOTHING',[item.id,tagRow.id])}
      if(entityType&&originEntityId)await client.query('INSERT INTO repository_entity_links(knowledge_id,entity_type,entity_id,linked_by)VALUES($1,$2,$3,$4)ON CONFLICT DO NOTHING',[item.id,entityType,originEntityId,req.user.id])
      if(entityType==='assignment'&&originEntityId)await client.query('INSERT INTO knowledge_assignment_links(knowledge_id,assignment_id,linked_by)VALUES($1,$2,$3)ON CONFLICT DO NOTHING',[item.id,originEntityId,req.user.id])
      if(reviewer){await client.query("INSERT INTO document_reviews(knowledge_id,reviewer_id,actor_id,action,comments)VALUES($1,$2,$3,'ASSIGNED',$4)",[item.id,reviewer.id,req.user.id,`Assigned to ${reviewer.name} during upload`]);await audit(client,req.user.id,'DOCUMENT_REVIEW_ASSIGNED','knowledge',item.id,{reviewerId:reviewer.id,source:'upload'})}
      await audit(client,req.user.id,'DOCUMENT_UPLOADED','knowledge',item.id,{title,category,classification,felixEnabled,version:1,sha256:checked.sha256,sourceType,sourceUrl,entityType,originEntityId,reviewerId:reviewer?.id||null,reviewRequiredBeforeSubmission:true})
      return {...item,version}
    })
    res.status(201).json(created)
  }catch(error){if(storedPath)await fs.unlink(storedPath).catch(()=>{});next(error)}
})
app.patch('/api/knowledge/:id',authenticate,validate(knowledgeSchema),async(req,res,next)=>{try{const existing=(await query('SELECT * FROM knowledge_items WHERE id=$1',[req.params.id])).rows[0];if(!existing)return res.status(404).json({error:'Knowledge item not found.'});if(isPrivateRepositoryDraft(existing)&&!await canAccessPrivateRepositoryDraft(req.user,existing))return res.status(403).json({error:'This private draft is limited to its owner and authorised supervisors.'});const managerForItem=isOrganisationScopeRole(req.user.role)||isTeamScopeRole(req.user.role)&&await canManageKnowledgeScope(req.user,req.params.id);if(!managerForItem&&existing.created_by!==req.user.id)return res.status(403).json({error:'You cannot edit this knowledge item.'});if(existing.status==='Published'&&!managerForItem)return res.status(403).json({error:'Only a manager can edit published knowledge.'});const {title,description,category,tags,author,documentDate}=req.validated;const updated=await transaction(async client=>{const row=(await client.query('UPDATE knowledge_items SET title=$1,description=$2,category=$3,tags=$4,author=$5,document_date=$6,updated_at=NOW() WHERE id=$7 RETURNING *',[title,description,category,[...new Set(tags.map(tag=>tag.trim()))],author||null,documentDate||null,req.params.id])).rows[0];await audit(client,req.user.id,'KNOWLEDGE_UPDATED','knowledge',req.params.id,{title,category});return row});res.json(updated)}catch(error){next(error)}})
app.post('/api/knowledge/:id/versions',authenticate,async(req,res,next)=>{let storedPath;try{const item=(await query('SELECT * FROM knowledge_items WHERE id=$1',[req.params.id])).rows[0];if(!item)return res.status(404).json({error:'Knowledge item not found.'});if(isPrivateRepositoryDraft(item)&&!await canAccessPrivateRepositoryDraft(req.user,item))return res.status(403).json({error:'This private draft is limited to its owner and authorised supervisors.'});const managerForItem=await isKnowledgeManagerFor(req.user,req.params.id);const improvementAccess=(await query("SELECT id FROM document_improvement_assignments WHERE knowledge_id=$1 AND assignee_id=$2 AND status IN('Assigned','In Progress') LIMIT 1",[req.params.id,req.user.id])).rows[0];if(!managerForItem&&item.created_by!==req.user.id&&!improvementAccess)return res.status(403).json({error:'You cannot upload a version for this item.'});const checked=validateDocumentUpload(req.body,decodeHeader(req.headers['x-file-name']||'document.bin'),req.headers['x-file-type']);const duplicate=(await query('SELECT v.id,v.version_number,k.id document_id,k.title,v.created_at upload_date FROM knowledge_versions v JOIN knowledge_items k ON k.id=v.knowledge_id WHERE v.sha256_hash=$1',[checked.sha256])).rows[0];if(duplicate)return res.status(409).json({error:`This exact file is already stored as Ã¢â‚¬Å“${duplicate.title}Ã¢â‚¬Â (version ${duplicate.version_number}).`,duplicate:{...duplicate,sha256_hash:checked.sha256}});const stored=await storeDocument(req.body,checked.extension);storedPath=stored.absolutePath;const created=await transaction(async client=>{const locked=(await client.query('SELECT current_version FROM knowledge_items WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];const improvement=(await client.query("SELECT * FROM document_improvement_assignments WHERE knowledge_id=$1 AND status IN('Assigned','In Progress','Submitted') ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[req.params.id])).rows[0];if(improvement?.status==='Submitted')throw Object.assign(new Error('This improvement is already submitted for reviewer decision. The reviewer must complete or cancel it before another version can be uploaded.'),{status:409});const number=Number((await client.query('SELECT COALESCE(MAX(version_number),0)+1 number FROM knowledge_versions WHERE knowledge_id=$1',[req.params.id])).rows[0].number);const candidate=Boolean(improvement);const row=(await client.query('INSERT INTO knowledge_versions(knowledge_id,version_number,uploader_id,original_name,stored_name,storage_path,mime_type,size_bytes,sha256_hash,notes,is_current) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,version_number,original_name,mime_type,size_bytes,sha256_hash,is_current,notes,created_at',[req.params.id,number,req.user.id,checked.originalName,stored.storedName,stored.storagePath,checked.mimeType,req.body.length,checked.sha256,String(req.headers['x-version-notes']||'').slice(0,1000),!candidate])).rows[0];if(!candidate){await client.query("UPDATE knowledge_versions SET is_current=FALSE WHERE knowledge_id=$1 AND id<>$2",[req.params.id,row.id]);await client.query("UPDATE knowledge_items SET current_version=$1,status=CASE WHEN status='Published' THEN 'Draft' ELSE status END,approved_by=NULL,approved_at=NULL,updated_at=NOW() WHERE id=$2",[number,req.params.id])}await audit(client,req.user.id,'DOCUMENT_VERSION_UPLOADED','knowledge',req.params.id,{version:number,name:checked.originalName,sha256:checked.sha256,improvementAssignmentId:improvement?.id||null,pendingReviewerApproval:candidate});return row});res.status(201).json(created)}catch(error){if(storedPath)await fs.unlink(storedPath).catch(()=>{});if(error.status)return res.status(error.status).json({error:error.message});next(error)}})
app.get('/api/knowledge/:id/versions',authenticate,async(req,res,next)=>{try{if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot view this knowledge item.'});res.json((await query('SELECT v.id,v.version_number,v.original_name,v.mime_type,v.size_bytes,v.notes,v.created_at,u.name uploader_name FROM knowledge_versions v JOIN users u ON u.id=v.uploader_id WHERE v.knowledge_id=$1 ORDER BY v.version_number DESC',[req.params.id])).rows)}catch(error){next(error)}})
app.get('/api/knowledge/versions/:versionId/download',authenticate,async(req,res,next)=>{try{
  const version=(await query(`SELECT v.*,k.status,k.created_by,k.title document_title,k.document_type,k.classification,k.author,k.category,k.directorate,k.current_version,k.updated_at,k.subject,u.name uploader_name,reviewer.name reviewer_name,
      report_control.reference report_reference,report_control.assignment_title
    FROM knowledge_versions v JOIN knowledge_items k ON k.id=v.knowledge_id JOIN users u ON u.id=v.uploader_id LEFT JOIN users reviewer ON reviewer.id=k.reviewer_id
    LEFT JOIN LATERAL(SELECT gd.reference,assignment.title assignment_title FROM repository_entity_links rel JOIN generated_documents gd ON gd.id=rel.entity_id AND rel.entity_type='report' LEFT JOIN assignments assignment ON gd.context='Assignment' AND assignment.id=gd.context_id WHERE rel.knowledge_id=k.id ORDER BY rel.created_at DESC LIMIT 1) report_control ON TRUE
    WHERE v.id=$1`,[req.params.versionId])).rows[0]
  if(!version)return res.status(404).json({error:'Document version not found.'})
  if(!await canReadKnowledge(req.user,version.knowledge_id))return res.status(403).json({error:'You cannot download this document.'})
  let pdfBytes=null
  if(version.mime_type!=='application/pdf'&&path.extname(version.original_name).toLowerCase()!=='.pdf'){
    const rendered=await renderReadableVersion(version)
    const firstRow=rendered.html?.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i)?.[1]||''
    const columnCount=(firstRow.match(/<t[dh]\b/gi)||[]).length
    const title=version.document_title||version.original_name.replace(/\.[^.]+$/,'')
    pdfBytes=await buildPscTaskFinalPdf(title,{
      'Report reference':version.report_reference||`DOC-${String(version.knowledge_id).replaceAll('-','').slice(0,8).toUpperCase()}`,
      'Assignment':version.assignment_title||version.subject||version.document_title,
      'Document type':version.document_type||'Repository document',
      'Prepared by':version.author||version.uploader_name||'Not recorded',
      'Reviewer':version.reviewer_name||'Not assigned',
      'Version':`v${version.version_number}${version.is_current?' · Current':''}`,
      'Status':version.status||'Draft',
      'Classification':version.classification||'INTERNAL',
      'Last updated':version.updated_at?new Date(version.updated_at).toLocaleString('en-GB',{timeZone:'Africa/Nairobi'}):'Not recorded',
    },[{heading:false,content:rendered.html}],{layout:columnCount>5?'landscape':'portrait'})
  }
  await transaction(async client=>{await client.query('INSERT INTO knowledge_downloads(knowledge_id,version_id,user_id) VALUES($1,$2,$3)',[version.knowledge_id,version.id,req.user.id]);await audit(client,req.user.id,'DOCUMENT_DOWNLOADED','knowledge',version.knowledge_id,{versionId:version.id,version:version.version_number,downloadFormat:pdfBytes?'PDF':'Original PDF'})})
  if(pdfBytes){const baseName=path.basename(version.original_name,path.extname(version.original_name)).replace(/[\\/:*?"<>|]/g,'_')||'document';res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(`${baseName}.pdf`)}`);return res.send(pdfBytes)}
  res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(version.original_name)}`);return res.sendFile(resolveDocumentPath(version.storage_path||version.stored_name))
}catch(error){
  const diagnosticId=crypto.randomUUID()
  console.error(`[${diagnosticId}] Repository PDF version export failed:`,error)
  if(!res.headersSent)return res.status(503).json({error:`APP2 could not prepare this PDF. Diagnostic reference: ${diagnosticId}.`,diagnosticId})
  next(error)
}})
app.patch('/api/knowledge/:id/status',authenticate,validate(z.object({status:z.enum(['Draft','Pending Approval','Published','Rejected','Archived']),reason:z.string().max(1000).optional()})),async(req,res,next)=>{try{const item=(await query('SELECT * FROM knowledge_items WHERE id=$1',[req.params.id])).rows[0];if(!item)return res.status(404).json({error:'Knowledge item not found.'});if(await activeExternalResearchForKnowledge(req.params.id))return res.status(409).json({error:'This document is controlled by the Imported Research reader. Record review decisions from Research Repository > Imported Research.'});const target=req.validated.status;const managerForItem=isOrganisationScopeRole(req.user.role)||isTeamScopeRole(req.user.role)&&await canManageKnowledgeScope(req.user,req.params.id);if(['Published','Rejected'].includes(target))await requireDocumentReadBeforeDecision(req.user,req.params.id);if(['Published','Rejected'].includes(target)&&(item.reviewer_id!==req.user.id||item.created_by===req.user.id))return res.status(403).json({error:'Only the assigned reviewer can approve or reject this document, and self-review is not permitted.'});if(target==='Archived'&&!managerForItem)return res.status(403).json({error:'Only a repository manager can archive knowledge.'});if(['Draft','Pending Approval'].includes(target)&&!managerForItem&&item.created_by!==req.user.id)return res.status(403).json({error:'You cannot submit this knowledge item.'});if(target==='Pending Approval'&&!item.reviewer_id)return res.status(409).json({error:'Assign a reviewer before submitting this document.'});if(target==='Pending Approval'&&item.reviewer_id===item.created_by)return res.status(409).json({error:'The document owner cannot review their own upload.'});if(target==='Published'&&item.current_version<1)return res.status(400).json({error:'Upload a document version before publishing.'});const updated=await transaction(async client=>{const approved=target==='Published';const row=(await client.query("UPDATE knowledge_items SET status=$1,is_archived=($1='Archived'),reviewed_by=CASE WHEN $1 IN('Published','Rejected') THEN $2 ELSE reviewed_by END,reviewed_at=CASE WHEN $1 IN('Published','Rejected') THEN NOW() ELSE reviewed_at END,approved_by=$3,approved_at=$4,rejection_reason=$5,updated_at=NOW() WHERE id=$6 RETURNING *",[target,req.user.id,approved?req.user.id:null,approved?new Date():null,target==='Rejected'?(req.validated.reason||'Not approved'):null,req.params.id])).rows[0];if(approved)await client.query('UPDATE knowledge_versions SET approved_by=$1,approved_at=NOW() WHERE knowledge_id=$2 AND is_current=TRUE',[req.user.id,row.id]);await audit(client,req.user.id,`DOCUMENT_${target.toUpperCase().replaceAll(' ','_')}`,'knowledge',req.params.id,{reason:req.validated.reason});if(target==='Published'&&row.felix_enabled)await enqueueFelixDocumentIndex(client,row.id,row.current_version,req.user.id);if(target==='Archived')await client.query("UPDATE felix_document_index_jobs SET status='Failed',last_error='Document archived',updated_at=NOW() WHERE knowledge_id=$1 AND status IN('Pending','Processing','Completed')",[row.id]);return row});res.json(updated)}catch(error){next(error)}})
app.patch('/api/knowledge/:id/approve',authenticate,authorize('System Admin','Deputy Director','Reviewer'),validate(z.object({approved:z.boolean().default(true),reason:z.string().max(1000).optional()})),async(req,res,next)=>{try{
if(!isManagementRole(req.user.role))return res.status(403).json({error:'Only an authorised manager can assign a document reviewer.'});
if(await activeExternalResearchForKnowledge(req.params.id))return res.status(409).json({error:'This document is controlled by the Imported Research reader. Approve, request revision, or reject it there.'});await requireDocumentReadBeforeDecision(req.user,req.params.id);const target=req.validated.approved?'Published':'Rejected';const updated=await transaction(async client=>{const item=(await client.query('SELECT * FROM knowledge_items WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!item)return null;if(!item.reviewer_id||item.reviewer_id!==req.user.id||item.created_by===req.user.id)throw Object.assign(new Error('Only the assigned reviewer can decide this document, and self-review is not permitted.'),{statusCode:403});if(target==='Published'&&item.current_version<1)throw new Error('Upload a document version before publishing.');const row=(await client.query('UPDATE knowledge_items SET status=$1,is_archived=FALSE,reviewed_by=$2,reviewed_at=NOW(),approved_by=$3,approved_at=$4,rejection_reason=$5,updated_at=NOW() WHERE id=$6 RETURNING *',[target,req.user.id,target==='Published'?req.user.id:null,target==='Published'?new Date():null,target==='Rejected'?(req.validated.reason||'Not approved'):null,req.params.id])).rows[0];if(target==='Published')await client.query('UPDATE knowledge_versions SET approved_by=$1,approved_at=NOW() WHERE knowledge_id=$2 AND is_current=TRUE',[req.user.id,row.id]);await audit(client,req.user.id,target==='Published'?'DOCUMENT_APPROVED':'DOCUMENT_REJECTED','knowledge',req.params.id,{reason:req.validated.reason});if(target==='Published'&&row.felix_enabled)await enqueueFelixDocumentIndex(client,row.id,row.current_version,req.user.id);return row});if(!updated)return res.status(404).json({error:'Knowledge item not found.'});res.json(updated)}catch(error){next(error)}})
app.post('/api/knowledge/:id/assignments',authenticate,validate(z.object({assignmentId:z.string().uuid()})),async(req,res,next)=>{try{const itemManager=await isKnowledgeManagerFor(req.user,req.params.id);if(!itemManager&&!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot manage this repository document.'});if(!await canAccessAssignment(req.user,req.validated.assignmentId))return res.status(403).json({error:'You cannot link this assignment.'});await transaction(async client=>{await client.query('INSERT INTO knowledge_assignment_links(knowledge_id,assignment_id,linked_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[req.params.id,req.validated.assignmentId,req.user.id]);await audit(client,req.user.id,'KNOWLEDGE_ASSIGNMENT_LINKED','knowledge',req.params.id,{assignmentId:req.validated.assignmentId})});res.status(204).end()}catch(error){next(error)}})
app.delete('/api/knowledge/:id/assignments/:assignmentId',authenticate,async(req,res,next)=>{try{const itemManager=await isKnowledgeManagerFor(req.user,req.params.id);if(!itemManager&&!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot manage this repository document.'});if(!await canAccessAssignment(req.user,req.params.assignmentId))return res.status(403).json({error:'You cannot unlink this assignment.'});await transaction(async client=>{await client.query('DELETE FROM knowledge_assignment_links WHERE knowledge_id=$1 AND assignment_id=$2',[req.params.id,req.params.assignmentId]);await audit(client,req.user.id,'KNOWLEDGE_ASSIGNMENT_UNLINKED','knowledge',req.params.id,{assignmentId:req.params.assignmentId})});res.status(204).end()}catch(error){next(error)}})
app.get('/api/knowledge/:id/downloads',authenticate,authorize('System Admin','Deputy Director'),async(req,res,next)=>{try{res.json((await query('SELECT d.id,d.downloaded_at,v.version_number,v.original_name,u.name user_name FROM knowledge_downloads d JOIN knowledge_versions v ON v.id=d.version_id JOIN users u ON u.id=d.user_id WHERE d.knowledge_id=$1 ORDER BY d.downloaded_at DESC',[req.params.id])).rows)}catch(error){next(error)}})

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
  if(['System Admin','Deputy Director'].includes(user.role))return true
  return (await query('SELECT 1 FROM external_research_import_reviewers WHERE import_id=$1 AND reviewer_id=$2 AND active=TRUE',[id,user.id])).rowCount>0
}
const canAccessExternalResearchImport=async(user,id)=>{
  if(['System Admin','Deputy Director'].includes(user.role))return true
  return (await query(`SELECT 1 FROM external_research_imports i
    WHERE i.id=$1 AND(i.submitted_by=$2 OR EXISTS(
      SELECT 1 FROM external_research_import_reviewers r
      WHERE r.import_id=i.id AND r.reviewer_id=$2 AND r.active=TRUE
    ))`,[id,user.id])).rowCount>0
}
const loadExternalResearchImport=async(id,user)=>{
  const management=['System Admin','Deputy Director'].includes(user.role)
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
  const management=['System Admin','Deputy Director'].includes(req.user.role)
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
    const reviewers=(await query("SELECT id,name,role FROM users WHERE id=ANY($1::uuid[]) AND active=TRUE",[meta.reviewerIds])).rows
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
  const importRow=(await query('SELECT knowledge_id FROM external_research_imports WHERE id=$1',[req.params.id])).rows[0]
  if(!importRow)return res.status(404).json({error:'Imported research record not found.'})
  await requireDocumentReadBeforeDecision(req.user,importRow.knowledge_id)
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
  const importRow=(await query('SELECT knowledge_id FROM external_research_imports WHERE id=$1',[req.params.id])).rows[0]
  if(!importRow)return res.status(404).json({error:'Imported research record not found.'})
  await requireDocumentReadBeforeDecision(req.user,importRow.knowledge_id)
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
    if(!['System Admin','Deputy Director'].includes(req.user.role)&&access.submitted_by!==req.user.id)return res.status(403).json({error:'Only the uploader or a research manager can upload the requested revision.'})
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
    if(!['System Admin','Deputy Director'].includes(req.user.role)&&current.submitted_by!==req.user.id)throw Object.assign(new Error('Only the uploader or a research manager can resubmit this revision.'),{status:403})
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


const noticeSchema=z.object({title:z.string().min(3).max(200),body:z.string().min(3).max(4000),severity:z.enum(['Information','Important','Urgent']).default('Information'),audienceRole:z.enum(roles).nullable().default(null),eventStart:z.string().datetime().nullable().default(null),eventEnd:z.string().datetime().nullable().default(null),expiresAt:z.string().datetime()}).superRefine((value,ctx)=>{if(value.eventStart&&new Date(value.eventStart)<new Date())ctx.addIssue({code:'custom',path:['eventStart'],message:'Event start cannot be before today.'});if(value.eventEnd&&!value.eventStart)ctx.addIssue({code:'custom',path:['eventEnd'],message:'Event start is required when an end is provided.'});if(value.eventStart&&value.eventEnd&&new Date(value.eventEnd)<new Date(value.eventStart))ctx.addIssue({code:'custom',path:['eventEnd'],message:'Event end must be after the event start.'});if(new Date(value.expiresAt)<=new Date())ctx.addIssue({code:'custom',path:['expiresAt'],message:'Notice expiry must be in the future.'})})
app.get('/api/alerts',authenticate,async(req,res,next)=>{try{const manager=['System Admin','Deputy Director'].includes(req.user.role);const result=await query(`SELECT a.*,u.name created_by_name,r.name reviewed_by_name,(a.created_by=$2) can_manage FROM alerts a JOIN users u ON u.id=a.created_by LEFT JOIN users r ON r.id=a.reviewed_by WHERE(($1 AND TRUE)OR a.status='Published' OR a.created_by=$2)AND(a.audience_role IS NULL OR a.audience_role=$3 OR a.created_by=$2)AND(a.expires_at IS NULL OR a.expires_at>NOW() OR a.created_by=$2) ORDER BY CASE a.status WHEN 'Pending Approval' THEN 0 WHEN 'Published' THEN 1 ELSE 2 END,a.created_at DESC`,[manager,req.user.id,req.user.role]);res.json(result.rows)}catch(error){next(error)}})
app.post('/api/alerts',authenticate,validate(noticeSchema),async(req,res,next)=>{try{const v=req.validated;const created=await transaction(async client=>{const row=(await client.query("INSERT INTO alerts(title,body,severity,audience_role,event_start,event_end,expires_at,created_by,status)VALUES($1,$2,$3,$4,$5,$6,$7,$8,'Pending Approval')RETURNING *",[v.title.trim(),v.body.trim(),v.severity,v.audienceRole,v.eventStart,v.eventEnd,v.expiresAt,req.user.id])).rows[0];await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)SELECT id,'Notice awaiting approval',$1,'notice',$2 FROM users WHERE active=TRUE AND role IN('System Admin','Deputy Director')",[`Ã¢â‚¬Å“${row.title}Ã¢â‚¬Â was submitted by ${req.user.name}.`,row.id]);await audit(client,req.user.id,'NOTICE_SUBMITTED','notice',row.id,{title:row.title,expiresAt:v.expiresAt});return row});res.status(201).json(created)}catch(error){next(error)}})
app.patch('/api/alerts/:id/review',authenticate,authorize('System Admin','Deputy Director'),validate(z.object({approved:z.boolean(),reason:z.string().max(1000).default('')})),async(req,res,next)=>{try{if(!isOrganisationScopeRole(req.user.role))return res.status(403).json({error:'Publishing institutional notices is Directorate-level and is outside team-manager scope.'});const result=await transaction(async client=>{const row=(await client.query("UPDATE alerts SET status=$1,reviewed_by=$2,reviewed_at=NOW(),rejection_reason=$3 WHERE id=$4 AND status='Pending Approval' RETURNING *",[req.validated.approved?'Published':'Rejected',req.user.id,req.validated.approved?null:req.validated.reason.trim(),req.params.id])).rows[0];if(!row)return null;await client.query('INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,$2,$3,$4,$5)',[row.created_by,req.validated.approved?'Notice approved':'Notice returned for correction',req.validated.approved?`Ã¢â‚¬Å“${row.title}Ã¢â‚¬Â is now published on the Notice Board.`:`Ã¢â‚¬Å“${row.title}Ã¢â‚¬Â was not approved: ${req.validated.reason||'No reason supplied.'}`,'notice',row.id]);if(req.validated.approved)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)SELECT id,'New Notice Board post',$1,'notice',$2 FROM users WHERE active=TRUE AND id<>$3 AND ($4::text IS NULL OR role=$4)",[`Ã¢â‚¬Å“${row.title}Ã¢â‚¬Â has been published.`,row.id,row.created_by,row.audience_role]);await audit(client,req.user.id,req.validated.approved?'NOTICE_APPROVED':'NOTICE_REJECTED','notice',row.id,{reason:req.validated.reason});return row});if(!result)return res.status(404).json({error:'Pending notice not found.'});res.json(result)}catch(error){next(error)}})
app.patch('/api/alerts/:id/pin',authenticate,authorize('System Admin','Deputy Director'),validate(z.object({pinned:z.boolean()})),async(req,res,next)=>{try{const row=(await query("UPDATE alerts SET is_pinned=$1,pinned_at=CASE WHEN $1 THEN NOW() ELSE NULL END,pinned_by=CASE WHEN $1 THEN $2 ELSE NULL END WHERE id=$3 AND status='Published' AND expires_at>NOW() RETURNING *",[req.validated.pinned,req.user.id,req.params.id])).rows[0];if(!row)return res.status(404).json({error:'An active published notice is required.'});await query('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)VALUES($1,$2,$3,$4,$5)',[req.user.id,req.validated.pinned?'NOTICE_PINNED':'NOTICE_UNPINNED','notice',row.id,JSON.stringify({title:row.title})]);res.json(row)}catch(error){next(error)}})
app.delete('/api/alerts/:id',authenticate,async(req,res,next)=>{try{const result=await transaction(async client=>{const notice=(await client.query('SELECT * FROM alerts WHERE id=$1',[req.params.id])).rows[0];if(!notice)return null;const manager=['System Admin','Deputy Director'].includes(req.user.role);if(!manager&&notice.created_by!==req.user.id)throw Object.assign(new Error('You can delete only notices you submitted.'),{status:403});if(!manager&&notice.status==='Published')throw Object.assign(new Error('Only management can delete a published notice.'),{status:403});await client.query("DELETE FROM notifications WHERE entity_type='notice' AND entity_id=$1",[notice.id]);await client.query('DELETE FROM alerts WHERE id=$1',[notice.id]);await audit(client,req.user.id,'NOTICE_DELETED','notice',notice.id,{title:notice.title,status:notice.status});return notice});if(!result)return res.status(404).json({error:'Notice not found.'});res.status(204).end()}catch(error){if(error.status)return res.status(error.status).json({error:error.message});next(error)}})
app.get('/api/alerts/:id/comments',authenticate,async(req,res,next)=>{try{const visible=(await query("SELECT 1 FROM alerts WHERE id=$1 AND status='Published' AND(audience_role IS NULL OR audience_role=$2)AND(expires_at IS NULL OR expires_at>NOW())",[req.params.id,req.user.role])).rowCount;if(!visible)return res.status(404).json({error:'Published notice not found.'});const result=await query('SELECT c.id,c.alert_id,c.body,c.created_at,c.user_id,u.name user_name,u.role user_role FROM alert_comments c JOIN users u ON u.id=c.user_id WHERE c.alert_id=$1 ORDER BY c.created_at ASC',[req.params.id]);res.json(result.rows)}catch(error){next(error)}})
app.post('/api/alerts/:id/comments',authenticate,validate(z.object({body:z.string().trim().min(1).max(2000)})),async(req,res,next)=>{try{const result=await transaction(async client=>{const notice=(await client.query("SELECT id,title,created_by FROM alerts WHERE id=$1 AND status='Published' AND(audience_role IS NULL OR audience_role=$2)AND(expires_at IS NULL OR expires_at>NOW())",[req.params.id,req.user.role])).rows[0];if(!notice)return null;const row=(await client.query('INSERT INTO alert_comments(alert_id,user_id,body)VALUES($1,$2,$3)RETURNING *',[notice.id,req.user.id,req.validated.body])).rows[0];if(notice.created_by!==req.user.id)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'New notice comment',$2,'notice',$3)",[notice.created_by,`${req.user.name} commented on Ã¢â‚¬Å“${notice.title}Ã¢â‚¬Â.`,notice.id]);await audit(client,req.user.id,'NOTICE_COMMENTED','notice',notice.id,{});return {...row,user_name:req.user.name,user_role:req.user.role}});if(!result)return res.status(404).json({error:'Published notice not found.'});res.status(201).json(result)}catch(error){next(error)}})
app.get('/api/calendar',authenticate,async(req,res,next)=>{try{
  const [base,repository]=await Promise.all([calendarForUser(req.user),repositoryCalendarForUser(req.user)])
  res.json([...base,...repository].sort((a,b)=>new Date(a.start_at).getTime()-new Date(b.start_at).getTime()))
}catch(error){next(error)}})
const calendarEventSchema=z.object({title:z.string().trim().min(3).max(200),description:z.string().max(4000).default(''),startAt:z.string().datetime(),endAt:z.string().datetime().nullable().default(null),eventType:z.enum(['Meeting','Reminder','Deadline','Activity']).default('Meeting')}).superRefine((value,ctx)=>{if(new Date(value.startAt)<new Date())ctx.addIssue({code:'custom',path:['startAt'],message:'Event start cannot be before today.'});if(value.endAt&&new Date(value.endAt)<new Date(value.startAt))ctx.addIssue({code:'custom',path:['endAt'],message:'Event end must be after the start.'})})
app.post('/api/calendar/events',authenticate,validate(calendarEventSchema),async(req,res,next)=>{try{const v=req.validated;const row=(await query('INSERT INTO calendar_events(title,description,start_at,end_at,event_type,created_by)VALUES($1,$2,$3,$4,$5,$6)RETURNING *',[v.title,v.description.trim(),v.startAt,v.endAt,v.eventType,req.user.id])).rows[0];await query('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)VALUES($1,$2,$3,$4,$5)',[req.user.id,'CALENDAR_EVENT_CREATED','calendar_event',row.id,JSON.stringify({title:row.title})]);res.status(201).json({...row,type:'custom_event',status:row.event_type,can_manage:true,created_by_name:req.user.name})}catch(error){next(error)}})
app.patch('/api/calendar/events/:id',authenticate,validate(calendarEventSchema),async(req,res,next)=>{try{const existing=(await query('SELECT * FROM calendar_events WHERE id=$1',[req.params.id])).rows[0];if(!existing)return res.status(404).json({error:'Calendar event not found.'});if(existing.created_by!==req.user.id&&req.user.role!=='System Admin')return res.status(403).json({error:'Only the event creator or an Administrator can edit this event.'});const v=req.validated;const row=(await query('UPDATE calendar_events SET title=$1,description=$2,start_at=$3,end_at=$4,event_type=$5,updated_at=NOW() WHERE id=$6 RETURNING *',[v.title,v.description.trim(),v.startAt,v.endAt,v.eventType,existing.id])).rows[0];await query('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)VALUES($1,$2,$3,$4,$5)',[req.user.id,'CALENDAR_EVENT_UPDATED','calendar_event',row.id,JSON.stringify({title:row.title})]);res.json({...row,type:'custom_event',status:row.event_type,can_manage:true,created_by_name:req.user.name})}catch(error){next(error)}})
app.delete('/api/calendar/events/:id',authenticate,async(req,res,next)=>{try{const existing=(await query('SELECT * FROM calendar_events WHERE id=$1',[req.params.id])).rows[0];if(!existing)return res.status(404).json({error:'Calendar event not found.'});if(existing.created_by!==req.user.id&&req.user.role!=='System Admin')return res.status(403).json({error:'Only the event creator or an Administrator can delete this event.'});await query('DELETE FROM calendar_events WHERE id=$1',[existing.id]);await query('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)VALUES($1,$2,$3,$4,$5)',[req.user.id,'CALENDAR_EVENT_DELETED','calendar_event',existing.id,JSON.stringify({title:existing.title})]);res.status(204).end()}catch(error){next(error)}})
app.get('/api/analytics/reports',authenticate,authorize('System Admin','Deputy Director'),async(req,res,next)=>{
  try{
    if(isTeamScopeRole(req.user.role))return res.status(410).json({error:'This legacy analytics endpoint is retired for team managers. Use Reports & Analytics, which applies your reporting-subtree scope.'})
    const filters=z.object({from:z.string().optional().default(''),to:z.string().optional().default(''),division:z.string().max(160).optional().default(''),status:z.string().max(40).optional().default('')}).parse({from:String(req.query.from||''),to:String(req.query.to||''),division:String(req.query.division||''),status:String(req.query.status||'')})
    const values=[filters.from||null,filters.to||null,filters.division,filters.status]
    const where="($1::date IS NULL OR a.created_at::date>=$1::date)AND($2::date IS NULL OR a.created_at::date<=$2::date)AND($3='' OR a.division=$3)AND($4='' OR a.status=$4)"
    const [summary,assignmentStatuses,divisions,documents,research,reviewers,trends,people]=await Promise.all([
      query(`SELECT COUNT(*)::int total,COUNT(*)FILTER(WHERE a.status='Completed')::int completed,COUNT(*)FILTER(WHERE a.status='Overdue' OR(a.due_date<CURRENT_DATE AND a.status!='Completed'))::int overdue,ROUND(COALESCE(100.0*COUNT(*)FILTER(WHERE a.status='Completed')/NULLIF(COUNT(*),0),0),1)::float completion_rate,(SELECT COUNT(*)::int FROM generated_documents WHERE status IN('Submitted','Under Review')) generated_document_reviews,(SELECT COUNT(*)::int FROM generated_documents WHERE status IN('Approved','Final')) approved_generated_documents FROM assignments a WHERE ${where}`,values),
      query(`SELECT a.status,COUNT(*)::int total FROM assignments a WHERE ${where} GROUP BY a.status ORDER BY total DESC`,values),
      query(`SELECT a.division,COUNT(*)::int total,COUNT(*)FILTER(WHERE a.status='Completed')::int completed FROM assignments a WHERE ${where} GROUP BY a.division ORDER BY total DESC`,values),
      query("SELECT k.status,COUNT(*)::int total FROM knowledge_items k WHERE($1::date IS NULL OR k.created_at::date>=$1::date)AND($2::date IS NULL OR k.created_at::date<=$2::date)GROUP BY k.status ORDER BY total DESC",values.slice(0,2)),
      query("SELECT p.status,COUNT(*)::int total FROM research_projects p WHERE($1::date IS NULL OR p.created_at::date>=$1::date)AND($2::date IS NULL OR p.created_at::date<=$2::date)GROUP BY p.status ORDER BY total DESC",values.slice(0,2)),
      query("SELECT u.id,u.name,(SELECT COUNT(*)::int FROM document_reviews r WHERE r.actor_id=u.id AND r.action='APPROVED' AND($1::date IS NULL OR r.created_at::date>=$1::date)AND($2::date IS NULL OR r.created_at::date<=$2::date))approved,(SELECT COUNT(*)::int FROM document_reviews r WHERE r.actor_id=u.id AND r.action='REJECTED' AND($1::date IS NULL OR r.created_at::date>=$1::date)AND($2::date IS NULL OR r.created_at::date<=$2::date))rejected,(SELECT COUNT(*)::int FROM knowledge_items k WHERE k.reviewer_id=u.id AND k.status='Pending Approval')pending FROM users u WHERE u.role IN('Reviewer','Deputy Director')ORDER BY pending DESC,approved DESC",values.slice(0,2)),
      query("SELECT TO_CHAR(DATE_TRUNC('month',a.created_at),'Mon YYYY') AS month_label,DATE_TRUNC('month',a.created_at) AS bucket,COUNT(*)::int AS created,COUNT(*)FILTER(WHERE a.status='Completed')::int AS completed FROM assignments a WHERE a.created_at>=DATE_TRUNC('month',CURRENT_DATE)-INTERVAL '5 months' GROUP BY DATE_TRUNC('month',a.created_at) ORDER BY bucket"),
      query(`SELECT u.id,u.name,u.role,u.division,COUNT(a.id)::int assigned,COUNT(a.id)FILTER(WHERE a.status='Completed')::int completed,COUNT(a.id)FILTER(WHERE a.status='Overdue' OR(a.due_date<CURRENT_DATE AND a.status!='Completed'))::int overdue,ROUND(COALESCE(100.0*COUNT(a.id)FILTER(WHERE a.status='Completed')/NULLIF(COUNT(a.id),0),0),1)::float completion_rate FROM users u LEFT JOIN assignment_members am ON am.user_id=u.id LEFT JOIN assignments a ON a.id=am.assignment_id AND($1::date IS NULL OR a.created_at::date>=$1::date)AND($2::date IS NULL OR a.created_at::date<=$2::date)AND($3='' OR a.division=$3)AND($4='' OR a.status=$4) WHERE u.active=TRUE GROUP BY u.id ORDER BY completion_rate DESC,completed DESC,u.name`,values)
    ])
    const documentTotals=documents.rows.reduce((acc,row)=>({...acc,[row.status]:row.total}),{})
    const researchTotals=research.rows.reduce((acc,row)=>({...acc,[row.status]:row.total}),{})
    res.json({filters,summary:{...summary.rows[0],pending_reviews:documentTotals['Pending Approval']||0,published_documents:documentTotals.Published||0,active_research:(researchTotals.Active||0)+(researchTotals['Under Review']||0)},assignmentStatuses:assignmentStatuses.rows,divisions:divisions.rows,documentStatuses:documents.rows,researchStatuses:research.rows,reviewers:reviewers.rows,trends:trends.rows.map(row=>({...row,month:row.month_label})),people:people.rows})
  }catch(error){next(error)}
})
app.get('/api/analytics/overview',authenticate,authorize('System Admin','Deputy Director'),async(req,res,next)=>{try{if(isTeamScopeRole(req.user.role))return res.status(410).json({error:'This legacy analytics endpoint is retired for team managers. Use Reports & Analytics, which applies your reporting-subtree scope.'});const [statuses,workloads,members]=await Promise.all([query('SELECT status,COUNT(*)::int total FROM assignments GROUP BY status'),query(`SELECT u.id,u.name,COUNT(am.assignment_id) FILTER(WHERE a.status!='Completed')::int active FROM users u LEFT JOIN assignment_members am ON am.user_id=u.id LEFT JOIN assignments a ON a.id=am.assignment_id GROUP BY u.id ORDER BY active DESC`),query('SELECT role,COUNT(*)::int total FROM users WHERE active=TRUE GROUP BY role')]);res.json({assignmentStatuses:statuses.rows,workloads:workloads.rows,membersByRole:members.rows})}catch(error){next(error)}})
const researchSchema=z.object({title:z.string().trim().min(4).max(240),
  leadId:z.string().uuid(),summary:z.string().trim().min(10).max(6000),researchQuestion:z.string().trim().min(10).max(3000),objectives:z.string().trim().min(10).max(5000),methodology:z.string().trim().min(10).max(5000),startDate:governedDate.unwrap(),endDate:governedDate.unwrap(),assignmentId:z.string().uuid().nullable().optional(),collaboratorIds:z.array(z.string().uuid()).default([]),reviewerIds:z.array(z.string().uuid()).max(10).default([]),knowledgeIds:z.array(z.string().uuid()).default([])}).superRefine(governedResearchDatePair)
app.get('/api/research',authenticate,async(req,res,next)=>{try{
  const view=String(req.query.view||'my').trim().toLowerCase()
  if(!['my','team','reviews'].includes(view)){
    return res.status(400).json({error:'Choose a valid research view: my, team or reviews.'})
  }

  let accessSql=''
  let accessParams=[]

  if(view==='my'){
    accessSql=`(
      p.lead_id=$1
      OR EXISTS(
        SELECT 1
          FROM research_collaborators rc
         WHERE rc.project_id=p.id
           AND rc.user_id=$1
           AND COALESCE(rc.role,'Researcher')<>'Reviewer'
      )
    )`
    accessParams=[req.user.id]
  }else if(view==='reviews'){
    accessSql=`EXISTS(
      SELECT 1
        FROM research_reviewers rr
       WHERE rr.project_id=p.id
         AND rr.reviewer_id=$1
         AND rr.active=TRUE
    )`
    accessParams=[req.user.id]
  }else{
    if(!isManagementRole(req.user.role)){
      return res.status(403).json({error:'Team Research is available only to authorised managers.'})
    }

    const managed=await managedUserIds(req.user)

    if(managed===null){
      accessSql='TRUE'
      accessParams=[]
    }else{
      const teamIds=managed.filter(id=>id!==req.user.id)
      accessSql=`(
        p.lead_id=ANY($1::uuid[])
        OR EXISTS(
          SELECT 1
            FROM research_collaborators rc
           WHERE rc.project_id=p.id
             AND rc.user_id=ANY($1::uuid[])
        )
      )`
      accessParams=[teamIds]
    }
  }

  const rows=await query(`SELECT p.*,${researchLifecycleStatusSql('p')} workflow_status,u.name lead_name,u.supervisor_id oversight_manager_id,
    lead_supervisor.name oversight_manager_name,lead_supervisor.role oversight_manager_role,
    COALESCE((SELECT json_agg(json_build_object('id',c.id,'name',c.name,'role',rc.role) ORDER BY c.name) FROM research_collaborators rc JOIN users c ON c.id=rc.user_id WHERE rc.project_id=p.id AND COALESCE(rc.role,'Researcher')<>'Reviewer'),'[]'::json) collaborators,
    COALESCE((SELECT json_agg(json_build_object('id',m.id,'title',m.title,'description',m.description,'owner_id',m.owner_id,'owner_name',mo.name,'due_date',m.due_date,'priority',m.priority,'status',m.status) ORDER BY m.due_date NULLS LAST,m.created_at) FROM research_milestones m LEFT JOIN users mo ON mo.id=m.owner_id WHERE m.project_id=p.id),'[]'::json) milestones,
    COALESCE((SELECT json_agg(json_build_object('id',r.id,'reviewer_id',r.reviewer_id,'name',ru.name,'role',ru.role,'division',ru.division,'review_role',r.review_role,'assigned_at',r.assigned_at) ORDER BY ru.name) FROM research_reviewers r JOIN users ru ON ru.id=r.reviewer_id WHERE r.project_id=p.id AND r.active=TRUE),'[]'::json) reviewers,
    COALESCE((SELECT json_agg(json_build_object('id',a.id,'title',a.title,'description',a.description,'division',a.division,'due_date',a.due_date,'priority',a.priority,'status',a.status,'relation_type',ral.relation_type,'linked_at',ral.linked_at) ORDER BY a.created_at DESC) FROM research_assignment_links ral JOIN assignments a ON a.id=ral.assignment_id WHERE ral.project_id=p.id),'[]'::json) assignments,
    COALESCE((SELECT json_agg(json_build_object('id',r.id,'title',r.title,'description',r.description,'division',r.division,'due_date',r.due_date,'priority',r.priority,'member_ids',r.member_ids,'status',r.status,'requested_by',r.requested_by,'requested_by_name',requester.name,'decided_by',r.decided_by,'decision_comment',r.decision_comment,'assignment_id',r.assignment_id,'created_at',r.created_at,'decided_at',r.decided_at) ORDER BY r.created_at DESC) FROM research_assignment_requests r JOIN users requester ON requester.id=r.requested_by WHERE r.project_id=p.id),'[]'::json) assignment_requests
    FROM research_projects p
    JOIN users u ON u.id=p.lead_id
    LEFT JOIN users lead_supervisor ON lead_supervisor.id=u.supervisor_id AND lead_supervisor.active=TRUE
    WHERE ${accessSql}
    ORDER BY p.updated_at DESC`,accessParams)

  const scopedRows=await Promise.all(rows.rows.map(async row=>({...row,can_manage:await canEditResearch(req.user,row.id)})))
  res.set('Cache-Control','no-store')
  res.json(scopedRows)
}catch(error){next(error)}})
app.post('/api/research',authenticate,authorize('System Admin','Director','Deputy Director','Assistant Director'),validate(researchSchema),async(req,res,next)=>{
  try{
    const v=req.validated
    if(isTeamScopeRole(req.user.role)){const allowed=await managedUserIds(req.user);const selected=[v.leadId,...v.collaboratorIds,...v.reviewerIds];if(selected.some(id=>!allowed.includes(id)))return res.status(403).json({error:'Deputy and Assistant Directors may create research only with members of their reporting subtree.'})}
    const created=await transaction(async client=>{

      const p=(await client.query(
        'INSERT INTO research_projects(title,summary,research_question,objectives,methodology,start_date,end_date,lead_id,assignment_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
        [
          v.title,
          v.summary,
          v.researchQuestion,
          v.objectives,
          v.methodology,
          v.startDate,
          v.endDate,
          v.leadId,
          v.assignmentId||null
        ]
      )).rows[0]

      if(v.reviewerIds.includes(p.lead_id))throw Object.assign(new Error('The research lead cannot review their own project.'),{statusCode:400})
      const reviewerIds=[...new Set(v.reviewerIds)]
      if(reviewerIds.length){
        const eligible=new Set((await immediateOversightReviewers(p.lead_id)).map(item=>item.id))
        if(reviewerIds.some(id=>!eligible.has(id)))throw Object.assign(new Error("Choose the Research Lead's immediate supervisor or another active member of that supervisor's team."),{statusCode:400})
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
app.get('/api/research/:id',authenticate,async(req,res,next)=>{try{
  if(!await canAccessResearch(req.user,req.params.id))return res.status(403).json({error:'You are not authorised to access this research project.'})
  const row=(await query(`SELECT p.*,${researchLifecycleStatusSql('p')} workflow_status,u.name lead_name,u.supervisor_id oversight_manager_id,
    lead_supervisor.name oversight_manager_name,lead_supervisor.role oversight_manager_role,
    COALESCE((SELECT json_agg(json_build_object('id',c.id,'name',c.name,'role',rc.role) ORDER BY c.name) FROM research_collaborators rc JOIN users c ON c.id=rc.user_id WHERE rc.project_id=p.id AND COALESCE(rc.role,'Researcher')<>'Reviewer'),'[]'::json) collaborators,
    COALESCE((SELECT json_agg(json_build_object('id',m.id,'title',m.title,'description',m.description,'owner_id',m.owner_id,'owner_name',mo.name,'due_date',m.due_date,'priority',m.priority,'status',m.status) ORDER BY m.due_date NULLS LAST,m.created_at) FROM research_milestones m LEFT JOIN users mo ON mo.id=m.owner_id WHERE m.project_id=p.id),'[]'::json) milestones,
    COALESCE((SELECT json_agg(json_build_object('id',r.id,'reviewer_id',r.reviewer_id,'name',ru.name,'role',ru.role,'division',ru.division,'review_role',r.review_role,'assigned_at',r.assigned_at) ORDER BY ru.name) FROM research_reviewers r JOIN users ru ON ru.id=r.reviewer_id WHERE r.project_id=p.id AND r.active=TRUE),'[]'::json) reviewers,
    COALESCE((SELECT json_agg(json_build_object('id',a.id,'title',a.title,'description',a.description,'division',a.division,'due_date',a.due_date,'priority',a.priority,'status',a.status,'relation_type',ral.relation_type,'linked_at',ral.linked_at) ORDER BY a.created_at DESC) FROM research_assignment_links ral JOIN assignments a ON a.id=ral.assignment_id WHERE ral.project_id=p.id),'[]'::json) assignments,
    COALESCE((SELECT json_agg(json_build_object('id',r.id,'title',r.title,'description',r.description,'division',r.division,'due_date',r.due_date,'priority',r.priority,'member_ids',r.member_ids,'status',r.status,'requested_by',r.requested_by,'requested_by_name',requester.name,'decided_by',r.decided_by,'decision_comment',r.decision_comment,'assignment_id',r.assignment_id,'created_at',r.created_at,'decided_at',r.decided_at) ORDER BY r.created_at DESC) FROM research_assignment_requests r JOIN users requester ON requester.id=r.requested_by WHERE r.project_id=p.id),'[]'::json) assignment_requests
    FROM research_projects p
    JOIN users u ON u.id=p.lead_id
    LEFT JOIN users lead_supervisor ON lead_supervisor.id=u.supervisor_id AND lead_supervisor.active=TRUE
    WHERE p.id=$1`,[req.params.id])).rows[0]
  if(!row)return res.status(404).json({error:'Research project not found.'})
  res.set('Cache-Control','no-store')
  res.json(row)
}catch(error){next(error)}})
const requireResearchProjectAccess=async(req,res,next)=>{
  try{
    if(!await canAccessResearch(req.user,req.params.id)){
      return res.status(403).json({error:'You are not authorised to access this research project.'})
    }
    next()
  }catch(error){
    next(error)
  }
}
app.use('/api/research/:id',authenticate,requireResearchProjectAccess)
app.use('/api/research/:id',async(req,res,next)=>{
  try{
    if(!['POST','PATCH','PUT','DELETE'].includes(req.method))return next()
    const url=req.originalUrl||''
    const reviewerDecision=/\/report\/versions\/[^/]+\/decision(?:\?|$)/.test(url)
    const finalGeneration=/\/report\/generate(?:\?|$)/.test(url)
    if(reviewerDecision||finalGeneration)return next()
    const state=await researchWorkspaceLockState(req.params.id)
    if(!state.locked)return next()
    const version=state.version
    return lockedWorkspaceResponse(res,{
      domain:'Research',status:version?.status||'Under Review',version:version?.version_number||null,
      reviewer:version?.reviewer_id||null,
      message:`This Research workspace is read-only while report version ${version?.version_number||''} is ${version?.status||'under review'}. Editing reopens only after the reviewer returns it for changes.`
    })
  }catch(error){next(error)}
})


const researchPlanSchema=z.object({summary:z.string().trim().min(10).max(6000),researchQuestion:z.string().trim().min(10).max(3000),objectives:z.string().trim().min(10).max(5000),methodology:z.string().trim().min(10).max(5000),startDate:governedDate.unwrap(),endDate:governedDate.unwrap()}).superRefine(governedResearchDatePair)
app.patch('/api/research/:id/plan',authenticate,validate(researchPlanSchema),async(req,res,next)=>{try{
  const project=(await query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  const canEdit=isOrganisationScopeRole(req.user.role)||(isTeamScopeRole(req.user.role)&&await canManageResearch(req.user,req.params.id))
  if(!canEdit)return res.status(403).json({error:'Only an authorised research manager can edit the Research Brief. The research lead may submit a change request.'})
  const v=req.validated
  if(v.startDate&&v.endDate&&v.endDate<v.startDate)return res.status(400).json({error:'Research end date must be on or after its start date.'})
  const updated=await transaction(async client=>{const row=(await client.query('UPDATE research_projects SET summary=$1,research_question=$2,objectives=$3,methodology=$4,start_date=$5,end_date=$6,updated_at=NOW() WHERE id=$7 RETURNING *',[v.summary,v.researchQuestion,v.objectives,v.methodology,v.startDate||null,v.endDate||null,req.params.id])).rows[0];await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'RESEARCH_PLAN_UPDATED',JSON.stringify({questionDefined:Boolean(v.researchQuestion.trim()),objectivesDefined:Boolean(v.objectives.trim()),methodologyDefined:Boolean(v.methodology.trim())})]);await audit(client,req.user.id,'RESEARCH_PLAN_UPDATED','research_project',req.params.id,{status:project.status});return row})
  res.json(updated)
}catch(error){next(error)}})
const researchBriefChangeRequestSchema=z.object({reason:z.string().trim().min(5).max(2000)})
app.post('/api/research/:id/brief-change-request',authenticate,validate(researchBriefChangeRequestSchema),async(req,res,next)=>{try{
  const project=(await query('SELECT id,title,lead_id FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  if(project.lead_id!==req.user.id)return res.status(403).json({error:'Only the research lead may request a change to the Research Brief.'})
  const supervisor=await immediateSupervisorForUser(project.lead_id)
  if(!supervisor)return res.status(409).json({error:'Assign an immediate supervisor to the Research Lead before requesting management oversight.'})
  const reason=req.validated.reason.trim()
  await transaction(async client=>{
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[project.id,req.user.id,'RESEARCH_BRIEF_CHANGE_REQUESTED',JSON.stringify({reason})])
    await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Research Brief change requested',$2,'research',$3)",[supervisor.id,`A change to the Research Brief for “${project.title}” has been requested: ${reason}`,project.id])
    await audit(client,req.user.id,'RESEARCH_BRIEF_CHANGE_REQUESTED','research_project',project.id,{reason})
  })
  res.status(201).json({requested:true})
}catch(error){next(error)}})

const researchTeamSchema=z.object({leadId:z.string().uuid(),collaborators:z.array(z.object({userId:z.string().uuid(),role:z.enum(['Researcher','Analyst','Reviewer','Subject Matter Expert'])})).max(30)})
const researchTeamExpansionRequestSchema=z.object({members:z.array(z.object({userId:z.string().uuid(),role:z.enum(['Researcher','Analyst','Reviewer','Subject Matter Expert'])})).min(1).max(20)})
app.get('/api/research/:id/eligible-team-members',authenticate,async(req,res,next)=>{try{
  const project=(await query('SELECT id,lead_id FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  const canManage=isOrganisationScopeRole(req.user.role)||(isTeamScopeRole(req.user.role)&&await canManageResearch(req.user,req.params.id))||project.lead_id===req.user.id
  if(!canManage)return res.status(403).json({error:'Only the research lead or an authorised research manager can view eligible team members.'})
  const scoped=isTeamScopeRole(req.user.role)?await managedUserIds(req.user):null
  const all=scoped===null,scopeIds=scoped||[]
  const members=await query(`SELECT u.id,u.name,u.email,u.role,u.division,u.status,u.active,
    COUNT(am.assignment_id) FILTER(WHERE a.status<>'Completed')::int active_assignments,
    COUNT(am.assignment_id) FILTER(WHERE a.status='Completed')::int completed_assignments
    FROM users u
    LEFT JOIN assignment_members am ON am.user_id=u.id
    LEFT JOIN assignments a ON a.id=am.assignment_id
    WHERE u.active=TRUE AND u.role IN('Researcher','Deputy Director','Assistant Director')
      AND($1::boolean OR u.id=ANY($2::uuid[]))
    GROUP BY u.id
    ORDER BY CASE u.role WHEN 'Researcher' THEN 1 WHEN 'Deputy Director' THEN 2 ELSE 3 END,u.name`,[all,scopeIds])
  res.json(members.rows)
}catch(error){next(error)}})
app.patch('/api/research/:id/team',authenticate,validate(researchTeamSchema),async(req,res,next)=>{try{
  const project=(await query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  const isResearchManager=isOrganisationScopeRole(req.user.role)||(isTeamScopeRole(req.user.role)&&await canManageResearch(req.user,req.params.id))
  if(!isResearchManager)return res.status(403).json({error:'Only an authorised research manager can update the project team. The Research Lead may request additional members.'})
  const v=req.validated
  if(v.collaborators.some(item=>item.userId===v.leadId))return res.status(400).json({error:'The lead researcher cannot also be listed as a collaborator.'})
  let collaborators=v.collaborators
  if(isTeamScopeRole(req.user.role)){
    const allowed=await managedUserIds(req.user)
    if(!allowed.includes(v.leadId)||collaborators.some(item=>!allowed.includes(item.userId)))return res.status(403).json({error:'You may assign Research project ownership and membership only within your reporting subtree.'})
    const existingOutsideScope=(await query(`SELECT user_id,role FROM research_collaborators
      WHERE project_id=$1 AND NOT(user_id=ANY($2::uuid[]))`,[req.params.id,allowed])).rows
    collaborators=[...collaborators,...existingOutsideScope.filter(item=>item.user_id!==v.leadId)]
    if(!allowed.includes(project.lead_id)&&project.lead_id!==v.leadId){
      collaborators.push({userId:project.lead_id,role:'Researcher'})
    }
  }
  const userIds=[v.leadId,...collaborators.map(item=>item.userId)]
  const validUsers=(await query("SELECT id FROM users WHERE id=ANY($1::uuid[]) AND active=TRUE AND role IN('Researcher','Deputy Director','Assistant Director')",[userIds])).rows.map(item=>item.id)
  if(validUsers.length!==new Set(userIds).size)return res.status(400).json({error:'Choose only active research officers, managers or reviewers for the project team.'})
  const updated=await transaction(async client=>{await client.query('UPDATE research_projects SET lead_id=$1,updated_at=NOW() WHERE id=$2',[v.leadId,req.params.id]);await client.query('DELETE FROM research_collaborators WHERE project_id=$1',[req.params.id]);for(const member of collaborators)await client.query('INSERT INTO research_collaborators(project_id,user_id,role)VALUES($1,$2,$3)',[req.params.id,member.userId,member.role]);await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'RESEARCH_TEAM_UPDATED',JSON.stringify({leadId:v.leadId,collaboratorCount:collaborators.length})]);await audit(client,req.user.id,'RESEARCH_TEAM_UPDATED','research_project',req.params.id,{previousLeadId:project.lead_id,leadId:v.leadId,collaborators});return (await client.query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]})
  res.json(updated)
}catch(error){next(error)}})
app.post('/api/research/:id/team-expansion-request',authenticate,validate(researchTeamExpansionRequestSchema),async(req,res,next)=>{try{
  const project=(await query('SELECT id,title,lead_id FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  if(project.lead_id!==req.user.id)return res.status(403).json({error:'Only the assigned Research Lead may request additional team members.'})
  const requested=req.validated.members
  const ids=[...new Set(requested.map(item=>item.userId))]
  const existing=(await query('SELECT user_id FROM research_collaborators WHERE project_id=$1 AND user_id=ANY($2::uuid[])',[project.id,ids])).rows.map(item=>item.user_id)
  if(existing.length)return res.status(400).json({error:'Choose only people who are not already members of this research team.'})
  const users=(await query("SELECT id,name FROM users WHERE id=ANY($1::uuid[]) AND active=TRUE AND role IN('Researcher','Deputy Director','Assistant Director')",[ids])).rows
  if(users.length!==ids.length)return res.status(400).json({error:'Choose only active eligible research staff.'})
  const supervisor=await immediateSupervisorForUser(project.lead_id)
  if(!supervisor)return res.status(409).json({error:'Assign an immediate supervisor to the Research Lead before requesting additional team members.'})
  const names=users.map(user=>user.name).join(', ')
  await transaction(async client=>{
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[project.id,req.user.id,'RESEARCH_TEAM_EXPANSION_REQUESTED',JSON.stringify({members:requested,names})])
    await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Research team expansion requested',$2,'research',$3)",[supervisor.id,`${req.user.name} requested additional members for “${project.title}”: ${names}. Open the Research workspace to review and update the team.`,project.id])
    await audit(client,req.user.id,'RESEARCH_TEAM_EXPANSION_REQUESTED','research_project',project.id,{members:requested})
  })
  res.status(201).json({requested:true,names})
}catch(error){next(error)}})
const researchReviewerSchema=z.object({reviewerIds:z.array(z.string().uuid()).max(10)})
app.get('/api/research/:id/eligible-reviewers',authenticate,async(req,res,next)=>{try{
  const project=(await query(
    'SELECT id,lead_id FROM research_projects WHERE id=$1',
    [req.params.id]
  )).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})

  const isResearchLead=project.lead_id===req.user.id
  const isImmediateManager=await isImmediateSupervisorOf(req.user.id,project.lead_id)
  const isScopedManager=isOrganisationScopeRole(req.user.role)||(isTeamScopeRole(req.user.role)&&await canManageResearch(req.user,project.id))
  if(!isResearchLead&&!isImmediateManager&&!isScopedManager){
    return res.status(403).json({error:'Only the Research Lead or an authorised research manager can view eligible reviewers.'})
  }
  const eligible=await immediateOversightReviewers(project.lead_id)
  const assigned=(await query(`SELECT u.id,u.name,u.email,u.role,u.division,u.status,u.active
    FROM research_reviewers rr JOIN users u ON u.id=rr.reviewer_id
    WHERE rr.project_id=$1 AND rr.active=TRUE AND u.active=TRUE`,[project.id])).rows
  const reviewers=[...new Map([...eligible,...assigned].filter(item=>item.id!==project.lead_id).map(item=>[item.id,item])).values()]
  res.json(reviewers.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''))))
}catch(error){next(error)}})

app.patch('/api/research/:id/reviewers',authenticate,validate(researchReviewerSchema),async(req,res,next)=>{try{
  const project=(await query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  const isResearchLead=project.lead_id===req.user.id
  const isImmediateManager=await isImmediateSupervisorOf(req.user.id,project.lead_id)
  const isScopedManager=isOrganisationScopeRole(req.user.role)||(isTeamScopeRole(req.user.role)&&await canManageResearch(req.user,project.id))
  if(!isResearchLead&&!isImmediateManager&&!isScopedManager){
    return res.status(403).json({error:'Only the Research Lead or an authorised research manager can change formal reviewers.'})
  }
  const reviewerIds=[...new Set(req.validated.reviewerIds)]
  if(reviewerIds.includes(project.lead_id))return res.status(400).json({error:'The research lead cannot review their own project.'})
  if(reviewerIds.includes(req.user.id))return res.status(400).json({error:'You cannot assign yourself as reviewer for a report you are preparing or submitting.'})
  if(reviewerIds.length){const eligible=new Set((await immediateOversightReviewers(project.lead_id)).map(item=>item.id));if(reviewerIds.some(id=>!eligible.has(id)))return res.status(400).json({error:"Choose the Research Lead's immediate supervisor or another active member of that supervisor's team."})}
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
app.post('/api/research/:id/assignments/link',authenticate,validate(researchAssignmentLinkSchema),async(req,res,next)=>{try{
  const project=(await query('SELECT id,title FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  if(!await canEditResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot link assignments to this research project.'})
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

app.delete('/api/research/:id/assignments/:assignmentId',authenticate,async(req,res,next)=>{try{
  const project=(await query('SELECT id FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  if(!await canEditResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot unlink assignments from this research project.'})
  const link=(await query('SELECT * FROM research_assignment_links WHERE project_id=$1 AND assignment_id=$2',[req.params.id,req.params.assignmentId])).rows[0]
  if(!link)return res.status(404).json({error:'Research assignment link not found.'})
  const linkedMilestoneTasks=(await query(`SELECT COUNT(*)::int total FROM research_milestone_tasks mt JOIN assignment_tasks t ON t.id=mt.task_id WHERE mt.project_id=$1 AND t.assignment_id=$2`,[req.params.id,req.params.assignmentId])).rows[0]?.total||0
  if(linkedMilestoneTasks>0)return res.status(409).json({error:'Unlink the assignment tasks from their research milestones before unlinking this assignment.'})
  await transaction(async client=>{
    await client.query('DELETE FROM research_assignment_links WHERE id=$1',[link.id])
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'RESEARCH_ASSIGNMENT_UNLINKED',JSON.stringify({assignmentId:req.params.assignmentId})])
    await audit(client,req.user.id,'RESEARCH_ASSIGNMENT_UNLINKED','research_project',req.params.id,{assignmentId:req.params.assignmentId})
  })
  res.status(204).end()
}catch(error){next(error)}})

app.post('/api/research/:id/assignments',authenticate,validate(assignmentSchema),async(req,res,next)=>{try{
  const project=(await query('SELECT id,title,lead_id FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  const isManager=isManagementRole(req.user.role)
  if(isManager&&!await canEditResearch(req.user,project.id))return res.status(403).json({error:'You cannot create assignments outside your research management scope.'})
  if(!isManager&&project.lead_id!==req.user.id)return res.status(403).json({error:'Only the Research Lead may propose an assignment; a Research Manager must approve it before activation.'})
  if(!isManager){
    const {title,description,division,dueDate,priority,memberIds}=req.validated
    const supervisor=await immediateSupervisorForUser(project.lead_id)
    if(!supervisor)return res.status(409).json({error:'Assign an immediate supervisor to the Research Lead before submitting an assignment proposal.'})
    const request=(await transaction(async client=>{
      const created=(await client.query(`INSERT INTO research_assignment_requests(project_id,title,description,division,due_date,priority,member_ids,requested_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[project.id,title,description,division,dueDate||null,priority,memberIds,req.user.id])).rows[0]
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Assignment proposal awaiting approval',$2,'research_assignment_request',$3)",[supervisor.id,`${req.user.name} proposed “${title}” under research project “${project.title}”. Review the details and approve or reject it.`,created.id])
      await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[project.id,req.user.id,'RESEARCH_ASSIGNMENT_APPROVAL_REQUESTED',JSON.stringify({requestId:created.id,title,memberIds})])
      await audit(client,req.user.id,'RESEARCH_ASSIGNMENT_APPROVAL_REQUESTED','research_assignment_request',created.id,{projectId:project.id,title,memberIds})
      return created
    }))
    return res.status(202).json({...request,approval_required:true})
  }
  const created=await transaction(async client=>{
    const {title,description,division,dueDate,priority,memberIds}=req.validated
    const result=await client.query('INSERT INTO assignments(title,description,division,due_date,priority,created_by)VALUES($1,$2,$3,$4,$5,$6)RETURNING *',[title,description,division,dueDate||null,priority,req.user.id])
    const assignment=result.rows[0]
    for(const [index,id] of memberIds.entries())await client.query('INSERT INTO assignment_members(assignment_id,user_id,member_role)VALUES($1,$2,$3)ON CONFLICT DO NOTHING',[assignment.id,id,index===0?'Lead':'Contributor'])
    await client.query("INSERT INTO research_assignment_links(project_id,assignment_id,relation_type,linked_by)VALUES($1,$2,'Research Work',$3)",[project.id,assignment.id,req.user.id])
    if(memberIds.length)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)SELECT id,'New research assignment',$1,'assignment',$2 FROM users WHERE id=ANY($3::uuid[]) AND active=TRUE",[`You have been assigned “${title}” under research project “${project.title}”${dueDate?` due ${dueDate}`:''}.`,assignment.id,memberIds])
    await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[assignment.id,req.user.id,'CREATED_FROM_RESEARCH',JSON.stringify({researchId:project.id,researchTitle:project.title,memberIds})])
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[project.id,req.user.id,'RESEARCH_ASSIGNMENT_CREATED',JSON.stringify({assignmentId:assignment.id,title})])
    await audit(client,req.user.id,'ASSIGNMENT_CREATED','assignment',assignment.id,{title,memberIds,researchId:project.id})
    return assignment
  })
  res.status(201).json(created)
}catch(error){next(error)}})

app.post('/api/research/:id/assignment-requests/:requestId/decision',authenticate,authorize('System Admin','Deputy Director'),validate(z.object({decision:z.enum(['Approved','Rejected']),comment:z.string().trim().max(2000).default('')})),async(req,res,next)=>{try{
  if(req.validated.decision==='Rejected'&&!req.validated.comment)return res.status(400).json({error:'Explain why the assignment proposal was rejected.'})
  const request=(await query(`SELECT r.*,p.title project_title FROM research_assignment_requests r JOIN research_projects p ON p.id=r.project_id WHERE r.id=$1 AND r.project_id=$2`,[req.params.requestId,req.params.id])).rows[0]
  if(!request)return res.status(404).json({error:'Assignment proposal not found.'})
  if(request.status!=='Pending Approval')return res.status(409).json({error:'This assignment proposal has already received a decision.'})
  const result=await transaction(async client=>{
    let assignment=null
    if(req.validated.decision==='Approved'){
      assignment=(await client.query('INSERT INTO assignments(title,description,division,due_date,priority,created_by)VALUES($1,$2,$3,$4,$5,$6)RETURNING *',[request.title,request.description,request.division,request.due_date,request.priority,req.user.id])).rows[0]
      for(const [index,id] of (request.member_ids||[]).entries())await client.query('INSERT INTO assignment_members(assignment_id,user_id,member_role)VALUES($1,$2,$3)ON CONFLICT DO NOTHING',[assignment.id,id,index===0?'Lead':'Contributor'])
      await client.query("INSERT INTO research_assignment_links(project_id,assignment_id,relation_type,linked_by)VALUES($1,$2,'Research Work',$3)",[request.project_id,assignment.id,req.user.id])
      if(request.member_ids?.length)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)SELECT id,'New approved research assignment',$1,'assignment',$2 FROM users WHERE id=ANY($3::uuid[]) AND active=TRUE",[`“${request.title}” was approved under research project “${request.project_title}”.`,assignment.id,request.member_ids])
      await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',[assignment.id,req.user.id,'APPROVED_FROM_RESEARCH_REQUEST',JSON.stringify({researchId:request.project_id,requestId:request.id})])
    }
    const updated=(await client.query('UPDATE research_assignment_requests SET status=$1,decided_by=$2,decision_comment=$3,assignment_id=$4,decided_at=NOW() WHERE id=$5 RETURNING *',[req.validated.decision,req.user.id,req.validated.comment,assignment?.id||null,request.id])).rows[0]
    await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,$2,$3,'research_assignment_request',$4)",[request.requested_by,`Assignment proposal ${req.validated.decision.toLowerCase()}`,req.validated.decision==='Approved'?`“${request.title}” is approved and is now an active assignment.`:`“${request.title}” was rejected. ${req.validated.comment}`,request.id])
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[request.project_id,req.user.id,req.validated.decision==='Approved'?'RESEARCH_ASSIGNMENT_APPROVED':'RESEARCH_ASSIGNMENT_REJECTED',JSON.stringify({requestId:request.id,assignmentId:assignment?.id||null,comment:req.validated.comment})])
    await audit(client,req.user.id,'RESEARCH_ASSIGNMENT_REQUEST_DECIDED','research_assignment_request',request.id,{decision:req.validated.decision,assignmentId:assignment?.id||null})
    return {...updated,assignment}
  })
  res.json(result)
}catch(error){next(error)}})

app.patch('/api/research/:id/status',authenticate,validate(z.object({status:z.enum(RESEARCH_PROJECT_STATUSES)})),async(req,res,next)=>{  try{
    const project=(await query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
    if(!project)return res.status(404).json({error:'Research project not found.'})
    const isManager=isOrganisationScopeRole(req.user.role)||(isTeamScopeRole(req.user.role)&&await canManageResearch(req.user,req.params.id))
    const isParticipant=project.lead_id===req.user.id||(await query('SELECT 1 FROM research_collaborators WHERE project_id=$1 AND user_id=$2',[req.params.id,req.user.id])).rowCount>0
    const isAssignedReviewer=(await query('SELECT 1 FROM research_reviewers WHERE project_id=$1 AND reviewer_id=$2 AND active=TRUE',[req.params.id,req.user.id])).rowCount>0
    if(!isManager&&!isParticipant&&!isAssignedReviewer)return res.status(403).json({error:'You are not authorized to update this research project.'})
    if(req.validated.status==='Under Review')return res.status(409).json({error:'Submit an immutable Research report version to enter Under Review.'})
    if(req.validated.status==='Completed')return res.status(409).json({error:'Research becomes Completed only when the approved controlled final report is published to the Document Repository.'})
    if(req.validated.status==='Under Review'&&(!project.research_question.trim()||!project.objectives.trim()||!project.methodology.trim()))return res.status(409).json({error:'Define the research question, objectives and methodology before review.'})
    if(req.validated.status==='Under Review'&&(await query('SELECT 1 FROM research_milestones WHERE project_id=$1 LIMIT 1',[req.params.id])).rowCount===0)return res.status(409).json({error:'Add at least one accountable research milestone before review.'})
    if(req.validated.status==='Under Review'&&(await query('SELECT 1 FROM research_reviewers WHERE project_id=$1 AND active=TRUE LIMIT 1',[req.params.id])).rowCount===0)return res.status(409).json({error:'Assign at least one formal research reviewer before submitting for review.'})
    if(req.validated.status==='Active'&&(!project.start_date||!project.end_date||!project.summary.trim()||!project.research_question.trim()||!project.objectives.trim()||!project.methodology.trim()))return res.status(409).json({error:'Complete the Research Brief, including valid start and finish dates, before starting the project.'})
    if(req.validated.status==='Active'&&!isManager)return res.status(403).json({error:'Only a research manager can approve an active research project.'})
    const row=await transaction(async client=>{const updated=(await client.query('UPDATE research_projects SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',[req.validated.status,req.params.id])).rows[0];await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'STATUS_UPDATED',JSON.stringify({from:project.status,to:updated.status})]);await audit(client,req.user.id,'RESEARCH_STATUS_UPDATED','research_project',updated.id,{from:project.status,to:updated.status});return updated})
    res.json(row)
  }catch(error){next(error)}
})
app.delete('/api/research/:id',authenticate,authorize('System Admin','Deputy Director'),validate(z.object({reason:z.string().trim().min(5).max(2000)})),async(req,res,next)=>{try{
  const project=(await query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  if(project.status!=='Archived')return res.status(409).json({error:'Archive the research project before permanently deleting it.'})
  const linkedMilestoneTasks=(await query('SELECT COUNT(*)::int total FROM research_milestone_tasks WHERE project_id=$1',[project.id])).rows[0]?.total||0
  if(linkedMilestoneTasks>0)return res.status(409).json({error:'Unlink milestone tasks before permanently deleting this research project so task-to-milestone history is not lost.'})
  await transaction(async client=>{
    await audit(client,req.user.id,'RESEARCH_PROJECT_DELETED','research_project',project.id,{title:project.title,reason:req.validated.reason})
    await client.query('DELETE FROM research_projects WHERE id=$1',[project.id])
  })
  res.status(204).end()
}catch(error){
  if(error.code==='23503')return res.status(409).json({error:'This research project still has controlled records that prevent permanent deletion. Keep it archived instead.'})
  next(error)
}})
const researchMilestoneSchema=z.object({title:z.string().min(3).max(200),description:z.string().max(3000).default(''),ownerId:z.string().uuid(),dueDate:governedDate.unwrap(),priority:z.enum(['Low','Normal','High','Critical']).default('Normal')})
app.post('/api/research/:id/milestones',authenticate,validate(researchMilestoneSchema),async(req,res,next)=>{try{if(!await canEditResearch(req.user,req.params.id))return res.status(403).json({error:'Only the working research team or a manager can add milestones.'});const v=req.validated;const accountable=(await query('SELECT 1 FROM research_projects p WHERE p.id=$1 AND(p.lead_id=$2 OR EXISTS(SELECT 1 FROM research_collaborators WHERE project_id=p.id AND user_id=$2))',[req.params.id,v.ownerId])).rowCount;if(!accountable)return res.status(400).json({error:'Milestone owner must be the research lead or a project collaborator.'});const row=await transaction(async client=>{const created=(await client.query('INSERT INTO research_milestones(project_id,title,description,owner_id,due_date,priority)VALUES($1,$2,$3,$4,$5,$6)RETURNING *',[req.params.id,v.title,v.description,v.ownerId,v.dueDate,v.priority])).rows[0];await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'MILESTONE_CREATED',JSON.stringify({milestoneId:created.id,title:created.title,ownerId:created.owner_id,dueDate:created.due_date})]);await audit(client,req.user.id,'RESEARCH_MILESTONE_CREATED','research_milestone',created.id,{projectId:req.params.id,title:created.title,ownerId:created.owner_id,dueDate:created.due_date});if(created.owner_id&&created.owner_id!==req.user.id)await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Research milestone assigned',$2,'research',$3)`,[created.owner_id, `You have been assigned milestone “${created.title}”.`,req.params.id]);return created});res.status(201).json(row)}catch(error){next(error)}})
app.patch('/api/research/:id/milestones/:milestoneId',authenticate,validate(z.object({status:z.enum(['Pending','In Progress','Completed'])})),async(req,res,next)=>{try{if(!await canAccessResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot update this milestone.'});const milestone=(await query('SELECT * FROM research_milestones WHERE id=$1 AND project_id=$2',[req.params.milestoneId,req.params.id])).rows[0];if(!milestone)return res.status(404).json({error:'Milestone not found.'});if(milestone.owner_id!==req.user.id&&!isManagementRole(req.user.role))return res.status(403).json({error:'Only the milestone owner or a research manager can update its status.'});if(req.validated.status==='Pending'){const active=(await query(`SELECT 1 FROM research_milestone_tasks mt JOIN assignment_tasks t ON t.id=mt.task_id WHERE mt.milestone_id=$1 AND t.archived_at IS NULL AND t.status IN('In Progress','Blocked','Completed') LIMIT 1`,[milestone.id])).rowCount>0;if(active)return res.status(409).json({error:'A milestone with active linked tasks cannot be reset to Pending.'})}if(req.validated.status==='Completed'){const readiness=(await query(`SELECT COUNT(*)::int linked_tasks,COUNT(*) FILTER(WHERE t.status<>'Completed')::int open_tasks FROM research_milestone_tasks mt JOIN assignment_tasks t ON t.id=mt.task_id WHERE mt.project_id=$1 AND mt.milestone_id=$2 AND t.archived_at IS NULL`,[req.params.id,milestone.id])).rows[0];if(readiness.linked_tasks===0||readiness.open_tasks>0)return res.status(409).json({error:'A milestone can be completed only after it has linked active tasks and every linked task has completed its governed final-report publication workflow.'})}const row=await transaction(async client=>{const updated=(await client.query('UPDATE research_milestones SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',[req.validated.status,milestone.id])).rows[0];await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'MILESTONE_UPDATED',JSON.stringify({milestoneId:updated.id,status:updated.status})]);await audit(client,req.user.id,'RESEARCH_MILESTONE_STATUS_UPDATED','research_milestone',updated.id,{projectId:req.params.id,from:milestone.status,to:updated.status});if(updated.owner_id&&updated.owner_id!==req.user.id)await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Research milestone status updated',$2,'research',$3)`,[updated.owner_id, `Milestone “${updated.title}” status changed to ${updated.status}.`,req.params.id]);return updated});res.json(row)}catch(error){next(error)}})

const researchMilestoneDetailsSchema=z.object({title:z.string().trim().min(3).max(200),description:z.string().max(3000).default(''),ownerId:z.string().uuid(),dueDate:governedDate.unwrap(),priority:z.enum(['Low','Normal','High','Critical']).default('Normal')})
app.patch('/api/research/:id/milestones/:milestoneId/details',authenticate,validate(researchMilestoneDetailsSchema),async(req,res,next)=>{try{
  if(!await canEditResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot edit milestones for this research project.'})
  const milestone=(await query('SELECT * FROM research_milestones WHERE id=$1 AND project_id=$2',[req.params.milestoneId,req.params.id])).rows[0]
  if(!milestone)return res.status(404).json({error:'Milestone not found.'})
  const ownerAllowed=(await query('SELECT 1 FROM research_projects p WHERE p.id=$1 AND(p.lead_id=$2 OR EXISTS(SELECT 1 FROM research_collaborators WHERE project_id=p.id AND user_id=$2))',[req.params.id,req.validated.ownerId])).rowCount>0
  if(!ownerAllowed)return res.status(400).json({error:'Milestone owner must be the research lead or a project collaborator.'})
  const updated=await transaction(async client=>{
    const row=(await client.query('UPDATE research_milestones SET title=$1,description=$2,owner_id=$3,due_date=$4,priority=$5,updated_at=NOW() WHERE id=$6 RETURNING *',[req.validated.title,req.validated.description,req.validated.ownerId,req.validated.dueDate,req.validated.priority,milestone.id])).rows[0]
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'MILESTONE_DETAILS_UPDATED',JSON.stringify({milestoneId:row.id,title:row.title,ownerId:row.owner_id,dueDate:row.due_date,priority:row.priority})])
    await audit(client,req.user.id,'RESEARCH_MILESTONE_DETAILS_UPDATED','research_milestone',row.id,{projectId:req.params.id,title:row.title,ownerId:row.owner_id,dueDate:row.due_date,priority:row.priority})
    if(row.owner_id&&row.owner_id!==req.user.id&&row.owner_id!==milestone.owner_id)await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Research milestone assigned',$2,'research',$3)`,[row.owner_id,`You have been assigned milestone “${row.title}”.`,req.params.id])
    return row
  })
  res.json(updated)
}catch(error){next(error)}})
app.get('/api/research/:id/milestones/:milestoneId/tasks',authenticate,async(req,res,next)=>{try{
  if(!z.string().uuid().safeParse(req.params.milestoneId).success)return res.status(400).json({error:'Invalid milestone identifier.'})
  if(!await canAccessResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot view tasks for this research project.'})
  const milestone=(await query('SELECT id FROM research_milestones WHERE id=$1 AND project_id=$2',[req.params.milestoneId,req.params.id])).rows[0]
  if(!milestone)return res.status(404).json({error:'Milestone not found.'})
  const assignments=(await query('SELECT assignment_id FROM research_assignment_links WHERE project_id=$1',[req.params.id])).rows
  const scopes=new Map()
  for(const row of assignments)scopes.set(row.assignment_id,await assignmentTaskScope(req.user,row.assignment_id))
  const visible=(assignmentId,ownerId,reviewerId)=>{
    const scope=scopes.get(assignmentId)
    return Boolean(scope&&(scope.all||(scope.userIds||[]).includes(ownerId)||(scope.userIds||[]).includes(reviewerId)))
  }
  const rows=(await query(`SELECT t.id,t.assignment_id,t.title,t.status,t.progress,t.due_date,t.owner_id,owner.name owner_name,
      t.reviewer_id,reviewer.name reviewer_name,a.title assignment_title,
      EXISTS(SELECT 1 FROM research_milestone_tasks mt WHERE mt.task_id=t.id AND mt.milestone_id=$2) linked
    FROM assignment_tasks t
    JOIN assignments a ON a.id=t.assignment_id
    JOIN research_assignment_links ral ON ral.assignment_id=t.assignment_id AND ral.project_id=$1
    LEFT JOIN users owner ON owner.id=t.owner_id
    LEFT JOIN users reviewer ON reviewer.id=t.reviewer_id
    WHERE t.archived_at IS NULL
    ORDER BY a.title,t.created_at`,[req.params.id,req.params.milestoneId])).rows
  const allowed=rows.filter(row=>visible(row.assignment_id,row.owner_id,row.reviewer_id))
  res.set('Cache-Control','no-store')
  res.json({linked:allowed.filter(row=>row.linked),available:allowed.filter(row=>!row.linked)})
}catch(error){next(error)}})
app.post('/api/research/:id/milestones/:milestoneId/tasks/:taskId',authenticate,async(req,res,next)=>{try{
  if(!z.string().uuid().safeParse(req.params.milestoneId).success||!z.string().uuid().safeParse(req.params.taskId).success)return res.status(400).json({error:'Invalid milestone or task identifier.'})
  if(!await canEditResearch(req.user,req.params.id))return res.status(403).json({error:'Only the working research team or a manager can link tasks to this milestone.'})
  const milestone=(await query('SELECT id,title,owner_id,status FROM research_milestones WHERE id=$1 AND project_id=$2',[req.params.milestoneId,req.params.id])).rows[0]
  if(!milestone)return res.status(404).json({error:'Milestone not found.'})
  if(milestone.status==='Completed')return res.status(409).json({error:'Reopen the completed milestone before linking additional tasks.'})
  const task=(await query(`SELECT t.id,t.assignment_id,t.title,t.owner_id,t.reviewer_id,t.archived_at
    FROM assignment_tasks t WHERE t.id=$1`,[req.params.taskId])).rows[0]
  if(!task||task.archived_at)return res.status(404).json({error:'Active task not found.'})
  const assignmentLink=(await query('SELECT 1 FROM research_assignment_links WHERE project_id=$1 AND assignment_id=$2',[req.params.id,task.assignment_id])).rowCount
  if(!assignmentLink)return res.status(409).json({error:'The task must belong to an assignment linked to this research project.'})
  const scope=await assignmentTaskScope(req.user,task.assignment_id)
  if(!scope.all&&!(scope.userIds||[]).includes(task.owner_id)&&!(scope.userIds||[]).includes(task.reviewer_id))return res.status(403).json({error:'You do not have permission to link this task.'})
  const row=await transaction(async client=>{
    const linked=(await client.query('INSERT INTO research_milestone_tasks(project_id,milestone_id,task_id,linked_by)VALUES($1,$2,$3,$4)ON CONFLICT(milestone_id,task_id) DO NOTHING RETURNING id',[req.params.id,milestone.id,task.id,req.user.id])).rows[0]
    if(!linked)throw Object.assign(new Error('This task is already linked to the milestone.'),{statusCode:409})
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'RESEARCH_MILESTONE_TASK_LINKED',JSON.stringify({milestoneId:milestone.id,taskId:task.id,taskTitle:task.title})])
    await audit(client,req.user.id,'RESEARCH_MILESTONE_TASK_LINKED','research_milestone',milestone.id,{projectId:req.params.id,taskId:task.id,taskTitle:task.title})
    if(milestone.owner_id&&milestone.owner_id!==req.user.id)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Task linked to research milestone',$2,'research',$3)",[milestone.owner_id,`The task “${task.title}” has been linked to milestone “${milestone.title}”.`,req.params.id])
    return {milestoneId:milestone.id,taskId:task.id}
  })
  res.status(201).json(row)
}catch(error){if(error.statusCode)return res.status(error.statusCode).json({error:error.message});if(error.code==='23514')return res.status(409).json({error:'The task and milestone must belong to the same linked research project.'});next(error)}})
app.delete('/api/research/:id/milestones/:milestoneId/tasks/:taskId',authenticate,async(req,res,next)=>{try{
  if(!z.string().uuid().safeParse(req.params.milestoneId).success||!z.string().uuid().safeParse(req.params.taskId).success)return res.status(400).json({error:'Invalid milestone or task identifier.'})
  if(!await canEditResearch(req.user,req.params.id))return res.status(403).json({error:'Only the working research team or a manager can unlink tasks from this milestone.'})
  const milestone=(await query('SELECT id,title,owner_id FROM research_milestones WHERE id=$1 AND project_id=$2',[req.params.milestoneId,req.params.id])).rows[0]
  if(!milestone)return res.status(404).json({error:'Milestone not found.'})
  if(milestone.status==='Completed')return res.status(409).json({error:'Reopen the completed milestone before changing its linked tasks.'})
  const task=(await query('SELECT id,title,assignment_id,owner_id,reviewer_id FROM assignment_tasks WHERE id=$1',[req.params.taskId])).rows[0]
  if(!task)return res.status(404).json({error:'Task not found.'})
  const scope=await assignmentTaskScope(req.user,task.assignment_id)
  if(!scope.all&&!(scope.userIds||[]).includes(task.owner_id)&&!(scope.userIds||[]).includes(task.reviewer_id))return res.status(403).json({error:'You do not have permission to unlink this task.'})
  const result=await transaction(async client=>{
    const removed=(await client.query('DELETE FROM research_milestone_tasks WHERE project_id=$1 AND milestone_id=$2 AND task_id=$3 RETURNING id',[req.params.id,milestone.id,task.id])).rows[0]
    if(!removed)return false
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'RESEARCH_MILESTONE_TASK_UNLINKED',JSON.stringify({milestoneId:milestone.id,taskId:task.id,taskTitle:task.title})])
    await audit(client,req.user.id,'RESEARCH_MILESTONE_TASK_UNLINKED','research_milestone',milestone.id,{projectId:req.params.id,taskId:task.id,taskTitle:task.title})
    if(milestone.owner_id&&milestone.owner_id!==req.user.id)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Task unlinked from research milestone',$2,'research',$3)",[milestone.owner_id,`The task “${task.title}” has been unlinked from milestone “${milestone.title}”.`,req.params.id])
    return true
  })
  if(!result)return res.status(404).json({error:'Milestone-task link not found.'})
  res.status(204).end()
}catch(error){next(error)}})

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
app.patch('/api/research/:id/sources/:sourceId',authenticate,validate(researchSourceGovernanceSchema),async(req,res,next)=>{try{if(!await canAccessResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot update this research source.'});const source=(await query('SELECT * FROM research_sources WHERE id=$1 AND project_id=$2',[req.params.sourceId,req.params.id])).rows[0];if(!source)return res.status(404).json({error:'Research source not found.'});if(source.created_by!==req.user.id&&!(isManagementRole(req.user.role)||await isResearchContextReviewer(req.params.id,req.user.id)))return res.status(403).json({error:'Only the source owner, reviewer or manager can update evidence governance.'});const v=req.validated;const updated=await transaction(async client=>{const row=(await client.query('UPDATE research_sources SET provenance=$1,quality=$2,relevance=$3 WHERE id=$4 RETURNING *',[v.provenance,v.quality,v.relevance,source.id])).rows[0];await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'SOURCE_GOVERNANCE_UPDATED',JSON.stringify({sourceId:source.id,title:source.title,...v})]);await audit(client,req.user.id,'RESEARCH_SOURCE_GOVERNANCE_UPDATED','research_source',source.id,v);return row});res.json(updated)}catch(error){next(error)}})
app.delete('/api/research/:id/sources/:sourceId',authenticate,async(req,res,next)=>{try{if(!await canAccessResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot remove this research source.'});const source=(await query('SELECT * FROM research_sources WHERE id=$1 AND project_id=$2',[req.params.sourceId,req.params.id])).rows[0];if(!source)return res.status(404).json({error:'Research source not found.'});if(source.created_by!==req.user.id&&!isManagementRole(req.user.role))return res.status(403).json({error:'Only the source owner or a research manager can remove this evidence record.'});await transaction(async client=>{await client.query('DELETE FROM research_sources WHERE id=$1',[source.id]);await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,'SOURCE_REMOVED',JSON.stringify({sourceId:source.id,title:source.title})]);await audit(client,req.user.id,'RESEARCH_SOURCE_REMOVED','research_source',source.id,{projectId:req.params.id,title:source.title})});res.status(204).end()}catch(error){next(error)}})
app.get('/api/research/:id/activity',authenticate,async(req,res,next)=>{try{if(!await canAccessResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot view activity for this research project.'});res.json((await query('SELECT a.*,u.name user_name FROM research_activity a LEFT JOIN users u ON u.id=a.user_id WHERE a.project_id=$1 ORDER BY a.created_at DESC',[req.params.id])).rows)}catch(error){next(error)}})

/* APP2_RESEARCH_TEMPLATE_LIBRARY_V11 */
const researchTemplateLibraryV11=[{"template_key":"research-blank-report","name":"Blank Research Report","description":"Minimal unrestricted format for work that does not fit a predefined research structure.","sections":[{"key":"report_body","title":"Report Body"}]},{"template_key":"research-standard-report","name":"Standard Research Report","description":"General-purpose institutional research report suitable for most studies.","sections":[{"key":"title_page","title":"Title Page"},{"key":"document_control","title":"Document Control"},{"key":"executive_summary","title":"Executive Summary"},{"key":"introduction_and_background","title":"Introduction and Background"},{"key":"research_problem_purpose","title":"Research Problem / Purpose"},{"key":"research_questions_objectives","title":"Research Questions / Objectives"},{"key":"literature_evidence_review","title":"Literature / Evidence Review"},{"key":"methodology","title":"Methodology"},{"key":"findings_results","title":"Findings / Results"},{"key":"discussion","title":"Discussion"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-quantitative-report","name":"Quantitative Research Report","description":"For studies based primarily on numerical data and statistical analysis.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"introduction","title":"Introduction"},{"key":"problem_statement","title":"Problem Statement"},{"key":"objectives_and_hypotheses","title":"Objectives and Hypotheses"},{"key":"literature_review","title":"Literature Review"},{"key":"study_design","title":"Study Design"},{"key":"population_and_sampling","title":"Population and Sampling"},{"key":"variables_and_measures","title":"Variables and Measures"},{"key":"data_collection","title":"Data Collection"},{"key":"statistical_analysis","title":"Statistical Analysis"},{"key":"results","title":"Results"},{"key":"discussion","title":"Discussion"},{"key":"limitations","title":"Limitations"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-qualitative-report","name":"Qualitative Research Report","description":"For interviews, focus groups, observation and other qualitative inquiry.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"introduction","title":"Introduction"},{"key":"research_purpose_and_questions","title":"Research Purpose and Questions"},{"key":"context_and_literature","title":"Context and Literature"},{"key":"qualitative_approach","title":"Qualitative Approach"},{"key":"participants_and_sampling","title":"Participants and Sampling"},{"key":"data_collection","title":"Data Collection"},{"key":"data_analysis_coding","title":"Data Analysis / Coding"},{"key":"reflexivity","title":"Reflexivity"},{"key":"trustworthiness_quality","title":"Trustworthiness / Quality"},{"key":"findings_themes","title":"Findings / Themes"},{"key":"discussion","title":"Discussion"},{"key":"limitations","title":"Limitations"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-mixed-methods-report","name":"Mixed Methods Research Report","description":"For integrated quantitative and qualitative research.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"introduction","title":"Introduction"},{"key":"research_questions_and_objectives","title":"Research Questions and Objectives"},{"key":"conceptual_framework","title":"Conceptual Framework"},{"key":"mixed_methods_design","title":"Mixed Methods Design"},{"key":"quantitative_methods","title":"Quantitative Methods"},{"key":"qualitative_methods","title":"Qualitative Methods"},{"key":"integration_strategy","title":"Integration Strategy"},{"key":"quantitative_results","title":"Quantitative Results"},{"key":"qualitative_findings","title":"Qualitative Findings"},{"key":"integrated_findings","title":"Integrated Findings"},{"key":"discussion","title":"Discussion"},{"key":"limitations","title":"Limitations"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-survey-report","name":"Survey Research Report","description":"For questionnaire-based staff, citizen, customer or institutional surveys.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"background_and_objectives","title":"Background and Objectives"},{"key":"survey_population","title":"Survey Population"},{"key":"sampling_design","title":"Sampling Design"},{"key":"questionnaire_instrument","title":"Questionnaire / Instrument"},{"key":"data_collection","title":"Data Collection"},{"key":"response_rate_and_data_quality","title":"Response Rate and Data Quality"},{"key":"respondent_profile","title":"Respondent Profile"},{"key":"key_results","title":"Key Results"},{"key":"subgroup_findings","title":"Subgroup Findings"},{"key":"discussion","title":"Discussion"},{"key":"limitations","title":"Limitations"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"},{"key":"questionnaire","title":"Questionnaire"},{"key":"technical_appendices","title":"Technical Appendices"}]},{"template_key":"research-case-study-report","name":"Case Study Research Report","description":"For in-depth analysis of a programme, institution, event, process or bounded case.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"case_overview","title":"Case Overview"},{"key":"research_purpose_and_questions","title":"Research Purpose and Questions"},{"key":"context","title":"Context"},{"key":"case_selection","title":"Case Selection"},{"key":"sources_of_evidence","title":"Sources of Evidence"},{"key":"analytical_approach","title":"Analytical Approach"},{"key":"case_narrative","title":"Case Narrative"},{"key":"findings","title":"Findings"},{"key":"triangulation","title":"Triangulation"},{"key":"discussion","title":"Discussion"},{"key":"lessons_learned","title":"Lessons Learned"},{"key":"limitations","title":"Limitations"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-comparative-report","name":"Comparative Research Report","description":"For comparison of institutions, jurisdictions, programmes, groups or periods.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"background","title":"Background"},{"key":"comparison_purpose_and_questions","title":"Comparison Purpose and Questions"},{"key":"cases_units_compared","title":"Cases / Units Compared"},{"key":"comparison_framework_and_criteria","title":"Comparison Framework and Criteria"},{"key":"data_sources","title":"Data Sources"},{"key":"methodology","title":"Methodology"},{"key":"profile_of_cases","title":"Profile of Cases"},{"key":"comparative_findings","title":"Comparative Findings"},{"key":"similarities_and_differences","title":"Similarities and Differences"},{"key":"benchmarking_analysis","title":"Benchmarking Analysis"},{"key":"discussion","title":"Discussion"},{"key":"limitations","title":"Limitations"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-cross-sectional-report","name":"Cross-Sectional Study Report","description":"For studies measuring variables at a defined point or period in time.","sections":[{"key":"title_page","title":"Title Page"},{"key":"abstract_executive_summary","title":"Abstract / Executive Summary"},{"key":"introduction","title":"Introduction"},{"key":"objectives","title":"Objectives"},{"key":"study_design_and_setting","title":"Study Design and Setting"},{"key":"population","title":"Population"},{"key":"sampling","title":"Sampling"},{"key":"variables_and_measurement","title":"Variables and Measurement"},{"key":"data_collection","title":"Data Collection"},{"key":"analysis","title":"Analysis"},{"key":"results","title":"Results"},{"key":"discussion","title":"Discussion"},{"key":"limitations","title":"Limitations"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-longitudinal-report","name":"Longitudinal / Cohort Study Report","description":"For repeated observation of a population, cohort or indicators over time.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"introduction","title":"Introduction"},{"key":"objectives","title":"Objectives"},{"key":"cohort_panel_design","title":"Cohort / Panel Design"},{"key":"population_and_recruitment","title":"Population and Recruitment"},{"key":"baseline_measures","title":"Baseline Measures"},{"key":"follow_up_schedule","title":"Follow-up Schedule"},{"key":"retention_attrition","title":"Retention / Attrition"},{"key":"data_collection","title":"Data Collection"},{"key":"analysis","title":"Analysis"},{"key":"longitudinal_results","title":"Longitudinal Results"},{"key":"change_over_time","title":"Change Over Time"},{"key":"discussion","title":"Discussion"},{"key":"limitations","title":"Limitations"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-evaluation-report","name":"Programme / Policy Evaluation Report","description":"For formal evaluation of programmes, policies, projects or services.","sections":[{"key":"title_page","title":"Title Page"},{"key":"evaluation_information","title":"Evaluation Information"},{"key":"executive_summary","title":"Executive Summary"},{"key":"introduction","title":"Introduction"},{"key":"intervention_policy_description","title":"Intervention / Policy Description"},{"key":"purpose_scope_and_evaluation_questions","title":"Purpose, Scope and Evaluation Questions"},{"key":"theory_of_change_results_framework","title":"Theory of Change / Results Framework"},{"key":"evaluation_criteria_and_matrix","title":"Evaluation Criteria and Matrix"},{"key":"methodology","title":"Methodology"},{"key":"ethics_and_limitations","title":"Ethics and Limitations"},{"key":"findings_by_evaluation_question","title":"Findings by Evaluation Question"},{"key":"conclusions","title":"Conclusions"},{"key":"lessons_learned","title":"Lessons Learned"},{"key":"recommendations","title":"Recommendations"},{"key":"management_response_action_matrix","title":"Management Response / Action Matrix"},{"key":"references","title":"References"},{"key":"annexes","title":"Annexes"}]},{"template_key":"research-baseline-report","name":"Baseline Study Report","description":"For pre-intervention benchmark measurement.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"background","title":"Background"},{"key":"purpose_and_baseline_objectives","title":"Purpose and Baseline Objectives"},{"key":"results_framework_indicators","title":"Results Framework / Indicators"},{"key":"methodology","title":"Methodology"},{"key":"sampling","title":"Sampling"},{"key":"data_collection","title":"Data Collection"},{"key":"data_quality","title":"Data Quality"},{"key":"baseline_characteristics","title":"Baseline Characteristics"},{"key":"indicator_baseline_results","title":"Indicator Baseline Results"},{"key":"equity_subgroup_analysis","title":"Equity / Subgroup Analysis"},{"key":"discussion","title":"Discussion"},{"key":"limitations","title":"Limitations"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations_for_implementation_monitoring","title":"Recommendations for Implementation / Monitoring"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-midline-report","name":"Midline Study Report","description":"For interim measurement and course correction.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"programme_study_background","title":"Programme / Study Background"},{"key":"midline_purpose","title":"Midline Purpose"},{"key":"methodology","title":"Methodology"},{"key":"comparability_with_baseline","title":"Comparability with Baseline"},{"key":"implementation_progress","title":"Implementation Progress"},{"key":"midline_indicator_results","title":"Midline Indicator Results"},{"key":"change_from_baseline","title":"Change from Baseline"},{"key":"emerging_outcomes","title":"Emerging Outcomes"},{"key":"implementation_challenges","title":"Implementation Challenges"},{"key":"discussion","title":"Discussion"},{"key":"limitations","title":"Limitations"},{"key":"course_correction_recommendations","title":"Course-correction Recommendations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-endline-report","name":"Endline Study Report","description":"For final-period measurement and comparison with baseline or targets.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"background","title":"Background"},{"key":"endline_purpose_and_questions","title":"Endline Purpose and Questions"},{"key":"methodology","title":"Methodology"},{"key":"comparability_with_baseline_midline","title":"Comparability with Baseline / Midline"},{"key":"final_indicator_results","title":"Final Indicator Results"},{"key":"change_over_time","title":"Change Over Time"},{"key":"outcome_findings","title":"Outcome Findings"},{"key":"subgroup_equity_findings","title":"Subgroup / Equity Findings"},{"key":"discussion","title":"Discussion"},{"key":"limitations","title":"Limitations"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"},{"key":"lessons_learned","title":"Lessons Learned"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-impact-evaluation-report","name":"Impact Evaluation Report","description":"For causal or counterfactual assessment of intervention effects.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"intervention_and_theory_of_change","title":"Intervention and Theory of Change"},{"key":"evaluation_questions","title":"Evaluation Questions"},{"key":"impact_evaluation_design","title":"Impact Evaluation Design"},{"key":"counterfactual_comparison_strategy","title":"Counterfactual / Comparison Strategy"},{"key":"sampling_and_power","title":"Sampling and Power"},{"key":"outcome_measures","title":"Outcome Measures"},{"key":"data_collection","title":"Data Collection"},{"key":"identification_estimation_strategy","title":"Identification / Estimation Strategy"},{"key":"validity_checks","title":"Validity Checks"},{"key":"impact_results","title":"Impact Results"},{"key":"subgroup_effects","title":"Subgroup Effects"},{"key":"cost_value_considerations","title":"Cost / Value Considerations"},{"key":"sensitivity_robustness_analysis","title":"Sensitivity / Robustness Analysis"},{"key":"limitations","title":"Limitations"},{"key":"conclusions","title":"Conclusions"},{"key":"policy_programme_implications","title":"Policy / Programme Implications"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-needs-assessment-report","name":"Needs Assessment Report","description":"For identifying gaps between current conditions and desired services, capabilities or outcomes.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"background","title":"Background"},{"key":"assessment_purpose_and_scope","title":"Assessment Purpose and Scope"},{"key":"stakeholders_population","title":"Stakeholders / Population"},{"key":"needs_framework","title":"Needs Framework"},{"key":"methods_and_data_sources","title":"Methods and Data Sources"},{"key":"current_state","title":"Current State"},{"key":"desired_state_standards","title":"Desired State / Standards"},{"key":"gap_analysis","title":"Gap Analysis"},{"key":"priority_needs","title":"Priority Needs"},{"key":"root_causes_barriers","title":"Root Causes / Barriers"},{"key":"available_assets_resources","title":"Available Assets / Resources"},{"key":"options","title":"Options"},{"key":"prioritised_recommendations","title":"Prioritised Recommendations"},{"key":"implementation_considerations","title":"Implementation Considerations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-situational-analysis-report","name":"Situational Analysis Report","description":"For current-state, trend, stakeholder, risk and opportunity analysis.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"purpose_and_scope","title":"Purpose and Scope"},{"key":"context","title":"Context"},{"key":"methods_and_sources","title":"Methods and Sources"},{"key":"current_situation","title":"Current Situation"},{"key":"trend_analysis","title":"Trend Analysis"},{"key":"stakeholder_analysis","title":"Stakeholder Analysis"},{"key":"institutional_policy_environment","title":"Institutional / Policy Environment"},{"key":"drivers_and_root_causes","title":"Drivers and Root Causes"},{"key":"strengths_assets","title":"Strengths / Assets"},{"key":"gaps_and_constraints","title":"Gaps and Constraints"},{"key":"risks_and_opportunities","title":"Risks and Opportunities"},{"key":"priority_issues","title":"Priority Issues"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-feasibility-report","name":"Feasibility Study Report","description":"For assessing whether a proposed intervention, system, programme or policy is viable.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"proposal_concept","title":"Proposal / Concept"},{"key":"purpose_and_scope","title":"Purpose and Scope"},{"key":"requirements","title":"Requirements"},{"key":"methodology","title":"Methodology"},{"key":"demand_need_assessment","title":"Demand / Need Assessment"},{"key":"technical_feasibility","title":"Technical Feasibility"},{"key":"operational_feasibility","title":"Operational Feasibility"},{"key":"institutional_legal_feasibility","title":"Institutional / Legal Feasibility"},{"key":"financial_economic_feasibility","title":"Financial / Economic Feasibility"},{"key":"human_resource_feasibility","title":"Human Resource Feasibility"},{"key":"risk_assessment","title":"Risk Assessment"},{"key":"options_analysis","title":"Options Analysis"},{"key":"cost_benefit_value_considerations","title":"Cost-Benefit / Value Considerations"},{"key":"implementation_requirements","title":"Implementation Requirements"},{"key":"conclusions","title":"Conclusions"},{"key":"go_no_go_recommendation","title":"Go / No-Go Recommendation"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-policy-report","name":"Policy Research Report","description":"For evidence-to-policy analysis of a public problem, options and implementation implications.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"policy_issue","title":"Policy Issue"},{"key":"background_and_context","title":"Background and Context"},{"key":"problem_definition","title":"Problem Definition"},{"key":"policy_questions","title":"Policy Questions"},{"key":"evidence_and_methods","title":"Evidence and Methods"},{"key":"stakeholder_institutional_analysis","title":"Stakeholder / Institutional Analysis"},{"key":"current_policy_legal_framework","title":"Current Policy / Legal Framework"},{"key":"findings","title":"Findings"},{"key":"policy_options","title":"Policy Options"},{"key":"options_appraisal","title":"Options Appraisal"},{"key":"preferred_option","title":"Preferred Option"},{"key":"implementation_considerations","title":"Implementation Considerations"},{"key":"risks_and_mitigation","title":"Risks and Mitigation"},{"key":"monitoring_indicators","title":"Monitoring Indicators"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-systematic-review-report","name":"Systematic Review / Evidence Synthesis Report","description":"For transparent evidence synthesis with documented search, selection and appraisal.","sections":[{"key":"title_page","title":"Title Page"},{"key":"structured_abstract","title":"Structured Abstract"},{"key":"introduction_and_rationale","title":"Introduction and Rationale"},{"key":"review_question_objectives","title":"Review Question / Objectives"},{"key":"eligibility_criteria","title":"Eligibility Criteria"},{"key":"information_sources","title":"Information Sources"},{"key":"search_strategy","title":"Search Strategy"},{"key":"selection_process","title":"Selection Process"},{"key":"data_extraction","title":"Data Extraction"},{"key":"risk_of_bias_quality_appraisal","title":"Risk of Bias / Quality Appraisal"},{"key":"synthesis_methods","title":"Synthesis Methods"},{"key":"study_selection","title":"Study Selection"},{"key":"study_characteristics","title":"Study Characteristics"},{"key":"results_of_individual_studies","title":"Results of Individual Studies"},{"key":"synthesis_results","title":"Synthesis Results"},{"key":"certainty_confidence_in_evidence","title":"Certainty / Confidence in Evidence"},{"key":"discussion","title":"Discussion"},{"key":"limitations","title":"Limitations"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations_implications","title":"Recommendations / Implications"},{"key":"references","title":"References"},{"key":"search_strategies_and_appendices","title":"Search Strategies and Appendices"}]},{"template_key":"research-scoping-review-report","name":"Scoping Review Report","description":"For broad evidence mapping, concepts and research-gap identification.","sections":[{"key":"title_page","title":"Title Page"},{"key":"abstract_executive_summary","title":"Abstract / Executive Summary"},{"key":"introduction","title":"Introduction"},{"key":"review_questions","title":"Review Questions"},{"key":"eligibility_criteria","title":"Eligibility Criteria"},{"key":"information_sources_and_search","title":"Information Sources and Search"},{"key":"selection_process","title":"Selection Process"},{"key":"data_charting","title":"Data Charting"},{"key":"synthesis_mapping_approach","title":"Synthesis / Mapping Approach"},{"key":"results","title":"Results"},{"key":"evidence_map","title":"Evidence Map"},{"key":"concepts_themes","title":"Concepts / Themes"},{"key":"research_gaps","title":"Research Gaps"},{"key":"discussion","title":"Discussion"},{"key":"limitations","title":"Limitations"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-rapid-evidence-report","name":"Rapid Evidence Assessment Report","description":"For time-bounded review using explicitly streamlined evidence methods.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"decision_policy_question","title":"Decision / Policy Question"},{"key":"scope_and_rapid_review_protocol","title":"Scope and Rapid Review Protocol"},{"key":"eligibility_criteria","title":"Eligibility Criteria"},{"key":"search_sources_and_strategy","title":"Search Sources and Strategy"},{"key":"screening_approach","title":"Screening Approach"},{"key":"quality_appraisal","title":"Quality Appraisal"},{"key":"evidence_summary","title":"Evidence Summary"},{"key":"key_findings","title":"Key Findings"},{"key":"evidence_gaps","title":"Evidence Gaps"},{"key":"strength_confidence_of_evidence","title":"Strength / Confidence of Evidence"},{"key":"limitations_of_rapid_method","title":"Limitations of Rapid Method"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-literature-review-report","name":"Literature Review Report","description":"For narrative or structured synthesis of published and grey literature.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"background","title":"Background"},{"key":"review_purpose_and_questions","title":"Review Purpose and Questions"},{"key":"scope","title":"Scope"},{"key":"search_source_identification","title":"Search / Source Identification"},{"key":"inclusion_and_exclusion_approach","title":"Inclusion and Exclusion Approach"},{"key":"literature_profile","title":"Literature Profile"},{"key":"thematic_synthesis","title":"Thematic Synthesis"},{"key":"areas_of_agreement","title":"Areas of Agreement"},{"key":"areas_of_debate","title":"Areas of Debate"},{"key":"evidence_gaps","title":"Evidence Gaps"},{"key":"discussion","title":"Discussion"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations_research_agenda","title":"Recommendations / Research Agenda"},{"key":"references","title":"References"}]},{"template_key":"research-desk-review-report","name":"Desk Review Report","description":"For analysis of existing documents, administrative data, policies and secondary sources.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"purpose_and_scope","title":"Purpose and Scope"},{"key":"review_questions","title":"Review Questions"},{"key":"documents_data_reviewed","title":"Documents / Data Reviewed"},{"key":"review_method","title":"Review Method"},{"key":"source_quality_and_limitations","title":"Source Quality and Limitations"},{"key":"findings_by_question","title":"Findings by Question"},{"key":"cross_document_analysis","title":"Cross-document Analysis"},{"key":"gaps_inconsistencies","title":"Gaps / Inconsistencies"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"},{"key":"source_register","title":"Source Register"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-action-research-report","name":"Action Research Report","description":"For iterative practitioner research organised around action, observation and reflection.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"context_and_problem","title":"Context and Problem"},{"key":"research_purpose","title":"Research Purpose"},{"key":"participants_stakeholders","title":"Participants / Stakeholders"},{"key":"action_research_cycle_design","title":"Action Research Cycle / Design"},{"key":"baseline_initial_understanding","title":"Baseline / Initial Understanding"},{"key":"planned_intervention_action","title":"Planned Intervention / Action"},{"key":"data_collection","title":"Data Collection"},{"key":"observations_and_results","title":"Observations and Results"},{"key":"reflection","title":"Reflection"},{"key":"adaptations_next_cycle","title":"Adaptations / Next Cycle"},{"key":"learning","title":"Learning"},{"key":"limitations","title":"Limitations"},{"key":"conclusions","title":"Conclusions"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-organisational-diagnostic-report","name":"Institutional / Organisational Diagnostic Report","description":"For organisational structure, process, capability and performance diagnostics.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"institution_directorate_profile","title":"Institution / Directorate Profile"},{"key":"purpose_and_scope","title":"Purpose and Scope"},{"key":"diagnostic_framework","title":"Diagnostic Framework"},{"key":"methodology","title":"Methodology"},{"key":"governance_and_structure","title":"Governance and Structure"},{"key":"processes_and_service_delivery","title":"Processes and Service Delivery"},{"key":"people_and_capability","title":"People and Capability"},{"key":"technology_information","title":"Technology / Information"},{"key":"performance_and_results","title":"Performance and Results"},{"key":"culture_change_readiness","title":"Culture / Change Readiness"},{"key":"stakeholder_findings","title":"Stakeholder Findings"},{"key":"strengths","title":"Strengths"},{"key":"gaps_and_root_causes","title":"Gaps and Root Causes"},{"key":"risks","title":"Risks"},{"key":"priority_interventions","title":"Priority Interventions"},{"key":"recommendations","title":"Recommendations"},{"key":"implementation_roadmap","title":"Implementation Roadmap"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-benchmarking-report","name":"Benchmarking Report","description":"For comparison of performance or practices against peers, standards or benchmarks.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"benchmarking_objective","title":"Benchmarking Objective"},{"key":"scope_and_benchmark_criteria","title":"Scope and Benchmark Criteria"},{"key":"comparator_selection","title":"Comparator Selection"},{"key":"data_sources_and_method","title":"Data Sources and Method"},{"key":"current_performance","title":"Current Performance"},{"key":"comparator_profiles","title":"Comparator Profiles"},{"key":"benchmark_results","title":"Benchmark Results"},{"key":"performance_gaps","title":"Performance Gaps"},{"key":"good_practices","title":"Good Practices"},{"key":"transferability_assessment","title":"Transferability Assessment"},{"key":"priority_opportunities","title":"Priority Opportunities"},{"key":"recommendations","title":"Recommendations"},{"key":"implementation_considerations","title":"Implementation Considerations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-technical-report","name":"Technical Research Report","description":"For detailed methods, specifications, analysis, validation and reproducibility.","sections":[{"key":"title_page","title":"Title Page"},{"key":"document_control","title":"Document Control"},{"key":"abstract_executive_summary","title":"Abstract / Executive Summary"},{"key":"introduction","title":"Introduction"},{"key":"objectives","title":"Objectives"},{"key":"technical_background","title":"Technical Background"},{"key":"requirements_specifications","title":"Requirements / Specifications"},{"key":"methods_procedures","title":"Methods / Procedures"},{"key":"data_materials","title":"Data / Materials"},{"key":"analysis","title":"Analysis"},{"key":"results","title":"Results"},{"key":"validation_verification","title":"Validation / Verification"},{"key":"technical_discussion","title":"Technical Discussion"},{"key":"constraints_limitations","title":"Constraints / Limitations"},{"key":"conclusions","title":"Conclusions"},{"key":"technical_recommendations","title":"Technical Recommendations"},{"key":"references","title":"References"},{"key":"technical_appendices","title":"Technical Appendices"}]},{"template_key":"research-research-brief","name":"Research Brief / Executive Summary","description":"For concise decision-oriented communication of evidence, findings and implications.","sections":[{"key":"title","title":"Title"},{"key":"research_question_issue","title":"Research Question / Issue"},{"key":"why_it_matters","title":"Why It Matters"},{"key":"approach_evidence_base","title":"Approach / Evidence Base"},{"key":"key_findings","title":"Key Findings"},{"key":"implications","title":"Implications"},{"key":"recommendations","title":"Recommendations"},{"key":"limitations_caveats","title":"Limitations / Caveats"},{"key":"references_further_reading","title":"References / Further Reading"}]},{"template_key":"research-public-service-delivery-report","name":"Public Service Delivery Research Report","description":"For research on service quality, access, efficiency, citizen experience and institutional delivery performance.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"service_context","title":"Service Context and Mandate"},{"key":"research_problem","title":"Research Problem"},{"key":"objectives_questions","title":"Objectives and Research Questions"},{"key":"service_delivery_framework","title":"Service Delivery Framework"},{"key":"methodology","title":"Methodology"},{"key":"user_stakeholder_profile","title":"Users and Stakeholder Profile"},{"key":"access_and_reach","title":"Access and Reach"},{"key":"service_quality","title":"Service Quality"},{"key":"timeliness_efficiency","title":"Timeliness and Efficiency"},{"key":"citizen_experience","title":"Citizen / Client Experience"},{"key":"equity_inclusion","title":"Equity and Inclusion"},{"key":"digital_service_channels","title":"Digital Service Channels"},{"key":"findings","title":"Findings"},{"key":"root_causes","title":"Root Causes"},{"key":"recommendations","title":"Recommendations"},{"key":"implementation_priorities","title":"Implementation Priorities"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-workforce-hr-report","name":"Workforce / Human Resource Research Report","description":"For workforce planning, establishment, skills, productivity, employee experience and public-sector HR research.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"workforce_context","title":"Workforce Context"},{"key":"research_problem","title":"Research Problem"},{"key":"objectives_questions","title":"Objectives and Questions"},{"key":"policy_regulatory_context","title":"Policy and Regulatory Context"},{"key":"methodology","title":"Methodology"},{"key":"workforce_profile","title":"Workforce Profile"},{"key":"staffing_establishment","title":"Staffing and Establishment"},{"key":"skills_capability","title":"Skills and Capability"},{"key":"performance_productivity","title":"Performance and Productivity"},{"key":"employee_experience","title":"Employee Experience"},{"key":"succession_retention","title":"Succession and Retention"},{"key":"equity_inclusion","title":"Equity and Inclusion"},{"key":"findings","title":"Findings"},{"key":"workforce_risks","title":"Workforce Risks"},{"key":"recommendations","title":"Recommendations"},{"key":"implementation_roadmap","title":"Implementation Roadmap"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-digital-transformation-report","name":"Digital Transformation / ICT Research Report","description":"For digital government, systems, automation, data, AI, cybersecurity and technology adoption studies.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"digital_context","title":"Digital Context"},{"key":"problem_opportunity","title":"Problem / Opportunity"},{"key":"objectives_questions","title":"Objectives and Questions"},{"key":"current_state_architecture","title":"Current-State Architecture"},{"key":"methodology","title":"Methodology"},{"key":"user_process_findings","title":"User and Process Findings"},{"key":"technology_findings","title":"Technology Findings"},{"key":"data_interoperability","title":"Data and Interoperability"},{"key":"cybersecurity_privacy","title":"Cybersecurity and Privacy"},{"key":"adoption_change_readiness","title":"Adoption and Change Readiness"},{"key":"cost_value_analysis","title":"Cost and Value Analysis"},{"key":"risks_constraints","title":"Risks and Constraints"},{"key":"target_state_options","title":"Target-State Options"},{"key":"recommendations","title":"Recommendations"},{"key":"implementation_roadmap","title":"Implementation Roadmap"},{"key":"monitoring_metrics","title":"Monitoring Metrics"},{"key":"references","title":"References"},{"key":"technical_appendices","title":"Technical Appendices"}]},{"template_key":"research-governance-compliance-report","name":"Governance, Compliance & Integrity Research Report","description":"For governance, accountability, compliance, integrity, controls and institutional oversight research.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"governance_context","title":"Governance Context"},{"key":"research_problem","title":"Research Problem"},{"key":"objectives_questions","title":"Objectives and Questions"},{"key":"legal_policy_framework","title":"Legal and Policy Framework"},{"key":"methodology","title":"Methodology"},{"key":"governance_arrangements","title":"Governance Arrangements"},{"key":"control_environment","title":"Control Environment"},{"key":"compliance_findings","title":"Compliance Findings"},{"key":"accountability_transparency","title":"Accountability and Transparency"},{"key":"integrity_ethics","title":"Integrity and Ethics"},{"key":"risk_exposure","title":"Risk Exposure"},{"key":"root_causes","title":"Root Causes"},{"key":"good_practices","title":"Good Practices"},{"key":"recommendations","title":"Recommendations"},{"key":"management_actions","title":"Management Actions"},{"key":"monitoring_follow_up","title":"Monitoring and Follow-up"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-citizen-satisfaction-report","name":"Citizen / Client Satisfaction Study Report","description":"For citizen, client, employee or stakeholder satisfaction and experience measurement.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"study_context","title":"Study Context"},{"key":"objectives","title":"Objectives"},{"key":"service_population","title":"Service Population"},{"key":"methodology","title":"Methodology"},{"key":"sampling","title":"Sampling"},{"key":"instrument","title":"Survey / Interview Instrument"},{"key":"response_profile","title":"Response Profile"},{"key":"overall_satisfaction","title":"Overall Satisfaction"},{"key":"service_dimension_results","title":"Service Dimension Results"},{"key":"channel_experience","title":"Channel Experience"},{"key":"complaints_feedback","title":"Complaints and Feedback"},{"key":"subgroup_analysis","title":"Subgroup Analysis"},{"key":"drivers_of_satisfaction","title":"Drivers of Satisfaction"},{"key":"priority_gaps","title":"Priority Gaps"},{"key":"recommendations","title":"Recommendations"},{"key":"action_plan","title":"Action Plan"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]},{"template_key":"research-regulatory-impact-report","name":"Regulatory / Policy Impact Assessment Report","description":"For assessing expected or observed impacts, costs, benefits, risks and implementation effects of policy or regulation.","sections":[{"key":"title_page","title":"Title Page"},{"key":"executive_summary","title":"Executive Summary"},{"key":"policy_regulatory_context","title":"Policy / Regulatory Context"},{"key":"problem_definition","title":"Problem Definition"},{"key":"objectives","title":"Objectives"},{"key":"options_assessed","title":"Options Assessed"},{"key":"methodology","title":"Methodology"},{"key":"stakeholder_analysis","title":"Stakeholder Analysis"},{"key":"baseline_counterfactual","title":"Baseline / Counterfactual"},{"key":"economic_impacts","title":"Economic Impacts"},{"key":"social_impacts","title":"Social Impacts"},{"key":"institutional_impacts","title":"Institutional Impacts"},{"key":"distributional_equity_impacts","title":"Distributional / Equity Impacts"},{"key":"implementation_burden","title":"Implementation and Compliance Burden"},{"key":"risks_uncertainties","title":"Risks and Uncertainties"},{"key":"comparative_assessment","title":"Comparative Assessment"},{"key":"preferred_option","title":"Preferred Option"},{"key":"implementation_monitoring","title":"Implementation and Monitoring"},{"key":"recommendations","title":"Recommendations"},{"key":"references","title":"References"},{"key":"appendices","title":"Appendices"}]}]
const ensureResearchReportTemplates=async()=>{
  for(const template of researchTemplateLibraryV11){
    await query(`INSERT INTO document_templates(template_key,name,context,description,sections,version,governance_status,active)
      VALUES($1,$2,'Research',$3,$4::jsonb,1,'Standard',TRUE)
      ON CONFLICT(template_key) DO UPDATE SET
        name=EXCLUDED.name,
        description=EXCLUDED.description,
        sections=CASE WHEN document_templates.governance_status='Retired' THEN document_templates.sections ELSE EXCLUDED.sections END,
        version=GREATEST(document_templates.version,EXCLUDED.version),
        governance_status=CASE WHEN document_templates.governance_status='Retired' THEN document_templates.governance_status ELSE 'Standard' END,
        active=CASE WHEN document_templates.governance_status='Retired' THEN document_templates.active ELSE TRUE END,
        updated_at=NOW()`,
      [template.template_key,template.name,template.description,JSON.stringify(template.sections)])
  }
}

app.get('/api/document-templates',authenticate,async(req,res,next)=>{try{const context=z.enum(['Assignment','Research']).parse(String(req.query.context||''));if(context==='Assignment')await ensureAssignmentReportTemplates();if(context==='Research')await ensureResearchReportTemplates();res.json((await query("SELECT t.*,creator.name created_by_name,approver.name approved_by_name FROM document_templates t LEFT JOIN users creator ON creator.id=t.created_by LEFT JOIN users approver ON approver.id=t.approved_by WHERE t.context=$1 AND(t.active=TRUE OR $2::boolean) ORDER BY CASE WHEN t.template_key LIKE 'task-%' THEN 1 ELSE 0 END,t.name",[context,['System Admin','Deputy Director'].includes(req.user.role)])).rows)}catch(error){next(error)}})
app.post('/api/document-templates',authenticate,authorize('System Admin','Deputy Director'),validate(z.object({name:z.string().min(3).max(200),context:z.enum(['Assignment','Research']),description:z.string().max(2000).default(''),sections:z.array(z.object({key:z.string().min(1).max(100),title:z.string().min(2).max(200)})).min(1).max(30)})),async(req,res,next)=>{try{if(!isOrganisationScopeRole(req.user.role))return res.status(403).json({error:'Document template governance is Directorate-level and is outside team-manager scope.'});const v=req.validated;const key=`${v.context.toLowerCase()}-${v.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${Date.now()}`;const row=await transaction(async client=>{const created=(await client.query("INSERT INTO document_templates(template_key,name,context,description,sections,governance_status,created_by)VALUES($1,$2,$3,$4,$5,'Draft',$6)RETURNING *",[key,v.name,v.context,v.description,JSON.stringify(v.sections),req.user.id])).rows[0];await audit(client,req.user.id,'DOCUMENT_TEMPLATE_CREATED','document_template',created.id,{name:created.name,context:created.context});return created});res.status(201).json(row)}catch(error){next(error)}})
app.patch('/api/document-templates/:id/governance',authenticate,authorize('System Admin','Deputy Director'),validate(z.object({status:z.enum(['Draft','Standard','Approved','Retired']),active:z.boolean()})),async(req,res,next)=>{try{if(!isOrganisationScopeRole(req.user.role))return res.status(403).json({error:'Document template governance is Directorate-level and is outside team-manager scope.'});const row=await transaction(async client=>{const updated=(await client.query('UPDATE document_templates SET governance_status=$1,active=$2,approved_by=CASE WHEN $1=\'Approved\' THEN $3 ELSE approved_by END,updated_at=NOW() WHERE id=$4 RETURNING *',[req.validated.status,req.validated.active,req.user.id,req.params.id])).rows[0];if(updated)await audit(client,req.user.id,'DOCUMENT_TEMPLATE_GOVERNANCE_UPDATED','document_template',updated.id,req.validated);return updated});if(!row)return res.status(404).json({error:'Template not found.'});res.json(row)}catch(error){next(error)}})
const wordDocument=(title,metadata,sections)=>`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:2.2cm}body{font-family:Arial,sans-serif;color:#111;line-height:1.5}h1{text-align:center;margin:80px 0 30px}h2{page-break-before:auto;border-bottom:1px solid #777;padding-bottom:6px}.meta{width:100%;border-collapse:collapse;margin:25px 0 60px}.meta td{border:1px solid #999;padding:8px}.draft{color:#a22;font-weight:bold}</style></head><body><h1>${sanitizeReportHtml(title)}</h1><table class="meta">${Object.entries(metadata).map(([key,value])=>`<tr><td><b>${sanitizeReportHtml(key)}</b></td><td>${sanitizeReportHtml(value)}</td></tr>`).join('')}</table>${sections.map(section=>`<h2>${sanitizeReportHtml(section.title)}</h2>${section.content||'<p>&nbsp;</p>'}`).join('')}</body></html>`
const reportPlainText=taskReportHtmlToPlainText
const buildPscLogoParagraphs=async()=>{
  try{
    const data=await readFile(new URL('../../public/psc-logo.png',import.meta.url))
    return [
      new Paragraph({alignment:AlignmentType.CENTER,children:[new ImageRun({data,transformation:{width:112,height:46}})]}),
      new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'PUBLIC SERVICE COMMISSION',bold:true,color:'8B6914',size:22})]}),
      new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'RESEARCH DEPARTMENT',color:'80600D',size:16})]}),
      new Paragraph('')
    ]
  }catch(error){
    console.warn('PSC logo could not be loaded for Task Report DOCX:',error?.message||error)
    return []
  }
}
const buildDocx=async(title,metadata,sections,{preserveRichContent=false}={})=>Packer.toBuffer(new WordDocument({...(preserveRichContent?{styles:{paragraphStyles:[{id:'Title',name:'Title',basedOn:'Normal',run:{bold:true,color:'8B6914'}},{id:'Heading1',name:'Heading 1',basedOn:'Normal',run:{bold:true,color:'8B6914'}}]}}:{}),sections:[{properties:{},children:[...(preserveRichContent?await buildPscLogoParagraphs():[]),
  new Paragraph({text:title,heading:HeadingLevel.TITLE}),
  new Paragraph({text:'Document Control',heading:HeadingLevel.HEADING_1}),
  ...Object.entries(metadata).map(([key,value])=>new Paragraph({children:[new TextRun({text:`${key}: `,bold:true}),new TextRun(String(value||''))]})),
  new Paragraph(''),
  ...sections.flatMap(section=>{
    const body=preserveRichContent
      ?taskReportHtmlToDocxElements(section.content)
      :reportPlainText(section.content).split(/\n+/).filter(Boolean).map(text=>new Paragraph(text))
    return section.heading===false?body:[new Paragraph({text:section.title,heading:HeadingLevel.HEADING_1}),...body]
  })
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
const assignmentOperationalTemplateLibrary=[
  {template_key:'progress-report',name:'Assignment Progress Report',description:'Periodic assignment delivery, risks, corrective action and next steps.',sections:[{key:'executive_summary',title:'Executive Summary'},{key:'progress',title:'Progress Against Plan'},{key:'outputs',title:'Outputs Delivered'},{key:'issues',title:'Issues and Risks'},{key:'corrective_actions',title:'Corrective Actions'},{key:'next_steps',title:'Next Steps'},{key:'recommendations',title:'Recommendations'}]},
  {template_key:'completion-report',name:'Assignment Completion Report',description:'Assignment completion, results, outcomes, lessons and recommendations.',sections:[{key:'executive_summary',title:'Executive Summary'},{key:'objectives',title:'Assignment Objectives'},{key:'outputs',title:'Outputs Delivered'},{key:'outcomes',title:'Outcomes'},{key:'lessons',title:'Lessons Learned'},{key:'recommendations',title:'Recommendations'},{key:'appendices',title:'Appendices'}]},
  {template_key:'technical-report',name:'Assignment Technical Report',description:'Detailed assignment methodology, findings, analysis and recommendations.',sections:[{key:'executive_summary',title:'Executive Summary'},{key:'background',title:'Background'},{key:'methodology',title:'Methodology'},{key:'findings',title:'Findings'},{key:'analysis',title:'Analysis'},{key:'recommendations',title:'Recommendations'},{key:'appendices',title:'Appendices'}]},
  {template_key:'meeting-report',name:'Assignment Meeting Report',description:'Meeting context, deliberations, decisions and follow-up actions.',sections:[{key:'meeting_details',title:'Meeting Details'},{key:'attendance',title:'Attendance'},{key:'agenda',title:'Agenda'},{key:'discussion',title:'Discussion'},{key:'decisions',title:'Decisions'},{key:'actions',title:'Action Items'}]},
  {template_key:'task-standard-report',name:'Standard Task Report',description:'Standard controlled report for completed task work.',sections:[{key:'title',title:'Output Title'},{key:'workCompleted',title:'Work Completed'},{key:'evidence',title:'Evidence Reviewed'},{key:'findings',title:'Key Findings'},{key:'recommendations',title:'Recommendations'},{key:'challenges',title:'Challenges or Limitations'},{key:'nextActions',title:'Next Actions'}]},
  {template_key:'task-technical-note',name:'Technical Task Report',description:'Technical task output with method, evidence, analysis and actions.',sections:[{key:'title',title:'Technical Output Title'},{key:'workCompleted',title:'Method and Work Completed'},{key:'evidence',title:'Evidence and Inputs'},{key:'findings',title:'Technical Findings'},{key:'recommendations',title:'Technical Recommendations'},{key:'challenges',title:'Constraints'},{key:'nextActions',title:'Implementation Actions'}]},
  {template_key:'task-field-report',name:'Task Field Report',description:'Controlled record for fieldwork, interviews, inspections or visits.',sections:[{key:'title',title:'Field Activity Title'},{key:'workCompleted',title:'Activity Completed'},{key:'evidence',title:'Observations and Evidence'},{key:'findings',title:'Findings'},{key:'recommendations',title:'Recommended Action'},{key:'challenges',title:'Limitations'},{key:'nextActions',title:'Follow-up Actions'}]}
]
const ensureAssignmentReportTemplates=async()=>{
  await ensureAssignmentFinalReportTemplate()
  for(const template of assignmentOperationalTemplateLibrary)await query(`INSERT INTO document_templates(template_key,name,context,description,sections,version,governance_status,active)
    VALUES($1,$2,'Assignment',$3,$4::jsonb,1,'Standard',TRUE)
    ON CONFLICT(template_key) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,
      sections=CASE WHEN document_templates.governance_status='Retired' THEN document_templates.sections ELSE EXCLUDED.sections END,
      governance_status=CASE WHEN document_templates.governance_status='Retired' THEN document_templates.governance_status ELSE 'Standard' END,
      active=CASE WHEN document_templates.governance_status='Retired' THEN document_templates.active ELSE TRUE END,updated_at=NOW()`,
    [template.template_key,template.name,template.description,JSON.stringify(template.sections)])
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
const buildPdf=(title,metadata,sections)=>buildPscTaskFinalPdf(title,metadata,sections)

app.get('/api/research-document-templates/:id/download',authenticate,async(req,res,next)=>{try{
  const researchId=z.string().uuid().parse(String(req.query.researchId||''))
  if(!await canAccessResearch(req.user,researchId))return res.status(403).json({error:'You cannot download a template for this research project.'})
  await ensureResearchReportTemplates()
  const [templateResult,projectResult]=await Promise.all([
    query("SELECT * FROM document_templates WHERE id=$1 AND context='Research' AND active=TRUE AND governance_status IN('Standard','Approved')",[req.params.id]),
    query(`SELECT p.*,lead.name lead_name FROM research_projects p LEFT JOIN users lead ON lead.id=p.lead_id WHERE p.id=$1 LIMIT 1`,[researchId])
  ])
  const t=templateResult.rows[0],p=projectResult.rows[0]
  if(!t||!p)return res.status(404).json({error:'Research template or project not found.'})
  const reference=`RES-${p.id.replace(/[^a-f0-9]/gi,'').slice(0,8).toUpperCase()}`
  const html=wordDocument(t.name,{
    Organization:'Public Service Commission',
    'Research Reference':reference,
    'Research Project':p.title,
    'Research Lead':p.lead_name||'Unassigned',
    Template:t.name,
    Classification:'INTERNAL',
    Status:'BLANK TEMPLATE',
    Date:new Date().toISOString().slice(0,10),
    'Template Version':String(t.version)
  },t.sections.map(section=>({...section,content:''})))
  res.setHeader('Content-Type','application/msword; charset=utf-8')
  res.setHeader('Content-Disposition',`attachment; filename="${t.template_key}-v${t.version}.doc"`)
  res.send(html)
}catch(error){next(error)}})

app.get('/api/document-templates/:id/download',authenticate,async(req,res,next)=>{try{const assignmentId=z.string().uuid().parse(String(req.query.assignmentId||''));if(!await canAccessAssignment(req.user,assignmentId))return res.status(403).json({error:'You cannot download a template for this assignment.'});const [template,assignment]=await Promise.all([query("SELECT * FROM document_templates WHERE id=$1 AND context='Assignment' AND active=TRUE AND governance_status IN('Standard','Approved')",[req.params.id]),query(`SELECT a.*,lead.name lead_name FROM assignments a LEFT JOIN assignment_members am ON am.assignment_id=a.id AND am.member_role='Lead' LEFT JOIN users lead ON lead.id=am.user_id WHERE a.id=$1 LIMIT 1`,[assignmentId])]);const t=template.rows[0],a=assignment.rows[0];if(!t||!a)return res.status(404).json({error:'Approved template or assignment not found.'});const html=wordDocument(t.name,{Organization:'Public Service Commission','Report Type':t.template_key==='assignment-final-report'?'Final Assignment Report':t.name,'Assignment Reference':`ASG-${a.id.replace(/[^a-f0-9]/gi,'').slice(0,6).toUpperCase()}`,'Assignment Title':a.title,Division:a.division||'Not specified','Assignment Lead':a.lead_name||'Unassigned','Reporting Period':`${new Date(a.created_at).toISOString().slice(0,10)} to ${a.due_date||'Open'}`,Classification:'INTERNAL',Status:'DRAFT',Date:new Date().toISOString().slice(0,10),'Template Version':String(t.version)},t.sections.map(section=>({...section,content:''})));res.setHeader('Content-Type','application/msword; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="${t.template_key}-v${t.version}.doc"`);res.send(html)}catch(error){next(error)}})

/* APP2_GENERATED_DOCUMENT_CORE_API_V1 */
const resolvedAssignmentLead=async(assignmentId)=>(await query(`SELECT u.id,u.name,u.email,am.member_role
  FROM assignment_members am JOIN users u ON u.id=am.user_id
  WHERE am.assignment_id=$1::uuid
  ORDER BY CASE WHEN LOWER(TRIM(am.member_role))='lead' THEN 0 ELSE 1 END,am.assigned_at,am.user_id
  LIMIT 1`,[assignmentId])).rows[0]||null
const assignmentDocumentRole=async(user,document)=>{
  if(document?.context==='Assignment'&&document?.context_id&&await canManageAssignment(user,document.context_id))return 'Manager'
  if(document?.context!=='Assignment'||!document?.context_id||!user?.id)return null
  const membership=(await query(`SELECT member_role FROM assignment_members WHERE assignment_id=$1::uuid AND user_id=$2::uuid LIMIT 1`,[document.context_id,user.id])).rows[0]
  const memberRole=String(membership?.member_role||'').trim().toLowerCase()
  if(memberRole==='lead')return 'Lead'
  if(memberRole==='reviewer')return 'Reviewer'
  const namedLead=await resolvedAssignmentLead(document.context_id)
  const normalizeIdentity=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase()
  if(namedLead&&(namedLead.id===user.id||(normalizeIdentity(namedLead.name)===normalizeIdentity(user.name)&&await canAccessAssignment(user,document.context_id))))return 'Lead'
  const legacy=(await query(`SELECT a.created_by,
    (SELECT COUNT(*)::int FROM assignment_members am WHERE am.assignment_id=a.id AND am.member_role='Lead') lead_count,
    (SELECT am.user_id FROM assignment_members am WHERE am.assignment_id=a.id ORDER BY am.assigned_at,am.user_id LIMIT 1) fallback_lead_id
    FROM assignments a WHERE a.id=$1::uuid`,[document.context_id])).rows[0]
  if(legacy&&Number(legacy.lead_count||0)===0&&(legacy.fallback_lead_id===user.id||(!legacy.fallback_lead_id&&legacy.created_by===user.id)))return 'Lead'
  if(memberRole)return 'Contributor'
  return null
}
const loadGeneratedDocumentAccess=async(user,id)=>{
  const document=(await query(`SELECT d.*,t.name template_name,t.template_key,t.governance_status template_status,a.title assignment_title,
    creator.name created_by_name,reviewer.name reviewer_name,submitter.name submitted_by_name,approver.name approved_by_name
    FROM generated_documents d
    JOIN document_templates t ON t.id=d.template_id
    LEFT JOIN assignments a ON d.context='Assignment' AND a.id=d.context_id
    JOIN users creator ON creator.id=d.created_by
    LEFT JOIN users reviewer ON reviewer.id=d.reviewer_id
    LEFT JOIN users submitter ON submitter.id=d.submitted_by
    LEFT JOIN users approver ON approver.id=d.approved_by
    WHERE d.id=$1::uuid`,[id])).rows[0]
  if(!document)return {document:null,allowed:false}
  let allowed=user.role==='System Admin'||document.created_by===user.id||document.reviewer_id===user.id
  if(!allowed&&document.context==='Assignment')allowed=await canAccessAssignment(user,document.context_id)
  if(!allowed&&document.context==='Research')allowed=await canAccessResearch(user,document.context_id)
  return {document,allowed}
}
app.get('/api/generated-documents',authenticate,async(req,res,next)=>{try{
  const context=z.enum(['Assignment','Research']).parse(String(req.query.context||''))
  const contextId=z.string().uuid().parse(String(req.query.contextId||''))
  const manager=isManagementRole(req.user.role)
  const baseAccess=context==='Assignment'?await canAccessAssignment(req.user,contextId):await canAccessResearch(req.user,contextId)
  if(!baseAccess)return res.status(403).json({error:'This report workspace is outside your permitted management or contributor scope.'})
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
app.patch('/api/generated-documents/:id/sections/:sectionId',authenticate,validate(z.object({content:z.string().max(5000000),completion:z.number().int().min(0).max(100),sectionStatus:z.enum(['Not Started','In Progress','Ready','Needs Changes','Complete']).optional()})),async(req,res,next)=>{try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document)return res.status(404).json({error:'Report not found.'})
  if(!allowed)return res.status(403).json({error:'You cannot edit this report.'})
  if(['Submitted','Under Review','Approved','Final'].includes(document.status))return lockedWorkspaceResponse(res,{domain:'Assignment report',status:document.status,version:document.version,reviewer:document.reviewer_name||null})
  const role=document.context==='Assignment'?await assignmentDocumentRole(req.user,document):null
  const section=(await query('SELECT * FROM generated_document_sections WHERE id=$1::uuid AND document_id=$2::uuid',[req.params.sectionId,document.id])).rows[0]
  if(!section)return res.status(404).json({error:'Report section not found.'})
  if(document.context==='Assignment'&&!['Lead','Manager'].includes(role)&&document.created_by!==req.user.id&&section.owner_id!==req.user.id)return res.status(403).json({error:'Only the section owner, report author, Assignment Lead or manager can edit this section.'})
  let repositorySyncJobId=null;
  const updated=(await transaction(async client=>{
    const row=(await client.query(`UPDATE generated_document_sections SET content=$1::text,completion=$2::integer,section_status=COALESCE($3::varchar(30),section_status),updated_by=$4::uuid,updated_at=NOW() WHERE id=$5::uuid AND document_id=$6::uuid RETURNING *`,[req.validated.content,req.validated.completion,req.validated.sectionStatus||null,req.user.id,section.id,document.id])).rows[0]
    await client.query('UPDATE generated_documents SET last_updated_by=$1::uuid,updated_at=NOW() WHERE id=$2::uuid',[req.user.id,document.id])
    if(document.context==='Assignment'){
      repositorySyncJobId=await enqueueRepositorySyncJob(client,{jobKind:'assignment_report_draft',entityId:document.id,parentId:document.context_id,actor:req.user});
      row.repository_sync_job_id=repositorySyncJobId;
      row.repository_sync_status=repositorySyncJobId?'pending':'unavailable';
    }
    return row
  }))
  const repositorySync=document.context==='Assignment'?await runAndReadRepositorySync(repositorySyncJobId):{repository_sync_status:'not_requested'};
  res.json({...updated,...repositorySync})
}catch(error){next(error)}})
app.post('/api/generated-documents/:id/sections/:sectionId/lock',authenticate,async(req,res,next)=>{try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document)return res.status(404).json({error:'Report not found.'})
  if(!allowed)return res.status(403).json({error:'You cannot edit this report.'})
  if(['Submitted','Under Review','Approved','Final'].includes(document.status))return lockedWorkspaceResponse(res,{domain:'Assignment report',status:document.status,version:document.version,reviewer:document.reviewer_name||null})
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
  if(['Submitted','Under Review','Approved','Final'].includes(document.status))return lockedWorkspaceResponse(res,{domain:'Assignment report',status:document.status,version:document.version,reviewer:document.reviewer_name||null})
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
  if(['Submitted','Under Review','Approved','Final'].includes(document.status))return lockedWorkspaceResponse(res,{domain:'Assignment report',status:document.status,version:document.version,reviewer:document.reviewer_name||null})
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
  }catch(error){
    if(String(req.query.format||'').toLowerCase()==='pdf'&&!res.headersSent){
      const diagnosticId=crypto.randomUUID()
      console.error(`[${diagnosticId}] Assignment report PDF export failed:`,error)
      return res.status(503).json({error:`The APP2 API could not generate this PDF. Diagnostic reference: ${diagnosticId}.`,diagnosticId})
    }
    next(error)
  }
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
      SET status=CASE WHEN status IN('Changes Requested','Rejected') THEN 'Revised' ELSE 'Draft' END,last_updated_by=$1::uuid,updated_at=NOW()
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

app.post('/api/assignment-reports/:id/submit',authenticate,validate(z.object({reviewerId:z.string().uuid(),reviewDueDate:governedDate.default(null),comments:z.string().max(4000).default('')})),async(req,res,next)=>{try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document||document.context!=='Assignment')return res.status(404).json({error:'Assignment report not found.'})
  const role=await assignmentDocumentRole(req.user,document)
  if(!allowed||(!['Lead','Manager'].includes(role)&&document.created_by!==req.user.id))return res.status(403).json({error:'Only the Assignment Lead, report author or an authorised manager can submit the report.'})
  if(!['Draft','Revised','Changes Requested','Rejected'].includes(document.status))return res.status(409).json({error:'Only a draft or returned revision can be submitted for review.'})
  const reviewer=(await query('SELECT id,name,active FROM users WHERE id=$1::uuid',[req.validated.reviewerId])).rows[0]
  if(!reviewer||!reviewer.active)return res.status(409).json({error:'Choose an active reviewer.'})
  if(reviewer.id===req.user.id)return res.status(409).json({error:'The report author/submitting officer cannot review their own report.'})
  const assignmentLead=await resolvedAssignmentLead(document.context_id)
  if(!assignmentLead||!await isEligibleAssignmentTaskReviewer(document.context_id,assignmentLead.id,reviewer.id))return res.status(409).json({error:"Choose an assignment member, the Assignment Lead's immediate supervisor, or another active member of that supervisor's team."})
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
    const snapshotJson=JSON.stringify(snapshot)
    await client.query(`INSERT INTO generated_document_versions(document_id,version_number,sections,change_note,status,template_version,created_by,snapshot_sha256)
      VALUES($1::uuid,$2::integer,$3::jsonb,$4::text,'Submitted',$5::integer,$6::uuid,encode(digest(convert_to($3::jsonb::text,'UTF8'),'sha256'),'hex'))
      ON CONFLICT(document_id,version_number)DO NOTHING`,[document.id,document.version,snapshotJson,req.validated.comments,document.template_version,req.user.id])
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

app.post('/api/assignment-reports/:id/apply-template',authenticate,validate(z.object({templateId:z.string().uuid(),replaceExisting:z.boolean().default(false)})),async(req,res,next)=>{try{
  const {document,allowed}=await loadGeneratedDocumentAccess(req.user,req.params.id)
  if(!document||document.context!=='Assignment')return res.status(404).json({error:'Assignment report not found.'})
  const role=await assignmentDocumentRole(req.user,document)
  if(!allowed||!['Lead','Manager'].includes(role))return res.status(403).json({error:'Only the Assignment Lead or an authorised manager can change the report template.'})
  if(!['Draft','Revised','Changes Requested','Rejected'].includes(document.status))return res.status(409).json({error:'The report template can only be changed while the report is editable.'})
  const template=(await query("SELECT * FROM document_templates WHERE id=$1 AND context='Assignment' AND active=TRUE AND governance_status IN('Standard','Approved') AND template_key NOT LIKE 'task-%'",[req.validated.templateId])).rows[0]
  if(!template)return res.status(404).json({error:'Approved Assignment template not found.'})
  const current=(await query('SELECT section_key,content FROM generated_document_sections WHERE document_id=$1',[document.id])).rows
  const nextKeys=(template.sections||[]).map(section=>section.key)
  const removedAuthored=current.some(section=>!nextKeys.includes(section.section_key)&&String(section.content||'').replace(/<[^>]+>/g,' ').trim())
  if(removedAuthored&&!req.validated.replaceExisting)return res.status(409).json({error:'Changing this template removes drafted sections. Confirm replacement before rebuilding the outline.',code:'REPORT_TEMPLATE_REPLACE_CONFIRMATION_REQUIRED'})
  await transaction(async client=>{
    for(const [index,section] of (template.sections||[]).entries())await client.query(`INSERT INTO generated_document_sections(document_id,section_key,title,section_order,content,completion,section_status,updated_by)
      VALUES($1,$2,$3,$4,'',0,'Not Started',$5)
      ON CONFLICT(document_id,section_key)DO UPDATE SET title=EXCLUDED.title,section_order=EXCLUDED.section_order,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[document.id,section.key,section.title,index+1,req.user.id])
    await client.query('DELETE FROM generated_document_sections WHERE document_id=$1 AND NOT(section_key=ANY($2::text[]))',[document.id,nextKeys])
    await client.query('UPDATE generated_documents SET template_id=$1,template_version=$2,last_updated_by=$3,updated_at=NOW() WHERE id=$4',[template.id,template.version,req.user.id,document.id])
    await audit(client,req.user.id,'ASSIGNMENT_REPORT_TEMPLATE_APPLIED','generated_document',document.id,{templateId:template.id,templateName:template.name})
  })
  res.json({applied:true,template:{id:template.id,name:template.name}})
}catch(error){next(error)}})

app.post('/api/assignments/:id/reports/compile',authenticate,validate(z.object({templateId:z.string().uuid(),title:z.string().min(3).max(300),taskIds:z.array(z.string().uuid()).max(100).default([]),knowledgeIds:z.array(z.string().uuid()).max(100).default([]),reportType:z.enum(['Progress','Final']).default('Progress')})),async(req,res,next)=>{try{
  const role=await assignmentDocumentRole(req.user,{context:'Assignment',context_id:req.params.id})
  if(!['Lead','Manager'].includes(role)){
    const lead=await resolvedAssignmentLead(req.params.id)
    return res.status(403).json({error:lead?.name
      ?`APP2 is waiting for ${lead.name}, the Assignment Lead, to compile this assignment report. An authorised manager may also compile it.`
      :'No Assignment Lead is currently assigned. An authorised manager must appoint a lead or compile this assignment report.'})
  }
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

  if(document.reviewer_id!==req.user.id)return res.status(403).json({error:'Only the reviewer assigned to this Final Assignment Report can record the formal review decision.'})
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
    }else if(req.validated.decision==='Rejected'){
      row=(await client.query(`UPDATE generated_documents SET status='Rejected',version=version+1,approved_by=NULL,approved_at=NULL,updated_at=NOW()
        WHERE id=$1::uuid RETURNING *`,[document.id])).rows[0]
      await client.query("UPDATE assignment_report_imports SET status='Rejected' WHERE document_id=$1::uuid AND is_current=TRUE",[document.id])
    }else{
      row=(await client.query(`UPDATE generated_documents SET status='Under Review',updated_at=NOW() WHERE id=$1::uuid RETURNING *`,[document.id])).rows[0]
      await client.query("UPDATE assignment_report_imports SET status='Under Review' WHERE document_id=$1::uuid AND is_current=TRUE",[document.id])
    }
    await client.query(`INSERT INTO generated_document_reviews(document_id,version_number,reviewer_id,decision,comments)
      VALUES($1::uuid,$2::integer,$3::uuid,$4::varchar(40),$5::text)`,
      [document.id,document.version,req.user.id,req.validated.decision,req.validated.comments])
    await client.query('UPDATE generated_document_versions SET status=$1 WHERE document_id=$2 AND version_number=$3',[req.validated.decision,document.id,document.version])
    await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
      VALUES($1::uuid,$2::varchar(180),$3::text,'generated_document',$4::uuid)`,
      [document.created_by,
        req.validated.decision==='Changes Requested'
          ?'Assignment report changes requested'
          :req.validated.decision==='Rejected'
            ?'Assignment report rejected'
            :req.validated.decision==='Approved'
              ?'Assignment report approved'
              :'Assignment report review started',
        `“${document.title}” is now ${req.validated.decision}. ${req.validated.comments}`,document.id])
    if(document.submitted_by&&document.submitted_by!==document.created_by)await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
      VALUES($1::uuid,$2::varchar(180),$3::text,'generated_document',$4::uuid)`,
      [document.submitted_by,
        req.validated.decision==='Changes Requested'?'Assignment report changes requested':req.validated.decision==='Rejected'?'Assignment report rejected':req.validated.decision==='Approved'?'Assignment report approved':'Assignment report review started',
        `“${document.title}” is now ${req.validated.decision}. ${req.validated.comments}`,document.id])
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
  if(document.reviewer_id!==req.user.id)return res.status(403).json({error:`Only ${document.reviewer_name||'the assigned reviewer'} can generate the approved final report.`})
  if(document.status==='Final'){
    await query("UPDATE assignments SET status='Completed',updated_at=NOW() WHERE id=$1::uuid AND status<>'Completed'",[document.context_id])
    const existing=(await query(`SELECT k.id,k.title FROM repository_entity_links rel JOIN knowledge_items k ON k.id=rel.knowledge_id
      WHERE rel.entity_type='report' AND rel.entity_id=$1::uuid AND k.status='Published'
      ORDER BY k.created_at DESC LIMIT 1`,[document.id])).rows[0]
    return res.json({report:document,repository_document_id:existing?.id||null,repository_document_title:existing?.title||null})
  }
  if(document.status!=='Approved')return res.status(409).json({error:'Approve the Assignment Report before generating the final repository copy.'})
  if(!document.approved_by||!document.approved_at)return res.status(409).json({error:'The approved report has no complete approval record. Refresh the report or have the assigned reviewer record the approval again.'})
  const approvedVersion=(await query("SELECT * FROM generated_document_versions WHERE document_id=$1 AND version_number=$2 AND status='Approved'",[document.id,document.version])).rows[0]
  if(!approvedVersion)return res.status(409).json({error:'The immutable approved Assignment report snapshot is unavailable. The assigned reviewer must approve the submitted version before final generation.'})
  const approvedSnapshot=typeof approvedVersion.sections==='string'?JSON.parse(approvedVersion.sections):approvedVersion.sections
  const approvedSections=Array.isArray(approvedSnapshot)?approvedSnapshot:approvedSnapshot?.sections
  if(!Array.isArray(approvedSections)||!approvedSections.length)return res.status(409).json({error:'The approved Assignment report snapshot is invalid and cannot be finalised.'})
  const approvalActorId=document.approved_by
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
    const importedExtension=path.extname(currentImport.original_name).toLowerCase()||'.pdf'
    if(importedExtension==='.pdf'){
      mimeType='application/pdf'
      extension='.pdf'
      originalName=`${safeBase}-final-v${document.version}.pdf`
    }else{
      const converted=await mammoth.convertToHtml({buffer:finalBytes})
      finalBytes=await buildPscTaskFinalPdf(repositoryTitle,{
        Organization:'Public Service Commission','Report Type':'Final Assignment Report',
        'Report Reference':document.reference,'Assignment Reference':`ASG-${String(document.context_id).replace(/[^a-f0-9]/gi,'').slice(0,6).toUpperCase()}`,
        'Assignment Title':document.assignment_title,'Reviewed and Approved by':document.reviewer_name||'Assigned reviewer',
        Status:'FINAL — APPROVED',Version:String(document.version),'Approval Date':approvalTime
      },[{title:'Approved Imported Report',content:sanitizeTaskReportHtml(converted.value)}])
      mimeType='application/pdf'
      extension='.pdf'
      originalName=`${safeBase}-final-v${document.version}.pdf`
    }
  }else{
    const finalSections=[...approvedSections.filter(section=>section.section_key!=='review_approval').map(section=>({
      title:section.title||section.section_title||'Report section',
      content:sanitizeTaskReportHtml(section.content||'')
    }))]
    if(!hasAuthoredReferencesSection(finalSections)){
      const references=(await query('SELECT source_type,title,author,publication_year,publisher,url,identifier,citation_style FROM generated_document_references WHERE document_id=$1::uuid ORDER BY created_at,id',[document.id])).rows
      const referencesSection=buildReportReferencesSection(references)
      if(referencesSection)finalSections.push(referencesSection)
    }
    finalSections.push({title:'Review and Approval Record',content:`Status: FINAL — APPROVED
Reviewed and approved by: ${document.reviewer_name||'Assigned reviewer'}
Approval date: ${approvalTime}
Controlled report version: ${document.version}`})
    const assignmentReference=`ASG-${String(document.context_id).replace(/[^a-f0-9]/gi,'').slice(0,6).toUpperCase()}`
    const reportingStart=document.assignment_created_at?new Intl.DateTimeFormat('en-KE',{dateStyle:'medium',timeZone:'Africa/Nairobi'}).format(new Date(document.assignment_created_at)):'Not specified'
    const reportingEnd=document.assignment_due_date?new Intl.DateTimeFormat('en-KE',{dateStyle:'medium',timeZone:'Africa/Nairobi'}).format(new Date(document.assignment_due_date)):'Open'
    finalBytes=await buildPscTaskFinalPdf(repositoryTitle,{
      Organization:'Public Service Commission','Report Type':'Final Assignment Report','Assignment Reference':assignmentReference,
      'Assignment Title':document.assignment_title,Division:document.assignment_division||'Not specified',
      'Assignment Lead':document.lead_name||'Not specified','Team Members':document.team_names||document.lead_name||'Not specified',
      'Reporting Period':`${reportingStart} – ${reportingEnd}`,'Report Reference':document.reference,
      'Controlled Version':String(document.version),Classification:document.classification||'Official',
      'Prepared / Compiled by':document.created_by_name,'Reviewed and Approved by':document.reviewer_name||'Assigned reviewer',
      'Approval Date':approvalTime,Status:'FINAL — APPROVED'
    },finalSections)
    mimeType='application/pdf'
    extension='.pdf'
    originalName=`${safeBase}-final-v${document.version}.pdf`
  }

  const stored=await storeDocument(finalBytes,extension);storedFinalPath=stored.absolutePath
  const sha256=crypto.createHash('sha256').update(finalBytes).digest('hex')
  const result=await transaction(async client=>{
    const locked=(await client.query('SELECT status FROM generated_documents WHERE id=$1::uuid FOR UPDATE',[document.id])).rows[0]
    if(!locked||locked.status!=='Approved')throw Object.assign(new Error('This report is no longer awaiting final generation. Refresh the workspace.'),{statusCode:409})
    const immutable=(await client.query("SELECT id FROM generated_document_versions WHERE document_id=$1 AND version_number=$2 AND status='Approved' FOR UPDATE",[document.id,document.version])).rows[0]
    if(!immutable)throw Object.assign(new Error('The approved immutable Assignment report version is no longer available.'),{statusCode:409})
    const category=(await client.query("SELECT id FROM document_categories WHERE name='Assignment Reports' LIMIT 1")).rows[0]||null
    const description=`Final approved assignment report for “${document.assignment_title}”. Prepared by ${document.created_by_name} and approved by ${document.reviewer_name||'the assigned reviewer'}.`
    const tags=['final-report','assignment-report','approved']
    const promotedAssignmentReport=await promotePrivateDraftToPublished({
      client,
      actor:req.user,
      entityType:'report',
      entityId:document.id,
      draftDocumentType:'Assignment Report Draft',
      finalDocumentType:'Assignment Final Report',
      title:repositoryTitle,
      description,
      categoryName:'Assignment Reports',
      categoryId:category?.id||null,
      tags,
      author:document.lead_name||document.created_by_name,
      subject:document.assignment_title,
      sourceType:'Assignment',
      directorate:document.assignment_division||null,
      classification:'INTERNAL',
      approvedBy:approvalActorId,
      approvedAt:document.approved_at,
      originalName,
      stored,
      mimeType,
      bytes:finalBytes,
      sha256,
      notes:currentImport
        ?'Published from the exact reviewer-approved imported report'
        :'Automatically generated from the reviewer-approved Final Assignment Report',
      assignmentId:document.context_id,
      audit
    })
    const item=promotedAssignmentReport.item
    const version=promotedAssignmentReport.version
    const archivedAssignmentDrafts=await archivePrivateOperationalDrafts({
      client,
      actor:req.user,
      entityType:'assignment',
      entityId:document.context_id,
      documentTypes:['Assignment Draft'],
      finalRepositoryDocumentId:item.id,
      audit
    })
    for(const tag of tags){
      const tagRow=(await client.query(`INSERT INTO document_tags(name,normalized_name,created_by)
        VALUES($1::varchar(120),lower($1::varchar(120)),$2::uuid)
        ON CONFLICT(normalized_name)DO UPDATE SET name=EXCLUDED.name RETURNING id`,[tag,req.user.id])).rows[0]
      await client.query('INSERT INTO document_tag_links(knowledge_id,tag_id)VALUES($1::uuid,$2::uuid)ON CONFLICT DO NOTHING',[item.id,tagRow.id])
    }
    // Repository origin links are preserved by promotePrivateDraftToPublished.
    const final=(await client.query("UPDATE generated_documents SET status='Final',updated_at=NOW() WHERE id=$1::uuid RETURNING *",[document.id])).rows[0]
    await client.query("UPDATE generated_document_versions SET status='Final' WHERE id=$1",[immutable.id])
    if(currentImport)await client.query("UPDATE assignment_report_imports SET status='Final' WHERE id=$1::uuid",[currentImport.id])
    await client.query("UPDATE assignments SET status='Completed',updated_at=NOW() WHERE id=$1::uuid",[document.context_id])
    await client.query('INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1::uuid,$2::uuid,$3::varchar(80),$4::jsonb)',[document.context_id,req.user.id,'ASSIGNMENT_FINAL_REPORT_GENERATED',JSON.stringify({generatedDocumentId:document.id,repositoryDocumentId:item.id,repositoryVersionId:version.id,version:document.version,source:currentImport?'external-import':'app-editor',preservedDraftLineage:promotedAssignmentReport.preservedDraftLineage,archivedOperationalDrafts:archivedAssignmentDrafts.length})])
    await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1::uuid,'Final Assignment Report published',$2::text,'generated_document',$3::uuid)",[document.created_by,`The Final Assignment Report for “${document.assignment_title}” has been published to the Document Repository.`,document.id])
    await audit(client,req.user.id,'ASSIGNMENT_FINAL_REPORT_GENERATED','generated_document',document.id,{assignmentId:document.context_id,repositoryDocumentId:item.id,version:document.version,source:currentImport?'external-import':'app-editor',preservedDraftLineage:promotedAssignmentReport.preservedDraftLineage,archivedOperationalDrafts:archivedAssignmentDrafts.length})
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
    let storedDraftPath
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
app.patch('/api/research/:id/comments/:commentId/resolve',authenticate,validate(z.object({resolved:z.boolean()})),async(req,res,next)=>{try{if(!await canAccessResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot update this discussion item.'});const comment=(await query('SELECT * FROM research_comments WHERE id=$1 AND project_id=$2',[req.params.commentId,req.params.id])).rows[0];if(!comment)return res.status(404).json({error:'Discussion item not found.'});if(!isManagementRole(req.user.role)&&comment.author_id!==req.user.id)return res.status(403).json({error:'Only the author or a research manager can resolve this item.'});const updated=await transaction(async client=>{const row=(await client.query('UPDATE research_comments SET resolved=$1,resolved_by=CASE WHEN $1 THEN $2 ELSE NULL END,resolved_at=CASE WHEN $1 THEN NOW() ELSE NULL END WHERE id=$3 RETURNING *',[req.validated.resolved,req.user.id,comment.id])).rows[0];await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,req.validated.resolved?'DISCUSSION_RESOLVED':'DISCUSSION_REOPENED',JSON.stringify({commentId:comment.id,category:comment.category})]);return row});res.json(updated)}catch(error){next(error)}})
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

    const existingReportSectionCount=Number((await query(
      'SELECT COUNT(*)::int count FROM research_report_sections WHERE project_id=$1',
      [req.params.id]
    )).rows[0]?.count||0)

    if(existingReportSectionCount===0){
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



app.post(
  '/api/research/:id/report/apply-template',
  authenticate,
  validate(z.object({
    templateKey:z.string().min(1),
    replaceExisting:z.boolean().default(false)
  })),
  async(req,res,next)=>{
    try{
      const project=(await query(
        'SELECT id,title,lead_id FROM research_projects WHERE id=$1',
        [req.params.id]
      )).rows[0]
      if(!project)return res.status(404).json({error:'Research project was not found.'})

      if(!await canAccessResearch(req.user,req.params.id)){
        return res.status(403).json({error:'You cannot access this research report.'})
      }

      const isManager=isOrganisationScopeRole(req.user.role)||(isTeamScopeRole(req.user.role)&&await canManageResearch(req.user,req.params.id))
      const isLead=project.lead_id===req.user.id
      if(!isManager&&!isLead){
        return res.status(403).json({error:'Only the Research Lead or an authorised research manager can apply a report template.'})
      }

      const latest=(await query(
        "SELECT status FROM research_report_versions WHERE project_id=$1 ORDER BY version_number DESC LIMIT 1",
        [req.params.id]
      )).rows[0]
      if(['Submitted','Approved'].includes(latest?.status)){
        return res.status(409).json({error:'The current report version is locked. Apply a template only while the report is editable.'})
      }

      const template=researchTemplateLibraryV11.find(
        item=>item.template_key===req.validated.templateKey
      )
      if(!template)return res.status(404).json({error:'Research report template was not found.'})

      const existing=(await query(
        `SELECT id,section_key,title,content,status,owner_id,reviewer_id
         FROM research_report_sections
         WHERE project_id=$1
         ORDER BY section_order`,
        [req.params.id]
      )).rows

      const hasAuthoredContent=existing.some(
        section=>Boolean(String(section.content||'').trim())
      )
      if(hasAuthoredContent&&!req.validated.replaceExisting){
        return res.status(409).json({
          error:'This report already contains drafted content. Confirm template replacement before changing the report outline.',
          code:'REPORT_TEMPLATE_REPLACE_CONFIRMATION_REQUIRED'
        })
      }

      const sections=Array.isArray(template.sections)?template.sections:[]
      if(!sections.length){
        return res.status(400).json({error:'The selected template has no report sections.'})
      }

      const result=await transaction(async client=>{
        const lockedProject=(await client.query(
          'SELECT id,title,lead_id FROM research_projects WHERE id=$1 FOR UPDATE',
          [req.params.id]
        )).rows[0]
        if(!lockedProject)throw Object.assign(new Error('Research project was not found.'),{statusCode:404})

        const currentSections=(await client.query(
          `SELECT id,section_key,title,content,status,owner_id,reviewer_id
           FROM research_report_sections
           WHERE project_id=$1
           ORDER BY section_order`,
          [req.params.id]
        )).rows

        const existingByKey=new Map(
          currentSections.map(section=>[section.section_key,section])
        )
        const keys=sections.map(section=>section.key)

        for(let index=0;index<sections.length;index+=1){
          const section=sections[index]
          const current=existingByKey.get(section.key)
          await client.query(
            `INSERT INTO research_report_sections(
               project_id,section_key,title,content,section_order,status,
               owner_id,reviewer_id,updated_by,updated_at
             )
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
             ON CONFLICT(project_id,section_key) DO UPDATE SET
               title=EXCLUDED.title,
               section_order=EXCLUDED.section_order,
               content=CASE
                 WHEN research_report_sections.content<>'' THEN research_report_sections.content
                 ELSE EXCLUDED.content
               END,
               status=CASE
                 WHEN research_report_sections.content<>'' THEN research_report_sections.status
                 ELSE EXCLUDED.status
               END,
               updated_by=EXCLUDED.updated_by,
               updated_at=NOW()`,
            [
              lockedProject.id,
              section.key,
              section.title,
              current?.content||'',
              index+1,
              current?.status||'Not Started',
              current?.owner_id||lockedProject.lead_id,
              current?.reviewer_id||null,
              req.user.id
            ]
          )
        }

        await client.query(
          `DELETE FROM research_report_sections
           WHERE project_id=$1
             AND NOT(section_key=ANY($2::text[]))`,
          [lockedProject.id,keys]
        )

        await client.query(
          'INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',
          [
            lockedProject.id,
            req.user.id,
            'REPORT_TEMPLATE_APPLIED',
            JSON.stringify({
              templateKey:template.template_key,
              templateName:template.name,
              sectionCount:sections.length,
              replacedExisting:hasAuthoredContent
            })
          ]
        )

        await audit(
          client,
          req.user.id,
          'RESEARCH_REPORT_TEMPLATE_APPLIED',
          'research_project',
          lockedProject.id,
          {
            templateKey:template.template_key,
            templateName:template.name,
            sectionCount:sections.length,
            replacedExisting:hasAuthoredContent
          }
        )

        const refreshed=await client.query(
          `SELECT
             rrs.id,rrs.section_key,rrs.title,rrs.content,rrs.section_order,
             rrs.status,rrs.owner_id,rrs.reviewer_id,rrs.updated_at,
             u.name updated_by_name,
             owner.name owner_name,
             reviewer.name reviewer_name
           FROM research_report_sections rrs
           LEFT JOIN users u ON u.id=rrs.updated_by
           LEFT JOIN users owner ON owner.id=rrs.owner_id
           LEFT JOIN users reviewer ON reviewer.id=rrs.reviewer_id
           WHERE rrs.project_id=$1
           ORDER BY rrs.section_order`,
          [lockedProject.id]
        )

        return {
          template:{
            name:template.name,
            template_key:template.template_key
          },
          sections:refreshed.rows
        }
      })

      res.json(result)
    }catch(error){
      next(error)
    }
  }
)


app.get(
  '/api/research/:id/report/:sectionId/access',
  authenticate,
  async(req,res,next)=>{
    try{
      const canAccess=await canAccessResearch(req.user,req.params.id)
      if(!canAccess){
        return res.status(403).json({
          error:'You cannot access this research report section.'
        })
      }

      const current=(await query(
        `SELECT rrs.id,rrs.owner_id,rrs.reviewer_id,
                owner.name owner_name,reviewer.name reviewer_name
         FROM research_report_sections rrs
         LEFT JOIN users owner ON owner.id=rrs.owner_id
         LEFT JOIN users reviewer ON reviewer.id=rrs.reviewer_id
         WHERE rrs.id=$1 AND rrs.project_id=$2`,
        [req.params.sectionId,req.params.id]
      )).rows[0]
      if(!current){
        return res.status(404).json({error:'Report section was not found.'})
      }

      const project=(await query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
      const latestSubmission=(await query(
        "SELECT status FROM research_report_versions WHERE project_id=$1 AND status IN('Submitted','Approved','Rejected') ORDER BY version_number DESC LIMIT 1",
        [req.params.id]
      )).rows[0]
      const isAssignedReviewer=(await query(
        'SELECT 1 FROM research_reviewers WHERE project_id=$1 AND reviewer_id=$2 AND active=TRUE',
        [req.params.id,req.user.id]
      )).rowCount>0
      const isImmediateManager=Boolean(project&&await isImmediateSupervisorOf(req.user.id,project.lead_id))
      const canManageSection=isOrganisationScopeRole(req.user.role)||(isTeamScopeRole(req.user.role)&&await canManageResearch(req.user,req.params.id))||isImmediateManager||project?.lead_id===req.user.id
      const locked=Boolean(latestSubmission&&['Submitted','Approved'].includes(latestSubmission.status))
      const canEdit=!locked&&(canManageSection||(!isAssignedReviewer&&(!current.owner_id||current.owner_id===req.user.id)))

      let reason=''
      if(locked){
        reason=latestSubmission.status==='Submitted'
          ? 'This report is under review. Editing resumes only after the reviewer returns it through the governed revision workflow.'
          : 'The approved report is locked.'
      }else if(isAssignedReviewer&&!canManageSection){
        reason='You are assigned as a reviewer. Review the submitted report through the review workflow; reviewers cannot rewrite the author section.'
      }else if(current.owner_id&&current.owner_id!==req.user.id&&!canManageSection){
        reason=`This section is assigned to ${current.owner_name||'another team member'}. Ask the research lead or manager to reassign it.`
      }else if(!canEdit){
        reason='You do not have authoring permission for this section. Contact the research lead or manager.'
      }

      res.json({
        can_edit:canEdit,
        owner_id:current.owner_id,
        owner_name:current.owner_name,
        reviewer_id:current.reviewer_id,
        reviewer_name:current.reviewer_name,
        locked,
        reason
      })
    }catch(error){
      next(error)
    }
  }
)

app.patch(
  '/api/research/:id/report/:sectionId',
  authenticate,
  validate(
    z.object({
      title:z.string().min(1).max(250).optional(),
      content:z.string().max(5000000).optional(),
      status:z.enum([
        'Not Started',
        'Draft',
        'In Progress',
        'Ready for Review',
        'Approved'
      ]).optional(),
      ownerId:z.string().uuid().nullable().optional(),
      reviewerId:z.string().uuid().nullable().optional(),
      persistDraft:z.boolean().default(false)
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
      if(latestSubmission?.status==='Approved'&&(req.validated.content!==undefined||req.validated.title!==undefined||req.validated.status!==undefined))return res.status(409).json({error:'The approved research report is locked.'})
      const project=(await query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
      const isAssignedReviewer=(await query('SELECT 1 FROM research_reviewers WHERE project_id=$1 AND reviewer_id=$2 AND active=TRUE',[req.params.id,req.user.id])).rowCount>0
      const isImmediateManager=Boolean(project&&await isImmediateSupervisorOf(req.user.id,project.lead_id))
      const canManageSection=isOrganisationScopeRole(req.user.role)||(isTeamScopeRole(req.user.role)&&await canManageResearch(req.user,req.params.id))||isImmediateManager||project?.lead_id===req.user.id
      if(req.validated.status==='Approved'&&!isAssignedReviewer)return res.status(403).json({error:'Only an assigned research reviewer can approve a report section.'})
      if(isAssignedReviewer&&!canManageSection&&(req.validated.title!==undefined||req.validated.content!==undefined||req.validated.ownerId!==undefined||req.validated.reviewerId!==undefined))return res.status(403).json({error:'Reviewers assess submitted research content but cannot rewrite or reassign the author’s report section.'})
      if(isAssignedReviewer&&!canManageSection&&req.validated.status&&req.validated.status!=='Approved')return res.status(403).json({error:'Assigned reviewers may approve submitted report sections but cannot change authoring workflow states.'})
      if(current.owner_id&&current.owner_id!==req.user.id&&!canManageSection&&!isAssignedReviewer)return res.status(403).json({error:'This report section is assigned to another team member.'})
      if(req.validated.ownerId!==undefined&&!canManageSection)return res.status(403).json({error:'Only the research lead or manager can assign report sections.'})
      if(req.validated.ownerId&&(await query('SELECT 1 FROM research_projects p WHERE p.id=$1 AND(p.lead_id=$2 OR EXISTS(SELECT 1 FROM research_collaborators WHERE project_id=p.id AND user_id=$2))',[req.params.id,req.validated.ownerId])).rowCount===0)return res.status(400).json({error:'Assign this section to a member of the research team.'})
      if(req.validated.reviewerId!==undefined&&!canManageSection)return res.status(403).json({error:'Only the research lead or manager can assign a section reviewer.'})
      if(req.validated.reviewerId&&!(await immediateOversightReviewers(project.lead_id)).some(candidate=>candidate.id===req.validated.reviewerId))return res.status(400).json({error:"Choose the Research Lead's immediate supervisor or another active member of that supervisor's team."})

      const nextStatus=req.validated.status??current.status
      if(req.validated.persistDraft&&!['Draft','In Progress'].includes(nextStatus)){
        return res.status(400).json({error:'Repository draft versions can be created only while the report remains editable.'})
      }

      let repositorySyncJobId=null;
      const result=await transaction(async client=>{
        const updated=(await client.query(
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
        )).rows[0]
        if(req.validated.persistDraft){
          repositorySyncJobId=await enqueueRepositorySyncJob(client,{jobKind:'research_report_draft',entityId:project.id,parentId:project.id,actor:req.user});
        }
        return updated
      })
      const repositorySync=req.validated.persistDraft
        ?await runAndReadRepositorySync(repositorySyncJobId)
        :{repository_sync_status:'not_requested'};
      const updated={...result,...repositorySync};

      const postSaveWarnings=[];
      if(updated.status==='Ready for Review'&&updated.reviewer_id&&(current.status!=='Ready for Review'||current.reviewer_id!==updated.reviewer_id)){
        try{
          const owner=(await query('SELECT name FROM users WHERE id=$1',[updated.owner_id||req.user.id])).rows[0]
          await query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Research section requires approval',$2,'research_report_section',$3)",[updated.reviewer_id,`Action required: review and approve “${updated.title}” in research project “${project.title}”. Submitted by ${owner?.name||req.user.name}. Open the Research workspace, select Report, then choose this section.`,project.id])
        }catch(notificationError){postSaveWarnings.push('The section was saved, but the reviewer notification could not be recorded.');console.warn('RESEARCH_SECTION_NOTIFICATION_WRITE_FAILED',{sectionId:current.id,error:notificationError instanceof Error?notificationError.message:String(notificationError)})}
      }
      try{await query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,req.validated.persistDraft?(repositorySync.repository_sync_status==='done'?'REPORT_DRAFT_SAVED_TO_REPOSITORY':'REPORT_DRAFT_SYNC_QUEUED'):'REPORT_SECTION_UPDATED',JSON.stringify({sectionId:current.id,status:updated.status,ownerId:updated.owner_id,reviewerId:updated.reviewer_id,notificationSent:updated.status==='Ready for Review'&&Boolean(updated.reviewer_id),repositoryDocumentId:repositorySync.repository_document_id||null,repositoryVersion:repositorySync.repository_version||null,repositorySyncStatus:repositorySync.repository_sync_status||'not_requested'})])}catch(activityError){postSaveWarnings.push('The section was saved, but activity history could not be refreshed.');console.warn('RESEARCH_SECTION_ACTIVITY_WRITE_FAILED',{sectionId:current.id,error:activityError instanceof Error?activityError.message:String(activityError)})}
      if(postSaveWarnings.length)updated.persistence_warning=postSaveWarnings.join(' ');
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

app.get('/api/research/:id/report/export.pdf',authenticate,async(req,res,next)=>{try{
  if(!await canAccessResearch(req.user,req.params.id))return res.status(403).json({error:'You cannot download this research report.'})
  const project=(await query(`SELECT p.*,lead.name lead_name FROM research_projects p LEFT JOIN users lead ON lead.id=p.lead_id WHERE p.id=$1`,[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  const requestedVersionId=String(req.query.versionId||'').trim()
  let version=null
  if(requestedVersionId){
    if(!z.string().uuid().safeParse(requestedVersionId).success)return res.status(400).json({error:'A valid report version is required.'})
    version=(await query(`SELECT v.*,reviewer.name reviewer_name,submitter.name submitted_by_name
      FROM research_report_versions v LEFT JOIN users reviewer ON reviewer.id=v.reviewer_id
      LEFT JOIN users submitter ON submitter.id=v.submitted_by WHERE v.id=$1 AND v.project_id=$2`,[requestedVersionId,project.id])).rows[0]
    if(!version)return res.status(404).json({error:'Research report version not found.'})
  }else{
    version=(await query(`SELECT v.*,reviewer.name reviewer_name,submitter.name submitted_by_name
      FROM research_report_versions v LEFT JOIN users reviewer ON reviewer.id=v.reviewer_id
      LEFT JOIN users submitter ON submitter.id=v.submitted_by WHERE v.project_id=$1
      ORDER BY v.version_number DESC LIMIT 1`,[project.id])).rows[0]||null
    if(!version||!['Submitted','Approved','Rejected'].includes(version.status))version=null
  }
  let sections=[]
  let team=[]
  if(version){
    let snapshot=version.report_snapshot
    if(typeof snapshot==='string'){try{snapshot=JSON.parse(snapshot)}catch{snapshot={}}}
    const snapshotRoot=snapshot&&typeof snapshot==='object'&&!Array.isArray(snapshot)?snapshot:{}
    const snapshotList=value=>{
      let parsed=value
      if(typeof parsed==='string'){try{parsed=JSON.parse(parsed)}catch{return []}}
      if(Array.isArray(parsed))return parsed
      if(parsed&&typeof parsed==='object'){
        if(Array.isArray(parsed.items))return parsed.items
        if(Array.isArray(parsed.rows))return parsed.rows
        return Object.values(parsed)
      }
      return []
    }
    sections=snapshotList(snapshotRoot.sections)
    team=snapshotList(snapshotRoot.team)
    if(!sections.length&&!requestedVersionId)version=null
  }
  if(!version){
    sections=(await query('SELECT id,title,content,section_order FROM research_report_sections WHERE project_id=$1 ORDER BY section_order',[project.id])).rows
  }
  if(!team.length){
    team=(await query(`SELECT u.id,u.name,'Lead Researcher' role,0 role_order FROM users u WHERE u.id=$1
      UNION ALL SELECT u.id,u.name,rc.role,1 FROM research_collaborators rc JOIN users u ON u.id=rc.user_id WHERE rc.project_id=$2
      UNION ALL SELECT u.id,u.name,COALESCE(rr.review_role,'Formal Reviewer'),2 FROM research_reviewers rr JOIN users u ON u.id=rr.reviewer_id WHERE rr.project_id=$2 AND rr.active=TRUE
      ORDER BY role_order,name`,[project.lead_id,project.id])).rows
  }
  sections=sections.map((section,index)=>({
    title:String(typeof section==='string'?`Section ${index+1}`:section?.title||section?.name||`Section ${index+1}`),
    content:sanitizeTaskReportHtml(String(typeof section==='string'?section:section?.content||section?.html||section?.body||'')),
  })).filter(section=>section.content.trim())
  if(!sections.length)return res.status(409).json({error:'There is no saved research report content to download yet.'})
  const teamRows=team.map(member=>typeof member==='string'?{name:member,role:'Research Team'}:member).filter(member=>member&&String(member.name||member.full_name||member.user_name||'').trim()).map(member=>`<tr><td>${escapeHtml(member.name||member.full_name||member.user_name)}</td><td>${escapeHtml(member.role||member.review_role||'Research Team')}</td></tr>`).join('')
  if(teamRows){
    const teamSection={title:'Research Team and Roles',content:`<table><thead><tr><th>Team member</th><th>Role</th></tr></thead><tbody>${teamRows}</tbody></table>`}
    const titlePageIndex=sections.findIndex(section=>/^title page$/i.test(section.title))
    sections.splice(titlePageIndex>=0?titlePageIndex+1:0,0,teamSection)
  }
  const versionLabel=version?`v${version.version_number}`:'Draft'
  const reportStatus=version?.status||'Draft'
  const reportTitle=String(version?.title||`${project.title} — Research Report`)
  const reference=`RES-${String(project.id).replace(/[^a-f0-9]/gi,'').slice(0,8).toUpperCase()}`
  const pdf=await buildPscTaskFinalPdf(reportTitle,{
    Reference:reference,
    'Research project':project.title,
    'Prepared by':version?.submitted_by_name||project.lead_name||'Not specified',
    Reviewer:version?.reviewer_name||'Not assigned',
    Version:versionLabel,
    Status:reportStatus,
    Classification:'Official',
    Date:version?.submitted_at?new Date(version.submitted_at).toISOString().slice(0,10):new Date().toISOString().slice(0,10),
  },sections)
  const safeName=String(project.title||'research-report').normalize('NFKD').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,90)||'research-report'
  await transaction(client=>audit(client,req.user.id,'RESEARCH_REPORT_DOWNLOADED','research',project.id,{versionId:version?.id||null,versionNumber:version?.version_number||null,status:reportStatus,format:'pdf'}))
  res.setHeader('Content-Type','application/pdf')
  res.setHeader('Content-Disposition',`attachment; filename="${safeName}-${versionLabel.toLowerCase()}.pdf"`)
  res.send(pdf)
}catch(error){next(error)}})

app.post('/api/research/:id/report/submit',authenticate,validate(z.object({title:z.string().min(3).max(300),reviewerId:z.string().uuid()})),async(req,res,next)=>{try{
  const project=(await query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})
  const isReportBuilder=(await query(
    "SELECT 1 FROM research_collaborators WHERE project_id=$1 AND user_id=$2 AND COALESCE(role,'Researcher')<>'Reviewer'",
    [project.id,req.user.id]
  )).rowCount>0
  const canSubmit=isOrganisationScopeRole(req.user.role)||(isTeamScopeRole(req.user.role)&&await canManageResearch(req.user,req.params.id))||project.lead_id===req.user.id||isReportBuilder
  if(!canSubmit)return res.status(403).json({error:'Only the Research Lead, an active report builder, or an authorised Research Manager can submit the report for review.'})
  const reviewer=(await query("SELECT u.id,u.name FROM users u JOIN research_reviewers rr ON rr.reviewer_id=u.id AND rr.project_id=$2 AND rr.active=TRUE WHERE u.id=$1 AND u.active=TRUE",[req.validated.reviewerId,project.id])).rows[0]
  if(!reviewer)return res.status(400).json({error:'Choose a formal reviewer assigned to this research project.'})
  if(reviewer.id===req.user.id)return res.status(400).json({error:'The person submitting the research report cannot review the same submission.'})
  const sections=(await query('SELECT id,section_key,title,content,section_order,status,owner_id,reviewer_id FROM research_report_sections WHERE project_id=$1 ORDER BY section_order',[project.id])).rows
  const team=(await query(`SELECT u.id,u.name,'Lead Researcher' role,0 role_order FROM users u WHERE u.id=$1
    UNION ALL SELECT u.id,u.name,rc.role,1 FROM research_collaborators rc JOIN users u ON u.id=rc.user_id WHERE rc.project_id=$2
    UNION ALL SELECT u.id,u.name,COALESCE(rr.review_role,'Formal Reviewer'),2 FROM research_reviewers rr JOIN users u ON u.id=rr.reviewer_id WHERE rr.project_id=$2 AND rr.active=TRUE
    ORDER BY role_order,name`,[project.lead_id,project.id])).rows
  if(!sections.some(section=>String(section.content||'').trim()))return res.status(409).json({error:'Write and save report content before submission.'})
  const active=(await query("SELECT id,status FROM research_report_versions WHERE project_id=$1 AND status='Submitted' ORDER BY version_number DESC LIMIT 1",[project.id])).rows[0]
  if(active)return res.status(409).json({error:'A research report version is already awaiting reviewer decision.'})
  const row=await transaction(async client=>{
    await client.query('SELECT id FROM research_projects WHERE id=$1 FOR UPDATE',[project.id])
    const controlledEvidence=(await client.query(`SELECT EXISTS(SELECT 1 FROM research_sources WHERE project_id=$1)
      OR EXISTS(SELECT 1 FROM research_knowledge_links rkl JOIN knowledge_items k ON k.id=rkl.knowledge_item_id
        WHERE rkl.project_id=$1 AND k.status='Published' AND COALESCE(k.is_archived,FALSE)=FALSE) has_evidence`,[project.id])).rows[0]?.has_evidence
    if(!controlledEvidence)throw Object.assign(new Error('Before reviewer submission, add a controlled research source or link a published Repository document in Resources. Your report remains an editable draft.'),{statusCode:409})
    const latestVersion=(await client.query('SELECT id,status,version_number FROM research_report_versions WHERE project_id=$1 ORDER BY version_number DESC LIMIT 1 FOR UPDATE',[project.id])).rows[0]
    if(latestVersion?.status==='Submitted')throw Object.assign(new Error('A research report version is already awaiting reviewer decision.'),{statusCode:409})
    if(latestVersion?.status==='Approved')throw Object.assign(new Error('The latest research report version is approved and must proceed to final publication.'),{statusCode:409})
    const latest=(await client.query('SELECT COALESCE(MAX(version_number),0)::int n FROM research_report_versions WHERE project_id=$1',[project.id])).rows[0]
    const previous=(await client.query("SELECT id FROM research_report_versions WHERE project_id=$1 AND status IN('Changes Requested','Rejected') ORDER BY version_number DESC LIMIT 1",[project.id])).rows[0]
    const sources=(await client.query('SELECT source_type,title,author,publisher,publication_date,url,identifier FROM research_sources WHERE project_id=$1 ORDER BY created_at,title',[project.id])).rows
    const snapshotJson=JSON.stringify({team,sections,sources})
    const created=(await client.query(`INSERT INTO research_report_versions(project_id,version_number,title,report_snapshot,created_by,status,reviewer_id,submitted_by,submitted_at,parent_version_id,snapshot_sha256)
      VALUES($1,$2,$3,$4::jsonb,$5,'Submitted',$6,$5,NOW(),$7,encode(digest(convert_to($4::jsonb::text,'UTF8'),'sha256'),'hex')) RETURNING *`,[project.id,latest.n+1,req.validated.title,snapshotJson,req.user.id,reviewer.id,previous?.id||null])).rows[0]
    await client.query("UPDATE research_projects SET status='Under Review',updated_at=NOW() WHERE id=$1",[project.id])
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

  if(version.submitted_by===req.user.id)return res.status(403).json({error:'The report creator cannot approve or reject their own submission. The appointed reviewer must record the decision.'})
  if(version.reviewer_id!==req.user.id)return res.status(403).json({error:'Only the reviewer appointed to this submitted research report can record the review decision.'})
  const project=(await query('SELECT id,title,lead_id FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  const row=await transaction(async client=>{
    const updated=(await client.query('UPDATE research_report_versions SET status=$1,reviewed_by=$2,reviewed_at=NOW(),review_comments=$3 WHERE id=$4 RETURNING *',[req.validated.decision,req.user.id,req.validated.comments,version.id])).rows[0]
    if(req.validated.decision==='Approved'){
      await client.query("UPDATE research_report_sections SET status='Approved',updated_at=NOW() WHERE project_id=$1 AND content<>''",[project.id])
      await client.query("UPDATE research_projects SET status='Under Review',updated_at=NOW() WHERE id=$1",[project.id])
    }else{
      await client.query("UPDATE research_report_sections SET status=CASE WHEN content='' THEN 'Draft' ELSE 'In Progress' END,updated_at=NOW() WHERE project_id=$1",[project.id])
      await client.query("UPDATE research_projects SET status='Active',updated_at=NOW() WHERE id=$1",[project.id])
    }
    const reportDecisionTitle=req.validated.decision==='Approved'?'Research report approved':req.validated.decision==='Changes Requested'?'Research report changes requested':'Research report rejected'
    const reportDecisionBody=req.validated.decision==='Approved'?`Version ${version.version_number} of “${project.title}” was approved.`:`Version ${version.version_number} of “${project.title}”: ${req.validated.comments}`
    const reportRecipients=[...new Set([version.submitted_by,project?.lead_id].filter(Boolean))]
    for(const recipientId of reportRecipients)await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,$2,$3,'research',$4)",[recipientId,reportDecisionTitle,reportDecisionBody,project.id])
    await client.query('INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',[project.id,req.user.id,req.validated.decision==='Approved'?'REPORT_APPROVED':req.validated.decision==='Changes Requested'?'REPORT_CHANGES_REQUESTED':'REPORT_REJECTED',JSON.stringify({versionId:version.id,versionNumber:version.version_number,comments:req.validated.comments})])
    await audit(client,req.user.id,'RESEARCH_REPORT_REVIEW_DECISION','research_report_version',version.id,{projectId:project.id,decision:req.validated.decision,comments:req.validated.comments})
    return updated
  })
  res.json(row)
}catch(error){next(error)}})

app.post('/api/research/:id/report/generate',authenticate,validate(z.object({
  title:z.string().min(3).max(300),
  classification:z.enum(['Official','Internal','Confidential','Public']).default('Official'),
  templateId:z.string().uuid().nullable().default(null),
  mode:z.enum(['Draft','Final']).default('Final'),
  reviewerId:z.string().uuid().nullable().default(null),
  knowledgeIds:z.array(z.string().uuid()).max(100).default([])
})),async(req,res,next)=>{let storedFinalPath;try{
  const project=(await query('SELECT * FROM research_projects WHERE id=$1',[req.params.id])).rows[0]
  if(!project)return res.status(404).json({error:'Research project not found.'})

  const draftMode=req.validated.mode==='Draft'
  const isManager=isOrganisationScopeRole(req.user.role)||(isTeamScopeRole(req.user.role)&&await canManageResearch(req.user,req.params.id))

  if(!draftMode){
    const existingFinal=(await query(`SELECT
        gd.id generated_document_id,
        gd.reference,
        gd.title,
        k.id repository_document_id,
        k.title repository_document_title
      FROM knowledge_items k
      JOIN repository_entity_links research_link
        ON research_link.knowledge_id=k.id
       AND research_link.entity_type='research'
       AND research_link.entity_id=$1
      LEFT JOIN repository_entity_links report_link
        ON report_link.knowledge_id=k.id
       AND report_link.entity_type='report'
      LEFT JOIN generated_documents gd
        ON gd.id=report_link.entity_id
      WHERE k.document_type='Research Final Report'
        AND k.status='Published'
        AND COALESCE(k.is_archived,FALSE)=FALSE
      ORDER BY k.created_at DESC
      LIMIT 1`,[project.id])).rows[0]||null

    if(existingFinal&&project.status==='Completed'){
      return res.json({
        id:existingFinal.generated_document_id,
        reference:existingFinal.reference||'FINAL',
        title:existingFinal.title||existingFinal.repository_document_title,
        repository_document_id:existingFinal.repository_document_id,
        repository_document_title:existingFinal.repository_document_title,
        project_status:'Completed',
        already_completed:true
      })
    }
  }

  if(draftMode){
    const canDraft=isManager||project.lead_id===req.user.id
    if(!canDraft)return res.status(403).json({error:'Only the Research Lead or a research manager can generate a draft report.'})
  }

  const sections=(await query(
    'SELECT * FROM research_report_sections WHERE project_id=$1 ORDER BY section_order',
    [project.id]
  )).rows
  if(!sections.length)return res.status(409).json({error:'The research report has no sections to generate.'})
  if(draftMode&&!sections.some(section=>String(section.content||'').trim())){
    return res.status(409).json({error:'Write and save at least one report section before generating a draft.'})
  }
  const approvedVersion=!draftMode?(await query(
    "SELECT * FROM research_report_versions WHERE project_id=$1 AND status='Approved' AND version_number=(SELECT MAX(version_number) FROM research_report_versions WHERE project_id=$1) LIMIT 1",
    [project.id]
  )).rows[0]:null

  if(!draftMode&&!approvedVersion){
    return res.status(409).json({error:'The complete research report must be submitted and approved as a locked version before final generation.'})
  }
  let approvedSnapshot=null
  if(!draftMode){
    try{approvedSnapshot=typeof approvedVersion.report_snapshot==='string'?JSON.parse(approvedVersion.report_snapshot):approvedVersion.report_snapshot}catch{approvedSnapshot=null}
    if(!approvedSnapshot||!Array.isArray(approvedSnapshot.sections)||!approvedSnapshot.sections.length){
      return res.status(409).json({error:'The approved report snapshot is unavailable or invalid. Re-open the approved version before final generation.'})
    }
  }
  if(!draftMode&&approvedVersion.submitted_by===req.user.id){
    return res.status(403).json({error:'The report creator may submit the report but cannot generate its final copy. The approver who recorded the approval must generate it.'})
  }
  if(
    !draftMode &&
    approvedVersion.reviewed_by!==req.user.id
  ){
    return res.status(403).json({
      error:'Only the approver who recorded the approval decision can generate this final research report.'
    })
  }
  if(!draftMode&&!await researchHasControlledEvidence(project.id)){
    return res.status(409).json({error:'Add at least one controlled research source or link a published Repository document before generating the final report.'})
  }

  if(draftMode&&!req.validated.reviewerId){
    return res.status(400).json({error:'Choose an authorised reviewer before sending the draft report.'})
  }
  if(req.validated.reviewerId){
    const reviewer=(await query(
      "SELECT id,name FROM users WHERE id=$1 AND active=TRUE",
      [req.validated.reviewerId]
    )).rows[0]
    if(!reviewer)return res.status(400).json({error:'Choose an active user within the permitted management scope.'})
    if(draftMode&&(await query(
      'SELECT 1 FROM research_reviewers WHERE project_id=$1 AND reviewer_id=$2 AND active=TRUE',
      [project.id,req.validated.reviewerId]
    )).rowCount===0){
      return res.status(400).json({error:'Choose one of the formal reviewers assigned to this research project.'})
    }
  }

  if(req.validated.knowledgeIds.length){
    const available=(await query(
      "SELECT COUNT(*)::int total FROM knowledge_items WHERE id=ANY($1::uuid[]) AND(status='Published' OR $2='Draft')",
      [req.validated.knowledgeIds,req.validated.mode]
    )).rows[0].total
    if(available!==new Set(req.validated.knowledgeIds).size){
      return res.status(400).json({error:'Final reports may use only published Repository documents.'})
    }
  }

  // Prepare an immutable repository file for the approved final report.
  let finalFile=null
  let reference=`RSH-DOC-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
  if(!draftMode){
    if(
      approvedVersion.reviewed_by!==req.user.id
    ){
      return res.status(403).json({error:'Only the recorded approver can generate this final research report.'})
    }
    const approvalDate=new Date(approvedVersion.reviewed_at||Date.now())
    const approvalTime=new Intl.DateTimeFormat('en-KE',{
      dateStyle:'medium',
      timeStyle:'short',
      timeZone:'Africa/Nairobi'
    }).format(approvalDate)
    const team=(await query(`SELECT u.name,'Lead Researcher' role,0 role_order FROM users u WHERE u.id=$1
      UNION ALL SELECT u.name,rc.role,1 FROM research_collaborators rc JOIN users u ON u.id=rc.user_id WHERE rc.project_id=$2
      UNION ALL SELECT u.name,COALESCE(rr.review_role,'Formal Reviewer'),2 FROM research_reviewers rr JOIN users u ON u.id=rr.reviewer_id WHERE rr.project_id=$2 AND rr.active=TRUE
      ORDER BY role_order,name`,[project.lead_id,project.id])).rows
    const teamText=team.map(member=>`${member.name} — ${member.role}`).join('\n')||'No project team recorded.'
    const approvedSections=approvedSnapshot.sections
    const repositorySections=[{title:'Research Team and Roles',content:teamText},...approvedSections.map(section=>({
      title:String(section.title||'Report section'),
      content:sanitizeTaskReportHtml(section.content||'')
    }))]
    const linkedKnowledgeReferences=req.validated.knowledgeIds.length
      ?(await query("SELECT title,author,document_date,source_url FROM knowledge_items WHERE id=ANY($1::uuid[]) AND status='Published'",[req.validated.knowledgeIds])).rows.map(item=>({
        source_type:'Repository Document',title:item.title,author:item.author||'',document_date:item.document_date,
        publisher:'Public Service Commission',url:item.source_url||'',citation_style:'APA'
      }))
      :[]
    if(!hasAuthoredReferencesSection(repositorySections)){
      const referencesSection=buildReportReferencesSection([...(approvedSnapshot.sources||[]),...linkedKnowledgeReferences])
      if(referencesSection)repositorySections.push(referencesSection)
    }
    repositorySections.push({
      title:'Review and Approval',
      content:`Status: FINAL — APPROVED\nReviewed and approved by: ${req.user.name||'Authorised reviewer'}\nApproval date: ${approvalTime}\nSubmitted report version: ${approvedVersion.version_number}`
    })
    const finalPdf=await buildPscTaskFinalPdf(req.validated.title,{
      Reference:reference,
      Research:project.title,
      'Research Lead':team.find(member=>member.role==='Lead Researcher')?.name||'Not specified',
      'Reviewed and approved by':req.user.name||'Authorised reviewer',
      Status:'FINAL — APPROVED',
      Version:Number(approvedVersion.version_number||1),
      'Approval date':approvalTime
    },repositorySections)
    const safeBase=String(project.title||'research-report')
      .replace(/[^a-z0-9]+/gi,'-')
      .replace(/^-+|-+$/g,'')
      .slice(0,90)||'research-report'
    const originalName=`${safeBase}-final-v${Number(approvedVersion.version_number||1)}.pdf`
    const stored=await storeDocument(finalPdf,'.pdf')
    storedFinalPath=stored.absolutePath
    finalFile={
      buffer:finalPdf,
      originalName,
      stored,
      sha256:crypto.createHash('sha256').update(finalPdf).digest('hex'),
      mimeType:'application/pdf'
    }
  }

  const generated=await transaction(async client=>{
    const lockedProject=(await client.query(
      'SELECT * FROM research_projects WHERE id=$1 FOR UPDATE',
      [project.id]
    )).rows[0]
    if(!lockedProject)throw Object.assign(new Error('Research project not found.'),{statusCode:404})

    if(!draftMode){
      const lockedLatestVersion=(await client.query(
        'SELECT id,status,version_number FROM research_report_versions WHERE project_id=$1 ORDER BY version_number DESC LIMIT 1 FOR UPDATE',
        [project.id]
      )).rows[0]
      if(!lockedLatestVersion || lockedLatestVersion.status!=='Approved' || lockedLatestVersion.id!==approvedVersion.id){
        throw Object.assign(new Error('The latest Research report version changed or is no longer approved. Refresh the workspace before retrying final publication.'),{statusCode:409})
      }
    }

    if(!draftMode){
      const already=(await client.query(`SELECT k.id,k.title
        FROM knowledge_items k
        JOIN repository_entity_links rel ON rel.knowledge_id=k.id
        WHERE rel.entity_type='research'
          AND rel.entity_id=$1
          AND k.document_type='Research Final Report'
          AND k.status='Published'
          AND COALESCE(k.is_archived,FALSE)=FALSE
        ORDER BY k.created_at DESC LIMIT 1`,[project.id])).rows[0]
      if(already){
        throw Object.assign(
          new Error('The approved final research report has already been published. Refresh Research or Documents to view the completed record.'),
          {statusCode:409}
        )
      }
    }

    const template=req.validated.templateId
      ?(await client.query(
        "SELECT * FROM document_templates WHERE id=$1 AND context='Research' AND active=TRUE AND governance_status IN('Standard','Approved')",
        [req.validated.templateId]
      )).rows[0]
      :(await client.query(
        "SELECT * FROM document_templates WHERE context='Research' AND active=TRUE AND governance_status IN('Standard','Approved') ORDER BY CASE governance_status WHEN 'Approved' THEN 0 ELSE 1 END,name LIMIT 1"
      )).rows[0]

    if(!template)throw Object.assign(new Error('No active Standard or Approved Research template is available.'),{statusCode:409})

    const document=(await client.query(
      `INSERT INTO generated_documents(
        template_id,template_version,context,context_id,title,reference,classification,status,
        created_by,last_updated_by,reviewer_id,submitted_by,submitted_at
      )VALUES($1,$2,'Research',$3,$4,$5,$6,$7,$8,$8,$9,$10,$11)RETURNING *`,
      [
        template.id,
        template.version,
        project.id,
        req.validated.title,
        reference,
        req.validated.classification,
        draftMode?'Submitted':'Final',
        req.user.id,
        draftMode?req.validated.reviewerId:req.user.id,
        draftMode?req.user.id:null,
        draftMode?new Date():null
      ]
    )).rows[0]

    const teamMembers=(await client.query(`SELECT u.name,'Lead Researcher' role,0 role_order FROM users u WHERE u.id=$1
      UNION ALL SELECT u.name,rc.role,1 FROM research_collaborators rc JOIN users u ON u.id=rc.user_id WHERE rc.project_id=$2
      UNION ALL SELECT u.name,COALESCE(rr.review_role,'Formal Reviewer'),2 FROM research_reviewers rr JOIN users u ON u.id=rr.reviewer_id WHERE rr.project_id=$2 AND rr.active=TRUE
      ORDER BY role_order,name`,[project.lead_id,project.id])).rows
    await client.query(`INSERT INTO generated_document_sections(document_id,section_key,title,section_order,content,completion,section_status,updated_by)
      VALUES($1,'research_team_roles','Research Team and Roles',0,$2,100,'Complete',$3)`,[document.id,teamMembers.map(member=>`${member.name} — ${member.role}`).join('\n')||'No project team recorded.',req.user.id])
    for(const section of sections){
      const completion=section.status==='Approved'?100:String(section.content||'').trim()?60:0
      await client.query(
        `INSERT INTO generated_document_sections(
          document_id,section_key,title,section_order,content,completion,section_status,owner_id,updated_by
        )VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          document.id,section.section_key,section.title,Number(section.section_order)+1,section.content,completion,
          section.status==='Approved'?'Complete':String(section.content||'').trim()?'In Progress':'Not Started',
          section.owner_id,req.user.id
        ]
      )
    }

    for(const source of Array.isArray(approvedSnapshot?.sources)?approvedSnapshot.sources:[]){
      const sourceDate=source.publication_date?new Date(source.publication_date):null
      const publicationYear=sourceDate&&!Number.isNaN(sourceDate.getTime())?sourceDate.getFullYear():null
      await client.query(
        "INSERT INTO generated_document_references(document_id,source_type,title,author,publication_year,publisher,url,identifier,citation_style,created_by)VALUES($1,$2,$3,$4,$5,$6,$7,$8,'APA',$9)",
        [document.id,source.source_type||'Research Source',source.title,source.author||'',publicationYear,source.publisher||'',source.url||'',source.identifier||'',req.user.id]
      )
    }

    for(const knowledgeId of [...new Set(req.validated.knowledgeIds)]){
      await client.query(
        "INSERT INTO repository_entity_links(knowledge_id,entity_type,entity_id,linked_by)VALUES($1,'research',$2,$3)ON CONFLICT DO NOTHING",
        [knowledgeId,project.id,req.user.id]
      )
      const item=(await client.query(
        'SELECT title,author,document_date FROM knowledge_items WHERE id=$1',
        [knowledgeId]
      )).rows[0]
      await client.query(
        "INSERT INTO generated_document_references(document_id,source_type,title,author,publication_year,publisher,url,identifier,citation_style,created_by)VALUES($1,'Repository Document',$2,$3,$4,'Public Service Commission','','','APA',$5)",
        [document.id,item.title,item.author||'',item.document_date?new Date(item.document_date).getFullYear():null,req.user.id]
      )
    }

    let repository=null
    if(draftMode){
      await client.query(
        "INSERT INTO generated_document_reviews(document_id,version_number,reviewer_id,decision,comments)VALUES($1,$2,$3,'Submitted','Draft research report submitted for review.')",
        [document.id,document.version,req.validated.reviewerId]
      )
      await client.query(
        "INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Draft research report ready for review',$2,'generated_document',$3)",
        [req.validated.reviewerId,`Review “${document.title}” for research project “${project.title}”.`,document.id]
      )
    }else{
      const category=(await client.query(
        "SELECT id FROM document_categories WHERE name='Research Reports' LIMIT 1"
      )).rows[0]||null
      const tags=['research','final-report','approved']
      const knowledgeClassification={
        Public:'PUBLIC',
        Confidential:'CONFIDENTIAL',
        Internal:'INTERNAL',
        Official:'INTERNAL'
      }[req.validated.classification]||'INTERNAL'
      const description=`Final approved research report for “${project.title}”. Approved and generated by ${req.user.name||'the assigned reviewer'}.`

      const item=(await client.query(`INSERT INTO knowledge_items(
        title,description,category,category_id,tags,author,document_date,status,created_by,approved_by,approved_at,current_version,
        source_type,source_url,directorate,document_type,subject,classification,felix_enabled,reviewed_by,reviewed_at
      )VALUES(
        $1,$2,'Research Reports',$3,$4,$5,CURRENT_DATE,'Published',$6,$6,NOW(),1,
        'Research','',$7,'Research Final Report',$8,$9,TRUE,$6,NOW()
      )RETURNING *`,[
        req.validated.title,
        description,
        category?.id||null,
        tags,
        req.user.name||null,
        req.user.id,
        project.directorate||null,
        project.title,
        knowledgeClassification
      ])).rows[0]

      const version=(await client.query(`INSERT INTO knowledge_versions(
        knowledge_id,version_number,uploader_id,original_name,stored_name,storage_path,mime_type,size_bytes,sha256_hash,
        is_current,approved_by,approved_at,notes
      )VALUES($1,1,$2,$3,$4,$5,$6,$7,$8,TRUE,$2,NOW(),
        'Automatically generated from reviewer-approved research report'
      )RETURNING *`,[
        item.id,
        req.user.id,
        finalFile.originalName,
        finalFile.stored.storedName,
        finalFile.stored.storagePath,
        finalFile.mimeType,
        finalFile.buffer.length,
        finalFile.sha256
      ])).rows[0]

      for(const tag of tags){
        const tagRow=(await client.query(
          'INSERT INTO document_tags(name,normalized_name,created_by)VALUES($1::varchar,lower($1::text)::varchar,$2::uuid)ON CONFLICT(normalized_name)DO UPDATE SET name=EXCLUDED.name RETURNING id',
          [tag,req.user.id]
        )).rows[0]
        await client.query(
          'INSERT INTO document_tag_links(knowledge_id,tag_id)VALUES($1::uuid,$2::uuid)ON CONFLICT DO NOTHING',
          [item.id,tagRow.id]
        )
      }

      await client.query(
        "INSERT INTO repository_entity_links(knowledge_id,entity_type,entity_id,linked_by)VALUES($1,'research',$2,$3)ON CONFLICT DO NOTHING",
        [item.id,project.id,req.user.id]
      )
      await client.query(
        "INSERT INTO repository_entity_links(knowledge_id,entity_type,entity_id,linked_by)VALUES($1,'report',$2,$3)ON CONFLICT DO NOTHING",
        [item.id,document.id,req.user.id]
      )

      const archivedDrafts=(await client.query(`UPDATE knowledge_items SET
        status='Archived',is_archived=TRUE,updated_at=NOW()
        WHERE id IN(
          SELECT draft_link.knowledge_id
          FROM repository_entity_links draft_link
          JOIN knowledge_items draft_item ON draft_item.id=draft_link.knowledge_id
          WHERE draft_link.entity_type='research'
            AND draft_link.entity_id=$1
            AND draft_item.document_type='Research Report Draft'
            AND COALESCE(draft_item.is_archived,FALSE)=FALSE
        ) RETURNING id`,[project.id])).rows
      for(const archivedDraft of archivedDrafts){
        await audit(client,req.user.id,'RESEARCH_DRAFT_ARCHIVED_AFTER_FINAL_PUBLICATION','knowledge',archivedDraft.id,{projectId:project.id,finalRepositoryDocumentId:item.id})
      }

      await client.query(
        "UPDATE research_projects SET status='Completed',updated_at=NOW() WHERE id=$1",
        [project.id]
      )
      await client.query(
        'INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',
        [
          project.id,
          req.user.id,
          'FINAL_REPORT_PUBLISHED_AND_RESEARCH_COMPLETED',
          JSON.stringify({
            documentId:document.id,
            repositoryDocumentId:item.id,
            repositoryVersionId:version.id,
            reference,
            approvedVersion:Number(approvedVersion.version_number||1)
          })
        ]
      )
      await audit(
        client,
        req.user.id,
        'RESEARCH_FINAL_REPORT_PUBLISHED',
        'knowledge',
        item.id,
        {
          projectId:project.id,
          generatedDocumentId:document.id,
          approvedVersion:Number(approvedVersion.version_number||1),
          sha256:finalFile.sha256
        }
      )
      await audit(
        client,
        req.user.id,
        'RESEARCH_STATUS_UPDATED',
        'research_project',
        project.id,
        {from:lockedProject.status,to:'Completed',reason:'Final approved report published'}
      )
      await enqueueFelixDocumentIndex(client,item.id,1,req.user.id)

      if(project.lead_id){
        await client.query(
          "INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Research completed',$2,'research',$3)",
          [
            project.lead_id,
            `The approved final report for “${project.title}” was generated by ${req.user.name||'the assigned reviewer'}, published to Documents, and the research project was marked Completed.`,
            project.id
          ]
        )
      }

      repository={id:item.id,title:item.title}
    }

    if(draftMode){
      await client.query(
        'INSERT INTO research_activity(project_id,user_id,action,details)VALUES($1,$2,$3,$4)',
        [
          project.id,req.user.id,'DRAFT_REPORT_SUBMITTED',
          JSON.stringify({documentId:document.id,reference,title:document.title,sectionCount:sections.length,reviewerId:req.validated.reviewerId})
        ]
      )
    }

    await audit(
      client,
      req.user.id,
      'RESEARCH_CONTROLLED_REPORT_GENERATED',
      'generated_document',
      document.id,
      {projectId:project.id,reference,sectionCount:sections.length,templateId:template.id,mode:req.validated.mode}
    )

    return {
      ...document,
      template_name:template.name,
      created_by_name:req.user.name,
      repository_document_id:repository?.id||null,
      repository_document_title:repository?.title||null,
      project_status:draftMode?lockedProject.status:'Completed'
    }
  })

  storedFinalPath=null
  res.status(201).json(generated)
}catch(error){
  if(storedFinalPath)await fs.unlink(storedFinalPath).catch(()=>{})
  if(error.statusCode)return res.status(error.statusCode).json({error:error.message})
  if(error.status)return res.status(error.status).json({error:error.message})
  next(error)
}})

app.get('/api/audit-logs',authenticate,authorize('System Admin'),async(req,res,next)=>{
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
app.get('/api/document-reviewers',authenticate,async(req,res,next)=>{try{
  if(!isManagementRole(req.user.role))return res.status(403).json({error:'Only an authorised manager can assign a document reviewer.'})
  const scoped=isTeamScopeRole(req.user.role)?await managedUserIds(req.user):null
  const all=isOrganisationScopeRole(req.user.role)
  res.json((await query(`SELECT id,name,email,role,division,status,active
    FROM users
    WHERE active=TRUE
      AND id<>$1
      AND($2::boolean OR id=ANY($3::uuid[]))
    ORDER BY name`,[req.user.id,all,scoped||[]])).rows)
}catch(error){next(error)}})
app.post('/api/document-reviews/:id/submit',authenticate,async(req,res,next)=>{try{
if(await activeExternalResearchForKnowledge(req.params.id))return res.status(409).json({error:'Imported research is submitted and resubmitted only from its Research Repository reader.'});const manager=await isKnowledgeManagerFor(req.user,req.params.id);const updated=await transaction(async client=>{const item=(await client.query('SELECT * FROM knowledge_items WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!item||item.created_by!==req.user.id&&!manager)return null;if(!item.reviewer_id)throw Object.assign(new Error('Assign a reviewer before submitting this document.'),{statusCode:409});if(item.reviewer_id===item.created_by)throw Object.assign(new Error('The document owner cannot review their own upload.'),{statusCode:409});await client.query("UPDATE knowledge_items SET status='Pending Approval',approved_by=NULL,approved_at=NULL,rejection_reason=NULL,updated_at=NOW() WHERE id=$1",[item.id]);await client.query("INSERT INTO document_reviews(knowledge_id,reviewer_id,actor_id,action,comments) VALUES($1,$2,$3,$4,'Submitted for review')",[item.id,item.reviewer_id,req.user.id,item.reviewer_id?'RESUBMITTED':'SUBMITTED']);await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'Document awaiting review',$2,'knowledge',$3)",[item.reviewer_id,`Ã¢â‚¬Å“${item.title}Ã¢â‚¬Â has been submitted for your review.`,item.id]);await audit(client,req.user.id,'DOCUMENT_SUBMITTED','knowledge',item.id,{});return item});if(!updated)return res.status(404).json({error:'Document not found or you cannot submit it.'});res.json(updated)}catch(error){next(error)}})
app.get('/api/document-reviews',authenticate,async(req,res,next)=>{
  try{
    const teamScope=isTeamScopeRole(req.user.role)
    const organisationScope=isOrganisationScopeRole(req.user.role)
    const scopeIds=teamScope?(await managedUserIds(req.user)||[]):[]

    let scopeClause=''
    let params=[]

    if(teamScope&&!organisationScope){
      scopeClause=` AND(
        k.reviewer_id=$1::uuid
        OR k.created_by=ANY($2::uuid[])
        OR k.reviewer_id=ANY($2::uuid[])
        OR k.approved_by=ANY($2::uuid[])
      )`
      params=[req.user.id,scopeIds]
    }

    if(!teamScope&&!organisationScope){
      scopeClause=' AND k.reviewer_id=$1::uuid'
      params=[req.user.id]
    }

    const result=await query(`SELECT
      k.*,
      creator.name created_by_name,
      reviewer.name reviewer_name,
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id',r.id,
            'action',r.action,
            'comments',r.comments,
            'created_at',r.created_at,
            'actor_name',actor.name
          )
          ORDER BY r.created_at DESC
        )
        FROM document_reviews r
        JOIN users actor ON actor.id=r.actor_id
        WHERE r.knowledge_id=k.id
      ),'[]') review_history
      FROM knowledge_items k
      JOIN users creator ON creator.id=k.created_by
      LEFT JOIN users reviewer ON reviewer.id=k.reviewer_id
      WHERE k.status='Pending Approval'
        AND NOT EXISTS(
          SELECT 1
          FROM external_research_imports eri
          WHERE eri.knowledge_id=k.id
            AND eri.status NOT IN('Published','Rejected')
        )
        ${scopeClause}
      ORDER BY k.updated_at`,
      params
    )

    res.json(result.rows)
  }catch(error){
    next(error)
  }
})
app.patch('/api/document-reviews/:id/assign',authenticate,validate(z.object({reviewerId:z.string().uuid()})),async(req,res,next)=>{try{
if(!isManagementRole(req.user.role))return res.status(403).json({error:'Only an authorised manager can assign a document reviewer.'});
if(await activeExternalResearchForKnowledge(req.params.id))return res.status(409).json({error:'Imported research reviewers are assigned contextually from Research Repository, not the generic document review queue.'});if(!await isKnowledgeManagerFor(req.user,req.params.id))return res.status(403).json({error:'This document is outside your management scope.'});if(isTeamScopeRole(req.user.role)){const ids=await managedUserIds(req.user);if(!ids.includes(req.validated.reviewerId))return res.status(403).json({error:'Choose a reviewer from your reporting subtree.'})}const updated=await transaction(async client=>{const current=(await client.query('SELECT id,title,created_by,reviewer_id,status FROM knowledge_items WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!current)return null;if(req.validated.reviewerId===current.created_by)throw Object.assign(new Error('The document owner cannot be assigned as reviewer.'),{statusCode:400});const reviewer=(await client.query("SELECT id,name FROM users WHERE id=$1 AND active=TRUE",[req.validated.reviewerId])).rows[0];if(!reviewer)throw Object.assign(new Error('Choose an active user within the permitted management scope.'),{statusCode:400});const item=(await client.query('UPDATE knowledge_items SET reviewer_id=$1,updated_at=NOW() WHERE id=$2 RETURNING *',[reviewer.id,req.params.id])).rows[0];await client.query("INSERT INTO document_reviews(knowledge_id,reviewer_id,actor_id,action,comments) VALUES($1,$2,$3,'ASSIGNED',$4)",[item.id,reviewer.id,req.user.id,`Assigned to ${reviewer.name}`]);await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'Document review assigned',$2,'knowledge',$3)",[reviewer.id,`You have been assigned to review Ã¢â‚¬Å“${item.title}Ã¢â‚¬Â.`,item.id]);await audit(client,req.user.id,current.reviewer_id&&current.reviewer_id!==reviewer.id?'DOCUMENT_REVIEW_REASSIGNED':'DOCUMENT_REVIEW_ASSIGNED','knowledge',item.id,{reviewerId:reviewer.id,previousReviewerId:current.reviewer_id||null});return {...item,reviewer_name:reviewer.name}});if(!updated)return res.status(404).json({error:'Document not found.'});res.json(updated)}catch(error){next(error)}})
app.post('/api/document-reviews/:id/decision',authenticate,validate(z.object({approved:z.boolean(),comments:z.string().max(2000).default('')})),async(req,res,next)=>{
  try{
    if(!req.validated.approved&&!req.validated.comments.trim())return res.status(400).json({error:'Explain what must be corrected before rejecting.'})
    await requireDocumentReadBeforeDecision(req.user,req.params.id)
    const result=await transaction(async client=>{
      const item=(await client.query('SELECT * FROM knowledge_items WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]
      if(!item)return {kind:'missing'}
      const improvement=(await client.query("SELECT id FROM document_improvement_assignments WHERE knowledge_id=$1 AND status='Submitted' ORDER BY created_at DESC LIMIT 1",[item.id])).rows[0]
      if(improvement)return {kind:'improvement-pending'}
      if(item.status!=='Pending Approval')return {kind:'conflict'}
      if(!item.reviewer_id||item.reviewer_id!==req.user.id)return {kind:'forbidden'};if(item.created_by===req.user.id)return {kind:'self-review'}
      const status=req.validated.approved?'Published':'Rejected'
      const row=(await client.query('UPDATE knowledge_items SET status=$1,approved_by=$2,approved_at=$3,rejection_reason=$4,updated_at=NOW() WHERE id=$5 RETURNING *',[status,req.validated.approved?req.user.id:null,req.validated.approved?new Date():null,req.validated.approved?null:req.validated.comments,item.id])).rows[0]
      await client.query('INSERT INTO document_reviews(knowledge_id,reviewer_id,actor_id,action,comments) VALUES($1,$2,$3,$4,$5)',[item.id,item.reviewer_id,req.user.id,req.validated.approved?'APPROVED':'REJECTED',req.validated.comments])
      await client.query('INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,$2,$3,$4,$5)',[item.created_by,req.validated.approved?'Document approved':'Document returned for correction',req.validated.approved?`Ã¢â‚¬Å“${item.title}Ã¢â‚¬Â has been approved and published.`:`Ã¢â‚¬Å“${item.title}Ã¢â‚¬Â was rejected: ${req.validated.comments}`,'knowledge',item.id])
      await audit(client,req.user.id,req.validated.approved?'KNOWLEDGE_PUBLISHED':'KNOWLEDGE_REJECTED','knowledge',item.id,{comments:req.validated.comments})
      if(req.validated.approved)await enqueueFelixDocumentIndex(client,row.id,row.current_version,req.user.id)
      return {kind:'updated',row}
    })
    if(result.kind==='missing')return res.status(404).json({error:'Document not found.'})
    if(result.kind==='improvement-pending')return res.status(409).json({error:'This version belongs to an active improvement. Review it from the assigned improvement workflow so approval publishes the submitted version.'})
    if(result.kind==='conflict')return res.status(409).json({error:'Only pending documents can be reviewed.'})
    if(result.kind==='forbidden')return res.status(403).json({error:'Only the reviewer assigned to this document can record the decision.'});if(result.kind==='self-review')return res.status(403).json({error:'You cannot review your own repository document.'})
    res.json(result.row)
  }catch(error){next(error)}
})
app.get('/api/document-reviews/:id/history',authenticate,async(req,res,next)=>{try{if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot view this review history.'});res.json((await query('SELECT r.id,r.action,r.comments,r.created_at,actor.name actor_name,reviewer.name reviewer_name FROM document_reviews r JOIN users actor ON actor.id=r.actor_id LEFT JOIN users reviewer ON reviewer.id=r.reviewer_id WHERE r.knowledge_id=$1 ORDER BY r.created_at DESC',[req.params.id])).rows)}catch(error){next(error)}})
app.get('/api/dashboard/team/:userId/workload',authenticate,async(req,res,next)=>{
  try{
    if(!isManagementRole(req.user.role)){
      return res.status(403).json({error:'Management access is required to view team workload.'})
    }

    const scoped=await managedUserIds(req.user)
    const all=scoped===null

    if(!all&&!scoped.includes(req.params.userId)){
      return res.status(403).json({error:'This user is outside your management scope.'})
    }

    const member=(await query(
      `SELECT id,name,division,role
       FROM users
       WHERE id=$1 AND active=TRUE`,
      [req.params.userId]
    )).rows[0]

    if(!member){
      return res.status(404).json({error:'Team member was not found.'})
    }

    const [assignments,tasks,research]=await Promise.all([
      query(`
        SELECT
          a.id,
          a.title,
          a.status,
          a.priority,
          a.due_date,
          'Assignment' type,
          'Assignments' destination,
          a.id context_id
        FROM assignment_members am
        JOIN assignments a ON a.id=am.assignment_id
        WHERE am.user_id=$1
          AND a.status<>'Completed'
        ORDER BY a.due_date NULLS LAST,a.updated_at DESC
      `,[member.id]),

      query(`
        SELECT
          t.id,
          t.title,
          t.status,
          t.priority,
          t.due_date,
          'Task' type,
          'Assignments' destination,
          t.assignment_id context_id,
          a.title context_title
        FROM assignment_tasks t
        JOIN assignments a ON a.id=t.assignment_id
        WHERE t.owner_id=$1
          AND t.archived_at IS NULL
          AND t.status<>'Completed'
        ORDER BY t.due_date NULLS LAST,t.updated_at DESC
      `,[member.id]),

      query(`
        SELECT
          p.id,
          p.title,
          p.status,
          NULL::text priority,
          p.end_date due_date,
          'Research Project' type,
          'Research Repository' destination,
          p.id context_id
        FROM research_projects p
        WHERE p.status NOT IN('Completed','Archived')
          AND (
            p.lead_id=$1
            OR EXISTS(
              SELECT 1
              FROM research_collaborators rc
              WHERE rc.project_id=p.id
                AND rc.user_id=$1
            )
          )
        ORDER BY p.end_date NULLS LAST,p.updated_at DESC
      `,[member.id])
    ])

    const mapItem=row=>({
      id:row.id,
      title:row.title,
      status:row.status,
      priority:row.priority||null,
      dueDate:row.due_date||null,
      type:row.type,
      destination:row.destination,
      contextId:row.context_id,
      contextTitle:row.context_title||null
    })

    res.json({
      member,
      assignments:assignments.rows.map(mapItem),
      tasks:tasks.rows.map(mapItem),
      research:research.rows.map(mapItem)
    })
  }catch(error){
    next(error)
  }
})
// APP2_RESEARCH_INTEGRATION_V8_3_7
// One authoritative notification synchronizer for Research. It backfills existing
// governed records as well as new work, so Dashboard and Notification Centre do
// not depend on whether a particular mutation route happened to emit a notice.
const syncResearchNotificationsForUser=async(client,userId)=>{
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[userId])
  await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
    SELECT $1,
      CASE WHEN p.lead_id=$1 THEN 'Research lead assignment' ELSE 'Research project assigned' END,
      CASE WHEN p.lead_id=$1
        THEN 'You are the Research Lead for “'||p.title||'”. Open the Research workspace to manage delivery, evidence and reporting.'
        ELSE 'You are a research team member for “'||p.title||'”. Open the Research workspace to view your project work.' END,
      'research',p.id
    FROM research_projects p
    WHERE p.status NOT IN('Completed','Archived')
      AND(p.lead_id=$1 OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=p.id AND rc.user_id=$1))
      AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=$1 AND n.entity_type='research' AND n.entity_id=p.id::text AND n.title IN('Research lead assignment','Research project assigned'))`,[userId])

  await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
    SELECT $1,'Research status update','“'||p.title||'” is now '||${researchLifecycleStatusSql('p')}||'.','research',p.id
    FROM research_projects p
    WHERE p.status<>'Planning' AND(p.lead_id=$1
      OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=p.id AND rc.user_id=$1)
      OR EXISTS(SELECT 1 FROM research_reviewers rr WHERE rr.project_id=p.id AND rr.reviewer_id=$1 AND rr.active=TRUE))
      AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=$1 AND n.entity_type='research' AND n.entity_id=p.id::text AND n.title='Research status update' AND n.body='“'||p.title||'” is now '||${researchLifecycleStatusSql('p')}||'.')`,[userId])

  await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
    SELECT $1,'Research due soon','“'||p.title||'” is due on '||TO_CHAR(p.end_date,'DD Mon YYYY')||'. Review milestones, evidence and report readiness.','research',p.id
    FROM research_projects p
    WHERE ${researchDueSoonSql('p')}
      AND(p.lead_id=$1 OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=p.id AND rc.user_id=$1))
      AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=$1 AND n.entity_type='research' AND n.entity_id=p.id::text AND n.title='Research due soon' AND n.body LIKE '%'||TO_CHAR(p.end_date,'DD Mon YYYY')||'%')`,[userId])

  await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
    SELECT $1,'Research overdue','“'||p.title||'” was due on '||TO_CHAR(p.end_date,'DD Mon YYYY')||'. Research delivery requires attention.','research',p.id
    FROM research_projects p
    WHERE ${researchOverdueSql('p')}
      AND(p.lead_id=$1 OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=p.id AND rc.user_id=$1))
      AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=$1 AND n.entity_type='research' AND n.entity_id=p.id::text AND n.title='Research overdue' AND n.body LIKE '%'||TO_CHAR(p.end_date,'DD Mon YYYY')||'%')`,[userId])

  await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
    SELECT $1,'Research milestone due soon','Milestone “'||m.title||'” for “'||p.title||'” is due on '||TO_CHAR(m.due_date,'DD Mon YYYY')||'.','research',p.id
    FROM research_milestones m JOIN research_projects p ON p.id=m.project_id
    WHERE m.owner_id=$1 AND m.status<>'Completed' AND ${researchCurrentSql('p')} AND m.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL '7 days'
      AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=$1 AND n.entity_type='research' AND n.entity_id=p.id::text AND n.title='Research milestone due soon' AND n.body LIKE '%“'||m.title||'”%' AND n.body LIKE '%'||TO_CHAR(m.due_date,'DD Mon YYYY')||'%')`,[userId])

  await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
    SELECT $1,'Research milestone overdue','Milestone “'||m.title||'” for “'||p.title||'” was due on '||TO_CHAR(m.due_date,'DD Mon YYYY')||'.','research',p.id
    FROM research_milestones m JOIN research_projects p ON p.id=m.project_id
    WHERE m.owner_id=$1 AND m.status<>'Completed' AND ${researchCurrentSql('p')} AND m.due_date<CURRENT_DATE
      AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=$1 AND n.entity_type='research' AND n.entity_id=p.id::text AND n.title='Research milestone overdue' AND n.body LIKE '%“'||m.title||'”%' AND n.body LIKE '%'||TO_CHAR(m.due_date,'DD Mon YYYY')||'%')`,[userId])

  await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
    SELECT $1,'Research review assigned','You are an assigned reviewer for “'||p.title||'”.','research',p.id
    FROM research_reviewers rr JOIN research_projects p ON p.id=rr.project_id
    WHERE rr.reviewer_id=$1 AND rr.active=TRUE AND p.status NOT IN('Completed','Archived')
      AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=$1 AND n.entity_type='research' AND n.entity_id=p.id::text AND n.title='Research review assigned')`,[userId])

  await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
    SELECT $1,'Research report awaiting review','Version '||v.version_number||' of “'||p.title||'” is ready for your review.','research',p.id
    FROM research_report_versions v JOIN research_projects p ON p.id=v.project_id
    WHERE v.reviewer_id=$1 AND v.status='Submitted'
      AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=$1 AND n.entity_type='research' AND n.entity_id=p.id::text AND n.title='Research report awaiting review' AND n.body LIKE 'Version '||v.version_number||' %')`,[userId])

  await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
    SELECT $1,
      CASE v.status WHEN 'Approved' THEN 'Research report approved' WHEN 'Changes Requested' THEN 'Research report changes requested' ELSE 'Research report rejected' END,
      'Version '||v.version_number||' of “'||p.title||'” is '||LOWER(v.status)||CASE WHEN COALESCE(v.review_comments,'')<>'' THEN ': '||v.review_comments ELSE '.' END,
      'research',p.id
    FROM research_report_versions v JOIN research_projects p ON p.id=v.project_id
    WHERE v.status IN('Approved','Changes Requested','Rejected') AND v.reviewed_at IS NOT NULL
      AND v.id=(SELECT latest.id FROM research_report_versions latest WHERE latest.project_id=p.id ORDER BY latest.version_number DESC LIMIT 1)
      AND(p.lead_id=$1 OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=p.id AND rc.user_id=$1))
      AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=$1 AND n.entity_type='research' AND n.entity_id=p.id::text AND n.title=CASE v.status WHEN 'Approved' THEN 'Research report approved' WHEN 'Changes Requested' THEN 'Research report changes requested' ELSE 'Research report rejected' END AND n.body LIKE 'Version '||v.version_number::text||' %')`,[userId])

  await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
    SELECT $1,'Research final report ready to publish','Approved version '||v.version_number||' of “'||p.title||'” is ready for controlled final publication to the Document Repository.','research',p.id
    FROM research_report_versions v JOIN research_projects p ON p.id=v.project_id
    WHERE v.reviewed_by=$1 AND v.status='Approved' AND p.status<>'Completed'
      AND v.id=(SELECT latest.id FROM research_report_versions latest WHERE latest.project_id=p.id ORDER BY latest.version_number DESC LIMIT 1)
      AND NOT EXISTS(SELECT 1 FROM knowledge_items k JOIN repository_entity_links l ON l.knowledge_id=k.id AND l.entity_type='research' AND l.entity_id=p.id WHERE k.document_type='Research Final Report' AND k.status='Published' AND COALESCE(k.is_archived,FALSE)=FALSE)
      AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=$1 AND n.entity_type='research' AND n.entity_id=p.id::text AND n.title='Research final report ready to publish' AND n.body LIKE 'Approved version '||v.version_number||' %')`,[userId])
}

app.get('/api/pulse',authenticate,async(req,res,next)=>{try{res.json(await pulseForUser(req.user))}catch(error){next(error)}})

app.get('/api/dashboard',authenticate,async(req,res,next)=>{
  try{
    await transaction(async client=>syncResearchNotificationsForUser(client,req.user.id))
    const management=isManagementRole(req.user.role)
    const researcher=req.user.role==='Researcher'
    const reviewerOnly=false
    const scoped=management?await managedUserIds(req.user):[req.user.id]
    const all=scoped===null
    const scopeIds=scoped||[req.user.id]
    const assignmentScope=`($1::boolean OR a.created_by=ANY($2::uuid[]) OR EXISTS(SELECT 1 FROM assignment_members sam WHERE sam.assignment_id=a.id AND sam.user_id=ANY($2::uuid[])) OR EXISTS(SELECT 1 FROM assignment_tasks sat WHERE sat.assignment_id=a.id AND(sat.owner_id=ANY($2::uuid[]) OR sat.reviewer_id=ANY($2::uuid[]))))`
    const researchScope=`($1::boolean OR p.lead_id=ANY($2::uuid[]) OR EXISTS(SELECT 1 FROM research_collaborators src WHERE src.project_id=p.id AND src.user_id=ANY($2::uuid[])) OR EXISTS(SELECT 1 FROM research_reviewers srr WHERE srr.project_id=p.id AND srr.reviewer_id=ANY($2::uuid[]) AND srr.active=TRUE))`

    const assignments=management
      ? await query(`SELECT a.id,a.title,a.status,a.priority,a.due_date,a.updated_at,lead.name owner_name,a.division team_name,'Assignment' type FROM assignments a LEFT JOIN LATERAL(SELECT u.name FROM assignment_members am JOIN users u ON u.id=am.user_id WHERE am.assignment_id=a.id AND am.member_role='Lead' ORDER BY u.name LIMIT 1) lead ON TRUE WHERE a.status<>'Completed' AND ${assignmentScope} ORDER BY a.due_date NULLS LAST,a.updated_at DESC LIMIT 40`,[all,scopeIds])
      : {rows:[]}

    const assignmentStats=management
      ? await query(`SELECT
          COUNT(*)::int active,
          COUNT(*) FILTER(
            WHERE a.due_date IS NOT NULL
              AND a.due_date < CURRENT_DATE
          )::int overdue,
          COUNT(*) FILTER(
            WHERE a.due_date IS NOT NULL
              AND a.due_date >= CURRENT_DATE
              AND a.due_date <= CURRENT_DATE + INTERVAL '7 days'
          )::int due_soon
        FROM assignments a
        WHERE a.status<>'Completed'
          AND ${assignmentScope}`,[all,scopeIds])
      : {rows:[{active:0,overdue:0,due_soon:0}]}

    const tasks=researcher
      ? await query("SELECT t.id,t.assignment_id,t.title,t.status,t.priority,t.due_date,t.updated_at,a.title context_title,'Task' type FROM assignment_tasks t JOIN assignments a ON a.id=t.assignment_id WHERE t.archived_at IS NULL AND t.status<>'Completed' AND t.owner_id=$1 ORDER BY t.due_date NULLS LAST,t.updated_at DESC LIMIT 40",[req.user.id])
      : management
        ? await query(`SELECT t.id,t.assignment_id,t.title,t.status,t.priority,t.due_date,t.updated_at,a.title context_title,owner.name owner_name,a.division team_name,'Task' type FROM assignment_tasks t JOIN assignments a ON a.id=t.assignment_id LEFT JOIN users owner ON owner.id=t.owner_id WHERE t.archived_at IS NULL AND t.status<>'Completed' AND ($1::boolean OR t.owner_id=ANY($2::uuid[]) OR t.reviewer_id=ANY($2::uuid[])) ORDER BY t.due_date NULLS LAST,t.updated_at DESC LIMIT 60`,[all,scopeIds])
        : {rows:[]}

    const taskStats=management
      ? await query(`SELECT
          COUNT(*)::int active,
          COUNT(*) FILTER(
            WHERE t.due_date IS NOT NULL
              AND t.due_date < CURRENT_DATE
          )::int overdue,
          COUNT(*) FILTER(
            WHERE t.due_date IS NOT NULL
              AND t.due_date >= CURRENT_DATE
              AND t.due_date <= CURRENT_DATE + INTERVAL '7 days'
          )::int due_soon,
          COUNT(*) FILTER(
            WHERE t.contribution_status='Ready for Integration'
          )::int awaiting_review
        FROM assignment_tasks t
        JOIN assignments a ON a.id=t.assignment_id
        WHERE t.archived_at IS NULL
          AND t.status<>'Completed'
          AND ($1::boolean OR t.owner_id=ANY($2::uuid[]) OR t.reviewer_id=ANY($2::uuid[]))`,[all,scopeIds])
      : {rows:[{active:0,overdue:0,due_soon:0,awaiting_review:0}]}

    const research=management
      ? await query(`SELECT p.id,p.title,p.status,${researchLifecycleStatusSql('p')} workflow_status,p.end_date due_date,p.updated_at,lead.name owner_name,lead.division team_name,'Research Project' type FROM research_projects p LEFT JOIN users lead ON lead.id=p.lead_id WHERE ${researchCurrentSql('p')} AND ${researchScope} ORDER BY p.end_date NULLS LAST,p.updated_at DESC`,[all,scopeIds])
      : researcher
        ? await query(`SELECT p.id,p.title,p.status,${researchLifecycleStatusSql('p')} workflow_status,p.end_date due_date,p.updated_at,lead.name owner_name,lead.division team_name,'Research Project' type
            FROM research_projects p LEFT JOIN users lead ON lead.id=p.lead_id
            WHERE ${researchCurrentSql('p')} AND(
              p.lead_id=$1 OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=p.id AND rc.user_id=$1)
            ) ORDER BY p.end_date NULLS LAST,p.updated_at DESC`,[req.user.id])
        : {rows:[]}

    const researchStats=management
      ? await query(`SELECT
          COUNT(*) FILTER(WHERE ${researchCurrentSql('p')})::int current,
          COUNT(*) FILTER(WHERE ${researchLifecycleStatusSql('p')}='Active')::int active,
          COUNT(*) FILTER(WHERE ${researchLifecycleStatusSql('p')}='Planning')::int planning,
          COUNT(*) FILTER(WHERE ${researchLifecycleStatusSql('p')}='Under Review')::int under_review,
          COUNT(*) FILTER(WHERE ${researchLifecycleStatusSql('p')}='Changes Requested')::int changes_requested,
          COUNT(*) FILTER(WHERE ${researchLifecycleStatusSql('p')}='Completed')::int completed,
          COUNT(*) FILTER(WHERE ${researchReadyToPublishSql('p')})::int ready_to_publish,
          COUNT(*) FILTER(WHERE ${researchOverdueSql('p')})::int overdue,
          COUNT(*) FILTER(WHERE ${researchDueSoonSql('p')})::int due_soon
        FROM research_projects p
        WHERE ${researchScope}`,[all,scopeIds])
      : {rows:[{current:0,active:0,planning:0,under_review:0,changes_requested:0,completed:0,ready_to_publish:0,overdue:0,due_soon:0}]}

    const milestones=management
      ? await query(`SELECT m.id,m.project_id,m.title,m.status,m.due_date,m.updated_at,p.title context_title,COALESCE(mo.name,lead.name) owner_name,COALESCE(mo.division,lead.division) team_name,'Research Milestone' type FROM research_milestones m JOIN research_projects p ON p.id=m.project_id LEFT JOIN users mo ON mo.id=m.owner_id LEFT JOIN users lead ON lead.id=p.lead_id WHERE m.status<>'Completed' AND ${researchScope} ORDER BY m.due_date NULLS LAST LIMIT 40`,[all,scopeIds])
      : {rows:[]}

    const milestoneStats=management
      ? await query(`SELECT
          COUNT(*)::int active,
          COUNT(*) FILTER(
            WHERE m.due_date IS NOT NULL
              AND m.due_date < CURRENT_DATE
          )::int overdue,
          COUNT(*) FILTER(
            WHERE m.due_date IS NOT NULL
              AND m.due_date >= CURRENT_DATE
              AND m.due_date <= CURRENT_DATE + INTERVAL '7 days'
          )::int due_soon
        FROM research_milestones m
        JOIN research_projects p ON p.id=m.project_id
        WHERE m.status<>'Completed'
          AND ${researchScope}`,[all,scopeIds])
      : {rows:[{active:0,overdue:0,due_soon:0}]}

    const teamWorkload=management
      ? await query(`
          WITH scoped_users AS (
            SELECT u.id,u.name,u.division
            FROM users u
            WHERE u.active=TRUE
              AND ($1::boolean OR u.id=ANY($2::uuid[]))
          ),
          assignment_load AS (
            SELECT
              su.id user_id,
              COUNT(DISTINCT a.id) FILTER(
                WHERE a.status<>'Completed'
              )::int active_assignments,
              COUNT(DISTINCT a.id) FILTER(
                WHERE a.status<>'Completed'
                  AND a.due_date IS NOT NULL
                  AND a.due_date<CURRENT_DATE
              )::int overdue_assignments,
              COUNT(DISTINCT a.id) FILTER(
                WHERE a.status<>'Completed'
                  AND a.due_date IS NOT NULL
                  AND a.due_date>=CURRENT_DATE
                  AND a.due_date<=CURRENT_DATE+INTERVAL '7 days'
              )::int due_soon_assignments
            FROM scoped_users su
            LEFT JOIN assignment_members am
              ON am.user_id=su.id
            LEFT JOIN assignments a
              ON a.id=am.assignment_id
            GROUP BY su.id
          ),
          task_load AS (
            SELECT
              su.id user_id,
              COUNT(t.id) FILTER(
                WHERE t.archived_at IS NULL
                  AND t.status<>'Completed'
              )::int active_tasks,
              COUNT(t.id) FILTER(
                WHERE t.archived_at IS NULL
                  AND t.status<>'Completed'
                  AND t.due_date IS NOT NULL
                  AND t.due_date<CURRENT_DATE
              )::int overdue_tasks,
              COUNT(t.id) FILTER(
                WHERE t.archived_at IS NULL
                  AND t.status<>'Completed'
                  AND t.due_date IS NOT NULL
                  AND t.due_date>=CURRENT_DATE
                  AND t.due_date<=CURRENT_DATE+INTERVAL '7 days'
              )::int due_soon_tasks
            FROM scoped_users su
            LEFT JOIN assignment_tasks t
              ON t.owner_id=su.id
            GROUP BY su.id
          ),
          research_load AS (
            SELECT
              su.id user_id,
              COUNT(DISTINCT p.id) FILTER(
                WHERE p.status NOT IN('Completed','Archived')
              )::int active_research,
              COUNT(DISTINCT p.id) FILTER(
                WHERE p.status NOT IN('Completed','Archived')
                  AND p.end_date IS NOT NULL
                  AND p.end_date<CURRENT_DATE
              )::int overdue_research,
              COUNT(DISTINCT p.id) FILTER(
                WHERE p.status NOT IN('Completed','Archived')
                  AND p.end_date IS NOT NULL
                  AND p.end_date>=CURRENT_DATE
                  AND p.end_date<=CURRENT_DATE+INTERVAL '7 days'
              )::int due_soon_research
            FROM scoped_users su
            LEFT JOIN research_projects p
              ON p.lead_id=su.id
                 OR EXISTS(
                   SELECT 1
                   FROM research_collaborators rc
                   WHERE rc.project_id=p.id
                     AND rc.user_id=su.id
                 )
            GROUP BY su.id
          )
          SELECT
            su.id,
            su.name,
            su.division,
            COALESCE(a.active_assignments,0)::int active_assignments,
            COALESCE(t.active_tasks,0)::int active_tasks,
            COALESCE(r.active_research,0)::int active_research,
            (
              COALESCE(a.overdue_assignments,0)+
              COALESCE(t.overdue_tasks,0)+
              COALESCE(r.overdue_research,0)
            )::int overdue,
            (
              COALESCE(a.due_soon_assignments,0)+
              COALESCE(t.due_soon_tasks,0)+
              COALESCE(r.due_soon_research,0)
            )::int due_soon
          FROM scoped_users su
          LEFT JOIN assignment_load a ON a.user_id=su.id
          LEFT JOIN task_load t ON t.user_id=su.id
          LEFT JOIN research_load r ON r.user_id=su.id
          ORDER BY
            (
              COALESCE(a.overdue_assignments,0)+
              COALESCE(t.overdue_tasks,0)+
              COALESCE(r.overdue_research,0)
            ) DESC,
            (
              COALESCE(a.due_soon_assignments,0)+
              COALESCE(t.due_soon_tasks,0)+
              COALESCE(r.due_soon_research,0)
            ) DESC,
            su.name
        `,[all,scopeIds])
      : {rows:[]}
    const reviews=await query(`
      SELECT * FROM (
        SELECT gd.id,gd.title,gd.status,gd.review_due_date due_date,gd.updated_at,gd.context review_context,gd.context_id,
          COALESCE(a.title,p.title,gd.context) context_title,COALESCE(submitter.name,creator.name) owner_name,COALESCE(a.division,research_lead.division,submitter.division,creator.division) team_name,'Generated Document' review_kind,'Review' type
        FROM generated_documents gd
        LEFT JOIN assignments a ON gd.context='Assignment' AND a.id=gd.context_id
        LEFT JOIN research_projects p ON gd.context='Research' AND p.id=gd.context_id
        LEFT JOIN users research_lead ON research_lead.id=p.lead_id
        LEFT JOIN users submitter ON submitter.id=gd.submitted_by LEFT JOIN users creator ON creator.id=gd.created_by
        WHERE gd.reviewer_id=$1 AND gd.status IN('Submitted','Under Review','Revised')
        UNION ALL
        SELECT p.id,p.title,v.status,NULL::date due_date,COALESCE(v.submitted_at,v.created_at) updated_at,'Research' review_context,p.id context_id,p.title context_title,submitter.name owner_name,COALESCE(submitter.division,lead.division) team_name,'Research Report' review_kind,'Review' type
        FROM research_report_versions v JOIN research_projects p ON p.id=v.project_id LEFT JOIN users submitter ON submitter.id=v.submitted_by LEFT JOIN users lead ON lead.id=p.lead_id
        WHERE v.reviewer_id=$1 AND v.status='Submitted'
        UNION ALL
        SELECT t.id,t.title,
          CASE WHEN EXISTS(
            SELECT 1 FROM assignment_history h
            WHERE h.assignment_id=t.assignment_id
              AND h.action='TASK_REPORT_REVIEW_STARTED'
              AND h.details->>'taskId'=t.id::text
              AND h.details->>'reportVersion'=COALESCE(t.contribution_report_version,0)::text
          ) THEN 'Under Review' ELSE t.contribution_status END status,
          t.due_date,t.updated_at,'Assignment Task' review_context,t.assignment_id context_id,a.title context_title,owner.name owner_name,COALESCE(owner.division,a.division) team_name,'Task Report' review_kind,'Review' type
        FROM assignment_tasks t JOIN assignments a ON a.id=t.assignment_id LEFT JOIN users owner ON owner.id=t.owner_id
        WHERE t.reviewer_id=$1 AND t.archived_at IS NULL AND t.contribution_status='Ready for Integration'
        UNION ALL
        SELECT v.id,p.title || ' â€” Approved Research Report' title,v.status,NULL::date due_date,COALESCE(v.reviewed_at,v.submitted_at,v.created_at) updated_at,'Research' review_context,p.id context_id,p.title context_title,submitter.name owner_name,COALESCE(submitter.division,lead.division) team_name,'Research Report' review_kind,'Finalization' type
        FROM research_report_versions v JOIN research_projects p ON p.id=v.project_id LEFT JOIN users submitter ON submitter.id=v.submitted_by LEFT JOIN users lead ON lead.id=p.lead_id
        WHERE v.reviewed_by=$1 AND v.status='Approved' AND p.status<>'Completed'
          AND NOT EXISTS(SELECT 1 FROM knowledge_items k JOIN repository_entity_links l ON l.knowledge_id=k.id AND l.entity_type='research' AND l.entity_id=p.id WHERE k.document_type='Research Final Report' AND k.status='Published' AND COALESCE(k.is_archived,FALSE)=FALSE)

        UNION ALL
        SELECT t.id,t.title,t.contribution_status status,t.due_date,t.updated_at,'Assignment Task' review_context,t.assignment_id context_id,a.title context_title,owner.name owner_name,COALESCE(owner.division,a.division) team_name,'Task Report' review_kind,'Finalization' type
        FROM assignment_tasks t JOIN assignments a ON a.id=t.assignment_id LEFT JOIN users owner ON owner.id=t.owner_id
        WHERE t.reviewer_id=$1 AND t.archived_at IS NULL AND t.contribution_status='Integrated'
        UNION ALL
        SELECT k.id,k.title,k.status,NULL::date due_date,k.updated_at,'Knowledge' review_context,k.id context_id,'Document Repository' context_title,creator.name owner_name,creator.division team_name,'Knowledge' review_kind,'Review' type
        FROM knowledge_items k JOIN users creator ON creator.id=k.created_by WHERE k.reviewer_id=$1 AND k.status='Pending Approval'
      ) assigned_reviews
      ORDER BY CASE WHEN type='Review' THEN 0 ELSE 1 END,due_date NULLS LAST,updated_at DESC LIMIT 40`,[req.user.id])

    // APP2_TEAM_REVIEW_STATUS
    // Management visibility only. This does not grant review-decision authority.
    const teamReviewStatus=management
      ?await query(`
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
            reviewer.name reviewer_name,
            'Generated Document' review_kind
          FROM generated_documents gd
          LEFT JOIN assignments a
            ON gd.context='Assignment' AND a.id=gd.context_id
          LEFT JOIN research_projects p
            ON gd.context='Research' AND p.id=gd.context_id
          LEFT JOIN users reviewer ON reviewer.id=gd.reviewer_id
          WHERE gd.reviewer_id IS NOT NULL
            AND ($1::boolean OR gd.reviewer_id=ANY($2::uuid[]))
            AND gd.status IN('Submitted','Under Review','Revised')

          UNION ALL

          SELECT
            v.id,
            p.title,
            v.status,
            NULL::date due_date,
            COALESCE(v.submitted_at,v.created_at) updated_at,
            'Research' review_context,
            p.id context_id,
            p.title context_title,
            reviewer.name reviewer_name,
            'Research Report' review_kind
          FROM research_report_versions v
          JOIN research_projects p ON p.id=v.project_id
          LEFT JOIN users reviewer ON reviewer.id=v.reviewer_id
          WHERE v.reviewer_id IS NOT NULL
            AND ($1::boolean OR v.reviewer_id=ANY($2::uuid[]))
            AND v.status='Submitted'

          UNION ALL

          SELECT
            t.id,
            t.title,
            CASE
              WHEN EXISTS(
                SELECT 1
                FROM assignment_history h
                WHERE h.assignment_id=t.assignment_id
                  AND h.action='TASK_REPORT_REVIEW_STARTED'
                  AND h.details->>'taskId'=t.id::text
                  AND h.details->>'reportVersion'=
                    COALESCE(t.contribution_report_version,0)::text
              )
              THEN 'Under Review'
              ELSE 'Pending Review'
            END status,
            t.due_date,
            t.updated_at,
            'Assignment Task' review_context,
            t.assignment_id context_id,
            a.title context_title,
            reviewer.name reviewer_name,
            'Task Report' review_kind
          FROM assignment_tasks t
          JOIN assignments a ON a.id=t.assignment_id
          LEFT JOIN users reviewer ON reviewer.id=t.reviewer_id
          WHERE t.reviewer_id IS NOT NULL
            AND ($1::boolean OR t.reviewer_id=ANY($2::uuid[]))
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
            reviewer.name reviewer_name,
            'Knowledge' review_kind
          FROM knowledge_items k
          LEFT JOIN users reviewer ON reviewer.id=k.reviewer_id
          WHERE k.reviewer_id IS NOT NULL
            AND ($1::boolean OR k.reviewer_id=ANY($2::uuid[]))
            AND k.status='Pending Approval'
        ) scoped_reviews
        ORDER BY due_date NULLS LAST,updated_at DESC
        LIMIT 100
      `,[all,scopeIds])
      :{rows:[]}
    // APP2_AUTHORITATIVE_REVIEW_HISTORY
    const reviewHistoryRows=await query(`
      SELECT * FROM (

        SELECT
          (decision_event.id::text || ':' || decision_event.version_number::text) id,
          COALESCE(gd.title,'Assignment / research report') title,
          CASE
            WHEN decision_event.decision='Final' THEN 'Finalized'
            ELSE decision_event.decision
          END status,
          decision_event.created_at reviewed_at,
          gd.context review_context,
          gd.context_id,
          COALESCE(a.title,p.title,gd.context) context_title,
          COALESCE(submitter.name,creator.name) owner_name,
          'Generated Document' review_kind
        FROM generated_documents gd
        LEFT JOIN assignments a
          ON gd.context='Assignment' AND a.id=gd.context_id
        LEFT JOIN research_projects p
          ON gd.context='Research' AND p.id=gd.context_id
        LEFT JOIN users submitter ON submitter.id=gd.submitted_by
        LEFT JOIN users creator ON creator.id=gd.created_by
        JOIN generated_document_reviews decision_event
          ON decision_event.document_id=gd.id
          AND decision_event.reviewer_id=$1
          AND decision_event.decision IN('Changes Requested','Rejected','Approved','Final')

        UNION ALL

        SELECT
          l.id::text id,
          COALESCE(k.title,l.details->>'title','Repository document') title,
          CASE l.action WHEN 'DOCUMENT_APPROVED' THEN 'Approved' WHEN 'DOCUMENT_PUBLISHED' THEN 'Approved' ELSE 'Rejected' END status,
          l.created_at reviewed_at,
          'Knowledge' review_context,
          COALESCE(k.id,CASE WHEN l.entity_id ~* '^[0-9a-f-]{36}$' THEN l.entity_id::uuid ELSE NULL END) context_id,
          'Document Repository' context_title,
          creator.name owner_name,
          'Knowledge' review_kind
        FROM audit_logs l
        LEFT JOIN knowledge_items k ON k.id::text=l.entity_id
        LEFT JOIN users creator ON creator.id=k.created_by
        WHERE l.user_id=$1 AND l.entity_type='knowledge'
          AND l.action IN('DOCUMENT_APPROVED','DOCUMENT_PUBLISHED','DOCUMENT_REJECTED')
          AND NOT EXISTS(SELECT 1 FROM document_reviews r WHERE r.knowledge_id::text=l.entity_id AND r.actor_id=l.user_id AND r.created_at=l.created_at)

        UNION ALL

        SELECT
          l.id::text id,
          COALESCE(dr.knowledge_title,l.details->>'title','Document deletion request') title,
          CASE l.action WHEN 'DOCUMENT_DELETION_APPROVED' THEN 'Approved' ELSE 'Rejected' END status,
          l.created_at reviewed_at,
          'Knowledge' review_context,
          dr.knowledge_id context_id,
          'Document Repository deletion' context_title,
          requester.name owner_name,
          'Document Deletion Request' review_kind
        FROM audit_logs l
        LEFT JOIN document_deletion_requests dr ON dr.id::text=l.details->>'requestId'
        LEFT JOIN users requester ON requester.id=dr.requested_by
        WHERE l.user_id=$1 AND l.entity_type='knowledge' AND l.action IN('DOCUMENT_DELETION_APPROVED','DOCUMENT_DELETION_REJECTED')
          AND dr.id IS NOT NULL

        UNION ALL

        SELECT
          l.id::text id,
          COALESCE(dr.knowledge_title,l.details->>'title','Document deletion request') title,
          CASE l.action WHEN 'DOCUMENT_DELETION_APPROVED' THEN 'Approved' ELSE 'Rejected' END status,
          l.created_at reviewed_at,
          'Knowledge' review_context,
          NULL::uuid context_id,
          'Document Repository deletion' context_title,
          requester.name owner_name,
          'Document Deletion Request' review_kind
        FROM audit_logs l
        LEFT JOIN document_deletion_requests dr ON dr.id::text=l.details->>'requestId'
        LEFT JOIN users requester ON requester.id=dr.requested_by
        WHERE l.user_id=$1 AND l.entity_type='knowledge' AND l.action IN('DOCUMENT_DELETION_APPROVED','DOCUMENT_DELETION_REJECTED')
          AND dr.id IS NULL

        UNION ALL

        SELECT
          l.id::text id,
          COALESCE(gd.title,l.details->>'title','Assignment report') title,
          CASE
            WHEN l.action='ASSIGNMENT_REPORT_APPROVED' THEN 'Approved'
            WHEN l.action='ASSIGNMENT_REPORT_REJECTED' THEN 'Rejected'
            WHEN l.action='ASSIGNMENT_REPORT_CHANGES_REQUESTED' THEN 'Changes Requested'
            ELSE 'Finalized'
          END status,
          l.created_at reviewed_at,
          CASE WHEN gd.context IN('Assignment','Assignment Task') THEN 'Assignment' ELSE COALESCE(gd.context,'Assignment') END review_context,
          gd.context_id,
          COALESCE(a.title,p.title,'Assignment report') context_title,
          submitter.name owner_name,
          'Generated Document' review_kind
        FROM audit_logs l
        LEFT JOIN generated_documents gd ON gd.id::text=l.entity_id
        LEFT JOIN assignments a ON gd.context='Assignment' AND a.id=gd.context_id
        LEFT JOIN research_projects p ON gd.context='Research' AND p.id=gd.context_id
        LEFT JOIN users submitter ON submitter.id=COALESCE(gd.submitted_by,gd.created_by)
        WHERE l.user_id=$1 AND l.entity_type='generated_document'
          AND l.action IN('ASSIGNMENT_REPORT_APPROVED','ASSIGNMENT_REPORT_REJECTED','ASSIGNMENT_REPORT_CHANGES_REQUESTED','ASSIGNMENT_REPORT_FINALIZED')
          AND NOT EXISTS(SELECT 1 FROM generated_document_reviews r WHERE r.document_id::text=l.entity_id AND r.reviewer_id=l.user_id AND r.created_at=l.created_at)

        UNION ALL

        SELECT
          v.id::text id,
          p.title || ' â€” Version ' || v.version_number::text title,
          v.status,
          v.reviewed_at,
          'Research' review_context,
          p.id context_id,
          p.title context_title,
          submitter.name owner_name,
          'Research Report' review_kind
        FROM research_report_versions v
        JOIN research_projects p ON p.id=v.project_id
        LEFT JOIN users submitter ON submitter.id=v.submitted_by
        WHERE v.reviewed_by=$1
          AND v.reviewed_at IS NOT NULL
          AND v.status IN('Approved','Changes Requested','Rejected')

        UNION ALL

        SELECT
          h.id::text id,
          COALESCE(h.details->>'title',t.title),
          CASE
            WHEN h.action='TASK_REPORT_REJECTED' THEN 'Rejected'
            WHEN h.action='TASK_REPORT_CHANGES_REQUESTED' THEN 'Changes Requested'
            WHEN h.action='TASK_REPORT_APPROVED' THEN 'Approved'
          END status,
          h.created_at reviewed_at,
          'Assignment Task' review_context,
          t.assignment_id context_id,
          a.title context_title,
          owner.name owner_name,
          'Task Report' review_kind
        FROM assignment_tasks t
        JOIN assignments a ON a.id=t.assignment_id
        LEFT JOIN users owner ON owner.id=t.owner_id
        JOIN assignment_history h
          ON h.assignment_id=t.assignment_id
          AND h.action IN(
            'TASK_REPORT_APPROVED',
            'TASK_REPORT_REJECTED',
            'TASK_REPORT_CHANGES_REQUESTED'
          )
          AND h.details->>'taskId'=t.id::text
          AND h.details->>'reviewerId'=$1::text

        UNION ALL

        SELECT
          l.id::text id,
          COALESCE(l.details->>'title','Task report') title,
          CASE
            WHEN l.action='ASSIGNMENT_TASK_REPORT_APPROVED' THEN 'Approved'
            WHEN l.action='ASSIGNMENT_TASK_REPORT_REJECTED' THEN 'Rejected'
            ELSE 'Changes Requested'
          END status,
          l.created_at reviewed_at,
          'Assignment Task' review_context,
          t.assignment_id context_id,
          COALESCE(a.title,'Assignment task report') context_title,
          owner.name owner_name,
          'Task Report' review_kind
        FROM audit_logs l
        LEFT JOIN assignment_tasks t ON t.id::text=l.entity_id
        LEFT JOIN assignments a ON a.id=t.assignment_id
        LEFT JOIN users owner ON owner.id=t.owner_id
        WHERE l.user_id=$1 AND l.entity_type='assignment_task'
          AND l.action IN('ASSIGNMENT_TASK_REPORT_APPROVED','ASSIGNMENT_TASK_REPORT_REJECTED','ASSIGNMENT_TASK_REPORT_CHANGES_REQUESTED')

        UNION ALL

        SELECT
          (decision_event.id::text || ':' || decision_event.action) id,
          k.title,
          CASE
            WHEN decision_event.action='APPROVED' THEN 'Approved'
            WHEN decision_event.action='REJECTED' THEN 'Rejected'
          END status,
          decision_event.created_at reviewed_at,
          'Knowledge' review_context,
          k.id context_id,
          'Document Repository' context_title,
          creator.name owner_name,
          'Knowledge' review_kind
        FROM knowledge_items k
        JOIN users creator ON creator.id=k.created_by
        JOIN document_reviews decision_event
          ON decision_event.knowledge_id=k.id
          AND decision_event.actor_id=$1
          AND decision_event.action IN('APPROVED','REJECTED')

        UNION ALL

        SELECT
          review_event.id::text id,
          COALESCE(m.title,review_event.details->>'title','Meeting') title,
          CASE review_event.action
            WHEN 'MEETING_SCHEDULE_APPROVED' THEN 'Approved'
            WHEN 'MEETING_SCHEDULE_RETURNED' THEN 'Returned'
            WHEN 'MEETING_SCHEDULE_REJECTED' THEN 'Rejected'
            WHEN 'MEETING_MINUTES_APPROVED' THEN 'Approved'
            WHEN 'MEETING_MINUTES_RETURNED' THEN 'Returned'
          END status,
          review_event.created_at reviewed_at,
          'Meeting' review_context,
          m.id context_id,
          CASE WHEN review_event.action LIKE 'MEETING_MINUTES_%' THEN 'Meeting minutes review' ELSE 'Meeting schedule approval' END context_title,
          requester.name owner_name,
          CASE WHEN review_event.action LIKE 'MEETING_MINUTES_%' THEN 'Meeting Minutes' ELSE 'Meeting Schedule Approval' END review_kind
        FROM audit_logs review_event
        LEFT JOIN meetings m ON m.id::text=review_event.entity_id
        LEFT JOIN users requester ON requester.id=m.created_by
        WHERE review_event.user_id=$1
          AND review_event.entity_type='meeting'
          AND review_event.action IN(
            'MEETING_SCHEDULE_APPROVED','MEETING_SCHEDULE_RETURNED','MEETING_SCHEDULE_REJECTED',
            'MEETING_MINUTES_APPROVED','MEETING_MINUTES_RETURNED'
          )

        UNION ALL

        SELECT
          l.id::text id,
          COALESCE(l.details->>'title','Meeting') title,
          CASE l.action WHEN 'MEETING_SCHEDULE_APPROVED' THEN 'Approved' WHEN 'MEETING_SCHEDULE_RETURNED' THEN 'Returned' WHEN 'MEETING_SCHEDULE_REJECTED' THEN 'Rejected' ELSE 'Approved' END status,
          l.created_at reviewed_at,
          'Meeting' review_context,
          m.id context_id,
          CASE WHEN l.action LIKE 'MEETING_MINUTES_%' THEN 'Meeting minutes review' ELSE 'Meeting schedule approval' END context_title,
          requester.name owner_name,
          CASE WHEN l.action LIKE 'MEETING_MINUTES_%' THEN 'Meeting Minutes' ELSE 'Meeting Schedule Approval' END review_kind
        FROM audit_logs l
        LEFT JOIN meetings m ON m.id::text=l.entity_id
        LEFT JOIN users requester ON requester.id=m.created_by
        WHERE l.user_id=$1 AND l.entity_type='meeting'
          AND l.action IN('MEETING_SCHEDULE_APPROVED','MEETING_SCHEDULE_RETURNED','MEETING_SCHEDULE_REJECTED','MEETING_MINUTES_APPROVED','MEETING_MINUTES_RETURNED')
          AND m.id IS NULL

        UNION ALL

        SELECT
          l.id::text id,
          COALESCE(lt.name,l.details->>'leaveTypeName','Leave') || ' leave request' title,
          l.details->>'decision' status,
          l.created_at reviewed_at,
          'Leave' review_context,
          lr.id context_id,
          COALESCE(lt.name,l.details->>'leaveTypeName','Leave') || ' leave request' context_title,
          requester.name owner_name,
          'Leave Request' review_kind
        FROM audit_logs l
        LEFT JOIN leave_requests lr ON lr.id::text=l.entity_id
        LEFT JOIN leave_types lt ON lt.code=lr.leave_type_code
        LEFT JOIN users requester ON requester.id=lr.user_id
        WHERE l.user_id=$1 AND l.entity_type='leave_request' AND l.action='LEAVE_REQUEST_DECIDED'

        UNION ALL

        SELECT
          l.id::text id,
          a.title,
          CASE l.action WHEN 'NOTICE_APPROVED' THEN 'Approved' ELSE 'Rejected' END status,
          l.created_at reviewed_at,
          'Notice' review_context,
          a.id context_id,
          'Notice Board' context_title,
          creator.name owner_name,
          'Notice' review_kind
        FROM audit_logs l
        JOIN alerts a ON a.id::text=l.entity_id
        LEFT JOIN users creator ON creator.id=a.created_by
        WHERE l.user_id=$1 AND l.entity_type='notice' AND l.action IN('NOTICE_APPROVED','NOTICE_REJECTED')

        UNION ALL

        SELECT
          l.id::text id,
          COALESCE(a.title,'Assignment membership request') title,
          CASE l.action WHEN 'ASSIGNMENT_MEMBER_REQUEST_APPROVED' THEN 'Approved' ELSE 'Rejected' END status,
          l.created_at reviewed_at,
          'Assignment' review_context,
          a.id context_id,
          COALESCE(a.title,'Assignment membership request') context_title,
          requester.name owner_name,
          'Assignment Member Request' review_kind
        FROM audit_logs l
        LEFT JOIN assignment_member_requests r ON r.id::text=l.entity_id
        LEFT JOIN assignments a ON a.id=r.assignment_id
        LEFT JOIN users requester ON requester.id=r.requested_by
        WHERE l.user_id=$1 AND l.entity_type='assignment_member_request'
          AND l.action IN('ASSIGNMENT_MEMBER_REQUEST_APPROVED','ASSIGNMENT_MEMBER_REQUEST_REJECTED')

        UNION ALL

        SELECT
          l.id::text id,
          COALESCE(r.title,l.details->>'title','Assignment task request') title,
          CASE l.action WHEN 'ASSIGNMENT_TASK_REQUEST_APPROVED' THEN 'Approved' ELSE 'Rejected' END status,
          l.created_at reviewed_at,
          'Assignments' review_context,
          r.assignment_id context_id,
          COALESCE(a.title,'Assignment task request') context_title,
          requester.name owner_name,
          'Assignment Task Request' review_kind
        FROM audit_logs l
        LEFT JOIN assignment_task_requests r ON r.id::text=l.entity_id
        LEFT JOIN assignments a ON a.id=r.assignment_id
        LEFT JOIN users requester ON requester.id=r.requested_by
        WHERE l.user_id=$1 AND l.entity_type='assignment_task_request'
          AND l.action IN('ASSIGNMENT_TASK_REQUEST_APPROVED','ASSIGNMENT_TASK_REQUEST_REJECTED')

        UNION ALL

        SELECT
          l.id::text id,
          COALESCE(r.title,p.title,'Research assignment request') title,
          l.details->>'decision' status,
          l.created_at reviewed_at,
          'Research' review_context,
          p.id context_id,
          COALESCE(p.title,'Research assignment request') context_title,
          requester.name owner_name,
          'Research Assignment Request' review_kind
        FROM audit_logs l
        LEFT JOIN research_assignment_requests r ON r.id::text=l.entity_id
        LEFT JOIN research_projects p ON p.id=r.project_id
        LEFT JOIN users requester ON requester.id=r.requested_by
        WHERE l.user_id=$1 AND l.entity_type='research_assignment_request' AND l.action='RESEARCH_ASSIGNMENT_REQUEST_DECIDED'

        UNION ALL

        SELECT
          l.id::text id,
          COALESCE(dr.knowledge_title,l.details->>'title','Document deletion request') title,
          CASE l.action WHEN 'DOCUMENT_DELETION_APPROVED' THEN 'Approved' ELSE 'Rejected' END status,
          l.created_at reviewed_at,
          'Knowledge' review_context,
          dr.knowledge_id context_id,
          'Document Repository deletion' context_title,
          requester.name owner_name,
          'Document Deletion Request' review_kind
        FROM audit_logs l
        LEFT JOIN document_deletion_requests dr ON dr.id::text=l.details->>'requestId'
        LEFT JOIN users requester ON requester.id=dr.requested_by
        WHERE l.user_id=$1 AND l.entity_type='knowledge' AND l.action IN('DOCUMENT_DELETION_APPROVED','DOCUMENT_DELETION_REJECTED')

        UNION ALL

        SELECT
          l.id::text id,
          COALESCE(a.title,'Assignment review') title,
          l.details->>'decision' status,
          l.created_at reviewed_at,
          'Assignment' review_context,
          ar.assignment_id context_id,
          COALESCE(a.title,'Assignment review') context_title,
          owner.name owner_name,
          'Assignment Review' review_kind
        FROM audit_logs l
        LEFT JOIN assignment_reviews ar ON ar.id::text=l.entity_id
        LEFT JOIN assignments a ON a.id=ar.assignment_id
        LEFT JOIN users owner ON owner.id=a.created_by
        WHERE l.user_id=$1 AND l.entity_type='assignment_review' AND l.action='ASSIGNMENT_REVIEW_RECORDED'

      ) reviewer_history
      ORDER BY reviewed_at DESC NULLS LAST
    `,[req.user.id])


    const reviewHistory=reviewHistoryRows.rows.map(item=>{
      const destination=
        item.review_context==='Assignment'||item.review_context==='Assignment Task'||item.review_context==='Assignments'
          ?'Assignments'
          :item.review_context==='Research'
            ?'Research Repository'
            :item.review_context==='Leave'
              ?'Leave'
              :item.review_context==='Notice'
                ?'Notice Board'
            :item.review_context==='Meeting'
              ?'Meetings'
            :'Document Repository'

      return {
        id:item.id,
        type:'Review',
        title:item.title,
        status:item.workflow_status||item.status,
        dueDate:null,
        action:['Submitted','Under Review','Revised','Pending Review','Pending Approval'].includes(item.status)
          ?'Review'
          :'View review',
        destination,
        contextId:item.context_id||item.id,
        contextTitle:item.context_title||null,
        reviewKind:item.review_kind||null,
        ownerName:item.owner_name||null,
        updatedAt:item.reviewed_at
      }
    })
    const [notifications,activity,team,repository]=await Promise.all([
      query('SELECT id,title,body,entity_type,entity_id,created_at FROM notifications WHERE user_id=$1 AND read_at IS NULL ORDER BY created_at DESC',[req.user.id]),
      management
        ?query(`SELECT activity.id,activity.title,activity.body,activity.entity_type,activity.entity_id,activity.created_at FROM(
            SELECT n.id::text id,n.title,n.body,n.entity_type,n.entity_id,n.created_at
            FROM notifications n WHERE n.user_id=$3
            UNION ALL
            SELECT ra.id::text id,'Research activity' title,
              p.title||' â€” '||INITCAP(REPLACE(LOWER(ra.action),'_',' ')) body,
              'research' entity_type,p.id::text entity_id,ra.created_at
            FROM research_activity ra JOIN research_projects p ON p.id=ra.project_id
            WHERE ${researchScope}
          ) activity ORDER BY activity.created_at DESC LIMIT 20`,[all,scopeIds,req.user.id])
        :query(`SELECT n.id,n.title,n.body,n.entity_type,n.entity_id,n.created_at FROM notifications n WHERE n.user_id=$1 ORDER BY n.created_at DESC LIMIT 10`,[req.user.id]),
      management?query("SELECT role,COUNT(*)::int count FROM users WHERE active=TRUE AND($1::boolean OR id=ANY($2::uuid[])) AND id<>$3 GROUP BY role ORDER BY role",[all,scopeIds,req.user.id]):Promise.resolve({rows:[]}),
      management?query(`SELECT
        k.*,
        creator.name created_by_name,
        reviewer.name reviewer_name,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'id',r.id,
              'action',r.action,
              'comments',r.comments,
              'created_at',r.created_at,
              'actor_name',actor.name
            )
            ORDER BY r.created_at DESC
          )
          FROM document_reviews r
          JOIN users actor ON actor.id=r.actor_id
          WHERE r.knowledge_id=k.id
        ),'[]') review_history
        FROM knowledge_items k
        JOIN users creator ON creator.id=k.created_by
        LEFT JOIN users reviewer ON reviewer.id=k.reviewer_id
        WHERE k.status IN('Pending Approval','Published')
          AND(
            $1::boolean
            OR k.created_by=ANY($2::uuid[])
            OR k.reviewer_id=ANY($2::uuid[])
            OR k.approved_by=ANY($2::uuid[])
          )
        ORDER BY k.updated_at DESC`,[all,scopeIds]):Promise.resolve({rows:[]})
    ])

    const today=new Date();today.setHours(0,0,0,0)
    const sourceRows=management?[...assignments.rows,...tasks.rows,...research.rows,...milestones.rows,...reviews.rows]:researcher?[...tasks.rows,...research.rows,...reviews.rows]:[...reviews.rows]
    const normalized=sourceRows.map(item=>{
      const reviewDestination=item.review_context==='Assignment'||item.review_context==='Assignment Task'?'Assignments':item.review_context==='Research'?'Research Repository':'Document Repository'
      return {id:item.id,type:item.type,title:item.title,status:item.status,dueDate:item.due_date?(()=>{const date=new Date(item.due_date);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`})():null,nextAction:item.type==='Finalization'?'Generate final report':item.type==='Review'?'Review':item.type==='Task'?'Continue task':item.type==='Research Project'||item.type==='Research Milestone'?'Open research':'Open assignment',destination:(item.type==='Review'||item.type==='Finalization')?reviewDestination:item.type==='Research Project'||item.type==='Research Milestone'?'Research Repository':'Assignments',contextId:(item.type==='Review'||item.type==='Finalization')?(item.context_id||item.id):(item.assignment_id||item.project_id||item.id),contextTitle:item.context_title||null,reviewKind:item.review_kind||null,ownerName:item.owner_name||null,teamName:item.team_name||null,updatedAt:item.updated_at}
    })
    const unique=[...new Map(normalized.map(item=>[`${item.type}:${item.id}`,item])).values()]
    const reviewWork=unique.filter(item=>item.type==='Review'||item.type==='Finalization').sort((a,b)=>{const ad=a.dueDate?new Date(`${a.dueDate}T00:00:00`).getTime():Infinity,bd=b.dueDate?new Date(`${b.dueDate}T00:00:00`).getTime():Infinity;return ad-bd||new Date(b.updatedAt||0).getTime()-new Date(a.updatedAt||0).getTime()})
    const otherWork=unique.filter(item=>item.type!=='Review'&&item.type!=='Finalization').sort((a,b)=>{const ad=a.dueDate?new Date(`${a.dueDate}T00:00:00`).getTime():Infinity,bd=b.dueDate?new Date(`${b.dueDate}T00:00:00`).getTime():Infinity;return ad-bd||new Date(b.updatedAt||0).getTime()-new Date(a.updatedAt||0).getTime()})
    const dashboardWork=[...reviewWork,...otherWork]
    const deadlines=unique.filter(item=>item.dueDate).map(item=>{const date=new Date(`${item.dueDate}T00:00:00`);const days=Math.round((date.getTime()-today.getTime())/86400000);return {...item,days,group:days<0?'Overdue':days===0?'Today':days===1?'Tomorrow':days<=7?'This Week':'Later'}}).sort((a,b)=>a.days-b.days)
    const overdueSource=researcher?[...tasks.rows,...research.rows]:reviewerOnly?reviews.rows.filter(item=>item.type==='Review'):assignments.rows
    const overdue=management
      ? Number(assignmentStats.rows[0]?.overdue||0)+Number(taskStats.rows[0]?.overdue||0)+Number(researchStats.rows[0]?.overdue||0)+Number(milestoneStats.rows[0]?.overdue||0)
      : overdueSource.filter(item=>item.status!=='Completed'&&item.due_date&&new Date(item.due_date)<today).length
    const almostDue=deadlines.filter(item=>item.days>=0&&item.days<=7).length
    const assignmentAttention=researcher?tasks.rows.filter(item=>item.status==='Ready for Review').length:management?assignments.rows.filter(item=>item.status==='Ready for Review').length:0
    const quickActions=req.user.role==='System Admin'?[{label:'Users & Roles',destination:'Team & Users'},{label:'Audit Trail',destination:'Audit Logs'},{label:'System Settings',destination:'Settings'},{label:'Felix Governance',destination:'Felix Administration'},{label:'New Research',destination:'Research Repository'},{label:'Repository Governance',destination:'Document Repository'}]:researcher?[{label:'My Tasks',destination:'Assignments'},{label:'My Research',destination:'Research Repository'},{label:'My Evidence',destination:'Document Repository'},{label:'Notifications',destination:'Notifications'}]:reviewerOnly?[{label:'My Reviews',destination:'Document Repository'},{label:'Review Deadlines',destination:'Calendar'},{label:'Notifications',destination:'Notifications'}]:[{label:'New Assignment',destination:'Assignments'},{label:'New Research',destination:'Research Repository'},{label:'Upload to Repository',destination:'Document Repository'},{label:'Review Queue',destination:'Document Repository'}]
    const scopeType=all?'ORGANISATION':management?'TEAM_SUBTREE':'OWN'
    res.json({generatedAt:new Date().toISOString(),role:req.user.role,scope:{type:scopeType,userId:all?null:req.user.id},attention:{assignments:assignmentAttention,reviews:reviews.rows.filter(item=>item.type==='Review').length,overdue,notifications:notifications.rows.length,almostDue},myWork:dashboardWork.slice(0,20),reviewHistory,deadlines:deadlines.slice(0,20),recentActivity:activity.rows,quickActions,management:management?{scope:{type:scopeType,label:req.user.role==='System Admin'?'System-wide overview':all?'Directorate overview':'My reporting team'},team:{total:team.rows.reduce((sum,row)=>sum+row.count,0),roles:Object.fromEntries(team.rows.map(row=>[row.role,row.count])),workload:teamWorkload.rows},assignments:{active:Number(assignmentStats.rows[0]?.active||0),overdue:Number(assignmentStats.rows[0]?.overdue||0),dueSoon:Number(assignmentStats.rows[0]?.due_soon||0)},tasks:{
      active:Number(taskStats.rows[0]?.active||0),
      overdue:Number(taskStats.rows[0]?.overdue||0),
      dueSoon:Number(taskStats.rows[0]?.due_soon||0),
      awaitingReview:Number(taskStats.rows[0]?.awaiting_review||0)
    },
    research:{
      current:Number(researchStats.rows[0]?.current||0),
      active:Number(researchStats.rows[0]?.active||0),
      planning:Number(researchStats.rows[0]?.planning||0),
      underReview:Number(researchStats.rows[0]?.under_review||0),
      changesRequested:Number(researchStats.rows[0]?.changes_requested||0),
      completed:Number(researchStats.rows[0]?.completed||0),
      readyToPublish:Number(researchStats.rows[0]?.ready_to_publish||0),
      overdue:Number(researchStats.rows[0]?.overdue||0),
      dueSoon:Number(researchStats.rows[0]?.due_soon||0),
      items:research.rows.map(item=>({
        id:item.id,
        type:'Research Project',
        title:item.title,
        status:item.status,
        dueDate:item.due_date||null,
        action:'Open research',
        destination:'Research Repository',
        contextId:item.id,
        contextTitle:item.title,
        reviewKind:null,
        ownerName:item.owner_name||null,
        teamName:item.team_name||null,
        updatedAt:item.updated_at
      })),
      milestones:{
        active:Number(milestoneStats.rows[0]?.active||0),
        overdue:Number(milestoneStats.rows[0]?.overdue||0),
        dueSoon:Number(milestoneStats.rows[0]?.due_soon||0)
      }
    },
    work:{
      overdue:
        Number(assignmentStats.rows[0]?.overdue||0)+
        Number(taskStats.rows[0]?.overdue||0)+
        Number(researchStats.rows[0]?.overdue||0)+
        Number(milestoneStats.rows[0]?.overdue||0),
      dueSoon:
        Number(assignmentStats.rows[0]?.due_soon||0)+
        Number(taskStats.rows[0]?.due_soon||0)+
        Number(researchStats.rows[0]?.due_soon||0)+
        Number(milestoneStats.rows[0]?.due_soon||0)
    },
    // APP2_MANAGEMENT_REVIEWS_PAYLOAD
reviews:{
  pending:teamReviewStatus.rows.length,
  generatedDocuments:teamReviewStatus.rows.filter(item=>item.review_kind==='Generated Document').length,
  researchReports:teamReviewStatus.rows.filter(item=>item.review_kind==='Research Report').length,
  taskReports:teamReviewStatus.rows.filter(item=>item.review_kind==='Task Report').length,
  repositoryDocuments:teamReviewStatus.rows.filter(item=>item.review_kind==='Knowledge').length,
  items:teamReviewStatus.rows
},repository:{
  pendingReview:repository.rows.filter(row=>row.status==='Pending Approval').length,
  published:repository.rows.filter(row=>row.status==='Published').length,
  pendingItems:repository.rows.filter(row=>row.status==='Pending Approval')
}}:null})
  }catch(error){next(error)}
})

app.get('/api/dashboard/completed-work',authenticate,async(req,res,next)=>{
  try{
    if(!isManagementRole(req.user.role))return res.status(403).json({error:'Management access required.'})
    const scoped=await managedUserIds(req.user),all=scoped===null,scopeIds=scoped||[req.user.id]
    const assignmentScope=`($1::boolean OR a.created_by=ANY($2::uuid[]) OR EXISTS(SELECT 1 FROM assignment_members sam WHERE sam.assignment_id=a.id AND sam.user_id=ANY($2::uuid[])) OR EXISTS(SELECT 1 FROM assignment_tasks sat WHERE sat.assignment_id=a.id AND(sat.owner_id=ANY($2::uuid[]) OR sat.reviewer_id=ANY($2::uuid[]))))`
    const researchScope=`($1::boolean OR p.lead_id=ANY($2::uuid[]) OR EXISTS(SELECT 1 FROM research_collaborators src WHERE src.project_id=p.id AND src.user_id=ANY($2::uuid[])) OR EXISTS(SELECT 1 FROM research_reviewers srr WHERE srr.project_id=p.id AND srr.reviewer_id=ANY($2::uuid[]) AND srr.active=TRUE))`
    const results=await Promise.allSettled([
      query(`SELECT a.id,a.title,a.status,a.updated_at completed_at,lead.name lead_name FROM assignments a LEFT JOIN LATERAL(SELECT u.name FROM assignment_members am JOIN users u ON u.id=am.user_id WHERE am.assignment_id=a.id AND am.member_role='Lead' ORDER BY u.name LIMIT 1) lead ON TRUE WHERE a.status='Completed' AND ${assignmentScope} ORDER BY a.updated_at DESC,a.title`,[all,scopeIds]),
      query(`SELECT t.id,t.assignment_id,t.title,t.status,t.updated_at completed_at,a.title assignment_title,owner.name owner_name FROM assignment_tasks t JOIN assignments a ON a.id=t.assignment_id LEFT JOIN users owner ON owner.id=t.owner_id WHERE t.archived_at IS NULL AND t.status='Completed' AND ($1::boolean OR t.owner_id=ANY($2::uuid[]) OR t.reviewer_id=ANY($2::uuid[])) ORDER BY t.updated_at DESC,t.title`,[all,scopeIds]),
      query(`SELECT p.id,p.title,p.status,p.updated_at completed_at,lead.name lead_name FROM research_projects p LEFT JOIN users lead ON lead.id=p.lead_id WHERE p.status='Completed' AND ${researchScope} ORDER BY p.updated_at DESC,p.title`,[all,scopeIds])
    ])
    const rows=results.map(result=>result.status==='fulfilled'?result.value.rows:[])
    res.json({scope:{type:all?'ORGANISATION':'TEAM_SUBTREE'},assignments:rows[0],tasks:rows[1],research:rows[2]})
  }catch(error){next(error)}
})


// APP2_REPOSITORY_OPERATIONAL_GOVERNANCE_V2_3
const syncRepositoryGovernanceNotifications=async(client,userId)=>{
  await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
    SELECT $1,'Repository review due soon',
      'â€œ'||k.title||'â€ is due for governance review on '||TO_CHAR(COALESCE(k.next_review_at,k.review_due_at),'DD Mon YYYY')||'.',
      'knowledge',k.id
    FROM knowledge_items k
    WHERE(k.created_by=$1 OR k.reviewer_id=$1)
      AND COALESCE(k.next_review_at,k.review_due_at) BETWEEN CURRENT_DATE AND CURRENT_DATE+30
      AND NOT EXISTS(
        SELECT 1 FROM notifications n
        WHERE n.user_id=$1 AND n.entity_type='knowledge' AND n.entity_id=k.id::text
          AND n.title='Repository review due soon'
          AND n.body LIKE '%'||TO_CHAR(COALESCE(k.next_review_at,k.review_due_at),'DD Mon YYYY')||'%'
      )`,[userId])

  await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
    SELECT $1,'Repository review overdue',
      'â€œ'||k.title||'â€ was due for governance review on '||TO_CHAR(COALESCE(k.next_review_at,k.review_due_at),'DD Mon YYYY')||'. Action is required.',
      'knowledge',k.id
    FROM knowledge_items k
    WHERE(k.created_by=$1 OR k.reviewer_id=$1)
      AND COALESCE(k.next_review_at,k.review_due_at)<CURRENT_DATE
      AND NOT EXISTS(
        SELECT 1 FROM notifications n
        WHERE n.user_id=$1 AND n.entity_type='knowledge' AND n.entity_id=k.id::text
          AND n.title='Repository review overdue'
          AND n.body LIKE '%'||TO_CHAR(COALESCE(k.next_review_at,k.review_due_at),'DD Mon YYYY')||'%'
      )`,[userId])

  await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
    SELECT $1,'Repository disposition action due',
      'â€œ'||k.title||'â€ has reached its retention/disposition review date.',
      'knowledge',k.id
    FROM knowledge_items k
    WHERE(k.created_by=$1 OR k.reviewer_id=$1)
      AND(k.retention_until<=CURRENT_DATE OR k.records_lifecycle_state='Disposition Review')
      AND NOT EXISTS(
        SELECT 1 FROM notifications n
        WHERE n.user_id=$1 AND n.entity_type='knowledge' AND n.entity_id=k.id::text
          AND n.title='Repository disposition action due'
      )`,[userId])

  await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
    SELECT $1,'Repository improvement overdue',
      'The improvement assignment for â€œ'||k.title||'â€ was due on '||TO_CHAR(i.due_date,'DD Mon YYYY')||'.',
      'knowledge',k.id
    FROM document_improvement_assignments i
    JOIN knowledge_items k ON k.id=i.knowledge_id
    WHERE(i.assignee_id=$1 OR i.reviewer_id=$1)
      AND i.status IN('Assigned','In Progress','Submitted')
      AND i.due_date<CURRENT_DATE
      AND NOT EXISTS(
        SELECT 1 FROM notifications n
        WHERE n.user_id=$1 AND n.entity_type='knowledge' AND n.entity_id=k.id::text
          AND n.title='Repository improvement overdue'
          AND n.body LIKE '%'||TO_CHAR(i.due_date,'DD Mon YYYY')||'%'
      )`,[userId])

  await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id)
    SELECT $1,'Record superseded',
      'â€œ'||k.title||'â€ is now a historical record because a newer approved record supersedes it.',
      'knowledge',k.id
    FROM knowledge_items k
    WHERE(k.created_by=$1 OR k.reviewer_id=$1)
      AND(k.records_lifecycle_state='Superseded' OR k.superseded_by IS NOT NULL)
      AND NOT EXISTS(
        SELECT 1 FROM notifications n
        WHERE n.user_id=$1 AND n.entity_type='knowledge' AND n.entity_id=k.id::text
          AND n.title='Record superseded'
      )`,[userId])
}

const repositoryCalendarForUser=async(user)=>{
  const organisation=isOrganisationScopeRole(user.role)
  const scopedIds=organisation?[]:await managedUserIds(user)
  const ids=scopedIds.length?scopedIds:[user.id]
  const parameters=organisation?[]:[ids]
  const ownerScope=organisation?'TRUE':'(k.created_by=ANY($1::uuid[]) OR k.reviewer_id=ANY($1::uuid[]))'
  const improvementScope=organisation?'TRUE':'(i.assignee_id=ANY($1::uuid[]) OR i.reviewer_id=ANY($1::uuid[]))'

  const [reviews,retention,improvements]=await Promise.all([
    query(`SELECT k.id,k.title,COALESCE(k.next_review_at,k.review_due_at) due_at,k.status
      FROM knowledge_items k
      WHERE COALESCE(k.next_review_at,k.review_due_at) IS NOT NULL AND ${ownerScope}
      ORDER BY due_at`,parameters),
    query(`SELECT k.id,k.title,k.retention_until due_at,k.records_lifecycle_state
      FROM knowledge_items k
      WHERE k.retention_until IS NOT NULL AND ${ownerScope}
      ORDER BY due_at`,parameters),
    query(`SELECT i.id,k.id knowledge_id,k.title,i.due_date due_at,i.status
      FROM document_improvement_assignments i JOIN knowledge_items k ON k.id=i.knowledge_id
      WHERE i.due_date IS NOT NULL AND i.status IN('Assigned','In Progress','Submitted') AND ${improvementScope}
      ORDER BY i.due_date`,parameters)
  ])

  return[
    ...reviews.rows.map(row=>({
      id:`repository-review-${row.id}`,
      title:`Record review: ${row.title}`,
      start_at:new Date(`${String(row.due_at).slice(0,10)}T09:00:00`).toISOString(),
      end_at:null,type:'document_review',status:row.status,entity_id:row.id,
      is_dated_event:true,description:'Repository governance review due.'
    })),
    ...retention.rows.map(row=>({
      id:`repository-retention-${row.id}`,
      title:`Retention / disposition: ${row.title}`,
      start_at:new Date(`${String(row.due_at).slice(0,10)}T09:00:00`).toISOString(),
      end_at:null,type:'document_review',status:row.records_lifecycle_state||'Retention Review',
      entity_id:row.id,is_dated_event:true,description:'Repository retention or disposition action.'
    })),
    ...improvements.rows.map(row=>({
      id:`repository-improvement-${row.id}`,
      title:`Repository improvement due: ${row.title}`,
      start_at:new Date(`${String(row.due_at).slice(0,10)}T09:00:00`).toISOString(),
      end_at:null,type:'document_review',status:row.status,entity_id:row.knowledge_id,
      is_dated_event:true,description:'Governed Repository improvement deadline.'
    }))
  ]
}

app.get('/api/notifications',authenticate,async(req,res,next)=>{
  try{
    const oversightScope=isOperationalOversightRole(req.user.role)?await managedUserIds(req.user):[]
    const directorateWide=req.user.role==='Director'
    await transaction(async client=>{
      await syncResearchNotificationsForUser(client,req.user.id)
      await syncTaskDeadlineNotifications(client,req.user.id)
      await syncRepositoryGovernanceNotifications(client,req.user.id)
      if(isOperationalOversightRole(req.user.role)){
        await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id,priority,action,target_workspace,notification_category,email_eligible,next_email_attempt_at)
          SELECT $1,'Task request awaiting approval',requester.name||' has a pending task request for "'||a.title||'": '||r.title||'.','assignment_task_request',r.id,'High','Open task request','Tasks','Review',FALSE,NULL
          FROM assignment_task_requests r
          JOIN assignments a ON a.id=r.assignment_id
          JOIN users requester ON requester.id=r.requested_by
          WHERE r.status='Pending' AND r.requested_by<>$1
            AND($2::boolean OR r.requested_by=ANY($3::uuid[]))
            AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=$1 AND n.entity_type='assignment_task_request' AND n.entity_id=r.id::text AND n.title='Task request awaiting approval')`,[req.user.id,directorateWide,oversightScope||[]])
        await client.query(`INSERT INTO notifications(user_id,title,body,entity_type,entity_id,priority,action,target_workspace,notification_category,email_eligible,next_email_attempt_at)
          SELECT $1,'Assignment team request awaiting approval',requester.name||' has a pending team-member request for "'||a.title||'".','assignment_member_request',r.id,'High','Open team request','Assignments','Review',FALSE,NULL
          FROM assignment_member_requests r
          JOIN assignments a ON a.id=r.assignment_id
          JOIN users requester ON requester.id=r.requested_by
          WHERE r.status='Pending' AND r.requested_by<>$1
            AND($2::boolean OR r.requested_by=ANY($3::uuid[]))
            AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=$1 AND n.entity_type='assignment_member_request' AND n.entity_id=r.id::text AND n.title='Assignment team request awaiting approval')`,[req.user.id,directorateWide,oversightScope||[]])
      }
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT am.user_id,'Assigned task','You are assigned to Ã¢â‚¬Å“'||a.title||'Ã¢â‚¬Â ('||a.status||')'||CASE WHEN a.due_date IS NOT NULL THEN ', due '||TO_CHAR(a.due_date,'DD Mon YYYY') ELSE '' END||'.','assignment',a.id FROM assignments a JOIN assignment_members am ON am.assignment_id=a.id WHERE am.user_id=$1 AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=am.user_id AND n.entity_id=a.id::text AND n.title IN('Assigned task','New assignment','Assignment allocated'))",[req.user.id])
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT am.user_id,'Assignment status update','Ã¢â‚¬Å“'||a.title||'Ã¢â‚¬Â is now '||a.status||'.','assignment_status',a.id FROM assignments a JOIN assignment_members am ON am.assignment_id=a.id WHERE am.user_id=$1 AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=am.user_id AND n.entity_id=a.id::text AND n.title='Assignment status update' AND n.body='Ã¢â‚¬Å“'||a.title||'Ã¢â‚¬Â is now '||a.status||'.')",[req.user.id])
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT am.user_id,'Assignment completed','Ã¢â‚¬Å“'||a.title||'Ã¢â‚¬Â has been completed and retained in your activity history.','assignment_completed',a.id FROM assignments a JOIN assignment_members am ON am.assignment_id=a.id WHERE am.user_id=$1 AND a.status='Completed' AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=am.user_id AND n.entity_id=a.id::text AND n.title='Assignment completed')",[req.user.id])
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT am.user_id,'Assignment due soon','Ã¢â‚¬Å“'||a.title||'Ã¢â‚¬Â is due on '||TO_CHAR(a.due_date,'DD Mon YYYY')||'. Please review and update its progress.','assignment_due',a.id FROM assignments a JOIN assignment_members am ON am.assignment_id=a.id WHERE am.user_id=$1 AND a.status NOT IN('Completed','Overdue') AND a.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+2 AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=am.user_id AND n.entity_id=a.id::text AND n.title='Assignment due soon' AND n.body LIKE '%'||TO_CHAR(a.due_date,'DD Mon YYYY')||'%')",[req.user.id])
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT am.user_id,'Assignment overdue','Ã¢â‚¬Å“'||a.title||'Ã¢â‚¬Â was due on '||TO_CHAR(a.due_date,'DD Mon YYYY')||'. Immediate action is required.','assignment_overdue',a.id FROM assignments a JOIN assignment_members am ON am.assignment_id=a.id WHERE am.user_id=$1 AND a.status!='Completed' AND a.due_date<CURRENT_DATE AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=am.user_id AND n.entity_id=a.id::text AND n.title='Assignment overdue' AND n.body LIKE '%'||TO_CHAR(a.due_date,'DD Mon YYYY')||'%')",[req.user.id])
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) SELECT $1,'Previously approved notice','Ã¢â‚¬Å“'||a.title||'Ã¢â‚¬Â was approved and published on the Notice Board.','notice',a.id FROM alerts a WHERE a.status='Published' AND(a.audience_role IS NULL OR a.audience_role=$2) AND(a.expires_at IS NULL OR a.expires_at>NOW()) AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=$1 AND n.entity_type='notice' AND n.entity_id=a.id::text)",[req.user.id,req.user.role])
    })
    await syncImportantNotificationReminders()
    void deliverPendingNotificationEmails().catch(error=>console.error('Notification email delivery failed:',error?.message||error))
    res.json(await visibleNotifications(req.user))
  }catch(error){next(error)}
})
app.patch('/api/notifications/:id/read',authenticate,async(req,res,next)=>{try{const row=(await query('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=$1 AND user_id=$2 RETURNING *',[req.params.id,req.user.id])).rows[0];if(!row)return res.status(404).json({error:'Notification not found.'});res.json(row)}catch(error){next(error)}})
app.patch('/api/notifications/:id/state',authenticate,validate(z.object({read:z.boolean().optional(),important:z.boolean().optional(),archived:z.boolean().optional()}).refine(value=>Object.keys(value).length>0,{message:'Choose at least one notification state to update.'})),async(req,res,next)=>{try{
  const {read,important,archived}=req.validated
  const row=(await query(`UPDATE notifications SET
    read_at=CASE WHEN $1::boolean IS NULL THEN read_at WHEN $1 THEN COALESCE(read_at,NOW()) ELSE NULL END,
    important_at=CASE WHEN $2::boolean IS NULL THEN important_at WHEN $2 THEN COALESCE(important_at,NOW()) ELSE NULL END,
    archived_at=CASE WHEN $3::boolean IS NULL THEN archived_at WHEN $3 THEN COALESCE(archived_at,NOW()) ELSE NULL END
    WHERE id=$4 AND user_id=$5 RETURNING *`,[read??null,important??null,archived??null,req.params.id,req.user.id])).rows[0]
  if(!row)return res.status(404).json({error:'Notification not found.'})
  res.json(row)
}catch(error){next(error)}})
app.patch('/api/notifications/read-all',authenticate,async(req,res,next)=>{try{const result=await query('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=$1 AND read_at IS NULL',[req.user.id]);res.json({updated:result.rowCount})}catch(error){next(error)}})
app.patch('/api/notifications/archive-read',authenticate,async(req,res,next)=>{try{const result=await query('UPDATE notifications SET archived_at=COALESCE(archived_at,NOW()) WHERE user_id=$1 AND read_at IS NOT NULL AND archived_at IS NULL',[req.user.id]);res.json({updated:result.rowCount})}catch(error){next(error)}})
app.delete('/api/notifications/read',authenticate,async(req,res,next)=>{try{const result=await query('DELETE FROM notifications WHERE user_id=$1 AND read_at IS NOT NULL',[req.user.id]);res.json({deleted:result.rowCount})}catch(error){next(error)}})
app.get('/api/document-deletion-requests',authenticate,async(req,res,next)=>{try{const scoped=isTeamScopeRole(req.user.role)?await managedUserIds(req.user):[];const all=isOrganisationScopeRole(req.user.role);res.json((await query(`SELECT dr.*,requester.name requested_by_name,reviewer.name reviewed_by_name FROM document_deletion_requests dr JOIN users requester ON requester.id=dr.requested_by LEFT JOIN users reviewer ON reviewer.id=dr.reviewed_by LEFT JOIN knowledge_items k ON k.id=dr.knowledge_id WHERE $1 OR dr.requested_by=$2 OR($3::boolean AND(k.created_by=ANY($4::uuid[]) OR k.reviewer_id=ANY($4::uuid[]) OR k.approved_by=ANY($4::uuid[]))) ORDER BY CASE dr.status WHEN 'Pending' THEN 0 ELSE 1 END,dr.created_at DESC`,[all,req.user.id,isTeamScopeRole(req.user.role),scoped])).rows)}catch(error){next(error)}})

app.post('/api/documents/:id/deletion-requests',authenticate,validate(z.object({reason:z.string().min(5).max(2000)})),async(req,res,next)=>{try{if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot request deletion of this document.'});const created=await transaction(async client=>{const item=(await client.query('SELECT id,title,status FROM knowledge_items WHERE id=$1',[req.params.id])).rows[0];if(!item)return null;const row=(await client.query('INSERT INTO document_deletion_requests(knowledge_id,knowledge_title,requested_by,reason)VALUES($1,$2,$3,$4)RETURNING *',[item.id,item.title,req.user.id,req.validated.reason.trim()])).rows[0];await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)SELECT id,'Document deletion approval required',$1,'document_deletion_request',$2 FROM users WHERE active=TRUE AND role IN('System Admin','Deputy Director') AND id<>$3",[`Deletion has been requested for Ã¢â‚¬Å“${item.title}Ã¢â‚¬Â: ${req.validated.reason.trim()}`,row.id,req.user.id]);await audit(client,req.user.id,'DOCUMENT_DELETION_REQUESTED','knowledge',item.id,{requestId:row.id,title:item.title,reason:req.validated.reason.trim()});return row});if(!created)return res.status(404).json({error:'Document not found.'});res.status(201).json(created)}catch(error){if(error.code==='23505')return res.status(409).json({error:'A deletion request is already awaiting a manager decision for this document.'});next(error)}})

app.post('/api/document-deletion-requests/:id/decision',authenticate,authorize('System Admin','Deputy Director'),validate(z.object({approved:z.boolean(),comments:z.string().max(2000).default('')})),async(req,res,next)=>{try{const target=(await query('SELECT knowledge_id FROM document_deletion_requests WHERE id=$1',[req.params.id])).rows[0];if(!target)return res.status(404).json({error:'Deletion request not found.'});if(target.knowledge_id&&!await isKnowledgeManagerFor(req.user,target.knowledge_id))return res.status(403).json({error:'This deletion request is outside your management scope.'});const result=await transaction(async client=>{const request=(await client.query('SELECT dr.*,k.id document_id,k.title document_title FROM document_deletion_requests dr LEFT JOIN knowledge_items k ON k.id=dr.knowledge_id WHERE dr.id=$1 FOR UPDATE OF dr',[req.params.id])).rows[0];if(!request)return {kind:'missing'};if(request.status!=='Pending')return {kind:'conflict'};if(!req.validated.approved){const row=(await client.query("UPDATE document_deletion_requests SET status='Rejected',reviewed_by=$1,review_comments=$2,reviewed_at=NOW()WHERE id=$3 RETURNING *",[req.user.id,req.validated.comments.trim(),request.id])).rows[0];await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Document deletion rejected',$2,'document_deletion_request',$3)",[request.requested_by,`Your request to delete Ã¢â‚¬Å“${request.knowledge_title}Ã¢â‚¬Â was rejected${req.validated.comments.trim()?`: ${req.validated.comments.trim()}`:'.'}`,request.id]);await audit(client,req.user.id,'DOCUMENT_DELETION_REJECTED','knowledge',request.knowledge_id,{requestId:request.id,comments:req.validated.comments});return {kind:'rejected',row,files:[]}}
      if(!request.document_id)return {kind:'missing-document'};const files=(await client.query('SELECT stored_name FROM knowledge_versions WHERE knowledge_id=$1',[request.document_id])).rows;await client.query("UPDATE document_deletion_requests SET status='Approved',reviewed_by=$1,review_comments=$2,reviewed_at=NOW()WHERE id=$3",[req.user.id,req.validated.comments.trim(),request.id]);await audit(client,req.user.id,'DOCUMENT_DELETION_APPROVED','knowledge',request.document_id,{requestId:request.id,title:request.knowledge_title,versions:files.length,comments:req.validated.comments});await client.query('DELETE FROM knowledge_items WHERE id=$1',[request.document_id]);await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Document deletion approved',$2,'document_deletion_request',$3)",[request.requested_by,`Ã¢â‚¬Å“${request.knowledge_title}Ã¢â‚¬Â and all stored versions were deleted after manager approval.`,request.id]);return {kind:'approved',row:{...request,status:'Approved'},files}});if(result.kind==='missing')return res.status(404).json({error:'Deletion request not found.'});if(result.kind==='conflict')return res.status(409).json({error:'This deletion request has already been decided.'});if(result.kind==='missing-document')return res.status(409).json({error:'The document is already unavailable.'});if(result.kind==='approved')await Promise.all(result.files.map(file=>fs.unlink(path.resolve(config.uploadDir,file.stored_name)).catch(()=>{})));res.json(result.row)}catch(error){next(error)}})

app.get('/api/repository/origins',authenticate,async(req,res,next)=>{try{
  const management=isManagementRole(req.user.role)
  const scoped=management?await managedUserIds(req.user):[req.user.id]
  const all=scoped===null
  const ids=scoped||[req.user.id]
  const rows=(await query(`SELECT id,title,type FROM(
    SELECT a.id,a.title,'Assignment' type FROM assignments a WHERE $1::boolean OR a.created_by=ANY($2::uuid[]) OR EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=a.id AND am.user_id=ANY($2::uuid[])) OR EXISTS(SELECT 1 FROM assignment_tasks t WHERE t.assignment_id=a.id AND(t.owner_id=ANY($2::uuid[]) OR t.reviewer_id=ANY($2::uuid[])))
    UNION ALL SELECT t.id,t.title,'Task' type FROM assignment_tasks t JOIN assignments a ON a.id=t.assignment_id WHERE t.archived_at IS NULL AND($1::boolean OR t.owner_id=ANY($2::uuid[]) OR t.reviewer_id=ANY($2::uuid[]) OR a.created_by=ANY($2::uuid[]) OR EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=a.id AND am.user_id=ANY($2::uuid[])))
    UNION ALL SELECT p.id,p.title,'Research' type FROM research_projects p WHERE $1::boolean OR p.lead_id=ANY($2::uuid[]) OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=p.id AND rc.user_id=ANY($2::uuid[])) OR EXISTS(SELECT 1 FROM research_reviewers rr WHERE rr.project_id=p.id AND rr.reviewer_id=ANY($2::uuid[]) AND rr.active=TRUE)
    UNION ALL SELECT gd.id,gd.title,'App2 Report' type FROM generated_documents gd WHERE $1::boolean OR gd.created_by=ANY($2::uuid[]) OR gd.reviewer_id=ANY($2::uuid[])
  )origins ORDER BY type,title`,[all,ids])).rows
  res.json(rows)
}catch(error){next(error)}})

app.get('/api/repository/groups',authenticate,async(req,res,next)=>{try{
  const domain=z.enum(['Research','Assignment','Task','Other']).optional().parse(req.query.domain||undefined)
  const scoped=canManageKnowledge(req.user)?await managedUserIds(req.user):[req.user.id]
  const all=scoped===null
  const scopeIds=scoped||[req.user.id]
  const privateDraftScopeIds=isManagementRole(req.user.role)?await privateDraftSupervisedUserIds(req.user.id):[]
  const rows=(await query(`WITH accessible AS(
    SELECT k.* FROM knowledge_items k WHERE(
      k.status='Published' OR k.created_by=$1 OR k.reviewer_id=$1 OR $2::boolean
      OR k.created_by=ANY($3::uuid[]) OR k.reviewer_id=ANY($3::uuid[]) OR k.approved_by=ANY($3::uuid[])
    )AND(NOT(k.status='Draft' AND k.document_type IN('Assignment Draft','Task Draft','Task Report Draft','Assignment Report Draft','Meeting Minutes Draft'))
      OR k.created_by=$1 OR k.created_by=ANY($4::uuid[]))
  ),canonical AS(
    SELECT k.*,COALESCE(origin.entity_type,
      CASE k.source_type WHEN 'Research' THEN 'research' WHEN 'Assignment' THEN 'assignment' WHEN 'Task' THEN 'task' ELSE 'other' END) entity_type,
      origin.entity_id
    FROM accessible k
    LEFT JOIN LATERAL(
      SELECT rel.entity_type,rel.entity_id FROM repository_entity_links rel WHERE rel.knowledge_id=k.id
      ORDER BY CASE
        WHEN lower(rel.entity_type)=lower(k.source_type) THEN 0
        WHEN rel.entity_type='research' THEN 1 WHEN rel.entity_type='assignment' THEN 2
        WHEN rel.entity_type='task' THEN 3 ELSE 4 END,rel.created_at LIMIT 1
    )origin ON TRUE
  ),labelled AS(
    SELECT c.*,
      CASE c.entity_type WHEN 'research' THEN 'Research' WHEN 'assignment' THEN 'Assignment' WHEN 'task' THEN 'Task' ELSE 'Other' END domain,
      CASE c.entity_type
        WHEN 'research' THEN COALESCE((SELECT p.title FROM research_projects p WHERE p.id=c.entity_id),'Unlinked Research')
        WHEN 'assignment' THEN COALESCE((SELECT a.title FROM assignments a WHERE a.id=c.entity_id),'Unlinked Assignment')
        WHEN 'task' THEN COALESCE((SELECT t.title FROM assignment_tasks t WHERE t.id=c.entity_id),'Unlinked Task')
        ELSE 'Other / Uploaded Documents' END work_title,
      CASE c.entity_type
        WHEN 'research' THEN (SELECT u.name FROM research_projects p JOIN users u ON u.id=p.lead_id WHERE p.id=c.entity_id)
        WHEN 'assignment' THEN (SELECT u.name FROM assignment_members am JOIN users u ON u.id=am.user_id WHERE am.assignment_id=c.entity_id AND am.member_role='Lead' LIMIT 1)
        WHEN 'task' THEN (SELECT u.name FROM assignment_tasks t LEFT JOIN users u ON u.id=t.owner_id WHERE t.id=c.entity_id)
        ELSE NULL END owner_name
    FROM canonical c
  )
  SELECT domain,COALESCE(entity_id::text,'other') group_id,work_title,MAX(owner_name) owner_name,
    COUNT(*)::int document_count,MAX(current_version)::int latest_version,MAX(updated_at) latest_activity,
    BOOL_OR(document_type IN('Research Final Report','Assignment Final Report','Task Final Report') AND status='Published') final_report_available,
    json_agg(json_build_object('id',id,'title',title,'document_type',document_type,'status',status,'classification',classification,
      'current_version',current_version,'updated_at',updated_at,'created_by',created_by,'reviewer_id',reviewer_id,'approved_by',approved_by,
      'approved_at',approved_at,'source_type',source_type) ORDER BY
      CASE WHEN document_type IN('Research Final Report','Assignment Final Report','Task Final Report') AND status='Published' THEN 0 ELSE 1 END,updated_at DESC) documents
  FROM labelled WHERE($5::text IS NULL OR domain=$5)
  GROUP BY domain,entity_id,work_title
  ORDER BY CASE domain WHEN 'Research' THEN 1 WHEN 'Assignment' THEN 2 WHEN 'Task' THEN 3 ELSE 4 END,latest_activity DESC`,
    [req.user.id,all,scopeIds,privateDraftScopeIds,domain||null])).rows
  res.set('Cache-Control','no-store')
  res.json(rows)
}catch(error){next(error)}})

app.get('/api/documents',authenticate,async(req,res,next)=>{try{const scoped=canManageKnowledge(req.user)?await managedUserIds(req.user):[req.user.id],all=scoped===null,scopeIds=scoped||[req.user.id],privateDraftScopeIds=isManagementRole(req.user.role)?await privateDraftSupervisedUserIds(req.user.id):[];const documents=(await query(`SELECT k.*,u.name created_by_name,reviewer.name reviewer_name,reviewed.name reviewed_by_name,approver.name approved_by_name,l.locked_at,l.expires_at,lu.name locked_by_name,fj.status felix_index_status,fj.attempts felix_index_attempts,fj.last_error felix_index_error,fj.updated_at felix_index_updated_at,dap.reader_scope protection_scope,
COALESCE((SELECT json_agg(json_build_object('type',rel.entity_type,'id',rel.entity_id,'title',CASE rel.entity_type WHEN 'assignment' THEN(SELECT title FROM assignments WHERE id=rel.entity_id)WHEN 'task' THEN(SELECT title FROM assignment_tasks WHERE id=rel.entity_id)WHEN 'research' THEN(SELECT title FROM research_projects WHERE id=rel.entity_id)WHEN 'report' THEN(SELECT title FROM generated_documents WHERE id=rel.entity_id)END))FROM repository_entity_links rel WHERE rel.knowledge_id=k.id),'[]') origin_links,
COALESCE((SELECT json_agg(DISTINCT person.name)FROM repository_entity_links rel JOIN LATERAL(SELECT usr.name FROM users usr WHERE(rel.entity_type='assignment' AND EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=rel.entity_id AND am.user_id=usr.id))OR(rel.entity_type='task' AND EXISTS(SELECT 1 FROM assignment_tasks task WHERE task.id=rel.entity_id AND task.owner_id=usr.id))OR(rel.entity_type='research' AND(EXISTS(SELECT 1 FROM research_projects rp WHERE rp.id=rel.entity_id AND rp.lead_id=usr.id)OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=rel.entity_id AND rc.user_id=usr.id)))OR(rel.entity_type='report' AND EXISTS(SELECT 1 FROM generated_documents gd WHERE gd.id=rel.entity_id AND gd.created_by=usr.id)))person ON TRUE WHERE rel.knowledge_id=k.id),'[]') worked_by
FROM knowledge_items k JOIN users u ON u.id=k.created_by LEFT JOIN users reviewer ON reviewer.id=k.reviewer_id LEFT JOIN users reviewed ON reviewed.id=k.reviewed_by LEFT JOIN users approver ON approver.id=k.approved_by LEFT JOIN document_locks l ON l.knowledge_id=k.id AND l.expires_at>NOW() LEFT JOIN users lu ON lu.id=l.locked_by LEFT JOIN document_access_policies dap ON dap.knowledge_id=k.id LEFT JOIN LATERAL(SELECT status,attempts,last_error,updated_at FROM felix_document_index_jobs WHERE knowledge_id=k.id AND version_number=k.current_version ORDER BY id DESC LIMIT 1)fj ON TRUE WHERE(
  k.status='Published' OR
  k.created_by=$1 OR
  k.reviewer_id=$1 OR
  $2::boolean OR
  k.created_by=ANY($3::uuid[]) OR
  k.reviewer_id=ANY($3::uuid[]) OR
  k.approved_by=ANY($3::uuid[])
) AND(
  NOT(
    k.status='Draft' AND
    k.document_type IN('Assignment Draft','Task Draft','Task Report Draft','Assignment Report Draft','Meeting Minutes Draft')
  )
  OR k.created_by=$1
  OR k.created_by=ANY($4::uuid[])
) ORDER BY k.updated_at DESC`,[req.user.id,all,scopeIds,privateDraftScopeIds])).rows;const visible=[];for(const item of documents)if(await canReadKnowledge(req.user,item.id))visible.push(item);res.json(visible)}catch(error){next(error)}})
app.get('/api/document-categories',authenticate,async(_req,res,next)=>{try{res.json((await query('SELECT id,name,description,parent_id,is_active FROM document_categories WHERE is_active=TRUE ORDER BY name')).rows)}catch(error){next(error)}})
app.post('/api/document-categories',authenticate,authorize('System Admin','Deputy Director'),validate(z.object({name:z.string().trim().min(2).max(120),description:z.string().max(2000).default(''),parentId:z.string().uuid().nullable().default(null)})),async(req,res,next)=>{try{if(!isOrganisationScopeRole(req.user.role))return res.status(403).json({error:'Repository category governance is Directorate-level and is outside team-manager scope.'});const row=(await query('INSERT INTO document_categories(name,description,parent_id)VALUES($1,$2,$3)RETURNING *',[req.validated.name,req.validated.description,req.validated.parentId])).rows[0];res.status(201).json(row)}catch(error){if(error.code==='23505')return res.status(409).json({error:'That category already exists.'});next(error)}})
app.get('/api/document-tags',authenticate,async(_req,res,next)=>{try{res.json((await query('SELECT id,name FROM document_tags ORDER BY normalized_name')).rows)}catch(error){next(error)}})
app.post('/api/document-tags',authenticate,validate(z.object({name:z.string().trim().min(1).max(60)})),async(req,res,next)=>{try{res.status(201).json((await query('INSERT INTO document_tags(name,normalized_name,created_by)VALUES($1,lower($1),$2)ON CONFLICT(normalized_name)DO UPDATE SET name=EXCLUDED.name RETURNING id,name',[req.validated.name,req.user.id])).rows[0])}catch(error){next(error)}})
app.get('/api/documents/:id',authenticate,async(req,res,next)=>{try{if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot view this document.'});const document=(await query(`SELECT k.*,c.name category_name,creator.name created_by_name,reviewer.name reviewer_name,reviewed.name reviewed_by_name,approver.name approved_by_name,
 COALESCE((SELECT json_agg(json_build_object('id',t.id,'name',t.name)ORDER BY t.name)FROM document_tag_links l JOIN document_tags t ON t.id=l.tag_id WHERE l.knowledge_id=k.id),'[]') normalized_tags,
 COALESCE((SELECT json_agg(json_build_object('id',v.id,'version_number',v.version_number,'original_filename',v.original_name,'mime_type',v.mime_type,'file_size',v.size_bytes,'sha256_hash',v.sha256_hash,'is_current',v.is_current,'approved_at',v.approved_at,'uploaded_at',v.created_at,'change_notes',v.notes,'uploaded_by',u.name)ORDER BY v.version_number DESC)FROM knowledge_versions v JOIN users u ON u.id=v.uploader_id WHERE v.knowledge_id=k.id),'[]') versions
 FROM knowledge_items k LEFT JOIN document_categories c ON c.id=k.category_id JOIN users creator ON creator.id=k.created_by LEFT JOIN users reviewer ON reviewer.id=k.reviewer_id LEFT JOIN users reviewed ON reviewed.id=k.reviewed_by LEFT JOIN users approver ON approver.id=k.approved_by WHERE k.id=$1`,[req.params.id])).rows[0];if(!document)return res.status(404).json({error:'Document not found.'});res.json(document)}catch(error){next(error)}})
const readerHeaders=res=>res.set({'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'self'; sandbox allow-same-origin",'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'})
const loadReaderVersion=async(documentId,versionId=null)=>(await query(`SELECT v.*,k.title,k.description,k.category,k.directorate,k.author,k.subject,k.document_type,k.document_date,k.current_version,k.status,k.classification,k.tags,k.created_at document_created_at,u.name uploaded_by,
  report_control.reference report_reference,report_control.report_title,report_control.report_version,report_control.report_status,report_control.report_classification,report_control.assignment_title,report_control.prepared_by,report_control.reviewer_name
  FROM knowledge_versions v JOIN knowledge_items k ON k.id=v.knowledge_id JOIN users u ON u.id=v.uploader_id
  LEFT JOIN LATERAL(SELECT gd.reference,gd.title report_title,gd.version report_version,gd.status report_status,gd.classification report_classification,assignment.title assignment_title,creator.name prepared_by,reviewer.name reviewer_name
    FROM repository_entity_links rel JOIN generated_documents gd ON gd.id=rel.entity_id AND rel.entity_type='report'
    LEFT JOIN assignments assignment ON gd.context='Assignment' AND assignment.id=gd.context_id
    JOIN users creator ON creator.id=gd.created_by LEFT JOIN users reviewer ON reviewer.id=gd.reviewer_id
    WHERE rel.knowledge_id=k.id ORDER BY rel.created_at DESC LIMIT 1) report_control ON TRUE
  WHERE k.id=$1 AND($2::uuid IS NULL AND v.is_current=TRUE OR v.id=$2::uuid)`,[documentId,versionId])).rows[0]
const serveDocumentReader=async(req,res,next)=>{try{
  if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot read this document.'})
  const version=await loadReaderVersion(req.params.id,req.params.versionId||null)
  if(!version)return res.status(404).json({error:'Document version not found.'})
  const rendered=await renderReadableVersion(version)
  if(!req.headers.range)await query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)VALUES($1,'DOCUMENT_VIEWED','knowledge',$2,$3)",[req.user.id,req.params.id,JSON.stringify({versionId:version.id,version:version.version_number,historical:!version.is_current})]).catch(()=>{})
  const metadata={
    documentId:req.params.id,versionId:version.id,title:version.title,description:version.description,
    category:version.category,directorate:version.directorate,author:version.author,
    documentDate:version.document_date,version:version.version_number,isCurrent:version.is_current,
    status:version.status,classification:version.classification,tags:version.tags,
    uploadedBy:version.uploaded_by,uploadedAt:version.created_at,
    reportReference:version.report_reference||null,reportTitle:version.report_title||null,
    assignmentTitle:version.assignment_title||version.subject||null,
    preparedBy:version.prepared_by||version.author||version.uploaded_by||null,
    reviewer:version.reviewer_name||null,reportVersion:version.report_version||null,
    reportStatus:version.report_status||version.status,reportClassification:version.report_classification||version.classification,
    canDownload:await canDownloadKnowledge(req.user,req.params.id),
    canCopy:await documentProtectionCapability(req.user,req.params.id,'copy'),
    canPrint:await documentProtectionCapability(req.user,req.params.id,'print')
  }
  readerHeaders(res)
  if(rendered.format!=='pdf')return res.json({...rendered,metadata})
  const stat=await fs.stat(rendered.filePath)
  const range=req.headers.range
  res.set({'Content-Type':'application/pdf','Accept-Ranges':'bytes','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(version.original_name)}`})
  if(range){const match=/bytes=(\d*)-(\d*)/.exec(String(range));if(!match)return res.status(416).set('Content-Range',`bytes */${stat.size}`).end();const start=match[1]?Number(match[1]):0;const end=match[2]?Math.min(Number(match[2]),stat.size-1):stat.size-1;if(start>end||start>=stat.size)return res.status(416).set('Content-Range',`bytes */${stat.size}`).end();res.status(206).set({'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':String(end-start+1)});return createReadStream(rendered.filePath,{start,end}).pipe(res)}
  res.set('Content-Length',String(stat.size));createReadStream(rendered.filePath).pipe(res)
}catch(error){if(error.code==='ENOENT')return res.status(404).json({error:'The stored document file is missing.'});next(error)}}

app.post('/api/reader-copy-events',authenticate,validate(z.object({
  entityType:z.enum(['knowledge','generated_document','assignment_task']),
  entityId:z.string().uuid(),
  source:z.string().min(2).max(120),
  characters:z.number().int().min(1).max(1000000)
})),async(req,res,next)=>{try{
  const v=req.validated
  let assignmentId=null

  if(v.entityType==='knowledge'){
    if(!await canReadKnowledge(req.user,v.entityId)||!await documentProtectionCapability(req.user,v.entityId,'copy'))
      return res.status(403).json({error:'Copying is disabled for this protected document.'})
  }

  if(v.entityType==='generated_document'){
    const document=(await query('SELECT id,context,context_id FROM generated_documents WHERE id=$1',[v.entityId])).rows[0]
    if(!document)return res.status(404).json({error:'Preview document not found.'})
    if(document.context==='Assignment'){
      if(!await canAccessAssignment(req.user,document.context_id))return res.status(403).json({error:'You cannot copy content from this report.'})
      assignmentId=document.context_id
    }
  }

  if(v.entityType==='assignment_task'){
    const task=(await query('SELECT id,assignment_id,owner_id,reviewer_id FROM assignment_tasks WHERE id=$1 AND archived_at IS NULL',[v.entityId])).rows[0]
    if(!task)return res.status(404).json({error:'Task preview not found.'})
    const scope=await assignmentTaskScope(req.user,task.assignment_id)
    const permitted=Boolean(
      scope.all ||
      scope.userIds?.includes(task.owner_id) ||
      scope.userIds?.includes(task.reviewer_id)
    )
    if(!permitted)return res.status(403).json({error:'You cannot copy content from this task preview.'})
    assignmentId=task.assignment_id
  }

  await transaction(async client=>{
    await audit(client,req.user.id,'CONTENT_COPIED',v.entityType,v.entityId,{
      source:v.source,
      characters:v.characters
    })

    if(assignmentId){
      await client.query(
        'INSERT INTO assignment_history(assignment_id,user_id,action,details)VALUES($1,$2,$3,$4)',
        [assignmentId,req.user.id,'CONTENT_COPIED',JSON.stringify({
          entityType:v.entityType,
          entityId:v.entityId,
          source:v.source,
          characters:v.characters
        })]
      )
    }
  })

  res.json({logged:true})
}catch(error){next(error)}})

app.get('/api/documents/:id/reader',authenticate,serveDocumentReader)
app.get('/api/documents/:id/versions/:versionId/reader',authenticate,serveDocumentReader)
app.get('/api/documents/:id/preview',authenticate,async(req,res,next)=>{try{
  if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot preview this document.'})
  const version=(await query('SELECT v.* FROM knowledge_versions v JOIN knowledge_items k ON k.id=v.knowledge_id WHERE k.id=$1 AND v.is_current=TRUE',[req.params.id])).rows[0]
  if(!version)return res.status(404).json({error:'Current document version not found.'})
  await query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)VALUES($1,'DOCUMENT_VIEWED','knowledge',$2,$3)",[req.user.id,req.params.id,JSON.stringify({versionId:version.id,version:version.version_number,source:'preview'})]).catch(()=>{})
  readerHeaders(res)
  const file=resolveDocumentPath(version.storage_path||version.stored_name)
  if(['text/plain','text/markdown'].includes(version.mime_type)){const content=await fs.readFile(file,'utf8');return res.type('text/plain').send(content.slice(0,2_000_000))}
  if(version.mime_type==='application/pdf'){res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(version.original_name)}`);return res.type('application/pdf').sendFile(file)}
  const extracted=(await query('SELECT extracted_text,extraction_status FROM document_text_content WHERE version_id=$1',[version.id])).rows[0]
  res.json({type:'extracted-text',content:extracted?.extracted_text||'',status:extracted?.extraction_status||'Pending',filename:version.original_name})
}catch(error){next(error)}})
app.get('/api/documents/:id/download',authenticate,async(req,res,next)=>{try{const version=(await query('SELECT id,original_name FROM knowledge_versions WHERE knowledge_id=$1 AND is_current=TRUE',[req.params.id])).rows[0];if(!version)return res.status(404).json({error:'Current document version not found.'});req.params.versionId=version.id;res.redirect(307,`/api/knowledge/versions/${version.id}/download`)}catch(error){next(error)}})
const documentWorkflow=(status,action)=>async(req,res,next)=>{try{const item=(await query('SELECT * FROM knowledge_items WHERE id=$1',[req.params.id])).rows[0];if(!item)return res.status(404).json({error:'Document not found.'});if(isPrivateRepositoryDraft(item)&&!await canAccessPrivateRepositoryDraft(req.user,item))return res.status(403).json({error:'This private draft is limited to its owner and authorised supervisors.'});if(await activeExternalResearchForKnowledge(req.params.id))return res.status(409).json({error:'This document is controlled by the Imported Research reader until that review path is completed.'});if(status==='Published'){const improvement=(await query("SELECT id FROM document_improvement_assignments WHERE knowledge_id=$1 AND status IN('Assigned','In Progress','Submitted') ORDER BY created_at DESC LIMIT 1",[req.params.id])).rows[0];if(improvement)return res.status(409).json({error:'This document has an active improvement. The assigned improvement reviewer must review and complete that version before it can be published.'})}const manager=isOrganisationScopeRole(req.user.role)||isTeamScopeRole(req.user.role)&&await canManageKnowledgeScope(req.user,req.params.id);if(['Published','Rejected'].includes(status))await requireDocumentReadBeforeDecision(req.user,req.params.id);if(['Published','Rejected'].includes(status)&&(item.reviewer_id!==req.user.id||item.created_by===req.user.id))return res.status(403).json({error:'Only the assigned reviewer can approve or reject this document, and self-review is not permitted.'});if(status==='Archived'&&!manager)return res.status(403).json({error:'Only a repository manager can archive knowledge.'});if(status==='Pending Approval'&&!manager&&item.created_by!==req.user.id)return res.status(403).json({error:'You cannot submit this document.'});if(status==='Pending Approval'&&!item.reviewer_id)return res.status(409).json({error:'Assign a reviewer before submitting this document.'});if(status==='Pending Approval'&&item.reviewer_id===item.created_by)return res.status(409).json({error:'The document owner cannot review their own upload.'});const reason=String(req.body?.reason||'').slice(0,1000);const row=await transaction(async client=>{const updated=(await client.query("UPDATE knowledge_items SET status=$1,is_archived=($1='Archived'),rejection_reason=CASE WHEN $1='Rejected' THEN $2 ELSE NULL END,reviewed_by=CASE WHEN $1 IN('Published','Rejected') THEN $3 ELSE reviewed_by END,reviewed_at=CASE WHEN $1 IN('Published','Rejected') THEN NOW() ELSE reviewed_at END,approved_by=CASE WHEN $1='Published' THEN $3 ELSE NULL END,approved_at=CASE WHEN $1='Published' THEN NOW() ELSE NULL END,updated_at=NOW()WHERE id=$4 RETURNING *",[status,reason,req.user.id,item.id])).rows[0];if(status==='Published')await client.query('UPDATE knowledge_versions SET approved_by=$1,approved_at=NOW() WHERE knowledge_id=$2 AND is_current=TRUE',[req.user.id,item.id]);await audit(client,req.user.id,action,'knowledge',item.id,{reason});if(status==='Published'&&updated.felix_enabled)await enqueueFelixDocumentIndex(client,item.id,item.current_version,req.user.id);if(status==='Archived')await client.query("UPDATE felix_document_index_jobs SET status='Failed',last_error='Document archived',updated_at=NOW()WHERE knowledge_id=$1",[item.id]);return updated});res.json(row)}catch(error){next(error)}}
app.post('/api/documents/:id/submit',authenticate,documentWorkflow('Pending Approval','DOCUMENT_SUBMITTED'))
app.post('/api/documents/:id/approve',authenticate,documentWorkflow('Published','DOCUMENT_APPROVED'))
app.post('/api/documents/:id/reject',authenticate,documentWorkflow('Rejected','DOCUMENT_REJECTED'))
app.post('/api/documents/:id/archive',authenticate,documentWorkflow('Archived','DOCUMENT_ARCHIVED'))
app.post('/api/documents/:id/restore',authenticate,authorize('System Admin','Director','Deputy Director','Assistant Director'),async(req,res,next)=>{try{if(!await isKnowledgeManagerFor(req.user,req.params.id))return res.status(403).json({error:'This document is outside your management scope.'});const row=await transaction(async client=>{const updated=(await client.query("UPDATE knowledge_items SET status='Draft',is_archived=FALSE,approved_by=NULL,approved_at=NULL,updated_at=NOW()WHERE id=$1 RETURNING *",[req.params.id])).rows[0];if(updated)await audit(client,req.user.id,'DOCUMENT_RESTORED','knowledge',req.params.id,{});return updated});if(!row)return res.status(404).json({error:'Document not found.'});res.json(row)}catch(error){next(error)}})
app.post('/api/documents/:id/felix/:mode',authenticate,authorize('System Admin','Director','Deputy Director','Assistant Director'),async(req,res,next)=>{try{if(!['enable','disable'].includes(req.params.mode))return res.status(404).json({error:'Unknown Felix action.'});if(!await isKnowledgeManagerFor(req.user,req.params.id))return res.status(403).json({error:'This document is outside your management scope.'});const enabled=req.params.mode==='enable';const row=await transaction(async client=>{const updated=(await client.query('UPDATE knowledge_items SET felix_enabled=$1,updated_at=NOW()WHERE id=$2 RETURNING *',[enabled,req.params.id])).rows[0];if(!updated)return null;await audit(client,req.user.id,enabled?'DOCUMENT_FELIX_ENABLED':'DOCUMENT_FELIX_DISABLED','knowledge',updated.id,{});if(enabled&&updated.status==='Published'&&!updated.is_archived)await enqueueFelixDocumentIndex(client,updated.id,updated.current_version,req.user.id);if(!enabled)await client.query("UPDATE felix_document_index_jobs SET status='Failed',last_error='Felix disabled',updated_at=NOW()WHERE knowledge_id=$1",[updated.id]);return updated});if(!row)return res.status(404).json({error:'Document not found.'});res.json(row)}catch(error){next(error)}})
app.post('/api/documents/:id/felix/reindex',authenticate,authorize('System Admin','Deputy Director'),async(req,res,next)=>{try{
  if(!await isKnowledgeManagerFor(req.user,req.params.id))return res.status(403).json({error:'This document is outside your management scope.'})
  const item=(await query("SELECT id,title,current_version,status,felix_enabled,is_archived FROM knowledge_items WHERE id=$1",[req.params.id])).rows[0]
  if(!item)return res.status(404).json({error:'Document not found.'})
  if(item.status!=='Published'||!item.felix_enabled||item.is_archived||Number(item.current_version)<1)return res.status(409).json({error:'Only the current published, Felix-enabled document can be indexed.'})
  await transaction(async client=>{await enqueueFelixDocumentIndex(client,item.id,item.current_version,req.user.id);await audit(client,req.user.id,'DOCUMENT_FELIX_REINDEX_QUEUED','knowledge',item.id,{version:item.current_version})})
  res.status(202).json({queued:true,documentId:item.id,title:item.title,version:item.current_version})
}catch(error){next(error)}})

app.post('/api/documents/felix/reindex-published',authenticate,authorize('System Admin','Deputy Director'),async(req,res,next)=>{try{
  const scoped=await managedUserIds(req.user),all=scoped===null,ids=scoped||[req.user.id]
  const documents=(await query(`SELECT k.id,k.title,k.current_version FROM knowledge_items k
    WHERE k.status='Published' AND k.felix_enabled=TRUE AND COALESCE(k.is_archived,FALSE)=FALSE AND k.current_version>0
      AND($1::boolean OR k.created_by=ANY($2::uuid[]) OR k.reviewer_id=ANY($2::uuid[]) OR k.approved_by=ANY($2::uuid[])
        OR EXISTS(SELECT 1 FROM repository_entity_links rel WHERE rel.knowledge_id=k.id AND(
          (rel.entity_type='assignment' AND EXISTS(SELECT 1 FROM assignments a WHERE a.id=rel.entity_id AND(a.created_by=ANY($2::uuid[]) OR EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=a.id AND am.user_id=ANY($2::uuid[])) OR EXISTS(SELECT 1 FROM assignment_tasks t WHERE t.assignment_id=a.id AND(t.owner_id=ANY($2::uuid[]) OR t.reviewer_id=ANY($2::uuid[]))))))
          OR(rel.entity_type='task' AND EXISTS(SELECT 1 FROM assignment_tasks t JOIN assignments a ON a.id=t.assignment_id WHERE t.id=rel.entity_id AND(t.owner_id=ANY($2::uuid[]) OR t.reviewer_id=ANY($2::uuid[]) OR a.created_by=ANY($2::uuid[]) OR EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=a.id AND am.user_id=ANY($2::uuid[])))))
          OR(rel.entity_type='research' AND EXISTS(SELECT 1 FROM research_projects p WHERE p.id=rel.entity_id AND(p.lead_id=ANY($2::uuid[]) OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=p.id AND rc.user_id=ANY($2::uuid[])) OR EXISTS(SELECT 1 FROM research_reviewers rr WHERE rr.project_id=p.id AND rr.reviewer_id=ANY($2::uuid[]) AND rr.active=TRUE))))
        ))
      ) ORDER BY k.updated_at DESC`,[all,ids])).rows
  await transaction(async client=>{for(const item of documents)await enqueueFelixDocumentIndex(client,item.id,item.current_version,req.user.id);await audit(client,req.user.id,'FELIX_PUBLISHED_DOCUMENT_REINDEX_QUEUED','felix_index','published',{count:documents.length,scope:all?'ORGANISATION':'TEAM_SUBTREE'})})
  res.status(202).json({queued:documents.length,scope:all?'ORGANISATION':'TEAM_SUBTREE'})
}catch(error){next(error)}})

app.get('/api/documents/:id/activity',authenticate,async(req,res,next)=>{try{if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot view this document activity.'});res.json((await query("SELECT l.id,l.action,l.details,l.created_at,COALESCE(u.name,'System / Unknown') user_name FROM audit_logs l LEFT JOIN users u ON u.id=l.user_id WHERE l.entity_type='knowledge' AND l.entity_id=$1 ORDER BY l.created_at DESC LIMIT 100",[req.params.id])).rows)}catch(error){next(error)}})
app.post('/api/documents/:id/copy-event',authenticate,validate(z.object({versionId:z.string().uuid().optional(),page:z.number().int().min(1).optional(),charCount:z.number().int().min(0).max(1000000),mode:z.enum(['INTERNAL_COPY','BLOCKED_NATIVE'])})),async(req,res,next)=>{try{if(!await canReadKnowledge(req.user,req.params.id)||!await documentProtectionCapability(req.user,req.params.id,'copy'))return res.status(403).json({error:'Copying is disabled for this protected document.'});await query('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)VALUES($1,$2,$3,$4,$5)',[req.user.id,req.validated.mode==='INTERNAL_COPY'?'DOCUMENT_INTERNAL_COPY':'DOCUMENT_COPY_BLOCKED','knowledge',req.params.id,JSON.stringify({versionId:req.validated.versionId||null,page:req.validated.page||null,charCount:req.validated.charCount})]);res.status(204).end()}catch(error){next(error)}})
app.post('/api/documents/:id/ask-felix',authenticate,validate(z.object({message:z.string().trim().min(2).max(4000)})),async(req,res,next)=>{try{if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot ask Felix about this document.'});const document=(await query("SELECT k.id,k.title,k.current_version,v.id version_id,v.version_number FROM knowledge_items k JOIN knowledge_versions v ON v.knowledge_id=k.id AND v.is_current=TRUE WHERE k.id=$1 AND k.status='Published' AND k.felix_enabled=TRUE AND k.is_archived=FALSE",[req.params.id])).rows[0];if(!document)return res.status(409).json({error:'Felix can only answer from the current approved, Felix-enabled version.'});const response=await fetch(`${config.aiResearchUrl}/api/felix/chat`,{method:'POST',headers:{Authorization:req.headers.authorization,'Content-Type':'application/json'},body:JSON.stringify({message:req.validated.message,document_id:document.id,retrieval_mode:'document',mode:'Research'}) ,signal:AbortSignal.timeout(120000)});const payload=await response.json().catch(()=>({error:'Felix returned an invalid response.'}));if(!response.ok)return res.status(response.status).json(payload);res.json({...payload,document:{id:document.id,title:document.title,version:document.version_number,version_id:document.version_id}})}catch(error){next(error)}})
app.post('/api/documents/:id/felix-assessment',authenticate,validate(z.object({mode:z.enum(['audit','clarification','research','critical','management','implementation','risk','executive','follow_up']).default('audit')})),async(req,res,next)=>{try{if(!await canReadKnowledge(req.user,req.params.id))return res.status(404).json({error:'The approved document is not available.'});const document=(await query("SELECT id FROM knowledge_items WHERE id=$1 AND status='Published' AND felix_enabled=TRUE AND is_archived=FALSE",[req.params.id])).rows[0];if(!document)return res.status(409).json({error:'Felix can only assess the current approved, indexed version.'});const response=await fetch(`${config.aiResearchUrl}/api/felix/documents/${document.id}/assessment`,{method:'POST',headers:{Authorization:req.headers.authorization,'Content-Type':'application/json'},body:JSON.stringify(req.validated),signal:AbortSignal.timeout(30000)});const payload=await response.json().catch(()=>({error:'Felix returned an invalid assessment.'}));if(!response.ok)return res.status(response.status).json(payload);res.json(payload)}catch(error){next(error)}})
app.post('/api/documents/:id/checkout',authenticate,async(req,res,next)=>{try{if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot check out this document.'});const row=(await query(`INSERT INTO document_locks(knowledge_id,locked_by)VALUES($1,$2)ON CONFLICT(knowledge_id)DO UPDATE SET locked_by=EXCLUDED.locked_by,locked_at=NOW(),expires_at=NOW()+INTERVAL '2 hours' WHERE document_locks.expires_at<NOW() OR document_locks.locked_by=$2 RETURNING *`,[req.params.id,req.user.id])).rows[0];if(!row)return res.status(409).json({error:'This document is checked out by another user.'});res.json(row)}catch(error){next(error)}})
app.post('/api/documents/:id/checkin',authenticate,async(req,res,next)=>{try{const manager=await isKnowledgeManagerFor(req.user,req.params.id);const result=await query('DELETE FROM document_locks WHERE knowledge_id=$1 AND(locked_by=$2 OR $3)RETURNING *',[req.params.id,req.user.id,manager]);if(!result.rowCount)return res.status(403).json({error:'You do not hold this document lock or the document is outside your management scope.'});res.status(204).end()}catch(error){next(error)}})
app.patch('/api/documents/:id/retention',authenticate,authorize('System Admin','Director','Deputy Director','Assistant Director'),validate(z.object({retentionUntil:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),archive:z.boolean().default(false)})),async(req,res,next)=>{try{if(!await isKnowledgeManagerFor(req.user,req.params.id))return res.status(403).json({error:'This document is outside your management scope.'});const row=(await query("UPDATE knowledge_items SET retention_until=$1,status=CASE WHEN $2 THEN 'Archived' ELSE status END,updated_at=NOW() WHERE id=$3 RETURNING *",[req.validated.retentionUntil,req.validated.archive,req.params.id])).rows[0];if(!row)return res.status(404).json({error:'Document not found.'});res.json(row)}catch(error){next(error)}})

// APP2_RECORDS_MANAGEMENT_FOUNDATION_V1
const documentImprovementSchema=z.object({
  assigneeId:z.string().uuid(),
  reviewerId:z.string().uuid(),
  improvementType:z.enum(['Content Update','Policy Review','Legal Review','Metadata Improvement','Formatting','Annual Review','Other']),
  reason:z.string().trim().min(5).max(3000),
  dueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null)
})
const documentImprovementStatusSchema=z.object({status:z.enum(['Assigned','In Progress','Submitted','Completed','Cancelled'])})
const recordsMetadataSchema=z.object({
  recordNumber:z.string().trim().max(80).nullable().optional(),
  recordClass:z.string().trim().min(2).max(120).optional(),
  reviewDueAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  dispositionAction:z.enum(['Review','Destroy','Transfer','Permanent']).optional(),
  legalHold:z.boolean().optional(),
  legalHoldReason:z.string().trim().max(3000).nullable().optional()
})




// APP2_REPOSITORY_RECORDS_COMPLETION_V2
const recordCode=value=>String(value||'GEN').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean).map(part=>part.slice(0,3)).join('').slice(0,12)||'GEN'
const ensureRepositoryRecordNumber=async(client,item)=>{
  if(item.record_number)return item.record_number
  const year=new Date(item.document_date||item.created_at||Date.now()).getFullYear()
  const division=recordCode(item.directorate||'PSC')
  const classCode=recordCode(item.record_class||item.category||item.document_type||'Record')
  const prefix=`PSC/${division}/${classCode}`
  const seq=(await client.query(`INSERT INTO repository_record_sequences(year,prefix,last_number)
    VALUES($1,$2,1)
    ON CONFLICT(year,prefix) DO UPDATE SET last_number=repository_record_sequences.last_number+1
    RETURNING last_number`,[year,prefix])).rows[0].last_number
  const recordNumber=`${prefix}/${year}/${String(seq).padStart(4,'0')}`
  await client.query('UPDATE knowledge_items SET record_number=$1 WHERE id=$2',[recordNumber,item.id])
  return recordNumber
}
const repositoryTargetTitleSql=`CASE rel.entity_type
  WHEN 'assignment' THEN(SELECT title FROM assignments WHERE id=rel.entity_id)
  WHEN 'task' THEN(SELECT title FROM assignment_tasks WHERE id=rel.entity_id)
  WHEN 'research' THEN(SELECT title FROM research_projects WHERE id=rel.entity_id)
  WHEN 'report' THEN(SELECT title FROM generated_documents WHERE id=rel.entity_id)
END`

// APP2_DOCUMENT_PROTECTION_V1
const documentProtectionSchema=z.object({
  readerScope:z.enum(['INHERITED','TEAM','NAMED_USERS','REVIEWER_ONLY','MANAGEMENT_ONLY']),
  allowDownload:z.boolean(),
  allowCopy:z.boolean(),
  allowPrint:z.boolean(),
  allowLink:z.boolean(),
  watermark:z.boolean(),
  restrictionReason:z.string().trim().max(3000).default(''),
  expiresAt:z.string().datetime().nullable().default(null),
  userIds:z.array(z.string().uuid()).max(100).default([])
})

const documentProtectionPayload=async knowledgeId=>{
  const policy=(await query(`SELECT * FROM document_access_policies WHERE knowledge_id=$1`,[knowledgeId])).rows[0]
    ||{knowledge_id:knowledgeId,reader_scope:'INHERITED',allow_download:true,allow_copy:true,allow_print:true,allow_link:true,watermark:false,restriction_reason:'',expires_at:null,approved_by:null,updated_by:null,updated_at:null}
  const grants=(await query(`SELECT g.id,g.user_id,u.name user_name,u.role,g.can_view,g.can_download,g.can_copy,g.can_print,g.can_link
    FROM document_access_grants g JOIN users u ON u.id=g.user_id
    WHERE g.knowledge_id=$1 ORDER BY u.name`,[knowledgeId])).rows
  return{...policy,grants}
}


app.get('/api/documents/:id/protection-effective',authenticate,async(req,res,next)=>{try{
  if(!await canReadKnowledge(req.user,req.params.id))
    return res.status(403).json({error:'You are not an authorised reader for this protected record.'})

  const [policy,item,viewer]=await Promise.all([
    documentAccessPolicy(req.params.id),
    query(`SELECT id,title,record_number,classification,created_by,reviewer_id,approved_by
      FROM knowledge_items WHERE id=$1`,[req.params.id]).then(result=>result.rows[0]),
    query('SELECT id,name,role FROM users WHERE id=$1',[req.user.id]).then(result=>result.rows[0])
  ])
  if(!item)return res.status(404).json({error:'Record not found.'})

  const canDownload=await documentProtectionCapability(req.user,item.id,'download')
  const canCopy=await documentProtectionCapability(req.user,item.id,'copy')
  const canPrint=await documentProtectionCapability(req.user,item.id,'print')
  const canLink=await documentProtectionCapability(req.user,item.id,'link')
  const watermark=Boolean(policy?.watermark)
  const watermarkText=watermark
    ?`${viewer?.name||'Authorised reader'} Â· ${item.record_number||item.title} Â· ${new Date().toLocaleString('en-KE')}`
    :null

  res.json({
    canView:true,
    canDownload,
    canCopy,
    canPrint,
    canLink,
    watermark,
    watermarkText,
    readerScope:policy?.reader_scope||'INHERITED',
    restrictionReason:policy?.restriction_reason||'',
    classification:item.classification||'INTERNAL'
  })
}catch(error){next(error)}})

app.get('/api/documents/:id/protection',authenticate,async(req,res,next)=>{try{
  if(!await canReadKnowledge(req.user,req.params.id)&&!await isKnowledgeManagerFor(req.user,req.params.id))
    return res.status(403).json({error:'You cannot view protection settings for this document.'})
  res.json(await documentProtectionPayload(req.params.id))
}catch(error){next(error)}})

app.put('/api/documents/:id/protection',authenticate,
  authorize('System Admin','Director','Deputy Director','Assistant Director'),
  validate(documentProtectionSchema),async(req,res,next)=>{try{
  if(!await isKnowledgeManagerFor(req.user,req.params.id))
    return res.status(403).json({error:'This document is outside your management scope.'})
  const v=req.validated
  if(v.readerScope==='NAMED_USERS'&&v.userIds.length===0)
    return res.status(400).json({error:'Choose at least one named reader.'})
  const activeUsers=v.userIds.length?(await query(
    'SELECT id FROM users WHERE id=ANY($1::uuid[]) AND active=TRUE',[v.userIds]
  )).rows.map(row=>row.id):[]
  if(activeUsers.length!==v.userIds.length)return res.status(400).json({error:'One or more selected readers are unavailable.'})
  if(isTeamScopeRole(req.user.role)){
    const allowed=await managedUserIds(req.user)
    if(activeUsers.some(id=>!allowed.includes(id)))return res.status(403).json({error:'You may grant named document access only to users inside your authorised reporting scope.'})
  }
  await transaction(async client=>{
    await client.query(`INSERT INTO document_access_policies
      (knowledge_id,reader_scope,allow_download,allow_copy,allow_print,allow_link,watermark,restriction_reason,expires_at,approved_by,updated_by,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,NOW())
      ON CONFLICT(knowledge_id) DO UPDATE SET
        reader_scope=EXCLUDED.reader_scope,allow_download=EXCLUDED.allow_download,
        allow_copy=EXCLUDED.allow_copy,allow_print=EXCLUDED.allow_print,allow_link=EXCLUDED.allow_link,
        watermark=EXCLUDED.watermark,restriction_reason=EXCLUDED.restriction_reason,
        expires_at=EXCLUDED.expires_at,approved_by=EXCLUDED.approved_by,
        updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
      [req.params.id,v.readerScope,v.allowDownload,v.allowCopy,v.allowPrint,v.allowLink,v.watermark,v.restrictionReason,v.expiresAt,req.user.id])
    await client.query('DELETE FROM document_access_grants WHERE knowledge_id=$1',[req.params.id])
    for(const userId of activeUsers){
      await client.query(`INSERT INTO document_access_grants
        (knowledge_id,user_id,can_view,can_download,can_copy,can_print,can_link,granted_by)
        VALUES($1,$2,TRUE,$3,$4,$5,$6,$7)`,
        [req.params.id,userId,v.allowDownload,v.allowCopy,v.allowPrint,v.allowLink,req.user.id])
    }
    await audit(client,req.user.id,'DOCUMENT_PROTECTION_UPDATED','knowledge',req.params.id,{
      readerScope:v.readerScope,allowDownload:v.allowDownload,allowCopy:v.allowCopy,
      allowPrint:v.allowPrint,allowLink:v.allowLink,watermark:v.watermark,
      expiresAt:v.expiresAt,namedReaders:activeUsers.length,reason:v.restrictionReason
    })
  })
  res.json(await documentProtectionPayload(req.params.id))
}catch(error){next(error)}})

app.post('/api/documents/:id/print-event',authenticate,async(req,res,next)=>{try{
  if(!await documentProtectionCapability(req.user,req.params.id,'print'))
    return res.status(403).json({error:'Printing is disabled for this protected document.'})
  await query(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)
    VALUES($1,'DOCUMENT_PRINT_REQUESTED','knowledge',$2,'{}'::jsonb)`,[req.user.id,req.params.id])
  res.status(204).end()
}catch(error){next(error)}})

// APP2_REPOSITORY_RELATIONSHIPS_EVIDENCE_V1
const repositoryRelationshipSchema=z.object({
  relationshipType:z.enum(['Evidence for','Reference for','Source for','Supports','Produced by','Supersedes','Related to','Annex to']),
  entityType:z.enum(['assignment','task','research','report','meeting']),
  entityId:z.string().uuid(),
  pinCurrentVersion:z.boolean().default(true),
  notes:z.string().trim().max(2000).default('')
})

const repositoryRelationshipEntityTitleSql=`CASE rel.entity_type
  WHEN 'assignment' THEN(SELECT title FROM assignments WHERE id=rel.entity_id)
  WHEN 'task' THEN(SELECT title FROM assignment_tasks WHERE id=rel.entity_id)
  WHEN 'research' THEN(SELECT title FROM research_projects WHERE id=rel.entity_id)
  WHEN 'report' THEN(SELECT title FROM generated_documents WHERE id=rel.entity_id)
END`

app.get('/api/documents/:id/relationships',authenticate,async(req,res,next)=>{try{
  if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot view relationships for this record.'})
  const rows=(await query(`SELECT rel.*,${repositoryRelationshipEntityTitleSql} entity_title,
    v.version_number pinned_version_number,u.name linked_by_name
    FROM repository_entity_links rel
    LEFT JOIN knowledge_versions v ON v.id=rel.pinned_version_id
    JOIN users u ON u.id=rel.linked_by
    WHERE rel.knowledge_id=$1
    ORDER BY rel.created_at DESC`,[req.params.id])).rows
  res.json(rows)
}catch(error){next(error)}})

app.post('/api/documents/:id/relationships',authenticate,validate(repositoryRelationshipSchema),async(req,res,next)=>{try{
  if(!await canReadKnowledge(req.user,req.params.id)||!await documentProtectionCapability(req.user,req.params.id,'link'))return res.status(403).json({error:'Linking is disabled for this protected Repository record.'})
  const document=(await query('SELECT id,title,status,current_version FROM knowledge_items WHERE id=$1',[req.params.id])).rows[0]
  if(!document)return res.status(404).json({error:'Repository record not found.'})
  if(document.status!=='Published'&&req.validated.relationshipType==='Evidence for')
    return res.status(409).json({error:'Only a Published record can be linked as formal evidence.'})

  const originType={assignment:'Assignment',task:'Task',research:'Research',report:'App2 Report'}[req.validated.entityType]
  const origins=(await query(`SELECT id,title,type FROM(
    SELECT a.id,a.title,'Assignment' type FROM assignments a
    UNION ALL SELECT t.id,t.title,'Task' type FROM assignment_tasks t
    UNION ALL SELECT p.id,p.title,'Research' type FROM research_projects p
    UNION ALL SELECT gd.id,gd.title,'App2 Report' type FROM generated_documents gd
  )o WHERE id=$1 AND type=$2`,[req.validated.entityId,originType])).rows[0]
  if(!origins)return res.status(404).json({error:'The target APP2 record was not found.'})

  // Reuse the same scoped origin directory used by the Repository UI to prevent cross-scope linking.
  const management=isManagementRole(req.user.role)
  const scoped=management?await managedUserIds(req.user):[req.user.id]
  const all=scoped===null
  const ids=scoped||[req.user.id]
  if(!all){
    const permitted=(await query(`SELECT 1 FROM(
      SELECT a.id,'assignment' type FROM assignments a WHERE a.created_by=ANY($1::uuid[]) OR EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=a.id AND am.user_id=ANY($1::uuid[]))
      UNION ALL SELECT t.id,'task' type FROM assignment_tasks t JOIN assignments a ON a.id=t.assignment_id WHERE t.owner_id=ANY($1::uuid[]) OR t.reviewer_id=ANY($1::uuid[]) OR a.created_by=ANY($1::uuid[]) OR EXISTS(SELECT 1 FROM assignment_members am WHERE am.assignment_id=a.id AND am.user_id=ANY($1::uuid[]))
      UNION ALL SELECT p.id,'research' type FROM research_projects p WHERE p.lead_id=ANY($1::uuid[]) OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=p.id AND rc.user_id=ANY($1::uuid[])) OR EXISTS(SELECT 1 FROM research_reviewers rr WHERE rr.project_id=p.id AND rr.reviewer_id=ANY($1::uuid[]) AND rr.active=TRUE)
      UNION ALL SELECT gd.id,'report' type FROM generated_documents gd WHERE gd.created_by=ANY($1::uuid[]) OR gd.reviewer_id=ANY($1::uuid[])
    )s WHERE id=$2 AND type=$3`,[ids,req.validated.entityId,req.validated.entityType])).rowCount
    if(!permitted)return res.status(403).json({error:'The target record is outside your authorised scope.'})
  }

  const row=await transaction(async client=>{
    let pinnedVersionId=null
    if(req.validated.pinCurrentVersion){
      pinnedVersionId=(await client.query(
        'SELECT id FROM knowledge_versions WHERE knowledge_id=$1 AND version_number=$2 LIMIT 1',
        [document.id,document.current_version]
      )).rows[0]?.id||null
    }
    const saved=(await client.query(`INSERT INTO repository_entity_links
      (knowledge_id,entity_type,entity_id,linked_by,relationship_type,pinned_version_id,notes)
      VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(knowledge_id,entity_type,entity_id) DO UPDATE SET
        relationship_type=EXCLUDED.relationship_type,
        pinned_version_id=EXCLUDED.pinned_version_id,
        notes=EXCLUDED.notes,
        linked_by=EXCLUDED.linked_by,
        created_at=NOW()
      RETURNING *`,
      [document.id,req.validated.entityType,req.validated.entityId,req.user.id,req.validated.relationshipType,pinnedVersionId,req.validated.notes]
    )).rows[0]
    await audit(client,req.user.id,'REPOSITORY_RELATIONSHIP_LINKED','knowledge',document.id,{
      relationshipId:saved.id,relationshipType:req.validated.relationshipType,
      entityType:req.validated.entityType,entityId:req.validated.entityId,
      pinnedVersionId
    })
    return saved
  })
  const full=(await query(`SELECT rel.*,${repositoryRelationshipEntityTitleSql} entity_title,
    v.version_number pinned_version_number,u.name linked_by_name
    FROM repository_entity_links rel
    LEFT JOIN knowledge_versions v ON v.id=rel.pinned_version_id
    JOIN users u ON u.id=rel.linked_by WHERE rel.id=$1`,[row.id])).rows[0]
  res.status(201).json(full)
}catch(error){next(error)}})

app.delete('/api/documents/:id/relationships/:relationshipId',authenticate,async(req,res,next)=>{try{
  if(!await canReadKnowledge(req.user,req.params.id))return res.status(403).json({error:'You cannot change relationships for this record.'})
  const rel=(await query('SELECT * FROM repository_entity_links WHERE id=$1 AND knowledge_id=$2',[req.params.relationshipId,req.params.id])).rows[0]
  if(!rel)return res.status(404).json({error:'Relationship not found.'})
  await transaction(async client=>{
    await client.query('DELETE FROM repository_entity_links WHERE id=$1',[rel.id])
    await audit(client,req.user.id,'REPOSITORY_RELATIONSHIP_REMOVED','knowledge',req.params.id,{
      relationshipId:rel.id,relationshipType:rel.relationship_type,entityType:rel.entity_type,entityId:rel.entity_id
    })
  })
  res.json({ok:true})
}catch(error){next(error)}})

app.get('/api/document-improvements',authenticate,async(req,res,next)=>{try{
  const documentId=typeof req.query.documentId==='string'?req.query.documentId:null
  const params=[]
  let where=''
  if(documentId){
    if(!await canReadKnowledge(req.user,documentId))return res.status(404).json({error:'Document not found.'})
    params.push(documentId);where='WHERE i.knowledge_id=$1'
  }else if(!isManagementRole(req.user.role)){
    params.push(req.user.id);where='WHERE(i.assignee_id=$1 OR i.reviewer_id=$1)'
  }
  const rows=(await query(`SELECT i.*,k.title knowledge_title,
    assignee.name assignee_name,reviewer.name reviewer_name,creator.name created_by_name
    FROM document_improvement_assignments i
    JOIN knowledge_items k ON k.id=i.knowledge_id
    JOIN users assignee ON assignee.id=i.assignee_id
    JOIN users reviewer ON reviewer.id=i.reviewer_id
    JOIN users creator ON creator.id=i.created_by
    ${where}
    ORDER BY CASE WHEN i.status IN('Assigned','In Progress','Submitted') THEN 0 ELSE 1 END,
      i.due_date NULLS LAST,i.updated_at DESC`,params)).rows
  res.json(rows)
}catch(error){next(error)}})

app.post('/api/documents/:id/improvements',authenticate,validate(documentImprovementSchema),async(req,res,next)=>{try{
  if(!isManagementRole(req.user.role))return res.status(403).json({error:'Only an authorised manager can assign a document improvement.'})
  if(!await isKnowledgeManagerFor(req.user,req.params.id))return res.status(403).json({error:'This document is outside your management scope.'})
  if(req.validated.assigneeId===req.validated.reviewerId)return res.status(400).json({error:'The improvement assignee and reviewer must be different people.'})
  if(isTeamScopeRole(req.user.role)){
    const ids=await managedUserIds(req.user)
    if(!ids.includes(req.validated.assigneeId)||!ids.includes(req.validated.reviewerId))return res.status(403).json({error:'Choose the assignee and reviewer from your reporting subtree.'})
  }
  const result=await transaction(async client=>{
    const document=(await client.query('SELECT id,title,current_version,status,created_by FROM knowledge_items WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]
    if(!document)return null
    if(document.status==='Archived')throw Object.assign(new Error('Archived records must be restored before an improvement can be assigned.'),{statusCode:409})
    const activeAssignment=(await client.query("SELECT id FROM document_improvement_assignments WHERE knowledge_id=$1 AND status IN('Assigned','In Progress','Submitted') LIMIT 1 FOR UPDATE",[document.id])).rows[0]
    if(activeAssignment)throw Object.assign(new Error('This document already has an active improvement. Complete or cancel it before assigning another.'),{statusCode:409})
    if(req.validated.reviewerId===document.created_by)throw Object.assign(new Error('The document owner cannot be the reviewer for its improvement.'),{statusCode:400})
    const people=(await client.query('SELECT id,name FROM users WHERE id=ANY($1::uuid[]) AND active=TRUE',[[req.validated.assigneeId,req.validated.reviewerId]])).rows
    if(people.length!==2)throw Object.assign(new Error('Choose active users for both assignee and reviewer.'),{statusCode:400})
    const row=(await client.query(`INSERT INTO document_improvement_assignments
      (knowledge_id,assignee_id,reviewer_id,created_by,improvement_type,reason,due_date,starting_version)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [document.id,req.validated.assigneeId,req.validated.reviewerId,req.user.id,req.validated.improvementType,req.validated.reason,req.validated.dueDate,document.current_version||1])).rows[0]
    await client.query("UPDATE knowledge_items SET records_lifecycle_state='Under Improvement',reviewer_id=$1,updated_at=NOW() WHERE id=$2",[req.validated.reviewerId,document.id])
    await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'Document improvement assigned',$2,'knowledge',$3)",[req.validated.assigneeId,`You have been assigned to improve â€œ${document.title}â€.`,document.id])
    await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id) VALUES($1,'Document improvement reviewer assigned',$2,'knowledge',$3)",[req.validated.reviewerId,`You are the reviewer for the improvement of â€œ${document.title}â€.`,document.id])
    await audit(client,req.user.id,'DOCUMENT_IMPROVEMENT_ASSIGNED','knowledge',document.id,{assignmentId:row.id,assigneeId:req.validated.assigneeId,reviewerId:req.validated.reviewerId,type:req.validated.improvementType,dueDate:req.validated.dueDate})
    return row
  })
  if(!result)return res.status(404).json({error:'Document not found.'})
  const full=(await query(`SELECT i.*,k.title knowledge_title,assignee.name assignee_name,reviewer.name reviewer_name,creator.name created_by_name
    FROM document_improvement_assignments i JOIN knowledge_items k ON k.id=i.knowledge_id
    JOIN users assignee ON assignee.id=i.assignee_id JOIN users reviewer ON reviewer.id=i.reviewer_id
    JOIN users creator ON creator.id=i.created_by WHERE i.id=$1`,[result.id])).rows[0]
  res.status(201).json(full)
}catch(error){next(error)}})

app.patch('/api/document-improvements/:id/status',authenticate,validate(documentImprovementStatusSchema),async(req,res,next)=>{try{
  const result=await transaction(async client=>{
    const current=(await client.query(`SELECT i.*,k.current_version,k.title,k.status document_status,k.created_by FROM document_improvement_assignments i
      JOIN knowledge_items k ON k.id=i.knowledge_id WHERE i.id=$1 FOR UPDATE`,[req.params.id])).rows[0]
    if(!current)return {kind:'missing'}
    const manager=await isKnowledgeManagerFor(req.user,current.knowledge_id)
    const assignee=current.assignee_id===req.user.id
    const reviewer=current.reviewer_id===req.user.id
    const nextStatus=req.validated.status
    if(['In Progress','Submitted'].includes(nextStatus)&&!assignee&&!manager)return {kind:'forbidden'}
    if(['Completed','Cancelled'].includes(nextStatus)&&!reviewer&&!manager)return {kind:'forbidden'}
    if(nextStatus==='Submitted'){
      const candidate=(await client.query('SELECT id,version_number FROM knowledge_versions WHERE knowledge_id=$1 AND version_number>$2 ORDER BY version_number DESC LIMIT 1',[current.knowledge_id,current.starting_version])).rows[0]
      if(!candidate)return {kind:'version-required'}
      if(current.reviewer_id===current.created_by)return {kind:'invalid-reviewer'}
      const row=(await client.query(`UPDATE document_improvement_assignments SET status='Submitted',submitted_version=$1,updated_at=NOW() WHERE id=$2 RETURNING *`,[candidate.version_number,current.id])).rows[0]
      await client.query("UPDATE knowledge_items SET status='Pending Approval',reviewer_id=$1,records_lifecycle_state='Under Review',approved_by=NULL,approved_at=NULL,updated_at=NOW() WHERE id=$2",[current.reviewer_id,current.knowledge_id])
      await client.query("INSERT INTO document_reviews(knowledge_id,reviewer_id,actor_id,action,comments)VALUES($1,$2,$3,'SUBMITTED',$4)",[current.knowledge_id,current.reviewer_id,req.user.id,`Improvement version ${candidate.version_number} submitted for review.`])
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Improved document awaiting review',$2,'knowledge',$3)",[current.reviewer_id,`Version ${candidate.version_number} of “${current.title}” is ready for your review.`,current.knowledge_id])
    }else if(nextStatus==='Completed'){
      if(current.status!=='Submitted')return {kind:'submit-first'}
      if(!current.submitted_version)return {kind:'version-required'}
      if(current.reviewer_id!==req.user.id)return {kind:'forbidden'}
      const candidate=(await client.query('SELECT id FROM knowledge_versions WHERE knowledge_id=$1 AND version_number=$2',[current.knowledge_id,current.submitted_version])).rows[0]
      if(!candidate)return {kind:'missing-version'}
      await client.query('UPDATE knowledge_versions SET is_current=FALSE WHERE knowledge_id=$1 AND is_current=TRUE',[current.knowledge_id])
      await client.query('UPDATE knowledge_versions SET is_current=TRUE,approved_by=$1,approved_at=NOW() WHERE id=$2',[req.user.id,candidate.id])
      const published=(await client.query("UPDATE knowledge_items SET current_version=$1,status='Published',reviewer_id=$2,reviewed_by=$2,reviewed_at=NOW(),approved_by=$2,approved_at=NOW(),rejection_reason=NULL,records_lifecycle_state='Active Record',updated_at=NOW() WHERE id=$3 RETURNING *",[current.submitted_version,current.reviewer_id,current.knowledge_id])).rows[0]
      if(published?.felix_enabled)await enqueueFelixDocumentIndex(client,published.id,current.submitted_version,req.user.id)
      await client.query("INSERT INTO document_reviews(knowledge_id,reviewer_id,actor_id,action,comments)VALUES($1,$2,$3,'APPROVED',$4)",[current.knowledge_id,current.reviewer_id,req.user.id,`Improvement version ${current.submitted_version} reviewed and published.`])
      await client.query("INSERT INTO notifications(user_id,title,body,entity_type,entity_id)VALUES($1,'Improved document approved',$2,'knowledge',$3)",[current.assignee_id,`Your improved version ${current.submitted_version} of “${current.title}” has been approved and published.`,current.knowledge_id])
    }else{
      await client.query('UPDATE knowledge_items SET records_lifecycle_state=$1,updated_at=NOW() WHERE id=$2',[current.status==='Published'?'Active Record':'Working Document',current.knowledge_id])
    }
    const row=(await client.query(`UPDATE document_improvement_assignments SET status=$1,
      completed_version=CASE WHEN $1='Completed' THEN submitted_version ELSE completed_version END,
      completed_at=CASE WHEN $1='Completed' THEN NOW() ELSE completed_at END,updated_at=NOW()
      WHERE id=$2 RETURNING *`,[nextStatus,current.id])).rows[0]
    await audit(client,req.user.id,'DOCUMENT_IMPROVEMENT_STATUS_CHANGED','knowledge',current.knowledge_id,{assignmentId:current.id,status:nextStatus,version:current.submitted_version||null})
    return {kind:'updated',row}
  })
  if(result.kind==='missing')return res.status(404).json({error:'Improvement assignment not found.'})
  if(result.kind==='forbidden')return res.status(403).json({error:'You cannot move this improvement to the selected status.'})
  if(result.kind==='version-required')return res.status(409).json({error:'Upload a new document version before submitting the improvement.'})
  if(result.kind==='submit-first')return res.status(409).json({error:'The improved version must be submitted before it can be completed.'})
  if(result.kind==='invalid-reviewer')return res.status(409).json({error:'Assign an independent reviewer before submitting this improvement.'})
  if(result.kind==='missing-version')return res.status(409).json({error:'The submitted improvement version is no longer available.'})
  const full=(await query(`SELECT i.*,k.title knowledge_title,assignee.name assignee_name,reviewer.name reviewer_name,creator.name created_by_name
    FROM document_improvement_assignments i JOIN knowledge_items k ON k.id=i.knowledge_id
    JOIN users assignee ON assignee.id=i.assignee_id JOIN users reviewer ON reviewer.id=i.reviewer_id
    JOIN users creator ON creator.id=i.created_by WHERE i.id=$1`,[req.params.id])).rows[0]
  res.json(full)
}catch(error){next(error)}})

app.patch('/api/documents/:id/records-metadata',authenticate,authorize('System Admin','Director','Deputy Director','Assistant Director'),validate(recordsMetadataSchema),async(req,res,next)=>{try{
  if(!await isKnowledgeManagerFor(req.user,req.params.id))return res.status(403).json({error:'This document is outside your management scope.'})
  const v=req.validated
  const row=(await query(`UPDATE knowledge_items SET
    record_number=COALESCE($1,record_number),
    record_class=COALESCE($2,record_class),
    review_due_at=CASE WHEN $3::text IS NULL THEN review_due_at ELSE $3::date END,
    disposition_action=COALESCE($4,disposition_action),
    legal_hold=COALESCE($5,legal_hold),
    legal_hold_reason=CASE WHEN $6::text IS NULL THEN legal_hold_reason ELSE $6 END,
    updated_at=NOW() WHERE id=$7 RETURNING *`,
    [v.recordNumber??null,v.recordClass??null,v.reviewDueAt??null,v.dispositionAction??null,v.legalHold??null,v.legalHoldReason??null,req.params.id])).rows[0]
  if(!row)return res.status(404).json({error:'Document not found.'})
  await query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES($1,'RECORDS_METADATA_UPDATED','knowledge',$2,$3)",[req.user.id,row.id,JSON.stringify(v)])
  res.json(row)
}catch(error){next(error)}})

app.post('/api/documents/:id/declare-record',authenticate,authorize('System Admin','Director','Deputy Director','Assistant Director'),async(req,res,next)=>{try{
  if(!await isKnowledgeManagerFor(req.user,req.params.id))return res.status(403).json({error:'This document is outside your management scope.'})
  const row=(await query(`UPDATE knowledge_items SET records_lifecycle_state='Active Record',
    declared_at=COALESCE(declared_at,NOW()),declared_by=COALESCE(declared_by,$1),updated_at=NOW()
    WHERE id=$2 AND status='Published' RETURNING *`,[req.user.id,req.params.id])).rows[0]
  if(!row)return res.status(409).json({error:'Only an approved Published document can be declared as an official record.'})
  await query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES($1,'DOCUMENT_DECLARED_RECORD','knowledge',$2,'{}'::jsonb)",[req.user.id,row.id])
  res.json(row)
}catch(error){next(error)}})


const internalEmailSchema=z.object({
  recipientIds:z.array(z.string().uuid()).min(1).max(20),
  subject:z.string().trim().min(2).max(240),
  body:z.string().trim().min(1).max(20000)
})
app.get('/api/internal-email/recipients',authenticate,async(_req,res,next)=>{try{
  res.json((await query(`SELECT id,name,email,role,division FROM users
    WHERE active=TRUE AND email IS NOT NULL AND email<>'' ORDER BY name`)).rows)
}catch(error){next(error)}})
app.get('/api/internal-email/sent',authenticate,async(req,res,next)=>{try{
  res.json((await query(`SELECT m.id,m.subject,m.body,m.created_at,
    COALESCE(json_agg(json_build_object(
      'id',r.id,'recipient_id',r.recipient_id,'recipient_name',u.name,
      'recipient_email',r.recipient_email,'delivery_status',r.delivery_status,
      'sent_at',r.sent_at,'last_error',r.last_error
    ) ORDER BY u.name) FILTER(WHERE r.id IS NOT NULL),'[]'::json) recipients
    FROM app_email_messages m
    LEFT JOIN app_email_recipients r ON r.message_id=m.id
    LEFT JOIN users u ON u.id=r.recipient_id
    WHERE m.sender_id=$1 GROUP BY m.id ORDER BY m.created_at DESC LIMIT 200`,[req.user.id])).rows)
}catch(error){next(error)}})
app.post('/api/internal-email',authenticate,validate(internalEmailSchema),async(req,res,next)=>{try{
  const v=req.validated,ids=[...new Set(v.recipientIds)]
  const recipients=(await query(`SELECT id,name,email FROM users
    WHERE active=TRUE AND email IS NOT NULL AND email<>'' AND id=ANY($1::uuid[])`,[ids])).rows
  if(recipients.length!==ids.length)return res.status(400).json({error:'One or more recipients are unavailable. Refresh the directory and try again.'})
  const system=(await query('SELECT email_notifications FROM system_settings WHERE id=1')).rows[0]
  if(system&&!system.email_notifications)return res.status(409).json({error:'System email delivery is disabled by the administrator.'})
  if(!mailStatus().ready)return res.status(503).json({error:'APP2 email delivery is not configured. Ask the System Administrator to complete SMTP settings.'})
  const message=await transaction(async client=>{
    const row=(await client.query(`INSERT INTO app_email_messages(sender_id,subject,body) VALUES($1,$2,$3) RETURNING *`,
      [req.user.id,v.subject,v.body])).rows[0]
    for(const recipient of recipients)await client.query(
      `INSERT INTO app_email_recipients(message_id,recipient_id,recipient_email) VALUES($1,$2,$3)`,
      [row.id,recipient.id,recipient.email])
    await audit(client,req.user.id,'INTERNAL_EMAIL_QUEUED','app_email',row.id,{
      recipients:recipients.map(item=>({id:item.id,email:item.email})),subject:v.subject
    })
    return row
  })
  void deliverPendingInternalEmails().catch(error=>console.error('Internal email delivery failed:',error?.message||error))
  res.status(201).json({id:message.id,status:'Queued',recipientCount:recipients.length})
}catch(error){next(error)}})


const MESSAGE_GROUP_MEMBER_LIMIT=600
const MESSAGE_GROUP_INVITEE_LIMIT=MESSAGE_GROUP_MEMBER_LIMIT-1

const messageConversationSchema=z.object({
  participantIds:z.array(z.string().uuid()).min(1).max(MESSAGE_GROUP_INVITEE_LIMIT),
  title:z.string().trim().max(160).optional()
})
const messageSendSchema=z.object({
  body:z.string().trim().min(1).max(8000),
  contextType:z.string().trim().max(40).optional().nullable(),
  contextId:z.string().trim().max(160).optional().nullable(),
  contextTitle:z.string().trim().max(240).optional().nullable(),
  replyToMessageId:z.string().uuid().optional().nullable()
})

const messageGroupRenameSchema=z.object({
  title:z.string().trim().min(2).max(160)
})
const messageGroupMembersSchema=z.object({
  memberIds:z.array(z.string().uuid()).min(1).max(MESSAGE_GROUP_INVITEE_LIMIT)
})
const messageTypingSchema=z.object({typing:z.boolean()})
const messagePresenceSchema=z.object({status:z.enum(['Online','Away'])})

const messageConversationAccess=async(user,conversationId)=>{
  const row=(await query(`SELECT c.id,c.kind,c.title,c.owner_id,c.created_by,
      EXISTS(SELECT 1 FROM message_conversation_members cm WHERE cm.conversation_id=c.id AND cm.user_id=$2) is_member
    FROM message_conversations c WHERE c.id=$1`,[conversationId,user.id])).rows[0]
  if(!row)return null
  return {
    ...row,
    can_manage:user.role==='System Admin'||row.owner_id===user.id||(!row.owner_id&&row.created_by===user.id)
  }
}


const ensureMessageMember=async(userId,conversationId)=>{
  const result=await query(`SELECT 1 FROM message_conversation_members
    WHERE conversation_id=$1 AND user_id=$2`,[conversationId,userId])
  return Boolean(result.rowCount)
}

app.get('/api/messages/realtime',authenticate,async(req,res,next)=>{try{
  res.status(200);res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders?.()
  const cleanup=registerMessageRealtimeClient(req.user.id,res)
  const peers=(await query(`SELECT DISTINCT cm2.user_id FROM message_conversation_members cm1
    JOIN message_conversation_members cm2 ON cm2.conversation_id=cm1.conversation_id
    WHERE cm1.user_id=$1 AND cm2.user_id<>$1`,[req.user.id])).rows.map(row=>row.user_id)
  const pending=(await query(`SELECT mr.message_id,m.conversation_id,m.sender_id FROM message_receipts mr
    JOIN app_messages m ON m.id=mr.message_id WHERE mr.user_id=$1 AND mr.delivered_at IS NULL`,[req.user.id])).rows
  if(pending.length){
    await query(`UPDATE message_receipts SET delivered_at=NOW() WHERE user_id=$1 AND delivered_at IS NULL`,[req.user.id])
    for(const receipt of pending)emitMessageEventToUser(receipt.sender_id,'delivered',{conversationId:receipt.conversation_id,messageId:receipt.message_id,userId:req.user.id})
  }
  emitMessageEventToUsers(peers,'presence',{userId:req.user.id,status:'Online',lastSeenAt:null})
  req.on('close',()=>{cleanup();emitMessageEventToUsers(peers,'presence',{userId:req.user.id,status:'Offline',lastSeenAt:new Date().toISOString()})})
}catch(error){next(error)}})

app.get('/api/messages/presence',authenticate,async(req,res,next)=>{try{
  const ids=(await query(`SELECT DISTINCT cm2.user_id FROM message_conversation_members cm1
    JOIN message_conversation_members cm2 ON cm2.conversation_id=cm1.conversation_id
    WHERE cm1.user_id=$1 AND cm2.user_id<>$1`,[req.user.id])).rows.map(row=>row.user_id)
  res.json(messagePresenceSnapshot(ids))
}catch(error){next(error)}})

app.post('/api/messages/presence',authenticate,validate(messagePresenceSchema),async(req,res,next)=>{try{
  const state=setMessagePresence(req.user.id,req.validated.status)
  const peers=(await query(`SELECT DISTINCT cm2.user_id FROM message_conversation_members cm1
    JOIN message_conversation_members cm2 ON cm2.conversation_id=cm1.conversation_id
    WHERE cm1.user_id=$1 AND cm2.user_id<>$1`,[req.user.id])).rows.map(row=>row.user_id)
  emitMessageEventToUsers(peers,'presence',state);res.json(state)
}catch(error){next(error)}})

app.post('/api/messages/conversations/:id/typing',authenticate,validate(messageTypingSchema),async(req,res,next)=>{try{
  if(!(await ensureMessageMember(req.user.id,req.params.id)))return res.status(403).json({error:'Conversation access denied.'})
  const recipients=(await query(`SELECT user_id FROM message_conversation_members WHERE conversation_id=$1 AND user_id<>$2`,
    [req.params.id,req.user.id])).rows.map(row=>row.user_id)
  emitMessageEventToUsers(recipients,'typing',{conversationId:req.params.id,userId:req.user.id,userName:req.user.name,typing:req.validated.typing})
  res.json({ok:true})
}catch(error){next(error)}})

app.get('/api/messages/users',authenticate,async(req,res,next)=>{try{
  const rows=(await query(`SELECT id,name,email,role,division,status FROM users WHERE active=TRUE AND id<>$1 ORDER BY name`,[req.user.id])).rows
  const states=new Map(messagePresenceSnapshot(rows.map(row=>row.id)).map(item=>[item.userId,item]))
  res.json(rows.map(row=>({...row,presence:states.get(row.id)?.status||'Offline',last_seen_at:states.get(row.id)?.lastSeenAt||null})))
}catch(error){next(error)}})

app.get('/api/messages/unread-count',authenticate,async(req,res,next)=>{try{
  const row=(await query(`SELECT COUNT(*)::int unread
    FROM app_messages m
    JOIN message_conversation_members cm ON cm.conversation_id=m.conversation_id AND cm.user_id=$1
    WHERE m.sender_id<>$1 AND m.created_at>cm.last_read_at`,[req.user.id])).rows[0]
  res.json({unread:Number(row?.unread||0)})
}catch(error){next(error)}})


app.get('/api/messages/recent-unread',authenticate,async(req,res,next)=>{try{
  const rows=(await query(`SELECT m.id,m.conversation_id,m.sender_id,m.body,m.created_at,
      u.name sender_name,c.kind,c.title,
      COALESCE((
        SELECT json_agg(json_build_object('id',mu.id,'name',mu.name) ORDER BY mu.name)
        FROM message_conversation_members mcm
        JOIN users mu ON mu.id=mcm.user_id
        WHERE mcm.conversation_id=m.conversation_id
      ),'[]'::json) members
    FROM app_messages m
    JOIN users u ON u.id=m.sender_id
    JOIN message_conversations c ON c.id=m.conversation_id
    JOIN message_conversation_members cm
      ON cm.conversation_id=m.conversation_id AND cm.user_id=$1
    WHERE m.sender_id<>$1 AND m.created_at>cm.last_read_at
    ORDER BY m.created_at DESC,m.id DESC
    LIMIT 8`,[req.user.id])).rows
  res.json(rows)
}catch(error){next(error)}})

app.get('/api/messages/conversations',authenticate,async(req,res,next)=>{try{
  const rows=(await query(`SELECT c.id,c.kind,c.title,c.owner_id,c.created_by,c.created_at,c.updated_at,
    COALESCE(json_agg(DISTINCT jsonb_build_object(
      'id',u.id,'name',u.name,'email',u.email,'role',u.role,'division',u.division
    )) FILTER(WHERE u.id IS NOT NULL),'[]'::json) members,
    (SELECT msg.body FROM app_messages msg WHERE msg.conversation_id=c.id ORDER BY msg.created_at DESC,msg.id DESC LIMIT 1) last_message,
    (SELECT msg.created_at FROM app_messages msg WHERE msg.conversation_id=c.id ORDER BY msg.created_at DESC,msg.id DESC LIMIT 1) last_message_at,
    (SELECT COUNT(*)::int FROM app_messages msg
      WHERE msg.conversation_id=c.id AND msg.sender_id<>$1 AND msg.created_at>me.last_read_at) unread_count
    FROM message_conversations c
    JOIN message_conversation_members me ON me.conversation_id=c.id AND me.user_id=$1
    JOIN message_conversation_members allm ON allm.conversation_id=c.id
    JOIN users u ON u.id=allm.user_id
    GROUP BY c.id,me.last_read_at
    ORDER BY COALESCE(
      (SELECT MAX(msg.created_at) FROM app_messages msg WHERE msg.conversation_id=c.id),
      c.updated_at
    ) DESC`,[req.user.id])).rows
  res.json(rows)
}catch(error){next(error)}})

app.post('/api/messages/conversations',authenticate,validate(messageConversationSchema),async(req,res,next)=>{try{
  const participantIds=[...new Set(req.validated.participantIds)].filter(id=>id!==req.user.id)
  if(!participantIds.length)return res.status(400).json({error:'Choose at least one other APP2 user.'})
  const available=(await query(`SELECT id,name FROM users WHERE active=TRUE AND id=ANY($1::uuid[])`,[participantIds])).rows
  if(available.length!==participantIds.length)return res.status(400).json({error:'One or more selected users are unavailable.'})

  const allIds=[req.user.id,...participantIds]
  const kind=participantIds.length===1?'Direct':'Group'
  const directKey=kind==='Direct'?[...allIds].sort().join(':'):null
  const groupTitle=kind==='Group'?(req.validated.title||available.slice(0,3).map(item=>item.name).join(', ')):null

  const conversation=await transaction(async client=>{
    let row
    if(directKey){
      row=(await client.query(`SELECT * FROM message_conversations WHERE direct_key=$1`,[directKey])).rows[0]
      if(row)return row
    }
    row=(await client.query(`INSERT INTO message_conversations(kind,title,direct_key,created_by,owner_id)
      VALUES($1,$2,$3,$4,$4) RETURNING *`,[kind,groupTitle,directKey,req.user.id])).rows[0]
    for(const userId of allIds){
      await client.query(`INSERT INTO message_conversation_members(conversation_id,user_id,last_read_at)
        VALUES($1,$2,NOW()) ON CONFLICT DO NOTHING`,[row.id,userId])
    }
    await audit(client,req.user.id,'MESSAGE_CONVERSATION_CREATED','message_conversation',row.id,{
      kind,participant_count:participantIds.length
    })
    return row
  })
  res.status(201).json(conversation)
}catch(error){next(error)}})


app.get('/api/messages/conversations/:id/info',authenticate,async(req,res,next)=>{try{
  const access=await messageConversationAccess(req.user,req.params.id)
  if(!access||!access.is_member)return res.status(403).json({error:'Conversation access denied.'})
  const members=(await query(`SELECT u.id,u.name,u.email,u.role,u.division,
      CASE WHEN u.id=c.owner_id THEN TRUE ELSE FALSE END is_owner
    FROM message_conversation_members cm
    JOIN users u ON u.id=cm.user_id
    JOIN message_conversations c ON c.id=cm.conversation_id
    WHERE cm.conversation_id=$1
    ORDER BY CASE WHEN u.id=c.owner_id THEN 0 ELSE 1 END,u.name`,[req.params.id])).rows
  res.json({...access,members})
}catch(error){next(error)}})

app.get('/api/messages/conversations/:id/events',authenticate,async(req,res,next)=>{try{
  const access=await messageConversationAccess(req.user,req.params.id)
  if(!access||!access.is_member)return res.status(403).json({error:'Conversation access denied.'})
  const rows=(await query(`SELECT e.id,e.conversation_id,e.actor_id,a.name actor_name,
      e.event_type,e.target_user_id,t.name target_user_name,e.details,e.created_at
    FROM message_conversation_events e
    JOIN users a ON a.id=e.actor_id
    LEFT JOIN users t ON t.id=e.target_user_id
    WHERE e.conversation_id=$1
    ORDER BY e.created_at ASC,e.id ASC
    LIMIT 300`,[req.params.id])).rows
  res.json(rows)
}catch(error){next(error)}})

app.patch('/api/messages/conversations/:id',authenticate,validate(messageGroupRenameSchema),async(req,res,next)=>{try{
  const access=await messageConversationAccess(req.user,req.params.id)
  if(!access||!access.is_member)return res.status(403).json({error:'Conversation access denied.'})
  if(access.kind!=='Group')return res.status(409).json({error:'Only group conversations can be renamed.'})
  if(!access.can_manage)return res.status(403).json({error:'Only the group owner or System Admin can rename this group.'})
  const previous=access.title||''
  const row=(await query(`UPDATE message_conversations SET title=$1,updated_at=NOW() WHERE id=$2 RETURNING *`,
    [req.validated.title,req.params.id])).rows[0]
  await query(`INSERT INTO message_conversation_events(conversation_id,actor_id,event_type,details)
    VALUES($1,$2,'Group Renamed',$3)`,[req.params.id,req.user.id,JSON.stringify({from:previous,to:req.validated.title})])
  await query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES($1,'MESSAGE_GROUP_RENAMED','message_conversation',$2,$3)",
    [req.user.id,req.params.id,JSON.stringify({from:previous,to:req.validated.title})])
  res.json(row)
}catch(error){next(error)}})

app.post('/api/messages/conversations/:id/members',authenticate,validate(messageGroupMembersSchema),async(req,res,next)=>{try{
  const access=await messageConversationAccess(req.user,req.params.id)
  if(!access||!access.is_member)return res.status(403).json({error:'Conversation access denied.'})
  if(access.kind!=='Group')return res.status(409).json({error:'Members can only be added to group conversations.'})
  if(!access.can_manage)return res.status(403).json({error:'Only the group owner or System Admin can add members.'})
  const ids=[...new Set(req.validated.memberIds)]
  const available=(await query(`SELECT id,name FROM users WHERE active=TRUE AND id=ANY($1::uuid[])`,[ids])).rows
  if(available.length!==ids.length)return res.status(400).json({error:'One or more selected users are unavailable.'})
  const current=(await query(`SELECT COUNT(*)::int total FROM message_conversation_members WHERE conversation_id=$1`,[req.params.id])).rows[0]
  const existing=(await query(`SELECT user_id FROM message_conversation_members WHERE conversation_id=$1 AND user_id=ANY($2::uuid[])`,
    [req.params.id,ids])).rows.map(row=>row.user_id)
  const additions=available.filter(user=>!existing.includes(user.id))
  if(Number(current.total||0)+additions.length>MESSAGE_GROUP_MEMBER_LIMIT)return res.status(400).json({error:`A group conversation can contain at most ${MESSAGE_GROUP_MEMBER_LIMIT} members.`})
  await transaction(async client=>{
    for(const member of additions){
      await client.query(`INSERT INTO message_conversation_members(conversation_id,user_id,last_read_at)
        VALUES($1,$2,NOW()) ON CONFLICT DO NOTHING`,[req.params.id,member.id])
      await client.query(`INSERT INTO message_conversation_events(conversation_id,actor_id,event_type,target_user_id,details)
        VALUES($1,$2,'Member Added',$3,'{}'::jsonb)`,[req.params.id,req.user.id,member.id])
    }
    await client.query(`UPDATE message_conversations SET updated_at=NOW() WHERE id=$1`,[req.params.id])
    await audit(client,req.user.id,'MESSAGE_GROUP_MEMBERS_ADDED','message_conversation',req.params.id,{memberIds:additions.map(item=>item.id)})
  })
  res.json({added:additions})
}catch(error){next(error)}})

app.delete('/api/messages/conversations/:id/members/:userId',authenticate,async(req,res,next)=>{try{
  const access=await messageConversationAccess(req.user,req.params.id)
  if(!access||!access.is_member)return res.status(403).json({error:'Conversation access denied.'})
  if(access.kind!=='Group')return res.status(409).json({error:'Members can only be removed from group conversations.'})
  if(!access.can_manage)return res.status(403).json({error:'Only the group owner or System Admin can remove members.'})
  if(req.params.userId===access.owner_id)return res.status(409).json({error:'The group owner cannot be removed.'})
  const target=(await query(`SELECT u.id,u.name FROM message_conversation_members cm JOIN users u ON u.id=cm.user_id
    WHERE cm.conversation_id=$1 AND cm.user_id=$2`,[req.params.id,req.params.userId])).rows[0]
  if(!target)return res.status(404).json({error:'Group member not found.'})
  await transaction(async client=>{
    await client.query(`DELETE FROM message_conversation_members WHERE conversation_id=$1 AND user_id=$2`,
      [req.params.id,req.params.userId])
    await client.query(`INSERT INTO message_conversation_events(conversation_id,actor_id,event_type,target_user_id,details)
      VALUES($1,$2,'Member Removed',$3,$4)`,[req.params.id,req.user.id,req.params.userId,JSON.stringify({name:target.name})])
    await client.query(`UPDATE message_conversations SET updated_at=NOW() WHERE id=$1`,[req.params.id])
    await audit(client,req.user.id,'MESSAGE_GROUP_MEMBER_REMOVED','message_conversation',req.params.id,{memberId:req.params.userId})
  })
  res.json({ok:true})
}catch(error){next(error)}})

app.get('/api/messages/conversations/:id',authenticate,async(req,res,next)=>{try{
  if(!(await ensureMessageMember(req.user.id,req.params.id)))return res.status(403).json({error:'Conversation access denied.'})
  const rows=(await query(`SELECT m.id,m.conversation_id,m.body,m.context_type,m.context_id,m.context_title,m.created_at,m.reply_to_message_id,
      m.sender_id,u.name sender_name,u.role sender_role,
      reply.body reply_body,reply_user.name reply_sender_name,
      (SELECT COUNT(*)::int FROM message_receipts mr WHERE mr.message_id=m.id) recipient_count,
      (SELECT COUNT(*)::int FROM message_receipts mr WHERE mr.message_id=m.id AND mr.delivered_at IS NOT NULL) delivered_count,
      (SELECT COUNT(*)::int FROM message_receipts mr WHERE mr.message_id=m.id AND mr.read_at IS NOT NULL) read_count,
      COALESCE((SELECT json_agg(json_build_object('emoji',x.emoji,'count',x.total,'me',x.me) ORDER BY x.emoji) FROM (
        SELECT r.emoji,COUNT(*)::int total,BOOL_OR(r.user_id=$2) me FROM message_reactions r WHERE r.message_id=m.id GROUP BY r.emoji
      ) x),'[]'::json) reactions,
      COALESCE((SELECT json_agg(json_build_object('id',a.id,'original_name',a.original_name,'mime_type',a.mime_type,'size_bytes',a.size_bytes) ORDER BY a.created_at)
        FROM message_attachments a WHERE a.message_id=m.id),'[]'::json) attachments
    FROM app_messages m JOIN users u ON u.id=m.sender_id
    LEFT JOIN app_messages reply ON reply.id=m.reply_to_message_id
    LEFT JOIN users reply_user ON reply_user.id=reply.sender_id
    WHERE m.conversation_id=$1 ORDER BY m.created_at ASC,m.id ASC LIMIT 500`,[req.params.id,req.user.id])).rows
  res.json(rows)
}catch(error){next(error)}})

app.post('/api/messages/conversations/:id/read',authenticate,async(req,res,next)=>{try{
  if(!(await ensureMessageMember(req.user.id,req.params.id)))return res.status(403).json({error:'Conversation access denied.'})
  const now=new Date().toISOString()
  await transaction(async client=>{
    await client.query(`UPDATE message_conversation_members SET last_read_at=NOW() WHERE conversation_id=$1 AND user_id=$2`,[req.params.id,req.user.id])
    await client.query(`UPDATE message_receipts mr SET delivered_at=COALESCE(delivered_at,NOW()),read_at=NOW()
      FROM app_messages m WHERE mr.message_id=m.id AND m.conversation_id=$1 AND mr.user_id=$2 AND mr.read_at IS NULL`,
      [req.params.id,req.user.id])
  })
  const peers=(await query(`SELECT user_id FROM message_conversation_members WHERE conversation_id=$1 AND user_id<>$2`,
    [req.params.id,req.user.id])).rows.map(row=>row.user_id)
  emitMessageEventToUsers(peers,'read',{conversationId:req.params.id,userId:req.user.id,readAt:now})
  res.json({ok:true})
}catch(error){next(error)}})

app.post('/api/messages/conversations/:id/messages',authenticate,validate(messageSendSchema),async(req,res,next)=>{try{
  if(!(await ensureMessageMember(req.user.id,req.params.id)))return res.status(403).json({error:'Conversation access denied.'})
  const v=req.validated
  const message=await transaction(async client=>{
    if(v.replyToMessageId){
      const reply=(await client.query(`SELECT 1 FROM app_messages WHERE id=$1 AND conversation_id=$2`,[v.replyToMessageId,req.params.id])).rows[0]
      if(!reply)throw Object.assign(new Error('Reply target is not part of this conversation.'),{statusCode:400})
    }
    const row=(await client.query(`INSERT INTO app_messages(
      conversation_id,sender_id,body,context_type,context_id,context_title,reply_to_message_id
    ) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id,req.user.id,v.body,v.contextType||null,v.contextId||null,v.contextTitle||null,v.replyToMessageId||null])).rows[0]
    await client.query(`UPDATE message_conversations SET updated_at=NOW() WHERE id=$1`,[req.params.id])
    await client.query(`UPDATE message_conversation_members SET last_read_at=NOW()
      WHERE conversation_id=$1 AND user_id=$2`,[req.params.id,req.user.id])
    const recipients=(await client.query(`SELECT cm.user_id,u.name FROM message_conversation_members cm
      JOIN users u ON u.id=cm.user_id WHERE cm.conversation_id=$1 AND cm.user_id<>$2`,[req.params.id,req.user.id])).rows
    const sender=(await client.query(`SELECT name FROM users WHERE id=$1`,[req.user.id])).rows[0]
    const conversation=(await client.query(`SELECT kind,title FROM message_conversations WHERE id=$1`,[req.params.id])).rows[0]
    for(const recipient of recipients){
      await client.query(`INSERT INTO message_receipts(message_id,user_id,delivered_at)
        VALUES($1,$2,$3) ON CONFLICT(message_id,user_id) DO NOTHING`,
        [row.id,recipient.user_id,isMessageUserOnline(recipient.user_id)?new Date():null])
      await client.query(`INSERT INTO notifications(
        user_id,title,body,entity_type,entity_id,priority,action,target_workspace,event_key,notification_category
      ) VALUES($1,$2,$3,'message_conversation',$4,'Normal','Open messages','Messages',$5,'Information')
      ON CONFLICT(user_id,event_key) WHERE event_key IS NOT NULL DO NOTHING`,
      [recipient.user_id,`New message from ${sender?.name||'APP2 user'}`,
       v.body.length>180?v.body.slice(0,177)+'...':v.body,req.params.id,
       `message:${row.id}:${recipient.user_id}`])
    }
    await audit(client,req.user.id,'MESSAGE_SENT','message_conversation',req.params.id,{message_id:row.id})
    return {...row,sender_name:sender?.name||'APP2 user',recipientIds:recipients.map(item=>item.user_id),
      conversation_kind:conversation?.kind||'Direct',conversation_title:conversation?.title||null}
  })
  emitMessageEventToUsers(message.recipientIds,'message',{
    id:message.id,conversationId:req.params.id,senderId:req.user.id,senderName:message.sender_name,
    body:message.body,createdAt:message.created_at,kind:message.conversation_kind,title:message.conversation_title
  })
  emitMessageEventToUser(req.user.id,'sent',{conversationId:req.params.id,messageId:message.id})
  const {recipientIds,sender_name,conversation_kind,conversation_title,...responseMessage}=message
  res.status(201).json(responseMessage)
}catch(error){next(error)}})

registerRichMessagingRoutes(app,{authenticate})

app.get('/api/settings/email-status',authenticate,authorize('System Admin'),(_req,res)=>res.json(mailStatus()))
app.get('/api/settings/notification-email-status',authenticate,authorize('System Admin'),async(_req,res,next)=>{try{
  const counts=(await query(`SELECT email_status,COUNT(*)::int total FROM notifications WHERE email_eligible=TRUE GROUP BY email_status ORDER BY email_status`)).rows
  res.json({mailer:mailStatus(),queue:counts})
}catch(error){next(error)}})
const allowAdminEmailTest=createAdminEmailCooldown()
app.post('/api/settings/test-email',authenticate,authorize('System Admin'),validate(testEmailSchema),async(req,res,next)=>{const limit=allowAdminEmailTest(req.user.id);if(!limit.allowed)return res.status(429).json({error:`Please wait ${limit.retryAfterSeconds} seconds before sending another test email.`});try{const result=await sendMail({to:req.validated.email,subject:'PSC APP2 email delivery test',text:`This test confirms that PSC APP2 submitted an email to ${req.validated.email}.`});if(!result.accepted?.length)throw Object.assign(new Error('SMTP did not accept the test email recipient.'),{statusCode:502});await query("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)VALUES($1,'TEST_EMAIL_SUBMITTED','settings','email',$2)",[req.user.id,JSON.stringify({recipient:req.validated.email,messageId:result.messageId})]);res.json({message:`SMTP accepted the test email for ${req.validated.email}; inbox delivery is not confirmed.`,status:'accepted'})}catch(error){next(error)}})
const systemSettingsSchema=z.object({organizationName:z.string().min(3).max(200),departmentName:z.string().min(3).max(200),supportEmail:z.string().email().max(255),sessionMinutes:z.number().int().min(15).max(1440),maxUploadMb:z.number().int().min(1).max(500),defaultRetentionDays:z.number().int().min(30).max(7300),documentCategories:z.array(z.string().min(2).max(100)).min(1).max(30),maintenanceMode:z.boolean(),emailNotifications:z.boolean()})
const preferenceSchema=z.object({emailNotifications:z.boolean(),inAppNotifications:z.boolean(),importantEmailNotifications:z.boolean().default(true),deadlineReminders:z.boolean().default(true),compactLayout:z.boolean(),themeMode:z.enum(['Dark','Light','System','Gold Grey','Navy Blue','PSC Slate','Low-Contrast Navy','Executive Gold','Sage Ivory']),accentColor:z.enum(['Gold','Blue','Green'])})
app.get('/api/settings',authenticate,async(req,res,next)=>{try{await query('INSERT INTO system_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING');const [system,preferences,health]=await Promise.all([query('SELECT organization_name,department_name,support_email,session_minutes,max_upload_mb,default_retention_days,document_categories,maintenance_mode,email_notifications,updated_at FROM system_settings WHERE id=1'),query('SELECT email_notifications,in_app_notifications,important_email_notifications,deadline_reminders,compact_layout,theme_mode,accent_color,updated_at FROM user_preferences WHERE user_id=$1',[req.user.id]),query('SELECT NOW() database_time')]);res.json({system:system.rows[0],preferences:preferences.rows[0]||{email_notifications:true,in_app_notifications:true,important_email_notifications:true,deadline_reminders:true,compact_layout:false,theme_mode:'Executive Gold',accent_color:'Gold'},health:{api:'healthy',database:'connected',environment:config.environment,database_time:health.rows[0].database_time,configured_upload_limit_mb:config.maxUploadMb,configured_session:config.jwtExpiresIn}})}catch(error){next(error)}})
app.get('/api/settings/updates',authenticate,async(_req,res,next)=>{try{const database=await query('SELECT current_database() database,VERSION() version,NOW() checked_at');res.json({application:'PSC APP2',applicationVersion:'0.1.0',apiVersion:'0.1.0',runtime:process.version,database:database.rows[0].database,databaseVersion:String(database.rows[0].version).split(' on ')[0],status:'Installed services healthy',updateChannel:'Manual / GitHub',automaticUpdates:false,checkedAt:database.rows[0].checked_at})}catch(error){next(error)}})
app.patch('/api/settings/system',authenticate,authorize('System Admin'),validate(systemSettingsSchema),async(req,res,next)=>{try{const v=req.validated;const updated=await transaction(async client=>{const row=(await client.query(`INSERT INTO system_settings(id,organization_name,department_name,support_email,session_minutes,max_upload_mb,default_retention_days,document_categories,maintenance_mode,email_notifications,updated_by,updated_at)
  VALUES(1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) ON CONFLICT(id) DO UPDATE SET organization_name=EXCLUDED.organization_name,department_name=EXCLUDED.department_name,support_email=EXCLUDED.support_email,session_minutes=EXCLUDED.session_minutes,max_upload_mb=EXCLUDED.max_upload_mb,default_retention_days=EXCLUDED.default_retention_days,document_categories=EXCLUDED.document_categories,maintenance_mode=EXCLUDED.maintenance_mode,email_notifications=EXCLUDED.email_notifications,updated_by=EXCLUDED.updated_by,updated_at=NOW() RETURNING *`,[v.organizationName,v.departmentName,v.supportEmail,v.sessionMinutes,v.maxUploadMb,v.defaultRetentionDays,[...new Set(v.documentCategories.map(value=>value.trim()))],v.maintenanceMode,v.emailNotifications,req.user.id])).rows[0];await audit(client,req.user.id,'SYSTEM_SETTINGS_UPDATED','settings','1',{maintenanceMode:v.maintenanceMode,sessionMinutes:v.sessionMinutes,maxUploadMb:v.maxUploadMb});return row});res.json(updated)}catch(error){next(error)}})
app.patch('/api/settings/preferences',authenticate,validate(preferenceSchema),async(req,res,next)=>{try{const v=req.validated;const row=(await query('INSERT INTO user_preferences(user_id,email_notifications,in_app_notifications,important_email_notifications,deadline_reminders,compact_layout,theme_mode,accent_color)VALUES($1,$2,$3,$4,$5,$6,$7,$8)ON CONFLICT(user_id)DO UPDATE SET email_notifications=$2,in_app_notifications=$3,important_email_notifications=$4,deadline_reminders=$5,compact_layout=$6,theme_mode=$7,accent_color=$8,updated_at=NOW()RETURNING *',[req.user.id,v.emailNotifications,v.inAppNotifications,v.importantEmailNotifications,v.deadlineReminders,v.compactLayout,v.themeMode,v.accentColor])).rows[0];res.json(row)}catch(error){next(error)}})

registerMeetingsRoutes(app)

app.use((_req,res)=>res.status(404).json({error:'API endpoint not found.'}))
app.use((error,_req,res,_next)=>{console.error(error);const status=Number(error.statusCode||error.status)||500;res.status(status).json({error:status>=500&&config.environment==='production'?'The service could not complete your request.':error.message})})
// APP2_REPOSITORY_SYNC_OUTBOX_R2
// Primary domain data and a Repository-sync job are committed in the same DB transaction.
// Repository rendering runs after commit, so renderer/storage failures cannot roll back user work.
async function enqueueRepositorySyncJob(client, { jobKind, entityId, parentId = null, actor }) {
  if (!actor?.id) throw Object.assign(new Error('A Repository sync job requires an authenticated user.'), { statusCode: 401 });
  const actorSnapshot = {
    id: actor.id,
    name: actor.name || null,
    email: actor.email || null,
    role: actor.role || null,
  };
  const result = await client.query(
    'INSERT INTO repository_sync_queue(job_kind,entity_id,parent_id,requested_by,actor_snapshot) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING id',
    [jobKind, entityId, parentId, actor.id, JSON.stringify(actorSnapshot)],
  );
  return result.rows[0]?.id ?? null;
}

async function saveRepositorySyncAndCompleteJob(job, saveWithClient) {
  return transaction(async (client) => {
    const saved = await saveWithClient(client);
    await client.query(
      "UPDATE repository_sync_queue SET status='done',repository_document_id=$1,repository_version=$2,last_error=NULL,locked_at=NULL,updated_at=NOW(),last_succeeded_at=NOW() WHERE id=$3",
      [saved?.documentId || null, Number.isFinite(Number(saved?.version)) ? Number(saved.version) : null, job.id],
    );
    return saved;
  });
}

async function renderRepositorySyncJob(job) {
  const actor = job.actor_snapshot || {};
  if (!actor.id) throw new Error('Repository sync job has no originating user identity.');

  if (job.job_kind === 'assignment_draft') {
    const assignment = (await query('SELECT * FROM assignments WHERE id=$1', [job.entity_id])).rows[0];
    if (!assignment) throw new Error('Assignment no longer exists; its Repository draft cannot be synchronized.');
    const bytes = buildAssignmentDraftSnapshot(assignment);
    return saveRepositorySyncAndCompleteJob(job, (client) => savePrivateDraftRepositoryVersion({
      client, actor, ownerId: assignment.created_by || actor.id,
      entityType: 'assignment', entityId: assignment.id, assignmentId: assignment.id,
      title: `${assignment.title} - Assignment Draft`,
      description: `Private working draft for assignment "${assignment.title}".`,
      documentType: 'Assignment Draft', subject: assignment.title, sourceType: 'Assignment',
      tags: ['draft', 'assignment', 'working-copy'], bytes, storeDocument, audit,
    }));
  }

  if (job.job_kind === 'task_draft') {
    const task = (await query('SELECT * FROM assignment_tasks WHERE id=$1 AND assignment_id=$2', [job.entity_id, job.parent_id])).rows[0];
    if (!task) throw new Error('Task no longer exists; its Repository draft cannot be synchronized.');
    const assignment = (await query('SELECT id,title FROM assignments WHERE id=$1', [job.parent_id])).rows[0] || null;
    return saveRepositorySyncAndCompleteJob(job, (client) => savePrivateDraftRepositoryVersion({
      client, actor, ownerId: task.owner_id || task.created_by || actor.id,
      entityType: 'task', entityId: task.id, assignmentId: job.parent_id,
      title: `${task.title} - Task Draft`,
      description: `Private working draft for task "${task.title}".`,
      documentType: 'Task Draft', subject: assignment?.title || task.title, sourceType: 'Task',
      tags: ['draft', 'task', 'working-copy'],
      bytes: buildTaskDraftSnapshot({ task, assignment }), storeDocument, audit,
    }));
  }

  if (job.job_kind === 'task_report_draft') {
    const task = (await query('SELECT t.*,u.name owner_name FROM assignment_tasks t LEFT JOIN users u ON u.id=t.owner_id WHERE t.id=$1 AND t.assignment_id=$2', [job.entity_id, job.parent_id])).rows[0];
    if (!task) throw new Error('Task no longer exists; its Task Report draft cannot be synchronized.');
    const assignment = (await query('SELECT id,title FROM assignments WHERE id=$1', [job.parent_id])).rows[0] || null;
    const contributionTitle = String(task.contribution_title || '');
    const title = /task report draft$/i.test(contributionTitle)
      ? contributionTitle
      : `${contributionTitle || task.title} - Task Report Draft`;
    return saveRepositorySyncAndCompleteJob(job, (client) => savePrivateDraftRepositoryVersion({
      client, actor, ownerId: task.owner_id || task.created_by || actor.id,
      entityType: 'task', entityId: task.id, assignmentId: job.parent_id,
      title, description: `Private TASK Report draft for "${task.title}".`,
      documentType: 'Task Report Draft', subject: assignment?.title || task.title, sourceType: 'Task',
      tags: ['draft', 'task-report', 'working-copy'],
      bytes: buildTaskReportDraftSnapshot({ task, assignment, ownerName: actor.name || task.owner_name }),
      fileExtension: '.html', storeDocument, audit,
    }));
  }

  if (job.job_kind === 'assignment_report_draft') {
    const document = (await query(
      "SELECT gd.*,a.title assignment_title FROM generated_documents gd LEFT JOIN assignments a ON a.id=gd.context_id AND gd.context='Assignment' WHERE gd.id=$1 AND gd.context='Assignment'",
      [job.entity_id],
    )).rows[0];
    if (!document) throw new Error('Assignment report no longer exists; its Repository draft cannot be synchronized.');
    const sections = (await query('SELECT title,content,section_order FROM generated_document_sections WHERE document_id=$1 ORDER BY section_order', [document.id])).rows;
    return saveRepositorySyncAndCompleteJob(job, (client) => savePrivateDraftRepositoryVersion({
      client, actor, ownerId: document.created_by || actor.id,
      entityType: 'report', entityId: document.id, assignmentId: document.context_id,
      title: `${document.title} - Draft`,
      description: `Private working draft of assignment report "${document.title}".`,
      documentType: 'Assignment Report Draft', subject: document.assignment_title || document.title,
      sourceType: 'App2 Report', tags: ['draft', 'assignment-report', 'working-copy'],
      bytes: buildGeneratedReportDraftSnapshot({ document, sections }),
      fileExtension: '.html', storeDocument, audit,
    }));
  }

  if (job.job_kind === 'research_report_draft') {
    const project = (await query('SELECT * FROM research_projects WHERE id=$1', [job.entity_id])).rows[0];
    if (!project) throw new Error('Research project no longer exists; its Repository draft cannot be synchronized.');
    const sections = (await query('SELECT * FROM research_report_sections WHERE project_id=$1 ORDER BY section_order', [project.id])).rows;
    const team = (await query(
      `SELECT u.id,u.name,'Lead Researcher' role,0 role_order FROM users u WHERE u.id=$1
       UNION ALL SELECT u.id,u.name,rc.role,1 FROM research_collaborators rc JOIN users u ON u.id=rc.user_id WHERE rc.project_id=$2
       UNION ALL SELECT u.id,u.name,COALESCE(rr.review_role,'Formal Reviewer'),2 FROM research_reviewers rr JOIN users u ON u.id=rr.reviewer_id WHERE rr.project_id=$2 AND rr.active=TRUE
       ORDER BY role_order,name`,
      [project.lead_id, project.id],
    )).rows;
    let storedPath = null;
    try {
      const artifact = await buildResearchDraftArtifact({ project, sections, team, actorName: actor.name, storeDocument, savedAt: job.created_at });
      storedPath = artifact.stored?.absolutePath || null;
      const saved = await saveRepositorySyncAndCompleteJob(job, (client) => saveResearchDraftRepositoryVersion({
        client, project, actor, artifact, teamUserIds: team.map((member) => member.id), audit,
      }));
      if (!saved.versionCreated && storedPath) {
        await fs.unlink(storedPath).catch(() => {});
        storedPath = null;
      }
      if (saved.versionCreated) storedPath = null;
      return saved;
    } finally {
      if (storedPath) await fs.unlink(storedPath).catch(() => {});
    }
  }

  throw new Error(`Unsupported Repository sync job kind: ${String(job.job_kind)}`);
}

async function completeClaimedRepositorySyncJob(job) {
  try {
    // Each renderer commits the Repository artifact and marks this job done in the same
    // transaction. This closes the crash window that could otherwise create duplicate versions.
    await renderRepositorySyncJob(job);
  } catch (error) {
    const message = String(error?.message || error).slice(0, 1800);
    const attempts = Number(job.attempts || 1);
    const status = attempts >= 10 ? 'dead' : 'retry';
    const delayMs = Math.min(900000, 5000 * (2 ** Math.min(attempts, 8)));
    await query(
      "UPDATE repository_sync_queue SET status=$1,last_error=$2,available_at=NOW()+($3::integer * INTERVAL '1 millisecond'),locked_at=NULL,updated_at=NOW() WHERE id=$4",
      [status, message, delayMs, job.id],
    ).catch((updateError) => console.error('APP2_REPOSITORY_SYNC_STATUS_UPDATE_FAILED', { jobId: job.id, error: String(updateError?.message || updateError) }));
    console.error('APP2_REPOSITORY_SYNC_JOB_FAILED', { jobId: job.id, jobKind: job.job_kind, entityId: job.entity_id, status, error: message });
  }
  return (await query('SELECT * FROM repository_sync_queue WHERE id=$1', [job.id])).rows[0] || null;
}

async function claimOneRepositorySyncJob(jobId) {
  return transaction(async (client) => (await client.query(
    "UPDATE repository_sync_queue SET status='processing',attempts=attempts+1,locked_at=NOW(),updated_at=NOW() WHERE id=$1 AND status IN('pending','retry') AND available_at<=NOW() RETURNING *",
    [jobId],
  )).rows[0] || null);
}

async function runRepositorySyncJob(jobId) {
  if (!jobId) return null;
  const job = await claimOneRepositorySyncJob(jobId);
  if (job) return completeClaimedRepositorySyncJob(job);
  return (await query('SELECT * FROM repository_sync_queue WHERE id=$1', [jobId])).rows[0] || null;
}

async function runAndReadRepositorySync(jobId) {
  if (!jobId) {
    return {
      repository_sync_job_id: null,
      repository_sync_status: 'unavailable',
      repository_sync_message: 'Your primary save was committed, but Repository synchronization could not be queued. Contact the APP2 administrator to reconcile the draft.',
    };
  }
  try {
    await runRepositorySyncJob(jobId);
    const row = (await query('SELECT * FROM repository_sync_queue WHERE id=$1', [jobId])).rows[0];
    if (!row) return {
      repository_sync_job_id: jobId,
      repository_sync_status: 'retry',
      repository_sync_message: 'Your primary save was committed. Repository synchronization is queued for retry.',
    };
    const status = row.status;
    return {
      repository_sync_job_id: row.id,
      repository_sync_status: status,
      repository_sync_error: row.last_error || undefined,
      repository_sync_message: status === 'done'
        ? 'Repository copy is up to date.'
        : status === 'dead'
          ? 'Your primary save is safe, but Repository synchronization needs administrator attention.'
          : 'Your primary save is safe. Repository synchronization is queued for automatic retry.',
      repository_draft_id: row.repository_document_id || undefined,
      repository_draft_version: row.repository_version == null ? undefined : Number(row.repository_version),
      repository_document_id: row.repository_document_id || undefined,
      repository_version: row.repository_version == null ? undefined : Number(row.repository_version),
    };
  } catch (error) {
    console.error('APP2_REPOSITORY_SYNC_ATTEMPT_FAILED', { jobId, error: error instanceof Error ? error.message : String(error) });
    return {
      repository_sync_job_id: jobId,
      repository_sync_status: 'retry',
      repository_sync_error: error instanceof Error ? error.message : String(error),
      repository_sync_message: 'Your primary save was committed. Repository synchronization is queued for automatic retry.',
    };
  }
}

async function drainRepositorySyncQueue() {
  // Recover jobs left in processing if the previous backend process stopped mid-job.
  await query("UPDATE repository_sync_queue SET status='retry',locked_at=NULL,available_at=NOW(),updated_at=NOW() WHERE status='processing' AND locked_at < NOW() - INTERVAL '15 minutes'");
  const jobs = await transaction(async (client) => (await client.query(
    `WITH ready AS (
       SELECT id FROM repository_sync_queue WHERE status IN('pending','retry') AND available_at<=NOW()
       ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 5
     )
     UPDATE repository_sync_queue q SET status='processing',attempts=q.attempts+1,locked_at=NOW(),updated_at=NOW()
     FROM ready WHERE q.id=ready.id RETURNING q.*`,
  )).rows);
  for (const job of jobs) await completeClaimedRepositorySyncJob(job);
}

let repositorySyncDrainActive = false;
const repositorySyncDrainTimer = setInterval(() => {
  if (repositorySyncDrainActive) return;
  repositorySyncDrainActive = true;
  void drainRepositorySyncQueue().catch((error) => {
    console.error('APP2_REPOSITORY_SYNC_WORKER_ERROR', error instanceof Error ? error.message : String(error));
  }).finally(() => { repositorySyncDrainActive = false; });
}, 5000);
repositorySyncDrainTimer.unref?.();
// END APP2_REPOSITORY_SYNC_OUTBOX_R2

export default app
