'use client';

/**
 * SuggestionsPanel Component
 *
 * Displays predictive AI suggestions from Phase 4 pattern learning.
 * Shows priority suggestions, next action recommendations, completion time predictions, etc.
 *
 * Features:
 * - Confidence indicators
 * - Pattern-based rationale
 * - Accept/Reject actions
 * - Filter by suggestion type
 * - Visual confidence gradients
 */

import { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  Clock,
  User,
  Target,
  Check,
  X,
  Loader2,
  ChevronDown,
  Brain,
  Lightbulb,
} from 'lucide-react';

export interface Suggestion {
  id: string;
  suggestion_type: 'priority' | 'next_action' | 'completion_time' | 'assignment' | 'other';
  target_entity: {
    type: string;
    id: string;
  };
  suggestion: string;
  rationale: string;
  confidence: number; // 0-1
  based_on_patterns: string[];
  metadata?: Record<string, any>;
}

export interface SuggestionsPanelProps {
  suggestions: Suggestion[];
  onAccept: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onRefresh?: () => void;
  dismissedIds: Set<string>;
  onDismiss: (id: string) => void;
  onRestore?: (id: string) => void;
}

export function SuggestionsPanel({
  suggestions,
  onAccept,
  onReject,
  onRefresh,
  dismissedIds,
  onDismiss,
  onRestore,
}: SuggestionsPanelProps) {
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  const filteredSuggestions = (filterType === 'all'
    ? suggestions
    : suggestions.filter(s => s.suggestion_type === filterType))
    .filter(s => !dismissedIds.has(s.id));

  const suggestionTypes = Array.from(new Set(suggestions.map(s => s.suggestion_type)));

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'priority':
        return Target;
      case 'next_action':
        return TrendingUp;
      case 'completion_time':
        return Clock;
      case 'assignment':
        return User;
      default:
        return Lightbulb;
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    const pct = Math.round(confidence * 100);
    let bgColor = 'bg-slate-700';
    let textColor = 'text-slate-400';
    let borderColor = 'border-slate-600';

    if (pct >= 80) {
      bgColor = 'bg-emerald-900/50';
      textColor = 'text-emerald-300';
      borderColor = 'border-emerald-500/30';
    } else if (pct >= 60) {
      bgColor = 'bg-amber-900/50';
      textColor = 'text-amber-300';
      borderColor = 'border-amber-500/30';
    }

    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded border ${borderColor} ${bgColor}`}>
        <div className="flex items-center gap-0.5">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`w-1 h-3 rounded-sm ${i < Math.round(confidence * 5) ? textColor.replace('text-', 'bg-') : 'bg-slate-700'
                }`}
            />
          ))}
        </div>
        <span className={`text-xs font-medium ${textColor}`}>{pct}%</span>
      </div>
    );
  };


  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'info' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleAccept = async (id: string) => {
    const suggestion = suggestions.find(s => s.id === id);
    setActioningId(id);
    // Optimistic Update: Immediately hide from UI
    onDismiss(id);

    try {
      await onAccept(id);

      // Show meaningful feedback
      let msg = "Suggestion applied successfully.";
      if (suggestion?.suggestion_type === 'priority') msg = "Priority updated based on analysis.";
      if (suggestion?.suggestion_type === 'assignment') msg = "Task reassigned to target agent.";
      if (suggestion?.suggestion_type === 'next_action') msg = "Next action queued.";

      showFeedback(msg, 'success');

      // No need to clear actioningId or refresh if it worked, as it's gone.
      // But we call onRefresh to sync backend eventually
      onRefresh?.();
    } catch (error) {
      // Revert if failed
      onRestore?.(id);
      console.error('Failed to accept suggestion:', error);
      showFeedback("Failed to apply suggestion.", 'info');
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActioningId(id);
    // Optimistic Update
    onDismiss(id);

    try {
      await onReject(id);
      showFeedback("Suggestion dismissed.", 'info');
      onRefresh?.();
    } catch (error) {
      onRestore?.(id);
    } finally {
      setActioningId(null);
    }
  };

  if (suggestions.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-full bg-purple-900/20">
            <Brain size={32} className="text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-400">Learning Patterns...</h3>
          <p className="text-sm text-slate-500">
            Suggestions will appear as the council learns from your task patterns
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-950/20 to-slate-950/20 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-600/20">
            <Sparkles size={24} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-purple-400 flex items-center gap-2">
              AI SUGGESTIONS
              <span className="px-2 py-0.5 text-xs rounded-full bg-purple-600 text-white font-bold">
                {suggestions.length}
              </span>
            </h2>
            <p className="text-sm text-slate-400">Pattern-based recommendations to consider</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {suggestionTypes.length > 1 && (
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-2 py-1.5 text-xs rounded bg-slate-800 border border-slate-700 text-slate-300 focus:outline-none focus:border-slate-500"
            >
              <option value="all">All types</option>
              {suggestionTypes.map(type => (
                <option key={type} value={type}>{type.replace('_', ' ')}</option>
              ))}
            </select>
          )}
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Suggestion Cards */}
      <div className="space-y-3">
        {filteredSuggestions
          .sort((a, b) => b.confidence - a.confidence) // High confidence first
          .map((suggestion) => {
            const isExpanded = expandedId === suggestion.id;
            const isActioning = actioningId === suggestion.id;
            const SuggestionIcon = getSuggestionIcon(suggestion.suggestion_type);

            return (
              <div
                key={suggestion.id}
                className={`rounded-lg border p-4 space-y-3 transition ${suggestion.confidence >= 0.8
                  ? 'border-purple-500/30 bg-purple-950/10'
                  : 'border-slate-700 bg-slate-900/30'
                  }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <SuggestionIcon size={18} className="text-purple-400" />
                      <span className="px-2 py-0.5 text-xs rounded bg-purple-900/50 text-purple-300 font-medium">
                        {suggestion.suggestion_type.replace('_', ' ')}
                      </span>
                      {getConfidenceBadge(suggestion.confidence)}
                      {suggestion.confidence >= 0.8 && (
                        <Sparkles size={14} className="text-purple-400" />
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-slate-100">{suggestion.suggestion}</h3>
                    <p className="text-sm text-slate-400 mt-1">{suggestion.rationale}</p>
                  </div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : suggestion.id)}
                    className="p-2 rounded-lg hover:bg-slate-700/50 transition"
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    <ChevronDown
                      size={18}
                      className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="space-y-3 pt-3 border-t border-slate-700/50">
                    {/* Patterns */}
                    {suggestion.based_on_patterns.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-xs text-slate-500 uppercase tracking-wide">
                          Based on patterns:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestion.based_on_patterns.map((pattern, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-xs rounded bg-purple-900/30 text-purple-300 border border-purple-500/20"
                            >
                              {pattern}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Target Entity */}
                    <div className="grid grid-cols-2 gap-4 text-xs text-slate-500">
                      <div>
                        <span className="text-slate-600">Target:</span> {suggestion.target_entity.type}
                      </div>
                      <div>
                        <span className="text-slate-600">Entity ID:</span> {suggestion.target_entity.id}
                      </div>
                    </div>

                    {/* Metadata (if available) */}
                    {suggestion.metadata && Object.keys(suggestion.metadata).length > 0 && (
                      <div className="p-2 rounded bg-slate-900/70 border border-slate-700/30 text-xs font-mono text-slate-400 overflow-x-auto">
                        <pre>{JSON.stringify(suggestion.metadata, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2 border-t border-slate-700/50">
                  <button
                    onClick={() => handleAccept(suggestion.id)}
                    disabled={isActioning}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    {isActioning && actioningId === suggestion.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Check size={16} />
                    )}
                    Accept
                  </button>
                  <button
                    onClick={() => handleReject(suggestion.id)}
                    disabled={isActioning}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    <X size={16} />
                    Not Now
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {/* Toast Feedback */}
      {
        feedback && (
          <div className={`fixed bottom-8 right-8 px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 z-50 ${feedback.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
            : 'bg-slate-800/90 border-slate-600 text-slate-200'
            }`}>
            {feedback.type === 'success' ? <Check size={18} /> : <X size={18} />}
            <span className="text-sm font-medium">{feedback.message}</span>
          </div>
        )
      }
    </section >
  );
}
