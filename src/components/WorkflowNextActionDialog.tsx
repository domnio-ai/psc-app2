type Props = {
  title: string;
  outcome: string;
  nextAction: string;
  onClose: () => void;
  onContinue?: () => void;
  continueLabel?: string;
};

export default function WorkflowNextActionDialog({ title, outcome, nextAction, onClose, onContinue, continueLabel = "Continue to next action" }: Props) {
  return <div className="workflow-next-action-backdrop">
    <section className="workflow-next-action-dialog" role="dialog" aria-modal="true" aria-labelledby="workflow-next-action-title">
      <small>WORKFLOW UPDATE</small>
      <h2 id="workflow-next-action-title">{title}</h2>
      <p className="workflow-next-action-outcome">{outcome}</p>
      <div><b>Next action</b><p>{nextAction}</p></div>
      <footer>{onContinue && <button type="button" className="primary" onClick={() => { onContinue(); onClose(); }}>{continueLabel}</button>}<button type="button" onClick={onClose}>{onContinue ? "Close" : "Done"}</button></footer>
    </section>
  </div>;
}
