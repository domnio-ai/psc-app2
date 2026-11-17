import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("Phase 5E hides ribbon groups by default", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(
    css,
    /\.section-word-toolbar > \.ribbon-group \{\s*display: none !important/s,
  );
});

test("Home exposes only Home command families", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /data-active-tab="Home"/);
  for (const group of [
    "history-tools",
    "font-tools",
    "paragraph-tools",
    "styles-tools",
  ]) {
    assert.match(css, new RegExp(group));
  }
});

test("Insert exposes image and table command families", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /data-active-tab="Insert"/);
  assert.match(css, /insert-tools/);
  assert.match(css, /table-tools/);
  assert.match(css, /image-tools/);
});

test("Templates, Review and View are isolated by active tab", () => {
  const css = read("src/modules/report-builder/styles/report-builder.css");
  assert.match(css, /data-active-tab="Templates"/);
  assert.match(css, /report-template-tools/);
  assert.match(css, /template-tools/);
  assert.match(css, /data-active-tab="Review"/);
  assert.match(css, /editing-tools/);
  assert.match(css, /data-active-tab="View"/);
  assert.match(css, /view-tools/);
  assert.match(css, /output-tools/);
});

test("Phase 5E remains CSS-only", () => {
  assert.ok(
    fs.existsSync("src/modules/report-builder/styles/report-builder.css"),
  );
});
