import { governedWorkflowStages } from "./governedWorkflowModel";
import "./governed-workflow-strip.css";

type Props = {
  currentIndex: number;
  blocked?: boolean;
  returned?: boolean;
  compact?: boolean;
  label: string;
  onSelect?: (index: number, source: HTMLButtonElement) => void;
};

export default function GovernedWorkflowStrip({
  currentIndex,
  blocked = false,
  returned = false,
  compact = false,
  label,
  onSelect,
}: Props) {
  return (
    <section className={`governed-workflow-strip${compact ? " compact" : ""}`} aria-label={label}>
      {governedWorkflowStages.map((stage, index) => {
        const state =
          index === currentIndex && blocked ? "blocked" :
          index === currentIndex && returned ? "returned" :
          index < currentIndex ? "complete" :
          index === currentIndex ? "current" : "upcoming";

        return onSelect ? (
          <button
            type="button"
            key={stage.key}
            className={`governed-workflow-stage ${state}`}
            aria-current={state === "current" ? "step" : undefined}
            onClick={(event) => onSelect(index, event.currentTarget)}
          >
            <span className="governed-workflow-number">{index + 1}</span>
            <span className="governed-workflow-copy">
              <strong>{stage.label}</strong>
              {!compact && <small>{stage.detail}</small>}
            </span>
          </button>
        ) : (
          <div key={stage.key} className={`governed-workflow-stage ${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="governed-workflow-number">{index + 1}</span>
            <span className="governed-workflow-copy">
              <strong>{stage.label}</strong>
              {!compact && <small>{stage.detail}</small>}
            </span>
          </div>
        );
      })}
    </section>
  );
}
