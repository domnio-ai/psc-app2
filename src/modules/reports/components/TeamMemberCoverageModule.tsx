import {useMemo,useState} from 'react'

type Row=Record<string,unknown>
const text=(value:unknown)=>String(value??'').trim()

export default function TeamMemberCoverageModule({people,contributions,onOpen}:{people:Row[];contributions:Row[];onOpen:(title:string,rows:Row[])=>void}){
  const [query,setQuery]=useState('')
  const [workType,setWorkType]=useState('All')
  const contributionMap=useMemo(()=>{
    const map=new Map<string,Row[]>()
    for(const row of contributions){
      const key=text(row.user_id)
      if(!key)continue
      const list=map.get(key)||[]
      list.push(row);map.set(key,list)
    }
    return map
  },[contributions])
  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase()
    return [...people].filter(person=>{
      if(q&&!`${text(person.name)} ${text(person.team)}`.toLowerCase().includes(q))return false
      if(workType==='All')return true
      return (contributionMap.get(text(person.id))||[]).some(row=>text(row.work_type)===workType)
    }).sort((a,b)=>text(a.name).localeCompare(text(b.name)))
  },[people,query,workType,contributionMap])
  const totals=useMemo(()=>({members:people.length,withContribution:people.filter(person=>(contributionMap.get(text(person.id))||[]).length>0).length}),[people,contributionMap])
  return <section className="team-member-coverage-module">
    <header><div><small>V22 TEAM MEMBER COVERAGE & CONTRIBUTION ACCOUNTABILITY</small><h3>Every authorised team member is represented</h3><p>Contribution is attributed from existing APP2 assignment membership, task ownership/review and research lead/collaborator/reviewer records. This is recognition of recorded contribution, not a staff score or ranking.</p></div><div className="team-coverage-summary"><strong>{totals.members}</strong><span>team members</span><strong>{totals.withContribution}</strong><span>with recorded contribution in this period</span></div></header>
    <div className="team-coverage-filters"><label>Find team member<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Name or team"/></label><label>Contribution type<select value={workType} onChange={event=>setWorkType(event.target.value)}><option>All</option><option>Assignment</option><option>Task</option><option>Research</option><option>Review</option></select></label></div>
    <div className="team-coverage-grid">{filtered.map(person=>{
      const rows=contributionMap.get(text(person.id))||[]
      const counts={Assignment:0,Task:0,Research:0,Review:0} as Record<string,number>
      for(const row of rows){const key=text(row.work_type);if(key in counts)counts[key]++}
      return <article key={text(person.id)} className="team-coverage-card">
        <header><div><strong>{text(person.name)||'Unnamed team member'}</strong><small>{text(person.team)||'Unassigned team'}</small></div><span className={rows.length?'coverage-recorded':'coverage-zero'}>{rows.length?'Recorded contribution':'No recorded contribution this period'}</span></header>
        <div className="team-contribution-counts"><span><b>{counts.Assignment}</b>Assignments</span><span><b>{counts.Task}</b>Tasks</span><span><b>{counts.Research}</b>Research</span><span><b>{counts.Review}</b>Reviews</span></div>
        <p>{rows.length?`${rows.length} attributable contribution record${rows.length===1?'':'s'} available for evidence drill-down.`:'The member remains visible so absence of activity is explicit rather than an omission from manager reporting.'}</p>
        <button type="button" disabled={!rows.length} onClick={()=>onOpen(`${text(person.name)} · contribution evidence`,rows)}>Open contribution evidence</button>
      </article>
    })}</div>
    {!filtered.length&&<p className="team-coverage-empty">No team members match the current coverage filter.</p>}
    <footer>Coverage is restricted to the manager’s authorised APP2 team scope. Contribution evidence does not alter assignment, task, research or reviewer workflow state.</footer>
  </section>
}
