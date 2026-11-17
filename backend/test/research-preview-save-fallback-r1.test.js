import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '../..');
const app = readFileSync(resolve(projectRoot, 'src', 'App.tsx'), 'utf8');
const modal = readFileSync(resolve(projectRoot, 'src', 'modules', 'research', 'components', 'ResearchReportPreviewModal.tsx'), 'utf8');
const css = readFileSync(resolve(projectRoot, 'src', 'modules', 'research', 'styles', 'research-report-preview-modal.css'), 'utf8');
test('Research save exposes the original API or authorization error instead of masking it', () => {
  assert.match(app, /researchSectionSaveErrorRef\.current = message/);
  assert.match(app, /The Research section could not be saved\. \$\{reason\} The Report Builder remains open\./);
});
test('Research preview opens from local editor content when the save request fails', () => {
  assert.match(app, /const saved = await saveResearchSectionDraft\(contentToPreview, false\);[\s\S]*if \(!saved\)[\s\S]*setResearchReportPreviewWarning\(warning\);[\s\S]*setResearchReportPreviewOpen\(true\);/);
  assert.match(app, /section\.id === localPreviewSection\.id \? \{ \.\.\.section, content: contentToPreview \} : section/);
});
test('unsaved local preview is visibly labelled and cannot be exported as a saved PDF', () => {
  assert.match(modal, /previewWarning\?: string/);
  assert.match(modal, /research-preview-unsaved-warning/);
  assert.match(modal, /Boolean\(props\.previewWarning\)/);
  assert.match(css, /\.research-preview-unsaved-warning/);
});