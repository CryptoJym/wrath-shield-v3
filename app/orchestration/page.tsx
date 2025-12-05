'use client';

/**
 * Unified Orchestration Page
 *
 * The command center for James's Life OS - showing how all signals
 * are being processed, routed, and handled by the AI system.
 */

import { Brain, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import UnifiedOrchestrationDashboard from '@/components/orchestration/UnifiedOrchestrationDashboard';

export default function OrchestrationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="border-b border-slate-800/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
              <Brain className="w-4 h-4 text-violet-400" />
            </div>
            <span className="text-white font-medium">Life OS Orchestration</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <UnifiedOrchestrationDashboard />
      </main>
    </div>
  );
}
