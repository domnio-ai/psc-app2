import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/App.tsx", "utf8");
const boundary = fs.readFileSync("src/modules/tasks/TaskReportPreviewErrorBoundary.tsx", "utf8");
const styles = fs.readFileSync("src/assignment-task-workspace.css", "utf8");

test("Task Report preview render failures stay inside the report workflow", () => {
  assert.match(app, /<TaskReportPreviewErrorBoundary onClose=\{closeAssignmentTaskReportPreview\}>[\s\S]*?<TaskReportPreviewPanel/);
  assert.match(boundary, /componentDidCatch\(error: Error, info: ErrorInfo\)/);
  assert.match(boundary, /Preview error details/);
  assert.match(boundary, /Return to report editor/);
  assert.match(styles, /\.task-report-preview-error\{/);
});
