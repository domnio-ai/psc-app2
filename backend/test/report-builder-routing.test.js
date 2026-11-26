import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const readTree=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const target=new URL(entry.name+(entry.isDirectory()?'/':''),directory)
  return entry.isDirectory()?readTree(target):/\.(?:ts|tsx)$/.test(entry.name)?[fs.readFileSync(target,'utf8')]:[]
})
const appRoot=new URL('../../src/',import.meta.url)
const app=[
  fs.readFileSync(new URL('App.tsx',appRoot),'utf8'),
  fs.readFileSync(new URL('main.tsx',appRoot),'utf8'),
  fs.readFileSync(new URL('app-styles.css',appRoot),'utf8'),
  ...readTree(new URL('modules/assignments/',appRoot)),
  ...readTree(new URL('modules/research/',appRoot)),
  ...readTree(new URL('modules/tasks/',appRoot)),
].join('\n')
const assignmentBuilder=fs.readFileSync(new URL('../../src/modules/assignments/components/AssignmentReportBuilder.tsx',import.meta.url),'utf8')
const assignmentReports=fs.readFileSync(new URL('../../src/modules/assignments/components/AssignmentReportsPanel.tsx',import.meta.url),'utf8')
const backend=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
const appShell=fs.readFileSync(new URL('../../src/components/AppShell.tsx',import.meta.url),'utf8')
const compactLayout=fs.readFileSync(new URL('../../src/app2-compact-layout.css',import.meta.url),'utf8')
const interactiveVisuals=fs.readFileSync(new URL('../../src/app2-interactive-visuals.css',import.meta.url),'utf8')
const readerContrast=fs.readFileSync(new URL('../../src/app2-reader-contrast-fix.css',import.meta.url),'utf8')
const typographyHierarchy=fs.readFileSync(new URL('../../src/app2-typography-hierarchy.css',import.meta.url),'utf8')
const lightThemePolish=fs.readFileSync(new URL('../../src/app2-light-theme-polish.css',import.meta.url),'utf8')
const pscSlateTheme=fs.readFileSync(new URL('../../src/app2-psc-slate-theme.css',import.meta.url),'utf8')
const lowContrastNavyTheme=fs.readFileSync(new URL('../../src/app2-low-contrast-navy-theme.css',import.meta.url),'utf8')
const researchTeamContrast=fs.readFileSync(new URL('../../src/research-team-professional-contrast.css',import.meta.url),'utf8')
const themeProvider=fs.readFileSync(new URL('../../src/components/ThemeProvider.tsx',import.meta.url),'utf8')
const themePreferences=fs.readFileSync(new URL('../../src/theme-preferences.ts',import.meta.url),'utf8')
const schema=fs.readFileSync(new URL('../src/schema.sql',import.meta.url),'utf8')
const documentReader=fs.readFileSync(new URL('../../src/DocumentReader.tsx',import.meta.url),'utf8')
const assignmentReportReader=fs.readFileSync(new URL('../../src/modules/assignments/components/AssignmentReportReader.tsx',import.meta.url),'utf8')
const taskSectionWorkspace=fs.readFileSync(new URL('../../src/modules/assignments/components/TaskSectionWorkspace.tsx',import.meta.url),'utf8')
const reportCatalog=fs.readFileSync(new URL('../../src/modules/report-builder/services/reportCatalog.ts',import.meta.url),'utf8')
const researchEditorRibbon=fs.readFileSync(new URL('../../src/research-editor-ribbon-v14-8.css',import.meta.url),'utf8')
const researchWorkspaceSimplified=fs.readFileSync(new URL('../../src/research-workspace-simplified-v6.css',import.meta.url),'utf8')
const institutionalReports=fs.readFileSync(new URL('../../src/modules/reports/pages/InstitutionalReportsDashboard.tsx',import.meta.url),'utf8')
const reportFormatting=fs.readFileSync(new URL('../../src/modules/reports/utils/reportFormatting.ts',import.meta.url),'utf8')
const noticeBoard=fs.readFileSync(new URL('../../src/NoticeBoardWorkspace.tsx',import.meta.url),'utf8')
const noticeBoardStyles=fs.readFileSync(new URL('../../src/notice-workspace.css',import.meta.url),'utf8')
const assignmentsPortfolio=fs.readFileSync(new URL('../../src/modules/assignments/AssignmentsPortfolio.tsx',import.meta.url),'utf8')
const assignmentOverviewModel=fs.readFileSync(new URL('../../src/modules/assignments/utils/deriveAssignmentOverview.ts',import.meta.url),'utf8')
const taskNavigation=fs.readFileSync(new URL('../../src/modules/tasks/taskWorkspaceNavigation.ts',import.meta.url),'utf8')
const taskWorkspace=fs.readFileSync(new URL('../../src/modules/tasks/TaskWorkspaceEntry.tsx',import.meta.url),'utf8')
const tasksWorkspace=fs.readFileSync(new URL('../../src/modules/tasks/TasksWorkspaceEntry.tsx',import.meta.url),'utf8')
const tasksDashboardStyles=fs.readFileSync(new URL('../../src/modules/tasks/tasks-dashboard-standard.css',import.meta.url),'utf8')
const researchWizard=fs.readFileSync(new URL('../../src/modules/research/components/ResearchCreationWizard.tsx',import.meta.url),'utf8')
const researchTeamPanel=fs.readFileSync(new URL('../../src/modules/research/components/ResearchTeamPanel.tsx',import.meta.url),'utf8')
const researchReviewPanel=fs.readFileSync(new URL('../../src/modules/research/components/ResearchReviewHandoffPanel.tsx',import.meta.url),'utf8')
const researchPreview=fs.readFileSync(new URL('../../src/modules/research/components/ResearchReportPreviewModal.tsx',import.meta.url),'utf8')
const researchDiscussion=fs.readFileSync(new URL('../../src/modules/research/components/ResearchDiscussionPanel.tsx',import.meta.url),'utf8')
const researchEvidence=fs.readFileSync(new URL('../../src/modules/research/components/ResearchEvidencePanel.tsx',import.meta.url),'utf8')

test('task owners are routed to the shared report builder with task templates',()=>{
  assert.match(app,/const shouldOpenEditableReport = Boolean\(\s*openReport &&\s*\(task\.owner_id === user\?\.id \|\| canManageTaskOwner\(task\)\) &&\s*task\.contribution_status === "Draft"/)
  assert.match(app,/const shouldOpenEditableReport = Boolean\(/)
  assert.match(app,/if \(shouldOpenEditableReport\) \{\s*try \{\s*const templates = await api\.documentTemplates\(token, "Assignment"\)/)
  assert.match(app,/taskReportTemplates\(templates\)|taskReportTemplates\(builderTemplates\)/)
  assert.match(reportCatalog,/template\.template_key\.startsWith\("task-"\)/)
  assert.match(reportCatalog,/template\.context === "Assignment"/)
  assert.match(reportCatalog,/governedTemplate\(template\)/)
  assert.match(taskSectionWorkspace,/return options\[0\]\?\.id \|\| ""/)
  assert.match(app,/Save Draft & Return to Report|saveLabel="Save Draft"/)
  assert.match(app,/onPreviewReport=/)
  assert.match(app,/if \(openReport \|\| shouldOpenEditableReport\) focusTaskReportEditor\(\)/)
})

test('legacy inline task report form is removed',()=>{
  assert.match(app,/<TaskSectionWorkspace/)
  assert.match(app,/<TaskReportSectionPanel/)
  assert.doesNotMatch(app,/task-member-output-(?:card|grid)/)
  assert.doesNotMatch(app,/Edit directly in this Task Workspace/)
  assert.doesNotMatch(app,/task-contribution-map-card/)
  assert.doesNotMatch(app,/\{false &&/)
  assert.equal(fs.existsSync(new URL('../../src/AssignmentReportSimpleEditor.tsx',import.meta.url)),false)
  assert.equal(fs.existsSync(new URL('../../src/modules/document-builder/DocumentBuilder.tsx',import.meta.url)),false)
})

test('superseded assignment and notice forms are removed',()=>{
  assert.doesNotMatch(app,/assignmentTaskRequestDialogOpen/)
  assert.doesNotMatch(app,/assignmentSectionEditor/)
  assert.doesNotMatch(app,/assignmentWorkspaceTab === "(?:Structure & Plan|Contributions|Team|Discussion)"/)
  assert.doesNotMatch(app,/<NoticeComposer/)
  assert.doesNotMatch(app,/<form className="notice-composer"/)
  assert.match(app,/<NoticeBoardWorkspace/)
})

test('non-owners see the named task report builder instead of editable fields',()=>{
  assert.match(app,/Only the designated task owner can edit and save this draft/)
  assert.match(app,/task\.owner_name/)
})

test('assignment reports use the section builder and exclude task templates',()=>{
  assert.match(assignmentBuilder,/return <LegacyAssignmentReportBuilder \{\.\.\.props\} \/>/)
  assert.match(assignmentBuilder,/You are not the assigned report builder/)
  assert.match(app,/assignmentReportTemplates\(builderTemplates\)/)
  assert.match(reportCatalog,/!template\.template_key\.startsWith\("task-"\)/)
  assert.match(reportCatalog,/template\.context === "Assignment"/)
  assert.match(reportCatalog,/governedTemplate\(template\)/)
})

test('assignment report waiting state names the assigned lead',()=>{
  assert.match(app,/assignmentLeadName: assignmentLead\?\.name/)
  assert.match(assignmentReports,/PRIMARY REPORT BUILDER/)
  assert.match(assignmentReports,/\{assignmentLeadName \|\| "No Assignment Lead assigned"\}/)
  assert.match(backend,/const lead=await resolvedAssignmentLead\(req\.params\.id\)/)
  assert.match(backend,/APP2 is waiting for \$\{lead\.name\}, the Assignment Lead/)
})

test('legacy displayed assignment lead receives matching report-builder access',()=>{
  assert.match(assignmentOverviewModel,/const currentUserMatchesLead = Boolean\([\s\S]*lead\.id === user\.id[\s\S]*normalizeIdentity\(lead\.name\) === normalizeIdentity\(user\.name\)/)
  assert.match(assignmentOverviewModel,/currentUserMatchesLead &&\s*\(lead\?\.role === "Lead" \|\| !hasExplicitLead\)/)
  assert.match(backend,/fallback_lead_id===user\.id/)
  assert.match(backend,/ORDER BY am\.assigned_at,am\.user_id LIMIT 1/)
  assert.match(backend,/index===0\?'Lead':'Contributor'/)
  assert.match(backend,/ORDER BY CASE WHEN LOWER\(TRIM\(am\.member_role\)\)='lead' THEN 0 ELSE 1 END/)
  assert.match(backend,/namedLead\.id===user\.id/)
  assert.match(backend,/normalizeIdentity\(namedLead\.name\)===normalizeIdentity\(user\.name\)&&await canAccessAssignment/)
})

test('assigning a new assignment lead demotes the previous lead',()=>{
  assert.match(backend,/if\(req\.validated\.memberRole==='Lead'\)await client\.query\("UPDATE assignment_members SET member_role='Contributor' WHERE assignment_id=\$1 AND member_role='Lead' AND user_id<>\$2"/)
})

test('reviewers retain report preview access after task and assignment decisions',()=>{
  assert.match(app,/setAssignmentTaskReportPreviewOpen\(true\)/)
  assert.match(assignmentReports,/Preview Reviewed Report/)
  assert.match(assignmentReports,/\["Changes Requested", "Rejected"\]/)
  assert.match(assignmentReports,/Read Approved Report/)
})

test('attention notices and notification wording use shared high-visibility semantic styling',()=>{
  assert.match(app,/assignment-review-readonly-note app-attention-notice/)
  assert.match(app,/<strong>Decision required:<\/strong>/)
  assert.match(fs.readFileSync(new URL('../../src/operational-alerts.css',import.meta.url),'utf8'),/\.app-attention-notice[\s\S]*border:2px solid var\(--warning\)[\s\S]*notification-detail\.notification-danger/)
})

test('completed task cards preview the accepted final report',()=>{
  assert.match(app,/task\.status === "Completed"/)
  assert.match(app,/openTaskReportPreviewForTask\(task, false\)/)
  assert.match(app,/Preview Report/)
})

test('closing a completed task report preview returns to its originating assignment tab',()=>{
  assert.match(taskNavigation,/const closeTaskReportPreview = \(\) =>/)
  assert.match(taskNavigation,/returnTab\(\)/)
  assert.match(taskNavigation,/selectAssignmentTab\(returnTab\(\)\)/)
  assert.match(app,/onClose=\{closeAssignmentTaskReportPreview\}/)
  assert.match(app,/onClose=\{\(\) => void closeAssignmentTaskWorkspaceSafely\(\)\}/)
})

test('task and assignment report template libraries are populated on catalogue load',()=>{
  assert.match(backend,/ensureAssignmentReportTemplates\(\)/)
  assert.match(backend,/task-standard-report/)
  assert.match(backend,/task-technical-note/)
  assert.match(backend,/task-field-report/)
  assert.match(backend,/Assignment Progress Report/)
  assert.match(backend,/Assignment Completion Report/)
  assert.match(backend,/Assignment Technical Report/)
})

test('assignment report builder exposes approved templates beside task composition controls',()=>{
  assert.match(taskSectionWorkspace,/props\.reportTemplateOptions\?\.length \|\| props\.templateOptions\?\.length/)
  assert.match(taskSectionWorkspace,/className="assignment-header-template-picker"/)
  assert.match(taskSectionWorkspace,/aria-label="Assignment report template"/)
  assert.match(taskSectionWorkspace,/props\.workspaceVariant !== "assignment-report" \|\| activeRibbonTab === "Templates"/)
})

test('assignment report preview opens the dedicated reader and returns to the builder',()=>{
  assert.match(assignmentBuilder,/const \[readerPreview, setReaderPreview\] = useState<GeneratedDocument \| null>\(null\)/)
  assert.match(assignmentBuilder,/if \(readerPreview\) \{[\s\S]*<AssignmentReportReader[\s\S]*onClose=\{\(\) => setReaderPreview\(null\)\}/)
  assert.match(assignmentBuilder,/onPreviewReport=\{async \(latestValue\) => \{[\s\S]*setReaderPreview\(fresh\)/)
  assert.match(taskSectionWorkspace,/if \(props\.onPreviewReport && !preview\)/)
})

test('changing an assignment template rebuilds and refreshes the report outline',()=>{
  assert.match(backend,/\/api\/assignment-reports\/:id\/apply-template/)
  assert.match(backend,/DELETE FROM generated_document_sections WHERE document_id=\$1/)
  assert.match(backend,/ASSIGNMENT_REPORT_TEMPLATE_APPLIED/)
  assert.match(assignmentBuilder,/onApplyDocumentTemplate=\{async \(templateId\)/)
  assert.match(assignmentBuilder,/api\.applyAssignmentReportTemplate\(token, report\.id, templateId, true\)/)
  assert.match(taskSectionWorkspace,/Change the report outline to/)
  assert.match(taskSectionWorkspace,/className="assignment-header-template-picker"/)
  assert.match(taskSectionWorkspace,/aria-label="Assignment report template"/)
  assert.match(taskSectionWorkspace,/props\.workspaceVariant !== "assignment-report" \|\| activeRibbonTab === "Templates"/)
})

test('assignment report uses saved draft content instead of per-section Ready gates',()=>{
  assert.doesNotMatch(assignmentBuilder,/onMarkReady=/)
  assert.doesNotMatch(assignmentBuilder,/canMarkReady=/)
  assert.match(assignmentBuilder,/meaningfulDraftLength >= 100/)
  assert.match(taskSectionWorkspace,/[Ss]ections drafted/)
  assert.match(assignmentBuilder,/meaningfulDraftLength >= 100/)
})

test('submitting an assignment report closes the builder and opens the Reports review handoff',()=>{
  assert.match(app,/const reviewerName =[\s\S]*assignmentReportReviewerCandidates\.find/)
  assert.match(app,/setBuilderDocument\(null\)[\s\S]*setAssignmentWorkspaceTab\("Reports"\)/)
  assert.match(app,/Final Assignment Report sent to \$\{reviewerName\} for review/)
  assert.match(app,/Approval will publish the controlled final copy automatically/)
})

test('closing the Assignment Report Builder returns to Reports without reopening it',()=>{
  assert.match(app,/const returnTab = "Reports"/)
  assert.match(app,/history\.replaceState\([\s\S]*returnTab\.toLowerCase\(\)/)
  assert.match(app,/setBuilderDocument\(null\)[\s\S]*setAssignmentReportPreviewMode\(false\)[\s\S]*setAssignmentWorkspaceTab\(returnTab\)/)
})

test('final report generation removes assignments from active work and returns to the manager archive dashboard',()=>{
  assert.match(backend,/UPDATE assignments SET status='Completed',updated_at=NOW\(\) WHERE id=\$1::uuid/)
  assert.match(backend,/document\.status==='Final'[\s\S]*status='Completed'/)
  assert.match(app,/item\.status !== "Completed"[\s\S]*assignmentStatus === "All"/)
  assert.match(assignmentsPortfolio,/setAssignmentStatus\("All"\)/)
  assert.match(assignmentsPortfolio,/item\.status !== "Completed"/)
  assert.match(app,/\/dashboard/)
  assert.match(schema,/UPDATE assignment_tasks[\s\S]*contribution_status='Accepted'/)
  assert.match(schema,/UPDATE assignments a[\s\S]*d\.status='Final'/)
  assert.match(schema,/UPDATE assignment_members member[\s\S]*NOT EXISTS[\s\S]*LOWER\(TRIM\(existing_lead\.member_role\)\)='lead'/)
})

test('completed assignments tasks and research stay out of active views and non-manager timelines',()=>{
  assert.match(app,/const filteredAssignments = assignmentRows\.filter[\s\S]*item\.status !== "Completed"/)
  assert.match(assignmentOverviewModel,/task\.status !== "Completed"/)
  assert.match(app,/researchRows\.filter\(\(item\) => !\["Completed", "Archived"\]\.includes\(item\.status\)\)/)
  assert.match(backend,/researchLifecycleStatusSql\('p'\)/)
  assert.match(backend,/app\.get\('\/api\/dashboard\/completed-work'[\s\S]*Management access required/)
})

test('research team pickers use account availability instead of active assignment count',()=>{
  assert.match(app,/type TeamMember[\s\S]*active: number;[\s\S]*enabled: boolean;/)
  assert.match(app,/active: member\.active_assignments \|\| 0,[\s\S]*enabled: member\.active/)
  assert.match(researchWizard,/Formal reviewers/)
  assert.match(app,/reviewerOptions=\{eligibleResearchReviewers\}/)
})

test('research creation timeline uses stable date controls without forced refocus',()=>{
  const timeline=researchWizard.match(/Start date[\s\S]*?research-wizard-summary/)?.[0]||''
  assert.doesNotMatch(timeline,/autoFocus/)
  assert.match(timeline,/name="research-start-date"[\s\S]*setResearchForm\(\(current\) =>/)
  assert.match(timeline,/name="research-target-completion-date"[\s\S]*setResearchForm\(\(current\) =>/)
})

test('research leads load eligible members before opening the team editor',()=>{
  assert.match(backend,/\/api\/research\/:id\/eligible-team-members[\s\S]*project\.lead_id===req\.user\.id/)
  assert.match(researchTeamPanel,/api\.eligibleResearchTeamMembers\(token, selectedResearch\.id\)[\s\S]*setTeam\(members\.map\(mapTeamMember\)\)/)
  assert.match(researchTeamPanel,/\["Researcher", "Deputy Director", "Assistant Director"\]\.includes\(member\.role\)/)
})

test('research team editor has a final professional high-contrast theme layer',()=>{
  assert.match(app,/import "\.\/research-team-professional-contrast\.css"/)
  assert.match(researchTeamContrast,/\.research-workspace \.research-team-selector article\.selected[\s\S]*var\(--success/)
  assert.match(researchTeamContrast,/\.research-workspace \.research-team-selector label strong[\s\S]*var\(--text-primary/)
  assert.match(researchTeamContrast,/input\[type="checkbox"\][\s\S]*width: 19px/)
})

test('research report creator cannot approve or generate their own final report',()=>{
  assert.match(backend,/version\.submitted_by===req\.user\.id[\s\S]*report creator cannot approve or reject their own submission/i)
  assert.match(backend,/approvedVersion\.submitted_by===req\.user\.id[\s\S]*report creator may submit the report but cannot generate/i)
  assert.match(backend,/approvedVersion\.reviewed_by!==req\.user\.id[\s\S]*Only the approver who recorded the approval decision/i)
})

test('research review handoff names the assigned reviewer in attention messages',()=>{
  assert.match(app,/awaits \$\{assignedReviewerName\}.*decision/)
  assert.match(researchReviewPanel,/Awaiting decision from \$\{latest\?\.reviewer_name/)
  assert.match(researchReviewPanel,/while \$\{latest\?\.reviewer_name \|\| "the assigned reviewer"\} assesses it/)
})

test('research review alerts open the Review workspace and join the personal review queue',()=>{
  assert.match(app,/item\.entity_type === "research" && item\.entity_id/)
  assert.match(app,/setResearchTab\([\s\S]*"Review"[\s\S]*"Overview"/)
  assert.match(app,/item\.reviewKind === "Research Report"/)
  assert.match(backend,/FROM research_report_versions v/)
  assert.match(backend,/v\.reviewer_id=\$1 AND v\.status='Submitted'/)
})

test('research reports begin with the defined project team and roles',()=>{
  assert.match(backend,/JSON\.stringify\(\{team,sections,sources\}\)/)
  assert.match(backend,/SELECT source_type,title,author,publisher,publication_date,url,identifier FROM research_sources/)
  assert.match(backend,/title:'Research Team and Roles'/)
  assert.match(researchPreview,/Research Team and Roles[\s\S]*props\.team\.map[\s\S]*member\.role/)
})

test('research lead assignment proposals require manager approval before activation',()=>{
  assert.match(schema,/CREATE TABLE IF NOT EXISTS research_assignment_requests/)
  assert.match(backend,/project\.lead_id!==req\.user\.id[\s\S]*Pending Approval/)
  assert.match(backend,/assignment-requests\/:requestId\/decision[\s\S]*authorize\('System Admin','Deputy Director'\)/)
  assert.match(app,/Send to manager for approval/)
  assert.match(app,/Approve & activate/)
})

test('research overview discussion provides a non-submitting next button to Work',()=>{
  assert.match(researchDiscussion,/className="research-comment-actions"[\s\S]*className="research-comment-next[^"]*"[\s\S]*onNext[\s\S]*Continue to Evidence/)
  assert.match(researchTeamContrast,/\.research-workspace \.research-comment-actions[\s\S]*justify-content: flex-end/)
})

test('research evidence provides a next button to the report workspace',()=>{
  assert.match(researchEvidence,/className="research-evidence-actions"[\s\S]*className="research-evidence-next"[\s\S]*setResearchTab\("Report"\)[\s\S]*Continue to Report/)
  assert.match(researchTeamContrast,/\.research-workspace \.research-evidence-actions[\s\S]*justify-content: flex-end/)
})

test('popup backdrops cannot dismiss App2 windows',()=>{
  assert.match(appShell,/name\.includes\('backdrop'\)/)
  assert.match(appShell,/event\.stopPropagation\(\)/)
  assert.match(appShell,/onClickCapture=\{keepPopupOpen\}/)
  assert.match(appShell,/onMouseDownCapture=\{keepPopupOpen\}/)
})

test('notice board prioritises current actionable information with persistent details',()=>{
  assert.match(noticeBoard,/const \[lifecycle,setLifecycle\]=useState\('Current'\)/)
  assert.match(noticeBoard,/Number\(Boolean\(b\.is_pinned\)\)-Number\(Boolean\(a\.is_pinned\)\)/)
  assert.match(noticeBoard,/urgent notice.*require attention/)
  assert.match(noticeBoard,/role="dialog" aria-modal="true"/)
  assert.doesNotMatch(noticeBoard,/notice-detail-backdrop" onClick=/)
  assert.match(noticeBoardStyles,/\.notice-attention-summary/)
})

test('App2 pages use a shared compact viewport-aware layout',()=>{
  assert.match(app,/import "\.\/app2-compact-layout\.css"/)
  assert.match(compactLayout,/assignment-overview-v4\{min-height:calc\(100vh - 150px\)/)
  assert.match(compactLayout,/grid-template-rows:auto auto auto minmax\(0,1fr\)/)
  assert.match(compactLayout,/dashboard-operations-grid/)
  assert.match(compactLayout,/modal-backdrop>section/)
  assert.match(compactLayout,/table th,table td/)
})

test('App2 clickable controls and cards use the shared interactive visual language',()=>{
  assert.match(app,/import "\.\/app2-interactive-visuals\.css"/)
  assert.match(interactiveVisuals,/single owner for hover, active and focus mechanics/)
  assert.match(interactiveVisuals,/:hover:not\(:disabled\)/)
  assert.match(interactiveVisuals,/button:focus-visible/)
  assert.match(interactiveVisuals,/\.status-completed/)
  assert.match(interactiveVisuals,/@media \(prefers-reduced-motion:reduce\)/)
})

test('document and report previews use the shared professional reader format',()=>{
  assert.match(app,/app2-reader-contrast-fix\.css/)
  assert.match(readerContrast,/--document-text:#243447/)
  assert.match(readerContrast,/reader-stage article/)
})

test('document reader overrides faint embedded text colors on white paper',()=>{
  assert.match(app,/app2-reader-contrast-fix\.css/)
  assert.match(readerContrast,/--document-text:#243447/)
  assert.match(readerContrast,/-webkit-text-fill-color:var\(--document-text\)!important/)
  assert.match(readerContrast,/assignment-report-docx-reader/)
  assert.match(readerContrast,/reader-stage article/)
})

test('App2 headings and explanatory copy use a symmetrical color hierarchy',()=>{
  assert.match(app,/import "\.\/app2-typography-hierarchy\.css"/)
  assert.match(typographyHierarchy,/--app2-heading-blue:#83c5ff/)
  assert.match(typographyHierarchy,/--app2-heading-gold:#f2c94c/)
  assert.match(typographyHierarchy,/--app2-heading-green:#67d99a/)
  assert.match(typographyHierarchy,/--app2-copy:#c4d0dc/)
  assert.match(typographyHierarchy,/font-family:var\(--app2-typeface\)/)
  assert.match(typographyHierarchy,/font-variant-numeric:tabular-nums/)
})

test('light theme has a dedicated polished and accessible visual layer',()=>{
  assert.match(app,/import "\.\/app2-light-theme-polish\.css"/)
  assert.match(lightThemePolish,/html\[data-theme="light"\]/)
  assert.match(lightThemePolish,/--app-background:#E9F1F7/)
  assert.match(lightThemePolish,/--app2-heading-blue:#185F91/)
  assert.match(lightThemePolish,/linear-gradient/)
})

test('settings self-heal a missing system row and the client safely normalizes responses',()=>{
  assert.match(backend,/INSERT INTO system_settings\(id\) VALUES\(1\) ON CONFLICT\(id\) DO NOTHING/)
  assert.match(backend,/INSERT INTO system_settings\(id,organization_name/)
  assert.match(backend,/ON CONFLICT\(id\) DO UPDATE SET organization_name=EXCLUDED\.organization_name/)
  assert.match(app,/const system = result\.system \|\|/)
  assert.match(app,/organization_name: "Public Service Commission"/)
  assert.match(app,/setSettingsData\(\{ \.\.\.result, system, preferences \}\)/)
})

test('PSC Slate is an additive persisted theme scoped away from existing themes',()=>{
  assert.match(app,/"PSC Slate"/)
  assert.match(themePreferences,/\| "PSC Slate"/)
  assert.match(backend,/z\.enum\(\['Dark','Light','System','Gold Grey','Navy Blue','PSC Slate','Low-Contrast Navy','Executive Gold','Sage Ivory'\]\)/)
  assert.match(schema,/theme_mode IN\('Dark','Light','System','Gold Grey','Navy Blue','PSC Slate','Low-Contrast Navy','Executive Gold','Sage Ivory'\)/)
  assert.match(pscSlateTheme,/html\[data-theme="psc-slate"\]/)
  assert.doesNotMatch(pscSlateTheme,/html\[data-theme="(?:light|dark|navy-blue|gold-grey)"\]/)
  assert.match(pscSlateTheme,/--app-background:#F1F4F7/)
  assert.match(pscSlateTheme,/--sidebar-background:#B1C0CC/)
})

test('Low-Contrast Navy is selectable, non-default, gradient-free and isolated',()=>{
  assert.match(app,/"Low-Contrast Navy"/)
  assert.match(themePreferences,/\| "Low-Contrast Navy"/)
  assert.match(lowContrastNavyTheme,/html\[data-theme="low-contrast-navy"\]/)
  assert.doesNotMatch(lowContrastNavyTheme,/html\[data-theme="(?:light|dark|navy-blue|gold-grey|psc-slate)"\]/)
  assert.match(lowContrastNavyTheme,/--app-background:#111927/)
  assert.match(lowContrastNavyTheme,/--surface-primary:#182234/)
  assert.match(lowContrastNavyTheme,/--sidebar-background:#101925/)
  assert.match(themePreferences,/themeMode: "Executive Gold"/)
  assert.doesNotMatch(app,/themeMode: "Low-Contrast Navy"/)
})

test('assignments can compile and complete directly without tasks',()=>{
  assert.match(backend,/taskIds:z\.array\(z\.string\(\)\.uuid\(\)\)\.max\(100\)\.default\(\[\]\)/)
  assert.doesNotMatch(backend,/Create and complete the assignment tasks before compiling the final report/)
  assert.match(assignmentOverviewModel,/acceptedTaskReportCount === tasks\.length/)
  assert.match(assignmentReports,/const directAssignment = tasks\.length === 0/)
  assert.match(assignmentReports,/No tasks are required/)
})

test('task creation and request governance are visible on primary screens',()=>{
  assert.match(app,/\(isAssignmentLead \|\| isManager\)/)
  assert.match(app,/\{isManager \? "Assign task" : "Request task"\}/)
  assert.match(tasksWorkspace,/className="tasks-primary-actions"/)
  assert.match(tasksWorkspace,/\+ Request Task/)
  assert.match(tasksWorkspace,/Task Requests\{counts\.myRequests/)
  assert.match(tasksWorkspace,/\+ Assign Task/)
  assert.match(tasksWorkspace,/Approval Requests\{counts\.approvals/)
  assert.match(tasksWorkspace,/api\.createAssignmentTask\(token, directAssignDraft\.assignmentId/)
  assert.match(tasksWorkspace,/setDirectAssignOpen\(true\)/)
  assert.match(tasksWorkspace,/className="task-direct-assign-error" role="alert"/)
  assert.match(tasksWorkspace,/setDirectAssignError\(cause instanceof Error \? cause\.message/)
  assert.doesNotMatch(tasksWorkspace,/disabled=\{!assignment\.members\.length\}/)
  assert.match(tasksWorkspace,/assignmentTaskAssignableUsers/)
  assert.match(tasksWorkspace,/authorised management scope/)
  assert.match(tasksWorkspace,/disabled=\{!requestAssignments\.length\}/)
  assert.match(tasksDashboardStyles,/\.tasks-primary-actions/)
  assert.match(tasksDashboardStyles,/@media \(max-width: 760px\)/)
})

test('task reviewer resolution uses the assignment membership timestamp',()=>{
  assert.doesNotMatch(backend,/am\.created_at/)
  assert.match(backend,/ORDER BY am\.assigned_at ASC,am\.user_id ASC/)
})

test('research projects explicitly support work without linked assignments',()=>{
  assert.match(backend,/assignmentId:z\.string\(\)\.uuid\(\)\.nullable\(\)\.optional\(\)/)
  assert.match(app,/Linked assignments are optional/)
  assert.match(app,/assignmentId: researchForm\.assignmentId \|\| null/)
})

test('obsolete dashboard, report and notification panels are removed rather than hidden',()=>{
  assert.doesNotMatch(app,/legacy-(?:dashboard-section|reports-management-view|notification-list)/)
})

test('research brief preview uses readable paper ink and closes only from its control',()=>{
  assert.match(app,/aria-labelledby="research-brief-preview-title"/)
  assert.doesNotMatch(app,/research-brief-preview-backdrop[^>]+onMouseDown/)
  assert.match(researchWorkspaceSimplified,/\.research-workspace \.research-brief-paper section p[^}]+color:#334155!important/)
  assert.match(researchWorkspaceSimplified,/\.research-workspace \.brief-meta strong[^}]+color:#1a2433!important/)
})

test('institutional report details format database dates and labels for people',()=>{
  assert.match(institutionalReports,/detailValue/)
  assert.match(reportFormatting,/timeZone:'Africa\/Nairobi'/)
  assert.match(reportFormatting,/key\.endsWith\('_date'\)/)
  assert.match(reportFormatting,/key\.endsWith\('_at'\)/)
  assert.match(institutionalReports,/detailValue/)
})

test('research overview does not duplicate the Evidence document workflow',()=>{
  assert.doesNotMatch(app,/researchAttachmentInputRef/)
  assert.doesNotMatch(app,/<h4>Available documents<\/h4>/)
  assert.match(app,/Repository documents/)
  assert.match(app,/linkResearchRepositoryDocument/)
})

test('research leads request additional members while managers retain team control',()=>{
  assert.match(app,/Request More Members/)
  assert.match(app,/requestResearchTeamExpansion/)
  assert.match(backend,/team-expansion-request/)
  assert.match(backend,/RESEARCH_TEAM_EXPANSION_REQUESTED/)
  assert.match(backend,/Only an authorised research manager can update the project team/)
})
