import {useEffect,useMemo,useState} from 'react'
import {api} from '../../../api'
import {MANAGER_ACTION_LOG_VIEW_NAME} from './ManagerActionTrackingModule'

type Row=Record<string,unknown>
type ActionEntry={id:string;recordKey:string;recordId:string;recordType:string;title:string;action:string;note:string;reviewDate:string;createdAt:string;resolved:boolean}
type TimelineEntry={id:string;date:string;kind:string;title:string;role:string;status:string;summary:string;evidence:Row[];context:boolean}

const REPORT_KEY='executive-performance-overview'
const text=(value:unknown)=>String(value??'').trim()
const validDate=(value:string)=>{const d=value?new Date(value):null;return d&&!Number.isNaN(d.getTime())?d:null}
const parseActions=(value:unknown):ActionEntry[]=>{
  let candidate:unknown=value
  if(typeof candidate==='string'){try{candidate=JSON.parse(candidate)}catch{return[]}}
  if(!Array.isArray(candidate))return[]
  return candidate.filter(item=>item&&typeof item==='object').map(item=>item as Partial<ActionEntry>).filter(item=>text(item.id)&&text(item.recordKey)).map(item=>({
    id:text(item.id),recordKey:text(item.recordKey),recordId:text(item.recordId),recordType:text(item.recordType)||'Assignment',title:text(item.title)||'Untitled record',action:text(item.action)||'Follow up',note:text(item.note),reviewDate:text(item.reviewDate),createdAt:text(item.createdAt),resolved:Boolean(item.resolved)
  }))
}

export default function ContributionTimelineModule({token,people,contributions,onOpen}:{token:string;people:Row[];contributions:Row[];onOpen:(title:string,rows:Row[])=>void}){
  const sortedPeople=useMemo(()=>[...people].sort((a,b)=>text(a.name).localeCompare(text(b.name))),[people])
  const [selectedId,setSelectedId]=useState('')
  const [kind,setKind]=useState('All')
  const [query,setQuery]=useState('')
  const [actions,setActions]=useState<ActionEntry[]>([])
  const [actionLoaded,setActionLoaded]=useState(false)

  useEffect(()=>{if(!selectedId&&sortedPeople.length)setSelectedId(text(sortedPeople[0].id))},[sortedPeople,selectedId])
  useEffect(()=>{
    let active=true
    api.reportViews(token,REPORT_KEY).then(views=>{
      if(!active)return
      const saved=views.find(view=>view.name===MANAGER_ACTION_LOG_VIEW_NAME)
      setActions(parseActions(saved?.filters?.actions));setActionLoaded(true)
    }).catch(()=>setActionLoaded(true))
    return()=>{active=false}
  },[token])

  const selected=sortedPeople.find(person=>text(person.id)===selectedId)
  const personRows=useMemo(()=>contributions.filter(row=>text(row.user_id)===selectedId),[contributions,selectedId])
  const timeline=useMemo(()=>{
    const entries:TimelineEntry[]=personRows.map((row,index)=>({
      id:`contribution-${text(row.work_type)}-${text(row.work_id)}-${text(row.evidence_at)}-${index}`,
      date:text(row.evidence_at),
      kind:text(row.work_type)||'Contribution',
      title:text(row.work_title)||'Untitled work',
      role:text(row.contribution_role)||'Contributor',
      status:text(row.status)||'Status unavailable',
      summary:text(row.evidence)||'Recorded APP2 contribution evidence',
      evidence:[row],
      context:false
    }))
    const workIds=new Set(personRows.map(row=>text(row.work_id)).filter(Boolean))
    const workTitles=new Set(personRows.map(row=>text(row.work_title)).filter(Boolean))
    for(const action of actions){
      if(!(workIds.has(action.recordId)||workTitles.has(action.title)))continue
      const evidence=personRows.filter(row=>text(row.work_id)===action.recordId||text(row.work_title)===action.title)
      entries.push({
        id:`manager-action-${action.id}`,date:action.createdAt,kind:'Management action',title:action.title,role:action.action,status:action.resolved?'Management resolved':'Open management action',
        summary:action.note||'Management follow-up context recorded in V19.',evidence,context:true
      })
    }
    return entries.sort((a,b)=>(validDate(b.date)?.getTime()||0)-(validDate(a.date)?.getTime()||0))
  },[personRows,actions])
  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase()
    return timeline.filter(item=>{
      if(kind!=='All'&&item.kind!==kind)return false
      if(q&&!`${item.title} ${item.role} ${item.status} ${item.summary}`.toLowerCase().includes(q))return false
      return true
    })
  },[timeline,kind,query])
  const contributionCount=timeline.filter(item=>!item.context).length
  const contextCount=timeline.filter(item=>item.context).length

  return <section className="contribution-timeline-module">
    <header><div><small>V23 CONTRIBUTION TIMELINE & WORK HISTORY</small><h3>Chronological evidence of team-member contribution</h3><p>Shows attributable assignment, task, research and review activity for each authorised team member. V19 management actions appear only as linked management context and are never counted as the staff member’s contribution.</p></div><div className="contribution-timeline-summary"><strong>{contributionCount}</strong><span>recorded contributions</span><strong>{contextCount}</strong><span>linked management actions</span></div></header>
    <div className="contribution-timeline-controls"><label>Team member<select value={selectedId} onChange={event=>setSelectedId(event.target.value)}>{sortedPeople.map(person=><option key={text(person.id)} value={text(person.id)}>{text(person.name)||'Unnamed team member'} · {text(person.team)||'Unassigned team'}</option>)}</select></label><label>Activity type<select value={kind} onChange={event=>setKind(event.target.value)}><option>All</option><option>Assignment</option><option>Task</option><option>Research</option><option>Review</option><option>Management action</option></select></label><label>Find activity<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Title, role, status or evidence"/></label></div>
    <div className="contribution-timeline-person"><strong>{text(selected?.name)||'No team member selected'}</strong><span>{text(selected?.team)||'Unassigned team'}</span></div>
    <div className="contribution-timeline-list">{filtered.map(item=><article key={item.id} className={item.context?'management-context':''}><div className="timeline-marker" aria-hidden="true"></div><div className="timeline-date"><strong>{validDate(item.date)?.toLocaleDateString('en-KE')||'Date unavailable'}</strong><small>{validDate(item.date)?.toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})||''}</small></div><div className="timeline-content"><span><b>{item.kind}</b>{item.context&&<em>Management context — not staff contribution</em>}</span><h4>{item.title}</h4><p>{item.summary}</p><small>{item.role} · {item.status}</small></div><div className="timeline-action">{item.evidence.length?<button type="button" onClick={()=>onOpen(`${text(selected?.name)} · ${item.kind} evidence`,item.evidence)}>Open evidence</button>:<span>No current drill-down</span>}</div></article>)}</div>
    {!filtered.length&&<p className="contribution-timeline-empty">{timeline.length?'No timeline entries match the current filters.':'No attributable contribution is recorded for this team member in the selected reporting period.'}</p>}
    {!actionLoaded&&<p className="contribution-timeline-loading">Loading management-action context…</p>}
    <footer>Timeline visibility follows the existing manager team scope. It recognises recorded contribution and work history without creating a productivity score, staff ranking or new workflow state.</footer>
  </section>
}
