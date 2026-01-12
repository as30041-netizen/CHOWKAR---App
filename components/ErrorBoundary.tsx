import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });

    // TODO: Log to error tracking service (Sentry, LogRocket, etc.)
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border-4 border-white dark:border-gray-700 p-8 text-center">
            {/* Error Icon */}
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} className="text-red-600 dark:text-red-400" />
            </div>

            {/* Error Message */}
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">
              Oops! Something Went Wrong
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6 font-medium leading-relaxed">
              {this.props.fallbackMessage ||
                "We encountered an unexpected error. Don't worry, your data is safe."}
            </p>

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-6 text-left">
                <p className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Error Details (Dev Only):
                </p>
                <pre className="text-xs text-red-600 dark:text-red-400 overflow-auto max-h-32 font-mono">
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      Component Stack
                    </summary>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-32 mt-2 font-mono">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-4 rounded-2xl font-black uppercase tracking-wider text-sm transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} />
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-4 rounded-2xl font-black uppercase tracking-wider text-sm transition-all hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95"
              >
                Go Home
              </button>
            </div>

            {/* Help Text */}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-6 font-medium">
              If this persists, please refresh the page or contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Convenience wrapper for specific sections
export const SectionErrorBoundary: React.FC<{ children: ReactNode; section: string }> = ({
  children,
  section
}) => {
  return (
    <ErrorBoundary fallbackMessage={`We encountered an error in the ${section} section. Please try refreshing.`}>
      {children}
    </ErrorBoundary>
  );
};
