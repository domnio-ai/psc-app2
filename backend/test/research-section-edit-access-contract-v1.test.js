import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const backend = readFileSync(path.join(root, 'backend', 'src', 'app.js'), 'utf8');
const api = readFileSync(path.join(root, 'src', 'api.ts'), 'utf8');
const app = readFileSync(path.join(root, 'src', 'App.tsx'), 'utf8');
const editor = readFileSync(path.join(root, 'src', 'modules', 'research', 'components', 'ResearchReportWorkspace.tsx'), 'utf8');

test('Research access probe preserves PATCH authorization and mirrors the actual content-lock contract', () => {
  assert.match(backend, /app\.get\(\s*['"]\/api\/research\/:id\/report\/:sectionId\/access['"]/);
  assert.match(backend, /const canManageSection=isOrganisationScopeRole\(req\.user\.role\)\|\|\(isTeamScopeRole\(req\.user\.role\)&&await canManageResearch\(req\.user,req\.params\.id\)\)\|\|isImmediateManager\|\|project\?\.lead_id===req\.user\.id/);
  assert.match(backend, /const locked=Boolean\(latestSubmission&&\['Submitted','Approved'\]\.includes\(latestSubmission\.status\)\)/);
  assert.match(backend, /This report section is assigned to another team member\./);
  assert.match(backend, /latestSubmission\?\.status==='Submitted'/);
  assert.match(backend, /latestSubmission\?\.status==='Approved'/);
  assert.match(api, /researchReportSectionAccess:/);
});

test('Research Report Builder fails closed until the server explicitly confirms edit access', () => {
  assert.match(editor, /props\.mode === "edit" && props\.canEditSection === true && !props\.busy/);
  assert.match(editor, /props\.mode === "review" \|\| props\.canEditSection !== true/);
  assert.match(editor, /VERIFYING ACCESS/);
  assert.match(editor, /props\.sectionOwnerName/);
  assert.match(editor, /disabled=\{!editable\} onChange=\{\(event\) => setReviewerId/);
});

test('App checks access before saving and cancels navigation if permission or draft save fails', () => {
  assert.match(app, /const access = await loadResearchSectionAccess\(selectedResearch\.id, selectedReportSection\.id\);[\s\S]*if \(!access\.can_edit\)[\s\S]*return false;/);
  assert.match(app, /canEditSection=\{canEditSelectedResearchSection\}/);
  assert.match(app, /if \(!access\.can_edit\) \{ if \(contentToSave === selectedReportSection\.content && !researchReportPreviewWarning\) return true/);
  assert.match(app, /return Boolean\(await saveResearchSectionDraft\(contentToSave, false\)\)/);
});

test('Unsaved local preview fallback remains intact when permission or the save API denies persistence', () => {
  assert.match(app, /const saved = await saveResearchSectionDraft\(contentToPreview, false\);[\s\S]*if \(!saved\)[\s\S]*setResearchReportPreviewWarning\(warning\);[\s\S]*setResearchReportPreviewOpen\(true\);/);
  assert.match(app, /section\.id === localPreviewSection\.id \? \{ \.\.\.section, content: contentToPreview \} : section/);
  assert.doesNotMatch(app, /const access = await loadResearchSectionAccess\(selectedResearch\.id, selectedReportSection\.id\);\s*if \(!access\.can_edit\)\s*\{\s*setResearchReportPreviewWarning\(""\)/);
});