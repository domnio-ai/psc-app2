import type {InstitutionalIntelligence} from '../../../api'
import '../styles/management-analysis.css'

const count=(value:unknown)=>Math.max(0,Number(value)||0)

export default function DataQualityReadiness({data}:{data:InstitutionalIntelligence}){
  const assignments=data.dataQuality?.assignments||{total:data.basis.assignments,missing_deadline:0,stale_active:0,without_team_members:0}
  const research=data.dataQuality?.research||{total:data.basis.research,missing_research_question:0,missing_objectives:0,missing_methodology:0,without_parent_assignment:0,missing_end_date:0,stale_active:0}
  const items=[
    {label:'Active assignments without a deadline',value:count(assignments.missing_deadline),basis:count(assignments.total)},
    {label:'Assignments without assigned team members',value:count(assignments.without_team_members),basis:count(assignments.total)},
    {label:'Active assignments not updated in 30+ days',value:count(assignments.stale_active),basis:count(assignments.total)},
    {label:'Research records missing a question',value:count(research.missing_research_question),basis:count(research.total)},
    {label:'Research records missing objectives',value:count(research.missing_objectives),basis:count(research.total)},
    {label:'Research records missing methodology',value:count(research.missing_methodology),basis:count(research.total)},
    {label:'Active research without an end date',value:count(research.missing_end_date),basis:count(research.total)},
    {label:'Research records not linked to an assignment',value:count(research.without_parent_assignment),basis:count(research.total)},
    {label:'Active research not updated in 30+ days',value:count(research.stale_active),basis:count(research.total)},
  ]
  return <section className="management-analysis-card data-quality-readiness">
    <header><div><small>DATA QUALITY & REPORT READINESS</small><h3>Check whether records are ready to inform decisions</h3><p>Checks use the full authorised assignment and research scope for the selected reporting period.</p></div><b>{data.scope.type.replaceAll('_',' ')}</b></header>
    <div className="management-analysis-checks">{items.map(item=><article key={item.label} className={item.value?'needs-attention':'clear'}><span>{item.label}</span><strong>{item.value}</strong><small>of {item.basis} records</small></article>)}</div>
    <aside><strong>How to read this:</strong> These checks identify missing or stale fields; they do not certify the validity, reliability, or completeness of the underlying evidence. Counts can overlap.</aside>
    <footer>APP2 does not currently capture structured beneficiary/geographic disaggregation or budget/staff-time expenditure in this reporting dataset. Equity and resource-to-results analysis would need those governed data fields.</footer>
  </section>
}
