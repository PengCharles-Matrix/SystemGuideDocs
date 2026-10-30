import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; errorId: string };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorId: "" };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true, errorId: new Date().toISOString() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("SystemGuideDocs UI recovered from a rendering error.", error, info.componentStack);
  }

  private recover = () => {
    this.setState({ hasError: false, errorId: "" });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main role="alert" className="app-error-screen">
          <section className="app-error-card">
            <h1>SystemGuideDocs encountered a problem</h1>
            <p>Your current page could not be rendered. The application caught the error so the entire interface does not remain blank.</p>
            <p>Reload the application to restore the last server-saved workspace. Unsaved edits may need to be recovered from your local draft.</p>
            <button type="button" onClick={this.recover}>Reload application</button>
            <small>Error reference: {this.state.errorId}</small>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
