import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../..");
const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src/felix.css"), "utf8");

test("global Felix launcher can be dismissed without navigating away", () => {
  assert.match(app, /const \[felixLauncherDismissed, setFelixLauncherDismissed\] = useState\(false\);/);
  assert.match(app, /data-felix-closeable-wrapper="true"/);
  assert.match(app, /data-felix-dismissed=\{felixLauncherDismissed \? "true" : "false"\}/);
  assert.match(app, /className="felix-launcher-close"/);
  assert.match(app, /setFelixLauncherDismissed\(true\)/);
});

test("dismissed Felix launcher can be reopened without removing Felix", () => {
  assert.match(app, /className="felix-launcher-reopen"/);
  assert.match(app, /<>[\s\S]*className="felix-launcher-reopen"[\s\S]*<\/>/);
  assert.match(app, /setFelixLauncherDismissed\(false\)/);
  assert.match(app, /setActive\("AI Researcher"\)/);
  assert.match(css, /\[data-felix-closeable-wrapper="true"\]\[data-felix-dismissed="true"\]\{display:none!important\}/);
});

test("close/reopen controls have accessible labels and focus-visible styles", () => {
  assert.match(app, /aria-label="Close Felix assistant"/);
  assert.match(app, /aria-label="Reopen Felix assistant"/);
  assert.match(css, /\.felix-launcher-close:focus-visible/);
  assert.match(css, /\.felix-launcher-reopen:focus-visible/);
});