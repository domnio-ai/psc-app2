import {useEffect,useMemo,useState} from 'react'
import {api,type ReportData,type ReportDefinition,type ReportView,type ReportsSummary} from '../../api'
import InstitutionalReportsDashboard from './pages/InstitutionalReportsDashboard'
import type {IntelligenceTab,ReportCentreView} from './types'
import ReportVisual from './components/ReportVisual'
import ReportTable from './components/ReportTable'
import ReportCataloguePanel from './components/ReportCataloguePanel'
import {label,periodDates} from './utils/reportTableFormatting'
import App2Tabs from '../../components/App2Tabs'
import '../../reports-module.css'
import '../../institutional-reports.css'

export default function ReportsModule({
  token,
  active,
  directorates,
  onOpenAssignment,
  isManager,
}: {
  token: string;
  active: boolean;
  directorates: string[];
  onOpenAssignment: (id: string) => void;
  isManager: boolean;
}) {
  const [catalogue, setCatalogue] = useState<ReportDefinition[]>([]),
    [categories, setCategories] = useState<string[]>([]),
    [selected, setSelected] = useState<ReportDefinition | null>(null),
    [data, setData] = useState<ReportData | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [intelligenceTab,setIntelligenceTab]=useState<IntelligenceTab>("Overview");
  const [reportCentreView,setReportCentreView]=useState<ReportCentreView>('Catalogue');
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
  const exportManagementBrief = async () => {
    if (!selected) return;
    setExporting("brief");
    setError("");
    try {
      const dates =
        filters.period === "Custom"
          ? { from: filters.from, to: filters.to }
          : periodDates(filters.period);
      await api.exportReport(token, selected.key, "pdf", {
        ...filters,
        ...dates,
        profile: "brief",
      });
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Management brief could not be exported.",
      );
    } finally {
      setExporting("");
    }
  };
  const exportDetailedInstitutionalReport = async () => {
    if (!selected) return;
    setExporting("institutional-detailed");
    setError("");
    try {
      const dates =
        filters.period === "Custom"
          ? { from: filters.from, to: filters.to }
          : periodDates(filters.period);
      await api.exportReport(token, selected.key, "pdf", {
        ...filters,
        ...dates,
        profile: "institutional-detailed",
      });
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Detailed institutional report could not be exported.",
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
  const canGovern = ["System Admin", "Deputy Director"].includes(
    String(tokenPayload.role || ""),
  );
  const isResearcher = String(tokenPayload.role || "") === "Researcher";
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
    const deliveryFrequency = frequency as "Daily" | "Weekly" | "Monthly";
    try {
      await api.createReportSchedule(token, {
        reportKey: selected.key,
        name: `${selected.title} — ${frequency}`,
        format: "pdf",
        frequency: deliveryFrequency,
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
  const intelligenceTabs:{id:IntelligenceTab;label:string}[]=[{id:"Overview",label:"Overview"},{id:"Research",label:"Research"},{id:"Contributions",label:isManager?"Team / Contributions":"My Contributions"},{id:"Completed",label:"Published"},{id:"Reports & Exports",label:"Reports & Exports"}];
  const intelligenceNavigation=<App2Tabs idPrefix="reports" className="reports-intelligence-tabs" ariaLabel="Reports sections" activeTab={intelligenceTab} items={intelligenceTabs.map(item=>({id:item.id,label:item.label,panelId:`reports-panel-${item.id.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`}))} onChange={value=>{setIntelligenceTab(value);if(selected)closeReport()}}/>;
  const reportCataloguePanel=<ReportCataloguePanel catalogue={catalogue} visible={visible} view={view} onView={value=>{setView(value);localStorage.setItem('app2-report-view',value)}} level={level} onLevel={setLevel} category={category} onCategory={setCategory} categories={categories} search={search} onSearch={setSearch} canGovern={canGovern} summary={summary} summaryOpen={summaryOpen} onToggleSummary={()=>setSummaryOpen(value=>!value)} isResearcher={isResearcher} onConfigure={()=>void configureReport()} onFavourite={item=>void favourite(item)} onOpen={item=>void openReport(item)}/>;
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
        <div className="report-phase2-tools reports-v3-toolbar">
          <div className="report-tool-group report-tool-view">
            <small>VIEW</small>
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
          </div>
          <div className="report-tool-group report-tool-output">
            <small>EXECUTIVE OUTPUT</small>
            <button
              type="button"
              className="report-management-brief-button"
              onClick={exportManagementBrief}
              disabled={Boolean(exporting)}
              title="Generate a concise portrait A4 PDF from the same governed report data"
            >
              {exporting === "brief" ? "Preparing brief…" : "Management Brief PDF"}
            </button>
            <button
              type="button"
              className="report-detailed-institutional-button"
              onClick={exportDetailedInstitutionalReport}
              disabled={Boolean(exporting)}
              title="Generate the complete formal institutional report with an executive summary, analytics, research, reviews, deadlines, contributions, risks and source records"
            >
              {exporting === "institutional-detailed"
                ? "Preparing comprehensive report…"
                : "Comprehensive Institutional PDF"}
            </button>
          </div>
          <div className="report-tool-group report-tool-data">
            <small>DATASET</small>
            <b title="Tabular extracts of the currently selected report and filters">Dataset exports</b>
            {(["pdf", "docx", "xlsx"] as const).map((format) => (
              <button
                key={format}
                onClick={() => exportReport(format)}
                disabled={Boolean(exporting)}
                title={`${format.toUpperCase()} extract of the selected report's underlying records`}
              >
                {exporting === format
                  ? "Preparing…"
                  : format === "pdf"
                    ? "Tabular PDF"
                    : format.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="report-tool-group report-tool-governance">
            <small>GOVERNANCE</small>
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
            Generating report from current APP2 data…
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
  if(intelligenceTab!=="Reports & Exports")return <section className="reports-management-view report-catalogue institutional-reports-shell"><header><div><small>REPORTS & ANALYTICS</small><h2>Reports & Analytics</h2><p>Management overview, research, team workload and published outputs.</p></div></header>{intelligenceNavigation}<div id={`reports-panel-${intelligenceTab.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`} role="tabpanel" aria-labelledby={`reports-tab-${intelligenceTab.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`}><InstitutionalReportsDashboard token={token} tab={intelligenceTab} catalogue={catalogue} reportCentreView={reportCentreView} onReportCentreView={setReportCentreView} reportCataloguePanel={reportCataloguePanel} onOpenReport={openReport} onOpenAssignment={onOpenAssignment}/></div></section>;
  return (
    <section className="reports-management-view report-catalogue institutional-reports-shell">
      <header><div><small>REPORT CENTRE</small><h2>Reports & Exports</h2><p>Find governed reports, customise a PDF, consolidate selected reports, or prepare a management follow-up printout.</p></div></header>
      {intelligenceNavigation}
      <div id="reports-panel-reports-exports" role="tabpanel" aria-label="Reports and exports">
        <InstitutionalReportsDashboard token={token} tab={intelligenceTab} catalogue={catalogue} reportCentreView={reportCentreView} onReportCentreView={setReportCentreView} reportCataloguePanel={reportCataloguePanel} onOpenReport={openReport} onOpenAssignment={onOpenAssignment}/>
      </div>
    </section>
  );
}