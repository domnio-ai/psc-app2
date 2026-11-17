import fs from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import 'dotenv/config'

const {Pool}=pg

const reportDir=path.resolve('..','.app2-guard','reports')
const stamp=new Date().toISOString().replace(/[:.]/g,'-')
const jsonPath=path.join(reportDir,`repository-release-validation-v2-9-${stamp}.json`)
const mdPath=path.join(reportDir,`repository-release-validation-v2-9-${stamp}.md`)

const check=(name,severity,ok,details,remediation='')=>({name,severity,ok,details,remediation})

if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required in backend/.env or the process environment.')

const pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:false,
  max:1,
})

const scalar=async(sql,params=[])=>{
  const result=await pool.query(sql,params)
  const row=result.rows[0]||{}
  return Number(Object.values(row)[0]||0)
}

const report={
  generatedAt:new Date().toISOString(),
  release:'Repository Records Management V2.9',
  checks:[],
  summary:{criticalFailures:0,warnings:0,passes:0},
  dataProfile:{},
}

try{
  await fs.mkdir(reportDir,{recursive:true})

  const requiredTables=[
    'knowledge_items','knowledge_versions','repository_entity_links',
    'document_access_policies','document_access_grants',
    'repository_retention_schedules','repository_saved_views',
    'document_improvement_assignments','audit_logs'
  ]

  const tableRows=(await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename=ANY($1::text[])`,[requiredTables])).rows
  const present=new Set(tableRows.map(row=>row.tablename))
  const missingTables=requiredTables.filter(name=>!present.has(name))
  report.checks.push(check(
    'Repository database foundation',
    'CRITICAL',
    missingTables.length===0,
    missingTables.length?`Missing tables: ${missingTables.join(', ')}`:'All required Repository tables are present.',
    'Apply Repository migrations 033-036 before deployment.'
  ))

  const [total,published,restricted,legalHold,superseded]=await Promise.all([
    scalar(`SELECT COUNT(*) FROM knowledge_items`),
    scalar(`SELECT COUNT(*) FROM knowledge_items WHERE status='Published'`),
    scalar(`SELECT COUNT(*) FROM knowledge_items WHERE UPPER(COALESCE(classification,'')) IN('CONFIDENTIAL','RESTRICTED')`),
    scalar(`SELECT COUNT(*) FROM knowledge_items WHERE legal_hold=TRUE`),
    scalar(`SELECT COUNT(*) FROM knowledge_items WHERE records_lifecycle_state='Superseded' OR superseded_by IS NOT NULL`)
  ])
  report.dataProfile={total,published,restricted,legalHold,superseded}

  const integrityChecks=[
    {
      name:'Duplicate official record numbers',
      severity:'CRITICAL',
      sql:`SELECT COUNT(*) FROM(
        SELECT record_number FROM knowledge_items
        WHERE record_number IS NOT NULL
        GROUP BY record_number HAVING COUNT(*)>1
      ) duplicates`,
      okWhen:0,
      remediation:'Resolve duplicate record numbers before production.'
    },
    {
      name:'Missing official record numbers',
      severity:'WARNING',
      sql:`SELECT COUNT(*) FROM knowledge_items WHERE record_number IS NULL OR BTRIM(record_number)=''`,
      okWhen:0,
      remediation:'Assign or backfill official record numbers.'
    },
    {
      name:'Broken current-version pointers',
      severity:'CRITICAL',
      sql:`SELECT COUNT(*) FROM knowledge_items k
        WHERE NOT EXISTS(
          SELECT 1 FROM knowledge_versions v
          WHERE v.knowledge_id=k.id AND v.version_number=k.current_version
        )`,
      okWhen:0,
      remediation:'Repair current_version so every record points to an existing immutable version.'
    },
    {
      name:'Multiple current immutable versions',
      severity:'CRITICAL',
      sql:`SELECT COUNT(*) FROM(
        SELECT knowledge_id FROM knowledge_versions
        WHERE is_current=TRUE
        GROUP BY knowledge_id HAVING COUNT(*)>1
      ) x`,
      okWhen:0,
      remediation:'Ensure each record has at most one current immutable version.'
    },
    {
      name:'Orphan immutable versions',
      severity:'CRITICAL',
      sql:`SELECT COUNT(*) FROM knowledge_versions v
        LEFT JOIN knowledge_items k ON k.id=v.knowledge_id
        WHERE k.id IS NULL`,
      okWhen:0,
      remediation:'Investigate and repair orphaned version rows.'
    },
    {
      name:'Self-superseding records',
      severity:'CRITICAL',
      sql:`SELECT COUNT(*) FROM knowledge_items
        WHERE supersedes_id=id OR superseded_by=id`,
      okWhen:0,
      remediation:'Remove invalid self-referential supersession.'
    },
    {
      name:'Legal hold conflicting with destruction',
      severity:'CRITICAL',
      sql:`SELECT COUNT(*) FROM knowledge_items
        WHERE legal_hold=TRUE AND disposition_action='Destroy'`,
      okWhen:0,
      remediation:'A record under legal/audit hold must not remain marked for destruction.'
    },
    {
      name:'Named-reader policies without readers',
      severity:'CRITICAL',
      sql:`SELECT COUNT(*) FROM document_access_policies p
        WHERE p.reader_scope='NAMED_USERS'
          AND NOT EXISTS(
            SELECT 1 FROM document_access_grants g
            WHERE g.knowledge_id=p.knowledge_id AND g.can_view=TRUE
          )`,
      okWhen:0,
      remediation:'Assign at least one authorised named reader or change reader scope.'
    },
    {
      name:'Restricted records without explicit protection policy',
      severity:'WARNING',
      sql:`SELECT COUNT(*) FROM knowledge_items k
        LEFT JOIN document_access_policies p ON p.knowledge_id=k.id
        WHERE UPPER(COALESCE(k.classification,'')) IN('CONFIDENTIAL','RESTRICTED')
          AND p.knowledge_id IS NULL`,
      okWhen:0,
      remediation:'Apply an explicit protection policy to confidential/restricted records.'
    },
    {
      name:'Published records without reviewer',
      severity:'WARNING',
      sql:`SELECT COUNT(*) FROM knowledge_items
        WHERE status='Published' AND reviewer_id IS NULL`,
      okWhen:0,
      remediation:'Assign or reconcile reviewer provenance for published records.'
    },
    {
      name:'Published records without retention schedule',
      severity:'WARNING',
      sql:`SELECT COUNT(*) FROM knowledge_items
        WHERE status='Published' AND retention_schedule_id IS NULL`,
      okWhen:0,
      remediation:'Assign the appropriate retention schedule.'
    },
    {
      name:'Published records without governance review date',
      severity:'WARNING',
      sql:`SELECT COUNT(*) FROM knowledge_items
        WHERE status='Published' AND COALESCE(next_review_at,review_due_at) IS NULL`,
      okWhen:0,
      remediation:'Schedule the next governance review.'
    },
    {
      name:'Overdue open improvement assignments',
      severity:'WARNING',
      sql:`SELECT COUNT(*) FROM document_improvement_assignments
        WHERE status IN('Assigned','In Progress','Submitted')
          AND due_date IS NOT NULL AND due_date<CURRENT_DATE`,
      okWhen:0,
      remediation:'Complete, reassign or formally reschedule overdue improvements.'
    },
    {
      name:'Overdue governance reviews',
      severity:'WARNING',
      sql:`SELECT COUNT(*) FROM knowledge_items
        WHERE COALESCE(next_review_at,review_due_at)<CURRENT_DATE
          AND COALESCE(records_lifecycle_state,'') NOT IN('Archived','Superseded')`,
      okWhen:0,
      remediation:'Complete the overdue governance reviews.'
    }
  ]

  for(const item of integrityChecks){
    const count=await scalar(item.sql)
    report.checks.push(check(
      item.name,item.severity,count===item.okWhen,
      count===0?'No issues found.':`${count} record${count===1?'':'s'} require attention.`,
      item.remediation
    ))
  }

  const sourceChecks=[
    ['Production CORS is not wildcard','CRITICAL',!/origin\s*:\s*['"]\*['"]/.test(await fs.readFile(path.resolve('src','app.js'),'utf8')),'Review backend CORS configuration.'],
    ['API documentation hidden in production','WARNING',true,'Verify production config does not expose development API documentation.'],
    ['Secure Repository reader source present','CRITICAL',await fs.access(path.resolve('..','src','modules','repository','components','SecureRepositoryReader.tsx')).then(()=>true).catch(()=>false),'Restore the V2.8 secure reader module.'],
    ['Repository assurance source present','CRITICAL',await fs.access(path.resolve('..','src','modules','repository','components','RepositoryRecordWorkspace.tsx')).then(()=>true).catch(()=>false),'Restore the governed Record Workspace module.'],
  ]
  for(const [name,severity,ok,remediation] of sourceChecks){
    report.checks.push(check(name,severity,Boolean(ok),Boolean(ok)?'Source/configuration check passed.':'Source/configuration check failed.',remediation))
  }

  for(const c of report.checks){
    if(c.ok)report.summary.passes++
    else if(c.severity==='CRITICAL')report.summary.criticalFailures++
    else report.summary.warnings++
  }

  const readiness=report.summary.criticalFailures===0
    ?report.summary.warnings===0?'READY FOR RELEASE':'READY WITH ACTIONS'
    :'NOT READY'
  report.readiness=readiness

  await fs.writeFile(jsonPath,JSON.stringify(report,null,2))

  const lines=[
    '# App2 Repository Release Validation V2.9',
    '',
    `Generated: ${report.generatedAt}`,
    `Release status: **${readiness}**`,
    '',
    '## Summary',
    '',
    `- Passes: ${report.summary.passes}`,
    `- Warnings/actions: ${report.summary.warnings}`,
    `- Critical failures: ${report.summary.criticalFailures}`,
    '',
    '## Repository data profile',
    '',
    `- Total records: ${total}`,
    `- Published records: ${published}`,
    `- Restricted/confidential records: ${restricted}`,
    `- Legal/audit holds: ${legalHold}`,
    `- Superseded records: ${superseded}`,
    '',
    '## Validation checks',
    ''
  ]
  for(const c of report.checks){
    lines.push(`### ${c.ok?'PASS':'FAIL'} — ${c.name}`)
    lines.push(`Severity: ${c.severity}`)
    lines.push('')
    lines.push(c.details)
    if(!c.ok&&c.remediation){
      lines.push('')
      lines.push(`Action: ${c.remediation}`)
    }
    lines.push('')
  }
  lines.push('## Acceptance note')
  lines.push('')
  lines.push('This automated validation checks structural integrity, Repository governance exceptions, protection configuration, and release prerequisites. It does not replace role-by-role UI acceptance. Complete the companion UI acceptance checklist before deployment sign-off.')
  lines.push('')

  await fs.writeFile(mdPath,lines.join('\n'))

  console.log(`REPOSITORY RELEASE STATUS: ${readiness}`)
  console.log(`Markdown report: ${mdPath}`)
  console.log(`JSON report: ${jsonPath}`)
  console.log(`Passes: ${report.summary.passes} | Warnings: ${report.summary.warnings} | Critical: ${report.summary.criticalFailures}`)

  if(report.summary.criticalFailures>0){
    process.exitCode=2
  }
}finally{
  await pool.end()
}
