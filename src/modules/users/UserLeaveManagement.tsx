import {useEffect,useMemo,useState,type FormEvent} from "react";
import {api,type ApiUser,type LeaveBalance,type LeaveRequest,type LeaveType,type PublicHoliday} from "../../api";
import "./user-leave-management.css";

export default function UserLeaveManagement({token,currentUser,users,isManager,onUsersRefresh,mode="leave",onOpenApprovalCentre,canManagePublicHolidays=false}:{token:string;currentUser:{id:string};users:ApiUser[];isManager:boolean;onUsersRefresh:()=>Promise<void>|void;mode?:"leave"|"approvals";onOpenApprovalCentre?:()=>void;canManagePublicHolidays?:boolean}){
 const [types,setTypes]=useState<LeaveType[]>([]),[rows,setRows]=useState<LeaveRequest[]>([]),[balances,setBalances]=useState<LeaveBalance[]>([]),[holidays,setHolidays]=useState<PublicHoliday[]>([]);
 const [holidayForm,setHolidayForm]=useState({holidayDate:"",name:"",description:""}),[editingHolidayId,setEditingHolidayId]=useState<string|null>(null);
 const [notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[supportingDocument,setSupportingDocument]=useState<File|null>(null);
 const [form,setForm]=useState({leaveTypeCode:"ANNUAL",startDate:"",endDate:"",reason:""});
 const refresh=async()=>{const [t,r,b,h]=await Promise.all([api.leaveTypes(token),api.leaveRequests(token),api.leaveBalances(token,currentUser.id),api.publicHolidays(token)]);setTypes(t);setRows(r);setBalances(b);setHolidays(h)};
 const selectedType=types.find(t=>t.code===form.leaveTypeCode);
 const submitHoliday=async(event:FormEvent)=>{
  event.preventDefault();setBusy(true);
  try{
   if(editingHolidayId)await api.updatePublicHoliday(token,editingHolidayId,holidayForm);
   else await api.createPublicHoliday(token,holidayForm);
   setHolidayForm({holidayDate:"",name:"",description:""});setEditingHolidayId(null);
   setNotice(editingHolidayId?"Public-holiday record updated.":"Public holiday added to the institutional calendar.");
   await refresh();
  }catch(error){setNotice(error instanceof Error?error.message:"Public-holiday record could not be saved.");}
  finally{setBusy(false)}
 };
 const editHoliday=(holiday:PublicHoliday)=>{
  setEditingHolidayId(holiday.id);
  setHolidayForm({holidayDate:holiday.holiday_date,name:holiday.name,description:holiday.description||""});
 };
 const toggleHoliday=async(holiday:PublicHoliday)=>{
  setBusy(true);
  try{await api.updatePublicHoliday(token,holiday.id,{active:!holiday.active});setNotice(holiday.active?"Public holiday deactivated.":"Public holiday restored.");await refresh()}
  catch(error){setNotice(error instanceof Error?error.message:"Holiday status could not be changed.")}
  finally{setBusy(false)}
 };
 useEffect(()=>{if(mode!=="leave")return;void refresh().catch(e=>setNotice(e instanceof Error?e.message:"Leave data could not be loaded."))},[token,currentUser.id,mode]);
 const mine=useMemo(()=>rows.filter(r=>r.user_id===currentUser.id),[rows,currentUser.id]),onLeave=users.filter(u=>u.availability_status==="On Leave");







 const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);try{await api.submitLeaveRequest(token,form,supportingDocument||undefined);setForm({leaveTypeCode:"ANNUAL",startDate:"",endDate:"",reason:""});setSupportingDocument(null);setNotice("Leave request submitted.");await refresh();await onUsersRefresh()}catch(err){setNotice(err instanceof Error?err.message:"Leave request failed.")}finally{setBusy(false)}};

 return <section className="leave-management"><header><div><p>{mode==="approvals"?"LEAVE APPROVALS":"MY LEAVE"}</p><h3>{mode==="approvals"?"Team Approvals":"Leave balances, requests and history"}</h3><span>{mode==="approvals"?"Review requests inside your authorised reporting scope.":"Approved leave updates availability and appears on Calendar automatically."}</span></div></header>
 {notice&&<div className="leave-notice">{notice}</div>}
 {mode==="leave"&&<>{canManagePublicHolidays&&<section className="public-holiday-admin">
  <header><div><p>INSTITUTIONAL CALENDAR</p><h4>Public holiday register</h4><span>Only enter dates confirmed by approved institutional policy. No official holidays are preloaded.</span></div></header>
  <form onSubmit={submitHoliday} className="public-holiday-form">
   <label>Holiday date<input type="date" value={holidayForm.holidayDate} onChange={event=>setHolidayForm(current=>({...current,holidayDate:event.target.value}))} required/></label>
   <label>Holiday name<input value={holidayForm.name} maxLength={200} onChange={event=>setHolidayForm(current=>({...current,name:event.target.value}))} minLength={3} required/></label>
   <label>Description / policy reference<input value={holidayForm.description} maxLength={1000} onChange={event=>setHolidayForm(current=>({...current,description:event.target.value}))}/></label>
   <div><button disabled={busy}>{editingHolidayId?"Save changes":"Add public holiday"}</button>{editingHolidayId&&<button type="button" disabled={busy} onClick={()=>{setEditingHolidayId(null);setHolidayForm({holidayDate:"",name:"",description:""})}}>Cancel edit</button>}</div>
  </form>
  <div className="public-holiday-list">{holidays.length?holidays.map(holiday=><article key={holiday.id} className={holiday.active?"":"is-inactive"}>
   <div><strong>{holiday.name}</strong><span>{holiday.holiday_date}</span><small>{holiday.description||"No description"}</small></div>
   <div><b>{holiday.active?"Active":"Inactive"}</b><button type="button" disabled={busy} onClick={()=>editHoliday(holiday)}>Edit</button><button type="button" disabled={busy} onClick={()=>void toggleHoliday(holiday)}>{holiday.active?"Deactivate":"Restore"}</button></div>
  </article>):<p>No public holidays have been registered.</p>}</div>
 </section>}<div className="leave-summary"><article><span>On leave now</span><strong>{onLeave.length}</strong><small>{onLeave.length?onLeave.map(u=>u.name).slice(0,3).join(", "):"No current absences"}</small></article><article><span>My pending</span><strong>{mine.filter(r=>r.status==="Pending").length}</strong><small>Awaiting manager decision</small></article><article><span>My approved/used</span><strong>{mine.filter(r=>r.status==="Approved").length}</strong><small>Approved leave requests</small></article></div><div className="leave-balances">{balances.filter(b=>b.entitlement_days!==null).map(b=><article key={b.code}><span>{b.name}</span><strong>{b.remaining_days??"—"}</strong><small>{b.used_days} used · {b.entitlement_days} entitlement</small></article>)}</div><div className="leave-columns"><form onSubmit={submit}><h4>Request leave</h4><label>Leave type<select value={form.leaveTypeCode} onChange={e=>setForm({...form,leaveTypeCode:e.target.value})}>{types.map(t=><option key={t.code} value={t.code}>{t.name}</option>)}</select></label><div className="leave-dates"><label>Start<input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})} required/></label><label>End<input type="date" min={form.startDate} value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})} required/></label></div><label>Reason / handover note<textarea value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></label><label>Supporting document {selectedType?.requires_document&&<strong aria-label="required"> (required)</strong>}<input type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" required={Boolean(selectedType?.requires_document)} onChange={e=>setSupportingDocument(e.target.files?.[0]||null)}/></label><small>{selectedType?.requires_document?"A supporting document is mandatory for this leave type. Accepted formats: PDF, DOCX, TXT or MD.":"Attach a supporting document if relevant. Accepted formats: PDF, DOCX, TXT or MD."} Working days exclude weekends.</small><button disabled={busy}>Submit request</button></form><section className="leave-history"><h4>My leave history</h4>{mine.length?mine.map(r=><article key={r.id}><div><strong>{r.leave_type_name}</strong><span>{r.start_date} → {r.end_date} · {r.calculated_working_days??r.working_days} working days</span><small>{r.decision_note||r.reason||"No note"}</small></div><b>{r.status}</b>{r.has_attachment&&<button type="button" disabled={busy} onClick={()=>void api.downloadLeaveAttachment(token,r.id).catch(err=>setNotice(err instanceof Error?err.message:"Document download failed."))}>Download document</button>}{["Pending","Approved","Returned"].includes(r.status)&&<button type="button" disabled={busy} onClick={async()=>{await api.cancelLeaveRequest(token,r.id);await refresh();await onUsersRefresh()}}>Cancel</button>}</article>):<p>No leave requests yet.</p>}</section></div></>} {mode==="approvals"&&isManager&&<section className="leave-approvals">
  <div className="leave-approval-empty">
   <strong>Leave decisions are managed centrally</strong>
   <span>Open Reviews &amp; Approvals for the single actionable queue, decision status and shared notifications.</span>
   <button type="button" onClick={()=>onOpenApprovalCentre?.()}>Open Reviews &amp; Approvals</button>
  </div>
 </section>}
 </section>
}