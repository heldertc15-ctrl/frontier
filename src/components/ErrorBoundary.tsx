import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Frontier UI error', error, info.componentStack);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-error" role="alert">
          <h1>Frontier could not load</h1>
          <p>Refresh the page to try again. If the problem continues, check the server logs.</p>
          <button className="button primary" onClick={() => window.location.reload()}>
            Reload Frontier
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
