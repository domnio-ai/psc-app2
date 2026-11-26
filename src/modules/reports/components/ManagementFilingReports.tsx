import {useMemo,useRef,useState} from 'react'
import type {InstitutionalIntelligence} from '../../../api'
import {Bars,Donut} from './ExecutiveVisuals'
import {managementRecords} from '../utils/managementReportModel'
import '../management-filing.css'

export default function ManagementFilingReports({data,onOpenAssignment}:{data:InstitutionalIntelligence;onOpenAssignment:(id:string)=>void}) {
  const [team,setTeam]=useState(''),[person,setPerson]=useState(''),[only,setOnly]=useState('All'),[kind,setKind]=useState('All'),[sort,setSort]=useState('Urgency')
  const [reference,setReference]=useState(''),[prepared,setPrepared]=useState(''),[notes,setNotes]=useState(''),[message,setMessage]=useState('')
  const report=useRef<HTMLDivElement>(null)
  const records=useMemo(()=>managementRecords(data),[data])
  const teams=[...new Set(records.map(r=>r.team))].sort()
  const people=[...new Map(records.flatMap(r=>r.people.filter(p=>p.id).map(p=>[p.id,p] as const))).values()].sort((a,b)=>a.name.localeCompare(b.name))
  const filtered=records.filter(r=>(!team||r.team===team)&&(!person||r.people.some(p=>p.id===person))&&(kind==='All'||r.type===kind)&&(only==='All'||only==='Needs attention'&&r.alerts.length>0||r.alerts.includes(only))).sort((a,b)=>sort==='Title'?a.title.localeCompare(b.title):sort==='Team'?a.team.localeCompare(b.team)||a.title.localeCompare(b.title):sort==='Due date'?(a.due||'9999').localeCompare(b.due||'9999'):b.overdueDays-a.overdueDays||b.alerts.length-a.alerts.length||a.title.localeCompare(b.title))
  const ageing=[{label:'1–7 days overdue',value:filtered.filter(r=>r.overdueDays>=1&&r.overdueDays<=7).length},{label:'8–30 days overdue',value:filtered.filter(r=>r.overdueDays>=8&&r.overdueDays<=30).length},{label:'31+ days overdue',value:filtered.filter(r=>r.overdueDays>30).length}]
  const signals=['Overdue','Due within 7 days','Awaiting review','Revision required','No update for 30 days','Missing deadline']
  const referenceId=`APP2-${data.generatedAt.replace(/\D/g,'').slice(0,14)}`
  const visuals=<section className="filing-visual-overview" aria-label="Selected report visual summary">
      <div className="filing-kpis"><div><strong>{filtered.length}</strong>Evidence records</div><div><strong>{filtered.filter(r=>r.alerts.length).length}</strong>Need attention</div><div><strong>{filtered.filter(r=>r.overdueDays>0).length}</strong>Overdue</div><div><strong>{filtered.filter(r=>r.alerts.includes('Missing deadline')).length}</strong>Missing deadlines</div></div>
      <div className="filing-charts"><article><h2>Overdue ageing</h2><Bars rows={ageing}/></article><article><h2>Attention coverage</h2><Donut rows={[{label:'Needs attention',value:filtered.filter(r=>r.alerts.length).length},{label:'No listed alert',value:filtered.filter(r=>!r.alerts.length).length}]} centreLabel="Records"/></article><article><h2>Alert reasons</h2><Bars rows={signals.map(label=>({label,value:filtered.filter(r=>r.alerts.includes(label)).length}))}/><p>A record can have several alert reasons; these counts are not additive.</p></article></div>
  </section>
  const printReport=()=>{
    if(!report.current)return
    setMessage('')
    const frame=document.createElement('iframe');frame.title='Printable APP2 management report';frame.style.cssText='position:fixed;width:1px;height:1px;left:-10000px;border:0';document.body.appendChild(frame)
    const doc=frame.contentDocument,win=frame.contentWindow
    if(!doc||!win){frame.remove();setMessage('Print preview could not open. Please retry.');return}
    doc.title=reference.trim()||referenceId
    const style=doc.createElement('style')
    style.textContent='@page{size:A4 landscape;margin:14mm}body{font:11px Arial,sans-serif;color:#172b26}h1{font-size:23px}h2{font-size:16px;margin-top:22px}h3{font-size:13px}p{line-height:1.5}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #aaa;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}.filing-no-print{display:none!important}.filing-print-visuals{display:block!important}.filing-kpis{display:flex;gap:25px}.filing-kpis strong{font-size:22px;display:block}.filing-charts{display:flex;gap:24px}.filing-charts article{width:48%;break-inside:avoid}.institutional-bars button{display:flex;align-items:center;width:100%;border:0;background:white;padding:6px;color:#172b26}.institutional-bars span{width:150px;text-align:left}.institutional-bars i{flex:1;background:#eee;height:12px}.institutional-bars b{display:block;height:12px;background:#9d792f;print-color-adjust:exact}.institutional-bars strong{width:30px}.institutional-donut{max-width:240px}.donut-track{stroke:#eee}.donut-slice.slice-0{stroke:#9d792f}.donut-slice.slice-1{stroke:#285846}.donut-legend button{display:flex;gap:10px;background:white;border:0;color:#172b26}.donut-figure{position:relative;width:150px}.donut-figure>div{text-align:center}.donut-legend i{display:none}svg{max-width:180px;max-height:180px}.filing-signatures{display:flex;justify-content:space-between;margin-top:35px}.filing-note{border-left:3px solid #9d792f;padding-left:12px}.filing-notes{white-space:pre-wrap}button{font:inherit}footer{margin-top:22px;border-top:1px solid #aaa;padding-top:10px}'
    doc.head.appendChild(style)
    // Clone React-rendered text nodes; user notes never become executable markup.
    doc.body.appendChild(report.current.cloneNode(true))
    win.addEventListener('afterprint',()=>frame.remove(),{once:true})
    win.requestAnimationFrame(()=>{win.focus();win.print()})
  }
  return <section className="management-filing">
    <header><small>MANAGEMENT REPORTS</small><h2>Alerts, team follow-up & manual filing</h2><p>Choose the evidence to review, inspect the report below, then print it or save it as PDF through your browser.</p></header>
    <div className="filing-controls">
      <label>Report focus<select value={kind} onChange={e=>setKind(e.target.value)}><option>All</option><option>Assignment</option><option>Research</option></select></label>
      <label>Team<select value={team} onChange={e=>{setTeam(e.target.value);setPerson('')}}><option value="">All visible teams</option>{teams.map(t=><option key={t}>{t}</option>)}</select></label>
      {data.capabilities.people&&<label>Individual<select value={person} onChange={e=>setPerson(e.target.value)}><option value="">All visible people</option>{people.filter(p=>!team||records.some(r=>r.team===team&&r.people.some(x=>x.id===p.id))).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      <label>Show only<select value={only} onChange={e=>setOnly(e.target.value)}>{['All','Needs attention',...signals].map(s=><option key={s}>{s}</option>)}</select></label>
      <label>Sort by<select value={sort} onChange={e=>setSort(e.target.value)}>{['Urgency','Due date','Team','Title'].map(s=><option key={s}>{s}</option>)}</select></label>
      <button type="button" onClick={()=>{setTeam('');setPerson('');setOnly('All');setKind('All');setSort('Urgency')}}>Reset report filters</button>
    </div>
    {visuals}
    <h2 className="filing-details-heading">Prepare your printed report</h2>
    <div className="filing-controls"><label>File reference<input value={reference} onChange={e=>setReference(e.target.value)} placeholder={referenceId} maxLength={100}/></label><label>Prepared by<input value={prepared} onChange={e=>setPrepared(e.target.value)} placeholder="Name / designation" maxLength={120}/></label><label className="filing-note-input">Meeting decisions / agreed follow-up<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Record agreed action, responsible officer and follow-up date for the printed copy." maxLength={6000}/></label></div>
    <p>These filing notes are for this printout and are not saved to the system action log. Use the existing management action tracking section for persistent follow-up.</p>
    <button className="filing-print" type="button" onClick={printReport}>Print actual report / Save PDF</button>{message&&<p role="alert">{message}</p>}
    <div ref={report} className="filing-paper">
      <header><small>APP2 · RESEARCH DEPARTMENT SYSTEM</small><h1>Management follow-up report</h1><p><strong>File reference:</strong> {reference.trim()||referenceId} · <strong>Prepared by:</strong> {prepared.trim()||'____________________'}</p><p><strong>Data as of:</strong> {new Date(data.generatedAt).toLocaleString('en-KE',{timeZone:'Africa/Nairobi'})} EAT · <strong>Period:</strong> {data.filters.from||'Open start'} to {data.filters.to||'Open end'}<br/><strong>Authorised scope:</strong> {data.scope.type.replaceAll('_',' ')} · <strong>Applied source filters:</strong> {data.filters.workType} / {data.filters.status}<br/><strong>Report selection:</strong> {kind} · {team||'All visible teams'} · {people.find(p=>p.id===person)?.name||'All visible people'} · {only} · Sorted by {sort}</p></header>
      <p className="filing-note"><strong>Coverage:</strong> This report contains {filtered.length} selected evidence records from {data.overview.records.length} loaded assignments (maximum 100) and {data.attention.filter(r=>r.type==='Research').length} research attention records (maximum 25). The source portfolio contains {data.basis.assignments} assignments and {data.basis.research} research records. Research here is an attention list, not the complete research register. Individual associations use recorded team membership or research roles, not sole ownership. Missing associations do not prove that work is unassigned.</p>
      <div className="filing-print-visuals">{visuals}</div>
      <h2>Management reading guide</h2><p>Start with overdue work and review delays. Confirm the blocker with the relevant officer, agree the next deliverable and a realistic recovery date, then check progress at the next team meeting. A missing update is a request for evidence, not proof of inactivity. Shared assignments may involve several people; this report does not calculate staff performance scores.</p>
      <h2>Evidence and recommended follow-up</h2>
      <div className="filing-table-wrap"><table><thead><tr><th>Work / evidence</th><th>Team / people</th><th>Status / deadline</th><th>Alerts</th><th>Recommended next action</th></tr></thead><tbody>{filtered.map(r=><tr key={`${r.type}:${r.id}`}><td><strong>{r.title}</strong><br/>{r.type}<br/><small>{r.id}</small>{r.type==='Assignment'&&<button className="filing-no-print" type="button" onClick={()=>onOpenAssignment(r.id)}>Open assignment</button>}</td><td>{r.team}<br/>{r.people.length?r.people.map(p=><div key={`${p.id}:${p.role}`}>{p.name} <small>({p.role})</small></div>):'Individual association unavailable'}</td><td>{r.status}<br/>Due: {r.due||'Not recorded'}{r.overdueDays>0&&<strong> · {r.overdueDays} days overdue</strong>}</td><td>{r.alerts.join(' · ')||'No listed alert'}</td><td>{r.action}</td></tr>)}{!filtered.length&&<tr><td colSpan={5}>No evidence records match this selection. Widen the filters or apply a different reporting period.</td></tr>}</tbody></table></div>
      <h2>Agreed actions and meeting notes</h2><p className="filing-notes">{notes.trim()||'Action / responsible officer / agreed due date / follow-up outcome: ____________________________________________'}</p>
      <div className="filing-signatures"><span>Prepared / signed: __________________</span><span>Reviewed by: __________________</span><span>Date filed: __________________</span></div>
      <footer>Management working report · Approval signatures are completed manually; this printout does not approve underlying work. Alerts are evaluated at the displayed snapshot date in Africa/Nairobi: overdue means before that date; due soon means today through seven days; stale means 30 days since a recorded update. Refresh the report after actions to obtain a new snapshot.</footer>
    </div>
  </section>
}

