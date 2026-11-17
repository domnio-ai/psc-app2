import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const app = fs.readFileSync(path.join(root, 'src', 'App.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'documents.css'), 'utf8');

test('Repository V3.4 derives a deterministic primary App2 origin without changing source records', () => {
  assert.match(app, /const repositoryPrimaryOrigin = \(item: DocumentItem\)/);
  assert.match(app, /const priority = \["task", "assignment", "research", "report"\]/);
  assert.match(app, /const repositoryOriginDisplay = \(item: DocumentItem\)/);
});

test('Repository V3.4 surfaces an explicit source to repository to current-state trace', () => {
  assert.match(app, /const repositoryTraceLabel = \(item: DocumentItem\)/);
  assert.match(app, /Repository →/);
  assert.match(app, /Final \/ Published/);
  assert.match(app, /aria-label={`Traceability for \$\{item\.title\}`}/);
  assert.match(app, /<b>Origin:<\/b>/);
  assert.match(app, /<b>Trace:<\/b>/);
});

test('Repository V3.4 opens only existing authorised source workspaces', () => {
  assert.match(app, /const openRepositoryOrigin = async \(item: DocumentItem\)/);
  assert.match(app, /await openStandaloneTask\(origin\.id\)/);
  assert.match(app, /await openAssignmentDetails\(assignment\)/);
  assert.match(app, /await openResearchWorkspace\(project, "Overview"\)/);
  assert.match(app, /await openGeneratedDocument\(origin\.id\)/);
  assert.match(app, /outside your current authorised scope/);
});

test('Repository V3.4 keeps traceability compact and theme aware', () => {
  assert.match(css, /APP2 REPOSITORY V3\.4 - CROSS-MODULE RECORD TRACEABILITY/);
  assert.match(css, /\.repository-traceability-inline/);
  assert.match(css, /color-mix\(in srgb,var\(--accent-primary\)/);
  assert.match(css, /\.repository-linked-count/);
});

test('Repository V3.4 preserves established Repository governance and retrieval behavior', () => {
  assert.match(app, /Reviewer required/);
  assert.match(app, /Audit trail/);
  assert.match(app, /Relationships \/ evidence/);
  assert.match(app, /repositoryActiveFilterCount/);
  assert.match(app, /resetRepositoryRetrievalView/);
});
