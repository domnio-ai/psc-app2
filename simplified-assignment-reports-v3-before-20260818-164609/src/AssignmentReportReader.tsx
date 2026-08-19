import { useEffect, useState } from "react";
import { api, type GeneratedDocument } from "./api";
import "./assignment-report-simple-v3.css";

type Props = {
  token: string;
  document: GeneratedDocument;
  assignmentTitle?: string;
  onClose: () => void;
};

const normalize = (value: string) =>
  String(value || "")
    .replaceAll("Ã¢â‚¬”", "—")
    .replaceAll("Ã¢â‚¬Â", "”")
    .replaceAll("Ã‚Â·", "·")
    .replaceAll("Â·", "·");

export default function AssignmentReportReader({ token, document, assignmentTitle, onClose }: Props) {
  const [pdfUrl, setPdfUrl] = useState("");
  const [docxHtml, setDocxHtml] = useState("");
  const [loading, setLoading] = useState(Boolean(document.external_import));
  const [error, setError] = useState("");

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

  return (
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

        {error && <div className="simple-report-message error">{error}</div>}
        {loading && <div className="assignment-report-reader-loading">Opening review copy…</div>}

        {!loading && document.external_import?.mime_type === "application/pdf" && pdfUrl && (
          <iframe className="assignment-report-pdf-reader" src={pdfUrl} title={document.external_import.original_name} />
        )}

        {!loading && document.external_import && document.external_import.mime_type !== "application/pdf" && (
          <main className="assignment-report-docx-reader" dangerouslySetInnerHTML={{ __html: docxHtml }} />
        )}

        {!loading && !document.external_import && (
          <main className="assignment-report-internal-reader">
            {document.sections.map((section) => (
              <section key={section.id}>
                <h2>{section.title}</h2>
                <div dangerouslySetInnerHTML={{ __html: normalize(section.content || "") }} />
              </section>
            ))}
          </main>
        )}
      </section>
    </div>
  );
}
