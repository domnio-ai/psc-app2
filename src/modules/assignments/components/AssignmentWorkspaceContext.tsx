import type { AssignmentWorkspaceTab } from "./AssignmentWorkspaceShell";

type Props = {
  activeTab: AssignmentWorkspaceTab;
  notice: string;
  felixOpen: boolean;
  felixQuestion: string;
  felixBusy: boolean;
  felixAnswer: string;
  onSelectTab: (tab: AssignmentWorkspaceTab) => void;
  onDismissNotice: () => void;
  onToggleFelix: () => void;
  onHideFelix: () => void;
  onQuestionChange: (question: string) => void;
  onAskFelix: () => void | Promise<void>;
  onDismissAnswer: () => void;
};

const prompts = [
  "Summarize this assignment",
  "What is overdue?",
  "What should I do next?",
  "Give me a progress update",
] as const;

export default function AssignmentWorkspaceContext({
  activeTab,
  notice,
  felixOpen,
  felixQuestion,
  felixBusy,
  felixAnswer,
  onSelectTab,
  onDismissNotice,
  onToggleFelix,
  onHideFelix,
  onQuestionChange,
  onAskFelix,
  onDismissAnswer,
}: Props) {
  void activeTab;
  void onSelectTab;

  return (
    <>
      {notice && (
        <div className="workspace-notice session-message assignment-dismissible-message" role="status">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={onDismissNotice}>×</button>
        </div>
      )}

      <aside className="assignment-felix-context">
        <header>
          <button type="button" onClick={onToggleFelix}>
            {felixOpen ? "Felix assignment assistant" : "Ask Felix about this assignment"}
          </button>
          {felixOpen && (
            <button
              type="button"
              className="assignment-felix-hide"
              onClick={onHideFelix}
              aria-label="Hide Felix assignment assistant"
            >
              Hide ×
            </button>
          )}
        </header>

        {felixOpen && (
          <div>
            <div className="assignment-felix-prompts">
              {prompts.map((question) => (
                <button type="button" key={question} onClick={() => onQuestionChange(question)}>
                  {question}
                </button>
              ))}
            </div>

            <label>
              Question
              <input
                value={felixQuestion}
                onChange={(event) => onQuestionChange(event.target.value)}
                placeholder="Find documents about…"
              />
            </label>

            <button
              type="button"
              disabled={!felixQuestion.trim() || felixBusy}
              onClick={() => void onAskFelix()}
            >
              {felixBusy ? "Thinking…" : "Ask Felix"}
            </button>

            {felixAnswer && (
              <p>
                <span>{felixAnswer}</span>
                <button type="button" aria-label="Dismiss Felix response" onClick={onDismissAnswer}>×</button>
              </p>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
