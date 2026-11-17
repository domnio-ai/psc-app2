import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const component = fs.readFileSync("src/modules/tasks/TaskReportPreviewPanel.tsx", "utf8");
const styles = fs.readFileSync("src/assignment-task-workspace.css", "utf8");

test("Task Report preview exposes accessible Maximise and Restore controls", () => {
  assert.match(component, /aria-label=\{maximized \? "Restore reader" : "Maximise reader"\}/);
  assert.match(component, /aria-pressed=\{maximized\}/);
  assert.match(component, /maximized \? "Restore reader" : "Maximise reader"/);
  assert.match(component, /setMaximized\(\(value\) => !value\)/);
});

test("Task Report preview expands within its existing modal without replacing the document frame", () => {
  assert.match(component, /task-contribution-report-overlay\$\{maximized \? " maximized" : ""\}/);
  assert.match(component, /task-contribution-report-modal\$\{maximized \? " maximized" : ""\}/);
  assert.match(component, /srcDoc=\{html\}/);
  assert.match(styles, /\.task-contribution-report-overlay\.maximized\s*\{[^}]*place-items:\s*stretch/s);
  assert.match(styles, /\.task-contribution-report-modal\.maximized\s*\{[^}]*width:\s*100dvw[^}]*height:\s*100dvh/s);
});
