import type {InstitutionalIntelligence,ReportGovernance} from '../../../api'
import {sliceClass,title} from '../utils/reportFormatting'

export function Bars({rows,onSelect}:{rows:{label:string;value:number}[];onSelect?:(row:{label:string;value:number})=>void}){
  const max=Math.max(1,...rows.map(row=>Number(row.value)))
  return <div className="institutional-bars">{rows.map(row=><button type="button" key={row.label} onClick={()=>onSelect?.(row)} disabled={!onSelect} aria-label={`${row.label}: ${row.value}`}><span>{row.label}</span><i><b style={{width:`${Number(row.value)*100/max}%`}} /></i><strong>{row.value}</strong></button>)}</div>
}
export function Trend({rows}:{rows:{label:string;created?:number;completed?:number;overdue?:number;submitted?:number;approved?:number}[]}){
  const keys=rows.some(row=>row.created!==undefined)?['created','completed','overdue'] as const:['submitted','approved'] as const
  const max=Math.max(1,...rows.flatMap(row=>keys.map(key=>Number(row[key]||0))))
  return <div className="institutional-trend" role="img" aria-label="Trend over the selected reporting period"><div className="trend-legend">{keys.map(key=><span key={key}><i className={key}/>{title(key)}</span>)}</div><div className="trend-columns">{rows.map(row=><div key={row.label}><div>{keys.map(key=><i key={key} className={key} style={{height:`${Math.max(3,Number(row[key]||0)*100/max)}%`}} title={`${title(key)}: ${row[key]||0}`} />)}</div><span>{row.label}</span></div>)}</div></div>
}
export function LineTrend({rows,keys}:{rows:Record<string,number|string>[];keys:{key:string;label:string;suffix?:string}[]}){
  const width=520,height=190,pad=30
  const values=rows.flatMap(row=>keys.map(item=>Number(row[item.key]||0)))
  const max=Math.max(1,...values)
  const step=rows.length>1?(width-pad*2)/(rows.length-1):0
  const y=(value:number)=>height-pad-(Math.max(0,value)/max)*(height-pad*2)
  const points=(key:string)=>rows.map((row,index)=>`${pad+index*step},${y(Number(row[key]||0))}`).join(' ')
  return <div className="institutional-line-chart"><div className="trend-legend">{keys.map((item,index)=><span key={item.key}><i className={`line-${index}`}/>{item.label}</span>)}</div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${keys.map(k=>k.label).join(' and ')} over time`}><line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} className="line-axis"/><line x1={pad} y1={pad} x2={pad} y2={height-pad} className="line-axis"/>{keys.map((item,index)=><g key={item.key}><polyline points={points(item.key)} className={`trend-line line-${index}`}/>{rows.map((row,rowIndex)=><circle key={`${item.key}-${rowIndex}`} cx={pad+rowIndex*step} cy={y(Number(row[item.key]||0))} r="3" className={`line-point line-${index}`}><title>{`${row.label}: ${row[item.key]||0}${item.suffix||''}`}</title></circle>)}</g>)}{rows.map((row,index)=><text key={String(row.label)} x={pad+index*step} y={height-8} textAnchor="middle" className="line-label">{String(row.label).replace(/ .*/, '')}</text>)}</svg></div>
}
export function StackedPerformance({rows,onSelect}:{rows:Record<string,unknown>[];onSelect?:(row:Record<string,unknown>)=>void}){
  const prepared=rows.map(row=>{const completed=Number(row.completed||0),overdue=Number(row.overdue||0),active=Math.max(0,Number(row.active_work||0)-overdue);const total=Math.max(1,completed+active+overdue);return{row,completed,active,overdue,total}}).filter(item=>item.total>0).slice(0,10)
  return <div className="stacked-performance">{prepared.map(item=><button type="button" key={String(item.row.id)} onClick={()=>onSelect?.(item.row)} disabled={!onSelect}><span>{String(item.row.name)}</span><i aria-label={`${item.completed} completed, ${item.active} active on track, ${item.overdue} overdue`}><b className="stack-completed" style={{width:`${item.completed*100/item.total}%`}}/><b className="stack-active" style={{width:`${item.active*100/item.total}%`}}/><b className="stack-overdue" style={{width:`${item.overdue*100/item.total}%`}}/></i><strong>{item.completed+item.active+item.overdue}</strong></button>)}{!prepared.length&&<p>No team workload records are available for this scope.</p>}<small>Stacked bars show workload composition, not a staff score.</small></div>
}
type DistributionRow={label:string;value:number}
export function Donut({rows,centreLabel='Total',onSelect}:{rows:DistributionRow[];centreLabel?:string;onSelect?:(row:DistributionRow)=>void}){
  const total=rows.reduce((sum,row)=>sum+Number(row.value||0),0)
  let offset=0
  return <div className="institutional-donut"><div className="donut-figure" role="img" aria-label={`${centreLabel}: ${total}. ${rows.map(row=>`${row.label} ${row.value}`).join(', ')}`}><svg viewBox="0 0 42 42" aria-hidden="true"><circle className="donut-track" cx="21" cy="21" r="15.9155" fill="none" strokeWidth="6"/>{rows.map((row,index)=>{const share=total?Number(row.value)*100/total:0;const currentOffset=offset;offset+=share;return <circle key={row.label} className={`donut-slice ${sliceClass(index)}`} cx="21" cy="21" r="15.9155" fill="none" strokeWidth="6" pathLength="100" strokeDasharray={`${share} ${100-share}`} strokeDashoffset={-currentOffset} transform="rotate(-90 21 21)"/>})}</svg><div><strong>{total}</strong><span>{centreLabel}</span></div></div><div className="donut-legend">{rows.map((row,index)=><button type="button" key={row.label} disabled={!onSelect} onClick={()=>onSelect?.(row)}><i className={sliceClass(index)}/><span>{row.label}</span><strong>{row.value}</strong><small>{total?`${Math.round(Number(row.value)*100/total)}%`:'0%'}</small></button>)}</div></div>
}
export function Gauge({label,value,numerator,denominator,note,target=85}:{label:string;value:number;numerator:number;denominator:number;note:string;target?:number}){
  const bounded=Math.max(0,Math.min(100,Number(value)||0))
  const status=bounded>=target?'healthy':bounded>=Math.max(0,target-15)?'watch':'critical'
  const statusLabel=status==='healthy'?'Healthy':status==='watch'?'Watch':'Needs attention'
  const sampleNote=denominator>0&&denominator<10?'Small evidence base':''
  return <article className={`institutional-gauge gauge-${status}`}><header><div><span>{label}</span><em>{statusLabel}</em></div><small>{note}</small></header><div className="gauge-figure" role="img" aria-label={`${label}: ${bounded}%. ${statusLabel}. Target ${target}% or higher.`}><svg viewBox="0 0 108 62" aria-hidden="true"><path className="gauge-track" pathLength="100" d="M10 54 A44 44 0 0 1 98 54"/><path className="gauge-value" pathLength="100" strokeDasharray={`${bounded} ${100-bounded}`} d="M10 54 A44 44 0 0 1 98 54"/></svg><div><strong>{bounded}%</strong><span>{denominator?`${numerator} of ${denominator}`:'No eligible records'}</span></div></div><footer><span>Reference target ≥ {target}%</span>{sampleNote&&<small>{sampleNote}</small>}</footer></article>
}
export function LifecycleFunnel({rows,onSelect}:{rows:DistributionRow[];onSelect?:(row:DistributionRow)=>void}){
  const max=Math.max(1,...rows.map(row=>Number(row.value||0)))
  return <div className="institutional-funnel" role="img" aria-label={`Assignment lifecycle snapshot. ${rows.map(row=>`${row.label} ${row.value}`).join(', ')}`}>{rows.map((row,index)=>{const width=Math.max(34,Number(row.value||0)*100/max);return <button type="button" key={row.label} onClick={()=>onSelect?.(row)} disabled={!onSelect} style={{width:`${width}%`}} className={`funnel-stage stage-${index}`}><span>{row.label}</span><strong>{row.value}</strong></button>})}</div>
}
function teamRiskRows(data:InstitutionalIntelligence){
  if(!data.capabilities.people)return []
  const grouped=new Map<string,{team:string;overdue:number;awaiting:number;active:number;completed:number;officers:number}>()
  for(const person of data.people){
    const raw=String(person.team||'').trim(),team=raw||'Unassigned team'
    const current=grouped.get(team)||{team,overdue:0,awaiting:0,active:0,completed:0,officers:0}
    current.overdue+=Number(person.overdue||0)
    current.awaiting+=Number(person.awaiting_review||0)
    current.active+=Number(person.active_work||0)
    current.completed+=Number(person.completed||0)
    current.officers+=1
    grouped.set(team,current)
  }
  return [...grouped.values()].sort((a,b)=>(b.overdue+b.awaiting)-(a.overdue+a.awaiting)||b.overdue-a.overdue||a.team.localeCompare(b.team))
}
export function PerformancePulse({data}:{data:InstitutionalIntelligence}){
  const k=data.overview.kpis,b=data.overview.indicatorBasis
  const approvalDenominator=b.approvalRate?.denominator||0
  const teamRisk=teamRiskRows(data).filter(row=>row.overdue>0||row.awaiting>0).slice(0,3)
  const teamText=teamRisk.length?` Team responsibility: ${teamRisk.map(row=>`${row.team} (${row.overdue} overdue${row.awaiting?`, ${row.awaiting} awaiting review`:''})`).join('; ')}.`:''
  return <aside className="institutional-pulse"><div><small>MANAGEMENT PERFORMANCE PULSE</small><h3>What the current evidence shows</h3></div><p><strong>{k.completionRate||0}%</strong> of scoped assignments are completed; <strong>{k.overdue||0}</strong> are overdue and <strong>{k.dueSoon||0}</strong> are due soon. <strong>{k.awaitingReview||0}</strong> await review.{teamText} On-time completion is <strong>{k.onTimeCompletionRate||0}%</strong>. Research completion is <strong>{k.researchCompletionRate||0}%</strong>. Research approval is <strong>{k.approvalRate||0}%</strong>{approvalDenominator>0?` from ${approvalDenominator} submitted version${approvalDenominator===1?'':'s'}`:''}{approvalDenominator>0&&approvalDenominator<10?', so interpret that rate with the small evidence base in mind.':'.'}</p></aside>
}
export function TeamEarlyWarnings({data,onOpen}:{data:InstitutionalIntelligence;onOpen:(title:string,rows:Record<string,unknown>[])=>void}){
  if(!data.capabilities.people)return null
  const rows=teamRiskRows(data).map(row=>{
    const level=row.overdue>=3||row.awaiting>=5?'critical':row.overdue>0||row.awaiting>=2?'watch':'healthy'
    const evidence=[row.overdue?`${row.overdue} overdue`:null,row.awaiting?`${row.awaiting} awaiting review`:null,`${row.active} active work item${row.active===1?'':'s'}`].filter(Boolean).join(' · ')
    const action=level==='critical'?'Immediate management intervention':level==='watch'?'Review workload and deadlines':'No immediate intervention'
    return {...row,level,evidence,action}
  }).filter(row=>row.level!=='healthy').slice(0,6)
  return <article className="team-early-warning"><header><div><small>V10 EARLY WARNING</small><h3>Teams requiring management attention</h3><p>Transparent team-level signals from overdue work and review queues; no predictive black-box score is used.</p></div><strong>{rows.length}</strong></header><div>{rows.map(row=><button type="button" key={row.team} onClick={()=>onOpen(`Team warning · ${row.team}`,data.people.filter(person=>(String(person.team||'').trim()||'Unassigned team')===row.team))}><span><b>{row.team}</b><small>{row.evidence}</small></span><em className={`risk-${row.level}`}>{row.level==='critical'?'Critical':'Watch'}</em><strong>{row.action}</strong></button>)}{!rows.length&&<p className="team-warning-clear">No team currently crosses the early-warning thresholds in this authorised scope.</p>}</div><footer>Critical: 3+ overdue items or 5+ awaiting review. Watch: any overdue item or 2+ awaiting review. Team names come from App2 organisational attribution; missing attribution is shown as “Unassigned team”.</footer></article>
}

export function DeltaBadge({value,invert=false,suffix=''}:{value:number;invert?:boolean;suffix?:string}){
  if(!Number.isFinite(value)||value===0)return <small className="period-delta neutral">No change</small>
  const positive=value>0
  const favourable=invert?!positive:positive
  return <small className={`period-delta ${favourable?'favourable':'unfavourable'}`}>{positive?'↑':'↓'} {Math.abs(value)}{suffix} vs previous</small>
}
export function RiskMatrix({rows,onSelect}:{rows:Record<string,unknown>[];onSelect?:(row:Record<string,unknown>)=>void}){
  const prepared=rows.map(row=>{const overdue=Number(row.overdue||0),awaiting=Number(row.awaiting_review||0),onTime=Number(row.on_time_rate||0);const level=overdue>=3||onTime<70?'critical':overdue>0||awaiting>=3||onTime<90?'watch':'healthy';return{row,overdue,awaiting,onTime,level}})
  const order:Record<string,number>={critical:0,watch:1,healthy:2}
  prepared.sort((a,b)=>order[a.level]-order[b.level]||b.overdue-a.overdue)
  return <div className="risk-matrix"><div className="risk-matrix-head"><span>Officer</span><span>Overdue</span><span>Awaiting review</span><span>On-time</span><span>Signal</span></div>{prepared.slice(0,10).map(item=><button type="button" key={String(item.row.id)} onClick={()=>onSelect?.(item.row)} disabled={!onSelect}><span>{String(item.row.name)}</span><strong>{item.overdue}</strong><strong>{item.awaiting}</strong><strong>{item.onTime}%</strong><em className={`risk-${item.level}`}>{item.level==='critical'?'Critical':item.level==='watch'?'Watch':'Healthy'}</em></button>)}{!prepared.length&&<p>No team records are available for risk signalling.</p>}<small className="risk-note">Signals use transparent operational thresholds only; they are not a composite staff score or ranking.</small></div>
}

export function ReportAssurance({data,governance}:{data:InstitutionalIntelligence;governance:ReportGovernance|null}){
  const generated=new Date(data.generatedAt),ageMinutes=Math.max(0,Math.round((Date.now()-generated.getTime())/60000))
  const filtered=[data.filters.workType!=='All'?`Work type: ${data.filters.workType}`:'All work types',data.filters.status!=='All'?`Status: ${data.filters.status}`:'All statuses']
  const coverage=data.basis.assignments+data.basis.research+data.basis.publishedReports
  return <article className="report-assurance"><header><div><small>REPORT ASSURANCE</small><h3>Evidence, scope and freshness</h3></div><b>{ageMinutes<=15?'Current':'Check freshness'}</b></header><div className="assurance-grid"><span><small>Data freshness</small><strong>{ageMinutes<1?'Just generated':`${ageMinutes} min ago`}</strong></span><span><small>Authorised scope</small><strong>{data.scope.type.replaceAll('_',' ')}</strong></span><span><small>Evidence coverage</small><strong>{coverage} source records</strong></span><span><small>Active filters</small><strong>{filtered.join(' · ')}</strong></span><span><small>Period basis</small><strong>{data.filters.from} to {data.filters.to}</strong></span><span><small>Governance trail</small><strong>{governance?`${governance.events.length} recent events`:'Loading…'}</strong></span></div><footer>Assurance describes the evidence available to this report. It does not certify data quality beyond the underlying App2 records and current authorised scope.</footer></article>
}
export function GovernanceTrail({governance}:{governance:ReportGovernance|null}){
  if(!governance)return <section className="report-governance-panel"><p>Loading report governance history…</p></section>
  const label=(action:string)=>action.replace(/^REPORT_/,'').replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase())
  return <section className="report-governance-panel"><header><div><small>REPORT GOVERNANCE HISTORY</small><h4>Generation, export and scheduling audit trail</h4><p>{governance.visibility}. Internal entity identifiers are not displayed.</p></div><div className="governance-summary"><span><b>{governance.exports.total}</b><small>Exports</small></span><span><b>{governance.schedules.enabled}</b><small>Active schedules</small></span><span><b>{governance.schedules.failed}</b><small>Failed deliveries</small></span></div></header><div className="governance-events">{governance.events.slice(0,20).map((event,index)=><article key={`${event.created_at}-${index}`}><span><strong>{label(event.action)}</strong><small>{event.actor_name}</small></span><time>{new Date(event.created_at).toLocaleString('en-KE')}</time></article>)}{!governance.events.length&&<p>No report-governance events have been recorded yet.</p>}</div><footer>Delivery failures remain visible until a later successful run; audit events are read-only in this dashboard.</footer></section>
}
export function Insight({children}:{children:string}){return <aside className="institutional-insight"><small>KEY INTERPRETATION</small><p>{children}</p></aside>}
