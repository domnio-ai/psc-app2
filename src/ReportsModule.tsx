import { useEffect, useMemo, useState } from "react";
import {
  api,
  type ReportChart,
  type ReportData,
  type ReportDefinition,
  type ReportView,
  type ReportsSummary,
} from "./api";
import "./reports-module.css";

const dateValue = (date: Date) => date.toISOString().slice(0, 10);
const periodDates = (period: string) => {
  const now = new Date(),
    start = new Date(now),
    end = new Date(now);
  if (period === "Today") return { from: dateValue(now), to: dateValue(now) };
  if (period === "This Week") {
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { from: dateValue(start), to: dateValue(end) };
  }
  if (period === "This Month") {
    start.setDate(1);
    return { from: dateValue(start), to: dateValue(end) };
  }
  if (period === "Last Month") {
    start.setMonth(now.getMonth() - 1, 1);
    end.setDate(0);
    return { from: dateValue(start), to: dateValue(end) };
  }
  if (period === "This Quarter") {
    start.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
    return { from: dateValue(start), to: dateValue(end) };
  }
  if (period === "Last Quarter") {
    const quarter = Math.floor(now.getMonth() / 3);
    start.setMonth((quarter - 1) * 3, 1);
    end.setMonth(quarter * 3, 0);
    return { from: dateValue(start), to: dateValue(end) };
  }
  if (period === "This Year") {
    start.setMonth(0, 1);
    return { from: dateValue(start), to: dateValue(end) };
  }
  if (period === "Last Year") {
    start.setFullYear(now.getFullYear() - 1, 0, 1);
    end.setFullYear(now.getFullYear() - 1, 11, 31);
    return { from: dateValue(start), to: dateValue(end) };
  }
  return { from: "", to: "" };
};
const label = (value: unknown) =>
  String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
const displayReportValue = (column: string, value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  const name = column.toLowerCase(),
    date = new Date(String(value));
  if (
    name.endsWith("_date") ||
    ["due_date", "start_date", "end_date"].includes(name)
  )
    return Number.isNaN(date.getTime())
      ? String(value)
      : new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "Africa/Nairobi",
        }).format(date);
  if (
    name.endsWith("_at") ||
    [
      "created_at",
      "updated_at",
      "generated_at",
      "signed_at",
      "resolved_at",
    ].includes(name)
  )
    return Number.isNaN(date.getTime())
      ? String(value)
      : new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Africa/Nairobi",
        }).format(date);
  return String(value);
};
function ReportVisual({
  chart,
  onDrill,
}: {
  chart: ReportChart;
  onDrill: (field: string, value: string) => void;
}) {
  const series = chart.series || [],
    max = Math.max(
      1,
      ...series.flatMap((item) => [
        Number(item.value || 0),
        Number(item.received || 0),
        Number(item.completed || 0),
      ]),
    );
  if (!series.length)
    return (
      <div className="report-no-data">
        No data available for the selected reporting period.
      </div>
    );
  if (chart.type === "donut") {
    const total = series.reduce(
      (sum, item) => sum + Number(item.value || 0),
      0,
    );
    return (
      <div className="report-donut-layout">
        <div
          className="report-donut"
          style={{
            background: `conic-gradient(${series.map((item, index) => `var(--report-${index % 6}) ${(series.slice(0, index).reduce((n, row) => n + Number(row.value || 0), 0) * 100) / Math.max(1, total)}% ${(series.slice(0, index + 1).reduce((n, row) => n + Number(row.value || 0), 0) * 100) / Math.max(1, total)}%`).join(",")})`,
          }}
        >
          <b>{total}</b>
          <span>Total</span>
        </div>
        <div>
          {series.map((item, index) => (
            <button
              key={item.label}
              onClick={() =>
                chart.drillField && onDrill(chart.drillField, item.label)
              }
            >
              <i style={{ background: `var(--report-${index % 6})` }} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (chart.type === "line") {
    const points = series
      .map(
        (item, index) =>
          `${series.length === 1 ? 50 : (index * 100) / (series.length - 1)},${100 - (Number(item.value ?? item.completed ?? 0) * 90) / max}`,
      )
      .join(" ");
    return (
      <div className="report-line">
        <svg viewBox="0 0 100 110" role="img" aria-label={chart.title}>
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          {series.map((item, index) => (
            <circle
              key={item.label}
              cx={
                series.length === 1 ? 50 : (index * 100) / (series.length - 1)
              }
              cy={100 - (Number(item.value ?? item.completed ?? 0) * 90) / max}
              r="2.3"
            />
          ))}
        </svg>
        <div>
          {series.map((item) => (
            <span key={item.label}>
              {item.label}
              <b>
                {item.value ?? `${item.received || 0}/${item.completed || 0}`}
              </b>
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={`report-bars ${chart.type}`}>
      {series.map((item) => (
        <button
          key={item.label}
          onClick={() =>
            chart.drillField && onDrill(chart.drillField, item.label)
          }
        >
          <span>{item.label}</span>
          <i>
            <b style={{ width: `${(Number(item.value || 0) * 100) / max}%` }} />
          </i>
          <strong>{item.value}</strong>
        </button>
      ))}
    </div>
  );
}
export default function ReportsModule({
  token,
  active,
  directorates,
  onOpenAssignment,
}: {
  token: string;
  active: boolean;
  directorates: string[];
  onOpenAssignment: (id: string) => void;
}) {
  const [catalogue, setCatalogue] = useState<ReportDefinition[]>([]),
    [categories, setCategories] = useState<string[]>([]),
    [selected, setSelected] = useState<ReportDefinition | null>(null),
    [data, setData] = useState<ReportData | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [level, setLevel] = useState("All"),
    [category, setCategory] = useState("All"),
    [view, setView] = useState<"List" | "Cards">(() =>
      localStorage.getItem("app2-report-view") === "Cards" ? "Cards" : "List",
    ),
    [tab, setTab] = useState<"Overview" | "Graphs" | "List">("Overview");
  const [filters, setFilters] = useState({
    period: "This Month",
    from: "",
    to: "",
    division: "",
    status: "",
    priority: "",
    officer: "",
    category: "",
    search: "",
    page: 1,
    pageSize: 25,
  });
  const [savedViews, setSavedViews] = useState<ReportView[]>([]),
    [savingView, setSavingView] = useState(false),
    [exporting, setExporting] = useState("");
  const [decisions, setDecisions] = useState<Record<string, unknown>[]>([]),
    [showDecisions, setShowDecisions] = useState(false),
    [decisionBusy, setDecisionBusy] = useState("");
  const [summary, setSummary] = useState<ReportsSummary | null>(null),
    [summaryOpen, setSummaryOpen] = useState(true);
  useEffect(() => {
    if (!active) return;
    Promise.all([api.reportCatalogue(token), api.reportCategories(token)])
      .then(([reports, items]) => {
        setCatalogue(reports);
        setCategories(items);
      })
      .catch((value) =>
        setError(
          value instanceof Error
            ? value.message
            : "Reports could not be loaded.",
        ),
      );
  }, [active, token]);
  useEffect(() => {
    if (!active || selected || !catalogue.length) return;
    const key = window.location.hash.match(/^#reports\/([^/]+)$/)?.[1];
    const item = catalogue.find(
      (report) => report.key === key && report.available,
    );
    if (item) void openReport(item);
  }, [active, catalogue]);
  const visible = useMemo(
    () =>
      catalogue.filter(
        (item) =>
          (level === "All" ||
            (level === "Favourites" && item.favourite) ||
            item.level === level ||
            (item.level === "BOTH" &&
              ["OPERATIONAL", "EXECUTIVE"].includes(level))) &&
          (category === "All" || item.category === category) &&
          `${item.title} ${item.description} ${item.category}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [catalogue, level, category, search],
  );
  const loadReport = async (definition = selected, next = filters) => {
    if (!definition) return;
    setLoading(true);
    setError("");
    try {
      const dates =
        next.period === "Custom"
          ? { from: next.from, to: next.to }
          : periodDates(next.period);
      setData(
        await api.reportData(token, definition.key, { ...next, ...dates }),
      );
      setSelected(definition);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Report could not be generated.",
      );
    } finally {
      setLoading(false);
    }
  };
  const favourite = async (item: ReportDefinition) => {
    await api.favouriteReport(token, item.key, !item.favourite);
    setCatalogue((rows) =>
      rows.map((row) =>
        row.key === item.key ? { ...row, favourite: !row.favourite } : row,
      ),
    );
    if (selected?.key === item.key)
      setSelected({ ...selected, favourite: !item.favourite });
  };
  const openReport = async (item: ReportDefinition) => {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#reports/${item.key}`,
    );
    setSavedViews(await api.reportViews(token, item.key));
    await loadReport(item);
  };
  const closeReport = () => {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
    setSelected(null);
    setData(null);
    setSavedViews([]);
    setError("");
  };
  const saveView = async () => {
    if (!selected) return;
    const name = window.prompt("Name this report view");
    if (!name) return;
    setSavingView(true);
    try {
      const view = await api.saveReportView(
        token,
        selected.key,
        name,
        filters,
        false,
      );
      setSavedViews((rows) => [
        view,
        ...rows.filter((row) => row.id !== view.id),
      ]);
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "View could not be saved.",
      );
    } finally {
      setSavingView(false);
    }
  };
  const applyView = (view: ReportView) => {
    const next = { ...filters, ...view.filters, page: 1 };
    setFilters(next as typeof filters);
    void loadReport(selected, next as typeof filters);
  };
  const exportReport = async (format: "pdf" | "docx" | "xlsx") => {
    if (!selected) return;
    setExporting(format);
    setError("");
    try {
      const dates =
        filters.period === "Custom"
          ? { from: filters.from, to: filters.to }
          : periodDates(filters.period);
      await api.exportReport(token, selected.key, format, {
        ...filters,
        ...dates,
      });
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Report could not be exported.",
      );
    } finally {
      setExporting("");
    }
  };
  const tokenPayload = (() => {
    try {
      return JSON.parse(
        atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
    } catch {
      return {};
    }
  })();
  const canGovern = ["Administrator", "Research Manager"].includes(
    String(tokenPayload.role || ""),
  );
  const isResearcher = String(tokenPayload.role || "") === "Research Officer";
  useEffect(() => {
    if (!active || !canGovern) return;
    api
      .reportsSummary(token)
      .then(setSummary)
      .catch((value) =>
        setError(
          value instanceof Error
            ? value.message
            : "Report summary could not be loaded.",
        ),
      );
  }, [active, token, canGovern]);
  const scheduleReport = async () => {
    if (!selected) return;
    const recipients = window.prompt(
      "Recipient email addresses, separated by commas",
      String(tokenPayload.email || ""),
    );
    if (!recipients) return;
    const frequency = window.prompt(
      "Delivery frequency: Daily, Weekly or Monthly",
      "Weekly",
    );
    if (!["Daily", "Weekly", "Monthly"].includes(String(frequency)))
      return setError("Choose Daily, Weekly or Monthly.");
    try {
      await api.createReportSchedule(token, {
        reportKey: selected.key,
        name: `${selected.title} — ${frequency}`,
        format: "pdf",
        frequency,
        recipientEmails: recipients
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        filters,
        nextRunAt: new Date(Date.now() + 3600000).toISOString(),
      });
      setError("");
      window.alert(
        "Scheduled report saved. First delivery is due in one hour.",
      );
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Schedule could not be saved.",
      );
    }
  };
  const loadDecisions = async (key = selected?.key) => {
    if (!key || !canGovern) return;
    try {
      setDecisions(await api.reportDecisions(token, key));
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Decisions could not be loaded.",
      );
    }
  };
  const addDecision = async () => {
    if (!selected) return;
    const title = window.prompt("Decision title");
    if (!title) return;
    const decision = window.prompt(
      "Record the management decision or required action",
    );
    if (!decision) return;
    const dueDate =
      window.prompt("Due date (YYYY-MM-DD), or leave blank", "") || null;
    try {
      await api.createReportDecision(token, selected.key, {
        title,
        decision,
        filters,
        dueDate,
      });
      await loadDecisions(selected.key);
      setShowDecisions(true);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Decision could not be recorded.",
      );
    }
  };
  const resolveDecision = async (id: string) => {
    if (
      !selected ||
      !window.confirm("Mark this management decision as resolved?")
    )
      return;
    setDecisionBusy(id);
    try {
      await api.resolveReportDecision(token, selected.key, id);
      await loadDecisions(selected.key);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Decision could not be resolved.",
      );
    } finally {
      setDecisionBusy("");
    }
  };
  const signoff = async () => {
    if (!selected) return;
    const comments = window.prompt(
      "Sign-off comments",
      "Reviewed and accepted as an official management snapshot.",
    );
    if (comments === null) return;
    try {
      const signed = await api.signoffReport(
        token,
        selected.key,
        filters,
        comments,
      );
      window.alert(
        `Report signed off. Integrity record ${String(signed.report_hash || "").slice(0, 12)}…`,
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Report could not be signed off.",
      );
    }
  };
  const configureReport = async () => {
    const key = window.prompt("Report key to enable or disable");
    if (!key) return;
    const enabled = window.confirm(
      "Select OK to enable this report, or Cancel to disable it.",
    );
    const note = window.prompt("Administrative access note", "") || "";
    try {
      await api.updateReportDefinition(token, key, enabled, note);
      setCatalogue(await api.reportCatalogue(token));
      window.alert(`Report ${enabled ? "enabled" : "disabled"}.`);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Report configuration could not be updated.",
      );
    }
  };
  const drill = (field: string, value: string) => {
    const next = { ...filters, [field]: value, page: 1 };
    setFilters(next);
    setTab("List");
    void loadReport(selected, next);
  };
  if (!active) return null;
  if (selected)
    return (
      <section className="reports-management-view report-workspace">
        <header className="report-workspace-head">
          <button
            onClick={() => {
              setSelected(null);
              setData(null);
              setError("");
            }}
          >
            ← Reports
          </button>
          <div>
            <small>
              {selected.level} · {selected.category}
            </small>
            <h2>{selected.title}</h2>
            <p>{selected.description}</p>
          </div>
          <button
            aria-label={
              selected.favourite ? "Remove favourite" : "Add favourite"
            }
            onClick={() => favourite(selected)}
          >
            {selected.favourite ? "★" : "☆"}
          </button>
        </header>
        <div className="report-phase2-tools">
          <label>
            Saved views
            <select
              value=""
              onChange={(event) => {
                const view = savedViews.find(
                  (item) => item.id === event.target.value,
                );
                if (view) applyView(view);
              }}
            >
              <option value="">Choose a saved view</option>
              {savedViews.map((view) => (
                <option value={view.id} key={view.id}>
                  {view.name}
                  {view.is_default ? " (default)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button onClick={saveView} disabled={savingView}>
            {savingView ? "Saving…" : "Save view"}
          </button>
          <span />
          <b>Export</b>
          {(["pdf", "docx", "xlsx"] as const).map((format) => (
            <button
              key={format}
              onClick={() => exportReport(format)}
              disabled={Boolean(exporting)}
            >
              {exporting === format ? "Preparing…" : format.toUpperCase()}
            </button>
          ))}
          <button onClick={scheduleReport}>Schedule</button>
          {canGovern && (
            <>
              <button
                onClick={() => {
                  setShowDecisions((value) => !value);
                  if (!showDecisions) void loadDecisions();
                }}
              >
                Decisions{" "}
                {decisions.filter((item) => item.status === "Open").length ||
                  ""}
              </button>
              <button onClick={addDecision}>New decision</button>
              <button onClick={signoff}>Sign off</button>
            </>
          )}
        </div>
        {canGovern && showDecisions && (
          <aside className="report-decision-panel">
            <header>
              <div>
                <small>MANAGEMENT CONTROL</small>
                <h3>Decisions</h3>
                <p>Actions and determinations recorded against this report.</p>
              </div>
              <button onClick={addDecision}>+ New decision</button>
            </header>
            <div className="report-decision-list">
              {decisions.map((item) => (
                <article
                  className={String(item.status).toLowerCase()}
                  key={String(item.id)}
                >
                  <div>
                    <span>{String(item.status)}</span>
                    <strong>{String(item.title)}</strong>
                    <p>{String(item.decision)}</p>
                    <small>
                      Recorded by{" "}
                      {String(item.created_by_name || "Authorised manager")} ·{" "}
                      {new Date(String(item.created_at)).toLocaleString(
                        "en-KE",
                      )}
                      {item.due_date
                        ? ` · Due ${new Date(String(item.due_date)).toLocaleDateString("en-KE")}`
                        : ""}
                    </small>
                  </div>
                  {item.status === "Open" && (
                    <button
                      disabled={decisionBusy === item.id}
                      onClick={() => resolveDecision(String(item.id))}
                    >
                      {decisionBusy === item.id ? "Saving…" : "Mark resolved"}
                    </button>
                  )}
                </article>
              ))}
              {!decisions.length && (
                <div className="report-no-data">
                  No management decisions have been recorded for this report.
                </div>
              )}
            </div>
          </aside>
        )}
        <form
          className="report-filter-bar"
          onSubmit={(event) => {
            event.preventDefault();
            void loadReport();
          }}
        >
          <label>
            Period
            <select
              value={filters.period}
              onChange={(event) =>
                setFilters({ ...filters, period: event.target.value })
              }
            >
              {[
                "Today",
                "This Week",
                "This Month",
                "Last Month",
                "This Quarter",
                "Last Quarter",
                "This Year",
                "Last Year",
                "Custom",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          {filters.period === "Custom" && (
            <>
              <label>
                From
                <input
                  type="date"
                  value={filters.from}
                  onChange={(event) =>
                    setFilters({ ...filters, from: event.target.value })
                  }
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={filters.to}
                  onChange={(event) =>
                    setFilters({ ...filters, to: event.target.value })
                  }
                />
              </label>
            </>
          )}
          {selected.filters.includes("directorate") && (
            <label>
              Directorate
              <select
                value={filters.division}
                onChange={(event) =>
                  setFilters({ ...filters, division: event.target.value })
                }
              >
                <option value="">All permitted</option>
                {directorates.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
          {selected.filters.includes("status") && (
            <label>
              Status
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters({ ...filters, status: event.target.value })
                }
              >
                <option value="">All</option>
                {[
                  "Not Started",
                  "In Progress",
                  "Ready for Review",
                  "Completed",
                  "Overdue",
                  "Planning",
                  "Active",
                  "Under Review",
                  "Archived",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
          {selected.filters.includes("priority") && (
            <label>
              Priority
              <select
                value={filters.priority}
                onChange={(event) =>
                  setFilters({ ...filters, priority: event.target.value })
                }
              >
                <option value="">All</option>
                {["Low", "Normal", "High", "Critical"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
          {selected.filters.includes("document_category") && (
            <label>
              Document category
              <input
                value={filters.category}
                onChange={(event) =>
                  setFilters({ ...filters, category: event.target.value })
                }
              />
            </label>
          )}
          <button>Apply filters</button>
          <button
            type="button"
            onClick={() => {
              const reset = {
                period: "This Month",
                from: "",
                to: "",
                division: "",
                status: "",
                priority: "",
                officer: "",
                category: "",
                search: "",
                page: 1,
                pageSize: 25,
              };
              setFilters(reset);
              void loadReport(selected, reset);
            }}
          >
            Reset
          </button>
        </form>
        {error && <div className="report-error">{error}</div>}
        {loading && (
          <div className="report-loading">
            Generating report from current App2 data…
          </div>
        )}
        {data && (
          <>
            <div className="report-scope">
              <span>
                Scope:{" "}
                <b>
                  {data.scope.type}
                  {data.scope.division ? ` · ${data.scope.division}` : ""}
                </b>
              </span>
              <span>
                Generated {new Date(data.generatedAt).toLocaleString("en-KE")}
              </span>
            </div>
            {data.notices?.map((notice) => (
              <div className="report-notice" key={notice}>
                {notice}
              </div>
            ))}
            <nav className="report-tabs">
              {(["Overview", "Graphs", "List"] as const).map((value) => (
                <button
                  className={tab === value ? "active" : ""}
                  onClick={() => setTab(value)}
                  key={value}
                >
                  {value}
                </button>
              ))}
            </nav>
            {!data.available ? (
              <div className="report-empty">
                <h3>Report unavailable</h3>
                <p>
                  {data.notices?.[0] ||
                    "The required source data is not available."}
                </p>
              </div>
            ) : (
              <>
                {tab !== "List" && (
                  <>
                    <div className="report-kpi-grid">
                      {data.kpis.map((item) => (
                        <button
                          key={item.key}
                          className={item.status}
                          disabled={!item.available}
                          onClick={() =>
                            item.key === "overdue" && drill("status", "Overdue")
                          }
                        >
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                          {!item.available && (
                            <small>Source field unavailable</small>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="report-chart-grid">
                      {data.charts.map((item) => (
                        <article key={item.key}>
                          <header>
                            <h3>{item.title}</h3>
                            <small>
                              Chart data is available in the List tab.
                            </small>
                          </header>
                          <ReportVisual chart={item} onDrill={drill} />
                        </article>
                      ))}
                    </div>
                    {data.sections?.map((section) => (
                      <article className="report-section" key={section.key}>
                        <h3>{section.title}</h3>
                        {section.message && <p>{section.message}</p>}
                        {section.rows.map((row, index) => (
                          <div key={String(row.id || index)}>
                            {Object.values(row)
                              .slice(1, 5)
                              .map((value, i) => (
                                <span key={i}>{String(value ?? "—")}</span>
                              ))}
                          </div>
                        ))}
                      </article>
                    ))}
                  </>
                )}
                {tab === "List" && (
                  <ReportTable
                    data={data}
                    page={filters.page}
                    onPage={(page) => {
                      const next = { ...filters, page };
                      setFilters(next);
                      void loadReport(selected, next);
                    }}
                    onOpenAssignment={onOpenAssignment}
                  />
                )}
              </>
            )}
          </>
        )}
      </section>
    );
  return (
    <section className="reports-management-view report-catalogue">
      <header>
        <div>
          <small>CENTRAL REPORTING HUB</small>
          <h2>Reports</h2>
          <p>
            Operational detail and executive management reporting from current
            App2 data.
          </p>
        </div>
        <div className="report-view-switch">
          <button
            className={view === "List" ? "active" : ""}
            onClick={() => {
              setView("List");
              localStorage.setItem("app2-report-view", "List");
            }}
          >
            List
          </button>
          <button
            className={view === "Cards" ? "active" : ""}
            onClick={() => {
              setView("Cards");
              localStorage.setItem("app2-report-view", "Cards");
            }}
          >
            Cards
          </button>
        </div>
      </header>
      {canGovern && summary && (
        <section className="all-reports-summary">
          <header>
            <div>
              <small>ORGANISATION-WIDE</small>
              <h3>All Reports Summary</h3>
              <p>
                {summary.availableCount} live reports · generated{" "}
                {new Date(summary.generatedAt).toLocaleString("en-KE")}
              </p>
            </div>
            <button onClick={() => setSummaryOpen((value) => !value)}>
              {summaryOpen ? "Hide summary" : "View all reports"}
            </button>
          </header>
          {summaryOpen && (
            <div>
              {summary.reports.map((item) => (
                <button
                  key={item.key}
                  disabled={!item.available}
                  onClick={() => {
                    const report = catalogue.find(
                      (row) => row.key === item.key,
                    );
                    if (report) void openReport(report);
                  }}
                >
                  <span>
                    <small>{item.category}</small>
                    <strong>{item.title}</strong>
                  </span>
                  <b>{item.recordCount}</b>
                  <em>
                    {item.kpis
                      .slice(0, 2)
                      .map((metric) => `${metric.label}: ${metric.value}`)
                      .join(" · ")}
                  </em>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      {isResearcher && (
        <div className="researcher-report-scope">
          <strong>My reports</strong>
          <span>
            Only your assigned work, research you lead or collaborate on, and
            documents you created are included.
          </span>
        </div>
      )}
      <div className="report-catalogue-tools">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search reports…"
          aria-label="Search reports"
        />
        <nav>
          {["All", "OPERATIONAL", "EXECUTIVE", "Favourites"].map((value) => (
            <button
              className={level === value ? "active" : ""}
              onClick={() => setLevel(value)}
              key={value}
            >
              {label(value)}
            </button>
          ))}
        </nav>
        <select
          aria-label="Report category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option>All</option>
          {categories.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <span>{visible.length} reports</span>
        {String(tokenPayload.role) === "Administrator" && (
          <button onClick={configureReport}>Configure</button>
        )}
      </div>
      {error && <div className="report-error">{error}</div>}
      <div className={`report-catalogue-${view.toLowerCase()}`}>
        {view === "List" && (
          <div className="report-list-head">
            <span>★</span>
            <span>Report</span>
            <span>Level</span>
            <span>Category</span>
            <span>Description</span>
            <span>Period</span>
            <span>Access</span>
            <span>Action</span>
          </div>
        )}
        {visible.map((item) => (
          <article
            key={item.key}
            className={!item.available ? "unavailable" : ""}
          >
            <button
              className="report-star"
              aria-label={item.favourite ? "Remove favourite" : "Add favourite"}
              onClick={() => favourite(item)}
            >
              {item.favourite ? "★" : "☆"}
            </button>
            <div>
              <strong>{item.title}</strong>
              {view === "Cards" && <small>{item.description}</small>}
            </div>
            <b>{item.level}</b>
            <span>{item.category}</span>
            {view === "List" && <p>{item.description}</p>}
            <small>{item.frequency}</small>
            <em>{item.available ? "Available" : item.unavailableReason}</em>
            <button
              disabled={!item.available}
              onClick={() => void openReport(item)}
            >
              {item.available ? "View" : "Unavailable"}
            </button>
          </article>
        ))}
        {!visible.length && (
          <div className="report-empty">
            <h3>No reports match</h3>
            <p>Clear the search or choose another category.</p>
          </div>
        )}
      </div>
    </section>
  );
}
function ReportTable({
  data,
  page,
  onPage,
  onOpenAssignment,
}: {
  data: ReportData;
  page: number;
  onPage: (page: number) => void;
  onOpenAssignment: (id: string) => void;
}) {
  return (
    <div className="report-table-wrap">
      <div className="report-result-count">
        {data.pagination.total} filtered records
      </div>
      <table>
        <thead>
          <tr>
            {data.columns.map((column) => (
              <th key={column}>{label(column)}</th>
            ))}
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, index) => (
            <tr key={String(row.id || index)}>
              {data.columns.map((column) => (
                <td key={column}>{displayReportValue(column, row[column])}</td>
              ))}
              <td>
                {Boolean(row.id) && (
                  <button onClick={() => onOpenAssignment(String(row.id))}>
                    Open
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!data.rows.length && (
        <div className="report-no-data">
          No records match the selected filters.
        </div>
      )}
      <footer>
        <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {data.pagination.page} of {Math.max(1, data.pagination.pages)}
        </span>
        <button
          disabled={page >= data.pagination.pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </footer>
    </div>
  );
}
