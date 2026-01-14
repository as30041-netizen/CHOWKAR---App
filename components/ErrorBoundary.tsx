import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-8">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl max-w-md w-full text-center border-4 border-red-50 dark:border-red-900/20">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-4">Something went wrong</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">
              {this.state.error?.message || 'We encountered an unexpected error.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-2xl transition-all active:scale-95"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
