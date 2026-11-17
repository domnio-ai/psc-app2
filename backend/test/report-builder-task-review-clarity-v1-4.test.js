import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workspace = fs.readFileSync(
  path.join(root, 'src/modules/assignments/components/TaskSectionWorkspace.tsx'),
  'utf8'
);
const css = fs.readFileSync(
  path.join(root, 'src/modules/report-builder/styles/report-builder.css'),
  'utf8'
);

test('task review ribbon has one task-specific readiness summary', () => {
  assert.match(workspace, /className="task-report-review-meta"/);
  assert.match(workspace, /Reviewer<\/small>/);
  assert.match(workspace, /Structure<\/small>/);
});

test('generic readiness contract is excluded from task reports', () => {
  assert.match(
    workspace,
    /props\.onSubmitForReview && props\.workspaceVariant !== "task-report"/,
  );
  assert.match(workspace, /className="report-readiness-contract"/);
});

test('Task Report submit workflow is whole-document and reviewer controlled', () => {
  assert.match(
    workspace,
    /\(props\.workspaceVariant === "task-report" \|\|\s*props\.canSubmitForReview\) &&\s*props\.onSubmitForReview/,
  );
  assert.match(
    workspace,
    /props\.workspaceVariant === "task-report"\s*\?\s*hasBlankDocumentContent/,
  );
  assert.match(workspace, /Select reviewer to submit/);
  assert.match(workspace, /Add report content before submitting this Task Report/);
  assert.match(workspace, /Submit to Reviewer/);
  assert.match(workspace, /reviewNote\.trim\(\)/);
});

test('task review metadata is responsive and scoped to task builder', () => {
  assert.match(css, /TASK REPORT REVIEW RIBBON.{0,3}V1\.4/);
  assert.match(css, /\.task-report-builder-v1 \.task-report-review-meta/);
  assert.match(css, /@media \(max-width: 980px\)/);
});


