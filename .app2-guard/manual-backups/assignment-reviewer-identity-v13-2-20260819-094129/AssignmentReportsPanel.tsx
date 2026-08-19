import { useMemo, useState } from "react";
import type { ApiAssignmentTask, GeneratedDocumentSummary, KnowledgeItem } from "./api";
import "./assignment-report-simple-v3.css";

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
  onCompile: (kind: ReportKind, taskIds: string[], knowledgeIds: string[]) => Promise<void>;
  onOpen: (id: string) => void;
  onPreview: (id: string) => void;
  onOpenTask: (task: ApiAssignmentTask) => void;
  onOpenRepository: (id: string) => void;
  onSubmit: (id: string, reviewerId: string, comments: string) => Promise<void>;
  onReview: (id: string, decision: "Changes Requested" | "Approved", comments: string) => Promise<void>;
  onFinalize: (id: string) => Promise<void>;
  onDiscardImport?: (id: string) => Promise<void>;
};

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString("en-KE") : "—";
const normalize = (value: string) => String(value || "").replaceAll("Ã¢â‚¬”", "—").replaceAll("Ã‚Â·", "·").replaceAll("Â·", "·");

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
  onPreview,
  onOpenTask,
  onOpenRepository,
  onSubmit,
  onFinalize,
  onDiscardImport,
}: Props) {
  const [reviewerByReport, setReviewerByReport] = useState<Record<string, string>>({});
  const [noteByReport, setNoteByReport] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [showOtherReports, setShowOtherReports] = useState(false);

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

  const approvedSources = useMemo(
    () => tasks.filter((task) => task.contribution_status === "Accepted" && Boolean(task.repository_document_id || taskFinalReportByTaskId.get(task.id)?.id)),
    [tasks, taskFinalReportByTaskId],
  );
  const allSourcesReady = tasks.length > 0 && approvedSources.length === tasks.length;

  const finalCandidates = documents
    .filter((item) => item.template_key === "assignment-final-report" || /Final Assignment Report/i.test(item.title || ""))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const primaryReport = finalCandidates[0] || null;
  const otherReports = documents.filter((item) => !primaryReport || item.id !== primaryReport.id);

  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    setNotice("");
    try { await work(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "The report action could not be completed."); }
    finally { setBusy(""); }
  };

  const reportReviewer = primaryReport ? reviewerByReport[primaryReport.id] || "" : "";
  const reportNote = primaryReport ? noteByReport[primaryReport.id] || "" : "";
  const draftStage = Boolean(primaryReport && ["Draft", "Revised", "Changes Requested"].includes(primaryReport.status));
  const canAuthorReport = Boolean(canManage || (primaryReport?.created_by && primaryReport.created_by === currentUserId));
  const importedDraft = Boolean(draftStage && primaryReport?.external_import_id);

  return (
    <section className="assignment-reports-panel assignment-reports-simple-v3">
      <header className="assignment-reports-titlebar">
        <div>
          <p>ASSIGNMENT REPORTING</p>
          <h2>Final Assignment Report</h2>
          <span>Prepare one report, send it for review, then publish the approved final copy.</span>
        </div>
      </header>

      {notice && <div className="assignment-report-notice">{notice}</div>}

      <section className="assignment-source-simple">
        <header>
          <div>
            <strong>Approved task report sources</strong>
            <small>{approvedSources.length} of {tasks.length} task report{tasks.length === 1 ? "" : "s"} ready</small>
          </div>
          <b>{approvedSources.length}/{tasks.length}</b>
        </header>
        <div className="assignment-source-simple-list">
          {tasks.map((task) => {
            const repositoryId = task.repository_document_id || taskFinalReportByTaskId.get(task.id)?.id || null;
            const final = task.contribution_status === "Accepted" && Boolean(repositoryId);
            return (
              <article key={task.id}>
                <span>
                  <strong>{task.contribution_title || task.title}</strong>
                  <small>{task.owner_name || "Researcher"} · {final ? "Final approved source" : "Not yet final"}</small>
                </span>
                {final && repositoryId ? (
                  <button type="button" onClick={() => onOpenRepository(repositoryId)}>Read Final Report</button>
                ) : (
                  <button type="button" onClick={() => onOpenTask(task)}>Open Task</button>
                )}
              </article>
            );
          })}
          {!tasks.length && <p>No assignment tasks exist yet.</p>}
        </div>
      </section>

      {!primaryReport && (
        <section className="assignment-primary-report-card">
          <header><div><small>FINAL REPORT</small><h3>No Final Assignment Report draft yet</h3></div></header>
          <p>{allSourcesReady ? "All task reports are final. Create the assignment draft and start writing." : "The Final Assignment Report becomes available when every required task has a published final report."}</p>
          <div className="assignment-primary-report-actions">
            <button
              type="button"
              className="primary"
              disabled={!allSourcesReady || busy === "compile-final"}
              onClick={() => run("compile-final", () => onCompile("Final", approvedSources.map((task) => task.id), []))}
            >
              {busy === "compile-final" ? "Creating..." : "Create Final Assignment Draft"}
            </button>
          </div>
        </section>
      )}

      {primaryReport && (
        <section className="assignment-primary-report-card">
          <header>
            <div>
              <small>FINAL ASSIGNMENT REPORT</small>
              <h3>{normalize(primaryReport.title)}</h3>
            </div>
            <b>{primaryReport.status}</b>
          </header>
          <div className="assignment-primary-report-meta">
            <span>Version {primaryReport.version}</span>
            <span>Reviewer: {primaryReport.reviewer_name || "Not assigned"}</span>
            <span>Updated {formatDate(primaryReport.updated_at)}</span>
            <span>{approvedSources.length} approved task sources</span>
          </div>

          {importedDraft ? (
            <div className="assignment-import-handoff">
              <header>
                <div>
                  <small>IMPORTED REPORT READY FOR REVIEW</small>
                  <h4>{primaryReport.external_import_name}</h4>
                  <p>The authoring workspace is closed. Read the imported report, select a reviewer, submit it, or discard this import.</p>
                </div>
                <b>v{primaryReport.external_import_version || 1}</b>
              </header>
              <div className="assignment-import-handoff-actions">
                <button type="button" onClick={() => onPreview(primaryReport.id)}>Read Imported Report</button>
                <select value={reportReviewer} onChange={(event) => setReviewerByReport((current) => ({ ...current, [primaryReport.id]: event.target.value }))}>
                  <option value="">Select reviewer</option>
                  {reviewers.filter((reviewer) => reviewer.id !== currentUserId).map((reviewer) => (
                    <option key={reviewer.id} value={reviewer.id}>{reviewer.name} — {reviewer.role}</option>
                  ))}
                </select>
                <input value={reportNote} onChange={(event) => setNoteByReport((current) => ({ ...current, [primaryReport.id]: event.target.value }))} placeholder="Submission note (optional)" />
                <button type="button" className="primary" disabled={!reportReviewer || busy === "submit-import"} onClick={() => run("submit-import", () => onSubmit(primaryReport.id, reportReviewer, reportNote))}>Submit for Review</button>
                <button type="button" className="danger" disabled={busy === "discard-import"} onClick={() => run("discard-import", () => onDiscardImport ? onDiscardImport(primaryReport.id) : Promise.resolve())}>Discard Import</button>
              </div>
            </div>
          ) : (
            <div className="assignment-primary-report-actions">
              {draftStage && canAuthorReport && (
                <>
                  <button type="button" className="primary" onClick={() => onOpen(primaryReport.id)}>Continue Editing</button>
                  <button type="button" onClick={() => onPreview(primaryReport.id)}>Preview</button>
                  <select value={reportReviewer} onChange={(event) => setReviewerByReport((current) => ({ ...current, [primaryReport.id]: event.target.value }))}>
                    <option value="">Select reviewer</option>
                    {reviewers.filter((reviewer) => reviewer.id !== currentUserId).map((reviewer) => (
                      <option key={reviewer.id} value={reviewer.id}>{reviewer.name} — {reviewer.role}</option>
                    ))}
                  </select>
                  <input value={reportNote} onChange={(event) => setNoteByReport((current) => ({ ...current, [primaryReport.id]: event.target.value }))} placeholder="Submission note (optional)" />
                  <button type="button" className="primary" disabled={!reportReviewer || busy === "submit"} onClick={() => run("submit", () => onSubmit(primaryReport.id, reportReviewer, reportNote))}>Submit for Review</button>
                </>
              )}
              {["Submitted", "Under Review"].includes(primaryReport.status) && (
                <>
                  <button type="button" className="primary" onClick={() => onPreview(primaryReport.id)}>Read Submitted Report</button>
                  <span>Waiting for {primaryReport.reviewer_name || "reviewer"}</span>
                </>
              )}
              {primaryReport.status === "Approved" && (
                <>
                  <button type="button" onClick={() => onPreview(primaryReport.id)}>Read Approved Report</button>
                  <button type="button" className="primary" disabled={busy === "finalize"} onClick={() => run("finalize", () => onFinalize(primaryReport.id))}>{busy === "finalize" ? "Publishing..." : "Generate Final Report & Save to Repository"}</button>
                </>
              )}
              {primaryReport.status === "Final" && (
                <button type="button" className="primary" onClick={() => primaryReport.repository_document_id ? onOpenRepository(primaryReport.repository_document_id) : onPreview(primaryReport.id)}>Read Final Report</button>
              )}
            </div>
          )}
        </section>
      )}

      {otherReports.length > 0 && (
        <details className="assignment-report-evidence-picker" open={showOtherReports} onToggle={(event) => setShowOtherReports((event.currentTarget as HTMLDetailsElement).open)}>
          <summary>Other reports ({otherReports.length})</summary>
          <div>
            {otherReports.map((report) => (
              <article key={report.id}>
                <span><strong>{normalize(report.title)}</strong><small>{report.template_name} · {report.status}</small></span>
                <button type="button" onClick={() => onPreview(report.id)}>Read</button>
              </article>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
