import { useEffect, useMemo, useRef, useState } from "react";
import { api, type ExternalAssignmentReportImport, type GeneratedDocument } from "./api";
import "./assignment-report-simple-v3.css";

type ReviewerOption = { id: string; name: string; role: string };

type Props = {
  token: string;
  document: GeneratedDocument;
  assignmentTitle?: string;
  linkedTasks?: { id: string; title: string; status?: string }[];
  reviewers?: ReviewerOption[];
  canEditAssignmentReport?: boolean;
  onClose: () => void;
  onSubmitForReview?: (documentId: string, reviewerId: string, comments: string) => Promise<void>;
  onExternalImported?: (documentId: string, imported: ExternalAssignmentReportImport) => Promise<void> | void;
};

const normalize = (value: string) =>
  String(value || "")
    .replaceAll("Ã¢â‚¬”", "—")
    .replaceAll("Ã¢â‚¬Â", "”")
    .replaceAll("Ã‚Â·", "·")
    .replaceAll("Â·", "·");

const plainText = (html: string) =>
  String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

export default function AssignmentReportSimpleEditor({
  token,
  document,
  assignmentTitle,
  linkedTasks = [],
  reviewers = [],
  canEditAssignmentReport,
  onClose,
  onSubmitForReview,
  onExternalImported,
}: Props) {
  const [report, setReport] = useState(document);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [reviewerId, setReviewerId] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    setReport(document);
    setDirty(false);
    setPreview(false);
  }, [document.id, document.updated_at]);

  const stageEditable = !["Submitted", "Under Review", "Approved", "Final"].includes(report.status);
  const editable = Boolean(
    stageEditable &&
      (report.can_edit_report ??
        canEditAssignmentReport ??
        ["Lead", "Manager"].includes(report.current_user_role || "")),
  );
  const canSubmit = Boolean(
    stageEditable &&
      (report.can_submit_report ??
        canEditAssignmentReport ??
        ["Lead", "Manager"].includes(report.current_user_role || "")),
  );

  const sourceCount = linkedTasks.length;
  const meaningfulCharacters = useMemo(
    () => report.sections.reduce((sum, section) => sum + plainText(section.content).length, 0),
    [report.sections],
  );

  const refresh = async () => {
    const fresh = await api.generatedDocument(token, report.id);
    setReport(fresh);
    setDirty(false);
    return fresh;
  };

  const saveAll = async () => {
    if (!editable) {
      setTone("error");
      setMessage("This report is read-only for your account or workflow stage.");
      return false;
    }
    setBusy(true);
    setMessage("");
    try {
      for (const section of report.sections) {
        const html = normalize(sectionRefs.current[section.id]?.innerHTML ?? section.content ?? "");
        const text = plainText(html);
        if (html !== normalize(section.content || "")) {
          await api.saveGeneratedDocumentSection(
            token,
            report.id,
            section.id,
            html,
            text ? Math.max(section.completion || 0, 35) : 0,
            text ? "In Progress" : "Not Started",
          );
        }
      }
      await refresh();
      setTone("success");
      setMessage("Draft saved.");
      return true;
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "The draft could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (file: File) => {
    if (!editable) return;
    setBusy(true);
    setMessage("");
    try {
      if (dirty && !(await saveAll())) return;
      const imported = await api.importAssignmentReport(token, report.id, file);
      setTone("success");
      setMessage("External report imported. Returning to reviewer handoff.");
      await Promise.resolve(onExternalImported?.(report.id, imported));
      onClose();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "The report could not be imported.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!reviewerId || !onSubmitForReview) return;
    setBusy(true);
    setMessage("");
    try {
      if (dirty && !(await saveAll())) return;
      await onSubmitForReview(report.id, reviewerId, note.trim());
      setTone("success");
      setMessage("Report submitted to reviewer.");
      onClose();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "The report could not be submitted.");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (dirty && !window.confirm("Close without saving your latest edits?")) return;
    onClose();
  };

  return (
    <div className="simple-assignment-report-backdrop">
      <section className="simple-assignment-report-editor" aria-label="Final Assignment Report editor">
        <header className="simple-report-header">
          <div>
            <small>FINAL ASSIGNMENT REPORT</small>
            <h2>{normalize(report.title)}</h2>
            <p>{assignmentTitle || report.reference} · Version {report.version} · {sourceCount} approved task report source{sourceCount === 1 ? "" : "s"}</p>
          </div>
          <div className="simple-report-header-state">
            <b>{editable ? "EDITABLE" : "READ ONLY"}</b>
            <span>{report.status}</span>
            <button type="button" onClick={close}>Close</button>
          </div>
        </header>

        <div className="simple-report-toolbar">
          {editable && (
            <button type="button" className="primary" disabled={busy} onClick={() => void saveAll()}>
              {busy ? "Saving..." : "Save Draft"}
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => setPreview((value) => !value)}>
            {preview ? "Return to Edit" : "Preview"}
          </button>
          {editable && (
            <>
              <button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                Import PDF/DOCX
              </button>
              <input
                ref={fileInputRef}
                hidden
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void handleImport(file);
                }}
              />
            </>
          )}
          {canSubmit && !report.external_import && (
            <div className="simple-report-submit">
              <select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} aria-label="Select reviewer">
                <option value="">Select reviewer</option>
                {reviewers.map((reviewer) => (
                  <option key={reviewer.id} value={reviewer.id}>{reviewer.name} — {reviewer.role}</option>
                ))}
              </select>
              <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Submission note (optional)" />
              <button type="button" className="primary" disabled={!reviewerId || busy} onClick={() => void submit()}>
                Submit for Review
              </button>
            </div>
          )}
        </div>

        {message && <div className={`simple-report-message ${tone}`}>{message}</div>}

        <div className="simple-report-source-strip">
          <strong>Approved task report sources</strong>
          <span>{sourceCount}</span>
          {linkedTasks.map((item) => <small key={item.id}>{item.title}</small>)}
        </div>

        <main className={`simple-report-page ${preview ? "preview" : "edit"}`}>
          {report.sections.map((section) => (
            <section className="simple-report-section" key={section.id}>
              <h2>{section.title}</h2>
              <div
                ref={(node) => { sectionRefs.current[section.id] = node; }}
                className="simple-report-section-body"
                contentEditable={editable && !preview}
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: normalize(section.content || "") }}
                onInput={() => setDirty(true)}
              />
            </section>
          ))}
        </main>

        <footer className="simple-report-footer">
          <span>{dirty ? "Unsaved changes" : "Draft saved"}</span>
          <span>{meaningfulCharacters.toLocaleString()} characters · {report.sections.length} structured sections</span>
          {editable && <button type="button" className="primary" disabled={busy} onClick={() => void saveAll()}>Save Draft</button>}
        </footer>
      </section>
    </div>
  );
}
