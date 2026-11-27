import {useMemo,useState} from 'react'
import {attentionTeam,attentionTiming,detailValue,title} from '../utils/reportFormatting'

export type EvidenceDetail={title:string;rows:Record<string,unknown>[]}

function text(value:unknown){return String(value??'').trim()}
function normalized(value:unknown){return text(value).toLowerCase()}
function isAssignmentLike(row:Record<string,unknown>){
  const type=normalized(row.type)
  return Boolean(row.id)&&type!=='research'&&type!=='research project'&&type!=='published report'
}

export default function EvidenceDrilldown({detail,onClose,onOpenAssignment}:{detail:EvidenceDetail;onClose:()=>void;onOpenAssignment:(id:string)=>void}){
  const [query,setQuery]=useState('')
  const [status,setStatus]=useState('All')
  const [team,setTeam]=useState('All')

  const statuses=useMemo(()=>Array.from(new Set(detail.rows.map(row=>text(row.status)).filter(Boolean))).sort(),[detail.rows])
  const teams=useMemo(()=>Array.from(new Set(detail.rows.map(row=>attentionTeam(row)).filter(Boolean))).sort(),[detail.rows])
  const visible=useMemo(()=>detail.rows.filter(row=>{
    if(status!=='All'&&text(row.status)!==status)return false
    if(team!=='All'&&attentionTeam(row)!==team)return false
    if(!query.trim())return true
    const haystack=Object.entries(row).filter(([key])=>!key.endsWith('_id')).map(([,value])=>text(value)).join(' ').toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  }),[detail.rows,query,status,team])

  return <div className="institutional-detail-backdrop" role="presentation">
    <aside className="institutional-detail evidence-drilldown" onClick={event=>event.stopPropagation()} aria-label="Underlying report evidence">
      <header><div><small>TRACEABLE UNDERLYING RECORDS</small><h3>{detail.title}</h3><p>{visible.length} of {detail.rows.length} authorised record{detail.rows.length===1?'':'s'} shown</p></div><button type="button" onClick={onClose}>Close ×</button></header>
      {detail.rows.length>0&&<div className="evidence-drilldown-filters">
        <label>Search evidence<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Title, officer, status, team…"/></label>
        <label>Status<select value={status} onChange={event=>setStatus(event.target.value)}><option>All</option>{statuses.map(value=><option key={value}>{value}</option>)}</select></label>
        <label>Responsible team<select value={team} onChange={event=>setTeam(event.target.value)}><option>All</option>{teams.map(value=><option key={value}>{value}</option>)}</select></label>
        {(query||status!=='All'||team!=='All')&&<button type="button" onClick={()=>{setQuery('');setStatus('All');setTeam('All')}}>Clear filters</button>}
      </div>}
      {visible.length?<div className="evidence-drilldown-list">{visible.map((row,index)=><article key={`${text(row.id)||'record'}-${index}`}>
        <div className="evidence-record-heading"><div><small>{text(row.type)||'APP2 record'}</small><h4>{text(row.title)||text(row.name)||`Record ${index+1}`}</h4></div>{text(row.status)&&<b>{text(row.status)}</b>}</div>
        <div className="evidence-record-summary">
          <p><span>Responsible team</span><strong>{attentionTeam(row)}</strong></p>
          {Boolean(row.due_date)&&<p><span>Deadline position</span><strong>{attentionTiming(row.due_date)}</strong></p>}
        </div>
        <details><summary>View record evidence</summary>{Object.entries(row).filter(([key])=>!key.endsWith('_id')&&key!=='id'&&key!=='title'&&key!=='name'&&key!=='status').map(([key,value])=><p key={key}><span>{title(key)}</span><strong>{detailValue(key,value)}</strong></p>)}</details>
        {isAssignmentLike(row)&&<button type="button" className="evidence-open-workspace" onClick={()=>onOpenAssignment(text(row.id))}>Open assignment workspace →</button>}
      </article>)}</div>:<p className="evidence-empty">{detail.rows.length?'No authorised records match the selected evidence filters.':'No attention records are associated with this summary. Use Work Performance for the complete scoped list.'}</p>}
      <footer><strong>Scope control:</strong> this drill-down only filters records already returned by the permission-aware Reports API. It does not request or expose a wider staff or directorate scope.</footer>
    </aside>
  </div>
}
