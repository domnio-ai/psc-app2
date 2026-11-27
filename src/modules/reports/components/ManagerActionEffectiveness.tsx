import {useCallback,useEffect,useMemo,useState} from 'react'
import {api,type InstitutionalIntelligence} from '../../../api'
import {MANAGER_ACTION_LOG_VIEW_NAME} from './ManagerActionTrackingModule'

const REPORT_KEY='executive-performance-overview'
const DAY=86400000
const AGING_DAYS=14

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

type OutcomeCase={
  key:string
  label:string
  explanation:string
  tone:'good'|'watch'|'critical'|'context'
  actions:ActionEntry[]
}

const text=(value:unknown)=>String(value??'').trim()
const recordKey=(row:Record<string,unknown>)=>`${text(row.type)||'Assignment'}:${text(row.id)||text(row.title)}`
const status=(row:Record<string,unknown>)=>text(row.status).toLowerCase()
const isCompleted=(row:Record<string,unknown>)=>['completed','closed','approved','finalised','finalized'].includes(status(row))
const validDate=(value:string)=>{const date=value?new Date(value):null;return date&&!Number.isNaN(date.getTime())?date:null}
const ageDays=(entry:ActionEntry)=>{const created=validDate(entry.createdAt);return created?Math.max(0,Math.floor((Date.now()-created.getTime())/DAY)):0}
const reviewDays=(entry:ActionEntry)=>{const due=validDate(entry.reviewDate);return due?Math.ceil((due.getTime()-Date.now())/DAY):null}
const parseActions=(value:unknown):ActionEntry[]=>{
  let candidate:unknown=value
  if(typeof candidate==='string'){try{candidate=JSON.parse(candidate)}catch{return[]}}
  if(!Array.isArray(candidate))return[]
  return candidate.filter(item=>item&&typeof item==='object').map(item=>item as Partial<ActionEntry>).filter(item=>text(item.id)&&text(item.recordKey)).map(item=>({
    id:text(item.id),recordKey:text(item.recordKey),recordId:text(item.recordId),recordType:text(item.recordType)||'Assignment',title:text(item.title)||'Untitled record',action:text(item.action)||'Follow up',note:text(item.note),reviewDate:text(item.reviewDate),createdAt:text(item.createdAt),resolved:Boolean(item.resolved)
  }))
}

export default function ManagerActionEffectiveness({token,data,onOpen}:{token:string;data:InstitutionalIntelligence;onOpen:(title:string,rows:Record<string,unknown>[])=>void}){
  const [actions,setActions]=useState<ActionEntry[]>([])
  const [loading,setLoading]=useState(true)
  const [message,setMessage]=useState('')

  const load=useCallback(async()=>{
    setLoading(true);setMessage('')
    try{
      const views=await api.reportViews(token,REPORT_KEY)
      const saved=views.find(view=>view.name===MANAGER_ACTION_LOG_VIEW_NAME)
      setActions(parseActions(saved?.filters?.actions))
    }catch(value){setMessage(value instanceof Error?value.message:'Management action outcome review could not be loaded.')}
    finally{setLoading(false)}
  },[token])
  useEffect(()=>{void load()},[load])

  const authorisedRecords=useMemo(()=>{
    const map=new Map<string,Record<string,unknown>>()
    for(const row of [...data.overview.records,...data.attention]){
      const key=recordKey(row)
      if(key&&!map.has(key))map.set(key,row)
    }
    return map
  },[data])

  const visibleActions=actions.filter(item=>authorisedRecords.has(item.recordKey))
  const sourceCompleted=visibleActions.filter(item=>isCompleted(authorisedRecords.get(item.recordKey)!))
  const closureCandidates=sourceCompleted.filter(item=>!item.resolved)
  const managementClosedSourceOpen=visibleActions.filter(item=>item.resolved&&!isCompleted(authorisedRecords.get(item.recordKey)!))
  const agingOpen=visibleActions.filter(item=>!item.resolved&&!isCompleted(authorisedRecords.get(item.recordKey)!)&&ageDays(item)>=AGING_DAYS)
  const overdueReview=visibleActions.filter(item=>!item.resolved&&(()=>{const days=reviewDays(item);return days!==null&&days<0})())
  const activeEscalations=visibleActions.filter(item=>!item.resolved&&item.action==='Escalate')

  const cases:OutcomeCase[]=[
    {key:'source-complete',label:'Source records now completed',explanation:'Current authorised source records are now in a completed/closed/approved state after a management action was recorded. This is association, not causal attribution.',tone:'good',actions:sourceCompleted},
    {key:'closure-candidate',label:'Action-log closure candidates',explanation:'The source record is now completed but the management action remains open and may need administrative closure.',tone:'watch',actions:closureCandidates},
    {key:'closed-source-open',label:'Management closed, source still open',explanation:'Management marked the follow-up resolved while the underlying authorised source workflow remains open. This is context for review, not an error by itself.',tone:'context',actions:managementClosedSourceOpen},
    {key:'aging-open',label:`Open interventions over ${AGING_DAYS} days`,explanation:'The management action remains unresolved and the current source record is still open beyond the follow-up threshold.',tone:'critical',actions:agingOpen},
    {key:'overdue-review',label:'Overdue scheduled reviews',explanation:'A management review date has passed while the action remains open.',tone:'critical',actions:overdueReview},
    {key:'escalations',label:'Active escalations',explanation:'Escalated management actions remain open against currently authorised source records.',tone:'watch',actions:activeEscalations}
  ]

  const rowsFor=(entries:ActionEntry[])=>{
    const seen=new Set<string>()
    return entries.map(item=>authorisedRecords.get(item.recordKey)).filter((row):row is Record<string,unknown>=>Boolean(row)).filter(row=>{const key=recordKey(row);if(seen.has(key))return false;seen.add(key);return true})
  }

  const priority=[...overdueReview,...agingOpen,...closureCandidates,...managementClosedSourceOpen].filter((item,index,array)=>array.findIndex(other=>other.id===item.id)===index).sort((a,b)=>{
    const ad=reviewDays(a),bd=reviewDays(b)
    if(ad!==null||bd!==null)return (ad??9999)-(bd??9999)
    return ageDays(b)-ageDays(a)
  }).slice(0,8)

  if(loading)return <section className="manager-action-effectiveness"><p>Loading management action effectiveness…</p></section>
  return <section className="manager-action-effectiveness">
    <header><div><small>V21 MANAGEMENT ACTION EFFECTIVENESS</small><h3>Outcome review for recorded management interventions</h3><p>Relates the V19 action log to the current authorised Reports view so managers can see follow-up closure candidates, aging interventions and current source outcomes. APP2 does not infer that a management action caused an outcome.</p></div><button type="button" onClick={()=>void load()}>Refresh outcomes</button></header>
    {message&&<p className="manager-effectiveness-message" role="status">{message}</p>}
    <div className="manager-effectiveness-summary"><article><strong>{visibleActions.length}</strong><span>actions with current authorised evidence</span></article><article><strong>{sourceCompleted.length}</strong><span>source records now completed</span></article><article><strong>{closureCandidates.length}</strong><span>open actions ready for closure review</span></article><article><strong>{agingOpen.length}</strong><span>aging unresolved interventions</span></article></div>
    <div className="manager-effectiveness-grid">{cases.map(item=>{const rows=rowsFor(item.actions);const hasEvidence=rows.length>0;return <button type="button" key={item.key} className={`manager-effectiveness-card effectiveness-${item.tone}${hasEvidence?'':' zero-evidence'}`} aria-disabled={!hasEvidence} onClick={()=>{if(hasEvidence)onOpen(`${item.label} · authorised evidence`,rows)}}><span><strong>{item.label}</strong><b>{item.actions.length}</b></span><p>{item.explanation}</p><small>{hasEvidence?`${rows.length} current authorised source record${rows.length===1?'':'s'} available`:'No matching authorised evidence in the current Reports scope'}</small>{hasEvidence?<em>Open evidence →</em>:<em className="zero-evidence-note">No drill-down available</em>}</button>})}</div>
    <div className="manager-effectiveness-priority"><header><div><small>OUTCOME REVIEW EXCEPTIONS</small><h4>Interventions needing management reconciliation</h4></div><b>{priority.length} shown</b></header>{priority.map(item=>{const row=authorisedRecords.get(item.recordKey);const days=reviewDays(item);return <article key={item.id}><div><span><strong>{item.action}</strong>{item.resolved?<em className="resolved">Management resolved</em>:days!==null&&days<0?<em className="overdue">{Math.abs(days)} day{Math.abs(days)===1?'':'s'} review overdue</em>:<em>{ageDays(item)} days open</em>}</span><h5>{item.title}</h5><p>{item.note||'No management note recorded.'}</p><small>Current source status: {row?text(row.status)||'Not stated':'Not visible'} · {item.recordType}</small></div>{row&&<button type="button" onClick={()=>onOpen(`Action outcome evidence · ${item.title}`,[row])}>Open evidence</button>}</article>})}{!priority.length&&<p>No management action reconciliation exceptions are currently visible in this authorised Reports scope.</p>}</div>
    <footer><strong>Governance:</strong> V21 is an analytical assurance module. It reads the governed V19 action log and current authorised Reports evidence only. “Source now completed” is an observed association, not proof that the recorded management intervention caused the outcome. V21 does not update assignments, research, reviews, ownership, permissions or action-log state.</footer>
  </section>
}
