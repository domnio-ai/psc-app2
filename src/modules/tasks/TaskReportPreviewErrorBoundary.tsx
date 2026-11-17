import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  onClose: () => void;
};

type State = {
  error: Error | null;
  componentStack: string;
};

export default class TaskReportPreviewErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Task Report preview failed to render", error, info);
    this.setState({ componentStack: info.componentStack || "" });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="task-report-preview-error" role="alert">
          <section>
            <small>TASK REPORT PREVIEW</small>
            <h2>The preview could not be opened</h2>
            <p>Your report remains saved in the Task workspace.</p>
            <details open>
              <summary>Preview error details</summary>
              <pre>{`${this.state.error.name}: ${this.state.error.message}`.slice(0, 1200)}</pre>
              {this.state.componentStack && <pre>{this.state.componentStack}</pre>}
            </details>
            <button type="button" onClick={this.props.onClose}>Return to report editor</button>
          </section>
        </div>
      );
    }

    return this.props.children;
  }
}
