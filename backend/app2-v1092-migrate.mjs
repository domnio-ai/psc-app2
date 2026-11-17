import { query, transaction } from "./src/db.js";

try {
  await transaction(async (client) => {
    await client.query(`
      ALTER TABLE assignment_tasks
      ADD COLUMN IF NOT EXISTS report_mode VARCHAR(20) NOT NULL DEFAULT 'structured'
    `);

    await client.query(`
      ALTER TABLE assignment_tasks
      ADD COLUMN IF NOT EXISTS blank_content TEXT NOT NULL DEFAULT ''
    `);

    await client.query(`
      UPDATE assignment_tasks
      SET report_mode='structured'
      WHERE report_mode IS NULL OR BTRIM(report_mode)=''
    `);

    await client.query(`
      UPDATE assignment_tasks
      SET blank_content=''
      WHERE blank_content IS NULL
    `);
  });

  const check = await query(`
    SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'assignment_tasks'
      AND column_name IN ('report_mode','blank_content')
    ORDER BY column_name
  `);

  const byName = Object.fromEntries(check.rows.map((row) => [row.column_name, row]));

  if (!byName.report_mode) {
    throw new Error("assignment_tasks.report_mode was not created.");
  }
  if (!byName.blank_content) {
    throw new Error("assignment_tasks.blank_content was not created.");
  }

  const smoke = await query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE report_mode IS NULL)::int AS null_report_mode,
      COUNT(*) FILTER (WHERE blank_content IS NULL)::int AS null_blank_content
    FROM assignment_tasks
  `);

  console.log("TASK REPORT DATABASE MIGRATION VERIFIED");
  console.log("report_mode:", byName.report_mode.data_type, byName.report_mode.character_maximum_length ?? "");
  console.log("blank_content:", byName.blank_content.data_type);
  console.log("assignment_tasks:", smoke.rows[0].total);
  console.log("null report_mode:", smoke.rows[0].null_report_mode);
  console.log("null blank_content:", smoke.rows[0].null_blank_content);

  process.exit(0);
} catch (error) {
  console.error("TASK REPORT DATABASE MIGRATION FAILED");
  console.error(error?.stack || error);
  process.exit(1);
}
