import { useEffect, useMemo, useState } from "react";
import type { ReportDefinition } from "../../../api";
import "../styles/consolidated-report-pack.css";

type Props = {
  reports: ReportDefinition[];
  periodLabel: string;
  exporting: boolean;
  message: string;
  onExport: (reportKeys: string[], options: { title: string; paperSize: "A4" | "Letter" }) => void;
};

export default function ConsolidatedReportPack({ reports, periodLabel, exporting, message, onExport }: Props) {
  const available = useMemo(() => reports.filter((report) => report.available), [reports]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("Institutional Management Report Pack");
  const [paperSize, setPaperSize] = useState<"A4" | "Letter">("A4");
  const visible = useMemo(() => available.filter((report) => `${report.title} ${report.category} ${report.description}`.toLowerCase().includes(search.toLowerCase())), [available, search]);

  useEffect(() => {
    setSelected((current) => {
      const retained = current.filter((key) => available.some((report) => report.key === key));
      return retained.length || !available.length ? retained : [available[0].key];
    });
  }, [available]);

  const toggle = (key: string) => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const toggleVisible = () => {
    const keys = visible.map((report) => report.key);
    const everyVisibleSelected = keys.length > 0 && keys.every((key) => selected.includes(key));
    setSelected((current) => everyVisibleSelected ? current.filter((key) => !keys.includes(key)) : [...new Set([...current, ...keys])]);
  };

  return (
    <section className="consolidated-report-pack" aria-labelledby="consolidated-report-pack-title">
      <header className="consolidated-report-pack-heading">
        <div><small>PRINT CENTRE · PSC CONTROLLED REPORTS</small><h2 id="consolidated-report-pack-title">Consolidate reports into one PDF</h2><p>Select the reports to include. APP2 combines their summaries and complete permitted record lists into one printable pack.</p></div>
        <strong>{selected.length} selected</strong>
      </header>
      <div className="consolidated-report-pack-grid">
        <section className="consolidated-report-pack-picker">
          <header><h3>Choose reports</h3><button type="button" onClick={toggleVisible}>{visible.length > 0 && visible.every((report) => selected.includes(report.key)) ? "Clear visible" : "Select visible"}</button></header>
          <label className="consolidated-report-pack-search">Search reports<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by report or category"/></label>
          <div className="consolidated-report-pack-list">
            {visible.map((report) => <label key={report.key} className={selected.includes(report.key) ? "selected" : ""}>
              <input type="checkbox" checked={selected.includes(report.key)} onChange={() => toggle(report.key)}/>
              <span><strong>{report.title}</strong><small>{report.category}{report.description ? ` · ${report.description}` : ""}</small></span>
            </label>)}
            {!visible.length && <p className="consolidated-report-pack-empty">No available reports match this search.</p>}
          </div>
          <footer><button type="button" onClick={() => setSelected(available.map((report) => report.key))}>Select all available</button><button type="button" onClick={() => setSelected([])}>Clear selection</button></footer>
        </section>
        <section className="consolidated-report-pack-options">
          <header><small>PACK SETTINGS</small><h3>Print-ready output</h3></header>
          <label>Pack title<input maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Paper size<select value={paperSize} onChange={(event) => setPaperSize(event.target.value as "A4" | "Letter")}><option value="A4">A4</option><option value="Letter">US Letter</option></select></label>
          <dl><div><dt>Reporting period</dt><dd>{periodLabel}</dd></div><div><dt>Authorised scope</dt><dd>Enforced for each report by APP2</dd></div><div><dt>Selected reports</dt><dd>{selected.length} of {available.length} available</dd></div></dl>
          <p className="consolidated-report-pack-note">Each report includes its own summary and underlying records. The combined pack is limited to 25,000 records across all selected reports; reduce the selection or reporting period if it exceeds that limit.</p>
          <button className="consolidated-report-pack-generate" type="button" disabled={!selected.length || exporting || !title.trim()} onClick={() => onExport(selected, { title: title.trim(), paperSize })}>{exporting ? "Preparing consolidated PDF…" : "Generate consolidated PDF"}</button>
          {message && <p className="consolidated-report-pack-status" role="status">{message}</p>}
        </section>
      </div>
    </section>
  );
}
