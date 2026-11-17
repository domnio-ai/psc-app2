type Props = {
  taskTitle: string;
  reason: string;
  confirmed: boolean;
  busy: boolean;
  onReasonChange: (value: string) => void;
  onConfirmedChange: (value: boolean) => void;
  onClose: () => void;
  onDelete: () => void;
};

export default function TaskDeleteDialog({
  taskTitle,
  reason,
  confirmed,
  busy,
  onReasonChange,
  onConfirmedChange,
  onClose,
  onDelete,
}: Props) {
  const canDelete = reason.trim().length >= 10 && confirmed && !busy;

  return (
    <div className="task-delete-dialog-backdrop" role="presentation">
      <section
        className="task-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Delete task"
      >
        <header>
          <div>
            <span className="workspace-eyebrow">DANGER ZONE</span>
            <h3>Delete task permanently?</h3>
            <p>
              <strong>{taskTitle}</strong> will be removed from active task records.
              The deletion event and reason remain in assignment history and audit logs.
            </p>
          </div>

          <button type="button" disabled={busy} onClick={onClose}>
            Close
          </button>
        </header>

        <label>
          Reason for deletion *
          <textarea
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Example: Duplicate task created in error."
            rows={4}
          />
        </label>

        <label className="task-delete-confirm-row">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => onConfirmedChange(event.target.checked)}
          />
          <span>
            I understand that this removes the task from active task records and cannot
            be undone from this screen.
          </span>
        </label>

        <footer>
          <button
            type="button"
            className="task-modal-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className="task-delete-button"
            disabled={!canDelete}
            onClick={onDelete}
          >
            {busy ? "Deleting..." : "Delete Task"}
          </button>
        </footer>
      </section>
    </div>
  );
}
