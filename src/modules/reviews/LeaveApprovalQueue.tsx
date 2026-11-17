import { useEffect, useMemo, useState } from "react";
import { api, type LeaveRequest } from "../../api";
import WorkflowNextActionDialog from "../../components/WorkflowNextActionDialog";
import "../../components/workflow-next-action.css";
import "./leave-approval-queue.css";

type Props = {
  token: string;
  currentUserId: string;
  isManager: boolean;
  onDecisionComplete: () => void | Promise<void>;
  onPendingCountChange: (count: number) => void;
};

export default function LeaveApprovalQueue({
  token,
  currentUserId,
  isManager,
  onDecisionComplete,
  onPendingCountChange,
}: Props) {
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decisionResult, setDecisionResult] = useState<{title:string;outcome:string;nextAction:string}|null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!isManager) {
      setRows([]);
      setLoading(false);
      setLoadError("");
      return () => { cancelled = true; };
    }

    setLoading(true);
    setLoadError("");
    void api.leaveRequests(token)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Leave requests could not be loaded.");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [token, isManager]);

  const pending = useMemo(
    () => isManager ? rows.filter((row) => row.status === "Pending" && row.user_id !== currentUserId) : [],
    [currentUserId, isManager, rows],
  );

  useEffect(() => {
    onPendingCountChange(pending.length);
  }, [onPendingCountChange, pending.length]);
  const history = useMemo(
    () => rows
      .filter((row) => row.user_id !== currentUserId && ["Approved", "Returned", "Rejected"].includes(row.status))
      .sort((a, b) => (b.decided_at || b.submitted_at || "").localeCompare(a.decided_at || a.submitted_at || ""))
      .slice(0, 6),
    [currentUserId, rows],
  );

  const decide = async (row: LeaveRequest, decision: "Approved" | "Returned" | "Rejected") => {
    if (busyId) return;
    setBusyId(row.id);
    setNotice("");
    try {
      await api.decideLeaveRequest(token, row.id, decision, notes[row.id] || "");
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: decision } : item));
      setNotes((current) => ({ ...current, [row.id]: "" }));
      setNotice(`${row.leave_type_name || "Leave request"}: ${decision}.`);
      setDecisionResult({
        title: `${row.leave_type_name || "Leave request"} ${decision.toLowerCase()}`,
        outcome: `Your decision was recorded. The requester, ${row.user_name || "the staff member"}, has been notified.`,
        nextAction: decision === "Approved"
          ? "No further approval action is required. The approved leave is now recorded."
          : decision === "Returned"
            ? "The requester must update the request using your note and submit it again."
            : "The request is closed. The requester may submit a new request if the dates or circumstances change.",
      });

      // Keep the decision success visible even if a secondary refresh fails.
      void api.leaveRequests(token).then(setRows).catch(() => undefined);
      void Promise.resolve().then(onDecisionComplete).catch(() => undefined);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Leave decision failed.");
    } finally {
      setBusyId(null);
    }
  };

  if (!isManager) return null;

  return (
    <section className="universal-leave-queue reviews-workspace-card">
      {decisionResult && <WorkflowNextActionDialog {...decisionResult} onClose={() => setDecisionResult(null)} />}
      <header>
        <div>
          <p>UNIVERSAL APPROVAL QUEUE</p>
          <h3>Leave requests awaiting my decision</h3>
        </div>
        <b>{pending.length}</b>
      </header>

      {notice && <p className="universal-leave-queue__notice" role="status">{notice}</p>}
      {loadError && <p className="universal-leave-queue__error" role="alert">{loadError}</p>}

      {loading ? (
        <div className="reviews-workspace-empty"><strong>Loading leave requests…</strong></div>
      ) : (
        <div className="universal-leave-queue__list">
          {pending.map((row) => (
            <article className="universal-leave-queue__item" key={row.id}>
              <div className="universal-leave-queue__detail">
                <small>{row.leave_type_name || "Leave request"}{row.user_role ? ` · ${row.user_role}` : ""}{row.division ? ` · ${row.division}` : ""}</small>
                <strong>{row.user_name || "Team member"}</strong>
                <span>{row.start_date} → {row.end_date} · {row.working_days} working days</span>
                <p>{row.reason || "No reason supplied."}</p>
                <label>
                  Decision note
                  <textarea
                    value={notes[row.id] || ""}
                    onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))}
                    placeholder="Optional decision note"
                    disabled={busyId !== null}
                  />
                </label>
              </div>
              <div className="universal-leave-queue__actions">
                <button type="button" disabled={busyId !== null} onClick={() => void decide(row, "Returned")}>Return</button>
                <button type="button" disabled={busyId !== null} onClick={() => void decide(row, "Rejected")}>Reject</button>
                <button type="button" className="approve" disabled={busyId !== null} onClick={() => void decide(row, "Approved")}>Approve</button>
              </div>
            </article>
          ))}
          {!pending.length && !loadError && (
            <div className="reviews-workspace-empty"><strong>No leave requests are awaiting your decision.</strong></div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <section className="universal-leave-queue__history">
          <header>
            <div><p>ACCOUNTABILITY RECORD</p><h3>Recent leave decisions</h3></div>
            <b>{history.length}</b>
          </header>
          <div className="universal-leave-queue__history-list">
            {history.map((row) => (
              <article key={`leave-history-${row.id}`}>
                <div><strong>{row.user_name || "Team member"}</strong><small>{row.leave_type_name || "Leave request"} · {row.start_date} → {row.end_date}</small></div>
                <div><b>{row.status}</b><small>{row.decision_note || "No decision note recorded."}</small></div>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
