'use client';

/**
 * Sphere Grid Page - FFX-Style Competency Visualization
 *
 * @hyro-domain competency_visualization
 * @hyro-manifold Progress map showing mastery spreading like light across skills
 *
 * This page displays an interactive sphere grid where students can:
 * - See their learning progression radiating outward from core skills
 * - Identify which competencies are test-ready (high confidence)
 * - Explore prerequisites and unlock paths
 * - Track progress over time
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useUser, RedirectToSignIn } from '@clerk/nextjs';
import { SphereGridVisualization, NodeDetailPanel } from '@/components/forge/sphere-grid';
import { createDemoGrid, generateProgressSnapshot } from '@/lib/hyro/sphere-grid-generator';
import type { SphereNode, SphereGrid, GridProgressSnapshot, SphereSubject } from '@/lib/hyro/sphere-grid-types';
import { DEFAULT_SPHERE_COLORS } from '@/lib/hyro/sphere-grid-types';

// =============================================================================
// FILTER PANEL
// =============================================================================

interface FilterPanelProps {
  subjects: SphereSubject[];
  selectedSubjects: Set<SphereSubject>;
  onSubjectToggle: (subject: SphereSubject) => void;
  showTestReady: boolean;
  onShowTestReadyToggle: () => void;
  showMastered: boolean;
  onShowMasteredToggle: () => void;
}

function FilterPanel({
  subjects,
  selectedSubjects,
  onSubjectToggle,
  showTestReady,
  onShowTestReadyToggle,
  showMastered,
  onShowMasteredToggle,
}: FilterPanelProps) {
  const colors = DEFAULT_SPHERE_COLORS;

  const subjectLabels: Record<SphereSubject, string> = {
    math: 'Math',
    ela: 'ELA',
    science: 'Science',
    social_studies: 'Social Studies',
    critical_thinking: 'Critical Thinking',
    neuroscience: 'Neuroscience',
    decision_making: 'Decision Making',
    pattern_recognition: 'Patterns',
    meta_learning: 'Meta-Learning',
  };

  return (
    <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Filter View</h3>

      {/* Subject filters */}
      <div className="mb-6">
        <div className="text-[10px] text-zinc-500 uppercase mb-2">Subjects</div>
        <div className="flex flex-wrap gap-2">
          {subjects.map((subject) => (
            <button
              key={subject}
              onClick={() => onSubjectToggle(subject)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                selectedSubjects.has(subject)
                  ? 'border-white/30'
                  : 'border-transparent opacity-50 hover:opacity-75'
              }`}
              style={{
                backgroundColor: selectedSubjects.has(subject)
                  ? `${colors[subject]}30`
                  : 'transparent',
                color: colors[subject],
              }}
            >
              {subjectLabels[subject]}
            </button>
          ))}
        </div>
      </div>

      {/* Quick filters */}
      <div className="space-y-2">
        <div className="text-[10px] text-zinc-500 uppercase mb-2">Quick Filters</div>
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={showTestReady}
            onChange={onShowTestReadyToggle}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500/20"
          />
          <span className="text-sm text-zinc-400 group-hover:text-zinc-300">
            Highlight Test-Ready
          </span>
          <span className="ml-auto text-xs px-2 py-0.5 bg-blue-900/50 text-blue-400 rounded">
            Ready
          </span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={showMastered}
            onChange={onShowMasteredToggle}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/20"
          />
          <span className="text-sm text-zinc-400 group-hover:text-zinc-300">
            Show Mastered
          </span>
          <span className="ml-auto text-xs px-2 py-0.5 bg-emerald-900/50 text-emerald-400 rounded">
            {showMastered ? 'Visible' : 'Hidden'}
          </span>
        </label>
      </div>
    </div>
  );
}

// =============================================================================
// PROGRESS OVERVIEW
// =============================================================================

interface ProgressOverviewProps {
  snapshot: GridProgressSnapshot;
}

function ProgressOverview({ snapshot }: ProgressOverviewProps) {
  const colors = DEFAULT_SPHERE_COLORS;

  return (
    <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Progress Overview</h3>

      {/* Overall progress */}
      <div className="mb-6">
        <div className="flex items-end justify-between mb-2">
          <span className="text-4xl font-bold text-white">{snapshot.completionPercent}%</span>
          <span className="text-xs text-zinc-500">
            {snapshot.masteredNodes} / {snapshot.totalNodes} mastered
          </span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
            style={{ width: `${snapshot.completionPercent}%` }}
          />
        </div>
      </div>

      {/* Subject breakdown */}
      <div className="space-y-3">
        <div className="text-[10px] text-zinc-500 uppercase mb-2">By Subject</div>
        {Object.entries(snapshot.bySubject)
          .filter(([_, data]) => data.total > 0)
          .sort(([_, a], [__, b]) => b.percent - a.percent)
          .slice(0, 5)
          .map(([subject, data]) => (
            <div key={subject} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400 capitalize">{subject.replace('_', ' ')}</span>
                <span className="text-zinc-300 font-medium">{data.percent}%</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${data.percent}%`,
                    backgroundColor: colors[subject as SphereSubject] || colors.math,
                  }}
                />
              </div>
            </div>
          ))}
      </div>

      {/* Test-ready callout */}
      {snapshot.testReadyCount > 0 && (
        <div className="mt-6 p-4 bg-blue-900/30 border border-blue-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <div className="text-sm font-bold text-blue-300">
                {snapshot.testReadyCount} Standards Test-Ready
              </div>
              <div className="text-xs text-blue-400/70">
                High confidence for assessment
              </div>
            </div>
          </div>
          <Link
            href="/hyro/forge/diagnostic"
            className="mt-3 block w-full text-center py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Take Assessments →
          </Link>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// LEGEND
// =============================================================================

function Legend() {
  const colors = DEFAULT_SPHERE_COLORS;

  const states = [
    { key: 'locked', label: 'Locked', color: colors.locked },
    { key: 'available', label: 'Available', color: colors.available },
    { key: 'in_progress', label: 'In Progress', color: colors.inProgress },
    { key: 'approaching', label: 'Approaching', color: colors.approaching },
    { key: 'mastered', label: 'Mastered', color: colors.mastered },
    { key: 'test_ready', label: 'Test Ready', color: colors.testReady },
    { key: 'tested_passed', label: 'Passed', color: colors.testedPassed },
    { key: 'legendary', label: 'Legendary', color: colors.legendary },
  ];

  return (
    <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Legend</h3>
      <div className="grid grid-cols-2 gap-2">
        {states.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-zinc-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function SphereGridPage() {
  const { user, isLoaded } = useUser();

  // Grid state
  const [grid, setGrid] = useState<SphereGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectedNode, setSelectedNode] = useState<SphereNode | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<SphereSubject>>(
    new Set(['math', 'ela', 'critical_thinking'])
  );
  const [showTestReady, setShowTestReady] = useState(true);
  const [showMastered, setShowMastered] = useState(true);

  // Load grid data
  useEffect(() => {
    async function loadGrid() {
      if (!isLoaded) return;

      try {
        // For now, use demo grid. In production, fetch from API
        const demoGrid = createDemoGrid(user?.id || 'demo-student');
        setGrid(demoGrid);

        // TODO: Fetch real grid from API
        // const res = await fetch('/api/hyro/sphere-grid');
        // const json = await res.json();
        // if (json.success) {
        //   setGrid(json.data);
        // }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load grid');
      } finally {
        setLoading(false);
      }
    }

    loadGrid();
  }, [isLoaded, user]);

  // Generate progress snapshot
  const progressSnapshot = useMemo(() => {
    if (!grid) return null;
    return generateProgressSnapshot(grid);
  }, [grid]);

  // Available subjects
  const availableSubjects = useMemo<SphereSubject[]>(() => {
    if (!grid) return [];
    const subjects = new Set<SphereSubject>();
    grid.nodes.forEach((node) => subjects.add(node.subject));
    return Array.from(subjects);
  }, [grid]);

  // Handlers
  const handleSubjectToggle = useCallback((subject: SphereSubject) => {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) {
        next.delete(subject);
      } else {
        next.add(subject);
      }
      return next;
    });
  }, []);

  const handleNodeClick = useCallback((node: SphereNode) => {
    setSelectedNode(node);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleNavigateToNode = useCallback((nodeId: string) => {
    if (!grid) return;
    const node = grid.nodes.get(nodeId);
    if (node) {
      setSelectedNode(node);
    }
  }, [grid]);

  // Auth loading
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <RedirectToSignIn />;
  }

  // Data loading
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Generating sphere grid...</p>
          <p className="text-gray-500 text-sm mt-2">Mapping your learning journey</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !grid) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-400 mb-2">Failed to Load Grid</h2>
          <p className="text-gray-300 mb-4">{error || 'Unable to generate sphere grid'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/20 via-blue-900/20 to-cyan-900/20 border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">🔮</span>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Sphere Grid
                </h1>
              </div>
              <p className="text-sm text-zinc-400">
                Your learning journey visualized • Explore competencies radiating from core skills
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/hyro/forge"
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg border border-white/10 transition-colors"
              >
                ← Back to Forge
              </Link>
              <Link
                href="/hyro/forge/diagnostic"
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-purple-900/30 transition-colors"
              >
                🎯 Take Assessments
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-6">
          {/* Left Sidebar - Filters */}
          <div className="space-y-6">
            <FilterPanel
              subjects={availableSubjects}
              selectedSubjects={selectedSubjects}
              onSubjectToggle={handleSubjectToggle}
              showTestReady={showTestReady}
              onShowTestReadyToggle={() => setShowTestReady(!showTestReady)}
              showMastered={showMastered}
              onShowMasteredToggle={() => setShowMastered(!showMastered)}
            />
            <Legend />
          </div>

          {/* Center - Visualization */}
          <div className="min-h-[700px]">
            <SphereGridVisualization
              grid={grid}
              width={900}
              height={900}
              onNodeClick={handleNodeClick}
              showConnections={true}
              showLabels={true}
              animationsEnabled={true}
              className="w-full h-full"
            />
          </div>

          {/* Right Sidebar - Progress */}
          <div className="space-y-6">
            {progressSnapshot && <ProgressOverview snapshot={progressSnapshot} />}

            {/* Quick stats */}
            <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-zinc-800/50 rounded-xl">
                  <div className="text-2xl font-bold text-amber-400">{grid.stats.inProgressNodes}</div>
                  <div className="text-[10px] text-zinc-500 uppercase">In Progress</div>
                </div>
                <div className="text-center p-3 bg-zinc-800/50 rounded-xl">
                  <div className="text-2xl font-bold text-zinc-400">{grid.stats.availableNodes}</div>
                  <div className="text-[10px] text-zinc-500 uppercase">Available</div>
                </div>
                <div className="text-center p-3 bg-zinc-800/50 rounded-xl">
                  <div className="text-2xl font-bold text-zinc-600">{grid.stats.lockedNodes}</div>
                  <div className="text-[10px] text-zinc-500 uppercase">Locked</div>
                </div>
                <div className="text-center p-3 bg-zinc-800/50 rounded-xl">
                  <div className="text-2xl font-bold text-white">{grid.stats.totalNodes}</div>
                  <div className="text-[10px] text-zinc-500 uppercase">Total</div>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-2xl p-5 border border-purple-500/20">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3">💡 Tips</h3>
              <ul className="text-xs text-zinc-400 space-y-2">
                <li>• <strong className="text-zinc-300">Scroll</strong> to zoom in/out</li>
                <li>• <strong className="text-zinc-300">Drag</strong> to pan around</li>
                <li>• <strong className="text-zinc-300">Click</strong> nodes for details</li>
                <li>• <strong className="text-zinc-300">Glowing</strong> nodes = higher mastery</li>
                <li>• <strong className="text-zinc-300">Pulsing blue</strong> = test-ready</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Node Detail Panel */}
      <NodeDetailPanel
        node={selectedNode}
        onClose={handleCloseDetail}
        onNavigateToNode={handleNavigateToNode}
      />
    </div>
  );
}
