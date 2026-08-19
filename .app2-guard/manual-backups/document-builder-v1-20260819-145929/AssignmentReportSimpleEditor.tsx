import { useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type ExternalAssignmentReportImport,
  type GeneratedDocument,
} from "./api";
import "./assignment-report-simple-v3.css";
import "./report-editor-v3.css";

type ReviewerOption = { id: string; name: string; role: string };

type Props = {
  token: string;
  document: GeneratedDocument;
  assignmentTitle?: string;
  linkedTasks?: { id: string; title: string; status?: string }[];
  reviewers?: ReviewerOption[];
  canEditAssignmentReport?: boolean;
  onClose: () => void;
  onSubmitForReview?: (
    documentId: string,
    reviewerId: string,
    comments: string,
  ) => Promise<void>;
  onExternalImported?: (
    documentId: string,
    imported: ExternalAssignmentReportImport,
  ) => Promise<void> | void;
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

const sectionState = (html: string) =>
  plainText(html).length ? "In Progress" : "Not Started";

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
  const [draftHtml, setDraftHtml] = useState<Record<string, string>>({});
  const [activeSectionId, setActiveSectionId] = useState(
    document.sections[0]?.id || "",
  );
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [reviewerId, setReviewerId] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeEditorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setReport(document);
    setDraftHtml(
      Object.fromEntries(
        document.sections.map((section) => [
          section.id,
          normalize(section.content || ""),
        ]),
      ),
    );
    setActiveSectionId(document.sections[0]?.id || "");
    setDirty(false);
    setPreview(false);
    setMessage("");
  }, [document.id]);

  const sections = useMemo(
    () => [...report.sections].sort((a, b) => a.section_order - b.section_order),
    [report.sections],
  );

  const activeSection =
    sections.find((section) => section.id === activeSectionId) || sections[0];

  const stageEditable = ![
    "Submitted",
    "Under Review",
    "Approved",
    "Final",
  ].includes(report.status);

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

  const meaningfulCharacters = useMemo(
    () =>
      sections.reduce(
        (sum, section) =>
          sum + plainText(draftHtml[section.id] ?? section.content ?? "").length,
        0,
      ),
    [sections, draftHtml],
  );

  const completedSections = useMemo(
    () =>
      sections.filter(
        (section) =>
          plainText(draftHtml[section.id] ?? section.content ?? "").length > 0,
      ).length,
    [sections, draftHtml],
  );

  const refresh = async () => {
    const fresh = await api.generatedDocument(token, report.id);
    setReport(fresh);
    setDraftHtml(
      Object.fromEntries(
        fresh.sections.map((section) => [
          section.id,
          normalize(section.content || ""),
        ]),
      ),
    );
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
      for (const section of sections) {
        const html = normalize(
          draftHtml[section.id] ?? section.content ?? "",
        );
        const text = plainText(html);

        if (html !== normalize(section.content || "")) {
          await api.saveGeneratedDocumentSection(
            token,
            report.id,
            section.id,
            html,
            text ? Math.max(section.completion || 0, 35) : 0,
            sectionState(html),
          );
        }
      }

      await refresh();
      setTone("success");
      setMessage("Draft saved.");
      return true;
    } catch (error) {
      setTone("error");
      setMessage(
        error instanceof Error ? error.message : "The draft could not be saved.",
      );
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
      setMessage(
        error instanceof Error
          ? error.message
          : "The report could not be imported.",
      );
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
      setMessage(
        error instanceof Error
          ? error.message
          : "The report could not be submitted.",
      );
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (dirty && !window.confirm("Close without saving your latest edits?")) return;
    onClose();
  };

  const applyFormat = (command: string, value?: string) => {
    if (!editable || preview) return;
    activeEditorRef.current?.focus();
    // The report prop is also named "document"; use the browser DOM explicitly.\n    window.document.execCommand(command, false, value);
    const html = activeEditorRef.current?.innerHTML || "";
    if (activeSection) {
      setDraftHtml((current) => ({ ...current, [activeSection.id]: html }));
      setDirty(true);
    }
  };

  const mountActiveEditor = (node: HTMLDivElement | null) => {
    activeEditorRef.current = node;
    if (!node || !activeSection) return;
    const desired =
      draftHtml[activeSection.id] ?? normalize(activeSection.content || "");
    if (node.dataset.sectionId !== activeSection.id) {
      node.innerHTML = desired;
      node.dataset.sectionId = activeSection.id;
    }
  };

  return (
    <div className="simple-assignment-report-backdrop">
      <section
        className="simple-assignment-report-editor report-editor-v3"
        aria-label="Final Assignment Report editor"
      >
        <header className="simple-report-header report-v3-header">
          <div>
            <small>STRUCTURED REPORT EDITOR</small>
            <h2>{normalize(report.title)}</h2>
            <p>
              {assignmentTitle || report.reference} · Version {report.version}
            </p>
          </div>

          <div className="report-v3-template">
            <span>Template</span>
            <strong>{report.template_name}</strong>
            <small>
              v{report.template_version} · {report.template_status}
            </small>
          </div>

          <div className="simple-report-header-state">
            <b>{editable ? "EDITABLE" : "READ ONLY"}</b>
            <span>{report.status}</span>
            <button type="button" onClick={close}>
              Close
            </button>
          </div>
        </header>

        <div className="simple-report-toolbar report-v3-topbar">
          {editable && (
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void saveAll()}
            >
              {busy ? "Saving..." : "Save Draft"}
            </button>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => setPreview((value) => !value)}
          >
            {preview ? "Return to Edit" : "Preview Report"}
          </button>

          {editable && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
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

          <div className="report-v3-progress">
            <span>
              {completedSections}/{sections.length} sections started
            </span>
            <progress
              max={Math.max(1, sections.length)}
              value={completedSections}
            />
          </div>

          {canSubmit && !report.external_import && (
            <div className="simple-report-submit">
              <select
                value={reviewerId}
                onChange={(event) => setReviewerId(event.target.value)}
                aria-label="Select reviewer"
              >
                <option value="">Select reviewer</option>
                {reviewers.map((reviewer) => (
                  <option key={reviewer.id} value={reviewer.id}>
                    {reviewer.name} — {reviewer.role}
                  </option>
                ))}
              </select>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Submission note (optional)"
              />
              <button
                type="button"
                className="primary"
                disabled={!reviewerId || busy}
                onClick={() => void submit()}
              >
                Submit for Review
              </button>
            </div>
          )}
        </div>

        {message && (
          <div className={`simple-report-message ${tone}`}>{message}</div>
        )}

        {!sections.length ? (
          <div className="report-v3-empty">
            <strong>No template sections were created.</strong>
            <span>
              This report must be created from an approved App2 report template.
            </span>
          </div>
        ) : preview ? (
          <main className="report-v3-preview-page">
            <header>
              <small>{report.template_name}</small>
              <h1>{normalize(report.title)}</h1>
              <p>{assignmentTitle || report.reference}</p>
            </header>

            {sections.map((section) => (
              <section key={section.id}>
                <h2>{section.title}</h2>
                <div
                  dangerouslySetInnerHTML={{
                    __html:
                      draftHtml[section.id] ??
                      normalize(section.content || ""),
                  }}
                />
              </section>
            ))}
          </main>
        ) : (
          <div className="report-v3-workspace">
            <aside className="report-v3-outline">
              <header>
                <small>TEMPLATE STRUCTURE</small>
                <strong>{report.template_name}</strong>
              </header>

              <nav>
                {sections.map((section, index) => {
                  const text = plainText(
                    draftHtml[section.id] ?? section.content ?? "",
                  );
                  return (
                    <button
                      type="button"
                      key={section.id}
                      className={
                        section.id === activeSection?.id ? "active" : ""
                      }
                      onClick={() => setActiveSectionId(section.id)}
                    >
                      <span>{index + 1}</span>
                      <b>{section.title}</b>
                      <small>{text ? "Started" : "Empty"}</small>
                    </button>
                  );
                })}
              </nav>

              <div className="simple-report-source-strip">
                <strong>Approved task sources</strong>
                <span>{linkedTasks.length}</span>
                {linkedTasks.map((item) => (
                  <small key={item.id}>{item.title}</small>
                ))}
              </div>
            </aside>

            <main className="report-v3-editor-pane">
              {activeSection && (
                <>
                  <header className="report-v3-section-head">
                    <div>
                      <small>
                        SECTION{" "}
                        {sections.findIndex(
                          (section) => section.id === activeSection.id,
                        ) + 1}{" "}
                        OF {sections.length}
                      </small>
                      <h2>{activeSection.title}</h2>
                    </div>
                    <span>{activeSection.section_status}</span>
                  </header>

                  {editable && (
                    <div className="report-v3-formatbar" aria-label="Formatting">
                      <button type="button" onClick={() => applyFormat("bold")}>
                        Bold
                      </button>
                      <button type="button" onClick={() => applyFormat("italic")}>
                        Italic
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormat("underline")}
                      >
                        Underline
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormat("formatBlock", "h3")}
                      >
                        Heading
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          applyFormat("insertUnorderedList")
                        }
                      >
                        Bullets
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          applyFormat("insertOrderedList")
                        }
                      >
                        Numbering
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormat("formatBlock", "blockquote")}
                      >
                        Quote
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormat("removeFormat")}
                      >
                        Clear format
                      </button>
                    </div>
                  )}

                  <div
                    ref={mountActiveEditor}
                    className="simple-report-section-body report-v3-editable"
                    contentEditable={editable}
                    suppressContentEditableWarning
                    data-preserve-text-encoding="true"
                    onInput={(event) => {
                      const html = event.currentTarget.innerHTML;
                      setDraftHtml((current) => ({
                        ...current,
                        [activeSection.id]: html,
                      }));
                      setDirty(true);
                    }}
                  />
                </>
              )}
            </main>
          </div>
        )}

        <footer className="simple-report-footer">
          <span>{dirty ? "Unsaved changes" : "Draft saved"}</span>
          <span>
            {meaningfulCharacters.toLocaleString()} characters ·{" "}
            {sections.length} template sections
          </span>
          {editable && (
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void saveAll()}
            >
              Save Draft
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
