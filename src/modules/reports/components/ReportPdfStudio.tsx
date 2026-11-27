import { useEffect, useMemo, useState } from "react";
import type { InstitutionalIntelligence, ReportDefinition } from "../../../api";
import "../styles/report-pdf-studio.css";

export type PdfReportProfile = "brief" | "institutional-detailed";
export type PdfPaperSize = "A4" | "Letter";

type Props = {
  reports: ReportDefinition[];
  data: InstitutionalIntelligence;
  reportKey: string;
  onReportChange: (key: string) => void;
  period: string;
  from: string;
  to: string;
  exporting: boolean;
  exportMessage: string;
  onExport: (options: {
    profile: PdfReportProfile;
    title: string;
    paperSize: PdfPaperSize;
  }) => void;
};

const profileDetails: Record<PdfReportProfile, { title: string; summary: string; contents: string[] }> = {
  brief: {
    title: "Management brief",
    summary: "A short, portrait document for meetings and quick decisions.",
    contents: ["Cover and reporting basis", "Key indicators", "Management attention", "Priority records"],
  },
  "institutional-detailed": {
    title: "Comprehensive institutional report",
    summary: "A print-ready report with analysis and a complete selected-report record appendix.",
    contents: ["Cover and authorised scope", "Executive summary and visual analytics", "Delivery, deadlines and research", "Reviews, risks and actions", "Team contributions and published reports", "Full selected-report dataset appendix", "Methodology and governance notes"],
  },
};

export default function ReportPdfStudio({
  reports,
  data,
  reportKey,
  onReportChange,
  period,
  from,
  to,
  exporting,
  exportMessage,
  onExport,
}: Props) {
  const selected = useMemo(
    () => reports.find((report) => report.key === reportKey) || reports[0] || null,
    [reports, reportKey],
  );
  const [profile, setProfile] = useState<PdfReportProfile>("institutional-detailed");
  const [paperSize, setPaperSize] = useState<PdfPaperSize>("A4");
  const [documentTitle, setDocumentTitle] = useState(selected?.title || "Institutional Report");

  useEffect(() => {
    if (selected && selected.key !== reportKey) onReportChange(selected.key);
  }, [onReportChange, reportKey, selected]);
  useEffect(() => {
    if (selected) setDocumentTitle(selected.title);
  }, [selected?.key]);

  const details = profileDetails[profile];
  const reportingPeriod = period === "Custom"
    ? `${from || "Start date"} to ${to || "End date"}`
    : period;

  return (
    <section className="report-pdf-studio" aria-labelledby="report-pdf-studio-title">
      <header className="report-pdf-studio-heading">
        <div>
          <small>REPORTS · PDF STUDIO</small>
          <h2 id="report-pdf-studio-title">Customize and print a report</h2>
          <p>Choose the report, reporting filters and document style. APP2 applies your current authorised data scope when it generates the PDF.</p>
        </div>
        <span className="report-pdf-studio-badge">PDF export</span>
      </header>

      <div className="report-pdf-studio-layout">
        <div className="report-pdf-studio-controls">
          <section className="report-pdf-studio-card">
            <header><small>1 · REPORT CONTENT</small><h3>What should the report cover?</h3></header>
            <label>
              <span>Report type</span>
              <select value={selected?.key || ""} onChange={(event) => onReportChange(event.target.value)}>
                {reports.map((report) => <option value={report.key} key={report.key}>{report.title}</option>)}
              </select>
              {selected?.description && <small>{selected.description}</small>}
            </label>
            <label>
              <span>Document title</span>
              <input maxLength={180} value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder={selected?.title || "Report title"} />
            </label>
          </section>

          <section className="report-pdf-studio-card">
            <header><small>2 · DOCUMENT STYLE</small><h3>Choose a print layout</h3></header>
            <div className="report-pdf-profile-options" role="radiogroup" aria-label="PDF report profile">
              {(Object.keys(profileDetails) as PdfReportProfile[]).map((key) => (
                <label className={profile === key ? "selected" : ""} key={key}>
                  <input type="radio" name="report-pdf-profile" value={key} checked={profile === key} onChange={() => setProfile(key)} />
                  <span><strong>{profileDetails[key].title}</strong><small>{profileDetails[key].summary}</small></span>
                </label>
              ))}
            </div>
            <label>
              <span>Paper size</span>
              <select value={paperSize} onChange={(event) => setPaperSize(event.target.value as PdfPaperSize)}>
                <option value="A4">A4 · standard office paper</option>
                <option value="Letter">US Letter</option>
              </select>
            </label>
          </section>

          <section className="report-pdf-studio-card report-pdf-content-list">
            <header><small>INCLUDED IN THIS PDF</small><h3>{details.title}</h3></header>
            <ul>{details.contents.map((item) => <li key={item}>{item}</li>)}</ul>
            {profile === "institutional-detailed" && <p>Complete selected-report appendices are limited to 25,000 records per export. APP2 will ask you to narrow the filters if the report exceeds that limit.</p>}
          </section>
        </div>

        <aside className="report-pdf-preview" aria-label="PDF preview summary">
          <div className="report-pdf-preview-page">
            <div className="report-pdf-preview-cover">
              <small>PUBLIC SERVICE COMMISSION</small>
              <strong>{documentTitle.trim() || selected?.title || "Institutional Report"}</strong>
              <span>{details.title}</span>
            </div>
            <dl>
              <div><dt>Reporting period</dt><dd>{reportingPeriod}</dd></div>
              <div><dt>Authorised scope</dt><dd>{data.scope.type.replaceAll("_", " ")}</dd></div>
              <div><dt>Paper</dt><dd>{paperSize}</dd></div>
              <div><dt>Generated</dt><dd>{new Date(data.generatedAt).toLocaleDateString("en-KE")}</dd></div>
            </dl>
            <div className="report-pdf-preview-lines" aria-hidden="true"><i/><i/><i/><i/></div>
            <small className="report-pdf-preview-footer">Preview summary · final PDF includes page numbers and governance notes</small>
          </div>
          <div className="report-pdf-generate">
            <button type="button" disabled={!selected || exporting} onClick={() => onExport({ profile, title: documentTitle.trim(), paperSize })}>
              {exporting ? "Preparing PDF…" : "Generate and download PDF"}
            </button>
            <p>Your PDF uses the same backend-authorised records as APP2 Reports. The document will be downloaded for printing or sharing under your normal document controls.</p>
            {exportMessage && <div role="status">{exportMessage}</div>}
          </div>
        </aside>
      </div>
    </section>
  );
}
