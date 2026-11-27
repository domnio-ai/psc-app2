import {useEffect,useState} from 'react'
import {api,type ReportDefinition,type ReportSchedule,type ReportView} from '../../../api'

type Filters=Record<string,string>
export default function ReportAutomationManager({token,reports,filters}:{token:string;reports:ReportDefinition[];filters:Filters}){
  const available=reports.filter(report=>report.available)
  const [reportKey,setReportKey]=useState(available[0]?.key||'')
  const [views,setViews]=useState<ReportView[]>([]),[schedules,setSchedules]=useState<ReportSchedule[]>([])
  const [viewName,setViewName]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  const [schedule,setSchedule]=useState({name:'Management report',format:'pdf' as 'pdf'|'docx'|'xlsx',frequency:'Monthly' as 'Daily'|'Weekly'|'Monthly',recipients:'',nextRunAt:''})
  const reload=async()=>{
    if(!reportKey)return
    try{
      const [saved,allSchedules]=await Promise.all([api.reportViews(token,reportKey),api.reportSchedules(token)])
      setViews(saved.filter(view=>!view.name.startsWith('__App2 ')))
      setSchedules(allSchedules.filter(item=>item.report_key===reportKey))
      setMessage('')
    }catch(value){setMessage(value instanceof Error?value.message:'Saved views and report schedules could not be loaded.')}
  }
  useEffect(()=>{void reload()},[token,reportKey])
  const saveView=async()=>{
    if(!viewName.trim()){setMessage('Enter a name for this saved view.');return}
    setBusy(true)
    try{await api.saveReportView(token,reportKey,viewName.trim(),filters,false);setViewName('');await reload();setMessage('Saved view created.')}
    catch(value){setMessage(value instanceof Error?value.message:'Saved view could not be created.')}
    finally{setBusy(false)}
  }
  const removeView=async(view:ReportView)=>{
    setBusy(true)
    try{await api.deleteReportView(token,reportKey,view.id);await reload();setMessage('Saved view removed.')}
    catch(value){setMessage(value instanceof Error?value.message:'Saved view could not be removed.')}
    finally{setBusy(false)}
  }
  const createSchedule=async()=>{
    const recipients=schedule.recipients.split(/[;,]/).map(item=>item.trim()).filter(Boolean)
    const nextRun=new Date(schedule.nextRunAt)
    if(!schedule.name.trim()||!recipients.length||!schedule.nextRunAt||Number.isNaN(nextRun.getTime())||nextRun.getTime()<=Date.now()){setMessage('Enter a schedule name, at least one recipient, and a future run time.');return}
    setBusy(true)
    try{await api.createReportSchedule(token,{reportKey,name:schedule.name.trim(),format:schedule.format,frequency:schedule.frequency,recipientEmails:recipients,filters,nextRunAt:nextRun.toISOString()});await reload();setMessage('Report schedule created.')}
    catch(value){setMessage(value instanceof Error?value.message:'Report schedule could not be created.')}
    finally{setBusy(false)}
  }
  const toggleSchedule=async(item:ReportSchedule)=>{
    setBusy(true)
    try{await api.updateReportSchedule(token,item.id,!item.enabled);await reload();setMessage(`Schedule ${item.enabled?'paused':'enabled'}.`)}
    catch(value){setMessage(value instanceof Error?value.message:'Schedule could not be updated.')}
    finally{setBusy(false)}
  }
  const deleteSchedule=async(item:ReportSchedule)=>{
    if(!window.confirm(`Delete the “${item.name}” schedule?`))return
    setBusy(true)
    try{await api.deleteReportSchedule(token,item.id);await reload();setMessage('Report schedule deleted.')}
    catch(value){setMessage(value instanceof Error?value.message:'Report schedule could not be deleted.')}
    finally{setBusy(false)}
  }
  return <section className="report-automation-manager">
    <header><small>REPEATABLE REPORTING</small><h3>Saved views and scheduled delivery</h3><p>Manage reusable filters and scheduled exports for an available governed report.</p></header>
    <label className="report-automation-report">Report<select value={reportKey} onChange={event=>setReportKey(event.target.value)}>{available.map(report=><option value={report.key} key={report.key}>{report.title}</option>)}</select></label>
    <section className="report-automation-panel"><header><div><small>SAVED REPORT VIEWS</small><h4>Reuse the current report filters</h4></div></header><div className="saved-view-create"><input value={viewName} onChange={event=>setViewName(event.target.value)} placeholder="View name"/><button type="button" disabled={busy} onClick={()=>void saveView()}>Save current filters</button></div><div className="saved-view-list">{views.map(view=><article key={view.id}><div><strong>{view.name}</strong><small>{view.is_default?'Default view · ':''}Updated {new Date(view.updated_at).toLocaleDateString('en-KE')}</small></div><button type="button" disabled={busy} onClick={()=>void removeView(view)}>Delete</button></article>)}{!views.length&&<p>No saved views for this report.</p>}</div></section>
    <section className="report-automation-panel"><header><div><small>SCHEDULED DELIVERY</small><h4>Deliver a governed report automatically</h4><p>Scheduled runs use the schedule owner’s current authorised APP2 scope.</p></div></header><div className="schedule-create-grid"><label>Name<input value={schedule.name} onChange={event=>setSchedule({...schedule,name:event.target.value})}/></label><label>Format<select value={schedule.format} onChange={event=>setSchedule({...schedule,format:event.target.value as typeof schedule.format})}><option value="pdf">PDF</option><option value="docx">DOCX</option><option value="xlsx">XLSX</option></select></label><label>Frequency<select value={schedule.frequency} onChange={event=>setSchedule({...schedule,frequency:event.target.value as typeof schedule.frequency})}><option>Daily</option><option>Weekly</option><option>Monthly</option></select></label><label>Next run<input type="datetime-local" value={schedule.nextRunAt} onChange={event=>setSchedule({...schedule,nextRunAt:event.target.value})}/></label><label className="schedule-recipients">Recipients<input value={schedule.recipients} onChange={event=>setSchedule({...schedule,recipients:event.target.value})} placeholder="manager@example.org; director@example.org"/></label><button type="button" disabled={busy} onClick={()=>void createSchedule()}>Create schedule</button></div><div className="schedule-list-reporting">{schedules.map(item=><article key={item.id} className={item.enabled?'enabled':'paused'}><div><strong>{item.name}</strong><small>{item.frequency} · {item.format.toUpperCase()} · next {new Date(item.next_run_at).toLocaleString('en-KE')}</small><em>{item.recipient_emails.join(', ')}</em>{item.last_status&&<small>Last run: {item.last_status}{item.last_error?` · ${item.last_error}`:''}</small>}</div><span><b>{item.enabled?'Enabled':'Paused'}</b><button type="button" disabled={busy} onClick={()=>void toggleSchedule(item)}>{item.enabled?'Pause':'Enable'}</button><button type="button" className="danger-link" disabled={busy} onClick={()=>void deleteSchedule(item)}>Delete</button></span></article>)}{!schedules.length&&<p>No schedules for this report.</p>}</div></section>
    {message&&<p role="status" className="management-export-message">{message}</p>}
  </section>
}
