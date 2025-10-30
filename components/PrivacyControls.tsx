'use client';

/**
 * Privacy Controls Component
 *
 * Provides UI controls for:
 * - Per-source data toggle switches (WHOOP, Limitless)
 * - One-click purge actions with confirmation
 * - PII redaction preview with click-to-reveal
 * - Real-time UI updates
 */

import { useState, useEffect } from 'react';
import { redactPII, revealSegment, revealAll, RedactionResult } from '@/lib/redact';

type DataSource = 'whoop' | 'limitless';

interface SourceStatus {
  enabled: boolean;
  recordCount: number;
  hasData: boolean;
  loading: boolean;
}

interface PurgeConfirmation {
  source: DataSource | null;
  showDialog: boolean;
}

export default function PrivacyControls() {
  const [whoopStatus, setWhoopStatus] = useState<SourceStatus>({
    enabled: true,
    recordCount: 0,
    hasData: false,
    loading: true,
  });

  const [limitlessStatus, setLimitlessStatus] = useState<SourceStatus>({
    enabled: true,
    recordCount: 0,
    hasData: false,
    loading: true,
  });

  const [purgeConfirm, setPurgeConfirm] = useState<PurgeConfirmation>({
    source: null,
    showDialog: false,
  });

  const [purging, setPurging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo data for PII redaction preview
  const [demoText] = useState(
    'Recovery data for john.doe@example.com: 85% recovery, HR 58 bpm. Contact at 555-123-4567.'
  );
  const [redactionResult, setRedactionResult] = useState<RedactionResult | null>(null);
  const [revealedSegments, setRevealedSegments] = useState<Set<number>>(new Set());

  // Initialize redaction on mount
  useEffect(() => {
    const result = redactPII(demoText);
    setRedactionResult(result);
  }, [demoText]);

  // Fetch status for both sources on mount
  useEffect(() => {
    fetchSourceStatus('whoop');
    fetchSourceStatus('limitless');
  }, []);

  const fetchSourceStatus = async (source: DataSource) => {
    try {
      const response = await fetch(`/api/privacy/purge?source=${source}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch status for ${source}`);
      }

      const data = await response.json();

      const statusUpdate: SourceStatus = {
        enabled: true, // Always enabled initially
        recordCount: data.recordCount,
        hasData: data.hasData,
        loading: false,
      };

      if (source === 'whoop') {
        setWhoopStatus(statusUpdate);
      } else {
        setLimitlessStatus(statusUpdate);
      }
    } catch (err) {
      console.error(`[Privacy] Failed to fetch ${source} status:`, err);

      // Update loading state even on error
      if (source === 'whoop') {
        setWhoopStatus(prev => ({ ...prev, loading: false }));
      } else {
        setLimitlessStatus(prev => ({ ...prev, loading: false }));
      }
    }
  };

  const handleToggleSource = (source: DataSource) => {
    if (source === 'whoop') {
      setWhoopStatus(prev => ({ ...prev, enabled: !prev.enabled }));
    } else {
      setLimitlessStatus(prev => ({ ...prev, enabled: !prev.enabled }));
    }
  };

  const handlePurgeRequest = (source: DataSource) => {
    setPurgeConfirm({ source, showDialog: true });
  };

  const handlePurgeConfirm = async () => {
    if (!purgeConfirm.source) return;

    setPurging(true);
    setError(null);

    try {
      const response = await fetch('/api/privacy/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: purgeConfirm.source }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Purge operation failed');
      }

      const result = await response.json();

      console.log(`[Privacy] Purged ${result.deletedRecords} ${result.source} records`);

      // Update UI state immediately
      if (purgeConfirm.source === 'whoop') {
        setWhoopStatus({
          enabled: true,
          recordCount: 0,
          hasData: false,
          loading: false,
        });
      } else {
        setLimitlessStatus({
          enabled: true,
          recordCount: 0,
          hasData: false,
          loading: false,
        });
      }

      // Close confirmation dialog
      setPurgeConfirm({ source: null, showDialog: false });

    } catch (err) {
      console.error('[Privacy] Purge failed:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setPurging(false);
    }
  };

  const handlePurgeCancel = () => {
    setPurgeConfirm({ source: null, showDialog: false });
  };

  const handleRevealSegment = (index: number) => {
    setRevealedSegments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleRevealAll = () => {
    if (!redactionResult) return;

    if (revealedSegments.size === redactionResult.segments.length) {
      // All revealed, hide all
      setRevealedSegments(new Set());
    } else {
      // Reveal all
      const allIndices = redactionResult.segments.map((_, i) => i);
      setRevealedSegments(new Set(allIndices));
    }
  };

  const getDisplayText = (): string => {
    if (!redactionResult) return demoText;

    let text = redactionResult.redactedText;

    // Reveal segments in reverse order to maintain correct indices
    const sortedRevealed = Array.from(revealedSegments).sort((a, b) => b - a);

    for (const index of sortedRevealed) {
      text = revealSegment(redactionResult, index);
    }

    return text;
  };

  return (
    <div className="privacy-controls" style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Privacy Controls</h2>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '12px',
          marginBottom: '20px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c00'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Data Source Toggles */}
      <div style={{ marginBottom: '30px' }}>
        <h3>Data Sources</h3>

        {/* WHOOP Toggle */}
        <div style={{
          padding: '16px',
          marginBottom: '12px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={whoopStatus.enabled}
                onChange={() => handleToggleSource('whoop')}
                disabled={whoopStatus.loading}
                style={{ marginRight: '12px', cursor: 'pointer' }}
              />
              <div>
                <strong>WHOOP Data</strong>
                <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                  {whoopStatus.loading ? 'Loading...' : `${whoopStatus.recordCount} records`}
                </div>
              </div>
            </label>
          </div>

          <button
            onClick={() => handlePurgeRequest('whoop')}
            disabled={!whoopStatus.hasData || whoopStatus.loading || purging}
            style={{
              padding: '8px 16px',
              backgroundColor: whoopStatus.hasData ? '#dc3545' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: whoopStatus.hasData ? 'pointer' : 'not-allowed',
              fontSize: '14px'
            }}
          >
            Purge WHOOP Data
          </button>
        </div>

        {/* Limitless Toggle */}
        <div style={{
          padding: '16px',
          marginBottom: '12px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={limitlessStatus.enabled}
                onChange={() => handleToggleSource('limitless')}
                disabled={limitlessStatus.loading}
                style={{ marginRight: '12px', cursor: 'pointer' }}
              />
              <div>
                <strong>Limitless Data</strong>
                <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                  {limitlessStatus.loading ? 'Loading...' : `${limitlessStatus.recordCount} records`}
                </div>
              </div>
            </label>
          </div>

          <button
            onClick={() => handlePurgeRequest('limitless')}
            disabled={!limitlessStatus.hasData || limitlessStatus.loading || purging}
            style={{
              padding: '8px 16px',
              backgroundColor: limitlessStatus.hasData ? '#dc3545' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: limitlessStatus.hasData ? 'pointer' : 'not-allowed',
              fontSize: '14px'
            }}
          >
            Purge Limitless Data
          </button>
        </div>
      </div>

      {/* PII Redaction Preview */}
      <div style={{ marginBottom: '30px' }}>
        <h3>PII Redaction Preview</h3>

        <div style={{
          padding: '16px',
          backgroundColor: '#f5f5f5',
          border: '1px solid #ddd',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '14px',
          lineHeight: '1.6'
        }}>
          {getDisplayText()}
        </div>

        {redactionResult && redactionResult.hasPII && (
          <div style={{ marginTop: '12px' }}>
            <button
              onClick={handleRevealAll}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                marginRight: '8px'
              }}
            >
              {revealedSegments.size === redactionResult.segments.length ? 'Hide All' : 'Reveal All'}
            </button>

            {redactionResult.segments.map((segment, index) => (
              <button
                key={index}
                onClick={() => handleRevealSegment(index)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: revealedSegments.has(index) ? '#28a745' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  marginRight: '8px',
                  marginBottom: '8px'
                }}
              >
                {revealedSegments.has(index) ? 'Hide' : 'Reveal'} {segment.type}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Purge Confirmation Dialog */}
      {purgeConfirm.showDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ marginTop: 0 }}>Confirm Data Purge</h3>

            <p>
              Are you sure you want to permanently delete all <strong>{purgeConfirm.source?.toUpperCase()}</strong> data?
            </p>

            <p style={{ color: '#c00', fontSize: '14px' }}>
              <strong>Warning:</strong> This action cannot be undone. All records will be permanently removed.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={handlePurgeCancel}
                disabled={purging}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: purging ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>

              <button
                onClick={handlePurgeConfirm}
                disabled={purging}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: purging ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                {purging ? 'Purging...' : 'Confirm Purge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
