import "dotenv/config";
import pg from "pg";

const mode = process.argv[2] || "inspect";
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});

const counts = async () =>
  (await client.query("SELECT role, COUNT(*)::int count FROM users GROUP BY role ORDER BY role")).rows;

await client.connect();
try {
  if (mode === "inspect") {
    const constraint = await client.query(
      "SELECT pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conname='users_role_check'",
    );
    console.log(JSON.stringify({ counts: await counts(), constraint: constraint.rows[0]?.definition || null }));
  } else if (mode === "backup") {
    const suffix = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const table = `users_role_backup_${suffix}`;
    await client.query(`CREATE TABLE ${table} AS TABLE users`);
    console.log(JSON.stringify({ backupTable: table, rows: (await client.query(`SELECT COUNT(*)::int count FROM ${table}`)).rows[0].count }));
  } else if (mode === "migrate") {
    await client.query("BEGIN");
    try {
      await client.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
      await client.query(`UPDATE users SET role=CASE role
        WHEN 'Administrator' THEN 'System Admin'
        WHEN 'Research Manager' THEN 'Deputy Director'
        WHEN 'Research Officer' THEN 'Researcher'
        WHEN 'Reviewer' THEN 'Researcher'
        ELSE role END
        WHERE role IN ('Administrator','Research Manager','Research Officer','Reviewer')`);
      await client.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN(
        'System Admin','Director','Deputy Director','Assistant Director','Researcher'
      ))`);
      await client.query("COMMIT");
      console.log(JSON.stringify({ counts: await counts() }));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } else {
    throw new Error(`Unknown mode: ${mode}`);
  }
} finally {
  await client.end();
}
