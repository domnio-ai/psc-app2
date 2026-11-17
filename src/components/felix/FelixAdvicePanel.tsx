import { useEffect, useRef, useState } from "react";
import { api, type FelixAdviceContext, type FelixAdviceResponse } from "../../api";

type FelixAdvicePanelProps = {
  token: string;
  contextType: FelixAdviceContext;
  entry: Record<string, unknown>;
  compact?: boolean;
};

export default function FelixAdvicePanel({
  token,
  contextType,
  entry,
  compact = false,
}: FelixAdvicePanelProps) {
  const [advice, setAdvice] = useState<FelixAdviceResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const payload = JSON.stringify(entry);

  useEffect(() => {
    if (!token) return;
    const currentRequest = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const result = await api.felixAdvice(token, contextType, JSON.parse(payload));
        if (requestId.current === currentRequest) setAdvice(result);
      } catch (caught) {
        if (requestId.current === currentRequest) {
          setError(caught instanceof Error ? caught.message : "Professor Felix advice is temporarily unavailable.");
        }
      } finally {
        if (requestId.current === currentRequest) setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [token, contextType, payload]);

  return (
    <aside className={`felix-advice-panel${compact ? " compact" : ""}`} aria-live="polite">
      <header>
        <div>
          <small>PROFESSOR FELIX · LIVE ADVICE</small>
          <h3>{advice?.headline || `${contextType} advisory review`}</h3>
          <p>{advice?.summary || "Checking this entry for governance, evidence, methodology and workflow readiness."}</p>
        </div>
        <span className="felix-advice-mode">Deterministic</span>
      </header>
      {loading && !advice && <p className="felix-advice-state">Reviewing the current entry…</p>}
      {error && <p className="felix-advice-error" role="status">{error}</p>}
      {advice && (
        <div className="felix-advice-columns">
          <section>
            <h4>Professor’s priorities</h4>
            <ul>{advice.priorities.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          {advice.warnings.length > 0 && (
            <section className="felix-advice-warnings">
              <h4>Risks / gaps</h4>
              <ul>{advice.warnings.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          )}
          <section>
            <h4>Next actions</h4>
            <ul>{advice.next_actions.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </div>
      )}
    </aside>
  );
}
