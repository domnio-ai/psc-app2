type Props = {
  onClose: () => void;
  onInternal: () => void;
  onExternal: () => void;
};

export default function ResearchSourceChoiceModal({ onClose, onInternal, onExternal }: Props) {
  return (
    <div className="research-source-choice-backdrop" role="presentation">
      <section
        className="research-source-choice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="research-source-choice-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>NEW RESEARCH</small>
            <h2 id="research-source-choice-title">How will this research be produced?</h2>
            <p>
              Choose this before REDESY creates a workspace so external research is not given unnecessary assignments.
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>×</button>
        </header>

        <div className="research-source-choice-options">
          <button type="button" className="research-source-option" onClick={onInternal}>
            <span className="research-source-option-icon" aria-hidden="true">I</span>
            <span>
              <strong>Internal research</strong>
              <small>Research will be planned and carried out inside REDESY.</small>
              <em>Creates a research workspace with linked assignments, resources, report drafting and review.</em>
            </span>
            <b aria-hidden="true">→</b>
          </button>

          <button type="button" className="research-source-option external" onClick={onExternal}>
            <span className="research-source-option-icon" aria-hidden="true">E</span>
            <span>
              <strong>External research</strong>
              <small>A completed or substantially completed report already exists outside REDESY.</small>
              <em>Skips assignment creation. Import the report, select a reviewer and send it directly through controlled review.</em>
            </span>
            <b aria-hidden="true">→</b>
          </button>
        </div>

        <footer>
          <span>You can still import an external report later from an internal project's Work tab.</span>
          <button type="button" onClick={onClose}>Cancel</button>
        </footer>
      </section>
    </div>
  );
}
