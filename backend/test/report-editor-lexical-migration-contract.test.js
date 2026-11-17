import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(file, "utf8");

const packageJson = JSON.parse(read("package.json"));
const taskWorkspace = read("src/modules/assignments/components/TaskSectionWorkspace.tsx");
const assignmentWorkspace = read("src/modules/assignments/components/AssignmentReportBuilder.tsx");
const researchWorkspace = read("src/modules/research/components/ResearchReportWorkspace.tsx");
const editor = read("src/modules/report-editor/App2LexicalReportEditor.tsx");
const html = read("src/modules/report-editor/reportHtml.ts");

const deletedEditorFiles = [
  "src/modules/report-builder/core/App2ReportEditor.tsx",
  "src/modules/report-builder/core/editorExtensions.ts",
  "src/modules/report-builder/core/editor-foundation.css",
  "src/modules/report-builder/core/index.ts",
  "src/modules/report-builder/core/reportImageProcessing.ts",
  "src/modules/report-builder/core/reportSerialization.ts",
];

test("all report-authorship workspaces use the shared Lexical engine", () => {
  assert.match(taskWorkspace, /\.\.\/\.\.\/report-editor\/App2LexicalReportEditor/);
  assert.match(taskWorkspace, /<App2LexicalReportEditor/);
  assert.match(assignmentWorkspace, /<TaskSectionWorkspace/);
  assert.match(researchWorkspace, /\.\.\/\.\.\/report-editor\/App2LexicalReportEditor/);
  assert.match(researchWorkspace, /<App2LexicalReportEditor/);
  assert.match(researchWorkspace, /const App2LexicalReportEditor = lazy/);
  assert.match(researchWorkspace, /<Suspense fallback=/);
  assert.match(researchWorkspace, /run\("mergeCells"\)/);
  assert.match(researchWorkspace, /run\("splitCell"\)/);
  assert.match(editor, /data-editor-engine="lexical"/);
});

test("Lexical dependencies are pinned to one MIT-licensed release and legacy editor dependencies are removed", () => {
  const deps = packageJson.dependencies || {};
  const oldEditorDeps = Object.keys(deps).filter((name) => name.startsWith("@tiptap/"));
  assert.deepEqual(oldEditorDeps, []);
  for (const name of [
    "lexical",
    "@lexical/code",
    "@lexical/history",
    "@lexical/html",
    "@lexical/link",
    "@lexical/list",
    "@lexical/react",
    "@lexical/rich-text",
    "@lexical/selection",
    "@lexical/table",
    "@lexical/utils",
  ]) {
    assert.equal(deps[name], "0.52.0", `${name} should be pinned consistently`);
  }
});

test("Lexical 0.52 APIs are used for history, errors, selection and table operations", () => {
  assert.match(editor, /import \{ LexicalErrorBoundary \} from "@lexical\/react\/LexicalErrorBoundary"/);
  assert.match(editor, /REDO_COMMAND as HISTORY_REDO_COMMAND, UNDO_COMMAND as HISTORY_UNDO_COMMAND \} from "lexical"/);
  assert.match(editor, /if \(!\$isRangeSelection\(selection\)\) return;[\s\S]*?const anchorNode = selection\.anchor\.getNode\(\);/);
  assert.match(editor, /case "mergeCells": \{[\s\S]*?if \(!\$isTableSelection\(selection\)\) return;[\s\S]*?\$mergeCells\(selectedCells\)/);
  assert.match(editor, /case "splitCell": \{[\s\S]*?selectedCell\.getColSpan\(\)[\s\S]*?selectedCell\.getRowSpan\(\)[\s\S]*?\$unmergeCell\(\)/);
  assert.match(editor, /\$setTableRowIsHeader\(table, rowIndex, !isHeader\)/);
});

test("HTML import/export preserves rich blocks and common report table operations", () => {
  assert.match(editor, /\$generateNodesFromDOM/);
  assert.match(editor, /\$generateHtmlFromNodes/);
  assert.match(editor, /TablePlugin hasCellMerge=\{true\}/);
  assert.match(editor, /INSERT_TABLE_COMMAND/);
  assert.match(editor, /\$insertTableRowAtSelection/);
  assert.match(editor, /\$deleteTableRowAtSelection/);
  assert.match(editor, /\$insertTableColumnAtSelection/);
  assert.match(editor, /\$deleteTableColumnAtSelection/);
  assert.match(editor, /case "addRowAfter":[\s\S]*?if \(!findTableForSelection\(\)\) return;[\s\S]*?\$insertTableRowAtSelection\(true\)/);
  assert.match(editor, /case "addColumnAfter":[\s\S]*?if \(!findTableForSelection\(\)\) return;[\s\S]*?\$insertTableColumnAtSelection\(true\)/);
  assert.match(editor, /\$mergeCells/);
  assert.match(editor, /\$unmergeCell/);
  assert.match(editor, /updateImage:/);
  assert.match(editor, /removeImage:/);
  assert.match(editor, /App2ParagraphNode/);
  assert.match(editor, /App2HeadingNode/);
  assert.match(editor, /applyImportedReportBlockAttributes/);
  assert.match(editor, /applyExportedReportIndent/);
  assert.match(editor, /data-app2-indent/);
  assert.match(editor, /editor\.focus\(\)/);
  assert.match(editor, /nearest paragraph\/heading, not the document.s top-level/);
});

test("legacy HTML recovery is bounded and unsafe markup is sanitized before Lexical import", () => {
  assert.match(html, /MAX_HTML_ESCAPE_LAYERS = 5/);
  assert.match(html, /normalizeReportHtml/);
  assert.match(html, /sanitizeReportHtmlForEditor/);
  assert.match(html, /hasNestedReportTables/);
  assert.match(html, /script,style,iframe,object,embed/);
  assert.match(html, /name\.startsWith\("on"\)/);
  assert.match(html, /data-app2-indent/);
  assert.match(html, /app2-report-table-cell/);
  assert.match(html, /Only allow relative same-origin URLs/);
  assert.match(editor, /arbitrary schemes/);
  assert.match(editor, /const safeLinkHref =/);
  assert.match(editor, /argument && safeLinkHref\(argument\)/);
});

test("the old editor implementation is removed rather than retained as a fallback", () => {
  for (const file of deletedEditorFiles) {
    assert.equal(fs.existsSync(path.resolve(file)), false, `${file} should be deleted`);
  }
  assert.doesNotMatch(taskWorkspace, /App2ReportEditor|reportTiptap|runLegacyCommand/);
  assert.doesNotMatch(researchWorkspace, /App2ReportEditor|runLegacyCommand/);
});

test("production code contains no legacy Tiptap editor references after the cutover", () => {
  const productionRoots = ["src", "backend/src"];
  const walk = (root) => fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(?:ts|tsx|js|jsx|css|mjs|cjs)$/.test(entry.name) ? [full] : [];
  });
  const files = productionRoots.flatMap((root) => walk(path.resolve(root)));
  const pattern = /@tiptap\/|App2ReportEditor|ProseMirror|\.tiptap|Tiptap|tiptap|reportTiptap|app2-tiptap|modules\/report-builder\/core/;
  const matches = files.flatMap((file) => pattern.test(read(file)) ? [path.relative(process.cwd(), file)] : []);
  assert.deepEqual(matches, [], `legacy editor references remain: ${matches.join(", ")}`);
});
