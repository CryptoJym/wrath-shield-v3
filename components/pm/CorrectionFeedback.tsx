'use client';

/**
 * CorrectionFeedback Component
 *
 * Inline correction capability that allows users to teach the PM council
 * by correcting AI decisions. Feeds into Phase 4 temporal memory learning.
 *
 * Features:
 * - Inline edit trigger (pencil icon)
 * - Dropdown for known values or text input
 * - Required reason field for learning
 * - Optimistic UI updates
 * - Encourages user participation in AI training
 */

import { useState } from 'react';
import { Pencil, Check, X, Loader2, Sparkles } from 'lucide-react';

export interface CorrectionFeedbackProps {
  entityType: 'task' | 'project' | 'decision' | 'suggestion';
  entityId: string;
  attributeName: string; // 'priority', 'status', 'assignee', etc.
  currentValue: any;
  possibleValues?: { value: any; label: string }[]; // For dropdowns
  onCorrect: (correctedValue: any, reason: string) => Promise<void>;
  compact?: boolean; // If true, use inline mode; else modal
  className?: string;
}

export function CorrectionFeedback({
  entityType,
  entityId,
  attributeName,
  currentValue,
  possibleValues,
  onCorrect,
  compact = true,
  className = '',
}: CorrectionFeedbackProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [correctedValue, setCorrectedValue] = useState(currentValue);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (correctedValue === currentValue) {
      setError('Please select a different value');
      return;
    }

    if (!reason.trim()) {
      setError('Please explain why this correction is needed');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onCorrect(correctedValue, reason);

      // Success state
      setShowSuccess(true);
      setIsEditing(false);
      setCorrectedValue(currentValue);
      setReason('');

      // Hide success message after 2s
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record correction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setCorrectedValue(currentValue);
    setReason('');
    setError(null);
  };

  if (showSuccess) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-emerald-400 text-sm font-medium animate-pulse ${className}`}>
        <Check size={14} />
        <span>Correction recorded!</span>
        <Sparkles size={12} className="text-emerald-300" />
      </div>
    );
  }

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600 transition group ${className}`}
        aria-label={`Correct ${attributeName} for ${entityType} ${entityId}`}
      >
        <Pencil size={12} className="text-slate-500 group-hover:text-slate-300 transition" />
        <span className="text-xs text-slate-500 group-hover:text-slate-300">Correct</span>
      </button>
    );
  }

  // Inline editing mode
  if (compact) {
    return (
      <div className={`inline-flex flex-col gap-2 p-3 rounded-lg bg-slate-800/70 border border-amber-500/30 ${className}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">
            Correct {attributeName}:
          </span>
        </div>

        {/* Value selector */}
        <div className="flex items-center gap-2">
          {possibleValues ? (
            <select
              value={correctedValue}
              onChange={(e) => setCorrectedValue(e.target.value)}
              className="px-2 py-1.5 text-sm rounded bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-amber-500"
              disabled={isSubmitting}
            >
              {possibleValues.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={correctedValue}
              onChange={(e) => setCorrectedValue(e.target.value)}
              className="px-2 py-1.5 text-sm rounded bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-amber-500"
              placeholder="New value"
              disabled={isSubmitting}
            />
          )}
        </div>

        {/* Reason input */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">
            Why is this correct? (Help the council learn)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="E.g., 'Documentation tasks are medium priority unless blocking a release'"
            className="px-2 py-1.5 text-sm rounded bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-amber-500 resize-none"
            rows={2}
            disabled={isSubmitting}
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="text-xs text-rose-400 bg-rose-900/20 px-2 py-1 rounded border border-rose-500/30">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check size={14} />
                Submit
              </>
            )}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition disabled:opacity-50"
          >
            <X size={14} />
            Cancel
          </button>
        </div>

        {/* Encouragement */}
        <div className="text-xs text-slate-500 italic">
          Your corrections help the council improve future decisions
        </div>
      </div>
    );
  }

  // Modal mode (not compact) - future enhancement
  return null;
}

/**
 * Helper hook for using CorrectionFeedback with PM memory API
 */
export function useCorrectionFeedback() {
  const recordCorrection = async (
    entityType: string,
    entityId: string,
    attributeName: string,
    originalValue: any,
    correctedValue: any,
    reason: string,
    context?: Record<string, any>
  ) => {
    const response = await fetch('/api/pm/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'correction',
        correction_type: attributeName, // priority, status, assignment, etc.
        original_entity_type: entityType,
        original_entity_id: entityId,
        original_value: { [attributeName]: originalValue },
        corrected_value: { [attributeName]: correctedValue },
        context: context || {},
        reason,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to record correction');
    }

    return await response.json();
  };

  return { recordCorrection };
}
