import { useEffect } from "react";
import { createPortal } from "react-dom";
import "../styles/research-report-preview-modal.css";

export type ResearchReportPreviewSection = {
  id: string;
  title: string;
  content: string;
};

export type ResearchReportPreviewTeamMember = {
  id: string;
  name: string;
  role: string;
};

type Props = {
  open: boolean;
  title: string;
  eyebrow: string;
  subtitle: string;
  previewWarning?: string;
  sections: ResearchReportPreviewSection[];
  team?: ResearchReportPreviewTeamMember[];
  documentControl: { label: string; value: string }[];
  downloadingPdf: boolean;
  downloadMessage: string;
  onDownloadPdf: () => void | Promise<void>;
  onClose: () => void;
};

export default function ResearchReportPreviewModal(props: Props) {
  useEffect(() => {
    if (!props.open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  const populated = props.sections.filter((section) => section.content.trim());

  return createPortal(
    <div
      className="research-preview-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <section
        className="research-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${props.title} preview`}
      >
        <header className="research-preview-modal-header">
          <div>
            <small>{props.eyebrow}</small>
            <h2>{props.title}</h2>
            <p>{props.subtitle}</p>
          </div>
          <button type="button" onClick={props.onClose} aria-label="Close preview">
            ×
          </button>
        </header>

        <main className="research-preview-modal-body">
          {props.previewWarning ? <p className="research-preview-unsaved-warning" role="alert">{props.previewWarning}</p> : null}
          <article className="research-preview-document">
            <div className="research-preview-document-brand">
              <img src="/psc-logo.png" alt="Public Service Commission logo" />
              <div>
                <strong>PUBLIC SERVICE COMMISSION</strong>
                <span>RESEARCH DIRECTORATE · CONTROLLED REPORT</span>
              </div>
            </div>

            <section className="research-preview-document-control" aria-label="Document control">
              <h3>Document Control</h3>
              <dl>
                {props.documentControl.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value || "Not recorded"}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {props.team?.length ? (
              <section className="research-preview-team">
                <h3>Research Team and Roles</h3>
                {props.team.map((member) => (
                  <p key={`${member.id}-${member.role}`}>
                    <strong>{member.name}</strong>
                    <span>{member.role}</span>
                  </p>
                ))}
              </section>
            ) : null}

            {populated.map((section) => (
              <section key={section.id} className="research-preview-section">
                <h3>{section.title}</h3>
                <div dangerouslySetInnerHTML={{ __html: section.content }} />
              </section>
            ))}

            {!populated.length ? (
              <div className="research-preview-empty">
                No saved report content is available for preview yet.
              </div>
            ) : null}
          </article>
        </main>

        <footer className="research-preview-modal-footer">
          <span className="research-preview-download-message" role="status" aria-live="polite">
            {props.downloadMessage || "Controlled Research report · PSC branding and document control are included in the PDF."}
          </span>
          <div>
            <button type="button" className="research-preview-download" onClick={() => void props.onDownloadPdf()} disabled={props.downloadingPdf || !populated.length || Boolean(props.previewWarning)}>
              {props.downloadingPdf ? "Preparing PDF…" : props.previewWarning ? "Save before PDF export" : "Download PDF"}
            </button>
          <button type="button" onClick={props.onClose}>Close Preview</button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
