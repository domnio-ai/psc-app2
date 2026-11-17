import { useState } from "react";
import type { ApiAssignment } from "../../api";
import {
  assignmentDisplayStatus,
  assignmentHealthFor,
  assignmentRef,
} from "./utils/assignmentFormatting";
import { deadlineState } from "../../utils/deadlines";
import AssignmentsCommandCentre, { assignmentMatchesCommandFocus, type AssignmentCommandFocus } from "./AssignmentsCommandCentre";

type AssignmentView = "List" | "Cards" | "Board" | "Calendar" | "Workload";
type AssignmentDueFilter = "All" | "Due Soon" | "Overdue" | "No Due Date";
type AssignmentHealthFilter = "All" | "On Track" | "At Risk" | "Overdue";

type Props = {
  rows: ApiAssignment[];
  currentUserName: string;
  isManager: boolean;
  notice: string;
  onOpen: (assignment: ApiAssignment) => void | Promise<void>;
  onEdit: (assignment?: ApiAssignment) => void;
  onDelete: (assignment: ApiAssignment) => void | Promise<void>;
  onUpdateStatus: (assignment: ApiAssignment, status: string) => Promise<void>;
};

const initialsFor = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

const formatAssignmentDate = (value: string | null | undefined) => {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-KE");
};

const taskDateValue = (value: string | null | undefined) => {
  if (!value) return "";
  const raw = String(value).trim();
  const isoDate = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};

/**
 * Assignment portfolio presentation and state.
 * Rows are already backend-authorised; this component never broadens scope.
 */
export default function AssignmentsPortfolio({
  rows: assignmentRows,
  currentUserName,
  isManager,
  notice: assignmentNotice,
  onOpen,
  onEdit,
  onDelete,
}: Props) {
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentStatus, setAssignmentStatus] = useState("All");
  const [assignmentPriority, setAssignmentPriority] = useState("All");
  const [assignmentView, setAssignmentView] = useState<AssignmentView>(() => {
    const saved = sessionStorage.getItem("app2-assignment-view");
    return ["List", "Cards", "Board", "Calendar", "Workload"].includes(saved || "")
      ? (saved as AssignmentView)
      : "List";
  });
  const [assignmentDivision, setAssignmentDivision] = useState("All");
  const [assignmentMember, setAssignmentMember] = useState("All");
  const [assignmentDue, setAssignmentDue] = useState<AssignmentDueFilter>("All");
  const [assignmentHealth, setAssignmentHealth] =
    useState<AssignmentHealthFilter>("All");
  const [assignmentMine, setAssignmentMine] = useState(false);
  const [assignmentCommandFocus, setAssignmentCommandFocus] = useState<AssignmentCommandFocus | null>(null);
  const advancedFilterCount = [
    assignmentStatus !== "All",
    assignmentPriority !== "All",
    assignmentDivision !== "All",
    assignmentMember !== "All",
    assignmentDue !== "All",
    assignmentHealth !== "All",
    assignmentMine,
  ].filter(Boolean).length;

  const filteredAssignments = assignmentRows.filter((item) => {
    const text =
      `${item.title} ${item.description} ${item.division}`.toLowerCase();
    const dueState = deadlineState(item.due_date, item.status);
    const matchesDue =
      assignmentDue === "All" ||
      (assignmentDue === "Due Soon" && dueState === "almost-due") ||
      (assignmentDue === "Overdue" && dueState === "overdue") ||
      (assignmentDue === "No Due Date" && !item.due_date);

    return (
      (!assignmentCommandFocus || assignmentMatchesCommandFocus(item, assignmentCommandFocus)) &&
      item.status !== "Completed" &&
      text.includes(assignmentSearch.toLowerCase()) &&
      (assignmentStatus === "All" || item.status === assignmentStatus) &&
      (assignmentPriority === "All" || item.priority === assignmentPriority) &&
      (assignmentDivision === "All" || item.division === assignmentDivision) &&
      (assignmentMember === "All" ||
        item.members.some((member) => member.id === assignmentMember)) &&
      (assignmentHealth === "All" ||
        assignmentHealthFor(item) === assignmentHealth) &&
      (!assignmentMine ||
        item.members.some((member) => member.name === currentUserName)) &&
      matchesDue
    );
  });

  const clearAssignmentFilters = () => {
    setAssignmentSearch("");
    setAssignmentStatus("All");
    setAssignmentPriority("All");
    setAssignmentDivision("All");
    setAssignmentMember("All");
    setAssignmentDue("All");
    setAssignmentHealth("All");
    setAssignmentMine(false);
    setAssignmentCommandFocus(null);
  };

  return (
    <>
              <AssignmentsCommandCentre
                rows={assignmentRows}
                currentUserName={currentUserName}
                onOpen={onOpen}
                onFocus={(focus) => {
                  const matches = assignmentRows.filter((item) =>
                    assignmentMatchesCommandFocus(item, focus),
                  );
              
                  if (matches.length === 1) {
                    void onOpen(matches[0]);
                    return;
                  }
              
                  clearAssignmentFilters();
                  setAssignmentCommandFocus(focus);
                  setAssignmentView("List");
                  sessionStorage.setItem("app2-assignment-view", "List");
              
                  window.requestAnimationFrame(() => {
                    document
                      .querySelector(".assignment-list-view, .assignment-card-view, .assignment-kanban")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
              />
              <div className="assignment-phase3">
<div className="assignment-command-bar">
                  <div
                    className="assignment-view-switch"
                    role="tablist"
                    aria-label="Assignment views"
                  >
                    {(["List", "Cards", "Board", "Calendar", "Workload"] as const).map(
                      (view) => (
                        <button
                          role="tab"
                          aria-selected={assignmentView === view}
                          className={assignmentView === view ? "active" : ""}
                          key={view}
                          onClick={() => {
                            setAssignmentView(view);
                            sessionStorage.setItem("app2-assignment-view", view);
                          }}
                        >
                          {view}
                        </button>
                      ),
                    )}
                  </div>
                  <strong>
                    {filteredAssignments.length} of {assignmentRows.length}{" "}
                    assignments
                  </strong>
                </div>
                <div className="assignment-filters assignment-filters-compact">
                  <label className="assignment-filter-search">
                    <span>Search assignments</span>
                    <input
                      value={assignmentSearch}
                      onChange={(event) =>
                        setAssignmentSearch(event.target.value)
                      }
                      placeholder="Reference, title, division or description"
                    />
                  </label>

                  <details className="assignment-advanced-filters">
                    <summary>
                      <span>Filters</span>
                      {advancedFilterCount > 0 && <b>{advancedFilterCount}</b>}
                    </summary>

                    <div className="assignment-advanced-filter-grid">
                      <label>
                        <span>Status</span>
                        <select
                          value={assignmentStatus}
                          onChange={(event) =>
                            setAssignmentStatus(event.target.value)
                          }
                        >
                          {[
                            "All",
                            "Not Started",
                            "In Progress",
                            "Ready for Review",
                            "Overdue",
                          ].map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>Priority</span>
                        <select
                          value={assignmentPriority}
                          onChange={(event) =>
                            setAssignmentPriority(event.target.value)
                          }
                        >
                          {["All", "Low", "Normal", "High", "Critical"].map(
                            (value) => (
                              <option key={value}>{value}</option>
                            ),
                          )}
                        </select>
                      </label>

                      <label>
                        <span>Division</span>
                        <select
                          value={assignmentDivision}
                          onChange={(event) =>
                            setAssignmentDivision(event.target.value)
                          }
                        >
                          <option>All</option>
                          {[...new Set(assignmentRows.map((item) => item.division))]
                            .sort()
                            .map((value) => (
                              <option key={value}>{value}</option>
                            ))}
                        </select>
                      </label>

                      <label>
                        <span>Team member</span>
                        <select
                          value={assignmentMember}
                          onChange={(event) =>
                            setAssignmentMember(event.target.value)
                          }
                        >
                          <option value="All">All</option>
                          {[
                            ...new Map(
                              assignmentRows
                                .flatMap((item) => item.members)
                                .map((member) => [member.id, member]),
                            ).values(),
                          ]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((member) => (
                              <option value={member.id} key={member.id}>
                                {member.name}
                              </option>
                            ))}
                        </select>
                      </label>

                      <label>
                        <span>Due</span>
                        <select
                          value={assignmentDue}
                          onChange={(event) =>
                            setAssignmentDue(
                              event.target.value as typeof assignmentDue,
                            )
                          }
                        >
                          {["All", "Due Soon", "Overdue", "No Due Date"].map(
                            (value) => (
                              <option key={value}>{value}</option>
                            ),
                          )}
                        </select>
                      </label>

                      <label>
                        <span>Health</span>
                        <select
                          value={assignmentHealth}
                          onChange={(event) =>
                            setAssignmentHealth(
                              event.target.value as typeof assignmentHealth,
                            )
                          }
                        >
                          {["All", "On Track", "At Risk", "Overdue"].map(
                            (value) => (
                              <option key={value}>{value}</option>
                            ),
                          )}
                        </select>
                      </label>

                      <label className="my-assignments-filter">
                        <input
                          type="checkbox"
                          checked={assignmentMine}
                          onChange={(event) =>
                            setAssignmentMine(event.target.checked)
                          }
                        />
                        <span>My assignments</span>
                      </label>

                      <button
                        type="button"
                        className="clear-assignment-filters"
                        onClick={clearAssignmentFilters}
                      >
                        Clear filters
                      </button>
                    </div>
                  </details>
                </div>
                {assignmentNotice && (
                  <div className="session-message">{assignmentNotice}</div>
                )}
                {assignmentView === "List" && (
                  <div className="assignment-list-view">
                    <div className="assignment-list-head">
                      <span>Reference / Assignment</span>
                      <span>Division</span>
                      <span>Lead & Team</span>
                      <span>Priority</span>
                      <span>Status</span>
                      <span>Due</span>
                      <span>Health</span>
                      <span>Actions</span>
                    </div>
                    {filteredAssignments.map((item) => {
                      const lead =
                        item.members.find((member) => member.role === "Lead") ||
                        item.members[0];
                      const normalizedDueDate = taskDateValue(item.due_date);
                      const days = normalizedDueDate
                        ? Math.ceil(
                            (new Date(`${normalizedDueDate}T23:59:59`).getTime() -
                              Date.now()) /
                              86400000,
                          )
                        : null;
                      return (
                        <article key={item.id}>
                          <button
                            className="assignment-name-cell"
                            onClick={() => onOpen(item)}
                          >
                            <small>{assignmentRef(item.id)}</small>
                            <strong>{item.title}</strong>
                          </button>
                          <span>{item.division}</span>
                          <span>
                            <strong>{lead?.name || "Unassigned"}</strong>
                            <small>
                              {item.members.length} team member
                              {item.members.length === 1 ? "" : "s"}
                            </small>
                          </span>
                          <b
                            className={`assignment-priority ${item.priority.toLowerCase()}`}
                          >
                            {item.priority}
                          </b>
                          <span>{assignmentDisplayStatus(item)}</span>
                          <span>
                            <strong>
                              {item.due_date
                                ? new Date(item.due_date).toLocaleDateString(
                                    "en-KE",
                                  )
                                : "Not set"}
                            </strong>
                            <small>
                              {days === null
                                ? "No deadline"
                                : days < 0
                                  ? `${Math.abs(days)} days overdue`
                                  : days === 0
                                    ? "Due today"
                                    : `${days} days left`}
                            </small>
                          </span>
                          <b
                            className={`assignment-health ${assignmentHealthFor(item).toLowerCase().replaceAll(" ", "-")}`}
                          >
                            {assignmentHealthFor(item)}
                          </b>
                          <div className="assignment-row-actions">
                            <button onClick={() => onOpen(item)}>
                              Open workspace
                            </button>
                            {isManager && (
                              <>
                                <button onClick={() => onEdit(item)}>
                                  Edit
                                </button>
                                <button
                                  className="danger"
                                  onClick={() => onDelete(item)}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      );
                    })}
                    {!filteredAssignments.length && (
                      <div className="assignment-empty">
                        <span className="assignments-portfolio-icon-mark" aria-hidden="true">A</span>
                        <h3>No assignments match these filters</h3>
                        <p>Clear the filters or create a new assignment.</p>
                      </div>
                    )}
                  </div>
                )}
                {assignmentView === "Cards" && (
                  <div className="assignment-card-view">
                    {filteredAssignments.map((item) => {
                      const lead =
                        item.members.find((member) => member.role === "Lead") ||
                        item.members[0];
                      return (
                        <article key={item.id}>
                          <header>
                            <small>{assignmentRef(item.id)}</small>
                            <b
                              className={`assignment-priority ${item.priority.toLowerCase()}`}
                            >
                              {item.priority}
                            </b>
                          </header>
                          <button
                            className="assignment-card-title"
                            onClick={() => onOpen(item)}
                          >
                            {item.title}
                          </button>
                          <p>{item.description || "No description provided."}</p>
                          <dl>
                            <div><dt>Status</dt><dd>{assignmentDisplayStatus(item)}</dd></div>
                            <div><dt>Health</dt><dd>{assignmentHealthFor(item)}</dd></div>
                            <div><dt>Lead</dt><dd>{lead?.name || "Unassigned"}</dd></div>
                            <div><dt>Due</dt><dd>{item.due_date ? formatAssignmentDate(item.due_date) : "Not set"}</dd></div>
                          </dl>
                          <footer>
                            <span>
                              {item.division} · {item.members.length} team member
                              {item.members.length === 1 ? "" : "s"}
                            </span>
                            <div className="assignment-row-actions">
                              <button onClick={() => onOpen(item)}>Open workspace</button>
                              {isManager && <button onClick={() => onEdit(item)}>Edit</button>}
                            </div>
                          </footer>
                        </article>
                      );
                    })}
                    {!filteredAssignments.length && (
                      <div className="assignment-empty">
                        <span className="assignments-portfolio-icon-mark" aria-hidden="true">A</span>
                        <h3>No assignments match these filters</h3>
                        <p>Clear the filters or create a new assignment.</p>
                      </div>
                    )}
                  </div>
                )}
                {assignmentView === "Board" && (
                  <div className="assignment-kanban">
                    {[
                      "Not Started",
                      "In Progress",
                      "Ready for Review",
                      "Completed",
                      "Overdue",
                    ].map((status) => (
                      <section key={status}>
                        <header>
                          <span>{status}</span>
                          <b>
                            {
                              filteredAssignments.filter(
                                (item) => item.status === status,
                              ).length
                            }
                          </b>
                        </header>
                        {filteredAssignments
                          .filter((item) => item.status === status)
                          .map((item) => (
                            <article key={item.id}>
                              <div>
                                <small>{assignmentRef(item.id)}</small>
                                <b
                                  className={`assignment-priority ${item.priority.toLowerCase()}`}
                                >
                                  {item.priority}
                                </b>
                              </div>
                              <button
                                onClick={() => onOpen(item)}
                              >
                                {item.title}
                              </button>
                              <p>{item.division}</p>
                              <footer>
                                <span>
                                  {item.members
                                    .slice(0, 3)
                                    .map((member) => initialsFor(member.name))
                                    .join("  |  ") || "Unassigned"}
                                </span>
                                <time>
                                  {item.due_date
                                    ? new Date(
                                        item.due_date,
                                      ).toLocaleDateString("en-KE")
                                    : "No due date"}
                                </time>
                                <button
                                  type="button"
                                  className="assignment-open-workspace"
                                  onClick={() => onOpen(item)}
                                >
                                  Open workspace
                                </button>
                              </footer>
                            </article>
                          ))}
                        {!filteredAssignments.some(
                          (item) => item.status === status,
                        ) && <p className="kanban-empty">No assignments</p>}
                      </section>
                    ))}
                  </div>
                )}
                {assignmentView === "Calendar" && (
                  <div className="assignment-calendar-view">
                    <header>
                      <h3>Assignment deadlines</h3>
                      <p>
                        Only matching assignments with a recorded due date
                        appear here.
                      </p>
                    </header>
                    {filteredAssignments
                      .filter((item) => item.due_date)
                      .sort((a, b) =>
                        String(a.due_date).localeCompare(String(b.due_date)),
                      )
                      .map((item) => (
                        <button
                          key={item.id}
                          onClick={() => onOpen(item)}
                        >
                          <time>
                            <strong>
                              {new Date(
                                String(item.due_date),
                              ).toLocaleDateString("en-KE", { day: "2-digit" })}
                            </strong>
                            <span>
                              {new Date(
                                String(item.due_date),
                              ).toLocaleDateString("en-KE", {
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </time>
                          <div>
                            <small>
                              {assignmentRef(item.id)} | {item.division}
                            </small>
                            <strong>{item.title}</strong>
                          </div>
                          <span
                            className={`assignment-health ${assignmentHealthFor(item).toLowerCase().replaceAll(" ", "-")}`}
                          >
                            {assignmentHealthFor(item)}
                          </span>
                          <strong className="assignment-open-workspace">Open workspace</strong>
                        </button>
                      ))}
                    {!filteredAssignments.some((item) => item.due_date) && (
                      <div className="assignment-empty">
                        <span className="assignments-portfolio-icon-mark" aria-hidden="true">D</span>
                        <h3>No dated assignments</h3>
                        <p>No matching assignment has a due date.</p>
                      </div>
                    )}
                  </div>
                )}
                {assignmentView === "Workload" && (
                  <div className="assignment-workload-view">
                    <header>
                      <h3>Assignment participation workload</h3>
                      <p>
                        Counts show active assignment participation, not
                        estimated effort or availability.
                      </p>
                    </header>
                    {[
                      ...new Map(
                        filteredAssignments
                          .flatMap((item) => item.members)
                          .map((member) => [member.id, member]),
                      ).values(),
                    ].map((member) => {
                      const activeWork = filteredAssignments.filter(
                        (item) =>
                          (!assignmentCommandFocus || assignmentMatchesCommandFocus(item, assignmentCommandFocus)) &&
      item.status !== "Completed" &&
                          item.members.some(
                            (person) => person.id === member.id,
                          ),
                      );
                      return (
                        <article key={member.id}>
                          <div className="workload-person">
                            <b>{initialsFor(member.name)}</b>
                            <span>
                              <strong>{member.name}</strong>
                              <small>{member.role}</small>
                            </span>
                          </div>
                          <div>
                            <span>Active</span>
                            <strong>{activeWork.length}</strong>
                          </div>
                          <i>
                            <b
                              style={{
                                width: `${Math.min(100, activeWork.length * 16)}%`,
                              }}
                            />
                          </i>
                          <div className="workload-assignment-chips">
                            {activeWork.slice(0, 4).map((item) => (
                              <button
                                key={item.id}
                                onClick={() => onOpen(item)}
                              >
                                {assignmentRef(item.id)}
                              </button>
                            ))}
                          </div>
                        </article>
                      );
                    })}
                    {!filteredAssignments.some(
                      (item) => item.members.length,
                    ) && (
                      <div className="assignment-empty">
                        <span className="assignments-portfolio-icon-mark" aria-hidden="true">T</span>
                        <h3>No workload data</h3>
                        <p>
                          No matching assignment has allocated team members.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
    </>
  );
}
