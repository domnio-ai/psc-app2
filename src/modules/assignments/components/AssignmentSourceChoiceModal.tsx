import type { MouseEvent } from "react";

type AssignmentCreationMode = "Internal" | "External";

type Props = {
  open: boolean;
  onClose: () => void;
  onChoose: (mode: AssignmentCreationMode) => void;
};

export default function AssignmentSourceChoiceModal({ open, onClose, onChoose }: Props) {
  if (!open) return null;

  const stopPropagation = (event: MouseEvent<HTMLElement>) => event.stopPropagation();

  return (
    <div className="research-source-choice-backdrop">
      <section
        className="research-source-choice"
        onClick={stopPropagation}
        aria-label="Choose assignment source"
      >
        <header>
          <div>
            <small>ASSIGNMENT SOURCE</small>
            <h2>How will this assignment be completed?</h2>
            <p>
              Choose this before REDESY allocates staff or creates tasks. External completed work
              should go directly to controlled report import and review.
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>×</button>
        </header>

        <div className="research-source-choice-options">
          <button type="button" className="research-source-option" onClick={() => onChoose("Internal")}>
            <span className="research-source-option-icon">IN</span>
            <span>
              <strong>Internal assignment</strong>
              <small>Work will be completed by REDESY staff through the assignment workspace.</small>
              <em>Assign members, create tasks, collect evidence, prepare the report and send it for review.</em>
            </span>
            <b>→</b>
          </button>

          <button
            type="button"
            className="research-source-option external"
            onClick={() => onChoose("External")}
          >
            <span className="research-source-option-icon">EX</span>
            <span>
              <strong>External completed work</strong>
              <small>A report or deliverable already exists outside REDESY.</small>
              <em>
                Do not allocate members or tasks. Register the assignment, import the report and
                select a reviewer before a final report can be generated.
              </em>
            </span>
            <b>→</b>
          </button>
        </div>

        <footer>
          <button type="button" onClick={onClose}>Cancel</button>
        </footer>
      </section>
    </div>
  );
}
