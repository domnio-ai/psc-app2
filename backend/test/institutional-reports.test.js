import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8')
const app=read('../src/app.js')+'\n'+read('../src/reports/report-routes.js')
const service=read('../src/reports/institutional-intelligence.js')
const frontend=read('../../src/modules/reports/ReportsModule.tsx')
const dashboard=read('../../src/modules/reports/pages/InstitutionalReportsDashboard.tsx')+'\n'+read('../../src/modules/reports/components/ExecutiveVisuals.tsx')+'\n'+read('../../src/modules/reports/components/EarlyWarningAnalytics.tsx')+'\n'+read('../../src/modules/reports/components/EvidenceDrilldown.tsx')+'\n'+read('../../src/modules/reports/components/TrendIntelligence.tsx')+'\n'+read('../../src/modules/reports/utils/reportFormatting.ts')
const css=read('../../src/institutional-reports.css')
const reportService=read('../src/reports/report-service.js')
const scheduler=read('../src/reports/report-scheduler.js')

test('institutional intelligence is authenticated and aggregated server side',()=>{
  assert.match(app,/\/api\/report-intelligence',authenticate/)
  assert.match(service,/Promise\.all\(\[/)
  assert.match(service,/COUNT\(\*\).*average_completion_days/s)
  assert.doesNotMatch(dashboard,/api\.assignments\(|api\.research\(/)
})

test('report scope is role aware and administrators use explicit executive scope',()=>{
  assert.match(service,/const manager=isManagementRole\(user\.role\)/)
  assert.match(service,/isTeamScopeRole\(user\.role\)/)
  assert.match(service,/v\.submitted_by=\$1 OR v\.reviewer_id=\$1/)
  assert.match(service,/created_by=\$1 OR EXISTS\(SELECT 1 FROM assignment_members/)
  assert.doesNotMatch(service,/\['System Admin','Deputy Director'\]/)
  assert.match(frontend,/isManager: boolean/)
})

test('reports expose modular permission-aware analytical sections',()=>{
  for(const label of ['Overview','Research','Contributions','Completed','Reports & Exports'])assert.match(frontend,new RegExp(`"${label}"`))
  for(const view of ['Catalogue','PDF Studio & Packs','Saved Views & Schedules','Filing Printout'])assert.match(dashboard,new RegExp(`'${view}'`))
  assert.doesNotMatch(dashboard,/reportCentreView==='PDF Studio'|reportCentreView==='Consolidated Pack'/)
  assert.doesNotMatch(frontend,/id:"PDF Studio"|id:"Report Pack"|id:"Exports"/)
  assert.match(frontend,/InstitutionalReportsDashboard/)
  assert.match(dashboard,/data\.capabilities\.people/)
  assert.match(dashboard,/data\.capabilities\.reportBuilder/)
})

test('executive analytics expose auditable gauges and pie-style distributions',()=>{
  assert.match(service,/completed_with_due_date/)
  assert.match(service,/completed_on_time/)
  assert.match(service,/indicatorBasis:/)
  assert.match(service,/completionRate/)
  assert.match(service,/onTimeCompletionRate/)
  assert.match(service,/researchCompletionRate/)
  assert.match(dashboard,/function Gauge/)
  assert.match(dashboard,/function Donut/)
  assert.match(dashboard,/MANAGEMENT PERFORMANCE PULSE/)
  assert.match(css,/\.institutional-gauges/)
  assert.match(css,/\.institutional-donut/)
})

test('management graphics expose lifecycle, deadline risk and workload without inventing staff scores',()=>{
  assert.match(service,/deadlineRisk/)
  assert.match(service,/lifecycle=\[/)
  assert.match(service,/Due in 8–30 days/)
  assert.match(dashboard,/function LifecycleFunnel/)
  assert.match(dashboard,/function StackedPerformance/)
  assert.match(dashboard,/Assignment lifecycle/)
  assert.match(dashboard,/not a historical conversion rate/)
  assert.match(dashboard,/This is workload context, not a staff ranking/)
  assert.match(css,/\.institutional-funnel/)
  assert.match(css,/\.stacked-performance/)
})

test('executive visual refinement prioritises management risk and contextualises gauge evidence',()=>{
  assert.match(dashboard,/primary-kpi/)
  assert.match(dashboard,/Reference target ≥/)
  assert.match(dashboard,/Small evidence base/)
  assert.match(dashboard,/interpret that rate with the small evidence base in mind/)
  assert.match(css,/\.gauge-critical/)
  assert.match(css,/\.gauge-watch/)
  assert.match(css,/\.gauge-healthy/)
  assert.match(css,/\.kpi-value/)
})

test('research intelligence includes interpretation, pipeline, ageing, review and publication evidence',()=>{
  assert.match(service,/interpretation:insight/)
  assert.match(service,/researchPipeline/)
  assert.match(service,/researchAgeing/)
  assert.match(service,/average_review_days/)
  assert.match(service,/publicationTrend/)
  assert.match(dashboard,/KEY INTERPRETATION/)
})

test('attention and charts provide traceable drill down without exposing internal ids',()=>{
  assert.match(dashboard,/TRACEABLE UNDERLYING RECORDS/)
  assert.match(dashboard,/filter\(\(\[key\]\)=>!key\.endsWith\('_id'\)&&key!==\'id\'/)
  assert.match(dashboard,/Open evidence/)
})

test('report builder reuses governed report catalogue preview and existing export workflow',()=>{
  const catalogue=read('../../src/modules/reports/components/ReportCataloguePanel.tsx')
  assert.match(catalogue,/GOVERNED REPORT CATALOGUE/)
  assert.match(catalogue,/onOpen\(item\)/)
  assert.match(frontend,/onOpenReport=\{openReport\}/)
  assert.doesNotMatch(catalogue,/Export PDF|Export Word|Export Excel/)
})

test('institutional reports remain responsive, token based and readable',()=>{
  assert.match(css,/var\(--surface-primary\)/)
  assert.match(css,/font-size:max\(12px/)
  assert.match(css,/@media\(max-width:850px\)/)
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/)
})

test('comparative analytics use an immediately preceding equal-length period and expose transparent deltas',()=>{
  assert.match(service,/previousPeriodFilters/)
  assert.match(service,/previousTo=new Date\(from\.getTime\(\)-86400000\)/)
  assert.match(service,/comparison=previousFilters/)
  assert.match(service,/completionRate:delta\(completionRate,previousCompletionRate\)/)
  assert.match(dashboard,/V17 PERIOD-OVER-PERIOD INTELLIGENCE/)
  assert.match(dashboard,/immediately preceding equal-length period/)
  assert.match(dashboard,/not staff scores or rankings/)
  assert.match(css,/\.trend-intelligence-grid/)
})

test('operational risk matrix uses interpretable thresholds rather than a composite staff score',()=>{
  assert.match(dashboard,/function RiskMatrix/)
  assert.match(dashboard,/overdue>=3\|\|onTime<70/)
  assert.match(dashboard,/not a composite staff score or ranking/)
  assert.match(dashboard,/Operational risk matrix/)
  assert.match(css,/\.risk-matrix/)
  assert.match(css,/\.risk-critical/)
  assert.match(css,/\.risk-watch/)
  assert.match(css,/\.risk-healthy/)
})


test('management analytics retain trend and workload evidence while removing duplicate risk panels',()=>{
  assert.match(dashboard,/function LineTrend/)
  assert.match(dashboard,/function StackedPerformance/)
  assert.match(dashboard,/Stacked bars show workload composition, not a staff score/)
  assert.doesNotMatch(dashboard,/RiskHeatmap|TeamWorkload|RiskConcentration/)
  assert.match(css,/\.institutional-line-chart/)
  assert.match(css,/\.stacked-performance/)
  assert.doesNotMatch(css,/\.risk-heatmap/)
})

test('review turnaround trend is calculated server side and exposed as descriptive evidence',()=>{
  assert.match(service,/reviewTurnaroundTrend/)
  assert.match(service,/average_days/)
  assert.match(service,/COUNT\(\*\)FILTER\(WHERE reviewed_at IS NOT NULL\)::int reviewed/)
  assert.match(dashboard,/Reviewer turnaround trend/)
  assert.match(dashboard,/low-volume months should be interpreted cautiously/)
})


test('executive decision brief is the single priority-intervention surface',()=>{
  const brief=read('../../src/modules/reports/components/ManagementDecisionBriefModule.tsx')
  assert.match(service,/const priorities=\[\]/)
  assert.match(service,/Reduce overdue assignment backlog/)
  assert.match(service,/Clear work awaiting review/)
  assert.match(service,/decisionSupport=/)
  assert.match(service,/bottlenecks=\[/)
  assert.match(brief,/V28 MANAGEMENT DECISION BRIEF/)
  assert.match(brief,/priorities\.slice\(0,4\)/)
  assert.doesNotMatch(dashboard,/<DecisionSupport/)
  assert.match(dashboard,/Workflow bottleneck pressure/)
  assert.match(dashboard,/Operational risk matrix/)
  assert.doesNotMatch(dashboard,/Risk concentration|Management risk heatmap/)
  assert.doesNotMatch(css,/\.decision-support|\.risk-concentration/)
})

test('V6 decision priorities use transparent thresholds and actionable evidence rather than synthetic scoring',()=>{
  const brief=read('../../src/modules/reports/components/ManagementDecisionBriefModule.tsx')
  assert.match(service,/completionRate<85/)
  assert.match(service,/pending_review_age\)>=5/)
  assert.match(service,/levelOrder=\{critical:0,watch:1,healthy:2\}/)
  assert.doesNotMatch(service,/productivityScore|performanceScore|staffScore/)
  assert.match(brief,/Decision-support rules are transparent management prompts, not automated decisions/)
})


test('report centre provides governed PDF Studio and consolidated pack in one export tab', () => {
  const studio=read('../../src/modules/reports/components/ReportPdfStudio.tsx')
  const routes=read('../src/reports/report-routes.js')
  assert.match(dashboard, /api\.exportReport/)
  assert.match(dashboard, /api\.exportReportPack/)
  assert.match(dashboard, /PDF Studio & Packs/)
  assert.doesNotMatch(dashboard, /'PDF Studio'|'Consolidated Pack'/)
  assert.match(studio,/current authorised data scope/)
  assert.match(routes,/renderReportPackPdf/)
})

test('executive exports carry reporting period and filters without widening scope', () => {
  assert.match(dashboard, /\.\.\.dates,status,profile:pdfOptions\.profile/)
  assert.match(dashboard, /filters:\{\.\.\.dates,status\}/)
  assert.match(dashboard, /authorised APP2 reporting scope/)
  assert.match(dashboard, /Data current as of/)
})

test('V8 exposes saved governed report views for repeatable management reporting',()=>{
  const automation=read('../../src/modules/reports/components/ReportAutomationManager.tsx')
  assert.match(app,/\/api\/reports\/:key\/views/)
  assert.match(automation,/SAVED REPORT VIEWS/)
  assert.match(automation,/api\.saveReportView/)
  assert.match(automation,/api\.reportViews/)
  assert.match(automation,/Save current filters/)
  assert.match(css,/\.saved-view-list/)
})

test('V8 schedules governed executive report delivery without widening RBAC scope',()=>{
  const automation=read('../../src/modules/reports/components/ReportAutomationManager.tsx')
  assert.match(app,/\/api\/report-schedules/)
  assert.match(app,/You cannot schedule reports/)
  assert.match(automation,/SCHEDULED DELIVERY/)
  assert.match(automation,/api\.createReportSchedule/)
  assert.match(automation,/api\.updateReportSchedule/)
  assert.match(automation,/api\.deleteReportSchedule/)
  assert.match(automation,/owner’s current authorised APP2 scope/)
  assert.match(css,/\.schedule-list-reporting/)
})


test('V9 audits report exports saved views schedules and scheduled delivery outcomes',()=>{
  assert.match(reportService,/REPORT_VIEW_SAVED/)
  assert.match(reportService,/REPORT_VIEW_DELETED/)
  assert.match(app,/REPORT_SCHEDULE_CREATED/)
  assert.match(app,/REPORT_SCHEDULE_PAUSED/)
  assert.match(app,/REPORT_SCHEDULE_DELETED/)
  assert.match(scheduler,/REPORT_SCHEDULE_DELIVERED/)
  assert.match(scheduler,/REPORT_SCHEDULE_FAILED/)
  assert.match(app,/\/api\/report-governance/)
})

test('V9 exposes report assurance and read-only governance history without internal ids',()=>{
  assert.match(dashboard,/REPORT ASSURANCE/)
  assert.match(dashboard,/Evidence, scope and freshness/)
  assert.match(dashboard,/REPORT GOVERNANCE HISTORY/)
  assert.match(dashboard,/Internal entity identifiers are not displayed/)
  assert.match(dashboard,/Assurance describes the evidence available/)
  assert.match(css,/\.report-assurance/)
  assert.match(css,/\.report-governance-panel/)
})


test('V10 management pulse attributes operational risk to responsible App2 teams',()=>{
  assert.match(dashboard,/function teamRiskRows/)
  assert.match(dashboard,/Team responsibility:/)
  assert.match(dashboard,/person\.team/)
  assert.match(dashboard,/Unassigned team/)
})

test('V10 early warning uses transparent team thresholds and drill down without black box scoring',()=>{
  assert.match(dashboard,/V10 EARLY WARNING/)
  assert.match(dashboard,/Teams requiring management attention/)
  assert.match(dashboard,/row\.overdue>=3\|\|row\.awaiting>=5/)
  assert.match(dashboard,/no predictive black-box score is used/)
  assert.match(dashboard,/Team warning ·/)
  assert.match(css,/\.team-early-warning/)
})


test('V11 management attention names the responsible team and deadline position',()=>{
  assert.match(service,/responsible_team/)
  assert.match(service,/Unassigned team/)
  assert.match(dashboard,/Responsible team/)
  assert.match(dashboard,/attentionTeam\(item\)/)
  assert.match(dashboard,/attentionTiming\(item\.due_date\)/)
  assert.match(dashboard,/Urgent records are shown with the accountable APP2 team/)
})

test('V11 attention layout protects left labels and remains responsive',()=>{
  assert.match(css,/padding:12px 18px 12px 22px/)
  assert.match(css,/grid-template-columns:minmax\(180px,1\.05fr\)/)
  assert.match(css,/@media\(max-width:1100px\)/)
  assert.match(css,/\.attention-team/)
  assert.match(css,/\.attention-due/)
})

test('V12 reports frontend is consolidated under a dedicated module boundary',()=>{
  const rootModule=read('../../src/ReportsModule.tsx')
  const rootDashboard=read('../../src/InstitutionalReportsDashboard.tsx')
  assert.match(rootModule,/modules\/reports\/ReportsModule/)
  assert.match(rootDashboard,/modules\/reports\/pages\/InstitutionalReportsDashboard/)
  assert.match(frontend,/\.\/components\/ReportVisual/)
  assert.match(frontend,/\.\/components\/ReportTable/)
  assert.match(dashboard,/ExecutiveVisuals/)
})

test('V12 report HTTP routes are registered from the reports backend module',()=>{
  const liveApp=read('../src/app.js')
  const routes=read('../src/reports/report-routes.js')
  assert.match(liveApp,/registerReportRoutes\(app,\{validate,governedDate\}\)/)
  assert.match(routes,/export function registerReportRoutes/)
  assert.match(routes,/\/api\/report-intelligence/)
  assert.match(routes,/\/api\/report-governance/)
  assert.doesNotMatch(liveApp,/app\.get\('\/api\/report-intelligence'/)
})

test('V12 traceable evidence exposes deadline position in the modular detail drawer',()=>{
  const page=read('../../src/modules/reports/pages/InstitutionalReportsDashboard.tsx')+'\n'+read('../../src/modules/reports/components/EvidenceDrilldown.tsx')
  assert.match(page,/Deadline position/)
  assert.match(page,/attentionTiming\(row\.due_date\)/)
  assert.match(page,/Responsible team/)
})


test('V13 early warnings are directional explainable rules rather than opaque predictions',()=>{
  assert.match(service,/const earlyWarning=/)
  assert.match(service,/evidenceStrength/)
  assert.match(service,/immediately preceding equal-length period/)
  assert.match(service,/directional early warnings, not statistical forecasts or staff scores/)
  assert.match(service,/throughputGap/)
  assert.match(service,/topTeamShare/)
  assert.doesNotMatch(service,/machineLearning|predictionScore|riskScore|probabilityModel/)
})

test('V13 names the responsible team and exposes evidence action for every warning',()=>{
  assert.match(dashboard,/EXPLAINABLE EARLY WARNING/)
  assert.match(dashboard,/Responsible team/)
  assert.match(dashboard,/Evidence strength/)
  assert.match(dashboard,/Open underlying evidence/)
  assert.match(dashboard,/Likely management pressure if current patterns continue/)
  assert.match(css,/\.predictive-early-warning/)
  assert.match(css,/\.predictive-warning-grid/)
})


test('V14 scenario analytics are deterministic planning aids rather than statistical predictions',()=>{
  const scenario=read('../../src/modules/reports/components/ForecastScenarioAnalytics.tsx')
  assert.match(service,/const forecast=/)
  assert.match(service,/deterministic what-if calculations/)
  assert.match(service,/not statistical forecasts, probabilities or promises/)
  assert.match(service,/Reduce review backlog by 25%/)
  assert.match(service,/Clear 50% of overdue work first/)
  assert.match(scenario,/EXECUTIVE SCENARIO ANALYTICS/)
  assert.match(scenario,/do not claim statistical prediction/)
})

test('V14 scenarios retain responsible-team accountability and evidence strength',()=>{
  const scenario=read('../../src/modules/reports/components/ForecastScenarioAnalytics.tsx')
  assert.match(service,/responsibleTeam:topTeam\?\.team\|\|'Scope-wide'/)
  assert.match(service,/evidenceStrength/)
  assert.match(scenario,/Responsible team/)
  assert.match(scenario,/Evidence strength/)
  assert.match(css,/\.forecast-scenario-analytics/)
  assert.match(css,/\.forecast-scenario-grid/)
})

test('V15 benchmarks actual management indicators against explicit saved targets without staff scoring',()=>{
  const target=read('../../src/modules/reports/components/TargetManagement.tsx')
  const page=read('../../src/modules/reports/pages/InstitutionalReportsDashboard.tsx')
  assert.match(target,/EXECUTIVE BENCHMARKING & TARGET MANAGEMENT/)
  assert.match(target,/MANAGEMENT_TARGET_VIEW_NAME/)
  assert.match(target,/saveReportView/)
  assert.match(target,/Completion rate/)
  assert.match(target,/Review turnaround/)
  assert.match(target,/Overdue tolerance/)
  assert.match(target,/does not rank or score employees/)
  assert.match(page,/capabilities\.management&&<TargetManagement/)
})

test('V15 target management preserves governed persistence, variance context and drill down',()=>{
  const target=read('../../src/modules/reports/components/TargetManagement.tsx')
  const page=read('../../src/modules/reports/pages/InstitutionalReportsDashboard.tsx')
  assert.match(target,/__App2 Management Targets__/)
  assert.match(target,/Actual performance against declared management targets/)
  assert.match(target,/Open underlying evidence/)
  assert.match(target,/Comparable-period movement/)
  assert.match(target,/views\.find\(view=>view\.name===MANAGEMENT_TARGET_VIEW_NAME\)/)
  assert.match(css,/\.target-management/)
  assert.match(css,/\.target-track/)
})

test('V16 manager evidence drill-down filters authorised records without widening scope',()=>{
  const evidence=read('../../src/modules/reports/components/EvidenceDrilldown.tsx')
  const page=read('../../src/modules/reports/pages/InstitutionalReportsDashboard.tsx')
  assert.match(evidence,/Search evidence/)
  assert.match(evidence,/Responsible team/)
  assert.match(evidence,/No authorised records match the selected evidence filters/)
  assert.match(evidence,/only filters records already returned by the permission-aware Reports API/)
  assert.match(page,/EvidenceDrilldown/)
  assert.match(css,/\.evidence-drilldown-filters/)
})

test('V16 evidence drill-down opens existing assignment workspace through the Reports callback',()=>{
  const evidence=read('../../src/modules/reports/components/EvidenceDrilldown.tsx')
  const reports=read('../../src/modules/reports/ReportsModule.tsx')
  assert.match(evidence,/Open assignment workspace/)
  assert.match(evidence,/onOpenAssignment\(text\(row\.id\)\)/)
  assert.match(reports,/onOpenAssignment=\{onOpenAssignment\}/)
  assert.doesNotMatch(evidence,/api\.assignments\(|api\.research\(/)
})


test('V17 trend intelligence is a separate Reports module using existing comparable-period data',()=>{
  const trend=read('../../src/modules/reports/components/TrendIntelligence.tsx')
  const page=read('../../src/modules/reports/pages/InstitutionalReportsDashboard.tsx')
  assert.match(trend,/V17 PERIOD-OVER-PERIOD INTELLIGENCE/)
  assert.match(trend,/data\.overview\.comparison/)
  assert.match(trend,/previous equal-length comparison period/)
  assert.match(trend,/not staff scores or rankings/)
  assert.match(page,/import TrendIntelligence from '\.\.\/components\/TrendIntelligence'/)
  assert.match(page,/<TrendIntelligence data=\{data\}/)
  assert.match(css,/\.trend-intelligence-grid/)
})

test('V17 trend drill-down preserves permission-aware evidence and explains directional movement',()=>{
  const trend=read('../../src/modules/reports/components/TrendIntelligence.tsx')
  assert.match(trend,/Open current authorised evidence/)
  assert.match(trend,/does not reconstruct historical record membership or widen/)
  assert.match(trend,/overdue.*delta<0\?'improving':'deteriorating'/s)
  assert.match(trend,/awaitingReview.*delta<0\?'improving':'deteriorating'/s)
  assert.match(trend,/completionRate/)
  assert.match(trend,/researchCompletionRate/)
})


test('V18 duplicate manager attention panel is removed while the single authorised attention view remains',()=>{
  const page=read('../../src/modules/reports/pages/InstitutionalReportsDashboard.tsx')
  const brief=read('../../src/modules/reports/components/ManagementDecisionBriefModule.tsx')
  assert.doesNotMatch(page,/ManagerAttentionModule/)
  assert.match(page,/MANAGEMENT ATTENTION/)
  assert.match(page,/Records requiring action/)
  assert.match(brief,/V28 MANAGEMENT DECISION BRIEF/)
  assert.doesNotMatch(css,/\.manager-attention-module/)
})

test('single management attention view reuses existing evidence drill-down without a new permission path',()=>{
  const page=read('../../src/modules/reports/pages/InstitutionalReportsDashboard.tsx')
  assert.match(page,/attention\.slice\(\)\.sort/)
  assert.doesNotMatch(page,/ManagerAttentionModule|fetch\(/)
  assert.match(page,/setDetail\(\{title,rows\}\)/)
  assert.match(page,/EvidenceDrilldown detail=\{detail\}/)
})

test('data readiness checks use complete permission-scoped records and disclose missing analysis dimensions',()=>{
  const component=read('../../src/modules/reports/components/DataQualityReadiness.tsx')
  assert.match(service,/FROM assignments a WHERE \$\{a\.sql\}/)
  assert.match(service,/FROM research_projects p WHERE \$\{p\.sql\}/)
  assert.match(service,/dataQuality:\{assignments:assignmentReadiness\.rows\[0\]/)
  assert.match(component,/Active assignments without a deadline/)
  assert.match(component,/Research records missing methodology/)
  assert.match(component,/does not currently capture structured beneficiary\/geographic disaggregation or budget\/staff-time expenditure/)
})

test('V19 manager action tracking is modular and persists through governed report views without changing source workflow',()=>{
  const dashboard=read('../../src/modules/reports/pages/InstitutionalReportsDashboard.tsx')
  const module=read('../../src/modules/reports/components/ManagerActionTrackingModule.tsx')
  assert.match(dashboard,/ManagerActionTrackingModule/)
  assert.match(module,/MANAGER_ACTION_LOG_VIEW_NAME/)
  assert.match(module,/api\.saveReportView/)
  assert.match(module,/manager-action-log-v19/)
  assert.match(module,/does not change the source record/)
  assert.doesNotMatch(module,/api\.(updateAssignment|updateResearch|assign|reassign)/)
})

test('V19 action history remains manager scoped and hides its storage view from normal saved report views',()=>{
  const dashboard=read('../../src/modules/reports/pages/InstitutionalReportsDashboard.tsx')
  const automation=read('../../src/modules/reports/components/ReportAutomationManager.tsx')
  const module=read('../../src/modules/reports/components/ManagerActionTrackingModule.tsx')
  assert.match(dashboard,/data\.capabilities\.management&&<ManagerActionTrackingModule/)
  assert.match(module,/MANAGER_ACTION_LOG_VIEW_NAME/)
  assert.match(module,/api\.reportViews\(token,REPORT_KEY\)/)
  assert.match(automation,/view\.name\.startsWith\('__App2 '\)/)
  assert.match(module,/Management resolved/)
  assert.match(module,/Mark resolved/)
})

test('V20 follow-up assurance is a separate Reports module over the governed V19 action log',()=>{
  const dashboard=read('../../src/modules/reports/pages/InstitutionalReportsDashboard.tsx')
  const followup=read('../../src/modules/reports/components/ManagerFollowUpAssurance.tsx')
  assert.match(dashboard,/import ManagerFollowUpAssurance from '\.\.\/components\/ManagerFollowUpAssurance'/)
  assert.match(dashboard,/data\.capabilities\.management&&<ManagerFollowUpAssurance/)
  assert.match(followup,/V20 FOLLOW-UP & CLOSURE ASSURANCE/)
  assert.match(followup,/MANAGER_ACTION_LOG_VIEW_NAME/)
  assert.match(followup,/api\.reportViews\(token,REPORT_KEY\)/)
  assert.match(followup,/Overdue scheduled reviews/)
  assert.match(followup,/Reviews due within 7 days/)
  assert.match(followup,/Open escalations/)
  assert.match(followup,/Open over \$\{STALE_DAYS\} days/)
  assert.match(css,/\.manager-followup-assurance/)
})

test('V20 follow-up assurance never widens scope or mutates assignment, research or reviewer workflow state',()=>{
  const followup=read('../../src/modules/reports/components/ManagerFollowUpAssurance.tsx')
  assert.match(followup,/current authorised Reports scope/)
  assert.match(followup,/never reconstructed or exposed/)
  assert.match(followup,/Closing a management action remains separate from assignment, research and reviewer workflow state/)
  assert.match(followup,/authorisedRecords\.get\(item\.recordKey\)/)
  assert.doesNotMatch(followup,/api\.(updateAssignment|updateResearch|assign|reassign|approve|reject)/)
  assert.doesNotMatch(followup,/fetch\(/)
})

test('V21 management action effectiveness is a separate analytical Reports module over governed V19 actions',()=>{
  const source=read('../../src/modules/reports/components/ManagerActionEffectiveness.tsx')
  assert.match(source,/V21 MANAGEMENT ACTION EFFECTIVENESS/)
  assert.match(source,/MANAGER_ACTION_LOG_VIEW_NAME/)
  assert.match(source,/api\.reportViews/)
  assert.match(source,/association, not causal attribution|association, not proof/i)
  assert.doesNotMatch(source,/api\.updateAssignment|api\.updateResearch|api\.reassign|api\.approve|api\.reject|api\.saveReportView/)
})

test('V21 preserves authorised drill down and does not rank staff or infer causal effectiveness',()=>{
  const source=read('../../src/modules/reports/components/ManagerActionEffectiveness.tsx')
  const dashboard=read('../../src/modules/reports/pages/InstitutionalReportsDashboard.tsx')
  assert.match(dashboard,/ManagerActionEffectiveness/)
  assert.match(source,/authorisedRecords/)
  assert.match(source,/onOpen/)
  assert.match(source,/Source records now completed/)
  assert.match(source,/does not infer that a management action caused an outcome/)
  assert.doesNotMatch(source,/staff score|rank staff|leaderboard|performance score/i)
})

test('V22 team coverage keeps every authorised team member visible and recognises attributable contribution without staff ranking',()=>{
  const module=read('../../src/modules/reports/components/TeamMemberCoverageModule.tsx')
  const dashboard=read('../../src/modules/reports/pages/InstitutionalReportsDashboard.tsx')
  assert.match(dashboard,/TeamMemberCoverageModule/)
  assert.match(dashboard,/people=\{data\.people\}/)
  assert.match(dashboard,/contributions=\{data\.contributions\|\|\[\]\}/)
  assert.match(module,/Every authorised team member is represented/)
  assert.match(module,/No recorded contribution this period/)
  assert.match(module,/Assignment/)
  assert.match(module,/Task/)
  assert.match(module,/Research/)
  assert.match(module,/Review/)
  assert.match(module,/not a staff score or ranking/)
  assert.doesNotMatch(module,/leaderboard|performance score|rank staff/i)
})

test('V22 contribution evidence is produced by the modular Reports backend from existing assignment task research and review records',()=>{
  const backend=read('../src/reports/institutional-intelligence.js')
  const api=read('../../src/api.ts')
  assert.match(backend,/assignment_members/)
  assert.match(backend,/assignment_tasks/)
  assert.match(backend,/research_collaborators/)
  assert.match(backend,/research_reviewers/)
  assert.match(backend,/contributions:contributions\.rows/)
  assert.match(backend,/u\.id=ANY\(\$2::uuid\[\]\)/)
  assert.match(api,/contributions: Record<string, unknown>\[\]/)
  assert.doesNotMatch(backend,/CREATE TABLE|ALTER TABLE/)
})
