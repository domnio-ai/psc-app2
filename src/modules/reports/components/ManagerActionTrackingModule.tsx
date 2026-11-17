import {useEffect,useMemo,useState} from 'react'
import {api,type InstitutionalIntelligence} from '../../../api'

export const MANAGER_ACTION_LOG_VIEW_NAME='__App2 Manager Action Log V19__'
const REPORT_KEY='executive-performance-overview'
const ACTIONS=['Follow up','Request update','Schedule review','Escalate','Management resolved'] as const

type ActionKind=typeof ACTIONS[number]
type ActionEntry={
  id:string
  recordKey:string
  recordId:string
  recordType:string
  title:string
  action:ActionKind
  note:string
  reviewDate:string
  createdAt:string
  resolved:boolean
}

const text=(value:unknown)=>String(value??'').trim()
const recordKey=(row:Record<string,unknown>)=>`${text(row.type)||'Assignment'}:${text(row.id)||text(row.title)}`
const dueDate=(row:Record<string,unknown>)=>row.due_date?new Date(String(row.due_date)):null
const completed=(row:Record<string,unknown>)=>text(row.status)==='Completed'
const actionable=(row:Record<string,unknown>)=>{
  if(completed(row))return false
  const due=dueDate(row)
  const days=due?Math.ceil((due.getTime()-Date.now())/86400000):null
  return Boolean((due&&due.getTime()<Date.now())||(days!==null&&days>=0&&days<=7)||['Ready for Review','Awaiting Review'].includes(text(row.status))||['high','critical','urgent'].includes(text(row.priority).toLowerCase()))
}
function parseActions(value:unknown):ActionEntry[]{
  let candidate:unknown=value
  if(typeof candidate==='string'){try{candidate=JSON.parse(candidate)}catch{return[]}}
  if(!Array.isArray(candidate))return[]
  return candidate.filter(item=>item&&typeof item==='object').map(item=>item as ActionEntry).filter(item=>text(item.id)&&text(item.recordKey)&&ACTIONS.includes(item.action))
}

export default function ManagerActionTrackingModule({token,data,onOpen}:{token:string;data:InstitutionalIntelligence;onOpen:(title:string,rows:Record<string,unknown>[])=>void}){
  const [actions,setActions]=useState<ActionEntry[]>([])
  const [selectedKey,setSelectedKey]=useState('')
  const [action,setAction]=useState<ActionKind>('Follow up')
  const [note,setNote]=useState('')
  const [reviewDate,setReviewDate]=useState('')
  const [saving,setSaving]=useState(false)
  const [message,setMessage]=useState('')
  const [loaded,setLoaded]=useState(false)

  const records=useMemo(()=>{
    const seen=new Set<string>()
    return [...data.overview.records,...data.attention].filter(row=>{
      const key=recordKey(row)
      if(!key||seen.has(key)||!actionable(row))return false
      seen.add(key);return true
    })
  },[data])

  useEffect(()=>{
    let active=true
    api.reportViews(token,REPORT_KEY).then(views=>{
      if(!active)return
      const saved=views.find(view=>view.name===MANAGER_ACTION_LOG_VIEW_NAME)
      setActions(parseActions(saved?.filters?.actions))
      setLoaded(true)
    }).catch(()=>setLoaded(true))
    return()=>{active=false}
  },[token])

  useEffect(()=>{if(!selectedKey&&records.length)setSelectedKey(recordKey(records[0]))},[records,selectedKey])

  const selected=records.find(row=>recordKey(row)===selectedKey)
  const openActions=actions.filter(item=>!item.resolved).length
  const recent=actions.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,8)
  const persist=async(next:ActionEntry[],success:string)=>{
    setSaving(true);setMessage('')
    try{
      await api.saveReportView(token,REPORT_KEY,MANAGER_ACTION_LOG_VIEW_NAME,{purpose:'manager-action-log-v19',actions:JSON.stringify(next)},false)
      setActions(next);setMessage(success)
    }catch(value){setMessage(value instanceof Error?value.message:'Management action log could not be saved.')}
    finally{setSaving(false)}
  }
  const addAction=async()=>{
    if(!selected){setMessage('Select an authorised attention item first.');return}
    if(note.trim().length<3){setMessage('Enter a short management note describing the required action.');return}
    if(action==='Schedule review'&&!reviewDate){setMessage('Choose a review date for a scheduled review action.');return}
    const now=new Date().toISOString()
    const entry:ActionEntry={id:`act-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,recordKey:selectedKey,recordId:text(selected.id),recordType:text(selected.type)||'Assignment',title:text(selected.title)||'Untitled record',action,note:note.trim(),reviewDate:reviewDate||'',createdAt:now,resolved:action==='Management resolved'}
    const next=[entry,...actions].slice(0,250)
    await persist(next,'Management action recorded in your governed REDESY report profile.')
    setNote('');setReviewDate('')
  }
  const markResolved=async(id:string)=>{
    const next=actions.map(item=>item.id===id?{...item,resolved:true}:item)
    await persist(next,'Management action marked resolved in the action log.')
  }

  if(!loaded)return <section className="manager-action-tracking"><p>Loading manager action history…</p></section>
  return <section className="manager-action-tracking">
    <header><div><small>V19 MANAGER ACTION TRACKING</small><h3>Record and follow management interventions</h3><p>Actions are attached to authorised attention records and persisted through REDESY’s governed saved-report mechanism. They do not alter the underlying assignment or research workflow.</p></div><strong>{openActions}<small>open actions</small></strong></header>
    <div className="manager-action-layout">
      <form className="manager-action-form" onSubmit={event=>{event.preventDefault();void addAction()}}>
        <label>Attention item<select value={selectedKey} onChange={event=>setSelectedKey(event.target.value)}>{records.map(row=><option key={recordKey(row)} value={recordKey(row)}>{text(row.title)||'Untitled'} · {text(row.status)||'No status'}</option>)}</select></label>
        <label>Management action<select value={action} onChange={event=>setAction(event.target.value as ActionKind)}>{ACTIONS.map(value=><option key={value}>{value}</option>)}</select></label>
        {action==='Schedule review'&&<label>Review date<input type="date" value={reviewDate} onChange={event=>setReviewDate(event.target.value)}/></label>}
        <label className="manager-action-note">Action note<textarea value={note} onChange={event=>setNote(event.target.value)} placeholder="State the intervention, expected follow-up, blocker or decision." rows={3}/></label>
        <div className="manager-action-form-actions"><button type="submit" disabled={saving||!records.length}>{saving?'Saving…':'Record management action'}</button>{selected&&<button type="button" className="secondary" onClick={()=>onOpen(`Management action evidence · ${text(selected.title)}`,[selected])}>Open evidence</button>}</div>
        {!records.length&&<p>No current authorised attention item is available for action tracking.</p>}
        {message&&<p className="manager-action-message" role="status">{message}</p>}
      </form>
      <div className="manager-action-history"><header><div><small>ACTION HISTORY</small><h4>Recent interventions</h4></div><b>{actions.length} recorded</b></header>{recent.map(item=><article key={item.id} className={item.resolved?'resolved':''}><div><span><strong>{item.action}</strong>{item.resolved&&<em>Resolved</em>}</span><h5>{item.title}</h5><p>{item.note}</p><small>{item.recordType} · {new Date(item.createdAt).toLocaleString('en-KE')}{item.reviewDate?` · review ${new Date(`${item.reviewDate}T00:00:00`).toLocaleDateString('en-KE')}`:''}</small></div>{!item.resolved&&<button type="button" disabled={saving} onClick={()=>void markResolved(item.id)}>Mark resolved</button>}</article>)}{!recent.length&&<p>No management actions recorded yet.</p>}</div>
    </div>
    <footer><strong>Governance:</strong> V19 records management follow-up context only. “Management resolved” closes the action-log item; it does not change the source record’s REDESY workflow status, reviewer authority, ownership or RBAC.</footer>
  </section>
}
