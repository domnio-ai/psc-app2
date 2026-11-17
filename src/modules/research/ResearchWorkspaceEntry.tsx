import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ExternalResearchImport, ResearchProject } from "../../api";
import ResearchPortfolioCard from "./components/ResearchPortfolioCard";
import ResearchPortfolioListRow from "./components/ResearchPortfolioListRow";
import ResearchPortfolioSummary from "./components/ResearchPortfolioSummary";
import App2Tabs from "../../components/App2Tabs";
import {
  loadResearchScope,
  type ResearchScopeView,
} from "./services/researchScopeService";
import "./research-control-centre.css";
import { currentResearchWorkflowStatuses, researchDeadlineState, researchStatusOf } from "./researchStatus";

type Mode = "Workspace" | "Imported";
type PortfolioView = "List" | "Cards";

type Props = {
  token: string;
  active: boolean;
  researchRows: ResearchProject[];
  externalResearchRows: ExternalResearchImport[];
  userRole: string;
  isManager: boolean;
  requestedMode: Mode;
  modeRequestKey: number;
  onCreateResearch: () => void;
  onImportExternal: () => void;
  onOpenWorkspace: (project: ResearchProject) => void;
  onOpenExternal: (item: ExternalResearchImport) => void;
};

const workspaceStatuses = ["All", "Current", "Planning", "Active", "Under Review", "Changes Requested", "Ready to Publish", "Due Soon", "Overdue", "Rejected", "Completed", "Archived"] as const;

const importedStatuses = [
  "All",
  "Pending Review",
  "Under Review",
  "Revision Requested",
  "Resubmitted",
  "Published",
  "Rejected",
] as const;

const scopeLabels: Record<ResearchScopeView, string> = {
  my: "Research where you are the lead or a working team member",
  team: "Research within your authorised team scope",
  reviews: "Research formally assigned to you for review",
};

export default function ResearchWorkspaceEntry({
  token,
  active,
  researchRows,
  externalResearchRows,
  userRole,
  isManager,
  requestedMode,
  modeRequestKey,
  onCreateResearch,
  onImportExternal,
  onOpenWorkspace,
  onOpenExternal,
}: Props) {
  const [mode, setMode] = useState<Mode>("Workspace");
  const [scopeView, setScopeView] = useState<ResearchScopeView>(isManager ? "team" : "my");
  const [portfolioView, setPortfolioView] = useState<PortfolioView>("List");
  const [scopedResearch, setScopedResearch] =
    useState<ResearchProject[]>(researchRows);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [scopeError, setScopeError] = useState("");
  const [scopeRows, setScopeRows] = useState<Partial<Record<ResearchScopeView, ResearchProject[]>>>({
    my: researchRows,
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Current");
  const [cardPopup, setCardPopup] = useState<{ title: string; rows: ResearchProject[] } | null>(null);
  const organisationResearchScope = ["System Admin", "Director"].includes(userRole);
  const activeScopeLabel =
    scopeView === "team" && organisationResearchScope
      ? "Research across your authorised directorate scope"
      : scopeLabels[scopeView];
  const teamScopeTabLabel = organisationResearchScope
    ? "Directorate Research"
    : "Team Research";


  useEffect(() => {
    setMode(requestedMode);
    setSearch("");
    setStatus(requestedMode === "Workspace" ? "Current" : "All");
  }, [modeRequestKey, requestedMode]);

  useEffect(() => {
    if (isManager && scopeView === "my") {
      setScopeView("team");
      return;
    }
    if (!isManager && scopeView === "team") {
      setScopeView("my");
    }
  }, [isManager]);

  useEffect(() => {
    if (!cardPopup) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCardPopup(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [cardPopup]);

  useEffect(() => {
    setScopeRows((current) => ({ ...current, my: researchRows }));
    if (scopeView === "my") {
      setScopedResearch(researchRows);
      setScopeError("");
    }
  }, [researchRows, scopeView]);

  useEffect(() => {
    if (!active || mode !== "Workspace") return;

    let cancelled = false;
    let debounce: number | null = null;

    const views: ResearchScopeView[] = isManager
      ? ["my", "team", "reviews"]
      : ["my", "reviews"];

    const refreshPortfolioScopes = async () => {
      const results = await Promise.all(
        views.map(async (view) => {
          try {
            const rows = await loadResearchScope(token, view);
            return [view, rows] as const;
          } catch {
            return [view, null] as const;
          }
        }),
      );

      if (cancelled) return;

      setScopeRows((current) => {
        const next = { ...current };
        for (const [view, rows] of results) {
          if (rows) next[view] = rows;
        }
        return next;
      });

      const selected = results.find(([view, rows]) => view === scopeView && rows)?.[1];
      if (selected) {
        setScopedResearch(selected);
        setScopeError("");
      }
      setScopeLoading(false);
    };

    const scheduleRefresh = () => {
      if (debounce !== null) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        debounce = null;
        void refreshPortfolioScopes();
      }, 120);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };

    setScopeLoading(true);
    void refreshPortfolioScopes();
    window.addEventListener("app2:workflow-changed", scheduleRefresh);
    window.addEventListener("focus", scheduleRefresh);
    document.addEventListener("visibilitychange", onVisibility);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") scheduleRefresh();
    }, 10000);

    return () => {
      cancelled = true;
      window.removeEventListener("app2:workflow-changed", scheduleRefresh);
      window.removeEventListener("focus", scheduleRefresh);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
      if (debounce !== null) window.clearTimeout(debounce);
    };
  }, [active, isManager, mode, scopeView, token]);

  useEffect(() => {
    if (!active || mode !== "Workspace") return;
    const cached = scopeRows[scopeView];
    if (cached) {
      setScopedResearch(cached);
      setScopeLoading(false);
      setScopeError("");
    }
  }, [active, mode, scopeRows, scopeView]);

  const visibleResearch = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return scopedResearch.filter((project) => {
      const lifecycleStatus=researchStatusOf(project);
      const deadlineState=researchDeadlineState(project);
      if (status === "Current" && !currentResearchWorkflowStatuses.has(lifecycleStatus)) return false;
      if (status === "Due Soon" && deadlineState !== "due-soon") return false;
      if (status === "Overdue" && deadlineState !== "overdue") return false;
      if (!["All","Current","Due Soon","Overdue"].includes(status) && lifecycleStatus !== status) return false;
      if (!needle) return true;

      const haystack = [
        project.title,
        project.summary,
        project.research_question,
        project.lead_name,
        ...(project.collaborators || []).map((person) => person.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [scopedResearch, search, status]);

  const visibleImported = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return externalResearchRows.filter((item) => {
      if (status !== "All" && item.status !== status) return false;
      if (!needle) return true;

      const haystack = [
        item.title,
        item.description,
        item.author,
        item.institution,
        item.directorate,
        item.research_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [externalResearchRows, search, status]);

  const activeCount = scopedResearch.filter((item) => researchStatusOf(item) === "Active").length;
  const planningCount = scopedResearch.filter((item) => researchStatusOf(item) === "Planning").length;
  const awaitingReview = scopedResearch.filter(
    (item) => researchStatusOf(item) === "Under Review",
  ).length;
  const changesRequestedCount = scopedResearch.filter(
    (item) => researchStatusOf(item) === "Changes Requested",
  ).length;
  const readyToPublishCount = scopedResearch.filter(
    (item) => researchStatusOf(item) === "Ready to Publish",
  ).length;
  const dueSoonCount = scopedResearch.filter(
    (item) => researchDeadlineState(item) === "due-soon",
  ).length;
  const overdueCount = scopedResearch.filter(
    (item) => researchDeadlineState(item) === "overdue",
  ).length;
  const currentScopeCount = scopedResearch.filter(
    (item) => currentResearchWorkflowStatuses.has(researchStatusOf(item)),
  ).length;
  const currentCountFor = (view: ResearchScopeView) =>
    (scopeRows[view] || []).filter((item) =>
      currentResearchWorkflowStatuses.has(researchStatusOf(item)),
    ).length;
  const teamResearchCount = currentCountFor("team");
  const myReviewRows = scopeRows.reviews || [];
  const myResearchCurrentCount = (scopeRows.my || []).filter((item) => currentResearchWorkflowStatuses.has(researchStatusOf(item))).length;


  if (!active) return null;

  const openResearchCard = (title: string, filter: string) => {
    const rows = scopedResearch.filter((project) => {
      const lifecycle = researchStatusOf(project);
      const deadline = researchDeadlineState(project);
      if (filter === "Current") return currentResearchWorkflowStatuses.has(lifecycle);
      if (filter === "Due Soon") return deadline === "due-soon";
      if (filter === "Overdue") return deadline === "overdue";
      return lifecycle === filter;
    });
    setCardPopup({ title, rows });
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    setSearch("");
    setStatus(next === "Workspace" ? "Current" : "All");
  };

  const changeScope = (next: ResearchScopeView) => {
    setScopeView(next);
    setSearch("");
    setStatus("Current");
    setScopeError("");

    const cached = scopeRows[next];
    if (cached) {
      setScopedResearch(cached);
    } else if (next === "my") {
      setScopedResearch(researchRows);
    }
  };

  return (
    <section className="research-management-view research-control-centre">
      <header className="research-control-hero research-command-centre-head">
        <div>
          <p>RESEARCH</p>
          <h2>Research workspace</h2>
          <span>Plan, conduct, review and publish governed research in one place.</span>
        </div>

        <div className="research-control-actions">
          <span className="research-scope-context" aria-live="polite">
            {scopeLoading ? "Refreshing scope…" : `${scopedResearch.length} in scope · ${currentScopeCount} current · ${dueSoonCount} due soon · ${overdueCount} overdue`}
          </span>
          <button type="button" className="secondary" onClick={onImportExternal}>
            Import completed research
          </button>

          {isManager && (
            <button type="button" className="primary" onClick={onCreateResearch}>
              <span aria-hidden="true">+</span> New research
            </button>
          )}
        </div>
      </header>

      <ResearchPortfolioSummary
        scopeLabel={activeScopeLabel}
        totalWorkspaces={currentScopeCount}
        allWorkspaces={scopedResearch.length}
        active={activeCount}
        planning={planningCount}
        awaitingReview={awaitingReview}
        changesRequested={changesRequestedCount}
        readyToPublish={readyToPublishCount}
        dueSoon={dueSoonCount}
        overdue={overdueCount}
        imported={externalResearchRows.length}
        activeFilter={status}
        onSelectFilter={(filter, title) => {
          setStatus(filter);
          setSearch("");
          openResearchCard(title, filter);
        }}
      />

      <div className="research-control-navigation research-command-centre-navigation">
        <App2Tabs
          idPrefix="research-record"
          className="research-control-mode research-control-mode-pro research-segmented-group"
          ariaLabel="Research record type"
          activeTab={mode}
          onChange={changeMode}
          items={[
            { id: "Workspace", label: "Research Workspaces", panelId: "research-workspace-panel" },
            { id: "Imported", label: <>Imported Research <b>{externalResearchRows.length}</b></>, panelId: "research-imported-panel" },
          ]}
        />

        {mode === "Workspace" && (
          <App2Tabs
            idPrefix="research-scope"
            className="research-scope-tabs research-scope-tabs-pro research-segmented-group"
            ariaLabel="Research access scope"
            activeTab={scopeView}
            onChange={changeScope}
            items={[
              { id: "my", label: <><span>My Research</span><b>{myResearchCurrentCount}</b></> },
              ...(isManager ? [{ id: "team" as const, label: <><span>{teamScopeTabLabel}</span><b>{teamResearchCount}</b></> }] : []),
              { id: "reviews", label: <><span>My Reviews</span><b>{myReviewRows.length}</b></> },
            ]}
          />
        )}
      </div>

      <div className="research-control-toolbar research-control-toolbar-pro research-command-centre-toolbar">
        <label className="research-control-search">
          <span>{mode === "Workspace" ? "Search research" : "Search imported research"}</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              mode === "Workspace"
                ? "Search title, lead, topic or keyword"
                : "Search title, author, institution or topic"
            }
          />
        </label>

        <label className="research-control-status">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {(mode === "Workspace" ? workspaceStatuses : importedStatuses).map((item) => (
              <option key={item} value={item}>
                {item === "All" ? "All statuses" : item === "Current" ? "Current research" : item}
              </option>
            ))}
          </select>
        </label>

        {mode === "Workspace" && (
          <div className="research-view-switch research-view-switch-pro" role="group" aria-label="Research display">
            <span>View</span>
            <button
              type="button"
              className={portfolioView === "List" ? "active" : ""}
              aria-pressed={portfolioView === "List"}
              onClick={() => setPortfolioView("List")}
            >
              List
            </button>
            <button
              type="button"
              className={portfolioView === "Cards" ? "active" : ""}
              aria-pressed={portfolioView === "Cards"}
              onClick={() => setPortfolioView("Cards")}
            >
              Cards
            </button>
          </div>
        )}

        <strong className="research-result-count">
          {mode === "Workspace" ? visibleResearch.length : visibleImported.length}
          <span>
            {mode === "Workspace" ? " records in this scope" : " imported records"}
          </span>
        </strong>
      </div>

      {mode === "Workspace" ? (
        <div id="research-workspace-panel" role="tabpanel" aria-labelledby="research-record-tab-workspace" className="research-control-groups">
          {scopeLoading && (
            <div className="research-scope-state" role="status">
              <strong>Loading authorised research…</strong>
              <span>{activeScopeLabel}</span>
            </div>
          )}

          {scopeError && (
            <div className="research-scope-state error" role="alert">
              <strong>Research scope could not be loaded</strong>
              <span>{scopeError}</span>
            </div>
          )}

          {!scopeLoading && !scopeError && visibleResearch.length > 0 && (
            <section className="research-control-group research-control-group-unified">
              <header className="research-unified-list-head">
                <div>
                  <h3>{status === "All" ? "Research in this scope" : status === "Current" ? "Current research" : status}</h3>
                  <span>{activeScopeLabel}</span>
                </div>
                <b>{visibleResearch.length}</b>
              </header>

              {portfolioView === "List" ? (
                <div className="research-control-list">
                  {visibleResearch.map((project) => (
                    <ResearchPortfolioListRow
                      key={project.id}
                      project={project}
                      onOpen={onOpenWorkspace}
                    />
                  ))}
                </div>
              ) : (
                <div className="research-control-grid">
                  {visibleResearch.map((project) => (
                    <ResearchPortfolioCard
                      key={project.id}
                      project={project}
                      onOpen={onOpenWorkspace}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {!scopeLoading && !scopeError && !visibleResearch.length && (
            <div className="research-control-empty">
              <strong>No research matches this view</strong>
              <span>{scopeLabels[scopeView]}.</span>
            </div>
          )}
        </div>
      ) : (
        <div id="research-imported-panel" role="tabpanel" aria-labelledby="research-record-tab-imported" className="research-control-imported">
          {visibleImported.map((item) => (
            <article key={item.id}>
              <div>
                <span className="research-imported-badge">IMPORTED · READER ONLY</span>
                <h3>{item.title}</h3>
                <p>{item.description || item.research_type}</p>
              </div>

              <dl>
                <div>
                  <dt>Submitted by</dt>
                  <dd>{item.submitted_by_name}</dd>
                </div>
                <div>
                  <dt>Reviewer(s)</dt>
                  <dd>
                    {item.reviewers?.map((reviewer) => reviewer.name).join(", ") ||
                      "Not assigned"}
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{item.status}</dd>
                </div>
              </dl>

              <button type="button" onClick={() => onOpenExternal(item)}>
                {item.can_review &&
                ["Pending Review", "Resubmitted", "Under Review"].includes(item.status)
                  ? "Review"
                  : item.status === "Revision Requested" && item.can_upload_revision
                    ? "Open revision"
                    : "Open reader"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            </article>
          ))}

          {!visibleImported.length && (
            <div className="research-control-empty">
              <strong>No imported research matches this view</strong>
              <span>Adjust the search or review status.</span>
            </div>
          )}
        </div>
      )}

      {cardPopup && createPortal(
        <div className="command-popup-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCardPopup(null);
        }}>
          <section className="command-popup" role="dialog" aria-modal="true" aria-label={`${cardPopup.title} research`}>
            <header className="command-popup-head">
              <div><small>RESEARCH</small><h4>{cardPopup.title}</h4><p>{cardPopup.rows.length} authorised research record{cardPopup.rows.length === 1 ? "" : "s"}</p></div>
              <button type="button" aria-label="Close popup" onClick={() => setCardPopup(null)}>×</button>
            </header>
            <div className="command-popup-list">
              {cardPopup.rows.map((project) => <article key={project.id}>
                <div className="command-popup-record"><small>{project.lead_name || "Research team"} · Due {project.end_date ? new Date(project.end_date).toLocaleDateString("en-KE") : "Not set"}</small><strong>{project.title}</strong><span>{researchStatusOf(project)} · {project.summary || project.research_question || "No summary recorded"}</span></div>
                <button type="button" onClick={() => { setCardPopup(null); onOpenWorkspace(project); }}>Open exact record</button>
              </article>)}
              {!cardPopup.rows.length && <div className="command-popup-empty">No authorised research records match this card.</div>}
            </div>
            <footer className="command-popup-footer"><button type="button" onClick={() => setCardPopup(null)}>Close</button></footer>
          </section>
        </div>, document.body,
      )}
    </section>
  );
}
