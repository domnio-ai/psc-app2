import type {InstitutionalIntelligence} from '../../../api'

type TrendTone='improving'|'deteriorating'|'stable'|'context'
type TrendMetric={
  key:string
  label:string
  current:number
  previous:number
  delta:number
  suffix?:string
  tone:TrendTone
  explanation:string
  rows:Record<string,unknown>[]
}

const number=(value:unknown)=>Number(value||0)
const today=()=>new Date()
const isOverdue=(row:Record<string,unknown>)=>row.status!=='Completed'&&Boolean(row.due_date)&&new Date(String(row.due_date))<today()

function toneFor(key:string,delta:number):TrendTone{
  if(delta===0)return 'stable'
  if(key==='totalWork')return 'context'
  if(key==='overdue'||key==='awaitingReview')return delta<0?'improving':'deteriorating'
  return delta>0?'improving':'deteriorating'
}

function movement(tone:TrendTone,delta:number,suffix=''){
  if(delta===0)return 'No change'
  const value=Math.abs(delta)
  const unit=suffix==='%'?' percentage points':''
  if(tone==='context')return `${delta>0?'Up':'Down'} ${value}${unit}`
  return `${tone==='improving'?'Improved':'Deteriorated'} by ${value}${unit}`
}

export default function TrendIntelligence({data,onOpen}:{data:InstitutionalIntelligence;onOpen:(title:string,rows:Record<string,unknown>[])=>void}){
  const comparison=data.overview.comparison
  if(!comparison)return <article className="trend-intelligence trend-intelligence-empty"><header><div><small>V17 PERIOD-OVER-PERIOD INTELLIGENCE</small><h3>Management trend intelligence</h3></div><b>Not available</b></header><p>A previous equal-length comparison period is not available for the selected reporting range.</p></article>

  const records=data.overview.records
  const attention=data.attention
  const k=data.overview.kpis
  const previous=comparison.metrics
  const deltas=comparison.deltas
  const metrics:TrendMetric[]=[
    {key:'totalWork',label:'Scoped workload',current:number(k.totalWork),previous:number(previous.totalWork),delta:number(deltas.totalWork),tone:toneFor('totalWork',number(deltas.totalWork)),explanation:'Change in the number of assignments within the authorised reporting scope.',rows:records},
    {key:'completed',label:'Completed work',current:number(k.completed),previous:number(previous.completed),delta:number(deltas.completed),tone:toneFor('completed',number(deltas.completed)),explanation:'Movement in completed assignments compared with the immediately preceding equal-length period.',rows:records.filter(row=>row.status==='Completed')},
    {key:'overdue',label:'Overdue work',current:number(k.overdue),previous:number(previous.overdue),delta:number(deltas.overdue),tone:toneFor('overdue',number(deltas.overdue)),explanation:'A fall is an improvement; an increase means more current work is beyond its recorded due date.',rows:records.filter(isOverdue)},
    {key:'awaitingReview',label:'Review queue',current:number(k.awaitingReview),previous:number(previous.awaitingReview),delta:number(deltas.awaitingReview),tone:toneFor('awaitingReview',number(deltas.awaitingReview)),explanation:'Movement in assignments currently waiting at the review stage.',rows:records.filter(row=>row.status==='Ready for Review')},
    {key:'completionRate',label:'Completion rate',current:number(k.completionRate),previous:number(previous.completionRate),delta:number(deltas.completionRate),suffix:'%',tone:toneFor('completionRate',number(deltas.completionRate)),explanation:'Percentage-point change in completed assignments within the scoped workload.',rows:records},
    {key:'researchCompletionRate',label:'Research completion',current:number(k.researchCompletionRate),previous:number(previous.researchCompletionRate),delta:number(deltas.researchCompletionRate),suffix:'%',tone:toneFor('researchCompletionRate',number(deltas.researchCompletionRate)),explanation:'Percentage-point change in completed research across the authorised research portfolio.',rows:attention.filter(row=>row.type==='Research')},
  ]
  const improving=metrics.filter(item=>item.tone==='improving').length
  const deteriorating=metrics.filter(item=>item.tone==='deteriorating').length

  return <article className="trend-intelligence">
    <header><div><small>V17 PERIOD-OVER-PERIOD INTELLIGENCE</small><h3>What changed since the previous comparable period</h3><p>{comparison.label}. Movements are descriptive operational indicators, not staff scores or rankings.</p></div><span className="trend-intelligence-summary"><b>{improving} improving</b><b>{deteriorating} deteriorating</b></span></header>
    <div className="trend-intelligence-grid">
      {metrics.map(item=><button type="button" key={item.key} className={`trend-intelligence-card trend-${item.tone}`} onClick={()=>onOpen(`Trend evidence · ${item.label}`,item.rows)}>
        <span className="trend-intelligence-card-head"><strong>{item.label}</strong><em>{movement(item.tone,item.delta,item.suffix)}</em></span>
        <span className="trend-intelligence-values"><b>{item.current}{item.suffix||''}</b><small>Previous {item.previous}{item.suffix||''}</small></span>
        <p>{item.explanation}</p>
        <small className="trend-intelligence-action">Open current authorised evidence →</small>
      </button>)}
    </div>
    <footer>Evidence drill-down shows current records already returned by the permission-aware Reports API. It does not reconstruct historical record membership or widen the signed-in user’s authorised scope.</footer>
  </article>
}
