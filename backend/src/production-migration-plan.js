import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const baseline = {
  id: 'baseline:src/schema.sql',
  file: 'src/schema.sql',
  sha256: '7BD3DD034674D4693E343184087609DBA7424A6C4F2451204B7B8A9BDC2F346F',
}

export const migrationSources = [
  ['005_direct_task_reports.sql', 'F911B2FFD6E393CEDC5C968DD66B4507D8B635EE2A7626502BE49F3EE22E1316'],
  ['007_document_provenance.sql', '8E7C5548887E0D294CFC3021606D43811C900FEDB61D945E84FC1C4A40C7DE21'],
  ['017_assignment_report_sources.sql', '74228E48FF23F15D575FC9519A79A0FF12F5B85B069AEB6C361661673F13ABDA'],
  ['018_assignment_report_imports.sql', 'A855A8712EBF51209B238243CD4AE93D91B1E6C307612B62D2E86B59E794E52B'],
  ['019_research_reviewers_assignments.sql', '8B810D0715099070FFC3C3FB63B95324C92D39FE7C67D5750C0339A5A80667DF'],
  ['020_external_research_imports.sql', 'CA915FBE1005238DC874B9738F68AC733E2D422FC3194C7702680BE7B925B511'],
  ['037_notification_priority_email_reminders.sql', '4D473544EFA05034A7A506CF6ABCD30A662F17B2AB9BA53F5C049627DAD98CB3'],
  ['038_notification_smart_accuracy_population.sql', 'F4892334790545D36735A3DAE5D5419AEC620F83AEFD7EBEFD1E014E35CE5413'],
  ['039_task_request_notification_review_category.sql', '9AE62F1A463582164DF59C226D38ED6F95EB8DBD2238CA0D8659474C1378F025'],
  ['044_users_leave_management.sql', '6E4107342F6B850CFF6C48E3710E386141754888A079175B7CB1DB4FAAF1B6B1'],
  ['20260915_task_report_blank_content_v1092.sql', 'B64A3C5D47F17D5894EE1FBC447E2061A680CA84A8F4946698E281389CA3B91B'],
  ['20260916_meeting_schedule_approval_r1.sql', '943AA9587D833863BBE61A40EB15FF62B2BA653A3102DE8AD75FC36A8287D581'],
].map(([file, sha256]) => ({ id: `migration:${file}`, file: `migrations/${file}`, sha256 }))

export const embeddedMeetingMigration = {
  id: 'migration:meetings-v2-live-conference',
  file: 'src/meetings/migrate-v2.js',
  sha256: 'EDAAD63685F2C6B304CDCF5003650A36A287931661E25661969D23329C56FC9E',
}

async function readPinnedSource(entry, root) {
  const original = await fs.readFile(path.join(root, entry.file), 'utf8')
  const source = original.replace(/\r\n/g, '\n')
  const actualLf = createHash('sha256').update(source, 'utf8').digest('hex').toUpperCase()
  const actualCrlf = createHash('sha256').update(source.replace(/\n/g, '\r\n'), 'utf8').digest('hex').toUpperCase()
  if (actualLf !== entry.sha256 && actualCrlf !== entry.sha256) {
    throw new Error(`Pinned migration source changed: ${entry.file}`)
  }
  return source
}

export function unwrapTransaction(sql) {
  const lines = sql.split(/\r?\n/)
  while (lines.length && !lines[0].trim()) lines.shift()
  while (lines.length && !lines.at(-1).trim()) lines.pop()
  const controls = []
  lines.forEach((line, index) => {
    if (/^\s*(BEGIN|COMMIT);\s*$/i.test(line)) controls.push({ index, command: line.trim().toUpperCase() })
  })
  if (controls.length === 0) return sql
  if (controls.length !== 2 || controls[0].index !== 0 || controls[0].command !== 'BEGIN;'
    || controls[1].index !== lines.length - 1 || controls[1].command !== 'COMMIT;') {
    throw new Error('Migration contains an unsupported transaction wrapper.')
  }
  lines.splice(controls[1].index, 1)
  lines.splice(controls[0].index, 1)
  return lines.join('\n')
}

export async function loadProductionMigrationPlan(root = backendRoot) {
  const baselineSql = await readPinnedSource(baseline, root)
  const migrations = []
  for (const entry of migrationSources) {
    migrations.push({ ...entry, sql: unwrapTransaction(await readPinnedSource(entry, root)) })
  }

  const embeddedSource = await readPinnedSource(embeddedMeetingMigration, root)
  const sqlMatch = embeddedSource.match(/const sql=`([\s\S]*?)`\s*\ntry\s*\{/)
  if (!sqlMatch) throw new Error('Pinned meeting migration SQL could not be extracted.')
  migrations.push({ ...embeddedMeetingMigration, sql: unwrapTransaction(sqlMatch[1]) })

  return { baselineSql, migrations }
}
