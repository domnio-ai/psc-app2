import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, Packer, Paragraph, Table } from 'docx';
import { sanitizeTaskReportHtml, taskReportHtmlToDocxElements } from '../src/task-report-formatting.js';
import { buildTaskReportDraftSnapshot } from '../src/private-draft-repository.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => readFileSync(resolve(root, relative), 'utf8');
const workspace = read('src/modules/assignments/components/TaskSectionWorkspace.tsx');
const panel = read('src/modules/tasks/TaskReportSectionPanel.tsx');
const app = read('src/App.tsx');
const api = read('backend/src/app.js');
const rich = read('backend/src/task-report-formatting.js');
const orchestration = read('src/modules/tasks/taskReportOrchestration.ts');
const mapping = read('src/modules/tasks/taskWorkspaceMapping.ts');

test('Task Report automatically persists rich editor changes and reports save failures', () => {
  assert.match(workspace, /autoSaveTimerRef/);
  assert.match(workspace, /const scheduleTaskReportAutoSave = \(delay = 1500\)/);
  assert.match(workspace, /Promise\.resolve\(\)\.then\(\(\) => props\.onSave\(latestValue, undefined, \{ autoSave: true \}\)\)/);
  assert.match(workspace, /scheduleTaskReportAutoSave\(5000\)/);
  assert.match(workspace, /Draft changes save automatically after a short pause/);
  assert.match(app, /saved\.persistence_status !== "saved"/);
  assert.match(app, /save response did not contain the latest Task Report content/);
});

test('Task Report preview flushes the current draft before opening preview', () => {
  const previewStart = workspace.indexOf('const runFullReportPreview = async () =>');
  const previewEnd = workspace.indexOf('const visualLines =', previewStart);
  assert.ok(previewStart >= 0 && previewEnd > previewStart);
  const preview = workspace.slice(previewStart, previewEnd);
  const saveIndex = preview.indexOf('saveDraftAndRemember()');
  const openIndex = preview.indexOf('props.onPreviewReport(');
  assert.ok(saveIndex >= 0, 'preview must save the current Task Report first');
  assert.ok(openIndex > saveIndex, 'preview must not open before the save completes');
  assert.match(preview, /Preview was not opened/);
  assert.match(preview, /props\.onPreviewReport\(latestValue, undefined\)/);
  const saveStart = workspace.indexOf('const saveDraftAndRemember = async () =>');
  const saveEnd = workspace.indexOf('// A close is a user-requested Draft save', saveStart);
  assert.match(workspace.slice(saveStart, saveEnd), /props\.onSave\(latestValue, undefined\)/);
  assert.match(workspace, /persistTaskReviewerChoice/);
});

test('Task draft writes require the current revision and cannot update a submitted report', () => {
  assert.match(api, /expectedContributionUpdatedAt:z\.string\(\)\.max\(80\)\.nullable\(\)\.optional\(\)/);
  assert.match(api, /const taskReportJsonBodyParser=express\.json\(\{limit:'32mb'\}\)/);
  for (const field of ['contributionSummary', 'contributionFindings', 'contributionRecommendations', 'evidenceReviewed', 'contributionChallenges', 'contributionNextActions', 'blankContent']) {
    assert.match(api, new RegExp(`${field}:z\\.string\\(\\)\\.max\\(5000000\\)`));
  }
  assert.match(api, /assignmentTaskContributionSectionSchema=z\.object\([\s\S]*content:z\.string\(\)\.max\(5000000\)/);
  assert.match(api, /FROM assignment_tasks WHERE id=\$1 AND assignment_id=\$2 FOR UPDATE/);
  assert.match(api, /hasExpectedTimestamp=Object\.prototype\.hasOwnProperty\.call\(v,'expectedContributionUpdatedAt'\)/);
  assert.match(api, /expected!==actual/);
  assert.match(api, /AND contribution_status='Draft' RETURNING \*/);
  assert.match(api, /if\(hasExpectedTimestamp\)\{/);
  assert.match(api, /await client\.query\('INSERT INTO assignment_history/);
  assert.match(api, /if\(v\.contributionStatus==='Draft'\)\{/);
  assert.match(read('src/App.tsx'), /expectedContributionUpdatedAt: confirmedRevision\.updatedAt/);
  assert.match(workspace, /saveState === "conflict"/);
  assert.match(workspace, /isTaskReportRevisionConflict/);
  assert.match(workspace, /changed in another session|newer draft was saved|revision conflict|stale draft/i);
  assert.match(workspace, /const saveDraftAndRemember = async/);
  assert.match(workspace, /scheduleTaskReportAutoSave\(\)/);
});

test('formatted Task Report HTML is allowlisted and rich DOCX rendering preserves supported block types', async () => {
  assert.match(rich, /"table"/);
  for (const tag of ['"th"', '"td"', '"a"', '"img"']) {
    assert.ok(rich.includes(tag), `sanitizer must allow ${tag}`);
  }
  assert.match(rich, /allowedStyles/);
  assert.match(rich, /allowedSchemesByTag: \{ img: \["http", "https", "data"\] \}/);
  assert.match(rich, /taskReportHtmlToDocxElements/);
  assert.match(api, /const buildDocx=async\(title,metadata,sections,\{preserveRichContent=false\}=\{\}\)/);
  assert.match(api, /preserveRichContent\s*\?taskReportHtmlToDocxElements\(section\.content\)/);
  assert.match(api, /contributionSummary:sanitizeTaskReportHtml\(normalizedContribution\.contributionSummary\)/);

  const content = '<h2>Heading</h2><p><strong>Bold</strong> and <em>italic</em></p><ul><li>One</li></ul><table><tr><th>Key</th></tr><tr><td>Value</td></tr></table><a href="https://example.test">Link</a>';
  const elements = taskReportHtmlToDocxElements(content);
  assert.deepEqual(elements.map((element) => element.constructor), [Paragraph, Paragraph, Paragraph, Table, Paragraph]);
  const docx = await Packer.toBuffer(new Document({ sections: [{ children: elements }] }));
  assert.ok(docx.length > 1000, 'rich DOCX packages successfully');
  assert.equal(taskReportHtmlToDocxElements('   ')[0].constructor, Paragraph);
  assert.match(taskReportHtmlToDocxElements('Plain &amp; text')[0].constructor.name, /Paragraph/);
  assert.equal(sanitizeTaskReportHtml('<script>alert(1)</script><p onclick="x">Safe</p>'), '<p>Safe</p>');
});

test('explicit Task Report save updates local task content only from the confirmed server response', () => {
  const source = read('src/App.tsx');
  const start = source.indexOf("const saveAssignmentTaskContribution = async");
  const end = source.indexOf("const finalizeAssignmentTaskContribution", start);
  const save = source.slice(start, end);
  assert.match(save, /saved\.persistence_status !== "saved"/);
  assert.match(save, /applySavedTaskContribution\(saved\)/);
  assert.match(save, /save response did not contain the latest Task Report content/);
  assert.match(save, /saveAssignmentTaskContribution/);
});
test('formatted report content survives save-response mapping and task reopen mapping', () => {
  assert.match(orchestration, /return key === "title" \? normaliseText\(raw\) : String\(raw \?\? ""\)\.trim\(\)/);
  assert.match(orchestration, /contributionSummary:\s*recoverTaskReportMarkup\(saved\.contribution_summary\)/);
  assert.match(mapping, /contributionSummary:\s*recoverTaskReportMarkup\(task\.contribution_summary\)/);
  assert.match(mapping, /contributionFindings:\s*recoverTaskReportMarkup\(task\.contribution_findings\)/);
});
test('Task Report preview and Repository draft keep authored images and tables', () => {
  const content = '<p>Evidence image</p><img src="data:image/png;base64,iVBORw0KGgo=" alt="Evidence photo" width="70%"><table><tbody><tr><th>Item</th><td>Verified</td></tr></tbody></table>';
  const sanitized = sanitizeTaskReportHtml(content);
  assert.match(sanitized, /<img src="data:image\/png;base64,iVBORw0KGgo=" alt="Evidence photo"/);
  assert.match(sanitized, /<table[\s\S]*?<th>Item<\/th><td>Verified<\/td>[\s\S]*?<\/table>/);
  const snapshot = buildTaskReportDraftSnapshot({
    task: { id: 'test-task', title: 'Media report', report_mode: 'blank', blank_content: content },
    assignment: { title: 'Media assignment' },
    ownerName: 'Researcher',
  }).toString('utf8');
  assert.match(snapshot, /<img src="data:image\/png;base64,iVBORw0KGgo=" alt="Evidence photo"/);
  assert.match(snapshot, /<table[\s\S]*?<th>Item<\/th><td>Verified<\/td>[\s\S]*?<\/table>/);
  assert.match(app, /normalizeReportDocumentForPreviewAsync\(report\.html\)/);
});
test('rich media entered from the Output title editor migrates into the saved report body', () => {
  assert.match(app, /if \(taskReportContainsRichMedia\(rawTitle\)\) \{\s*output\.push\(htmlForContent\(rawTitle\)\);/);
  assert.match(app, /migrateRichTitleToDocument = key === "title" && taskReportContainsRichMedia\(value\)/);
  assert.match(app, /sectionOverride\?\.key === "title" &&\s*taskReportContainsRichMedia\(sectionOverride\.value\)/);
  assert.match(app, /richTitleMigration \? "blank" : currentTaskReportDocumentMode\(\)/);
  assert.match(app, /blankContent:[\s\S]{0,140}sectionOverride\?\.value \?\? taskForSave\.blank_content/);
  assert.match(app, /contributionTitle: taskReportSafeTitle\(richTitleMigration/);
});
test('Task Report Repository mirror stores a readable HTML working copy instead of flattened TXT', () => {
  const drafts = read('backend/src/private-draft-repository.js');
  const reader = read('backend/src/document-reader.js');
  const app = read('backend/src/app.js');
  assert.match(drafts, /buildTaskReportDraftSnapshot[\s\S]{0,4500}app2-task-report-draft/);
  assert.match(drafts, /fileExtension = "\.txt"/);
  assert.match(app, /fileExtension:\s*'\.html'/);
  assert.match(reader, /extension==='html'[\s\S]{0,180}sanitizeTaskReportHtml\(source\)/);
});

test('Task Report outline follows the chosen template and navigates within the editor', () => {
  assert.doesNotMatch(app, /outlineSections=\{\[\]\}/);
  assert.match(app, /outlineSections=\{taskReportRequiredSectionKeys\.map\(\(key\) => \(\{/);
  assert.match(workspace, /selectedTemplate\?\.sections\?\.length[\s\S]{0,240}status: props\.outlineSections\?\.find/);
  assert.match(workspace, /task-report-outline-group/);
  assert.match(workspace, /WORK & EVIDENCE/);
  assert.match(workspace, /ACTIONS & FOLLOW-UP/);
  assert.match(workspace, /navigateToOutlineSection\(section\)/);
  assert.match(workspace, /\.app2-lexical-document/);
  assert.match(workspace, /scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
  assert.match(workspace, /headingAliases/);
  assert.match(read('src/modules/report-builder/styles/report-builder.css'), /task-report-outline-group/);
});

test('Task Report reader base formatting matches the Lexical editor presentation', () => {
  const html = read('src/modules/report-editor/reportHtml.ts');
  assert.match(html, /font-family: Calibri, Arial, sans-serif; font-size: 12pt; line-height: 1\.5/);
  assert.match(html, /min-height: 1180px; margin: 24px auto; padding: 70px 76px/);
  assert.match(html, /table-layout: fixed/);
  assert.match(html, /#aeb9c7; padding: 7px 8px/);
  assert.match(html, /#f4f6f9/);
  assert.match(html, /"margin-top", "margin-bottom"/);
  assert.match(html, /property === "margin-top" \|\| property === "margin-bottom"/);
  assert.doesNotMatch(html, /Times New Roman/);
});

test('Task Report reader exposes bounded zoom and fit-to-width sizing controls', () => {
  const previewPanel = read('src/modules/tasks/TaskReportPreviewPanel.tsx');
  const previewCss = read('src/assignment-task-workspace.css');
  const reportHtml = read('src/modules/report-editor/reportHtml.ts');
  assert.match(previewPanel, /role="group" aria-label="Reader page sizing"/);
  assert.match(previewPanel, /aria-label="Zoom out"/);
  assert.match(previewPanel, /aria-label="Zoom in"/);
  assert.match(previewPanel, /className="task-report-reader-maximize"/);
  assert.match(previewPanel, /aria-label=\{maximized \? "Restore reader" : "Maximise reader"\}/);
  assert.match(previewPanel, /onClick=\{fitReaderToWidth\}/);
  assert.match(previewPanel, /Math\.max\(50, current - 10\)/);
  assert.match(previewPanel, /Math\.min\(150, current \+ 10\)/);
  assert.match(previewPanel, /--task-report-reader-zoom/);
  assert.match(reportHtml, /zoom: var\(--task-report-reader-zoom, 1\)/);
  assert.match(previewCss, /\.task-report-reader-sizing button:focus-visible/);
  assert.match(previewCss, /\.task-contribution-report-modal > header \.task-report-reader-maximize/);
});

test('Task Report submission restores its assigned reviewer and requires a confirmed review state', () => {
  assert.match(workspace, /currentReviewerId\?: string/);
  assert.match(workspace, /props\.currentReviewerId && options\.some/);
  assert.match(panel, /currentReviewerId=\{currentReviewerId \|\| undefined\}/);
  assert.match(app, /currentReviewerId=\{selectedAssignmentTask\.reviewer_id\}/);
  assert.match(app, /statusOverride === "Ready for Integration"[\s\S]{0,180}saved\.contribution_status !== "Ready for Integration"/);
  assert.match(app, /selectAssignmentTaskReviewer\(reviewerId\)/);
});

test('Approved Task Reports finalize from the immutable approved version into a published PDF', () => {
  const backend = read('backend/src/app.js');
  const decisionStart = backend.indexOf("app.post('/api/assignments/:id/tasks/:taskId/contribution-review'");
  const decisionEnd = backend.indexOf("app.post('/api/assignments/:id/tasks/:taskId/reopen-after-rejection'", decisionStart);
  const finalizeStart = backend.indexOf("app.post('/api/assignments/:id/tasks/:taskId/contribution-finalize'");
  const finalizeEnd = backend.indexOf("app.post('/api/assignments/:id/tasks/:taskId/", finalizeStart + 70);
  const decision = backend.slice(decisionStart, decisionEnd);
  const finalize = backend.slice(finalizeStart, finalizeEnd);
  const repository = read('backend/src/private-draft-repository.js');
  assert.ok(decisionStart >= 0 && decisionEnd > decisionStart);
  assert.ok(finalizeStart >= 0 && finalizeEnd > finalizeStart);
  assert.match(decision, /UPDATE task_report_versions SET status=\$1/);
  assert.match(app, /if \(decision === "Approved"\) \{[\s\S]*?api\.finalizeAssignmentTaskContribution\(/);
  assert.match(finalize, /status='Approved'/);
  assert.match(finalize, /buildPscTaskFinalPdf\(/);
  assert.match(finalize, /promotePrivateDraftToPublished\(/);
  assert.match(finalize, /finalDocumentType:'Task Final Report'/);
  assert.match(finalize, /mimeType='application\/pdf'/);
  assert.match(repository, /status='Published'/);
});
