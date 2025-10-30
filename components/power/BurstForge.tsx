/**
 * Wrath Shield v3 - BurstForge Modal Component
 *
 * 90-second confidence rewrite feature for manipulative phrases.
 * Allows users to flag manipulative text, create assured rewrites,
 * and track UIX score improvements.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import type { Flag } from '@/lib/db/types';

export interface BurstForgeProps {
  /**
   * Whether the modal is currently open
   */
  isOpen: boolean;

  /**
   * Callback to close the modal
   */
  onClose: () => void;

  /**
   * The flag to display and act upon
   * If null, the modal will not render (defensive check)
   */
  flag: Flag | null;

  /**
   * Callback when a tweak is successfully submitted
   * Receives the flag ID and action type
   */
  onTweakSubmitted?: (flagId: string, actionType: 'rewrite' | 'dismiss' | 'escalate') => void;
}

/**
 * BurstForge Modal Component
 *
 * Displays manipulation flags and provides UI for creating confidence rewrites.
 * Implements accessibility features:
 * - Focus trap within modal
 * - Escape key to close
 * - ARIA labels and roles
 * - Keyboard navigation
 */
export default function BurstForge({ isOpen, onClose, flag, onTweakSubmitted }: BurstForgeProps) {
  const [assuredText, setAssuredText] = useState('');
  const [actionType, setActionType] = useState<'rewrite' | 'dismiss' | 'escalate'>('rewrite');
  const [userNotes, setUserNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalUIX, setTotalUIX] = useState<number | null>(null);
  const [deltaUIX, setDeltaUIX] = useState<number | null>(null);
  const [isLoadingUIX, setIsLoadingUIX] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Fetch UIX score when modal opens
  useEffect(() => {
    const fetchUIXScore = async () => {
      if (!isOpen) return;

      setIsLoadingUIX(true);
      try {
        const response = await fetch('/api/uix');
        if (response.ok) {
          const data = await response.json();
          setTotalUIX(data.total_uix);
        }
      } catch (err) {
        console.error('Failed to fetch UIX score:', err);
      } finally {
        setIsLoadingUIX(false);
      }
    };

    fetchUIXScore();
  }, [isOpen]);

  // Reset form when modal opens with new flag
  useEffect(() => {
    if (isOpen && flag) {
      setAssuredText('');
      setActionType('rewrite');
      setUserNotes('');
      setError(null);
      setDeltaUIX(null);
    }
  }, [isOpen, flag]);

  // Focus trap: Focus close button when modal opens
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard event handler for Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!flag) {
      setError('No flag selected');
      return;
    }

    // Validation: assured_text required for rewrite action
    if (actionType === 'rewrite' && !assuredText.trim()) {
      setError('Assured text is required for rewrite action');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/tweak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flag_id: flag.id,
          assured_text: assuredText.trim() || null,
          action_type: actionType,
          context: flag.original_text, // Context is the original flagged text
          user_notes: userNotes.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to submit tweak' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Extract delta_uix from response
      const responseData = await response.json();
      const deltaFromSubmission = responseData.delta_uix || 0;
      setDeltaUIX(deltaFromSubmission);

      // Refresh total UIX score
      const uixResponse = await fetch('/api/uix');
      if (uixResponse.ok) {
        const uixData = await uixResponse.json();
        setTotalUIX(uixData.total_uix);
      }

      // Success! Call the callback and close modal
      if (onTweakSubmitted) {
        onTweakSubmitted(flag.id, actionType);
      }

      // Keep modal open briefly to show success feedback
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't render if not open or no flag
  if (!isOpen || !flag) {
    return null;
  }

  // Format detected_at timestamp to readable date
  const detectedDate = new Date(flag.detected_at * 1000).toLocaleString();

  return (
    <div
      className="burst-forge-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="burst-forge-title"
      onClick={(e) => {
        // Close modal when clicking on overlay (not modal content)
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="burst-forge-modal" ref={modalRef}>
        {/* Header */}
        <div className="burst-forge-header">
          <h2 id="burst-forge-title">BurstForge: 90-Second Confidence Rewrite</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close modal"
            className="burst-forge-close"
            type="button"
          >
            ×
          </button>
        </div>

        {/* Flag Details */}
        <div className="burst-forge-section">
          <h3>Flagged Phrase</h3>
          <div className="burst-forge-flag-details">
            <p className="burst-forge-original-text">&ldquo;{flag.original_text}&rdquo;</p>
            <div className="burst-forge-metadata">
              <span className="burst-forge-meta-item">
                <strong>Detected:</strong> {detectedDate}
              </span>
              <span className="burst-forge-meta-item">
                <strong>Severity:</strong> {flag.severity}/5
              </span>
              {flag.manipulation_type && (
                <span className="burst-forge-meta-item">
                  <strong>Type:</strong> {flag.manipulation_type}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* UIX Score Display */}
        <div className="burst-forge-section">
          <h3>UIX Score</h3>
          <div className="burst-forge-uix-display">
            {isLoadingUIX ? (
              <div className="burst-forge-uix-loading">Loading score...</div>
            ) : (
              <div className="burst-forge-uix-current">
                <span className="burst-forge-uix-value">{totalUIX ?? 0}</span>
                <span className="burst-forge-uix-label">points</span>
              </div>
            )}
          </div>
        </div>

        {/* Success Feedback (shown after successful submission) */}
        {deltaUIX !== null && (
          <div className="burst-forge-success" role="status" aria-live="polite">
            <div className="burst-forge-success-icon">✓</div>
            <div className="burst-forge-success-content">
              <div className="burst-forge-success-title">Confidence rewrite submitted!</div>
              <div className="burst-forge-success-improvement">
                UIX Score: <strong>+{deltaUIX} points</strong>
              </div>
              {totalUIX !== null && (
                <div className="burst-forge-success-total">
                  New Total: <strong>{totalUIX} points</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="burst-forge-form">
          {/* Action Type Selection */}
          <div className="burst-forge-section">
            <label htmlFor="action-type">
              <strong>Action:</strong>
            </label>
            <select
              id="action-type"
              value={actionType}
              onChange={(e) => setActionType(e.target.value as 'rewrite' | 'dismiss' | 'escalate')}
              className="burst-forge-select"
              disabled={isSubmitting}
            >
              <option value="rewrite">Rewrite with confidence</option>
              <option value="dismiss">Dismiss as false positive</option>
              <option value="escalate">Escalate for review</option>
            </select>
          </div>

          {/* Assured Text Input (only for rewrite action) */}
          {actionType === 'rewrite' && (
            <div className="burst-forge-section">
              <label htmlFor="assured-text">
                <strong>Assured Text:</strong>
                <span className="burst-forge-hint">Your confident, assertive response</span>
              </label>
              <textarea
                id="assured-text"
                value={assuredText}
                onChange={(e) => setAssuredText(e.target.value)}
                placeholder="Enter your confident rewrite here..."
                className="burst-forge-textarea"
                rows={4}
                disabled={isSubmitting}
                aria-required="true"
              />
            </div>
          )}

          {/* User Notes (optional) */}
          <div className="burst-forge-section">
            <label htmlFor="user-notes">
              <strong>Notes (optional):</strong>
            </label>
            <textarea
              id="user-notes"
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="Add context or reflections..."
              className="burst-forge-textarea"
              rows={2}
              disabled={isSubmitting}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="burst-forge-error" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          {/* Form Actions */}
          <div className="burst-forge-actions">
            <button
              type="button"
              onClick={onClose}
              className="burst-forge-button burst-forge-button-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="burst-forge-button burst-forge-button-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        /* Overlay (fullscreen backdrop) */
        .burst-forge-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1rem;
        }

        /* Modal container */
        .burst-forge-modal {
          background: #1a1a1a;
          color: #e0e0e0;
          border-radius: 12px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }

        /* Header */
        .burst-forge-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #333;
        }

        .burst-forge-header h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #f5f5f5;
        }

        .burst-forge-close {
          background: none;
          border: none;
          color: #888;
          font-size: 2rem;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          width: 2rem;
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .burst-forge-close:hover {
          background: #333;
          color: #f5f5f5;
        }

        .burst-forge-close:focus {
          outline: 2px solid #4a9eff;
          outline-offset: 2px;
        }

        /* Sections */
        .burst-forge-section {
          padding: 1.5rem;
          border-bottom: 1px solid #2a2a2a;
        }

        .burst-forge-section:last-child {
          border-bottom: none;
        }

        .burst-forge-section h3 {
          margin: 0 0 1rem 0;
          font-size: 1rem;
          font-weight: 500;
          color: #f5f5f5;
        }

        /* Flag details */
        .burst-forge-flag-details {
          background: #0d0d0d;
          padding: 1rem;
          border-radius: 8px;
          border-left: 4px solid #ff6b6b;
        }

        .burst-forge-original-text {
          margin: 0 0 0.75rem 0;
          font-style: italic;
          color: #f5f5f5;
          line-height: 1.5;
        }

        .burst-forge-metadata {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          font-size: 0.875rem;
          color: #999;
        }

        .burst-forge-meta-item strong {
          color: #ccc;
        }

        /* Form elements */
        .burst-forge-form label {
          display: block;
          margin-bottom: 0.5rem;
          color: #ccc;
        }

        .burst-forge-hint {
          display: block;
          font-size: 0.875rem;
          color: #888;
          font-weight: normal;
          margin-top: 0.25rem;
        }

        .burst-forge-select,
        .burst-forge-textarea {
          width: 100%;
          padding: 0.75rem;
          background: #0d0d0d;
          border: 1px solid #333;
          border-radius: 6px;
          color: #e0e0e0;
          font-family: inherit;
          font-size: 1rem;
          transition: border-color 0.2s;
        }

        .burst-forge-select:focus,
        .burst-forge-textarea:focus {
          outline: none;
          border-color: #4a9eff;
        }

        .burst-forge-select:disabled,
        .burst-forge-textarea:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .burst-forge-textarea {
          resize: vertical;
          min-height: 80px;
        }

        /* Error */
        .burst-forge-error {
          background: #2d1414;
          border: 1px solid #ff6b6b;
          border-radius: 6px;
          padding: 0.75rem 1rem;
          color: #ff9999;
          font-size: 0.875rem;
          margin: 1rem 1.5rem 0;
        }

        /* UIX Score Display */
        .burst-forge-uix-display {
          background: #0d0d0d;
          padding: 1rem;
          border-radius: 8px;
          border-left: 4px solid #4a9eff;
        }

        .burst-forge-uix-loading {
          color: #888;
          font-size: 0.875rem;
          font-style: italic;
        }

        .burst-forge-uix-current {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
        }

        .burst-forge-uix-value {
          font-size: 2rem;
          font-weight: 700;
          color: #4a9eff;
          line-height: 1;
        }

        .burst-forge-uix-label {
          font-size: 0.875rem;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Success Feedback */
        .burst-forge-success {
          background: linear-gradient(135deg, #1a3a1a 0%, #0d2d0d 100%);
          border: 1px solid #4caf50;
          border-radius: 8px;
          padding: 1.5rem;
          margin: 0 1.5rem;
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .burst-forge-success-icon {
          background: #4caf50;
          color: #fff;
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          font-weight: bold;
          flex-shrink: 0;
        }

        .burst-forge-success-content {
          flex: 1;
        }

        .burst-forge-success-title {
          color: #4caf50;
          font-weight: 600;
          font-size: 1rem;
          margin-bottom: 0.5rem;
        }

        .burst-forge-success-improvement {
          color: #e0e0e0;
          font-size: 0.875rem;
          margin-bottom: 0.25rem;
        }

        .burst-forge-success-improvement strong {
          color: #4caf50;
          font-size: 1rem;
        }

        .burst-forge-success-total {
          color: #999;
          font-size: 0.875rem;
        }

        .burst-forge-success-total strong {
          color: #4a9eff;
        }

        /* Actions */
        .burst-forge-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
          padding: 1.5rem;
        }

        .burst-forge-button {
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          font-family: inherit;
        }

        .burst-forge-button:focus {
          outline: 2px solid #4a9eff;
          outline-offset: 2px;
        }

        .burst-forge-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .burst-forge-button-secondary {
          background: #2a2a2a;
          color: #e0e0e0;
        }

        .burst-forge-button-secondary:hover:not(:disabled) {
          background: #333;
        }

        .burst-forge-button-primary {
          background: #4a9eff;
          color: #fff;
        }

        .burst-forge-button-primary:hover:not(:disabled) {
          background: #3a8eef;
        }

        /* Responsive */
        @media (max-width: 640px) {
          .burst-forge-modal {
            max-height: 100vh;
            border-radius: 0;
          }

          .burst-forge-overlay {
            padding: 0;
          }

          .burst-forge-actions {
            flex-direction: column-reverse;
          }

          .burst-forge-button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
