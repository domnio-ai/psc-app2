import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const readProjectFile = (relativePath) =>
  readFile(path.join(projectRoot, relativePath), "utf8");

test("PSC Task Report branding is present in editor, previews, and Repository snapshot", async () => {
  const [
    editor,
    repository,
    sanitizer,
    editorCss,
    readerCss,
    app,
    logo
  ] = await Promise.all([
    readProjectFile("src/modules/assignments/components/TaskSectionWorkspace.tsx"),
    readProjectFile("backend/src/private-draft-repository.js"),
    readProjectFile("backend/src/task-report-formatting.js"),
    readProjectFile("src/modules/tasks/task-report-workspace.css"),
    readProjectFile("src/document-reader.css"),
    readProjectFile("backend/src/app.js"),
    readFile(path.join(projectRoot, "public/psc-logo.png"))
  ]);

  assert.ok(logo.length > 0, "PSC logo asset must exist");
  assert.match(editor, /className="app2-psc-report-brand"/);
  assert.ok(
    editor.indexOf('className="app2-psc-report-brand"') <
      editor.indexOf('className="app2-task-report-kicker"'),
    "PSC logo must appear at the top of the report page, before its draft label and title",
  );
  assert.match(editor, /src="\/psc-logo\.png"/);
  assert.match(repository, /class="app2-psc-report-brand"/);
  assert.match(repository, /src="\/psc-logo\.png"/);
  assert.match(sanitizer, /"app2-psc-report-brand"/);
  assert.match(editorCss, /APP2_PSC_REPORT_GOLD_BRAND_V1/);
  assert.match(readerCss, /APP2_PSC_REPORT_GOLD_BRAND_V1/);
  assert.match(editorCss, /#C89B2C/);
  assert.match(readerCss, /#8B6914/);
  assert.match(app, /app2-psc-report-brand/);
});

test("PSC PDF branding is enabled for immutable final Task Reports", async () => {
  const [app, renderer] = await Promise.all([
    readProjectFile("backend/src/app.js"),
    readProjectFile("backend/src/task-report-pdf.js"),
  ]);

  assert.match(app, /import \{buildPscTaskFinalPdf\} from '\.\/task-report-pdf\.js'/);
  assert.match(renderer, /export const buildPscTaskFinalPdf = async/);
  assert.match(renderer, /const GOLD = "#8B6914"/);
  assert.match(renderer, /const DIVIDER = "#C89B2C"/);
  assert.match(app, /finalizationStage='generate-pdf'/);
  assert.match(app, /const originalName=\`\$\{safeBase\}-final-v\$\{Number\(current\.contribution_report_version\|\|1\)\}\.pdf\`/);
  assert.match(app, /const mimeType='application\/pdf'/);
  assert.match(app, /bytes:finalPdf/);
  assert.match(app, /notes:'Automatically generated PSC-branded PDF from reviewer-approved task report'/);
  assert.match(app, /styles:\{paragraphStyles:/);
});

test("reviewer approval automatically attempts final PDF publication", async () => {
  const app = await readProjectFile("src/App.tsx");

  assert.match(app, /if \(decision === "Approved"\) \{[\s\S]*?api\.finalizeAssignmentTaskContribution\(/);
  assert.match(app, /finalised\.contribution_status !== "Accepted"/);
  assert.match(app, /Use Generate final report to retry\./);
  assert.match(app, /generated as a PDF, published to the Document Repository, and the task completed\./);
});
