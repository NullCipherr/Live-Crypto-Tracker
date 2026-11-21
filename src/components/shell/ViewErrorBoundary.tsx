import { Component, type ReactNode } from 'react';

interface ViewErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ViewErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ViewErrorBoundary extends Component<
  ViewErrorBoundaryProps,
  ViewErrorBoundaryState
> {
  state: ViewErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ViewErrorBoundaryState {
    return { hasError: true, message: error.message || 'Erro ao renderizar visualização.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="max-w-md rounded-lg border border-border bg-card p-5 shadow-card">
            <h2 className="text-sm font-semibold text-foreground">
              {this.props.fallbackTitle ?? 'Não foi possível renderizar esta tela'}
            </h2>
            <p className="mt-1.5 font-mono text-xs text-muted-foreground">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="mt-4 h-8 rounded-md bg-accent px-3 text-xs font-semibold text-accent-foreground hover:opacity-90"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
