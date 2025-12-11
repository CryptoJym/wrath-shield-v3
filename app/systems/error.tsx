'use client';

/**
 * Error Boundary for Systems Page
 *
 * Catches rendering errors in the systems telemetry dashboard
 * and provides a graceful fallback UI with retry capability.
 */

import { useEffect } from 'react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SystemsError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log error to monitoring service
    console.error('[Systems Page Error]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        {/* Error Card */}
        <div className="bg-slate-900/80 border border-red-500/30 rounded-lg p-8">
          {/* Status Indicator */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative">
              <div className="w-4 h-4 rounded-full bg-red-500" />
              <div className="absolute inset-0 w-4 h-4 rounded-full bg-red-500 animate-ping opacity-50" />
            </div>
            <span className="text-red-400 font-mono text-sm uppercase tracking-wider">
              System Error
            </span>
          </div>

          {/* Error Message */}
          <h1 className="text-2xl font-bold text-white mb-3">
            Telemetry Connection Failed
          </h1>
          <p className="text-slate-400 mb-6">
            Unable to establish connection with the systems telemetry service.
            This may be a temporary issue.
          </p>

          {/* Error Details (collapsible in production) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-md overflow-auto">
              <p className="text-xs text-slate-500 font-mono mb-2">Error Details:</p>
              <code className="text-xs text-red-300 font-mono break-all">
                {error.message}
              </code>
              {error.digest && (
                <p className="text-xs text-slate-600 font-mono mt-2">
                  Digest: {error.digest}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={reset}
              className="flex-1 px-4 py-3 bg-nano-green/20 border border-nano-green/50 text-nano-green
                         hover:bg-nano-green/30 transition-colors rounded-md font-medium"
            >
              Retry Connection
            </button>
            <a
              href="/"
              className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 text-slate-300
                         hover:bg-slate-700 transition-colors rounded-md font-medium text-center"
            >
              Return Home
            </a>
          </div>
        </div>

        {/* System Status Hint */}
        <div className="mt-6 text-center">
          <p className="text-slate-500 text-sm">
            If this issue persists, check the server logs for more details.
          </p>
        </div>
      </div>
    </div>
  );
}
