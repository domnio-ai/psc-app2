import { useState } from "react";
import { createPortal } from "react-dom";
import FelixAdvicePanel from "../../../components/felix/FelixAdvicePanel";
import type { AssignmentWorkspaceTab } from "./AssignmentWorkspaceShell";
import "../assignment-overview-v5.css";

import "../assignments-final-prelock-v1.css";
type Props = {
  token: string;
  selectedAssignmentRecord: any;
  selectedAssignment: string;
  assignmentLead: any;
  currentUserName: string;
  currentUserId: string;
  currentUserRole: string;
  isAssignmentLead: boolean;
  isManager: boolean;
  assignmentNextAction: {
    title: string;
    detail: string;
    label: string;
    tab: AssignmentWorkspaceTab | "Tasks";
    responsible: string;
  };
  assignmentOperationalStatus: string;
  assignmentCompletion: number;
  assignmentReviews: any[];
  assignmentTasks: any[];
  completedTaskCount: number;
  acceptedTaskReportCount: number;
  latestFinalAssignmentReport: any;
  finalAssignmentReportIsFinal: boolean;
  allTaskReportsAccepted: boolean;
  assignmentHistory: any[];
  assignmentMemberRequests: any[];
  assignmentMemberRequestComments: Record<string, string>;
  assignmentMemberRequestSaving: boolean;
  onSelectTab: (tab: AssignmentWorkspaceTab) => void;
  onRequestMember: () => void;
  onOpenTasksModule: () => void;
  onCreateTaskRequest: () => void;
  onMemberRequestComment: (requestId: string, value: string) => void;
  onDecideMemberRequest: (request: any, decision: "Approved" | "Rejected") => void;
  onOpenTask: (task: any) => void;
  onOpenGeneratedDocument: (documentId: string, isFinal: boolean) => void;
  assignmentReportStatusLabel: (status: any) => string;
  initialsFor: (name: string) => string;
};

export default function AssignmentOverview({
  token,
  selectedAssignmentRecord,
  selectedAssignment,
  assignmentLead,
  currentUserName,
  currentUserId,
  currentUserRole,
  isAssignmentLead,
  isManager,
  assignmentOperationalStatus,
  assignmentCompletion,
  assignmentReviews,
  assignmentTasks,
  completedTaskCount,
  acceptedTaskReportCount,
  latestFinalAssignmentReport,
  finalAssignmentReportIsFinal,
  allTaskReportsAccepted,
  assignmentHistory,
  assignmentMemberRequests,
  assignmentMemberRequestComments,
  assignmentMemberRequestSaving,
  onSelectTab,
  onRequestMember,
  onOpenTasksModule,
  onCreateTaskRequest,
  onMemberRequestComment,
  onDecideMemberRequest,
  onOpenTask,
  onOpenGeneratedDocument,
  assignmentReportStatusLabel,
  initialsFor,
}: Props) {
  const [felixAdviceOpen, setFelixAdviceOpen] = useState(false);
  const [assignedTasksOpen, setAssignedTasksOpen] = useState(false);
  const myAssignedTasks = assignmentTasks.filter((task: any) => task.owner_id === currentUserId && task.status !== "Completed");
  const isImmediateSupervisor = Boolean(
    assignmentLead?.supervisor_name &&
      assignmentLead.supervisor_name === currentUserName,
  );

  const accessLabel = isAssignmentLead
    ? "Accountable lead"
    : isManager
      ? isImmediateSupervisor
        ? "Immediate supervisor"
        : "Management visibility"
      : selectedAssignmentRecord?.members?.some(
            (member: any) => member.name === currentUserName,
          )
        ? "Team member"
        : "View only";

  const pendingMemberRequests = assignmentMemberRequests.filter(
    (request) => request.status === "Pending",
  );

  const briefItems = [
    {
      label: "Objective",
      value: selectedAssignmentRecord?.objective || "Not recorded.",
    },
    {
      label: "Scope",
      value: selectedAssignmentRecord?.scope || "Not recorded.",
    },
    {
      label: "Instructions",
      value: selectedAssignmentRecord?.instructions || "No additional instructions.",
    },
    {
      label: "Expected output",
      value: selectedAssignmentRecord?.expected_output || "Final Assignment Report",
    },
  ];

  return (
    <section className="assignment-overview-clean">
      <section
        className="assignment-overview-clean-metrics"
        aria-label="Assignment work summary"
      >
        <button type="button" className="assignment-overview-clean-metric-button" onClick={() => setAssignedTasksOpen(true)} aria-label={`Open ${myAssignedTasks.length} active tasks assigned to you`}>
          <small>ASSIGNED TO ME</small>
          <strong>{myAssignedTasks.length}</strong>
          <span>New and active task jobs</span>
        </button>
        <article>
          <small>TASKS</small>
          <strong>
            {assignmentTasks.length ? `${completedTaskCount}/${assignmentTasks.length}` : "None"}
          </strong>
          <span>{assignmentTasks.length ? "completed" : "Direct workflow"}</span>
        </article>

        <article>
          <small>TASK REPORTS</small>
          <strong>{assignmentTasks.length ? `${acceptedTaskReportCount}/${assignmentTasks.length}` : "Not required"}</strong>
          <span>{assignmentTasks.length ? "accepted" : "No delegated tasks"}</span>
        </article>

        <article>
          <small>FINAL REPORT</small>
          <strong>{latestFinalAssignmentReport?.status || "Not created"}</strong>
        </article>
      </section>

      <div className="assignment-overview-clean-grid">
        <main>
          <article className="assignment-overview-clean-card">
            <header>
              <div>
                <small>TASK DELIVERY</small>
                <h3>Related tasks</h3>
              </div>
              {(isAssignmentLead || isManager) && !assignmentTasks.length ? (
                <button type="button" className="primary" onClick={onCreateTaskRequest}>
                  {isManager ? "Assign task" : "Request task"}
                </button>
              ) : assignmentTasks.length > 0 ? (
                <button type="button" onClick={onOpenTasksModule}>Open tasks</button>
              ) : null}
            </header>

            {assignmentTasks.length ? (
              <div className="assignment-overview-clean-task-list">
                {assignmentTasks.slice(0, 5).map((task: any) => (
                  <button
                    type="button"
                    key={task.id}
                    onClick={() => onOpenTask(task)}
                  >
                    <span>
                      <strong>{task.title}</strong>
                      <small>
                        {task.owner_name || "Unassigned"}
                        {task.due_date
                          ? ` · due ${new Date(task.due_date).toLocaleDateString("en-KE")}`
                          : ""}
                      </small>
                    </span>
                    <em>
                      {task.contribution_status === "Accepted"
                        ? "Report accepted"
                        : assignmentReportStatusLabel(task.contribution_status)}
                    </em>
                  </button>
                ))}
              </div>
            ) : (
              <div className="assignment-overview-clean-empty">
                <strong>No linked tasks</strong>
                <span>
                  This assignment can be reported directly. Add tasks only when
                  work needs to be delegated.
                </span>
              </div>
            )}
          </article>

          <article className="assignment-overview-clean-card">
            <header>
              <div>
                <small>FINAL OUTPUT</small>
                <h3>Final Assignment Report</h3>
              </div>
              <button type="button" onClick={() => onSelectTab("Reports")}>
                Continue in Reports
              </button>
            </header>

            {latestFinalAssignmentReport ? (
              <div className="assignment-overview-clean-report">
                <div>
                  <strong>{latestFinalAssignmentReport.title}</strong>
                  <span>
                    {latestFinalAssignmentReport.status}
                    {latestFinalAssignmentReport.reviewer_name
                      ? ` · Reviewer: ${latestFinalAssignmentReport.reviewer_name}`
                      : ""}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onOpenGeneratedDocument(
                      latestFinalAssignmentReport.id,
                      finalAssignmentReportIsFinal,
                    )
                  }
                >
                  {finalAssignmentReportIsFinal
                    ? "Read final report"
                    : "Preview report"}
                </button>
              </div>
            ) : (
              <div className="assignment-overview-clean-empty">
                <strong>Not created yet</strong>
                <span>
                  {assignmentTasks.length === 0
                    ? "Direct reporting is available for this assignment."
                    : allTaskReportsAccepted
                      ? "All required task reports are accepted. The final report can now be created."
                      : "Complete and accept the required task reports before final reporting."}
                </span>
              </div>
            )}
          </article>
        </main>

        <aside>
          <article className="assignment-overview-clean-card">
            <header>
              <div>
                <small>TEAM</small>
                <h3>
                  {selectedAssignmentRecord?.members?.length || 0} member
                  {(selectedAssignmentRecord?.members?.length || 0) === 1
                    ? ""
                    : "s"}
                </h3>
              </div>

              {isAssignmentLead && (
                <button type="button" onClick={onRequestMember}>
                  Request member
                </button>
              )}
            </header>

            <div className="assignment-overview-clean-team">
              {(selectedAssignmentRecord?.members || [])
                .slice(0, 6)
                .map((member: any) => (
                  <div key={member.id}>
                    <b>{initialsFor(member.name)}</b>
                    <span>
                      <strong>{member.name}</strong>
                      <small>{member.role}</small>
                    </span>
                  </div>
                ))}
            </div>

            {pendingMemberRequests.map((request) => {
              const canDecide =
                assignmentLead?.supervisor_id === currentUserId;

              return (
                <section
                  className="assignment-overview-clean-member-request"
                  key={request.id}
                >
                  <small>TEAM REQUEST · PENDING</small>
                  <strong>{request.requested_user_name}</strong>
                  <span>
                    {request.requested_user_role}
                    {request.requested_user_division
                      ? ` · ${request.requested_user_division}`
                      : ""}
                  </span>

                  <p>{request.reason}</p>

                  {canDecide ? (
                    <>
                      <textarea
                        rows={2}
                        value={
                          assignmentMemberRequestComments[request.id] || ""
                        }
                        onChange={(event) =>
                          onMemberRequestComment(
                            request.id,
                            event.target.value,
                          )
                        }
                        placeholder="Decision note; required when declining"
                      />

                      <div>
                        <button
                          type="button"
                          disabled={assignmentMemberRequestSaving}
                          onClick={() =>
                            onDecideMemberRequest(request, "Rejected")
                          }
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          disabled={assignmentMemberRequestSaving}
                          onClick={() =>
                            onDecideMemberRequest(request, "Approved")
                          }
                        >
                          Approve member
                        </button>
                      </div>
                    </>
                  ) : (
                    <em>
                      Awaiting{" "}
                      {assignmentLead?.supervisor_name ||
                        "the immediate supervisor"}
                    </em>
                  )}
                </section>
              );
            })}
          </article>

          <article className="assignment-overview-clean-card">
            <header>
              <div>
                <small>RECENT ACTIVITY</small>
                <h3>Latest updates</h3>
              </div>
              <button type="button" onClick={() => onSelectTab("Activity")}>
                View activity
              </button>
            </header>

            <div className="assignment-overview-clean-activity">
              {assignmentHistory.slice(0, 3).map((item: any) => (
                <div key={item.id}>
                  <strong>
                    {item.action
                      .replaceAll("_", " ")
                      .toLowerCase()
                      .replace(/^./, (letter: string) =>
                        letter.toUpperCase(),
                      )}
                  </strong>
                  <small>
                    {item.user_name || "System"} ·{" "}
                    {new Date(item.created_at).toLocaleString("en-KE")}
                  </small>
                </div>
              ))}

              {!assignmentHistory.length && (
                <span>No activity recorded yet.</span>
              )}
            </div>
          </article>
        </aside>
      </div>

      <details className="assignment-overview-clean-details">
        <summary>Assignment brief and requirements</summary>
        <div className="assignment-overview-clean-brief-content">
          <section>
            <small>Brief</small>
            <p>{selectedAssignmentRecord?.description || "No assignment brief has been recorded."}</p>
          </section>
          <div className="assignment-overview-clean-brief-grid">
            {briefItems.map((item) => (
              <section key={item.label}>
                <small>{item.label}</small>
                <p>{item.value}</p>
              </section>
            ))}
          </div>
        </div>
      </details>

      <details className="assignment-overview-clean-details">
        <summary>Access and review responsibility</summary>
        <div className="assignment-overview-clean-governance">
          <article>
            <small>YOUR ACCESS</small>
            <strong>{accessLabel}</strong>
            <span>{currentUserName} · {currentUserRole}</span>
          </article>
          <article>
            <small>FORMAL REVIEWER</small>
            <strong>
              {latestFinalAssignmentReport?.reviewer_name || assignmentReviews[0]?.reviewer_name || "Not assigned yet"}
            </strong>
            <span>{latestFinalAssignmentReport ? "Final-report review" : "Selected when the report is submitted"}</span>
          </article>
        </div>
      </details>

      <div className="assignment-overview-clean-felix">
        <button
          type="button"
          className="assignment-overview-clean-felix-toggle"
          aria-expanded={felixAdviceOpen}
          onClick={() => setFelixAdviceOpen((open) => !open)}
        >
          Professor Felix · Deterministic advice
          <span>{felixAdviceOpen ? "Hide" : "Show"}</span>
        </button>
        {felixAdviceOpen && (
          <FelixAdvicePanel
            token={token}
            contextType="Assignment"
            compact
            entry={{
              title: selectedAssignmentRecord?.title || selectedAssignment,
              description: selectedAssignmentRecord?.description || "",
              status: selectedAssignmentRecord?.status || assignmentOperationalStatus,
              due_date: selectedAssignmentRecord?.due_date || null,
              progress: assignmentCompletion,
              members: selectedAssignmentRecord?.members?.map((member: any) => member.id) || [],
              reviewer_id: assignmentReviews[0]?.reviewer_id || null,
              task_count: assignmentTasks.length,
              completed_task_count: completedTaskCount,
            }}
          />
        )}
      </div>
      {assignedTasksOpen && createPortal(
        <div className="command-popup-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAssignedTasksOpen(false); }}>
          <section className="command-popup" role="dialog" aria-modal="true" aria-label="Tasks assigned to you">
            <header className="command-popup-head"><div><small>ASSIGNMENTS</small><h4>New and active tasks assigned to you</h4><p>{myAssignedTasks.length} active task{myAssignedTasks.length === 1 ? "" : "s"} in this assignment</p></div><button type="button" aria-label="Close popup" onClick={() => setAssignedTasksOpen(false)}>×</button></header>
            <div className="command-popup-list">
              {myAssignedTasks.map((task: any) => <article key={task.id}><div className="command-popup-record"><small>{task.priority || "Normal"} priority · {task.due_date ? `Due ${new Date(task.due_date).toLocaleDateString("en-KE")}` : "No due date"}</small><strong>{task.title}</strong><span>{task.status} · Report: {assignmentReportStatusLabel(task.contribution_status)}</span></div><button type="button" onClick={() => { setAssignedTasksOpen(false); onOpenTask(task); }}>Open exact task</button></article>)}
              {!myAssignedTasks.length && <div className="command-popup-empty">No active tasks are assigned to you in this assignment.</div>}
            </div>
            <footer className="command-popup-footer"><button type="button" onClick={() => setAssignedTasksOpen(false)}>Close</button></footer>
          </section>
        </div>, document.body,
      )}
    </section>
  );
}
