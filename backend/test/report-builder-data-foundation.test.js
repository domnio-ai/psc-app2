import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("shared report catalog owns governed template classification", () => {
  const source = read("src/modules/report-builder/services/reportCatalog.ts");
  assert.match(source, /assignmentReportTemplates/);
  assert.match(source, /taskReportTemplates/);
  assert.match(source, /researchReportTemplates/);
  assert.match(source, /toResearchTemplateLibrary/);
  assert.match(source, /normalizeReviewerOptions/);
});

test("assignment report reviewer choices come from an authoritative endpoint", () => {
  const backend = read("backend/src/app.js");
  const api = read("src/api.ts");
  const builder = read(
    "src/modules/assignments/components/AssignmentReportBuilder.tsx",
  );

  assert.match(backend, /\/api\/assignments\/:id\/report-reviewers/);
  assert.match(backend, /isEligibleAssignmentTaskReviewer/);
  assert.match(backend, /candidate\.id!==req\.user\.id/);
  assert.match(api, /assignmentReportReviewers/);
  assert.match(builder, /api\s*\.\s*assignmentReportReviewers/);
  assert.match(builder, /reviewerOptions=\{availableReviewers\}/);
});

test("assignment task and research template consumers use shared catalog", () => {
  const app = read("src/App.tsx");
  const builder = read(
    "src/modules/assignments/components/AssignmentReportBuilder.tsx",
  );

  assert.match(app, /assignmentReportTemplates\(builderTemplates\)/);
  assert.match(app, /taskReportTemplates\(builderTemplates\)/);
  assert.match(app, /researchReportTemplates\(builderTemplates\)/);
  assert.match(app, /toResearchTemplateLibrary\(/);
  assert.match(builder, /assignmentReportTemplates\(rows\)/);
});

test("research templates retain a safe built-in fallback", () => {
  const app = read("src/App.tsx");
  assert.match(
    app,
    /toResearchTemplateLibrary\(\s*builderTemplates,\s*BUILT_IN_RESEARCH_REPORT_TEMPLATES/,
  );
});


test("research template fallback accepts readonly built-in catalogues", () => {
  const source = read("src/modules/report-builder/services/reportCatalog.ts");
  assert.match(source, /ResearchTemplateLibrarySource = ReadonlyArray<ResearchTemplateLibraryItem>/);
  assert.match(source, /fallback:\s*ResearchTemplateLibrarySource/);
});
