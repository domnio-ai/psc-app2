import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, type GeneratedDocument, type GeneratedDocumentControl } from "../../../api";
import "./assignment-report-workspace.css";

type Props = {
  token: string;
  document: GeneratedDocument;
  assignmentTitle?: string;
  onClose: () => void;
  onReviewComplete?: () => Promise<void>;
};

const normalize = (value: string) =>
  String(value || "")
    .replaceAll("\u00c3\u00a2\u00e2\u201a\u00ac\u201d", "—")
    .replaceAll("\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u009d", "”")
    .replaceAll("\u00c3\u201a\u00c2\u00b7", "·")
    .replaceAll("\u00c2\u00b7", "·");

export default function AssignmentReportReader({ token, document, assignmentTitle, onClose, onReviewComplete }: Props) {
  const [pdfUrl, setPdfUrl] = useState("");
  const [docxHtml, setDocxHtml] = useState("");
  const [loading, setLoading] = useState(Boolean(document.external_import));
  const [error, setError] = useState("");
  const [reviewHistory, setReviewHistory] = useState<GeneratedDocumentControl["reviews"]>([]);
  const [comments, setComments] = useState<GeneratedDocumentControl["comments"]>([]);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewNotice, setReviewNotice] = useState("");

  useEffect(() => {
    let active = true;
    void api.generatedDocumentControl(token, document.id)
      .then((control) => {
        if (active) {
          setReviewHistory(control.reviews);
          setComments(control.comments);
        }
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Review history could not be loaded.");
      });
    return () => { active = false; };
  }, [document.id, token]);

  const saveReviewerComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = reviewComment.trim();
    if (!body) return;
    setReviewBusy(true);
    setError("");
    try {
      await api.addGeneratedDocumentComment(token, document.id, null, body);
      const control = await api.generatedDocumentControl(token, document.id);
      setComments(control.comments);
      setReviewComment("");
      setReviewNotice("Comment added to the report review record.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The review comment could not be saved.");
    } finally {
      setReviewBusy(false);
    }
  };

  const recordDecision = async (decision: "Under Review" | "Changes Requested" | "Rejected" | "Approved") => {
    const note = reviewComment.trim();
    if (["Changes Requested", "Rejected"].includes(decision) && !note) {
      setError(decision === "Rejected" ? "Add a reason before rejecting this report." : "Describe the changes required.");
      return;
    }
    setReviewBusy(true);
    setError("");
    setReviewNotice("");
    try {
      const outcome = await api.reviewAssignmentReport(token, document.id, decision, note);
      const control = await api.generatedDocumentControl(token, document.id);
      setReviewHistory(control.reviews);
      setComments(control.comments);
      setReviewComment("");
      if (decision === "Approved") {
        setReviewNotice(outcome.publication
          ? `Approved and published to the Document Repository as “${outcome.publication.repository_document_title || "Final Assignment Report"}”.`
          : `Approval was recorded, but automatic publication could not complete: ${outcome.publicationError || "Contact a manager to resolve the publication blocker."}`);
      } else {
        setReviewNotice(decision === "Under Review" ? "Review started. Next action: complete the review, add comments if needed, then approve, request changes, or reject." : decision === "Rejected" ? "Report rejected. Next action: the report author should revise the report and submit a new version for review." : "Changes requested. Next action: the report author should address the comments, save the revision, and resubmit it for review.");
      }
      await onReviewComplete?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The review decision could not be saved.");
    } finally {
      setReviewBusy(false);
    }
  };

  const nextStep = document.can_review_report
    ? document.status === "Submitted"
      ? "Read the report, add a note if needed, then choose a review decision."
      : "Finish your review and record the appropriate decision."
    : document.status === "Approved"
      ? "The report is approved. Final publication is handled as part of approval."
      : document.status === "Changes Requested"
        ? "The author should address the review notes, save the revision, and submit it again."
        : document.status === "Rejected"
          ? "The author can revise this report and submit a new version for review."
          : document.status === "Final"
            ? "Published to the Document Repository. The assignment is complete."
            : `Waiting for ${document.reviewer_name || "the assigned reviewer"} to complete review.`;

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    const load = async () => {
      if (!document.external_import) {
        setLoading(false);
        return;
      }
      try {
        if (document.external_import.mime_type === "application/pdf") {
          const file = await api.fetchImportedAssignmentReportFile(token, document.id);
          objectUrl = URL.createObjectURL(file.blob);
          if (active) setPdfUrl(objectUrl);
        } else {
          const reader = await api.readImportedAssignmentReport(token, document.id);
          if (active) setDocxHtml(reader.html);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "The imported report could not be opened.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document.id, document.external_import?.id, token]);

  return createPortal((
    <div className="assignment-report-reader-backdrop">
      <section className="assignment-report-reader" aria-label="Assignment Report reader">
        <header>
          <div>
            <small>READ-ONLY REVIEW COPY</small>
            <h2>{normalize(document.title)}</h2>
            <p>{assignmentTitle || document.reference} · Version {document.version} · {document.status}</p>
          </div>
          <button type="button" onClick={onClose}>Close Reader</button>
        </header>

        {(error || reviewNotice) && <div className={`assignment-report-reader-feedback ${error ? "error" : "success"}`} role="status">{error || reviewNotice}</div>}
        {loading && <div className="assignment-report-reader-loading">Opening review copy…</div>}

        <div className="assignment-report-reader-workspace">
        {!loading && document.external_import?.mime_type === "application/pdf" && pdfUrl && (
          <div className="assignment-report-reader-content"><iframe className="assignment-report-pdf-reader" src={pdfUrl} title={document.external_import.original_name} /></div>
        )}

        {!loading && document.external_import && document.external_import.mime_type !== "application/pdf" && (
          <div className="assignment-report-reader-content"><main className="assignment-report-docx-reader" dangerouslySetInnerHTML={{ __html: docxHtml }} /></div>
        )}

        {!loading && !document.external_import && (
          <div className="assignment-report-reader-content"><main className="assignment-report-internal-reader">
            <section className="assignment-report-cover" aria-label="Assignment report cover and document control">
              <div className="assignment-report-cover-brand">
                <div className="assignment-report-psc-brand">
                  <img src="/psc-logo.png" alt="Public Service Commission logo" />
                  <span>PUBLIC SERVICE COMMISSION<small>RESEARCH DEPARTMENT</small></span>
                </div>
                <span className="assignment-report-cover-classification">{document.classification || "Official"}</span>
              </div>
              <p className="assignment-report-cover-kicker">CONTROLLED ASSIGNMENT REPORT</p>
              <h1>{normalize(document.title)}</h1>
              <p className="assignment-report-cover-assignment">{assignmentTitle || document.title}</p>
              <section className="assignment-report-document-control" aria-label="Document control">
                <div className="assignment-report-document-control-heading">
                  <strong>DOCUMENT CONTROL</strong>
                  <span>Controlled copy · Version {document.version}</span>
                </div>
                <dl>
                  <div><dt>Report reference</dt><dd>{document.reference || "Not recorded"}</dd></div>
                  <div><dt>Assignment</dt><dd>{assignmentTitle || document.title}</dd></div>
                  <div><dt>Prepared by</dt><dd>{document.created_by_name || "Not recorded"}</dd></div>
                  <div><dt>Reviewer</dt><dd>{document.reviewer_name || "Not assigned"}</dd></div>
                  <div><dt>Version</dt><dd>v{document.version}</dd></div>
                  <div><dt>Status</dt><dd>{document.status}</dd></div>
                  <div><dt>Classification</dt><dd>{document.classification || "Official"}</dd></div>
                  <div><dt>Last updated</dt><dd>{new Date(document.updated_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
                </dl>
              </section>
              <footer>Public Service Commission · REDESY controlled publication</footer>
            </section>
            {document.sections.map((section) => (
              <section key={section.id}>
                <h2>{section.title}</h2>
                <div dangerouslySetInnerHTML={{ __html: normalize(section.content || "") }} />
              </section>
            ))}
          </main></div>
        )}
        {(document.can_review_report || document.can_finalize_report || ["Submitted", "Under Review", "Changes Requested", "Rejected", "Final", "Approved"].includes(document.status)) && (
          <aside className="assignment-report-review-panel" aria-label="Reviewer actions">
            <div className="assignment-report-review-main">
              <div className="assignment-report-review-heading">
                <div><small>REPORT WORKFLOW</small><h3>{document.can_review_report ? "Review this report" : "Next action"}</h3></div>
                <span>{document.status}</span>
              </div>
              <div className="assignment-report-next-step"><span>NEXT STEP</span><p>{nextStep}</p></div>
              {document.can_review_report && <>
                <label className="assignment-report-comment-label" htmlFor="assignment-review-comment">Reviewer note <span>Required for changes or rejection</span></label>
                <textarea id="assignment-review-comment" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} maxLength={4000} placeholder="Add a clear, actionable note for the report author." aria-label="Reviewer comments" />
                <div className="assignment-report-review-actions">
                  {document.status === "Submitted" && <button type="button" disabled={reviewBusy} onClick={() => void recordDecision("Under Review")}>Start review</button>}
                  <button type="button" disabled={reviewBusy} onClick={() => void recordDecision("Changes Requested")}>Request changes</button>
                  <button type="button" className="reject" disabled={reviewBusy} onClick={() => void recordDecision("Rejected")}>Reject</button>
                  <button type="button" className="approve" disabled={reviewBusy} onClick={() => void recordDecision("Approved")}>Approve</button>
                </div>
              </>}
              {document.can_finalize_report && <p>Final publication is being completed automatically as part of approval.</p>}
              {!document.can_review_report && document.status === "Submitted" && <p>Next action: {document.reviewer_name || "the assigned reviewer"} must review this submitted report and record a decision.</p>}
              {!document.can_review_report && document.status === "Under Review" && <p>Next action: {document.reviewer_name || "the assigned reviewer"} must complete the review and approve, request changes, or reject the report.</p>}
              {document.status === "Approved" && !document.can_finalize_report && <p>Approval is recorded. Final publication runs automatically with the reviewer’s decision.</p>}
              {document.status === "Changes Requested" && <p>Next action: the report author should address the reviewer comments, update the report, and resubmit it.</p>}
              {document.status === "Rejected" && <p>Next action: the report author should revise this report and submit a new version. The rejection and reason remain in review history.</p>}
              {document.status === "Final" && <p>The approved report has been published to the Document Repository. The assignment is complete.</p>}
            </div>
            <div className="assignment-report-review-history">
              <div className="assignment-report-history-heading">
                <span><strong>Review record</strong><small>{reviewHistory.length + comments.length} entries</small></span>
                {document.can_review_report && <form onSubmit={(event) => void saveReviewerComment(event)}>
                  <button type="submit" disabled={reviewBusy || !reviewComment.trim()}>Add note</button>
                </form>}
              </div>
              <details>
                <summary>Review history and comments ({reviewHistory.length + comments.length})</summary>
                <div className="assignment-report-review-list">
                  {[...reviewHistory.map((item) => ({ id: item.id, kind: item.decision, body: item.comments, author: item.reviewer_name, at: item.created_at })), ...comments.map((item) => ({ id: item.id, kind: "Comment", body: item.body, author: item.author_name, at: item.created_at }))]
                    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                    .map((item) => <article key={`${item.kind}-${item.id}`}><strong>{item.kind}</strong><span>{item.author} · {new Date(item.at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span>{item.body && <p>{item.body}</p>}</article>)}
                  {!reviewHistory.length && !comments.length && <p>No review notes or comments yet.</p>}
                </div>
              </details>
            </div>
          </aside>
        )}
        </div>
      </section>
    </div>
  ), globalThis.document.body);
}
