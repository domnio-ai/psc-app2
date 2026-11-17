import type {
  ApiAssignmentTask,
  ApiAttachment,
  GeneratedDocumentSummary,
  KnowledgeItem,
} from "../../../api";
import "./task-admin-v5.css";

type Responsibility = {
  stage: string;
  responsible: string;
  action: string;
};

type Props = {
  task: ApiAssignmentTask;
  responsibility: Responsibility | null;
  isManager: boolean;
  isSelectedTaskOwner: boolean;
  workspaceSaving: boolean;
  managementBusy: boolean;
  reportPreviewBusy: boolean;
  knowledgeUploading: boolean;
  workspaceStatus: string;
  workspaceProgress: number;
  workspaceStartDate: string;
  assignmentFiles: ApiAttachment[];
  workspaceDocuments: GeneratedDocumentSummary[];
  knowledgeRows: KnowledgeItem[];
  selectedAssignmentId: string | null;
  taskDateText: (value?: string | null) => string;
  reportActionLabel: (task: ApiAssignmentTask) => string;
  onClose: () => void;
  onFocusReport: () => void;
  onOpenSavedReport: () => void;
  onStatusChange: (status: string) => void;
  onStartDateChange: (startDate: string) => void;
  onProgressChange: (progress: number) => void;
  onOpenGeneratedDocument: (id: string) => void;
  onDownloadAttachment: (file: ApiAttachment) => void;
  onOpenRepositoryDocument: (item: KnowledgeItem) => void;
  onAttachReport: (file: File) => void;
  onArchive: () => void;
  onRequestDelete: () => void;
};

export default function AssignmentTaskWorkspaceHeader({
  task,
  responsibility,
  isManager,
  isSelectedTaskOwner,
  workspaceSaving,
  managementBusy,
  reportPreviewBusy,
  knowledgeUploading,
  workspaceStatus,
  workspaceProgress,
  workspaceStartDate,
  assignmentFiles,
  workspaceDocuments,
  knowledgeRows,
  selectedAssignmentId,
  taskDateText,
  reportActionLabel,
  onClose,
  onFocusReport,
  onOpenSavedReport,
  onStatusChange,
  onStartDateChange,
  onProgressChange,
  onOpenGeneratedDocument,
  onDownloadAttachment,
  onOpenRepositoryDocument,
  onAttachReport,
  onArchive,
  onRequestDelete,
}: Props) {
  const linkedKnowledge = knowledgeRows.filter(
    (item) =>
      item.assignments?.some((assignment) => assignment.id === selectedAssignmentId) ||
      item.origin_links?.some((link) => link.type === "task" && link.id === task.id),
  );
  const documentCount = assignmentFiles.length + workspaceDocuments.length + linkedKnowledge.length;
  const deleteLocked = task.status === "Completed" || task.contribution_status !== "Draft";
  const ownerMissing = !task.owner_id;
  const reviewerMissing = Boolean(task.owner_id) && !task.reviewer_id;
  const operationalStage = ownerMissing
    ? "Owner assignment required"
    : reviewerMissing
      ? "Reviewer resolution required"
      : responsibility?.stage || task.status;
  const operationalResponsible = ownerMissing
    ? "Management"
    : reviewerMissing
      ? "Management"
      : responsibility?.responsible || task.owner_name || "Task owner";

  return (
    <>
      <header className="task-workspace-modal-header task-screen-header">
        <button
          type="button"
          className="task-back-button"
          disabled={workspaceSaving || managementBusy}
          onClick={onClose}
        >
          ← Tasks
        </button>

        <div className="task-screen-title">
          <span className="workspace-eyebrow">TASK WORKSPACE</span>
          <h2>{task.title}</h2>
          <p>
            {operationalStage} · {task.owner_name || "Unassigned"} · Due{" "}
            {taskDateText(task.due_date)}
          </p>
          <div
            className={`task-next-responsibility${ownerMissing ? " is-blocked" : reviewerMissing ? " is-warning" : ""}`}
            role="status"
          >
            <strong>Responsible now: {operationalResponsible}</strong>
            <span>{operationalStage}</span>
          </div>
        </div>

        <div className="task-header-tools">
          {isSelectedTaskOwner && task.status !== "Blocked" && (
            <button
              type="button"
              className="task-header-report-jump"
              disabled={reportPreviewBusy}
              onClick={task.contribution_status === "Draft" ? onFocusReport : onOpenSavedReport}
            >
              {reportPreviewBusy ? "Opening report..." : reportActionLabel(task)}
            </button>
          )}

          {ownerMissing ? (
            <div className="task-header-operational-gate" role="status">
              <span>Work</span>
              <b>Owner required</b>
            </div>
          ) : (
            <details className="task-header-work-update">
              <summary>
              Work
              <b>{workspaceProgress}%</b>
            </summary>
            <div className="task-header-popover task-header-work-popover">
              <header>
                <div>
                  <span className="workspace-eyebrow">WORK UPDATE</span>
                  <strong>{workspaceStatus}</strong>
                </div>
              </header>
              <div className="task-header-work-form">
                <label>
                  <span>Status</span>
                  <select value={workspaceStatus} onChange={(event) => onStatusChange(event.target.value)}>
                    <option>Not Started</option>
                    <option>In Progress</option>
                    <option>Blocked</option>
                    {task.status === "Completed" && <option>Completed</option>}
                  </select>
                </label>
                {!isManager && (
                  <label>
                    <span>Started on</span>
                    <input
                      type="date"
                      value={workspaceStartDate}
                      onChange={(event) => onStartDateChange(event.target.value)}
                    />
                  </label>
                )}
                <label>
                  <span>Progress</span>
                  <div className="task-header-progress-editor">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={workspaceProgress}
                      onChange={(event) => onProgressChange(Number(event.target.value))}
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={workspaceProgress}
                      onChange={(event) =>
                        onProgressChange(Math.max(0, Math.min(100, Number(event.target.value) || 0)))
                      }
                    />
                    <span>%</span>
                  </div>
                </label>
                <small>Changes are saved using the normal Save Task action.</small>
              </div>
            </div>
          </details>
          )}


          <details className="task-header-documents">
            <summary>
              Documents
              <b>{documentCount}</b>
            </summary>
            <div className="task-header-popover task-header-documents-popover">
              <header>
                <div>
                  <span className="workspace-eyebrow">SUPPORTING DOCUMENTS</span>
                  <strong>Task and assignment documents</strong>
                </div>
              </header>
              <div className="task-header-document-list">
                {workspaceDocuments.map((item) => (
                  <button
                    type="button"
                    key={`task-generated-${item.id}`}
                    className={item.id === task.target_document_id ? "is-linked" : ""}
                    onClick={() => onOpenGeneratedDocument(item.id)}
                  >
                    <span>
                      <b>{item.title}</b>
                      <small>
                        {item.id === task.target_document_id ? "Linked task output" : "Generated report"} ·{" "}
                        {item.status}
                      </small>
                    </span>
                    <em>Open</em>
                  </button>
                ))}
                {assignmentFiles.map((file) => (
                  <button type="button" key={`task-upload-${file.id}`} onClick={() => onDownloadAttachment(file)}>
                    <span>
                      <b>{file.original_name}</b>
                      <small>Uploaded assignment document</small>
                    </span>
                    <em>Download</em>
                  </button>
                ))}
                {linkedKnowledge.map((item) => (
                  <button type="button" key={`task-repository-${item.id}`} onClick={() => onOpenRepositoryDocument(item)}>
                    <span>
                      <b>{item.title}</b>
                      <small>
                        {item.origin_links?.some((link) => link.type === "task" && link.id === task.id)
                          ? "Attached task report"
                          : "Repository document"} · {item.status}
                      </small>
                    </span>
                    <em>Preview</em>
                  </button>
                ))}
                {!documentCount && <p>No supporting documents are attached yet.</p>}
              </div>
            </div>
          </details>

          <label className="task-header-attach">
            {knowledgeUploading ? "Attaching…" : "+ Attach evidence"}
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md"
              disabled={knowledgeUploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onAttachReport(file);
                event.currentTarget.value = "";
              }}
            />
          </label>

          {isManager && (
            <details className="task-header-admin">
              <summary>Task Admin</summary>
              <div className="task-header-popover task-header-admin-popover">
                <span className="workspace-eyebrow">TASK ADMINISTRATION</span>
                <strong>Archive or delete this task</strong>
                <small>
                  Archive preserves the institutional record. Delete is available only before formal reporting begins.
                </small>
                <div className="task-header-admin-actions">
                  <button
                    type="button"
                    className="task-archive-button"
                    disabled={managementBusy || workspaceSaving}
                    onClick={onArchive}
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    className="task-delete-button"
                    disabled={managementBusy || workspaceSaving || deleteLocked}
                    onClick={onRequestDelete}
                  >
                    Delete
                  </button>
                </div>
                {deleteLocked && (
                  <small className="task-delete-locked" role="status">
                    Delete locked — formal reporting has started.
                  </small>
                )}
              </div>
            </details>
          )}
        </div>
      </header>

      <div className="task-workspace-meta task-screen-meta">
        <div>
          <small>Output</small>
          <strong>{task.expected_output || "Task Report"}</strong>
        </div>
        <div>
          <small>Task brief</small>
          <strong>{task.description || "No description"}</strong>
        </div>
        <div>
          <small>Priority</small>
          <strong className={`task-priority-chip ${task.priority.toLowerCase()}`}>{task.priority}</strong>
        </div>
        <div>
          <small>Reviewer</small>
          <strong>{task.reviewer_name || (ownerMissing ? "Pending owner assignment" : "Automatic reviewer pending")}</strong>
        </div>
      </div>

      <section className="task-overview-details" aria-label="Task overview details">
        <header className="task-overview-details__header">
          <div>
            <span className="workspace-eyebrow">TASK OVERVIEW</span>
            <h3>What this task requires</h3>
          </div>
          <span className={`task-overview-details__status${ownerMissing ? " is-blocked" : reviewerMissing ? " is-warning" : ""}`}>{operationalStage}</span>
        </header>

        <div className="task-overview-details__grid">
          <article className="task-overview-detail task-overview-detail--wide">
            <small>Purpose</small>
            <p>{task.task_purpose || task.description || "No task purpose has been recorded."}</p>
          </article>

          <article className="task-overview-detail task-overview-detail--wide">
            <small>Specific instructions</small>
            <p>{task.specific_instructions || "No specific instructions have been recorded."}</p>
          </article>

          <article className="task-overview-detail">
            <small>Expected contribution</small>
            <p>{task.expected_contribution || "Not specified"}</p>
          </article>

          <article className="task-overview-detail">
            <small>Expected findings</small>
            <p>{task.expected_findings || "Not specified"}</p>
          </article>

          <article className="task-overview-detail">
            <small>Evidence required</small>
            <p>{task.evidence_required || "Not specified"}</p>
          </article>

          <article className="task-overview-detail">
            <small>Assignment area</small>
            <p>{task.assignment_section_title || task.assignment_part || "Not specified"}</p>
          </article>
        </div>

        <footer className="task-overview-details__footer">
          <span><b>Owner</b>{task.owner_name || "Unassigned"}</span>
          <span><b>Reviewer</b>{task.reviewer_name || "Not assigned"}</span>
          <span><b>Start</b>{taskDateText(task.start_date)}</span>
          <span><b>Due</b>{taskDateText(task.due_date)}</span>
          <span><b>Progress</b>{workspaceProgress}%</span>
        </footer>
      </section>
    </>
  );
}
