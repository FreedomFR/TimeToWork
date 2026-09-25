import { Component, ErrorInfo, ReactNode } from "react";
import { reportClientError } from "../utils/reportError";

interface State {
  failed: boolean;
}

/**
 * Last line of defense: if a component throws while rendering, show a message instead of a
 * blank page, and report the error to the journal so an admin can see it.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError(Object.assign(new Error(error.message), { stack: `${error.stack}\n${info.componentStack}` }), "react");
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-gray-200 p-6">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-lg font-semibold">Une erreur est survenue</h1>
          <p className="text-sm text-muted">
            L'incident a été signalé. Rechargez la page pour continuer.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-accent hover:bg-accentDark text-white text-sm font-medium px-4 py-2 rounded"
          >
            Recharger
          </button>
        </div>
      </div>
    );
  }
}
