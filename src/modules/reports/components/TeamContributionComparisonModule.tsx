import {useMemo,useState} from 'react'

type Row=Record<string,unknown>
type Comparison={label:string;from:string;to:string}|null
type Mix={Assignment:number;Task:number;Research:number;Review:number}
type Summary={id:string;name:string;team:string;current:Row[];previous:Row[];currentMix:Mix;previousMix:Mix;delta:number}

const text=(value:unknown)=>String(value??'').trim()
const emptyMix=():Mix=>({Assignment:0,Task:0,Research:0,Review:0})
const mix=(rows:Row[]):Mix=>rows.reduce<Mix>((acc,row)=>{
  const kind=text(row.work_type)
  if(kind==='Assignment'||kind==='Task'||kind==='Research'||kind==='Review')acc[kind]+=1
  return acc
},emptyMix())
const deltaLabel=(value:number)=>value>0?`+${value} recorded entries`:value<0?`${value} recorded entries`:'No change in recorded entries'

export default function TeamContributionComparisonModule({people,contributions,previousContributions,comparison,onOpen}:{people:Row[];contributions:Row[];previousContributions:Row[];comparison:Comparison;onOpen:(title:string,rows:Row[])=>void}){
  const [query,setQuery]=useState('')
  const [team,setTeam]=useState('All')
  const summaries=useMemo<Summary[]>(()=>people.map(person=>{
    const id=text(person.id)
    const current=contributions.filter(row=>text(row.user_id)===id)
    const previous=previousContributions.filter(row=>text(row.user_id)===id)
    return{id,name:text(person.name)||'Unnamed team member',team:text(person.team)||'Unassigned team',current,previous,currentMix:mix(current),previousMix:mix(previous),delta:current.length-previous.length}
  }).sort((a,b)=>a.name.localeCompare(b.name)),[people,contributions,previousContributions])
  const teams=useMemo(()=>['All',...Array.from(new Set(summaries.map(item=>item.team))).sort((a,b)=>a.localeCompare(b))],[summaries])
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return summaries.filter(item=>(team==='All'||item.team===team)&&(!q||`${item.name} ${item.team}`.toLowerCase().includes(q)))},[summaries,query,team])

  return <section className="team-contribution-comparison-module">
    <header><div><small>V24 TEAM CONTRIBUTION SUMMARY & PERIOD COMPARISON</small><h3>Recorded contribution mix by team member</h3><p>Compares attributable assignment, task, research and review entries with the immediately preceding equal-length period. The comparison is descriptive evidence only; it is not a productivity score, ranking or judgement of performance.</p></div><div className="team-contribution-comparison-period"><strong>{comparison?'Comparable period available':'Comparison unavailable'}</strong><span>{comparison?`${comparison.from} to ${comparison.to}`:'Choose a reporting period with both start and end dates.'}</span></div></header>
    <div className="team-contribution-comparison-controls"><label>Find team member<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Name or team"/></label><label>Team<select value={team} onChange={event=>setTeam(event.target.value)}>{teams.map(value=><option key={value}>{value}</option>)}</select></label></div>
    <div className="team-contribution-comparison-list">{filtered.map(item=><article key={item.id}>
      <div className="team-contribution-comparison-person"><strong>{item.name}</strong><span>{item.team}</span></div>
      <div className="team-contribution-comparison-totals"><div><b>{item.current.length}</b><span>current entries</span></div><div><b>{comparison?item.previous.length:'—'}</b><span>previous entries</span></div><div className={item.delta>0?'up':item.delta<0?'down':'same'}><b>{comparison?deltaLabel(item.delta):'No comparison'}</b><span>descriptive change only</span></div></div>
      <div className="team-contribution-comparison-mix">{(['Assignment','Task','Research','Review'] as (keyof Mix)[]).map(kind=><div key={kind}><strong>{kind}</strong><span>{item.currentMix[kind]} current</span><span>{comparison?`${item.previousMix[kind]} previous`:'previous unavailable'}</span><em>{comparison?`${item.currentMix[kind]-item.previousMix[kind]>=0?'+':''}${item.currentMix[kind]-item.previousMix[kind]}`:'—'}</em></div>)}</div>
      <div className="team-contribution-comparison-actions"><button type="button" disabled={!item.current.length} onClick={()=>item.current.length&&onOpen(`${item.name} · current-period contribution evidence`,item.current)}>Current evidence</button><button type="button" disabled={!comparison||!item.previous.length} onClick={()=>comparison&&item.previous.length&&onOpen(`${item.name} · previous-period contribution evidence`,item.previous)}>Previous evidence</button></div>
      {!item.current.length&&!item.previous.length&&<p className="team-contribution-comparison-empty">No recorded contribution entries in either comparable period. The team member remains visible so absence of recorded activity is not confused with omission from the report.</p>}
    </article>)}</div>
    {!filtered.length&&<p className="team-contribution-comparison-empty">No authorised team member matches the current search and team filter.</p>}
    <footer>Counts represent recorded REDESY contribution evidence, not effort, quality or productivity. Managers should use drill-down evidence and work context before drawing conclusions.</footer>
  </section>
}
