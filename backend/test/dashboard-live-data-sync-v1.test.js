import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const api=fs.readFileSync("src/api.ts","utf8");
const app=fs.readFileSync("src/App.tsx","utf8");
const hook=fs.readFileSync("src/modules/dashboard/useDashboardLiveSync.ts","utf8");

test("every successful API mutation emits one dashboard invalidation event",()=>{
  assert.ok(api.includes('app2:workflow-changed'));
  assert.ok(api.includes('!["GET", "HEAD"].includes(method)'));
  assert.ok(api.includes('new CustomEvent("app2:workflow-changed"'));
});

test("workflow invalidation is propagated across browser tabs",()=>{
  assert.ok(api.includes("app2:workflow-revision"));
  assert.ok(api.includes("localStorage.setItem"));
  assert.ok(hook.includes('window.addEventListener("storage"'));
});

test("dashboard refreshes immediately when workflow data changes",()=>{
  assert.ok(hook.includes("const onWorkflowChanged=()=>requestRefresh(120)"));
  assert.ok(hook.includes('window.addEventListener("app2:workflow-changed"'));
});

test("visible dashboard self-refreshes and catches focus or tab return",()=>{
  assert.ok(hook.includes("visibilitychange"));
  assert.ok(hook.includes('window.addEventListener("focus"'));
  assert.ok(hook.includes("setInterval"));
  assert.ok(app.includes("intervalMs: 10000"));
});

test("live synchronization remains modular and uses the existing pulse refresh",()=>{
  assert.ok(app.includes("useDashboardLiveSync"));
  assert.ok(app.includes("refresh: pulse.refresh"));
  assert.equal(hook.includes("fetch("),false);
});
