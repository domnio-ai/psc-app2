import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace=fs.readFileSync(
  "src/modules/assignments/components/TaskSectionWorkspace.tsx",
  "utf8"
);

test("Task Report governance header no longer exposes section counts",()=>{
  assert.match(workspace,/<small>Document<\/small>\s*<strong>Task Report<\/strong>/);
  assert.doesNotMatch(workspace,/\$\{readySectionCount\}\/\$\{totalSectionCount\} sections/);
});

test("Task Report keeps its existing Structure/template surface",()=>{
  assert.match(
    workspace,
    /<small>Structure<\/small>\s*<strong>\{blankDocumentMode \? "Blank document" : selectedTemplate\?\.name \|\| "Task report"\}<\/strong>/
  );
  assert.match(workspace,/"Templates"/);
});

test("Task Report cannot render Previous or Next section controls",()=>{
  assert.match(
    workspace,
    /props\.workspaceVariant !== "task-report" && !blankDocumentMode && props\.onPrevious/
  );
  assert.match(
    workspace,
    /props\.workspaceVariant !== "task-report" && !blankDocumentMode && props\.onNext/
  );
});

test("Task Report cannot render Mark Section Ready",()=>{
  assert.match(
    workspace,
    /props\.workspaceVariant !== "task-report" && props\.onMarkReady/
  );
});

test("Task Report still uses whole-document content for submission readiness",()=>{
  assert.match(
    workspace,
    /props\.workspaceVariant === "task-report"\s*\?\s*hasBlankDocumentContent/
  );
});

test("shared Lexical editor and ribbon remain present",()=>{
  assert.match(workspace,/reportEditorRef/);
  assert.match(workspace,/className="document-ribbon"/);
  assert.match(workspace,/className="report-command-row"/);
});
