import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAdminEmailCooldown } from "../src/admin-email-rate-limit.js";
import { createMailService } from "../src/mail-service.js";

test("administrator test-email cooldown limits each admin independently", () => {
  let now = 1_000;
  const allow = createAdminEmailCooldown({ cooldownMs: 60_000, now: () => now });

  assert.deepEqual(allow("admin-a"), { allowed: true, retryAfterSeconds: 0 });
  assert.deepEqual(allow("admin-a"), { allowed: false, retryAfterSeconds: 60 });
  assert.deepEqual(allow("admin-b"), { allowed: true, retryAfterSeconds: 0 });
  now += 60_000;
  assert.deepEqual(allow("admin-a"), { allowed: true, retryAfterSeconds: 0 });
});

test("email settings identify Gmail without returning credentials and explain SMTP acceptance", async () => {
  const [app, mailer, example] = await Promise.all([
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(new URL("../src/mail-service.js", import.meta.url), "utf8"),
    readFile(new URL("../../.env.production.example", import.meta.url), "utf8"),
  ]);

  assert.match(app, /app\.post\('\/api\/settings\/test-email',authenticate,authorize\('System Admin'\),validate\(testEmailSchema\)/);
  assert.match(app, /createAdminEmailCooldown\(\)/);
  assert.match(app, /status\(429\)/);
  assert.match(app, /inbox delivery is not confirmed/);
  assert.match(mailer, /String\(host \|\| ""\)\.toLowerCase\(\) === "smtp\.gmail\.com"/);
  assert.doesNotMatch(mailer, /return\s*\{[^}]*password/i);
  assert.match(example, /^SMTP_FROM=.+$/m);
});

test("Gmail transport is mockable, returns no credentials and sanitizes provider failures", async () => {
  const smtp = {
    enabled: true,
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    user: "qa-sender@example.invalid",
    password: "mock-app-password-value",
    from: "QA Sender <qa-sender@example.invalid>",
  };
  let transportOptions;
  let sentMessage;
  const service = createMailService(smtp, async (options) => {
    transportOptions = options;
    return {
      async verify() { return true; },
      async sendMail(message) {
        sentMessage = message;
        return { messageId: "mock-message-id", accepted: [message.to] };
      },
    };
  });

  const status = service.mailStatus();
  assert.equal(status.provider, "Gmail SMTP");
  assert.equal(status.ready, true);
  assert.equal("user" in status, false);
  assert.equal("password" in status, false);
  const result = await service.sendMail({ to: "recipient@example.invalid", subject: "QA test", text: "Mock only." });
  assert.deepEqual(result, { messageId: "mock-message-id", accepted: ["recipient@example.invalid"] });
  assert.equal(transportOptions.host, "smtp.gmail.com");
  assert.equal(transportOptions.requireTLS, true);
  assert.equal(transportOptions.auth.pass, smtp.password);
  assert.equal(sentMessage.from, smtp.from);

  const incomplete = createMailService({ ...smtp, password: "" }, async () => {
    throw new Error("transport should not be created");
  });
  await assert.rejects(incomplete.sendMail({ to: "recipient@example.invalid", subject: "QA", text: "test" }), (error) => {
    assert.equal(error.statusCode, 503);
    assert.doesNotMatch(error.message, /mock-app-password-value/);
    return true;
  });

  const rejected = createMailService(smtp, async () => ({
    async verify() { throw new Error("mock provider response included mock-app-password-value"); },
    async sendMail() { throw new Error("should not send after verify failure"); },
  }));
  await assert.rejects(rejected.sendMail({ to: "recipient@example.invalid", subject: "QA", text: "test" }), (error) => {
    assert.equal(error.statusCode, 502);
    assert.doesNotMatch(error.message, /mock-app-password-value/);
    return true;
  });

  const networkFailure = createMailService(smtp, async () => ({
    async verify() { return true; },
    async sendMail() { throw new Error("mock network failure involving mock-app-password-value"); },
  }));
  await assert.rejects(networkFailure.sendMail({ to: "recipient@example.invalid", subject: "QA", text: "test" }), (error) => {
    assert.equal(error.statusCode, 502);
    assert.doesNotMatch(error.message, /mock-app-password-value/);
    return true;
  });
});
