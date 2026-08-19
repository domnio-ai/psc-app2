import { useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type ExternalAssignmentReportImport,
  type GeneratedDocument,
} from "../../api";
import "./document-builder.css";

export type DocumentBuilderReviewer = {
  id: string;
  name: string;
  role: string;
};

export type DocumentBuilderProps = {
  token: string;
  document: GeneratedDocument;
  contextTitle?: string;
  linkedSources?: { id: string; title: string; status?: string }[];
  reviewers?: DocumentBuilderReviewer[];
  canEdit?: boolean;
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

const completionFor = (html: string, existing: number) =>
  plainText(html).length ? Math.max(existing || 0, 35) : 0;

const sectionStatusFor = (html: string) =>
  plainText(html).length ? "In Progress" : "Not Started";

export default function DocumentBuilder({
  token,
  document,
  contextTitle,
  linkedSources = [],
  reviewers = [],
  canEdit,
  onClose,
  onSubmitForReview,
  onExternalImported,
}: DocumentBuilderProps) {
  const [report, setReport] = useState(document);
  const [draftHtml, setDraftHtml] = useState<Record<string, string>>({});
  const [activeSectionId, setActiveSectionId] = useState(
    document.sections[0]?.id || "",
  );
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewerId, setReviewerId] = useState("");
  const [submissionNote, setSubmissionNote] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");

  const activeEditorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    setPreview(false);
    setDirty(false);
    setMessage("");
  }, [document.id]);

  const sections = useMemo(
    () =>
      [...report.sections].sort(
        (left, right) => left.section_order - right.section_order,
      ),
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
        canEdit ??
        ["Lead", "Manager"].includes(report.current_user_role || "")),
  );

  const canSubmit = Boolean(
    stageEditable &&
      (report.can_submit_report ??
        canEdit ??
        ["Lead", "Manager"].includes(report.current_user_role || "")),
  );

  const completedSections = sections.filter((section) =>
    plainText(draftHtml[section.id] ?? section.content ?? ""),
  ).length;

  const meaningfulCharacters = sections.reduce(
    (sum, section) =>
      sum + plainText(draftHtml[section.id] ?? section.content ?? "").length,
    0,
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

  const saveDraft = async () => {
    if (!editable) {
      setTone("error");
      setMessage("This document is read-only at the current workflow stage.");
      return false;
    }

    setBusy(true);
    setMessage("");

    try {
      for (const section of sections) {
        const html = normalize(
          draftHtml[section.id] ?? section.content ?? "",
        );

        if (html !== normalize(section.content || "")) {
          await api.saveGeneratedDocumentSection(
            token,
            report.id,
            section.id,
            html,
            completionFor(html, section.completion),
            sectionStatusFor(html),
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

  const applyFormat = (command: string, value?: string) => {
    if (!editable || preview) return;

    activeEditorRef.current?.focus();
    window.document.execCommand(command, false, value);

    if (activeSection && activeEditorRef.current) {
      setDraftHtml((current) => ({
        ...current,
        [activeSection.id]: activeEditorRef.current?.innerHTML || "",
      }));
      setDirty(true);
    }
  };

  const mountEditor = (node: HTMLDivElement | null) => {
    activeEditorRef.current = node;
    if (!node || !activeSection) return;

    const desired =
      draftHtml[activeSection.id] ?? normalize(activeSection.content || "");

    if (node.dataset.app2BuilderSection !== activeSection.id) {
      node.innerHTML = desired;
      node.dataset.app2BuilderSection = activeSection.id;
    }
  };

  const handleImport = async (file: File) => {
    if (!editable) return;

    setBusy(true);
    setMessage("");

    try {
      if (dirty && !(await saveDraft())) return;

      const imported = await api.importAssignmentReport(token, report.id, file);
      setTone("success");
      setMessage("External document imported.");
      await Promise.resolve(onExternalImported?.(report.id, imported));
      onClose();
    } catch (error) {
      setTone("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "The external document could not be imported.",
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
      if (dirty && !(await saveDraft())) return;

      await onSubmitForReview(
        report.id,
        reviewerId,
        submissionNote.trim(),
      );
      setTone("success");
      setMessage("Document submitted for review.");
      onClose();
    } catch (error) {
      setTone("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "The document could not be submitted.",
      );
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (
      dirty &&
      !window.confirm("Close without saving your latest document edits?")
    ) {
      return;
    }
    onClose();
  };

  return (
    <div className="document-builder-backdrop">
      <section
        className="document-builder-shell"
        aria-label="App2 Document Builder"
      >
        <header className="document-builder-header">
          <div>
            <small>DOCUMENT BUILDER</small>
            <h2>{normalize(report.title)}</h2>
            <p>{contextTitle || report.reference}</p>
          </div>

          <div className="document-builder-template">
            <span>Template</span>
            <strong>{report.template_name}</strong>
            <small>
              v{report.template_version} · {report.template_status}
            </small>
          </div>

          <div className="document-builder-state">
            <b>{editable ? "EDITABLE" : "READ ONLY"}</b>
            <span>{report.status}</span>
            <button type="button" onClick={close}>
              Close
            </button>
          </div>
        </header>

        <div className="document-builder-topbar">
          {editable && (
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void saveDraft()}
            >
              {busy ? "Saving..." : "Save Draft"}
            </button>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => setPreview((value) => !value)}
          >
            {preview ? "Return to Edit" : "Preview Document"}
          </button>

          {editable && report.context === "Assignment" && (
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

          <div className="document-builder-progress">
            <span>
              {completedSections}/{sections.length} sections started
            </span>
            <progress
              max={Math.max(1, sections.length)}
              value={completedSections}
            />
          </div>
        </div>

        {message && (
          <div className={`document-builder-message ${tone}`}>{message}</div>
        )}

        {preview ? (
          <main className="document-builder-preview">
            <header>
              <small>{report.template_name}</small>
              <h1>{normalize(report.title)}</h1>
              <p>{contextTitle || report.reference}</p>
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
          <div className="document-builder-workspace">
            <aside className="document-builder-outline">
              <header>
                <small>TEMPLATE STRUCTURE</small>
                <strong>{report.template_name}</strong>
              </header>

              <nav>
                {sections.map((section, index) => {
                  const hasText = Boolean(
                    plainText(
                      draftHtml[section.id] ?? section.content ?? "",
                    ),
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
                      <small>{hasText ? "Started" : "Empty"}</small>
                    </button>
                  );
                })}
              </nav>

              {linkedSources.length > 0 && (
                <div className="document-builder-sources">
                  <strong>Linked sources</strong>
                  <span>{linkedSources.length}</span>
                  {linkedSources.slice(0, 8).map((source) => (
                    <small key={source.id}>{source.title}</small>
                  ))}
                </div>
              )}
            </aside>

            <main className="document-builder-editor-pane">
              {activeSection ? (
                <>
                  <header className="document-builder-section-head">
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
                    <div className="document-builder-formatbar">
                      <button
                        type="button"
                        onClick={() => applyFormat("bold")}
                      >
                        Bold
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormat("italic")}
                      >
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
                        onClick={() =>
                          applyFormat("formatBlock", "h3")
                        }
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
                        onClick={() =>
                          applyFormat("formatBlock", "blockquote")
                        }
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
                    ref={mountEditor}
                    className="document-builder-editable"
                    contentEditable={editable}
                    suppressContentEditableWarning
                    data-preserve-text-encoding="true"
                    onInput={(event) => {
                      setDraftHtml((current) => ({
                        ...current,
                        [activeSection.id]: event.currentTarget.innerHTML,
                      }));
                      setDirty(true);
                    }}
                  />
                </>
              ) : (
                <div className="document-builder-empty">
                  <strong>No template sections were created.</strong>
                  <span>
                    This document must be created from an approved App2 template.
                  </span>
                </div>
              )}
            </main>
          </div>
        )}

        <footer className="document-builder-footer">
          <span>{dirty ? "Unsaved changes" : "Draft saved"}</span>
          <span>
            {meaningfulCharacters.toLocaleString()} characters ·{" "}
            {sections.length} template sections
          </span>

          {canSubmit && !report.external_import && (
            <div className="document-builder-submit">
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
                value={submissionNote}
                onChange={(event) =>
                  setSubmissionNote(event.target.value)
                }
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
        </footer>
      </section>
    </div>
  );
}
