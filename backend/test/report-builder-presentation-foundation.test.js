import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("report builder imports one shared presentation owner", () => {
  const workspace = read(
    "src/modules/assignments/components/TaskSectionWorkspace.tsx",
  );
  assert.match(
    workspace,
    /import "\.\.\/\.\.\/report-builder\/styles\/report-builder\.css"/,
  );
  assert.doesNotMatch(workspace, /report-builder-redesign-v1\.css/);
  assert.equal(
    workspace.includes("report-builder-redesign-v1.css"),
    false,
  );
  assert.equal(
    fs.existsSync("src/modules/report-builder/styles/report-builder.css"),
    true,
  );
});

test("preview and import use semantic classes without generic secondary", () => {
  const workspace = read(
    "src/modules/assignments/components/TaskSectionWorkspace.tsx",
  );
  assert.match(workspace, /className="report-action-preview"/);
  assert.match(workspace, /className="report-action-import"/);
  assert.doesNotMatch(workspace, /secondary report-action-preview/);
  assert.doesNotMatch(workspace, /secondary report-action-import/);
});

test("shared report builder controls have opaque readable surfaces", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /OPAQUE CONTROL SURFACES/);
  assert.match(css, /background-color:\s*#ffffff\s*!important/);
  assert.match(css, /select option/);
  assert.match(css, /-webkit-text-fill-color:\s*#172033\s*!important/);
  assert.match(css, /\.report-action-preview:disabled/);
  assert.match(css, /background:\s*#d6dee8\s*!important/);
});

test("report builder keeps a 12px minimum control typography floor", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /font-size:\s*max\(12px,\s*1em\)\s*!important/);
});
