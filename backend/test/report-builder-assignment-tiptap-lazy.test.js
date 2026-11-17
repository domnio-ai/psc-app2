import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("shared Lexical editor remains lazy-loaded", () => {
  const workspace = read(
    "src/modules/assignments/components/TaskSectionWorkspace.tsx",
  );
  assert.match(
    workspace,
    /const App2LexicalReportEditor = lazy\(\s*\(\) => import\("\.\.\/\.\.\/report-editor\/App2LexicalReportEditor"\),?\s*\)/s,
  );
  assert.match(
    workspace,
    /import type \{ App2LexicalReportEditorHandle \} from "\.\.\/\.\.\/report-editor\/App2LexicalReportEditor"/,
  );
  assert.doesNotMatch(workspace, /import App2ReportEditor,\s*\{/);
});

test("lazy boundary remains accessible", () => {
  const workspace = read(
    "src/modules/assignments/components/TaskSectionWorkspace.tsx",
  );
  assert.match(workspace, /<Suspense/);
  assert.match(workspace, /role="status"/);
  assert.match(workspace, /aria-live="polite"/);
  assert.match(workspace, /Loading report editor/);
});

test("lazy loading preserves the HTML value bridge", () => {
  const workspace = read(
    "src/modules/assignments/components/TaskSectionWorkspace.tsx",
  );
  assert.match(workspace, /const currentEditorValue = \(\): string =>/);
  assert.match(workspace, /reportEditorRef\.current\?\.getHTML\(\)/);
  assert.match(workspace, /latestValueRef\.current = html/);
  assert.match(workspace, /onChange\(html\)/);
});





