import { db } from '../src/db.js';

const replacements = [
  ['\u00c3\u201a\u00c2\u00b7', '\u00b7'],
  ['\u00c2\u00b7', '\u00b7'],
  ['\u00c3\u2014', '\u00d7'],
  ['\u00e2\u20ac\u201c', '\u2013'],
  ['\u00e2\u20ac\u201d', '\u2014'],
  ['\u00e2\u20ac\u0153', '\u201c'],
  ['\u00e2\u20ac\u009d', '\u201d'],
  ['\u00e2\u20ac\u2122', '\u2019'],
  ['\u00e2\u20ac\u02dc', '\u2018'],
  ['\u00e2\u20ac\u00a2', '\u2022'],
  ['\u00e2\u20ac\u00a6', '\u2026'],
  ['\u00e2\u2020\u0090', '\u2190'],
  ['\u00e2\u2020\u2018', '\u2191'],
  ['\u00e2\u2020\u2019', '\u2192'],
  ['\u00e2\u2020\u0153', '\u2193'],
  ['\u00e2\u0153\u201c', '\u2713'],
  ['\u00e2\u0153\u2022', '\u2715'],
  ['\u00c2\u00a0', ' '],
];

function repair(value) {
  if (typeof value !== 'string') return value;
  let out = value;
  for (let round = 0; round < 3; round += 1) {
    const before = out;
    for (const [bad, good] of replacements) {
      if (out.includes(bad)) out = out.split(bad).join(good);
    }
    if (out === before) break;
  }
  return out;
}

function qid(value) {
  return '"' + String(value).replaceAll('"', '""') + '"';
}

const client = await db.connect();
let updatedRows = 0;
let updatedColumns = 0;

try {
  await client.query('BEGIN');
  const columns = await client.query(`
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('text', 'character varying', 'character')
    ORDER BY table_name, ordinal_position
  `);

  for (const col of columns.rows) {
    const table = `${qid(col.table_schema)}.${qid(col.table_name)}`;
    const column = qid(col.column_name);
    const rows = await client.query(`SELECT ctid::text AS _ctid, ${column} AS value FROM ${table} WHERE ${column} IS NOT NULL`);
    let changedHere = 0;

    for (const row of rows.rows) {
      const fixed = repair(row.value);
      if (fixed === row.value) continue;
      await client.query(`UPDATE ${table} SET ${column} = $1 WHERE ctid = $2::tid`, [fixed, row._ctid]);
      changedHere += 1;
      updatedRows += 1;
    }

    if (changedHere) {
      updatedColumns += 1;
      console.log(`Repaired database: ${col.table_name}.${col.column_name} (${changedHere} row(s))`);
    }
  }

  await client.query('COMMIT');
  console.log(`Database encoding repair complete. Updated ${updatedRows} value(s) across ${updatedColumns} column(s).`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await db.end();
}
