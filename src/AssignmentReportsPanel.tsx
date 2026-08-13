import { useRef, useState } from "react";
import type {
  ApiAttachment,
  DocumentTemplate,
  GeneratedDocumentSummary,
} from "./api";

type Props = {
  templates: DocumentTemplate[];
  documents: GeneratedDocumentSummary[];
  attachments: ApiAttachment[];
  onCreate: (templateId: string, title: string) => Promise<void>;
  onOpen: (id: string) => void;
  onDownloadTemplate: (template: DocumentTemplate) => void;
  onUpload: (file?: File) => void;
  onDownloadAttachment: (file: ApiAttachment) => void;
};

export default function AssignmentReportsPanel({
  templates,
  documents,
  attachments,
  onCreate,
  onOpen,
  onDownloadTemplate,
  onUpload,
  onDownloadAttachment,
}: Props) {
  const approved = templates.filter(
    (item) =>
      item.template_key === "progress-report" &&
      item.active &&
      ["Approved", "Standard"].includes(item.governance_status),
  );
  const [creating, setCreating] = useState(false),
    [templateId, setTemplateId] = useState(""),
    [title, setTitle] = useState(""),
    [preview, setPreview] = useState<DocumentTemplate | null>(null),
    [creatingReport, setCreatingReport] = useState(false),
    [error, setError] = useState("");
  const titleInput = useRef<HTMLInputElement>(null);
  const chooseTemplate = (template: DocumentTemplate) => {
    setTemplateId(template.id);
    setTitle((current) =>
      current.trim()
        ? current
        : `${template.name} - ${new Date().toLocaleDateString("en-KE", { month: "long", year: "numeric" })}`,
    );
    setError("");
    window.setTimeout(() => titleInput.current?.focus(), 0);
  };
  const openCreate = () => {
    setCreating(true);
    setError("");
    if (approved[0]) chooseTemplate(approved[0]);
  };
  const create = async () => {
    if (!templateId) return setError("Select a report template.");
    if (!title.trim()) {
      setError("Enter a report title.");
      titleInput.current?.focus();
      return;
    }
    setCreatingReport(true);
    setError("");
    try {
      await onCreate(templateId, title.trim());
      setCreating(false);
      setTitle("");
      setTemplateId("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Report could not be created.",
      );
    } finally {
      setCreatingReport(false);
    }
  };
  return (
    <section className="assignment-reports-panel">
      <header>
        <div>
          <p>REPORT WORKSPACE</p>
          <h2>Reports</h2>
          <span>
            Open the current draft or create a report when no draft exists.
          </span>
        </div>
        {!documents.some(
          (item) => !["Approved", "Final"].includes(item.status),
        ) && (
          <button className="primary" onClick={openCreate}>
            Create report
          </button>
        )}
      </header>
      {creating && (
        <div
          className="template-library"
          role="dialog"
          aria-modal="true"
          aria-label="Choose assignment report template"
        >
          <header>
            <div>
              <span className="template-kicker">APP2 REPORT BUILDER</span>
              <h3>Create an assignment report</h3>
              <p>
                Select the approved structure, confirm its title, then open the
                working report.
              </p>
            </div>
            <button
              className="template-close"
              aria-label="Close template selection"
              onClick={() => setCreating(false)}
            >
              ×
            </button>
          </header>
          <div className="template-cards">
            {approved.map((template) => (
              <article
                className={templateId === template.id ? "selected" : ""}
                key={template.id}
                onClick={() => chooseTemplate(template)}
              >
                <span className="template-mark" aria-hidden="true">
                  ▤
                </span>
                <span>
                  <strong>{template.name}</strong>
                  <small>{template.description}</small>
                  <em>
                    <b>{template.governance_status}</b> · Version{" "}
                    {template.version} · {template.sections.length} sections
                  </em>
                </span>
                <div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setPreview(template);
                    }}
                  >
                    Preview Sections
                  </button>
                  <button
                    className="use-template"
                    onClick={(event) => {
                      event.stopPropagation();
                      chooseTemplate(template);
                    }}
                  >
                    {templateId === template.id ? "✓ Selected" : "Use Template"}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!approved.length && (
            <p className="template-error">
              No approved Progress Report template is available.
            </p>
          )}
          <footer>
            <label>
              Report title
              <input
                ref={titleInput}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. August Progress Report"
              />
            </label>
            <button
              className="build-report"
              disabled={!templateId || !title.trim() || creatingReport}
              onClick={create}
            >
              {creatingReport ? "Creating report…" : "Create & Open Report →"}
            </button>
          </footer>
          {error && (
            <p className="template-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
      {preview && (
        <div
          className="template-preview"
          role="dialog"
          aria-modal="true"
          aria-label={`${preview.name} preview`}
        >
          <button onClick={() => setPreview(null)}>×</button>
          <span className="template-kicker">APPROVED STRUCTURE</span>
          <h2>{preview.name}</h2>
          <p>{preview.description}</p>
          <ol>
            {preview.sections.map((section) => (
              <li key={section.key}>{section.title}</li>
            ))}
          </ol>
          <footer>
            <button onClick={() => onDownloadTemplate(preview)}>
              Download Blank Template
            </button>
            <button
              className="primary"
              onClick={() => {
                chooseTemplate(preview);
                setPreview(null);
              }}
            >
              Use This Template
            </button>
          </footer>
        </div>
      )}
      <section className="report-document-group">
        <header>
          <div>
            <span>CURRENT REPORT</span>
            <h3>
              {documents.some(
                (item) => !["Approved", "Final"].includes(item.status),
              )
                ? "Continue working"
                : "No draft report"}
            </h3>
          </div>
        </header>
        {documents
          .filter((item) => !["Approved", "Final"].includes(item.status))
          .map((item) => (
            <article key={item.id}>
              <span>
                <strong>{item.title}</strong>
                <small>
                  Version {item.version} · Updated{" "}
                  {new Date(item.updated_at).toLocaleString("en-KE", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {item.created_by_name}
                </small>
              </span>
              <b>{item.status}</b>
              <button className="primary" onClick={() => onOpen(item.id)}>
                Open report
              </button>
            </article>
          ))}
        {!documents.some(
          (item) => !["Approved", "Final"].includes(item.status),
        ) && <p>Create a report or compile approved task reports above.</p>}
      </section>
      <details className="report-supporting-files">
        <summary>
          Supporting files <b>{attachments.length}</b>
        </summary>
        <div>
          <label className="document-upload">
            Upload file
            <input
              type="file"
              onChange={(event) => onUpload(event.target.files?.[0])}
            />
          </label>
          <button
            disabled={!approved[0]}
            onClick={() => approved[0] && onDownloadTemplate(approved[0])}
          >
            Download blank template
          </button>
        </div>
        {attachments.map((file) => (
          <article key={file.id}>
            <span>
              <strong>{file.original_name}</strong>
              <small>
                {Math.ceil(file.size_bytes / 1024)} KB ·{" "}
                {new Date(file.created_at).toLocaleDateString("en-KE", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </small>
            </span>
            <button onClick={() => onDownloadAttachment(file)}>Download</button>
          </article>
        ))}
      </details>
      <section className="report-document-group final-outputs">
        <header>
          <div>
            <span>FINAL OUTPUTS</span>
            <h3>Approved assignment deliverables</h3>
          </div>
        </header>
        {documents
          .filter((item) => ["Approved", "Final"].includes(item.status))
          .map((item) => (
            <article key={item.id}>
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.template_name} · v{item.version} · Updated{" "}
                  {new Date(item.updated_at).toLocaleString("en-KE")} ·{" "}
                  {item.created_by_name}
                </small>
              </span>
              <b>{item.status}</b>
              <button onClick={() => onOpen(item.id)}>Preview</button>
            </article>
          ))}
        {!documents.some((item) =>
          ["Approved", "Final"].includes(item.status),
        ) && <p>No final outputs have been approved yet.</p>}
      </section>
    </section>
  );
}
