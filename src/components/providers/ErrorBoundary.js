'use client';

/**
 * Global Error Boundary
 * Catches React render errors and network failures
 * Prevents entire app from crashing
 * Auto-logs errors for debugging
 */

import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { reportError } from '@/lib/error-logger';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const errorId = Math.random().toString(36).substr(2, 9);
    
    this.setState({
      error,
      errorInfo,
      errorId,
    });

    // Log to our error tracking system
    reportError(`React Error Boundary: ${error.message}`, {
      severity: 'critical',
      errorCode: 'ERR_REACT_BOUNDARY',
      stack: errorInfo.componentStack,
      context: {
        errorId,
        componentStack: errorInfo.componentStack,
      },
    }).catch(() => {
      // Silently fail if logging fails
    });

    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8 max-w-md w-full border border-red-200 dark:border-red-800">
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <AlertTriangle className="w-12 h-12 text-red-600 dark:text-red-400" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
              Something Went Wrong
            </h1>

            {/* Error ID */}
            <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
              Error ID: <code className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{this.state.errorId}</code>
            </p>

            {/* Error Message */}
            {this.state.error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-300 dark:border-red-700">
                <p className="text-sm font-mono text-red-800 dark:text-red-200 break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}

            {/* Component Stack (dev only) */}
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mb-4 text-xs">
                <summary className="cursor-pointer font-semibold text-gray-700 dark:text-gray-300">
                  Stack Trace
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-auto max-h-40 text-gray-700 dark:text-gray-300">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition"
              >
                <Home className="w-4 h-4" />
                Home
              </button>
            </div>

            {/* Help Text */}
            <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
              This error has been automatically logged. Our team has been notified.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
