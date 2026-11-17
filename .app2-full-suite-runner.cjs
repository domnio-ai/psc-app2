const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = process.cwd();
const testRoot = path.join(root, "backend", "test");
const log = process.argv[2];
const batchSize = 12;

function walk(dir) {
  let found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found = found.concat(walk(full));
    else if (entry.isFile() &&
      /\.(test|spec)\.(c|m)?js$/i.test(entry.name)) found.push(full);
  }
  return found;
}

const files = walk(testRoot).sort();
if (!files.length) {
  fs.writeFileSync(log, `ERROR: No test files found under ${testRoot}\n`);
  console.error(`No test files found under ${testRoot}`);
  process.exit(2);
}

fs.writeFileSync(log, `Test files discovered: ${files.length}\nBatch size: ${batchSize}\n\n`);
let failures = 0;

for (let i = 0; i < files.length; i += batchSize) {
  const batch = files.slice(i, i + batchSize);
  const number = Math.floor(i / batchSize) + 1;
  console.log(`Batch ${number}: files ${i + 1}-${i + batch.length} of ${files.length}`);

  const result = spawnSync(process.execPath, ["--test", ...batch], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });

  const output = [
    `\n========== BATCH ${number} (${batch.length} files) ==========`,
    `FILES:\n${batch.map(f => path.relative(root, f)).join("\n")}`,
    `EXIT CODE: ${result.status}`,
    result.stdout || "",
    result.stderr || "",
    result.error ? `SPAWN ERROR: ${result.error.message}` : ""
  ].join("\n");

  fs.appendFileSync(log, output + "\n");
  if (result.error || result.status !== 0) {
    failures++;
    console.error(`Batch ${number} FAILED (exit ${result.status}).`);
  } else {
    console.log(`Batch ${number} passed.`);
  }
}

fs.appendFileSync(log,
  `\nFINAL RESULT: ${failures === 0 ? "PASS" : "FAIL"}\n` +
  `Test files discovered: ${files.length}\n` +
  `Batches failed: ${failures}\n`);

console.log(`\nTest files discovered: ${files.length}`);
console.log(`Batches failed: ${failures}`);
console.log(`Log: ${log}`);

if (failures > 0) process.exitCode = 1;
else console.log("FULL SUITE PASSED");
