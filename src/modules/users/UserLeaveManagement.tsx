import {useEffect,useMemo,useState} from "react";
import {api,type ApiUser,type LeaveBalance,type LeaveRequest,type LeaveType} from "../../api";
import "./user-leave-management.css";

export default function UserLeaveManagement({token,currentUser,users,isManager,onUsersRefresh,mode="leave",onOpenApprovalCentre}:{token:string;currentUser:{id:string};users:ApiUser[];isManager:boolean;onUsersRefresh:()=>Promise<void>|void;mode?:"leave"|"approvals";onOpenApprovalCentre?:()=>void}){
 const [types,setTypes]=useState<LeaveType[]>([]),[rows,setRows]=useState<LeaveRequest[]>([]),[balances,setBalances]=useState<LeaveBalance[]>([]);
 const [notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [form,setForm]=useState({leaveTypeCode:"ANNUAL",startDate:"",endDate:"",reason:""});
 const refresh=async()=>{const [t,r,b]=await Promise.all([api.leaveTypes(token),api.leaveRequests(token),api.leaveBalances(token,currentUser.id)]);setTypes(t);setRows(r);setBalances(b)};
 useEffect(()=>{if(mode!=="leave")return;void refresh().catch(e=>setNotice(e instanceof Error?e.message:"Leave data could not be loaded."))},[token,currentUser.id,mode]);
 const mine=useMemo(()=>rows.filter(r=>r.user_id===currentUser.id),[rows,currentUser.id]),onLeave=users.filter(u=>u.availability_status==="On Leave");







 const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);try{await api.submitLeaveRequest(token,form);setForm({leaveTypeCode:"ANNUAL",startDate:"",endDate:"",reason:""});setNotice("Leave request submitted.");await refresh();await onUsersRefresh()}catch(err){setNotice(err instanceof Error?err.message:"Leave request failed.")}finally{setBusy(false)}};

 return <section className="leave-management"><header><div><p>{mode==="approvals"?"LEAVE APPROVALS":"MY LEAVE"}</p><h3>{mode==="approvals"?"Team Approvals":"Leave balances, requests and history"}</h3><span>{mode==="approvals"?"Review requests inside your authorised reporting scope.":"Approved leave updates availability and appears on Calendar automatically."}</span></div></header>
 {notice&&<div className="leave-notice">{notice}</div>}
 {mode==="leave"&&<><div className="leave-summary"><article><span>On leave now</span><strong>{onLeave.length}</strong><small>{onLeave.length?onLeave.map(u=>u.name).slice(0,3).join(", "):"No current absences"}</small></article><article><span>My pending</span><strong>{mine.filter(r=>r.status==="Pending").length}</strong><small>Awaiting manager decision</small></article><article><span>My approved/used</span><strong>{mine.filter(r=>r.status==="Approved").length}</strong><small>Approved leave requests</small></article></div><div className="leave-balances">{balances.filter(b=>b.entitlement_days!==null).map(b=><article key={b.code}><span>{b.name}</span><strong>{b.remaining_days??"—"}</strong><small>{b.used_days} used · {b.entitlement_days} entitlement</small></article>)}</div><div className="leave-columns"><form onSubmit={submit}><h4>Request leave</h4><label>Leave type<select value={form.leaveTypeCode} onChange={e=>setForm({...form,leaveTypeCode:e.target.value})}>{types.map(t=><option key={t.code} value={t.code}>{t.name}</option>)}</select></label><div className="leave-dates"><label>Start<input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})} required/></label><label>End<input type="date" min={form.startDate} value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})} required/></label></div><label>Reason / handover note<textarea value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></label><small>Working days exclude weekends. Policy values remain configurable.</small><button disabled={busy}>Submit request</button></form><section className="leave-history"><h4>My leave history</h4>{mine.length?mine.map(r=><article key={r.id}><div><strong>{r.leave_type_name}</strong><span>{r.start_date} → {r.end_date} · {r.working_days} working days</span><small>{r.decision_note||r.reason||"No note"}</small></div><b>{r.status}</b>{["Pending","Approved","Returned"].includes(r.status)&&<button type="button" disabled={busy} onClick={async()=>{await api.cancelLeaveRequest(token,r.id);await refresh();await onUsersRefresh()}}>Cancel</button>}</article>):<p>No leave requests yet.</p>}</section></div></>} {mode==="approvals"&&isManager&&<section className="leave-approvals">
  <div className="leave-approval-empty">
   <strong>Leave decisions are managed centrally</strong>
   <span>Open Reviews &amp; Approvals for the single actionable queue, decision status and shared notifications.</span>
   <button type="button" onClick={()=>onOpenApprovalCentre?.()}>Open Reviews &amp; Approvals</button>
  </div>
 </section>}
 </section>
}