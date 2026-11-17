import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { minutesContentToEditorHtml } from "../src/modules/meetings/minutesContent.ts";

 test("converts generated meeting-minute headings, paragraphs and lists to editor HTML", () => {
  const source = "# Quarterly ICT Meeting\n\nDate: 22 October 2026\n\n## Attendance\n- Jane Doe\n- John Doe\n\n## Decisions\n1. Approve the report";
  const actual = minutesContentToEditorHtml(source);
  assert.match(actual, /<h1>Quarterly ICT Meeting<\/h1>/);
  assert.match(actual, /<p>Date: 22 October 2026<\/p>/);
  assert.match(actual, /<h2>Attendance<\/h2>/);
  assert.match(actual, /<ul><li>Jane Doe<\/li><li>John Doe<\/li><\/ul>/);
  assert.match(actual, /<ol><li>Approve the report<\/li><\/ol>/);
 });

test("escapes raw text and does not permit a plain-text draft to become markup", () => {
  assert.equal(minutesContentToEditorHtml("<script>alert(1)</script>"), "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
});

test("preserves existing rich-editor HTML without double wrapping", () => {
  const html = "<h2>Attendance</h2><ul><li>Jane</li></ul>";
  assert.equal(minutesContentToEditorHtml(html), html);
});

test("preserves the minutes governance workflow while mounting the shared editor", async () => {
  const workspace = await readFile(new URL("../src/modules/meetings/MeetingsWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /App2LexicalReportEditor/);
  assert.match(workspace, /minutesContentToEditorHtml\(minutesText\)/);
  assert.match(workspace, /meetingsApi\.saveMinutes/);
  assert.match(workspace, /meetingsApi\.submitMinutes/);
  assert.match(workspace, /meetingsApi\.reviewMinutes/);
  assert.match(workspace, /"Approved"/);
  assert.match(workspace, /"Returned"/);
});