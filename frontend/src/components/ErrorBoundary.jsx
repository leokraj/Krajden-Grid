import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught React Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#0d0f12] text-white flex flex-col items-center justify-center p-6 z-50 text-center font-sans">
          <div className="max-w-md w-full bg-[#161920] border border-red-500/30 rounded-xl p-6 shadow-2xl">
            <div className="text-3xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold text-red-400 mb-2">Something went wrong rendering the app</h2>
            <p className="text-xs text-gray-300 mb-2 bg-black/40 p-3 rounded font-mono overflow-auto max-h-32 text-left whitespace-pre-wrap">
              {this.state.error?.toString() || 'Unknown error occurred'}
            </p>
            {this.state.error?.stack && (
              <details className="mb-4 text-left">
                <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-white font-mono mb-1">View Detailed Stack Trace</summary>
                <pre className="text-[10px] text-red-300 bg-black/60 p-3 rounded font-mono overflow-auto max-h-48 whitespace-pre-wrap">
                  {this.state.error.stack}
                  {this.state.errorInfo?.componentStack ? '\n\nComponent Stack:' + this.state.errorInfo.componentStack : ''}
                </pre>
              </details>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[#caa055] text-black font-semibold rounded text-xs hover:bg-[#d5b271] transition-colors cursor-pointer"
              >
                Reload Application
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 bg-white/10 text-white font-semibold rounded text-xs hover:bg-white/20 transition-colors cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
