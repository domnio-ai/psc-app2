import type { ApiAssignment, AssignmentInput, ResearchProject } from "../../../api";
import { ResearchAssignmentProgress } from "../ResearchAssignmentProgress";
import { assignmentRef } from "../../assignments/utils/assignmentFormatting";

type AssignmentRequest = ResearchProject["assignment_requests"][number];
type LinkedAssignment = ResearchProject["assignments"][number];

type Props = {
  token: string;
  project: ResearchProject;
  assignmentRows: ApiAssignment[];
  isManager: boolean;
  currentUserId?: string;
  linkId: string;
  draft: AssignmentInput;
  creating: boolean;
  onImportExternal: () => void;
  onLinkIdChange: (value: string) => void;
  onLinkExisting: () => void | Promise<void>;
  onDraftChange: (value: AssignmentInput) => void;
  onCreate: () => void | Promise<void>;
  onApproveRequest: (request: AssignmentRequest) => void | Promise<void>;
  onRejectRequest: (request: AssignmentRequest) => void | Promise<void>;
  onOpenAssignment: (assignment: LinkedAssignment) => void | Promise<void>;
  onUnlinkAssignment: (assignment: LinkedAssignment) => void | Promise<void>;
};

export default function ResearchRelatedAssignmentsPanel({
  token,
  project,
  assignmentRows,
  isManager,
  currentUserId,
  linkId,
  draft,
  creating,
  onImportExternal,
  onLinkIdChange,
  onLinkExisting,
  onDraftChange,
  onCreate,
  onApproveRequest,
  onRejectRequest,
  onOpenAssignment,
  onUnlinkAssignment,
}: Props) {
  const canManage = isManager || project.lead_id === currentUserId;
  const linkedAssignments = project.assignments || [];
  const pendingRequests = (project.assignment_requests || []).filter(
    (request) => request.status === "Pending Approval",
  );

  return (
    <section className="research-work-panel research-related-work-panel">
      <header>
        <div>
          <small>RESEARCH WORK</small>
          <h3>Related assignments</h3>
          <p>Linked assignments are optional. Use them only when research work needs a separate delegated assignment workflow.</p>
        </div>
        <div className="research-work-head-actions">
          <strong>
            {linkedAssignments.length} linked
          </strong>
        </div>
      </header>

      {canManage && (
        <div className="research-assignment-controls">
          {isManager && (
            <div className="research-link-assignment">
              <label>
                Link existing assignment
                <select value={linkId} onChange={(event) => onLinkIdChange(event.target.value)}>
                  <option value="">Select assignment</option>
                  {assignmentRows
                    .filter((assignment) => !linkedAssignments.some((linked) => linked.id === assignment.id))
                    .map((assignment) => (
                      <option key={assignment.id} value={assignment.id}>
                        {assignmentRef(assignment.id)} — {assignment.title}
                      </option>
                    ))}
                </select>
              </label>
              <button type="button" title={!linkId ? "Choose an assignment to link to this research project." : undefined} disabled={!linkId} onClick={onLinkExisting}>
                Link assignment
              </button>
            </div>
          )}

          <details className="research-create-assignment">
            <summary>{isManager ? "+ Create related assignment" : "+ Propose related assignment"}</summary>
            <div className="research-assignment-form">
              <label>
                Assignment title
                <input value={draft.title} onChange={(event) => onDraftChange({ ...draft, title: event.target.value })} />
              </label>
              <label>
                Division
                <input value={draft.division} onChange={(event) => onDraftChange({ ...draft, division: event.target.value })} />
              </label>
              <label className="wide">
                Description
                <textarea value={draft.description} onChange={(event) => onDraftChange({ ...draft, description: event.target.value })} />
              </label>
              <label>
                Due date
                <input type="date" value={draft.dueDate || ""} onChange={(event) => onDraftChange({ ...draft, dueDate: event.target.value || null })} />
              </label>
              <label>
                Priority
                <select value={draft.priority} onChange={(event) => onDraftChange({ ...draft, priority: event.target.value })}>
                  <option>Low</option>
                  <option>Normal</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </label>
              <fieldset className="wide">
                <legend>Assignment members</legend>
                {[
                  { id: project.lead_id, name: project.lead_name, role: "Lead researcher" },
                  ...project.collaborators.map((person) => ({ id: person.id, name: person.name, role: person.role })),
                ].map((person) => (
                  <label key={person.id}>
                    <input
                      type="checkbox"
                      checked={draft.memberIds.includes(person.id)}
                      onChange={(event) =>
                        onDraftChange({
                          ...draft,
                          memberIds: event.target.checked
                            ? [...draft.memberIds, person.id]
                            : draft.memberIds.filter((id) => id !== person.id),
                        })
                      }
                    />
                    <span>
                      {person.name}
                      <small>{person.role}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
              <button
                className="research-primary-action wide"
                type="button"
                disabled={creating || !draft.title.trim() || !draft.division.trim()}
                onClick={onCreate}
              >
                {creating ? "Saving..." : isManager ? "Create & link assignment" : "Send to manager for approval"}
              </button>
            </div>
          </details>
        </div>
      )}

      <div className="research-assignment-list">
        {pendingRequests.map((request) => (
          <article key={request.id} className="research-assignment-request">
            <div>
              <span>APPROVAL REQUEST</span>
              <strong>{request.title}</strong>
              <small>{request.division} · proposed by {request.requested_by_name}</small>
            </div>
            <div>
              <b>{request.status}</b>
              <small>{request.due_date ? `Due ${new Date(request.due_date).toLocaleDateString("en-KE")}` : "No due date"}</small>
            </div>
            <p>{request.description || "No description supplied."}</p>
            {isManager && (
              <div className="research-assignment-actions">
                <button type="button" onClick={() => onApproveRequest(request)}>Approve & activate</button>
                <button className="unlink" type="button" onClick={() => onRejectRequest(request)}>Reject with reason</button>
              </div>
            )}
          </article>
        ))}

        {linkedAssignments.map((assignment) => (
          <article key={assignment.id}>
            <div>
              <span>{assignmentRef(assignment.id)}</span>
              <strong>{assignment.title}</strong>
              <small>{assignment.division} · {assignment.relation_type || "Research Work"}</small>
            </div>
            <div>
              <b>{assignment.status}</b>
              <small>{assignment.due_date ? `Due ${new Date(assignment.due_date).toLocaleDateString("en-KE")}` : "No due date"}</small>
            </div>
            <ResearchAssignmentProgress token={token} assignmentId={assignment.id} />
            <div className="research-assignment-actions">
              <button type="button" onClick={() => onOpenAssignment(assignment)}>Open assignment</button>
              {isManager && (
                <button className="unlink" type="button" onClick={() => onUnlinkAssignment(assignment)}>Unlink</button>
              )}
            </div>
          </article>
        ))}

        {!linkedAssignments.length && (
          <div className="research-work-empty">
            <strong>No related assignments yet</strong>
            <p>Create the first assignment for literature review, data collection, analysis, drafting or another research workstream.</p>
          </div>
        )}
      </div>

      <details className="research-related-external-option">
        <summary>Research completed outside APP2?</summary>
        <div>
          <p>Use the external research import workflow only when a completed report already exists.</p>
          <button type="button" onClick={onImportExternal}>
            Open external import
          </button>
        </div>
      </details>
    </section>
  );
}
