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

const taskReviewLabel = (status: ApiAssignmentTask["contribution_status"]) => {
  if (status === "Accepted") return "Final";
  if (status === "Integrated") return "Approved — final report pending";
  if (status === "Ready for Integration") return "Awaiting review";
  return "Draft";
};

const reportStage = (status: string) => {
  if (status === "Final") return "Final · Repository published";
  if (status === "Approved") return "Approved · Final generation pending";
  if (["Submitted", "Under Review"].includes(status)) return "Under formal review";
  if (status === "Changes Requested") return "Changes requested";
  if (status === "Revised") return "Revision in progress";
  return "Draft";
};

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
  onSubmit,
  onReview,
  onFinalize,
}: Props) {
  const finalTasks = useMemo(
    () => tasks.filter((task) => task.contribution_status === "Accepted"),
    [tasks],
  );
  const waitingForReview = useMemo(
    () =>
      tasks.filter((task) =>
        ["Ready for Integration", "Integrated"].includes(
          task.contribution_status,
        ),
      ),
    [tasks],
  );
  const finalReady = tasks.length > 0 && finalTasks.length === tasks.length;
  const openReports = documents.filter((item) => item.status !== "Final");
  const finalReports = documents.filter((item) => item.status === "Final");
  const publishedEvidence = knowledge.filter(
    (item) =>
      item.status === "Published" &&
      !item.is_archived &&
      !["Task Final Report", "Assignment Final Report"].includes(item.document_type || ""),
  );

  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [reviewerByReport, setReviewerByReport] = useState<
    Record<string, string>
  >({});
  const [noteByReport, setNoteByReport] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setSelectedTasks((current) => {
      const valid = current.filter((id) => finalTasks.some((task) => task.id === id));
      return valid.length ? valid : finalTasks.map((task) => task.id);
    });
  }, [finalTasks.map((task) => task.id).join("|")]);

  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    setNotice("");
    try {
      await work();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The report action could not be completed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="assignment-reports-panel assignment-reports-v2">
      <header className="assignment-reports-titlebar">
        <div>
          <p>ASSIGNMENT REPORTING</p>
          <h2>Reports</h2>
          <span>
            Final task reports feed the assignment report. Draft, review and
            publication remain controlled and auditable.
          </span>
        </div>
      </header>

      {notice && <div className="assignment-report-notice">{notice}</div>}

      <section className="assignment-report-readiness">
        <header>
          <div>
            <small>REPORT READINESS</small>
            <h3>{finalReady ? "Ready for final assignment report" : "Work still outstanding"}</h3>
          </div>
          <b className={finalReady ? "ready" : "pending"}>
            {finalTasks.length}/{tasks.length || 0} final task reports
          </b>
        </header>
        <div className="assignment-report-readiness-kpis">
          <span><small>Total tasks</small><strong>{tasks.length}</strong></span>
          <span><small>Final task reports</small><strong>{finalTasks.length}</strong></span>
          <span><small>Awaiting review/finalisation</small><strong>{waitingForReview.length}</strong></span>
          <span><small>Outstanding</small><strong>{Math.max(0, tasks.length - finalTasks.length)}</strong></span>
        </div>
        {!finalReady && tasks.length > 0 && (
          <p>
            Final Assignment Report remains locked until every active task has
            an approved final task report.
          </p>
        )}
      </section>

      <section className="assignment-final-task-reports">
        <header>
          <div>
            <small>SOURCE REPORTS</small>
            <h3>Task reports</h3>
          </div>
        </header>
        <div className="assignment-task-report-table">
          {tasks.map((task) => (
            <article key={task.id}>
              <span>
                <strong>{task.contribution_title || task.title}</strong>
                <small>{task.owner_name || "Unassigned"}</small>
              </span>
              <span>
                <small>Reviewer</small>
                <strong>{task.reviewer_name || "Not assigned"}</strong>
              </span>
              <b className={`contribution-${task.contribution_status.toLowerCase().replaceAll(" ", "-")}`}>
                {taskReviewLabel(task.contribution_status)}
              </b>
              <button type="button" onClick={() => onOpenTask(task)}>
                Open task report
              </button>
            </article>
          ))}
          {!tasks.length && <p>No tasks have been created for this assignment.</p>}
        </div>
      </section>

      {canManage && (
        <section className="assignment-report-create-grid">
          <article>
            <small>PROGRESS REPORT</small>
            <h3>Compile current progress</h3>
            <p>
              Use finalised task reports available so far. Progress reports can
              be produced while the assignment is still active.
            </p>
            <details>
              <summary>{selectedTasks.length} task report(s) selected</summary>
              <div className="assignment-report-source-picker">
                {finalTasks.map((task) => (
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
                      <small>{task.owner_name || "Task owner"}</small>
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
            <h3>{finalReady ? "Compile final report" : "Locked until task reports are final"}</h3>
            <p>
              The final report uses all approved task reports and selected
              published evidence. It then goes through formal review before
              repository publication.
            </p>
            <button
              type="button"
              disabled={!finalReady || busy === "final"}
              onClick={() =>
                run("final", () =>
                  onCompile(
                    "Final",
                    finalTasks.map((task) => task.id),
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
                <span><small>Updated</small><strong>{new Date(report.updated_at).toLocaleDateString("en-KE")}</strong></span>
              </div>
              <footer>
                <button type="button" onClick={() => onOpen(report.id)}>Open report</button>

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
