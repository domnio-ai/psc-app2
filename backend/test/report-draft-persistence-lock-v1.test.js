import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { sanitizeTaskReportHtml } from "../src/task-report-formatting.js";

const read = (path) => fs.readFileSync(path, "utf8");
const research = read("src/modules/research/components/ResearchReportWorkspace.tsx");
const assignment = read("src/modules/assignments/components/AssignmentReportBuilder.tsx");
const sharedWorkspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");
const taskMapping = read("src/modules/tasks/taskReportOrchestration.ts");
const taskWorkspaceMapping = read("src/modules/tasks/taskWorkspaceMapping.ts");
const reportHtml = read("src/modules/report-editor/reportHtml.ts");
const formatter = read("backend/src/task-report-formatting.js");
const app = read("src/App.tsx");
const backendApp = read("backend/src/app.js");
const taskReportSaveQueue = read("src/modules/tasks/taskReportSaveQueue.ts");
const documentReader = read("src/DocumentReader.tsx");
const repositoryReaderCss = read("src/modules/repository/repository-reader-document.css");
const meetingRepositoryFormatter = read("backend/src/task-report-formatting.js");

test("Research closes only after saving the live rich-text editor value", () => {
  const closeStart = research.indexOf("const closeWorkspace = () =>");
  const closeEnd = research.indexOf("const applyTemplate", closeStart);
  assert.ok(closeStart >= 0 && closeEnd > closeStart);
  const close = research.slice(closeStart, closeEnd);
  const saveIndex = close.indexOf("props.onSave(currentValue())");
  assert.ok(saveIndex >= 0);
  assert.ok(close.indexOf("props.onClose()", saveIndex) > saveIndex);
  assert.match(close, /result === false/);
  assert.match(close, /workspace remains open/);
  assert.equal((research.match(/onClick=\{closeWorkspace\}/g) || []).length, 2);
});

test("Task and Assignment workspaces save their latest editor values before closing or previewing", () => {
  const closeStart = sharedWorkspace.indexOf("const requestClose = async () =>");
  const closeEnd = sharedWorkspace.indexOf("const runFullReportPreview", closeStart);
  assert.ok(closeStart >= 0 && closeEnd > closeStart);
  const close = sharedWorkspace.slice(closeStart, closeEnd);
  assert.match(close, /saveClosingDraftAndRemember\(\)/);
  assert.match(close, /saveDraftAndRemember\(\)/);
  assert.match(close, /workspace remains open/);
  assert.match(assignment, /onSave=\{async \(latestValue\) => \{\s*return save\(false, latestValue\);/);
  assert.match(assignment, /const saved = await save\(false, latestValue\);\s*if \(!saved\)/);
});

test("Task draft mapping retains editor HTML through save and reopen", () => {
  assert.match(taskMapping, /return key === "title" \? normaliseText\(raw\) : String\(raw \?\? ""\)\.trim\(\)/);
  assert.match(taskMapping, /recoverTaskReportMarkup\(saved\.contribution_summary\)/);
  assert.match(taskWorkspaceMapping, /recoverTaskReportMarkup\(task\.contribution_summary\)/);
  assert.match(app, /content: contentToSave/);
  assert.match(taskWorkspaceMapping, /normaliseText\(task\.blank_content\)/);
  assert.match(taskWorkspaceMapping, /normaliseText\(task\.contribution_report_html\)/);
});

test("Debounced and explicit Task Report saves serialize and verify the current server revision", () => {
  const saveStart = app.indexOf("const saveAssignmentTaskContribution = async");
  const queueEnd = app.indexOf("const finalizeAssignmentTaskContribution", saveStart);
  assert.ok(saveStart >= 0 && queueEnd > saveStart);
  const save = app.slice(saveStart, queueEnd);
  assert.doesNotMatch(save, /api\.taskContext\(token, selectedAssignmentTask\.id\)/, "save must not issue a pre-save task-context GET");
  assert.match(save, /expectedContributionUpdatedAt: confirmedRevision\.updatedAt/);
  assert.match(save, /acquireTaskReportSaveQueue\(/);
  assert.match(taskReportSaveQueue, /while \(queue\.current\) await queue\.current/);
  assert.match(taskReportSaveQueue, /queue\.current = currentWrite/);
  assert.match(taskReportSaveQueue, /if \(queue\.current === currentWrite\) queue\.current = null/);
  assert.doesNotMatch(save, /A Task Report save is already in progress/);
});

test("Task workspace refreshes its task-specific context before presenting saved content", () => {
  const start = app.indexOf("const openAssignmentTaskWorkspace = async (");
  const end = app.indexOf("const openAssignmentTaskReport =", start);
  assert.ok(start >= 0 && end > start);
  const open = app.slice(start, end);
  assert.match(open, /api\.taskContext\(token, task\.id\)/);
  assert.match(open, /latestTask\.assignment_id === task\.assignment_id/);
  assert.match(open, /latest saved Task could not be loaded/);
});

test("Meeting Repository draft structure survives safe sanitization and receives controlled document styling", () => {
  assert.match(meetingRepositoryFormatter, /"main", "header", "article", "footer", "section"/);
  assert.match(meetingRepositoryFormatter, /main: \["paper"\]/);
  assert.match(meetingRepositoryFormatter, /header: \["identity"\]/);
  assert.match(documentReader, /const isMeetingMinutes = \/meeting\\s\+minutes\/i/);
  assert.match(documentReader, /app2-repository-meeting-minutes/);
  assert.match(repositoryReaderCss, /\.app2-repository-meeting-minutes \.draft-banner/);
  assert.match(repositoryReaderCss, /\.app2-repository-meeting-minutes \.content table/);
});

test("Research Report Draft documents use the controlled reader typography", () => {
  assert.match(documentReader, /const isResearchReport =/);
  assert.match(documentReader, /isTaskReport \|\| isAssignmentReport \|\| isResearchReport/);
  assert.match(documentReader, /const css = repositoryReaderDocumentCss/);
});

test("Task mode cache follows the server mode and approval triggers repository finalization", () => {
  const modeWorkflow = read("src/modules/tasks/taskReportDraftWorkflow.ts");
  assert.match(modeWorkflow, /syncTaskReportTemplateMode/);
  assert.match(app, /syncTaskReportTemplateMode\(/);
  const reviewStart = app.indexOf("const reviewAssignmentTaskContribution = async");
  const reviewEnd = app.indexOf("const archiveSelectedAssignmentTask", reviewStart);
  assert.ok(reviewStart >= 0 && reviewEnd > reviewStart);
  const review = app.slice(reviewStart, reviewEnd);
  assert.match(review, /decision === "Approved"/);
  assert.match(review, /api\.finalizeAssignmentTaskContribution\(/);
  assert.match(review, /published to the Document Repository/);
});

test("Research approval immediately attempts controlled Repository publication", () => {
  const start = app.indexOf("const decideCompleteResearchReport = async");
  const end = app.indexOf("const generateApprovedResearchFinalReport", start);
  assert.ok(start >= 0 && end > start);
  const decision = app.slice(start, end);
  assert.match(decision, /api\.decideResearchReport\(/);
  assert.match(decision, /if \(decision === "Approved"\)/);
  assert.match(decision, /api\.generateResearchReport\(/);
  assert.match(decision, /mode: "Final"/);
  assert.match(decision, /automatic Repository publication could not complete/);
});

test("Preview and backend sanitization retain supported report styling while removing unsafe markup", () => {
  assert.match(reportHtml, /SAFE_STYLE_PROPERTIES/);
  assert.match(reportHtml, /parsed\.body\.innerHTML = sanitizeReportHtmlForEditor\(bodyMarkup\)/);
  assert.match(formatter, /ALLOWED_STYLE_RULES/);
  assert.ok(formatter.includes('allowedStyles: { "*": ALLOWED_STYLE_RULES }'));
  const styled = sanitizeTaskReportHtml('<p style="font-size:16pt;color:#123456;text-align:center">Styled <strong>content</strong></p>');
  assert.match(styled, /font-size:16pt/);
  assert.match(styled, /color:#123456/);
  assert.match(styled, /text-align:center/);
  assert.match(sanitizeTaskReportHtml('<p onclick="bad()">Safe</p><script>bad()</script>'), /<p>Safe<\/p>/);
  assert.doesNotMatch(sanitizeTaskReportHtml('<p onclick="bad()">Safe</p><script>bad()</script>'), /onclick|script/i);
});

test("Large Assignment, Research, and Task reports share bounded JSON payload capacity", () => {
  assert.match(backendApp, /const taskReportJsonBodyParser=express\.json\(\{limit:'32mb'\}\)/);
  assert.match(backendApp, /isGeneratedReportSectionBody/);
  assert.match(backendApp, /content:z\.string\(\)\.max\(5000000\),completion/);
  assert.match(backendApp, /content:z\.string\(\)\.max\(5000000\)\.optional\(\)/);
  assert.doesNotMatch(backendApp, /generated-documents[^\n]{0,220}content:z\.string\(\)\.max\(500000\)/);
});

test("Task preview preserves safe report templates and converts historical embedded WebP", () => {
  assert.match(reportHtml, /preserving template selectors such as body, \.page, and @media rules/);
  assert.ok(reportHtml.includes("/@import|url\\s*\\(|expression\\s*\\(|javascript:|vbscript:|behavior\\s*:|-moz-binding\\s*:/i"));
  assert.doesNotMatch(reportHtml, /body \$\{selector\}/);
  assert.match(reportHtml, /normalizeReportDocumentForPreviewAsync/);
  assert.match(reportHtml, /data:image\\\/webp;base64/);
  assert.match(app, /normalizeReportDocumentForPreviewAsync\(report\.html\)/);
  assert.match(documentReader, /historical imports predating/);
  assert.match(formatter, /taskReportImageToPdfBlock/);
});

test("Repository document authorization stays enforced through named-reader grants", () => {
  const manifest = JSON.parse(read("APP2_PROTECTED_MODULES.json"));
  assert.match(backendApp, /const canReadKnowledge=async\(user,id\)=>\{/);
  assert.match(backendApp, /documentProtectionAllowsView\(user,item\)/);
  assert.match(backendApp, /document_access_grants/);
  assert.match(backendApp, /readerScope:z\.enum\(\['INHERITED','TEAM','NAMED_USERS','REVIEWER_ONLY','MANAGEMENT_ONLY'\]\)/);
  assert.match(backendApp, /DOCUMENT_PROTECTION_UPDATED/);
  assert.ok(manifest.source_contracts.some((contract) => contract.id === "DOCUMENT-REPOSITORY"));
  const listRoute = backendApp.slice(backendApp.indexOf("app.get('/api/documents',"), backendApp.indexOf("app.get('/api/document-categories',"));
  assert.match(listRoute, /for\(const item of documents\)if\(await canReadKnowledge\(req\.user,item\.id\)\)visible\.push\(item\)/);
});

test("Task Report autosave is debounced, serialized, and requires server confirmation", () => {
  assert.match(sharedWorkspace, /autoSaveTimerRef/);
  assert.match(sharedWorkspace, /autoSaveInFlightRef/);
  assert.match(sharedWorkspace, /const scheduleTaskReportAutoSave = \(delay = 1500\)/);
  assert.match(sharedWorkspace, /Draft changes save automatically after a short pause/);
  assert.match(sharedWorkspace, /autoSave: true/);
  assert.match(app, /saved\.persistence_status !== "saved"/);
  assert.match(app, /save response did not contain the latest Task Report content/);
  assert.match(app, /expectedContributionUpdatedAt: confirmedRevision\.updatedAt/);
  assert.match(app, /if \(!options\?\.autoSave\)/);
  assert.match(app, /autoSave: saveOptions\?\.autoSave/);
});

test("Assignment Overview exposes newly assigned tasks in the universal popup pattern", () => {
  const overview = read("src/modules/assignments/components/AssignmentOverview.tsx");
  assert.match(overview, /myAssignedTasks = assignmentTasks\.filter\(\(task: any\) => task\.owner_id === currentUserId/);
  assert.match(overview, /ASSIGNED TO ME/);
  assert.match(overview, /New and active tasks assigned to you/);
  assert.match(overview, /createPortal\(/);
  assert.match(overview, /Open exact task/);
  assert.match(overview, /onOpenTask\(task\)/);
});
