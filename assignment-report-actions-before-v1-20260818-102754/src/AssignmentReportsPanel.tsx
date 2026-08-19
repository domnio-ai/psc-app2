import { useEffect, useMemo, useState } from "react";
import type {
  ApiAssignmentTask,
  GeneratedDocumentSummary,
  KnowledgeItem,
} from "./api";

type ReviewerOption = { id: string; name: string; role: string };
type ReportKind = "Progress" | "Final";

type Props = {
  assignmentTitle: string;
  tasks: ApiAssignmentTask[];
  documents: GeneratedDocumentSummary[];
  knowledge: KnowledgeItem[];
  reviewers: ReviewerOption[];
  currentUserId?: string;
  canManage: boolean;
  onCompile: (
    kind: ReportKind,
    taskIds: string[],
    knowledgeIds: string[],
  ) => Promise<void>;
  onOpen: (id: string) => void;
  onOpenTask: (task: ApiAssignmentTask) => void;
  onOpenRepository: (id: string) => void;
  onSubmit: (
    id: string,
    reviewerId: string,
    comments: string,
  ) => Promise<void>;
  onReview: (
    id: string,
    decision: "Changes Requested" | "Approved",
    comments: string,
  ) => Promise<void>;
  onFinalize: (id: string) => Promise<void>;
};

const taskReviewLabel = (task: ApiAssignmentTask) => {
  if (task.contribution_status === "Accepted") return "Final source";
  if (task.status === "Blocked") return "Rejected / blocked";
  if (task.contribution_status === "Integrated") return "Approved — final generation pending";
  if (task.contribution_status === "Ready for Integration") return "Awaiting review";
  if (task.status === "Not Started") return "Not started";
  return "Not submitted";
};

const taskStageClass = (task: ApiAssignmentTask) => {
  if (task.contribution_status === "Accepted") return "source-final";
  if (task.status === "Blocked") return "source-blocked";
  if (task.contribution_status === "Integrated") return "source-approved";
  if (task.contribution_status === "Ready for Integration") return "source-review";
  return "source-draft";
};

const reportStage = (status: string) => {
  if (status === "Final") return "Final · Repository published";
  if (status === "Approved") return "Approved · Final generation pending";
  if (["Submitted", "Under Review"].includes(status)) return "Under formal review";
  if (status === "Changes Requested") return "Changes requested";
  if (status === "Revised") return "Revision in progress";
  return "Draft";
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-KE") : "—";

export default function AssignmentReportsPanel({
  assignmentTitle,
  tasks,
  documents,
  knowledge,
  reviewers,
  currentUserId,
  canManage,
  onCompile,
  onOpen,
  onOpenTask,
  onOpenRepository,
  onSubmit,
  onReview,
  onFinalize,
}: Props) {
  const finalTasks = useMemo(
    () => tasks.filter((task) => task.contribution_status === "Accepted"),
    [tasks],
  );
  const awaitingReview = useMemo(
    () => tasks.filter((task) => task.contribution_status === "Ready for Integration"),
    [tasks],
  );
  const approvedPendingFinal = useMemo(
    () => tasks.filter((task) => task.contribution_status === "Integrated"),
    [tasks],
  );
  const blockedTasks = useMemo(
    () => tasks.filter((task) => task.status === "Blocked"),
    [tasks],
  );
  const notSubmitted = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.contribution_status === "Draft" && task.status !== "Blocked",
      ),
    [tasks],
  );

  const taskFinalReportByTaskId = useMemo(() => {
    const rows = new Map<string, KnowledgeItem>();
    for (const item of knowledge) {
      if (item.status !== "Published" || item.document_type !== "Task Final Report") continue;
      for (const link of item.origin_links || []) {
        if (link.type === "task" && !rows.has(link.id)) rows.set(link.id, item);
      }
    }
    return rows;
  }, [knowledge]);

  const taskRepositoryId = (task: ApiAssignmentTask) =>
    task.repository_document_id || taskFinalReportByTaskId.get(task.id)?.id || null;
  const traceableFinalTasks = useMemo(
    () => finalTasks.filter((task) => Boolean(taskRepositoryId(task))),
    [finalTasks, taskFinalReportByTaskId],
  );
  const repositoryGaps = useMemo(
    () => finalTasks.filter((task) => !taskRepositoryId(task)),
    [finalTasks, taskFinalReportByTaskId],
  );
  const finalReady = tasks.length > 0 && traceableFinalTasks.length === tasks.length;
  const readinessPercent = tasks.length
    ? Math.round((traceableFinalTasks.length / tasks.length) * 100)
    : 0;
  const openReports = documents.filter((item) => item.status !== "Final");
  const finalReports = documents.filter((item) => item.status === "Final");
  const publishedEvidence = knowledge.filter(
    (item) =>
      item.status === "Published" &&
      !item.is_archived &&
      !["Task Final Report", "Assignment Final Report"].includes(
        item.document_type || "",
      ),
  );

  const blockerSummary = useMemo(() => {
    if (!tasks.length) return "No active tasks exist yet. Create the assignment task plan first.";
    if (finalReady) return "Every active task has a final approved report. The Final Assignment Report is ready to compile.";
    const parts: string[] = [];
    if (awaitingReview.length) parts.push(`${awaitingReview.length} awaiting review`);
    if (approvedPendingFinal.length) parts.push(`${approvedPendingFinal.length} approved but final report not generated`);
    if (blockedTasks.length) parts.push(`${blockedTasks.length} blocked / rejected`);
    if (notSubmitted.length) parts.push(`${notSubmitted.length} not submitted`);
    if (repositoryGaps.length) parts.push(`${repositoryGaps.length} final report(s) missing a Repository link`);
    return `Final report blocked by ${parts.join(", ") || `${tasks.length - finalTasks.length} outstanding task report(s)`}.`;
  }, [
    tasks.length,
    finalReady,
    awaitingReview.length,
    approvedPendingFinal.length,
    blockedTasks.length,
    notSubmitted.length,
    finalTasks.length,
    repositoryGaps.length,
  ]);

  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [reviewerByReport, setReviewerByReport] = useState<Record<string, string>>({});
  const [noteByReport, setNoteByReport] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setSelectedTasks((current) => {
      const valid = current.filter((id) => traceableFinalTasks.some((task) => task.id === id));
      return valid.length ? valid : traceableFinalTasks.map((task) => task.id);
    });
  }, [traceableFinalTasks.map((task) => task.id).join("|")]);

  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    setNotice("");
    try {
      await work();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The report action could not be completed.",
      );
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="assignment-reports-panel assignment-reports-v3">
      <header className="assignment-reports-titlebar">
        <div>
          <p>ASSIGNMENT REPORTING</p>
          <h2>Reports</h2>
          <span>
            {assignmentTitle}. Final task reports are controlled sources for the
            assignment report; drafts and unapproved work are excluded.
          </span>
        </div>
      </header>

      {notice && <div className="assignment-report-notice">{notice}</div>}

      <section className="assignment-report-readiness assignment-report-readiness-v3">
        <header>
          <div>
            <small>FINAL REPORT READINESS</small>
            <h3>{finalReady ? "Ready to compile" : "Not ready"}</h3>
          </div>
          <div className="assignment-readiness-score">
            <strong>{readinessPercent}%</strong>
            <span>{traceableFinalTasks.length}/{tasks.length || 0} traceable final</span>
          </div>
        </header>

        <div className="assignment-readiness-progress" aria-label={`Final report readiness ${readinessPercent}%`}>
          <span style={{ width: `${readinessPercent}%` }} />
        </div>

        <div className="assignment-report-readiness-kpis assignment-report-readiness-kpis-v3">
          <span><small>Required tasks</small><strong>{tasks.length}</strong></span>
          <span><small>Final reports</small><strong>{traceableFinalTasks.length}</strong></span>
          <span><small>Awaiting review</small><strong>{awaitingReview.length}</strong></span>
          <span><small>Approved, pending final</small><strong>{approvedPendingFinal.length}</strong></span>
          <span><small>Not submitted</small><strong>{notSubmitted.length}</strong></span>
          <span><small>Traceability gaps</small><strong>{repositoryGaps.length}</strong></span>
        </div>

        <p className={finalReady ? "readiness-message ready" : "readiness-message pending"}>
          {blockerSummary}
        </p>
      </section>

      <section className="assignment-final-task-reports assignment-source-register">
        <header>
          <div>
            <small>SOURCE REGISTER</small>
            <h3>Task report sources and blockers</h3>
            <p>Every row is traceable to its task owner, assigned reviewer, approved version and Repository record.</p>
          </div>
          <b>{traceableFinalTasks.length} approved source{traceableFinalTasks.length === 1 ? "" : "s"}</b>
        </header>

        <div className="assignment-source-register-head" aria-hidden="true">
          <span>Task / source</span>
          <span>Researcher</span>
          <span>Reviewer</span>
          <span>Version / approval</span>
          <span>Status</span>
          <span>Action</span>
        </div>

        <div className="assignment-source-register-body">
          {tasks.map((task) => {
            const repository = taskFinalReportByTaskId.get(task.id);
            const repositoryId = task.repository_document_id || repository?.id || null;
            const repositoryTitle = task.repository_document_title || repository?.title || null;
            const isFinal = task.contribution_status === "Accepted";
            const reportVersion = Number(task.contribution_report_version || repository?.latest_version || 0);
            return (
              <article key={task.id} className={taskStageClass(task)}>
                <span className="source-task-title">
                  <strong>{task.contribution_title || task.title}</strong>
                  <small>{isFinal ? "Task → Final Task Report → Repository" : task.title}</small>
                  {repositoryTitle && <small className="source-repository-title">{repositoryTitle}</small>}
                </span>
                <span>
                  <small>Researcher</small>
                  <strong>{task.owner_name || "Unassigned"}</strong>
                </span>
                <span>
                  <small>Reviewer</small>
                  <strong>{task.reviewer_name || "Not assigned"}</strong>
                </span>
                <span>
                  <small>{reportVersion ? `Version ${reportVersion}` : "No final version"}</small>
                  <strong>{isFinal ? formatDate(task.contribution_integrated_at || repository?.created_at) : "—"}</strong>
                </span>
                <b>{taskReviewLabel(task)}</b>
                <button
                  type="button"
                  onClick={() => {
                    if (isFinal && repositoryId) onOpenRepository(repositoryId);
                    else onOpenTask(task);
                  }}
                >
                  {isFinal && repositoryId
                    ? "Open Final Report"
                    : task.contribution_status === "Ready for Integration"
                      ? "Open Submission"
                      : "Open Task"}
                </button>
              </article>
            );
          })}
          {!tasks.length && <p>No tasks have been created for this assignment.</p>}
        </div>
      </section>

      {canManage && (
        <section className="assignment-report-create-grid">
          <article>
            <small>PROGRESS REPORT</small>
            <h3>Compile current progress</h3>
            <p>
              Uses only final approved task reports available now. Outstanding
              work remains visible as incomplete in the assignment readiness view.
            </p>
            <details>
              <summary>{selectedTasks.length} final source(s) selected</summary>
              <div className="assignment-report-source-picker">
                {traceableFinalTasks.map((task) => (
                  <label key={task.id}>
                    <input
                      type="checkbox"
                      checked={selectedTasks.includes(task.id)}
                      onChange={(event) =>
                        setSelectedTasks((current) =>
                          event.target.checked
                            ? [...new Set([...current, task.id])]
                            : current.filter((id) => id !== task.id),
                        )
                      }
                    />
                    <span>
                      <strong>{task.contribution_title || task.title}</strong>
                      <small>{task.owner_name || "Task owner"} · v{Number(task.contribution_report_version || 1)}</small>
                    </span>
                  </label>
                ))}
              </div>
            </details>
            <button
              type="button"
              disabled={!selectedTasks.length || busy === "progress"}
              onClick={() =>
                run("progress", () =>
                  onCompile("Progress", selectedTasks, selectedEvidence),
                )
              }
            >
              {busy === "progress" ? "Compiling..." : "Compile Progress Report"}
            </button>
          </article>

          <article className={finalReady ? "final-ready" : "final-locked"}>
            <small>FINAL ASSIGNMENT REPORT</small>
            <h3>{finalReady ? "Ready to compile" : "Locked by outstanding sources"}</h3>
            <p>
              The final report must include every active task's final approved
              report. App2 snapshots those sources for permanent traceability.
            </p>
            {!finalReady && <small className="final-report-lock-reason">{blockerSummary}</small>}
            <button
              type="button"
              disabled={!finalReady || busy === "final"}
              onClick={() =>
                run("final", () =>
                  onCompile(
                    "Final",
                    traceableFinalTasks.map((task) => task.id),
                    selectedEvidence,
                  ),
                )
              }
            >
              {busy === "final" ? "Compiling..." : "Compile Final Assignment Draft"}
            </button>
          </article>
        </section>
      )}

      <details className="assignment-report-evidence-picker">
        <summary>Supporting Repository evidence <b>{selectedEvidence.length}</b></summary>
        <div>
          {publishedEvidence.map((item) => (
            <label key={item.id}>
              <input
                type="checkbox"
                checked={selectedEvidence.includes(item.id)}
                onChange={(event) =>
                  setSelectedEvidence((current) =>
                    event.target.checked
                      ? [...new Set([...current, item.id])]
                      : current.filter((id) => id !== item.id),
                  )
                }
              />
              <span>
                <strong>{item.title}</strong>
                <small>{item.category} · Published · v{item.latest_version}</small>
              </span>
            </label>
          ))}
          {!publishedEvidence.length && <p>No published Repository evidence is available.</p>}
        </div>
      </details>

      <section className="assignment-report-workflow-list">
        <header>
          <div>
            <small>CONTROLLED REPORT WORKFLOW</small>
            <h3>Assignment reports</h3>
          </div>
        </header>

        {openReports.map((report) => {
          const ready = Number(report.ready_sections || 0);
          const total = Number(report.section_count || 0);
          const sectionsReady = total > 0 && ready === total;
          const assignedReviewer = report.reviewer_id === currentUserId;
          const reviewerId = reviewerByReport[report.id] || "";
          const note = noteByReport[report.id] || "";
          return (
            <article key={report.id} className="assignment-report-workflow-card">
              <header>
                <div>
                  <strong>{report.title}</strong>
                  <small>{report.reference} · {report.template_name} · Version {report.version}</small>
                </div>
                <b>{reportStage(report.status)}</b>
              </header>
              <div className="assignment-report-workflow-meta">
                <span><small>Sections ready</small><strong>{ready}/{total}</strong></span>
                <span><small>Reviewer</small><strong>{report.reviewer_name || "Not assigned"}</strong></span>
                <span><small>Updated</small><strong>{formatDate(report.updated_at)}</strong></span>
              </div>
              <footer>
                <button type="button" onClick={() => onOpen(report.id)}>Open working space</button>

                {canManage && ["Draft", "Revised", "Changes Requested"].includes(report.status) && (
                  <div className="assignment-report-submit-controls">
                    <select
                      aria-label="Assignment report reviewer"
                      value={reviewerId}
                      onChange={(event) =>
                        setReviewerByReport((current) => ({ ...current, [report.id]: event.target.value }))
                      }
                    >
                      <option value="">Select reviewer</option>
                      {reviewers
                        .filter((reviewer) => reviewer.id !== currentUserId)
                        .map((reviewer) => (
                          <option key={reviewer.id} value={reviewer.id}>{reviewer.name} — {reviewer.role}</option>
                        ))}
                    </select>
                    <input
                      value={note}
                      onChange={(event) =>
                        setNoteByReport((current) => ({ ...current, [report.id]: event.target.value }))
                      }
                      placeholder="Submission note (optional)"
                    />
                    <button
                      type="button"
                      disabled={!sectionsReady || !reviewerId || busy === `submit-${report.id}`}
                      title={!sectionsReady ? "Mark every report section Ready before submission." : "Submit the frozen version to the assigned reviewer."}
                      onClick={() =>
                        run(`submit-${report.id}`, () => onSubmit(report.id, reviewerId, note))
                      }
                    >
                      Submit to Reviewer
                    </button>
                  </div>
                )}

                {assignedReviewer && ["Submitted", "Under Review"].includes(report.status) && (
                  <div className="assignment-report-review-controls">
                    <textarea
                      value={note}
                      onChange={(event) =>
                        setNoteByReport((current) => ({ ...current, [report.id]: event.target.value }))
                      }
                      placeholder="Reviewer comments"
                    />
                    <button
                      type="button"
                      disabled={!note.trim() || busy === `changes-${report.id}`}
                      onClick={() =>
                        run(`changes-${report.id}`, () => onReview(report.id, "Changes Requested", note.trim()))
                      }
                    >
                      Request Changes
                    </button>
                    <button
                      type="button"
                      className="primary"
                      disabled={busy === `approve-${report.id}`}
                      onClick={() =>
                        run(`approve-${report.id}`, () => onReview(report.id, "Approved", note.trim()))
                      }
                    >
                      Approve
                    </button>
                  </div>
                )}

                {assignedReviewer && report.status === "Approved" && report.template_key === "assignment-final-report" && (
                  <button
                    type="button"
                    className="primary"
                    disabled={busy === `finalize-${report.id}`}
                    onClick={() => run(`finalize-${report.id}`, () => onFinalize(report.id))}
                  >
                    {busy === `finalize-${report.id}` ? "Publishing..." : "Generate Final Report & Save to Repository"}
                  </button>
                )}
              </footer>
            </article>
          );
        })}
        {!openReports.length && <p>No assignment report is currently in progress.</p>}
      </section>

      <section className="report-document-group final-outputs">
        <header>
          <div>
            <span>FINAL OUTPUTS</span>
            <h3>Published assignment reports</h3>
          </div>
        </header>
        {finalReports.map((item) => (
          <article key={item.id}>
            <span>
              <strong>{item.title}</strong>
              <small>{item.reference} · v{item.version} · {item.reviewer_name || "Approved reviewer"}</small>
            </span>
            <b>Final</b>
            <button onClick={() => onOpen(item.id)}>Preview</button>
          </article>
        ))}
        {!finalReports.length && <p>No final assignment report has been published yet.</p>}
      </section>
    </section>
  );
}
