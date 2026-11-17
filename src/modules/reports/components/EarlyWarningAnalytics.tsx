import type {InstitutionalIntelligence} from '../../../api'

type Row=Record<string,unknown>

export default function EarlyWarningAnalytics({data,onOpen}:{data:InstitutionalIntelligence;onOpen:(title:string,rows:Row[])=>void}){
  const warning=data.overview.earlyWarning
  if(!warning)return null
  const records=data.overview.records
  const attention=data.attention
  const teamRows=(team:string)=>data.people.filter(person=>(String(person.team||'').trim()||'Unassigned team')===team)
  const evidenceRows=(key:string,team:string)=>{
    if(key==='overdue-trajectory')return records.filter(row=>row.status!=='Completed'&&row.due_date&&new Date(String(row.due_date))<new Date())
    if(key==='throughput-gap'||key==='completion-deterioration')return records
    if(key==='review-pressure')return [...records.filter(row=>row.status==='Ready for Review'),...attention.filter(row=>row.type==='Research')]
    if(key==='team-concentration')return teamRows(team)
    if(key==='deadline-wave')return attention.filter(row=>String(row.reason).includes('Due within'))
    return records
  }
  return <article className="predictive-early-warning">
    <header>
      <div><small>EXPLAINABLE EARLY WARNING</small><h3>Likely management pressure if current patterns continue</h3><p>Directional signals only. Every warning shows its evidence, responsible team and management action.</p></div>
      <strong>{warning.signals.length}</strong>
    </header>
    <div className="predictive-warning-grid">
      {warning.signals.map(signal=><button type="button" key={signal.key} className={`predictive-${signal.level}`} onClick={()=>onOpen(`Early warning · ${signal.title}`,evidenceRows(signal.key,signal.responsibleTeam))}>
        <span className="predictive-warning-title"><em>{signal.level==='critical'?'Critical':'Watch'}</em><strong>{signal.title}</strong></span>
        <span><small>Responsible team</small><b>{signal.responsibleTeam}</b></span>
        <p><small>Evidence</small>{signal.evidence}</p>
        <p><small>Outlook</small>{signal.outlook}</p>
        <p><small>Management action</small>{signal.action}</p>
        <footer><span>Evidence strength: <b>{signal.evidenceStrength}</b></span><em>Open underlying evidence →</em></footer>
      </button>)}
      {!warning.signals.length&&<section className="predictive-clear"><strong>No early-warning threshold triggered</strong><p>The current scoped indicators do not show a directional pressure signal under the defined rules.</p></section>}
    </div>
    <footer>{warning.methodology}</footer>
  </article>
}
