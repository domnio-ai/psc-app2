import { useCallback, useEffect, useState } from "react";
import { meetingsApi } from "./meetingsApi";
import type { MeetingApprovalAppointment, MeetingUser } from "./types";
import "./meeting-approval-appointments.css";

type Props = {
  token: string;
  currentUser: { id: string; name: string; role: string };
  promptSelfAppointment?: boolean;
  onAppointmentSaved?: () => void | Promise<void>;
};
const todayNairobiDate = () => {
  const parts = new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (name: string) => parts.find(item => item.type === name)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export default function MeetingScheduleApprovalAppointments({ token, currentUser, promptSelfAppointment = false, onAppointmentSaved }: Props) {
  const [subjects, setSubjects] = useState<MeetingUser[]>([]);
  const [directory, setDirectory] = useState<MeetingUser[]>([]);
  const [appointments, setAppointments] = useState<MeetingApprovalAppointment[]>([]);
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [approverId, setApproverId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const [staffResult, usersResult, appointmentsResult] = await Promise.allSettled([
      meetingsApi.delegableUsers(token), meetingsApi.users(token), meetingsApi.approvalAppointments(token),
    ]);
    const users = usersResult.status === "fulfilled" ? usersResult.value : [];
    const fetchedStaff = staffResult.status === "fulfilled" ? staffResult.value : [];
    const staff = currentUser.role === "System Admin" && !fetchedStaff.some(person => person.id === currentUser.id)
      ? [{ id: currentUser.id, name: currentUser.name, role: currentUser.role }, ...fetchedStaff]
      : fetchedStaff;
    setSubjects(staff);
    setDirectory(users);
    setAppointments(appointmentsResult.status === "fulfilled" ? appointmentsResult.value : []);
    const defaultSubjectId = currentUser.role === "System Admin" && staff.some(person => person.id === currentUser.id)
      ? currentUser.id
      : staff[0]?.id || "";
    setSubjectId(current => current || defaultSubjectId);
    setApproverId(current => current || users.find(person => person.id !== defaultSubjectId)?.id || "");
    const failures = [staffResult, usersResult, appointmentsResult]
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map(result => result.reason instanceof Error ? result.reason.message : "An approver setup request failed.");
    setNotice(failures.length ? `Some approver setup data could not be loaded: ${failures.join(" ")}` : "");
  }, [token, currentUser.id, currentUser.name, currentUser.role]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (subjects.length === 0 && currentUser.role !== "System Admin") return null;
  const appoint = async () => {
    if (!subjectId || !approverId || !expiresAt) { setNotice("Choose the staff member, approver and expiry date."); return; }
    setBusy(true); setNotice("");
    try {
      const expiry = new Date(`${expiresAt}T23:59:59+03:00`);
      await meetingsApi.appointApprovalDelegate(token, subjectId, approverId, expiry.toISOString(), reason);
      setNotice("Appointed approver saved. Refreshing the meeting approver list…"); setApproverId(""); setReason(""); await refresh(); await onAppointmentSaved?.();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Approver appointment failed."); }
    finally { setBusy(false); }
  };
  const revoke = async (row: MeetingApprovalAppointment) => {
    setBusy(true); setNotice("");
    try { await meetingsApi.revokeApprovalDelegate(token, row.id); setNotice("Approver appointment revoked."); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Appointment could not be revoked."); }
    finally { setBusy(false); }
  };
  return <>
    <button type="button" className="meeting-approval-appointments-trigger" onClick={() => { setOpen(true); void refresh(); }}>Manage approver appointments</button>
    {promptSelfAppointment && <button type="button" className="meeting-approval-self-setup" onClick={() => { setSubjectId(currentUser.id); setOpen(true); void refresh(); }}>Set my meeting approver</button>}
    {open && <div className="meeting-schedule-backdrop meeting-approval-appointments-backdrop" onMouseDown={() => setOpen(false)}><section className="meeting-approval-appointments" role="dialog" aria-modal="true" aria-label="Manage meeting approval appointments" onMouseDown={event => event.stopPropagation()}>
      <header><div><small>CONTROLLED DELEGATION</small><h3>Appointed Meeting Approvers</h3><p>Appointments are scoped to a staff member and expire. Only their direct supervisor or System Admin can create/revoke them. A different active user must review a System Admin’s meeting request; self-approval is not allowed.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close">×</button></header>
      {notice && <div className="meeting-approval-appointments-notice" role="status">{notice}</div>}
      <div className="meeting-approval-appointments-form">
        {directory.length===0&&<small role="alert">No active users are available for selection. Without another active account, an approver cannot be appointed and an admin cannot approve their own request. {notice || "Refresh to retry loading the directory, or ask an administrator to restore active user access."}</small>}
        <label>Staff member<select value={subjectId} onChange={event => {const nextId=event.target.value;setSubjectId(nextId);setApproverId(directory.find(person=>person.id!==nextId)?.id||"");}}>{subjects.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <label>Appointed approver<select required value={approverId} onChange={event => setApproverId(event.target.value)}><option value="">Choose active user</option>{directory.filter(person => person.id !== subjectId).map(person => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}</select>{directory.length===1&&directory[0]?.id===subjectId&&<small role="alert">There is no other active user. Self-approval is prohibited, so ask an administrator to activate another account.</small>}</label>
        <label>Valid through (local date)<input type="date" required className="meeting-approval-appointment-date" value={expiresAt} min={todayNairobiDate()} onChange={event => setExpiresAt(event.target.value)} /><small>Required. The appointment needs an expiry date and cannot run longer than 12 months.</small>{!expiresAt&&<small role="alert">Choose an expiry date before the appointment can be saved.</small>}</label>
        <label>Reason (optional)<input value={reason} maxLength={600} onChange={event => setReason(event.target.value)} placeholder="Acting supervisor, leave cover, temporary delegation" /></label>
        <button type="button" disabled={busy || !subjectId || !approverId || !expiresAt} title={!subjectId||!approverId||!expiresAt?"Choose a staff member, a different active approver and an expiry date.":undefined} onClick={() => void appoint()}>Appoint approver</button>
      </div>
      <div className="meeting-approval-appointments-list"><strong>Existing appointments</strong>{appointments.filter(row => subjects.some(person => person.id === row.subject_user_id) && !row.revoked_at && new Date(row.expires_at).getTime() > Date.now()).map(row => <article key={row.id}><span><b>{row.subject_name}</b><small>Approver: {row.approver_name} · Expires {new Date(row.expires_at).toLocaleDateString()}</small></span><button type="button" disabled={busy} onClick={() => void revoke(row)}>Revoke</button></article>)}{appointments.filter(row => subjects.some(person => person.id === row.subject_user_id) && !row.revoked_at && new Date(row.expires_at).getTime() > Date.now()).length === 0 && <p>No active appointments in your scope.</p>}</div>
    </section></div>}
  </>;
}
