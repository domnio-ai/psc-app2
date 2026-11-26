import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("backend/src/app.js", "utf8");
const schema = fs.readFileSync("backend/src/schema.sql", "utf8");
const evidencePanel = fs.readFileSync("src/modules/research/components/ResearchEvidencePanel.tsx", "utf8");
const assignmentEvidence = fs.readFileSync("src/modules/assignments/components/AssignmentEvidencePanel.tsx", "utf8");
const relationshipMigration = fs.readFileSync("backend/migrations/034_repository_relationships_evidence.sql", "utf8");

test("research evidence links only published, non-archived and readable repository documents", () => {
  const start = app.indexOf("app.post('/api/research/:id/repository-documents/link'");
  const end = app.indexOf("app.delete('/api/research/:id/repository-documents/:knowledgeId'", start);
  assert.ok(start >= 0 && end > start);
  const route = app.slice(start, end);
  assert.match(route, /canEditResearch/);
  assert.match(route, /document\.status!=='Published'\|\|document\.is_archived/);
  assert.match(route, /canReadKnowledge/);
  assert.match(route, /research_knowledge_links/);
  assert.match(route, /repository_entity_links/);
  assert.match(route, /REPOSITORY_EVIDENCE_LINKED/);
  assert.match(route, /RESEARCH_REPOSITORY_EVIDENCE_LINKED/);
});

test("research evidence relationships are unique and preserve source document versions", () => {
  assert.match(schema, /PRIMARY KEY\(project_id,knowledge_item_id\)/);
  assert.match(schema, /UNIQUE\(knowledge_id,entity_type,entity_id\)/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS knowledge_versions/);
  assert.match(relationshipMigration, /pinned_version_id UUID REFERENCES knowledge_versions\(id\) ON DELETE SET NULL/);
  assert.match(relationshipMigration, /'Evidence for','Reference for','Source for','Supports'/);
});

test("research evidence UI links existing published records without copying or moving them", () => {
  assert.match(evidencePanel, /item\.status === "Published" && !item\.is_archived/);
  assert.match(evidencePanel, /Linking does not copy, move or change the original Repository document/);
  assert.match(evidencePanel, /linkResearchRepositoryDocument/);
  assert.match(evidencePanel, /unlinkResearchRepositoryDocument/);
});

test("assignment evidence panel can attach and preview repository evidence alongside uploaded files", () => {
  assert.match(assignmentEvidence, /Attach existing repository document/);
  assert.match(assignmentEvidence, /onAttachRepositoryDocument/);
  assert.match(assignmentEvidence, /onPreviewRepository/);
  assert.match(assignmentEvidence, /UPLOADED DOCUMENT/);
  assert.match(assignmentEvidence, /REPOSITORY DOCUMENT/);
});
