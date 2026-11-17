import fs from "node:fs/promises";
import { transaction, query } from "./src/db.js";

const sql = await fs.readFile(
  new URL("./migrations/20260915_task_report_sectionless_contract_v1010.sql", import.meta.url),
  "utf8"
);

try {
  await transaction(async (client) => {
    await client.query(sql);
  });

  const remaining = await query(`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid='assignment_tasks'::regclass
      AND contype='c'
      AND (
        pg_get_constraintdef(oid) ILIKE '%contribution_section_statuses%'
        OR pg_get_constraintdef(oid) ILIKE '%contribution_summary%'
        OR pg_get_constraintdef(oid) ILIKE '%contribution_findings%'
        OR pg_get_constraintdef(oid) ILIKE '%contribution_recommendations%'
        OR pg_get_constraintdef(oid) ILIKE '%evidence_reviewed%'
        OR pg_get_constraintdef(oid) ILIKE '%contribution_challenges%'
        OR pg_get_constraintdef(oid) ILIKE '%contribution_next_actions%'
      )
  `);

  if (remaining.rowCount) {
    console.error("SECTION COMPLETENESS CONSTRAINTS STILL PRESENT", remaining.rows);
    process.exit(1);
  }

  console.log("TASK REPORT SECTIONLESS DATABASE CONTRACT VERIFIED");
  process.exit(0);
} catch (error) {
  console.error(error?.stack || error);
  process.exit(1);
}
