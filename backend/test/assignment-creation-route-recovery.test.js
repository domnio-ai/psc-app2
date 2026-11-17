import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/App.tsx", "utf8");

test("opening an assignment synchronizes route to Overview", () => {
  assert.match(
    app,
    /`\/assignments\/\$\{assignment\.id\}\/overview`/,
  );
});

test("assignment workspace tab changes synchronize browser route", () => {
  assert.match(
    app,
    /`\/assignments\/\$\{selectedAssignmentId\}\/\$\{tab\.toLowerCase\(\)\}`/,
  );
});

test("new internal assignment still opens through openAssignmentDetails", () => {
  assert.match(
    app,
    /await openAssignmentDetails\(created\);\s*setAssignmentWorkspaceTab\("Overview"\)/s,
  );
});

test("assignment creation API remains unchanged", () => {
  assert.match(app, /await api\.createAssignment\(/);
});
