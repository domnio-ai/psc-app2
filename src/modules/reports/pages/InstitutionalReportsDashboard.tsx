import {useEffect,useMemo,useState} from 'react'
import type {ReactNode} from 'react'
import App2Tabs from '../../../components/App2Tabs'
import {api,type InstitutionalIntelligence,type ReportDefinition,type ReportGovernance} from '../../../api'
import type {IntelligenceTab,ReportCentreView} from '../types'
import {attentionTeam,attentionTiming,detailValue,periods,title} from '../utils/reportFormatting'
import {Bars,LineTrend,StackedPerformance,Donut,Gauge,PerformancePulse,TeamEarlyWarnings,DeltaBadge,RiskMatrix,ReportAssurance,GovernanceTrail,Insight} from '../components/ExecutiveVisuals'
import EarlyWarningAnalytics from '../components/EarlyWarningAnalytics'
import ForecastScenarioAnalytics from '../components/ForecastScenarioAnalytics'
import TargetManagement from '../components/TargetManagement'
import EvidenceDrilldown from '../components/EvidenceDrilldown'
import TrendIntelligence from '../components/TrendIntelligence'
import ManagerActionTrackingModule from '../components/ManagerActionTrackingModule'
import ManagerFollowUpAssurance from '../components/ManagerFollowUpAssurance'
import ManagerActionEffectiveness from '../components/ManagerActionEffectiveness'
import TeamMemberCoverageModule from '../components/TeamMemberCoverageModule'
import ContributionTimelineModule from '../components/ContributionTimelineModule'
import TeamContributionComparisonModule from '../components/TeamContributionComparisonModule'
import TeamCapacityModule from '../components/TeamCapacityModule'
import DeadlineRiskBalanceModule from '../components/DeadlineRiskBalanceModule'
import DeliveryQualitySummaryModule from '../components/DeliveryQualitySummaryModule'
import ManagementDecisionBriefModule from '../components/ManagementDecisionBriefModule'
import ReportsFinalNavigator from '../components/ReportsFinalNavigator'
import ManagementFilingReports from '../components/ManagementFilingReports'
import ReportPdfStudio,{type PdfReportProfile,type PdfPaperSize} from '../components/ReportPdfStudio'
import ConsolidatedReportPack from '../components/ConsolidatedReportPack'
import ReportAutomationManager from '../components/ReportAutomationManager'
import DataQualityReadiness from '../components/DataQualityReadiness'
import '../styles/report-centre.css'

export default function InstitutionalReportsDashboard({token,tab,catalogue,reportCentreView,onReportCentreView,reportCataloguePanel,onOpenReport,onOpenAssignment}:{token:string;tab:IntelligenceTab;catalogue:ReportDefinition[];reportCentreView:ReportCentreView;onReportCentreView:(view:ReportCentreView)=>void;reportCataloguePanel:ReactNode;onOpenReport:(report:ReportDefinition)=>void;onOpenAssignment:(id:string)=>void}){
  const [data,setData]=useState<InstitutionalIntelligence|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  const [period,setPeriod]=useState('Quarter'),[from,setFrom]=useState(''),[to,setTo]=useState(''),[workType,setWorkType]=useState('All'),[status,setStatus]=useState('All')
  const [detail,setDetail]=useState<{title:string;rows:Record<string,unknown>[]} | null>(null)
  const [studioReportKey,setStudioReportKey]=useState('executive-performance-overview')
  const [exporting,setExporting]=useState<'pdf'|'docx'|'xlsx'|''>(''),[exportMessage,setExportMessage]=useState('')
  const [governance,setGovernance]=useState<ReportGovernance|null>(null)
  const load=async()=>{setLoading(true);setError('');try{const dates=period==='Custom'?{from,to}:periods[period]();setData(await api.reportIntelligence(token,{...dates,workType,status}))}catch(value){setError(value instanceof Error?value.message:'Reporting intelligence could not be loaded.')}finally{setLoading(false)}}
  useEffect(()=>{void load()},[token])
  useEffect(()=>{api.reportGovernance(token).then(setGovernance).catch(()=>setGovernance(null))},[token,data?.generatedAt])
  const attention=useMemo(()=>data?.attention||[],[data])
  if(loading)return <div className="institutional-loading">Preparing scoped institutional intelligence…</div>
  if(error)return <div className="report-error">{error}<button type="button" onClick={load}>Retry</button></div>
  if(!data)return null
  const filters=<form className="institutional-filter" onSubmit={event=>{event.preventDefault();void load()}}><label>Period<select value={period} onChange={event=>setPeriod(event.target.value)}><option>Month</option><option>Quarter</option><option>Year</option><option>Custom</option></select></label>{period==='Custom'&&<><label>From<input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label>To<input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label></>}<label>Work type<select value={workType} onChange={event=>setWorkType(event.target.value)}><option>All</option><option>Assignments</option><option>Tasks</option><option>Research</option></select></label><label>Status<select value={status} onChange={event=>setStatus(event.target.value)}><option>All</option><option>Active</option><option>Completed</option><option>Awaiting Review</option><option>Changes Requested</option><option>Overdue</option></select></label><button>Apply</button></form>
  const basis=<p className="institutional-basis">Data current as of <strong>{detailValue('generated_at',data.generatedAt)}</strong> · Based on {data.basis.assignments} assignments, {data.basis.research} research records and {data.basis.publishedReports} published reports · Scope: {data.scope.type.replaceAll('_',' ')}</p>
  const deadlineRows=(bucket:string)=>data.overview.records.filter(item=>{const completed=item.status==='Completed',due=item.due_date?new Date(String(item.due_date)):null,now=new Date();if(bucket==='Completed')return completed;if(completed)return false;if(bucket==='No due date')return !due;if(!due)return false;const days=Math.ceil((due.getTime()-now.getTime())/86400000);if(bucket==='Overdue')return days<0;if(bucket==='Due in 7 days')return days>=0&&days<=7;if(bucket==='Due in 8–30 days')return days>=8&&days<=30;if(bucket==='Beyond 30 days')return days>30;return false})
  const pdfStudioReports=catalogue.filter(report=>report.available)
  const reportCentreViews:ReportCentreView[]=['Catalogue',...(data.capabilities.reportBuilder?['Saved Views & Schedules' as const]:[]),'PDF Studio & Packs','Filing Printout']
  const exportManagementReport=async(pdfOptions:{profile:PdfReportProfile;title:string;paperSize:PdfPaperSize})=>{
    const report=catalogue.find(item=>item.key===studioReportKey)
    if(!report||!report.available){setExportMessage('Select an available governed report before exporting.');return}
    setExporting('pdf');setExportMessage('')
    try{
      const dates=period==='Custom'?{from,to}:periods[period]()
      await api.exportReport(token,report.key,'pdf',{...dates,status,profile:pdfOptions.profile,title:pdfOptions.title,paperSize:pdfOptions.paperSize})
      setGovernance(await api.reportGovernance(token));setExportMessage('PDF prepared using the authorised APP2 reporting scope.')
    }catch(value){setExportMessage(value instanceof Error?value.message:'PDF could not be prepared.')}finally{setExporting('')}
  }
  const exportReportPack=async(reportKeys:string[],options:{title:string;paperSize:'A4'|'Letter'})=>{
    if(!reportKeys.length){setExportMessage('Select at least one available report.');return}
    setExporting('pdf');setExportMessage('')
    try{
      const dates=period==='Custom'?{from,to}:periods[period]()
      await api.exportReportPack(token,reportKeys,{...options,filters:{...dates,status}})
      setGovernance(await api.reportGovernance(token));setExportMessage('Consolidated PDF prepared using each report’s authorised APP2 scope.')
    }catch(value){setExportMessage(value instanceof Error?value.message:'Consolidated report pack could not be prepared.')}finally{setExporting('')}
  }
  return <section className="institutional-intelligence">{tab!=='Reports & Exports'&&<>{filters}{basis}</>}
    {tab==='Reports & Exports'&&<section className="report-centre"><App2Tabs idPrefix="reports-centre" className="report-centre-tabs" ariaLabel="Report centre sections" activeTab={reportCentreView} items={reportCentreViews.map(view=>({id:view,label:view,panelId:`reports-centre-panel-${view.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`}))} onChange={onReportCentreView}/><div id={`reports-centre-panel-${reportCentreView.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`} role="tabpanel" aria-labelledby={`reports-centre-tab-${reportCentreView.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`}>{reportCentreView==='Catalogue'?reportCataloguePanel:<>{filters}{basis}</>}
      {reportCentreView==='PDF Studio & Packs'&&<><div className="report-studio-pack-grid"><ReportPdfStudio reports={pdfStudioReports} data={data} reportKey={studioReportKey} onReportChange={setStudioReportKey} period={period} from={from} to={to} exporting={exporting==='pdf'} exportMessage="" onExport={options=>void exportManagementReport(options)}/><ConsolidatedReportPack reports={pdfStudioReports} periodLabel={period==='Custom'?`${from||'Start date'} to ${to||'End date'}`:period} exporting={exporting==='pdf'} message="" onExport={(keys,options)=>void exportReportPack(keys,options)}/></div>{exportMessage&&<p role="status" className="report-centre-export-status">{exportMessage}</p>}</>}
      {reportCentreView==='Saved Views & Schedules'&&data.capabilities.reportBuilder&&<ReportAutomationManager token={token} reports={catalogue} filters={{...data.filters,period}}/>}
      {reportCentreView==='Filing Printout'&&<ManagementFilingReports data={data} onOpenAssignment={onOpenAssignment}/>}
    </div></section>}
    {tab==='Overview'&&<>
      <div className="institutional-gauges"><Gauge label="Completion rate" value={data.overview.kpis.completionRate||0} numerator={data.overview.indicatorBasis.completionRate?.numerator||0} denominator={data.overview.indicatorBasis.completionRate?.denominator||0} note="Completed ÷ scoped assignments" target={85}/><Gauge label="On-time completion" value={data.overview.kpis.onTimeCompletionRate||0} numerator={data.overview.indicatorBasis.onTimeCompletionRate?.numerator||0} denominator={data.overview.indicatorBasis.onTimeCompletionRate?.denominator||0} note="Completed on/before due date" target={90}/><Gauge label="Research completion" value={data.overview.kpis.researchCompletionRate||0} numerator={data.overview.indicatorBasis.researchCompletionRate?.numerator||0} denominator={data.overview.indicatorBasis.researchCompletionRate?.denominator||0} note="Completed research ÷ portfolio" target={80}/><Gauge label="Research approval" value={data.overview.kpis.approvalRate||0} numerator={data.overview.indicatorBasis.approvalRate?.numerator||0} denominator={data.overview.indicatorBasis.approvalRate?.denominator||0} note="Approved ÷ submitted versions" target={85}/></div>
      <section className="graph-first-overview" aria-label="Executive analytics overview">
        <header className="graph-first-heading">
          <div><small>PRIMARY ANALYTICS</small><h3>Executive visual overview</h3><p>Start with delivery, deadline and team workload; detailed research and review analysis lives in the Research tab.</p></div>
        </header>
        <div className="graph-first-grid graph-first-grid-primary">
          <article className="graph-card graph-card-wide"><header><h3>Work completion trend</h3><p>Created, completed and overdue workload across the selected reporting period.</p><small className="graph-governance-note"><strong>Assignment lifecycle</strong> is a cumulative current-state snapshot; it is not a historical conversion rate.</small></header><LineTrend rows={data.overview.completionTrend} keys={[{key:'created',label:'Created'},{key:'completed',label:'Completed'},{key:'overdue',label:'Overdue'}]}/></article>
          <article className="graph-card"><header><h3>Current work status</h3><p>Current scoped assignment distribution.</p></header><Donut rows={data.overview.status} centreLabel="Assignments" onSelect={row=>setDetail({title:row.label,rows:data.overview.records.filter(item=>row.label==='Overdue'?(item.status!=='Completed'&&item.due_date&&new Date(String(item.due_date))<new Date()):row.label==='Awaiting Review'?item.status==='Ready for Review':row.label==='Active'?!['Completed','Ready for Review'].includes(String(item.status)):item.status===row.label)})}/></article>
          <article className="graph-card"><header><h3>Deadline exposure</h3><p>Overdue and upcoming assignment deadlines by horizon.</p></header><Bars rows={data.overview.deadlineRisk} onSelect={row=>setDetail({title:`Deadline risk · ${row.label}`,rows:deadlineRows(row.label)})}/></article>
          <article className="graph-card"><header><h3>Workflow bottleneck pressure</h3><p>Queues and deadline exposures requiring management capacity.</p></header><Bars rows={data.overview.decisionSupport.bottlenecks} onSelect={row=>setDetail({title:`Bottleneck · ${row.label}`,rows:row.label==='Overdue assignments'?deadlineRows('Overdue'):row.label==='Assignments awaiting review'?data.overview.records.filter(item=>item.status==='Ready for Review'):row.label==='Assignments due soon'?attention.filter(item=>String(item.reason).includes('Due within')):attention.filter(item=>item.type==='Research')})}/></article>
          {data.capabilities.people&&<article className="graph-card graph-card-wide"><header><h3>Team workload composition</h3><p>Completed, active on-track and overdue work by officer.</p><small className="graph-governance-note">This is workload context, not a staff ranking.</small></header><StackedPerformance rows={data.people} onSelect={person=>setDetail({title:`Workload composition · ${String(person.name)}`,rows:[person]})}/></article>}
        </div>
      </section>

      <section className="graph-first-kpis" aria-label="KPI summary">
        <header><div><small>KPI SUMMARY</small><h3>Headline operational position</h3></div></header>
        <div className="institutional-kpis">{Object.entries(data.overview.kpis).filter(([key])=>!['completionRate','onTimeCompletionRate','researchCompletionRate','approvalRate'].includes(key)).slice(0,8).map(([key,value])=>{const primary=['overdue','awaitingReview','dueSoon','completed'].includes(key);const tone=key.toLowerCase().includes('overdue')?'danger':key.toLowerCase().includes('completed')?'success':'';return <button type="button" key={key} className={`${tone} ${primary?'primary-kpi':'secondary-kpi'}`.trim()} onClick={()=>{const records=data.overview.records;const rows=key==='completed'?records.filter(row=>row.status==='Completed'):key==='active'?records.filter(row=>!['Completed','Ready for Review'].includes(String(row.status))):key==='overdue'?records.filter(row=>row.status!=='Completed'&&row.due_date&&new Date(String(row.due_date))<new Date()):key==='awaitingReview'?records.filter(row=>row.status==='Ready for Review'):key==='dueSoon'?attention.filter(row=>String(row.reason).includes('Due within')):records;setDetail({title:title(key),rows})}}><span>{title(key)}</span><strong className="kpi-value">{key.toLowerCase().includes('rate')?`${value}%`:value}<em>{key.toLowerCase().includes('days')?'days':''}</em></strong>{data.overview.comparison&&['totalWork','completed','overdue','awaitingReview'].includes(key)&&<DeltaBadge value={Number(data.overview.comparison.deltas[key]||0)} invert={key==='overdue'||key==='awaitingReview'}/>}<small>View underlying records</small></button>})}</div>
      </section>

      {data.capabilities.management&&<ManagementDecisionBriefModule data={data} onOpen={(title,rows)=>setDetail({title,rows})}/>}
      <PerformancePulse data={data}/>
      <article className="institutional-attention graph-first-attention"><header><div><small>MANAGEMENT ATTENTION</small><h3>Records requiring action</h3><p>Urgent records are shown with the accountable APP2 team and deadline position.</p></div><strong>{attention.length}</strong></header>{attention.slice().sort((a,b)=>{const da=a.due_date?new Date(String(a.due_date)).getTime():Number.MAX_SAFE_INTEGER;const db=b.due_date?new Date(String(b.due_date)).getTime():Number.MAX_SAFE_INTEGER;return da-db}).slice(0,8).map((item,index)=><button type="button" key={String(item.id||index)} onClick={()=>setDetail({title:String(item.reason||'Attention item'),rows:[item]})}><span className="attention-reason"><b>{String(item.reason)}</b><small>{String(item.type)} · {String(item.status)}</small></span><strong className="attention-title">{String(item.title)}</strong><span className="attention-team"><small>Responsible team</small><b>{attentionTeam(item)}</b></span><span className="attention-due"><small>{item.due_date?new Date(String(item.due_date)).toLocaleDateString('en-KE'):'No due date'}</small><b>{attentionTiming(item.due_date)}</b></span><em>Open evidence →</em></button>)}{!attention.length&&<p>No scoped records currently meet the attention thresholds.</p>}</article>

      <Insight>{data.overview.interpretation}</Insight>

      <details className="reports-advanced-analysis">
        <summary><span><small>ADVANCED ANALYSIS</small><strong>Open deeper management analytics</strong></span><em>Trends, early warning, targets, risk and follow-up</em></summary>
        <div className="reports-advanced-analysis-body">
          <ReportAssurance data={data} governance={governance}/><DataQualityReadiness data={data}/><GovernanceTrail governance={governance}/>
          {data.capabilities.management&&<TrendIntelligence data={data} onOpen={(title,rows)=>setDetail({title,rows})}/>}
          {data.capabilities.management&&<ManagerActionTrackingModule token={token} data={data} onOpen={(title,rows)=>setDetail({title,rows})}/>}
          {data.capabilities.management&&<ManagerFollowUpAssurance token={token} data={data} onOpen={(title,rows)=>setDetail({title,rows})}/>}
          {data.capabilities.management&&<ManagerActionEffectiveness token={token} data={data} onOpen={(title,rows)=>setDetail({title,rows})}/>}
          <TeamEarlyWarnings data={data} onOpen={(title,rows)=>setDetail({title,rows})}/>
          <EarlyWarningAnalytics data={data} onOpen={(title,rows)=>setDetail({title,rows})}/>
          <ForecastScenarioAnalytics data={data}/>
          {data.capabilities.management&&<TargetManagement token={token} data={data} onOpen={(title,rows)=>setDetail({title,rows})}/>}
          {data.capabilities.people&&<div className="institutional-grid management-graphics"><article className="team-risk-card"><header><h3>Operational risk matrix</h3><p>Deadline, review-queue and timeliness signals for management attention.</p></header><RiskMatrix rows={data.people} onSelect={person=>setDetail({title:`Operational risk · ${String(person.name)}`,rows:[person]})}/></article></div>}
        </div>
      </details>
    </>}
    {tab==='Research'&&<><div className="institutional-kpis research">{Object.entries(data.overview.kpis).slice(8).map(([key,value])=><button type="button" key={key}><span>{title(key)}</span><strong>{value}</strong></button>)}</div><Insight>{data.research.interpretation}</Insight><div className="institutional-grid"><article><header><h3>Research pipeline</h3><p>Pie-style distribution of actual APP2 project states; no synthetic stages.</p></header><Donut rows={data.research.pipeline} centreLabel="Research" onSelect={row=>setDetail({title:`Research · ${row.label}`,rows:attention.filter(item=>item.type==='Research'&&item.status===row.label)})}/></article><article><header><h3>Research ageing</h3><p>Age of active portfolio records.</p></header><Bars rows={data.research.ageing} onSelect={row=>setDetail({title:`Research ageing · ${row.label}`,rows:attention.filter(item=>item.type==='Research')})}/></article><article><header><h3>Review outcomes</h3><p>Decision distribution with reviewer turnaround shown separately.</p></header><Donut rows={data.research.review.outcomes} centreLabel="Reviews"/><footer>Average completed review: <b>{data.research.review.average_review_days} days</b> · Pending review age: <b>{data.research.review.pending_review_age} days</b></footer></article><article><header><h3>Publication / approval trend</h3><p>Submission and approval activity over time.</p></header><LineTrend rows={data.research.publicationTrend} keys={[{key:'submitted',label:'Submitted'},{key:'approved',label:'Approved'}]}/></article><article><header><h3>Reviewer turnaround trend</h3><p>Average completed-review duration by month, with reviewed volume retained in the evidence series.</p></header><LineTrend rows={data.research.reviewTurnaroundTrend} keys={[{key:'average_days',label:'Average review days',suffix:' days'},{key:'reviewed',label:'Reviews completed'}]}/><footer>This is a descriptive workflow measure; low-volume months should be interpreted cautiously.</footer></article></div></>}
    {tab==='Contributions'&&(data.capabilities.people?<><Insight>People indicators describe workload and workflow outcomes without creating a composite productivity score or ranking staff.</Insight><ReportsFinalNavigator/><div id="reports-v25-capacity"><TeamCapacityModule people={data.people} evidence={data.teamCapacityEvidence||[]} onOpen={(title,rows)=>setDetail({title,rows})}/></div><DeadlineRiskBalanceModule people={data.people} evidence={data.teamCapacityEvidence||[]} onOpen={(title,rows)=>setDetail({title,rows})}/><DeliveryQualitySummaryModule people={data.people} contributions={data.contributions||[]} onOpen={(title,rows)=>setDetail({title,rows})}/><div id="reports-v22-coverage"><TeamMemberCoverageModule people={data.people} contributions={data.contributions||[]} onOpen={(title,rows)=>setDetail({title,rows})}/></div><div id="reports-v23-timeline"><ContributionTimelineModule token={token} people={data.people} contributions={data.contributions||[]} onOpen={(title,rows)=>setDetail({title,rows})}/></div><div id="reports-v24-comparison"><TeamContributionComparisonModule people={data.people} contributions={data.contributions||[]} previousContributions={data.previousContributions||[]} comparison={data.contributionComparison||null} onOpen={(title,rows)=>setDetail({title,rows})}/></div><div className="institutional-table-wrap"><table><thead><tr>{['Officer','Team','Active Work','Completed','Overdue','Research Active','Awaiting Review','On-Time Rate'].map(value=><th key={value}>{value}</th>)}</tr></thead><tbody>{data.people.map((person,index)=><tr key={String(person.id||index)} onClick={()=>setDetail({title:String(person.name),rows:[person]})}><td><button type="button">{String(person.name)}</button></td><td>{String(person.team||'—')}</td><td>{String(person.active_work)}</td><td>{String(person.completed)}</td><td>{String(person.overdue)}</td><td>{String(person.research_active)}</td><td>{String(person.awaiting_review)}</td><td>{String(person.on_time_rate)}%</td></tr>)}</tbody></table></div></>:<section className="my-contributions"><header><small>AUTHORISED PERSONAL SCOPE</small><h3>My contributions</h3></header><div>{(data.contributions||[]).map((row,index)=><article key={String(row.id||index)}><strong>{String(row.title||row.assignment_title||row.research_title||'Contribution')}</strong><span>{String(row.type||row.contribution_type||'Work contribution')}</span><b>{String(row.status||row.state||'Recorded')}</b></article>)}{!data.contributions?.length&&<p>No contribution records are available for this period.</p>}</div></section>)}
    {tab==='Completed'&&<div className="institutional-table-wrap"><table><thead><tr>{['Title','Report Type','Generated By','Approved By','Approval Date','Published Date','Audience','Status'].map(value=><th key={value}>{value}</th>)}</tr></thead><tbody>{data.published.map((report,index)=><tr key={String(report.id||index)}><td>{String(report.title)}</td><td>{String(report.report_type||'Institutional Report')}</td><td>{String(report.generated_by||'—')}</td><td>{String(report.approved_by||'—')}</td><td>{report.approval_date?new Date(String(report.approval_date)).toLocaleDateString('en-KE'):'—'}</td><td>{new Date(String(report.published_date)).toLocaleDateString('en-KE')}</td><td>{String(report.audience||'Internal')}</td><td><b>{String(report.status)}</b></td></tr>)}</tbody></table></div>}
    {detail&&<EvidenceDrilldown detail={detail} onClose={()=>setDetail(null)} onOpenAssignment={onOpenAssignment}/>}
  </section>
}
