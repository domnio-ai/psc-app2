import type { Dispatch, FormEventHandler, MouseEvent, SetStateAction } from "react";
import type { ApiAssignment, ApiUser, AssignmentInput } from "../../../api";

type AssignmentEditorMode = ApiAssignment | "new" | null;
type AssignmentCreationMode = "Internal" | "External";

type TeamMember = {
  id: string;
  name: string;
  role: string;
};

type Props = {
  editor: AssignmentEditorMode;
  creationMode: AssignmentCreationMode;
  notice: string;
  assignmentForm: AssignmentInput;
  onAssignmentFormChange: Dispatch<SetStateAction<AssignmentInput>>;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  externalFile: File | null;
  onExternalFileChange: (file: File | null) => void;
  externalReviewerId: string;
  onExternalReviewerIdChange: (id: string) => void;
  externalReviewNote: string;
  onExternalReviewNoteChange: (note: string) => void;
  externalActionStatus: string;
  saving: boolean;
  users: ApiUser[];
  currentUserId?: string;
  team: TeamMember[];
};

export default function AssignmentEditorModal({
  editor,
  creationMode,
  notice,
  assignmentForm,
  onAssignmentFormChange,
  onClose,
  onSubmit,
  onExternalFileChange,
  externalReviewerId,
  onExternalReviewerIdChange,
  externalReviewNote,
  onExternalReviewNoteChange,
  externalActionStatus,
  saving,
  users,
  currentUserId,
  team,
}: Props) {
  if (!editor) return null;

  const isExternalNew = editor === "new" && creationMode === "External";
  const availableMembers = team.filter(
    (member) => member.role !== "System Admin" && users.find((user) => user.id === member.id)?.active !== false,
  );
  const stopPropagation = (event: MouseEvent<HTMLElement>) => event.stopPropagation();
  const patchForm = (patch: Partial<AssignmentInput>) =>
    onAssignmentFormChange((current) => ({ ...current, ...patch }));

  return (
    <div className="modal-backdrop">
      <section className="assignment-editor" onClick={stopPropagation}>
        <button className="close" type="button" aria-label="Close assignment editor" onClick={onClose}>×</button>
        <h2>
          {editor === "new"
            ? creationMode === "External"
              ? "Register external assignment"
              : "Create assignment"
            : "Edit assignment"}
        </h2>

        {notice && <div className="session-message" role="alert">{notice}</div>}

        {isExternalNew && (
          <div className="session-message" role="note">
            <strong>External completed work:</strong> Add the completed report and choose its reviewer
            here. REDESY will create no members or tasks, submit the exact uploaded file for review,
            and open it in the read-only report reader.
          </div>
        )}

        <form onSubmit={onSubmit} noValidate={isExternalNew}>
          <label>
            Title
            <input
              value={assignmentForm.title}
              onChange={(event) => patchForm({ title: event.target.value })}
              required
              minLength={4}
            />
          </label>

          <label>
            Assignment brief
            <textarea
              value={assignmentForm.description}
              onChange={(event) => patchForm({ description: event.target.value })}
              placeholder="Explain the background, mandate and reason for the assignment."
              required={!isExternalNew}
            />
          </label>

          {!isExternalNew && (
            <fieldset className="assignment-brief-fields">
              <legend>Objective and expected result</legend>
              <label>
                Objective
                <textarea value={assignmentForm.objective} onChange={(event) => patchForm({ objective: event.target.value })} placeholder="State the specific result this assignment must achieve." required />
              </label>
              <label>
                Scope
                <textarea value={assignmentForm.scope} onChange={(event) => patchForm({ scope: event.target.value })} placeholder="Define what is included, excluded and the area covered." />
              </label>
              <label>
                Instructions and requirements
                <textarea value={assignmentForm.instructions} onChange={(event) => patchForm({ instructions: event.target.value })} placeholder="Record standards, evidence requirements, constraints and special directions." />
              </label>
              <label>
                Expected output
                <input value={assignmentForm.expectedOutput} onChange={(event) => patchForm({ expectedOutput: event.target.value })} placeholder="For example: Final Assignment Report" required />
              </label>
            </fieldset>
          )}

          <div className="form-pair">
            <label>
              Division
              <input
                value={assignmentForm.division}
                onChange={(event) => patchForm({ division: event.target.value })}
                required
              />
            </label>
            <label>
              Start date
              <input type="date" value={assignmentForm.startDate || ""} onChange={(event) => patchForm({ startDate: event.target.value || null })} required={!isExternalNew} />
            </label>
            <label>
              Due date
              <input
                type="date"
                value={assignmentForm.dueDate || ""}
                onChange={(event) => patchForm({ dueDate: event.target.value || null })}
                min={assignmentForm.startDate || undefined}
                required={!isExternalNew}
              />
            </label>
          </div>

          <label>
            Priority
            <select
              value={assignmentForm.priority}
              onChange={(event) => patchForm({ priority: event.target.value })}
            >
              <option>Low</option>
              <option>Normal</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </label>

          {isExternalNew && (
            <fieldset className="external-assignment-handoff">
              <legend>Report and reviewer</legend>
              <label>
                Completed report
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) => onExternalFileChange(event.target.files?.[0] || null)}
                  required
                />
                <small>PDF or DOCX only. This exact file becomes the controlled review copy.</small>
              </label>

              <label>
                Assigned reviewer
                <select
                  value={externalReviewerId}
                  onChange={(event) => onExternalReviewerIdChange(event.target.value)}
                  required
                >
                  <option value="">Select reviewer</option>
                  {users
                    .filter((member) => member.active && member.id !== currentUserId)
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} — {member.role}; {member.division || "Division not specified"}
                      </option>
                    ))}
                </select>
                <small>The submitting officer cannot review their own report.</small>
              </label>

              <label>
                Review handoff note <small>(optional)</small>
                <textarea
                  value={externalReviewNote}
                  onChange={(event) => onExternalReviewNoteChange(event.target.value)}
                  placeholder="Add any context the reviewer should see with the submission."
                  maxLength={4000}
                />
              </label>
            </fieldset>
          )}

          {!isExternalNew && (
            <fieldset>
              <legend>Accountable lead and team</legend>
              <p className="assignment-team-guidance">
                Appoint one accountable lead. Tasks are optional; for a direct assignment, this person writes and submits the Final Assignment Report.
              </p>
              <label className="assignment-lead-control">
                Assignment lead
                <select
                  value={assignmentForm.leadId || ""}
                  onChange={(event) => {
                    const leadId = event.target.value || null;
                    patchForm({
                      leadId,
                      memberIds: leadId && !assignmentForm.memberIds.includes(leadId)
                        ? [leadId, ...assignmentForm.memberIds]
                        : assignmentForm.memberIds,
                    });
                  }}
                  required={editor === "new"}
                >
                  <option value="">Select the accountable lead</option>
                  {availableMembers.map((member) => (
                    <option key={member.id} value={member.id}>{member.name} — {member.role}</option>
                  ))}
                </select>
                <small>The lead owns the assignment overview, coordination and final report.</small>
              </label>
              <div className="assignment-contributor-options">
                <strong>Contributors <small>(optional)</small></strong>
              {availableMembers
                .map((member) => (
                  <label key={member.id}>
                    <input
                      type="checkbox"
                      checked={assignmentForm.memberIds.includes(member.id)}
                      disabled={assignmentForm.leadId === member.id}
                      onChange={(event) =>
                        patchForm({
                          memberIds: event.target.checked
                            ? [...assignmentForm.memberIds, member.id]
                            : assignmentForm.memberIds.filter((id) => id !== member.id),
                        })
                      }
                    />
                    {member.name}
                    <small>{assignmentForm.leadId === member.id ? "Assignment Lead" : member.role}</small>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {isExternalNew && externalActionStatus && (
            <div className="external-assignment-action-status" role="status" aria-live="polite">
              {saving && <span className="external-assignment-action-spinner" aria-hidden="true" />}
              <strong>{externalActionStatus}</strong>
            </div>
          )}

          <button type="submit" className="sign-in" disabled={saving}>
            {saving
              ? "Processing external report..."
              : isExternalNew
                ? "Register, Submit & Open Report"
                : "Save assignment"}
          </button>
        </form>
      </section>
    </div>
  );
}
