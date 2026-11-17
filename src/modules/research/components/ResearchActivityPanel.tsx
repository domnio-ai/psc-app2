import { useState, type Dispatch, type SetStateAction } from "react";
import type { ResearchActivity, ResearchProject } from "../../../api";

type Props = {
  selectedResearch: ResearchProject;
  researchActivity: ResearchActivity[];
  researchActivitySearch: string;
  setResearchActivitySearch: Dispatch<SetStateAction<string>>;
  researchActivityFilter: string;
  setResearchActivityFilter: Dispatch<SetStateAction<string>>;
  setResearchWorkspaceNotice: Dispatch<SetStateAction<string>>;
};

const activityCategory = (action: string) =>
  /REPORT|SECTION/.test(action)
    ? "Report"
    : /SOURCE|EVIDENCE|DOCUMENT/.test(action)
      ? "Evidence"
      : /MILESTONE|PLAN|TEAM|ASSIGN/.test(action)
        ? "Work"
        : /DISCUSSION|COMMENT/.test(action)
          ? "Discussion"
          : /STATUS|COMPLET|APPROV|REVIEW|SUBMIT|FINAL/.test(action)
            ? "Workflow"
            : "General";

const isKeyActivity = (action: string) =>
  /CREATE|MILESTONE|ASSIGN|SOURCE|EVIDENCE|REPORT|SECTION|SUBMIT|REVIEW|APPROV|REJECT|CHANGE|STATUS|COMPLET|FINAL|PUBLISH/.test(
    action,
  );

const activityOutcome = (action: string) =>
  /APPROV/.test(action)
    ? "Approved"
    : /REJECT/.test(action)
      ? "Rejected"
      : /CHANGE/.test(action)
        ? "Changes requested"
        : /SUBMIT/.test(action)
          ? "Submitted"
          : /COMPLET|FINAL|PUBLISH/.test(action)
            ? "Completed"
            : /CREATE|ADD|LINK/.test(action)
              ? "Added"
              : /UPDATE|EDIT|CHANGE/.test(action)
                ? "Updated"
                : "";

const activityActionLabel = (action: string) =>
  action
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function ResearchActivityPanel({
  selectedResearch,
  researchActivity,
  researchActivitySearch,
  setResearchActivitySearch,
  researchActivityFilter,
  setResearchActivityFilter,
  setResearchWorkspaceNotice,
}: Props) {
  const [activityMode, setActivityMode] = useState<"key" | "all">("key");

  const latestActivity = researchActivity[0] || null;

  const filteredActivity = researchActivity.filter((item) => {
    const category = activityCategory(item.action);
    return (
      (activityMode === "all" || isKeyActivity(item.action)) &&
      (researchActivityFilter === "All" || category === researchActivityFilter) &&
      `${item.action} ${item.user_name || ""} ${JSON.stringify(item.details)}`
        .toLowerCase()
        .includes(researchActivitySearch.toLowerCase())
    );
  });

  const exportActivity = () => {
    const rows = [
      ["Date", "User", "Category", "Action", "Details"],
      ...researchActivity.map((item) => [
        new Date(item.created_at).toISOString(),
        item.user_name || "System",
        activityCategory(item.action),
        item.action.replaceAll("_", " "),
        JSON.stringify(item.details),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `research-activity-${selectedResearch.id.slice(0, 8)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setResearchWorkspaceNotice("Research activity exported to CSV.");
  };

  return (
    <section className="research-activity-panel">
      <header className="research-activity-head">
        <div>
          <small>ACTIVITY</small>
          <h3>Project history</h3>
          <p>{latestActivity ? `Latest: ${activityActionLabel(latestActivity.action)} · ${latestActivity.user_name || "System"}` : "No recorded activity yet."}</p>
        </div>

        <button
          type="button"
          disabled={!researchActivity.length}
          onClick={exportActivity}
        >
          Export full audit CSV
        </button>
      </header>

      <div className="research-activity-controls">
        <div className="research-activity-mode" role="group" aria-label="Activity view">
          <button
            type="button"
            className={activityMode === "key" ? "active" : ""}
            aria-pressed={activityMode === "key"}
            onClick={() => setActivityMode("key")}
          >
            Key events
          </button>
          <button
            type="button"
            className={activityMode === "all" ? "active" : ""}
            aria-pressed={activityMode === "all"}
            onClick={() => setActivityMode("all")}
          >
            All activity
          </button>
        </div>

        <div className="research-activity-toolbar">
          <input
            type="search"
            value={researchActivitySearch}
            onChange={(event) => setResearchActivitySearch(event.target.value)}
            placeholder="Search person, action or recorded detail"
          />

          <select
            value={researchActivityFilter}
            onChange={(event) => setResearchActivityFilter(event.target.value)}
            aria-label="Filter activity by area"
          >
            <option>All</option>
            <option>Work</option>
            <option>Evidence</option>
            <option>Report</option>
            <option>Discussion</option>
            <option>Workflow</option>
            <option>General</option>
          </select>
        </div>
      </div>

      <div className="research-activity-result-head">
        <div>
          <strong>
            {activityMode === "key" ? "Key project events" : "Complete activity record"}
          </strong>
          <span>
            {filteredActivity.length} event{filteredActivity.length === 1 ? "" : "s"} shown
          </span>
        </div>
      </div>

      <div className="research-activity-timeline">
        {filteredActivity.map((item) => {
          const category = activityCategory(item.action);
          const outcome = activityOutcome(item.action);

          return (
            <article
              key={item.id}
              className={`category-${category.toLowerCase()}`}
            >
              <i aria-hidden />

              <div className="research-activity-event">
                <header>
                  <div>
                    <b>{category}</b>
                    {outcome && <em>{outcome}</em>}
                  </div>
                  <time>{new Date(item.created_at).toLocaleString("en-KE")}</time>
                </header>

                <strong>{activityActionLabel(item.action)}</strong>

                <p>
                  <span>{item.user_name || "System"}</span>
                  <small>performed this recorded action.</small>
                </p>

                {Object.keys(item.details || {}).length > 0 && (
                  <details>
                    <summary>Recorded audit details</summary>
                    <dl>
                      {Object.entries(item.details).map(([key, value]) => (
                        <div key={key}>
                          <dt>
                            {key
                              .replaceAll("_", " ")
                              .replace(/([A-Z])/g, " $1")}
                          </dt>
                          <dd>
                            {typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value ?? "")}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
              </div>
            </article>
          );
        })}

        {!filteredActivity.length && researchActivity.length > 0 && (
          <div className="research-activity-empty">
            <strong>No activity matches this view</strong>
            <span>
              Change the search, category or switch to All activity.
            </span>
          </div>
        )}

        {!researchActivity.length && (
          <div className="research-activity-empty">
            <strong>No project activity yet</strong>
            <span>
              Controlled actions will appear here automatically as the project
              progresses.
            </span>
          </div>
        )}
      </div>

    </section>
  );
}
