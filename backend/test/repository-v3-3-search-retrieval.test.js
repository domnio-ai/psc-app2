import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
const header = fs.readFileSync(new URL('../../src/modules/repository/components/RepositoryHeaderPanel.tsx', import.meta.url), 'utf8');
const advanced = fs.readFileSync(new URL('../../src/modules/repository/components/RepositoryAdvancedSearch.tsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../src/modules/repository/repository-records-v2.css', import.meta.url), 'utf8');

test('Repository V3.3 exposes unified retrieval reset', () => {
  assert.match(app, /const resetRepositoryRetrievalView = \(\) =>/);
  assert.match(app, /setRepositoryAdvancedFilters\(emptyRepositoryAdvancedFilters\)/);
  assert.match(app, /setRepositoryOperationalQueue\("All"\)/);
  assert.match(app, /setRepositoryAssuranceFilter\("ALL"\)/);
  assert.match(app, /Clear all filters/);
});

test('Repository V3.3 communicates active filter state', () => {
  assert.match(app, /repositoryActiveFilterCount/);
  assert.match(app, /active filter/);
  assert.match(app, /repository-retrieval-summary/);
  assert.match(css, /APP2 REPOSITORY V3\.3 - SEARCH, FILTERS & RETRIEVAL REFINEMENT/);
});

test('Repository V3.3 search guidance includes reviewer and status while preserving foundation placeholder', () => {
  assert.match(header, /Search title, record number, class, owner, source or description/);
  assert.match(header, /owner, reviewer, source, status/);
  assert.match(app, /item\.reviewer_name/);
  assert.match(app, /item\.status/);
});

test('Repository V3.3 advanced search uses readable chips and updated activity dates', () => {
  assert.match(advanced, /Record class/);
  assert.match(advanced, /Updated from/);
  assert.match(advanced, /Updated to/);
  assert.match(advanced, /Any protection/);
  assert.match(advanced, /Saved retrieval view/);
  assert.match(advanced, /Clear all/);
  assert.match(app, /item\.updated_at \|\| item\.created_at/);
});

test('Repository V3.3 resets pagination when retrieval criteria change', () => {
  assert.match(app, /useEffect\(\(\) => \{\s*setRepositoryListPage\(1\)/s);
  assert.match(app, /repositoryAdvancedFilters,/);
  assert.match(app, /repositoryOperationalQueue,/);
  assert.match(app, /repositoryAssuranceFilter,/);
});

test('Repository V3.3 preserves calm five-column record list and direct workspace navigation', () => {
  assert.match(app, /<span>Record<\/span>/);
  assert.match(app, /<span>Context<\/span>/);
  assert.match(app, /<span>Status<\/span>/);
  assert.match(app, /<span>Governance<\/span>/);
  assert.match(app, /<span>Actions<\/span>/);
  assert.match(app, /repository-record-title-button/);
  assert.match(app, /setRepositoryWorkspaceDocument\(item\)/);
});
