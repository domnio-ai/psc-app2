import { useCallback, useEffect, useState } from "react";
import { meetingsApi } from "../meetings/meetingsApi";
import type { MeetingDetail, MeetingScheduleApprovalItem } from "../meetings/types";
import WorkflowNextActionDialog from "../../components/WorkflowNextActionDialog";
import "../../components/workflow-next-action.css";
import "./meeting-schedule-approval-queue.css";

type Props = { token: string; onDecisionComplete: () => void | Promise<void>; onPendingCountChange?: (count: number) => void };

const displayTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }) : "Not supplied";

export default function MeetingScheduleApprovalQueue({ token, onDecisionComplete, onPendingCountChange }: Props) {
  const [items, setItems] = useState<MeetingScheduleApprovalItem[]>([]);
  const [details, setDetails] = useState<Record<string, MeetingDetail>>({});
  const [detailBusyId, setDetailBusyId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [decisionResult,setDecisionResult]=useState<{title:string;outcome:string;nextAction:string}|null>(null);
  const toggleFullRecord = async (item: MeetingScheduleApprovalItem) => {
    if (details[item.id]) { setDetails(current => { const next = { ...current }; delete next[item.id]; return next; }); return; }
    setDetailBusyId(item.id); setError("");
    try { const detail = await meetingsApi.detail(token, item.id); setDetails(current => ({ ...current, [item.id]: detail })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Meeting record could not be opened."); }
    finally { setDetailBusyId(null); }
  };
  const refresh = useCallback(async () => {
    try { const rows = await meetingsApi.pendingScheduleApprovals(token); setItems(rows); onPendingCountChange?.(rows.length); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Meeting approval queue could not be loaded."); }
  }, [token, onPendingCountChange]);
  useEffect(() => { void refresh(); }, [refresh]);
  const decide = async (item: MeetingScheduleApprovalItem, decision: "Approved" | "Returned" | "Rejected") => {
    setBusyId(item.id); setError("");
    try {
      await meetingsApi.decideScheduleApproval(token, item.id, decision, comments[item.id] || "");
      setDecisionResult({title:decision==="Approved"?"Meeting approved":decision==="Returned"?"Meeting returned for revision":"Meeting schedule rejected",outcome:`Decision recorded for “${item.title}”. ${decision==="Approved"?"The requester has been notified and invitations will be sent.":"The requester has been notified with your comments."}`,nextAction:decision==="Approved"?"No further schedule approval is required. The meeting is approved and its invitations can proceed.":decision==="Returned"?"The meeting requester must update the schedule using your comments and resubmit it for approval.":"The request is closed. The requester must create a new request if the meeting is still needed."});
      await refresh(); await onDecisionComplete();
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Meeting schedule decision failed."); }
    finally { setBusyId(null); }
  };
  return <section className={`meeting-schedule-approval-queue ${items.length === 0 ? "is-empty" : "has-pending"}`} aria-label="Meeting schedule approvals">
    {decisionResult&&<WorkflowNextActionDialog {...decisionResult} onClose={()=>setDecisionResult(null)}/>}
    <header><div><p>MEETING GOVERNANCE</p><h3>Meeting Schedule Approvals</h3><span>Approve a proposed schedule before it is published to Calendar or invitations are sent.</span></div><b>{items.length}</b></header>
    {error && <div className="meeting-schedule-approval-error" role="alert">{error}</div>}
    {items.length === 0 ? <div className="meeting-schedule-approval-empty">No meeting schedules are waiting for your decision.</div> : items.map(item => <article key={item.id} className="meeting-schedule-approval-item">
      <div className="meeting-schedule-approval-item-main"><small>{item.meeting_type} · Requested by {item.created_by_name}</small><strong>{item.title}</strong><span>{displayTime(item.start_at)} — {displayTime(item.end_at)} · {item.venue || "Online"}</span>{item.meeting_link && <a href={item.meeting_link} target="_blank" rel="noreferrer">Preview online join link</a>}{item.description && <p>{item.description}</p>}{(item.resource_links || []).map((link, index) => <a key={`${item.id}-${index}`} href={link} target="_blank" rel="noreferrer">Supporting link {index + 1}</a>)}<button type="button" className="meeting-schedule-approval-open-record" disabled={detailBusyId === item.id} onClick={() => void toggleFullRecord(item)}>{detailBusyId === item.id ? "Opening record…" : details[item.id] ? "Hide full meeting record" : "Open full meeting record"}</button></div>
      {details[item.id] && <section className="meeting-schedule-approval-full-record"><div><strong>Governed record</strong><span>Chair: {details[item.id].chair_name || details[item.id].created_by_name} · Secretary: {details[item.id].secretary_name || "Not assigned"} · Minutes reviewer: {details[item.id].reviewer_name || "Not assigned"}</span></div><div><strong>Agenda ({details[item.id].agenda.length})</strong>{details[item.id].agenda.length ? details[item.id].agenda.map(agenda => <article key={agenda.id}><b>{agenda.item_no}. {agenda.title}</b>{agenda.background && <span>{agenda.background}</span>}</article>) : <span>No agenda items have been recorded.</span>}</div><div><strong>Participants ({details[item.id].participants.length})</strong>{details[item.id].participants.length ? details[item.id].participants.map(person => <span key={person.id}>{person.user_name || person.guest_name || "Guest"} · {person.participant_role} · {person.response_status}</span>) : <span>No participants have been recorded.</span>}</div></section>}
      <label>Decision comments (required when returning or rejecting)<textarea value={comments[item.id] || ""} onChange={event => setComments(current => ({ ...current, [item.id]: event.target.value }))} rows={2} maxLength={2000} />{!(comments[item.id] || "").trim()&&<small>Enter comments to explain a return or rejection to the meeting requester.</small>}</label>
      <div className="meeting-schedule-approval-actions"><button type="button" disabled={busyId === item.id} onClick={() => void decide(item, "Approved")}>{busyId === item.id ? "Saving…" : "Approve schedule"}</button><button type="button" title={!(comments[item.id] || "").trim()?"Comments are required to explain requested changes.":undefined} disabled={busyId === item.id || !(comments[item.id] || "").trim()} onClick={() => void decide(item, "Returned")}>Return for revision</button><button type="button" title={!(comments[item.id] || "").trim()?"Comments are required to explain the rejection.":undefined} disabled={busyId === item.id || !(comments[item.id] || "").trim()} onClick={() => void decide(item, "Rejected")}>Reject</button></div>
    </article>)}
  </section>;
}
