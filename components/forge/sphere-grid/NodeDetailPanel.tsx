'use client';

/**
 * Node Detail Panel Component
 *
 * @hyro-domain competency_visualization
 * Shows detailed information about a selected node in the sphere grid
 */

import React from 'react';
import Link from 'next/link';
import type { SphereNode, NodeDetail, SphereSubject } from '@/lib/hyro/sphere-grid-types';
import { DEFAULT_SPHERE_COLORS } from '@/lib/hyro/sphere-grid-types';

interface NodeDetailPanelProps {
  node: SphereNode | null;
  detail?: NodeDetail | null;
  onClose: () => void;
  onNavigateToNode?: (nodeId: string) => void;
}

/**
 * Get color for a subject
 */
function getSubjectColor(subject: SphereSubject): string {
  const colors = DEFAULT_SPHERE_COLORS;
  const colorMap: Record<SphereSubject, string> = {
    math: colors.math,
    ela: colors.ela,
    science: colors.science,
    social_studies: colors.social_studies,
    critical_thinking: colors.critical_thinking,
    neuroscience: colors.neuroscience,
    decision_making: colors.decision_making,
    pattern_recognition: colors.pattern_recognition,
    meta_learning: colors.meta_learning,
  };
  return colorMap[subject] || colors.math;
}

/**
 * Format subject name for display
 */
function formatSubject(subject: SphereSubject): string {
  const names: Record<SphereSubject, string> = {
    math: 'Mathematics',
    ela: 'English Language Arts',
    science: 'Science',
    social_studies: 'Social Studies',
    critical_thinking: 'Critical Thinking',
    neuroscience: 'Neuroscience',
    decision_making: 'Decision Making',
    pattern_recognition: 'Pattern Recognition',
    meta_learning: 'Meta-Learning',
  };
  return names[subject] || subject;
}

/**
 * Get state badge styling
 */
function getStateBadge(state: string): { bg: string; text: string; label: string } {
  const badges: Record<string, { bg: string; text: string; label: string }> = {
    locked: { bg: 'bg-zinc-800', text: 'text-zinc-500', label: 'Locked' },
    available: { bg: 'bg-zinc-700', text: 'text-zinc-300', label: 'Available' },
    in_progress: { bg: 'bg-amber-900/50', text: 'text-amber-400', label: 'In Progress' },
    approaching: { bg: 'bg-orange-900/50', text: 'text-orange-400', label: 'Approaching Mastery' },
    mastered: { bg: 'bg-emerald-900/50', text: 'text-emerald-400', label: 'Mastered' },
    test_ready: { bg: 'bg-blue-900/50', text: 'text-blue-400', label: '✨ Test Ready' },
    tested_passed: { bg: 'bg-yellow-900/50', text: 'text-yellow-400', label: '🏆 Test Passed' },
    legendary: { bg: 'bg-purple-900/50', text: 'text-purple-400', label: '⭐ Legendary' },
  };
  return badges[state] || badges.available;
}

export function NodeDetailPanel({
  node,
  detail,
  onClose,
  onNavigateToNode,
}: NodeDetailPanelProps) {
  if (!node) return null;

  const subjectColor = getSubjectColor(node.subject);
  const stateBadge = getStateBadge(node.state);
  const testConfidence = node.testOutConfidence;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-96 bg-zinc-900/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-50 overflow-y-auto">
      {/* Header */}
      <div
        className="sticky top-0 p-6 border-b border-white/10"
        style={{ background: `linear-gradient(135deg, ${subjectColor}20, transparent)` }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: `${subjectColor}30`, color: subjectColor }}
              >
                {formatSubject(node.subject)}
              </span>
              <span className="text-[10px] text-zinc-500">Grade {node.gradeLevel}</span>
            </div>
            <h2 className="text-lg font-bold text-white mb-1">{node.name}</h2>
            <p className="text-xs text-zinc-400">{node.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status Badge */}
        <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium mt-3 ${stateBadge.bg} ${stateBadge.text}`}>
          {stateBadge.label}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Description */}
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Description</h3>
          <p className="text-sm text-zinc-300 leading-relaxed">{node.description}</p>
        </div>

        {/* Domain & Cluster */}
        {node.domain && (
          <div>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Domain</h3>
            <p className="text-sm text-zinc-300">{node.domain}</p>
            {node.cluster && (
              <p className="text-xs text-zinc-500 mt-1">{node.cluster}</p>
            )}
          </div>
        )}

        {/* Mastery Progress */}
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Mastery Progress</h3>
          <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl font-bold text-white">{node.mastery.score}%</span>
              <span className={`text-xs px-2 py-1 rounded ${
                node.mastery.trend === 'improving' ? 'bg-emerald-900/50 text-emerald-400' :
                node.mastery.trend === 'declining' ? 'bg-red-900/50 text-red-400' :
                'bg-zinc-700 text-zinc-400'
              }`}>
                {node.mastery.trend === 'improving' ? '↑ Improving' :
                 node.mastery.trend === 'declining' ? '↓ Declining' : '→ Stable'}
              </span>
            </div>
            <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${node.mastery.score}%`,
                  background: `linear-gradient(90deg, ${subjectColor}80, ${subjectColor})`
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 mt-2">
              <span>Level: {node.mastery.level}</span>
              <span>{node.mastery.assessmentCount} assessments</span>
            </div>
          </div>
        </div>

        {/* Test-Out Confidence */}
        {node.state !== 'locked' && (
          <div>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Test-Out Readiness</h3>
            <div className={`rounded-xl p-4 border ${
              testConfidence.category === 'recommend_now' ? 'bg-blue-900/30 border-blue-500/30' :
              testConfidence.category === 'likely_ready' ? 'bg-emerald-900/30 border-emerald-500/30' :
              testConfidence.category === 'needs_prep' ? 'bg-amber-900/30 border-amber-500/30' :
              'bg-zinc-800/50 border-white/5'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold text-white">{testConfidence.score}%</span>
                <span className={`text-xs font-medium ${
                  testConfidence.category === 'recommend_now' ? 'text-blue-400' :
                  testConfidence.category === 'likely_ready' ? 'text-emerald-400' :
                  testConfidence.category === 'needs_prep' ? 'text-amber-400' :
                  'text-zinc-400'
                }`}>
                  {testConfidence.category === 'recommend_now' ? '🎯 Recommended Now!' :
                   testConfidence.category === 'likely_ready' ? '✓ Likely Ready' :
                   testConfidence.category === 'needs_prep' ? '📚 Needs More Prep' :
                   '🔒 Not Ready'}
                </span>
              </div>
              {testConfidence.category === 'recommend_now' && (
                <Link
                  href={`/hyro/forge/diagnostic?standard=${node.id}`}
                  className="mt-3 block w-full text-center py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors"
                >
                  Take Test Now →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Details</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-white/5">
              <div className="text-[10px] text-zinc-500 uppercase">DOK Level</div>
              <div className="text-sm font-bold text-white mt-1">{node.dokLevel}</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-white/5">
              <div className="text-[10px] text-zinc-500 uppercase">Est. Time</div>
              <div className="text-sm font-bold text-white mt-1">{node.estimatedMinutes} min</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-white/5">
              <div className="text-[10px] text-zinc-500 uppercase">Ring</div>
              <div className="text-sm font-bold text-white mt-1">Tier {node.tier}</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-white/5">
              <div className="text-[10px] text-zinc-500 uppercase">Core Standard</div>
              <div className="text-sm font-bold text-white mt-1">{node.isCore ? '★ Yes' : 'No'}</div>
            </div>
          </div>
        </div>

        {/* Prerequisites */}
        {node.prerequisites.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
              Prerequisites ({node.prerequisites.length})
            </h3>
            <div className="space-y-2">
              {node.prerequisites.map((prereqId) => (
                <button
                  key={prereqId}
                  onClick={() => onNavigateToNode?.(prereqId)}
                  className="w-full text-left px-3 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 rounded-lg border border-white/5 transition-colors group"
                >
                  <span className="text-sm text-zinc-300 group-hover:text-white">{prereqId}</span>
                  <span className="float-right text-zinc-500 group-hover:text-zinc-300">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Unlocks */}
        {node.unlocks.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
              Unlocks ({node.unlocks.length})
            </h3>
            <div className="space-y-2">
              {node.unlocks.map((unlockId) => (
                <button
                  key={unlockId}
                  onClick={() => onNavigateToNode?.(unlockId)}
                  className="w-full text-left px-3 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 rounded-lg border border-white/5 transition-colors group"
                >
                  <span className="text-sm text-zinc-300 group-hover:text-white">{unlockId}</span>
                  <span className="float-right text-zinc-500 group-hover:text-zinc-300">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Assessment History (if detail provided) */}
        {detail?.assessmentHistory && detail.assessmentHistory.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Recent Assessments</h3>
            <div className="space-y-2">
              {detail.assessmentHistory.slice(0, 5).map((assessment, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 rounded-lg border border-white/5"
                >
                  <div>
                    <div className="text-xs text-zinc-400">{assessment.type}</div>
                    <div className="text-[10px] text-zinc-500">
                      {new Date(assessment.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className={`text-sm font-bold ${
                    assessment.score >= 85 ? 'text-emerald-400' :
                    assessment.score >= 70 ? 'text-amber-400' :
                    'text-red-400'
                  }`}>
                    {assessment.score}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Actions</h3>
          <div className="space-y-2">
            {node.state !== 'locked' && (
              <>
                <Link
                  href={`/hyro/forge/session?focus=${node.id}`}
                  className="block w-full text-center py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-bold rounded-lg transition-colors"
                >
                  🚀 Practice This Standard
                </Link>
                <Link
                  href={`/hyro/forge/srs?topic=${node.id}`}
                  className="block w-full text-center py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg border border-white/10 transition-colors"
                >
                  🧠 Add to SRS Deck
                </Link>
              </>
            )}
            {node.state === 'locked' && (
              <div className="text-center py-4 text-sm text-zinc-500">
                Complete prerequisites to unlock this standard
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NodeDetailPanel;
