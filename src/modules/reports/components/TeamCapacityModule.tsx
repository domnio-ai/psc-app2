import {useMemo,useState} from 'react'

type Row=Record<string,unknown>
type WorkType='Assignment'|'Task'|'Research'|'Review'
type Summary={id:string;name:string;team:string;rows:Row[];mix:Record<WorkType,number>;dueSoon:Row[];overdue:Row[];noDeadline:Row[]}

const text=(value:unknown)=>String(value??'').trim()
const asDate=(value:unknown)=>{const raw=text(value);if(!raw)return null;const d=new Date(raw);return Number.isNaN(d.getTime())?null:d}
const isActive=(row:Row)=>!['Completed','Archived','Approved'].includes(text(row.status))
const dayMs=86400000

export default function TeamCapacityModule({people,evidence,onOpen}:{people:Row[];evidence:Row[];onOpen:(title:string,rows:Row[])=>void}){
  const [query,setQuery]=useState('')
  const [team,setTeam]=useState('All')
  const today=useMemo(()=>{const d=new Date();d.setHours(0,0,0,0);return d},[])
  const summaries=useMemo<Summary[]>(()=>people.map(person=>{
    const id=text(person.id)
    const rows=evidence.filter(row=>text(row.user_id)===id&&isActive(row))
    const mix:Record<WorkType,number>={Assignment:0,Task:0,Research:0,Review:0}
    rows.forEach(row=>{const kind=text(row.work_type);if(kind==='Assignment'||kind==='Task'||kind==='Research'||kind==='Review')mix[kind]+=1})
    const overdue=rows.filter(row=>{const d=asDate(row.due_date);return Boolean(d&&d.getTime()<today.getTime())})
    const dueSoon=rows.filter(row=>{const d=asDate(row.due_date);if(!d)return false;const diff=(d.getTime()-today.getTime())/dayMs;return diff>=0&&diff<=7})
    const noDeadline=rows.filter(row=>!asDate(row.due_date))
    return{id,name:text(person.name)||'Unnamed team member',team:text(person.team)||'Unassigned team',rows,mix,dueSoon,overdue,noDeadline}
  }).sort((a,b)=>a.name.localeCompare(b.name)),[people,evidence,today])
  const teams=useMemo(()=>['All',...Array.from(new Set(summaries.map(item=>item.team))).sort((a,b)=>a.localeCompare(b))],[summaries])
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return summaries.filter(item=>(team==='All'||item.team===team)&&(!q||`${item.name} ${item.team}`.toLowerCase().includes(q)))},[summaries,query,team])
  const maxActive=Math.max(1,...filtered.map(item=>item.rows.length))

  return <section className="team-capacity-module">
    <header><div><small>V25 MANAGER TEAM WORKLOAD & CAPACITY VIEW</small><h3>Active responsibilities and deadline exposure</h3><p>Shows recorded active work across assignments, owned tasks, research and reviews. Bars indicate workload distribution only; they are not performance scores or staff rankings.</p></div><div className="team-capacity-legend"><span><i className="due"/>Due within 7 days</span><span><i className="overdue"/>Overdue</span><span><i className="none"/>No deadline recorded</span></div></header>
    <div className="team-capacity-controls"><label>Find team member<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Name or team"/></label><label>Team<select value={team} onChange={event=>setTeam(event.target.value)}>{teams.map(value=><option key={value}>{value}</option>)}</select></label></div>
    <div className="team-capacity-list">{filtered.map(item=><article key={item.id}>
      <div className="team-capacity-person"><strong>{item.name}</strong><span>{item.team}</span></div>
      <div className="team-capacity-total"><b>{item.rows.length}</b><span>active recorded responsibilities</span><div className="team-capacity-bar"><i style={{width:`${Math.max(4,item.rows.length/maxActive*100)}%`}}/></div></div>
      <div className="team-capacity-mix">{(['Assignment','Task','Research','Review'] as WorkType[]).map(kind=><button type="button" key={kind} className={item.mix[kind]?'':'zero'} onClick={()=>{const rows=item.rows.filter(row=>text(row.work_type)===kind);if(rows.length)onOpen(`${item.name} · active ${kind.toLowerCase()} responsibilities`,rows)}}><b>{item.mix[kind]}</b><span>{kind}</span><small>{item.mix[kind]?'Open evidence':'No recorded items'}</small></button>)}</div>
      <div className="team-capacity-deadlines"><button type="button" className={item.dueSoon.length?'due':''} onClick={()=>item.dueSoon.length&&onOpen(`${item.name} · due within 7 days`,item.dueSoon)}><b>{item.dueSoon.length}</b><span>Due soon</span></button><button type="button" className={item.overdue.length?'overdue':''} onClick={()=>item.overdue.length&&onOpen(`${item.name} · overdue workload`,item.overdue)}><b>{item.overdue.length}</b><span>Overdue</span></button><button type="button" className={item.noDeadline.length?'none':''} onClick={()=>item.noDeadline.length&&onOpen(`${item.name} · active work without a recorded deadline`,item.noDeadline)}><b>{item.noDeadline.length}</b><span>No deadline</span></button></div>
      {!item.rows.length&&<p className="team-capacity-empty">No active workload evidence is currently recorded for this authorised team member. The person remains visible so zero workload is not confused with omission.</p>}
    </article>)}</div>
    {!filtered.length&&<p className="team-capacity-empty">No authorised team member matches the current filters.</p>}
    <footer>Use workload and deadline evidence for allocation decisions together with role, complexity and context. APP2 does not convert these counts into a productivity score or ranking.</footer>
  </section>
}
