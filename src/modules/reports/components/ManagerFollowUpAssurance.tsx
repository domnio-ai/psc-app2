import {useCallback,useEffect,useMemo,useState} from 'react'
import {api,type InstitutionalIntelligence} from '../../../api'
import {MANAGER_ACTION_LOG_VIEW_NAME} from './ManagerActionTrackingModule'

const REPORT_KEY='executive-performance-overview'
const DAY=86400000
const STALE_DAYS=14

type ActionEntry={
  id:string
  recordKey:string
  recordId:string
  recordType:string
  title:string
  action:string
  note:string
  reviewDate:string
  createdAt:string
  resolved:boolean
}

type Queue={
  key:string
  label:string
  count:number
  explanation:string
  tone:'critical'|'watch'|'context'|'good'
  actions:ActionEntry[]
}

const text=(value:unknown)=>String(value??'').trim()
const recordKey=(row:Record<string,unknown>)=>`${text(row.type)||'Assignment'}:${text(row.id)||text(row.title)}`
const validDate=(value:string)=>{const date=value?new Date(value):null;return date&&!Number.isNaN(date.getTime())?date:null}
const parseActions=(value:unknown):ActionEntry[]=>{
  let candidate:unknown=value
  if(typeof candidate==='string'){try{candidate=JSON.parse(candidate)}catch{return[]}}
  if(!Array.isArray(candidate))return[]
  return candidate.filter(item=>item&&typeof item==='object').map(item=>item as Partial<ActionEntry>).filter(item=>text(item.id)&&text(item.recordKey)).map(item=>({
    id:text(item.id),recordKey:text(item.recordKey),recordId:text(item.recordId),recordType:text(item.recordType)||'Assignment',title:text(item.title)||'Untitled record',action:text(item.action)||'Follow up',note:text(item.note),reviewDate:text(item.reviewDate),createdAt:text(item.createdAt),resolved:Boolean(item.resolved)
  }))
}
const ageDays=(entry:ActionEntry)=>{const created=validDate(entry.createdAt);return created?Math.max(0,Math.floor((Date.now()-created.getTime())/DAY)):0}
const reviewDays=(entry:ActionEntry)=>{const due=validDate(entry.reviewDate);return due?Math.ceil((due.getTime()-Date.now())/DAY):null}

export default function ManagerFollowUpAssurance({token,data,onOpen}:{token:string;data:InstitutionalIntelligence;onOpen:(title:string,rows:Record<string,unknown>[])=>void}){
  const [actions,setActions]=useState<ActionEntry[]>([])
  const [loading,setLoading]=useState(true)
  const [message,setMessage]=useState('')

  const load=useCallback(async()=>{
    setLoading(true);setMessage('')
    try{
      const views=await api.reportViews(token,REPORT_KEY)
      const saved=views.find(view=>view.name===MANAGER_ACTION_LOG_VIEW_NAME)
      setActions(parseActions(saved?.filters?.actions))
    }catch(value){setMessage(value instanceof Error?value.message:'Manager follow-up history could not be loaded.')}
    finally{setLoading(false)}
  },[token])
  useEffect(()=>{void load()},[load])

  const authorisedRecords=useMemo(()=>{
    const map=new Map<string,Record<string,unknown>>()
    for(const row of [...data.overview.records,...data.attention]){const key=recordKey(row);if(key&&!map.has(key))map.set(key,row)}
    return map
  },[data])

  const open=actions.filter(item=>!item.resolved)
  const overdueReviews=open.filter(item=>{const days=reviewDays(item);return days!==null&&days<0})
  const dueSoon=open.filter(item=>{const days=reviewDays(item);return days!==null&&days>=0&&days<=7})
  const escalations=open.filter(item=>item.action==='Escalate')
  const stale=open.filter(item=>!item.reviewDate&&ageDays(item)>=STALE_DAYS)
  const resolved=actions.filter(item=>item.resolved)

  const queues:Queue[]=[
    {key:'overdue',label:'Overdue scheduled reviews',count:overdueReviews.length,explanation:'Manager-scheduled review dates have passed and still remain open.',tone:'critical',actions:overdueReviews},
    {key:'due',label:'Reviews due within 7 days',count:dueSoon.length,explanation:'Scheduled management follow-ups approaching their declared review date.',tone:'watch',actions:dueSoon},
    {key:'escalated',label:'Open escalations',count:escalations.length,explanation:'Escalated management interventions that have not yet been closed in the action log.',tone:'watch',actions:escalations},
    {key:'stale',label:`Open over ${STALE_DAYS} days`,count:stale.length,explanation:'Open actions without a review date that have remained unresolved beyond the follow-up threshold.',tone:'context',actions:stale},
    {key:'open',label:'All unresolved actions',count:open.length,explanation:'Every currently open management intervention recorded through V19.',tone:'context',actions:open},
    {key:'resolved',label:'Management-resolved entries',count:resolved.length,explanation:'Action-log entries closed by management; source workflow status remains independent.',tone:'good',actions:resolved}
  ]

  const evidenceFor=(entries:ActionEntry[])=>{
    const seen=new Set<string>()
    return entries.map(item=>authorisedRecords.get(item.recordKey)).filter((row):row is Record<string,unknown>=>Boolean(row)).filter(row=>{const key=recordKey(row);if(seen.has(key))return false;seen.add(key);return true})
  }
  const priority=[...overdueReviews,...dueSoon,...escalations,...stale].filter((item,index,array)=>array.findIndex(other=>other.id===item.id)===index).sort((a,b)=>{
    const aDue=reviewDays(a),bDue=reviewDays(b)
    if(aDue!==null||bDue!==null)return (aDue??9999)-(bDue??9999)
    return ageDays(b)-ageDays(a)
  }).slice(0,8)

  if(loading)return <section className="manager-followup-assurance"><p>Loading management follow-up assurance…</p></section>
  return <section className="manager-followup-assurance">
    <header><div><small>V20 FOLLOW-UP & CLOSURE ASSURANCE</small><h3>Management action follow-up control</h3><p>Checks V19 management interventions for overdue reviews, near-term follow-ups, escalations and stale open actions. It reads the existing governed action log and does not create a second workflow.</p></div><button type="button" onClick={()=>void load()}>Refresh status</button></header>
    {message&&<p className="manager-followup-message" role="status">{message}</p>}
    <div className="manager-followup-grid">{queues.map(queue=>{const rows=evidenceFor(queue.actions);const hasEvidence=rows.length>0;return <button type="button" key={queue.key} className={`manager-followup-card followup-${queue.tone}${hasEvidence?'':' zero-evidence'}`} aria-disabled={!hasEvidence} onClick={()=>{if(hasEvidence)onOpen(`${queue.label} · authorised evidence`,rows)}}><span><strong>{queue.label}</strong><b>{queue.count}</b></span><p>{queue.explanation}</p><small>{hasEvidence?`${rows.length} current authorised source record${rows.length===1?'':'s'} available for drill-down`:'No matching authorised evidence in the current Reports scope'}</small>{hasEvidence?<em>Open authorised evidence →</em>:<em className="zero-evidence-note">No drill-down available</em>}</button>})}</div>
    <div className="manager-followup-priority"><header><div><small>FOLLOW-UP EXCEPTIONS</small><h4>Items needing management review</h4></div><b>{priority.length} shown</b></header>{priority.map(item=>{const days=reviewDays(item),row=authorisedRecords.get(item.recordKey);return <article key={item.id}><div><span><strong>{item.action}</strong>{days!==null&&<em className={days<0?'overdue':days<=7?'due':''}>{days<0?`${Math.abs(days)} day${Math.abs(days)===1?'':'s'} overdue`:days===0?'Due today':`Due in ${days} day${days===1?'':'s'}`}</em>}{days===null&&<em>{ageDays(item)} days open</em>}</span><h5>{item.title}</h5><p>{item.note||'No management note recorded.'}</p><small>{item.recordType} · recorded {validDate(item.createdAt)?.toLocaleString('en-KE')||'date unavailable'}</small></div>{row&&<button type="button" onClick={()=>onOpen(`Follow-up evidence · ${item.title}`,[row])}>Open evidence</button>}</article>})}{!priority.length&&<p>No overdue, near-term, escalated or stale management follow-up exceptions are currently recorded.</p>}</div>
    <footer><strong>Governance:</strong> V20 is an assurance view over the V19 manager action log. Counts may include historical action-log entries whose source records are no longer visible in the current authorised Reports scope; those records are never reconstructed or exposed. Closing a management action remains separate from assignment, research and reviewer workflow state.</footer>
  </section>
}
