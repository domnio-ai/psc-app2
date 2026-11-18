import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [backend, frontend] = await Promise.all([
  readFile(new URL("../src/app.js", import.meta.url), "utf8"),
  readFile(new URL("../../src/App.tsx", import.meta.url), "utf8"),
]);
const resetRoute = backend.slice(
  backend.indexOf("app.post('/api/auth/forgot-password'"),
  backend.indexOf("app.post('/api/auth/reset-password'"),
);

test("production password reset sends a short-lived token link to the registered email", () => {
  assert.ok(resetRoute.length > 0, "forgot-password route must exist");
  assert.match(resetRoute, /SELECT id,email FROM users/);
  assert.match(resetRoute, /crypto\.createHash\('sha256'\)/);
  assert.match(resetRoute, /NOW\(\)\+INTERVAL '30 minutes'/);
  assert.match(resetRoute, /if\(config\.environment==='production'\)/);
  assert.match(resetRoute, /await sendMail\(\{/);
  assert.match(resetRoute, /to:user\.email/);
  assert.match(resetRoute, /resetUrl\.hash=new URLSearchParams\(\{resetToken\}\)\.toString\(\)/);
  assert.match(resetRoute, /delivery\.accepted/);
});

test("password reset email failure invalidates the token without revealing account existence", () => {
  assert.match(resetRoute, /PASSWORD_RESET_EMAIL_FAILED/);
  assert.match(resetRoute, /UPDATE password_reset_tokens SET used_at=NOW\(\) WHERE token_hash=\$1/);
  assert.match(resetRoute, /If the account exists, password reset instructions will be sent/);
  assert.match(resetRoute, /if\(config\.environment!=='production'&&resetToken\)response\.resetToken=resetToken/);
});

test("login screen consumes reset tokens from fragments and removes them from browser history", () => {
  assert.match(frontend, /new URLSearchParams\(window\.location\.hash\.slice\(1\)\)/);
  assert.match(frontend, /setResetToken\(resetLinkToken\)/);
  assert.ok(frontend.includes("window.history.replaceState"));
  assert.ok(frontend.includes("window.location.pathname"));
  assert.match(frontend, /!resetToken\s*\?\s*\([\s\S]*?type="email"[\s\S]*?required[\s\S]*?\)\s*:\s*\(/);
});

test("password reset email renders a clickable link and keeps the token in the URL fragment", () => {
  assert.match(resetRoute, /href="\$\{escapeHtml\(resetUrl\.toString\(\)\)\}"/);
  assert.match(resetRoute, /Reset password/);
});
