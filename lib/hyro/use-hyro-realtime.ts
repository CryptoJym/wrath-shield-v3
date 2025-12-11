/**
 * HYRO FORGE: Real-time React Hook
 * Hook for real-time learner state updates via SSE
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSSEClient, SSEEventType } from './forge-sse-client';
import type { AttractorType } from './forge-types';

// ============================================================================
// Types
// ============================================================================

interface CEGState {
  coherence: number;
  entropy: number;
  generativity: number;
}

interface PMREPromptEvent {
  dimension: 'planning' | 'monitoring' | 'regulation' | 'evaluation';
  text: string;
  priority: 'low' | 'medium' | 'high';
}

interface UseHyroRealtimeOptions {
  autoConnect?: boolean;
  debug?: boolean;
}

interface UseHyroRealtimeReturn {
  // State
  state: CEGState | null;
  attractor: AttractorType | null;
  lastPrompt: PMREPromptEvent | null;

  // Connection status
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnectAttempts: number;

  // Actions
  connect: () => void;
  disconnect: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useHyroRealtime(
  learnerId: string | null,
  options: UseHyroRealtimeOptions = {}
): UseHyroRealtimeReturn {
  const { autoConnect = true, debug = false } = options;

  // State
  const [state, setState] = useState<CEGState | null>(null);
  const [attractor, setAttractor] = useState<AttractorType | null>(null);
  const [lastPrompt, setLastPrompt] = useState<PMREPromptEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Refs to track subscriptions
  const unsubscribesRef = useRef<Array<() => void>>([]);
  const connectedLearnerRef = useRef<string | null>(null);

  // Debug logger
  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log('[useHyroRealtime]', ...args);
      }
    },
    [debug]
  );

  // Connect function
  const connect = useCallback(() => {
    if (!learnerId) {
      log('No learnerId provided');
      return;
    }

    const client = getSSEClient({ debug });

    // Already connected to this learner
    if (connectedLearnerRef.current === learnerId && client.isConnected) {
      log('Already connected to', learnerId);
      return;
    }

    // Disconnect if connected to different learner
    if (connectedLearnerRef.current && connectedLearnerRef.current !== learnerId) {
      log('Switching learner from', connectedLearnerRef.current, 'to', learnerId);
      client.disconnect();
    }

    // Clear old subscriptions
    unsubscribesRef.current.forEach((unsub) => unsub());
    unsubscribesRef.current = [];

    // Subscribe to events
    const events: Array<{
      type: SSEEventType;
      handler: (data: unknown) => void;
    }> = [
      {
        type: 'connected',
        handler: () => {
          log('Connected');
          setIsConnected(true);
          setIsConnecting(false);
          setError(null);
        },
      },
      {
        type: 'state.updated',
        handler: (data: unknown) => {
          const event = data as { state?: CEGState };
          if (event.state) {
            log('State updated:', event.state);
            setState(event.state);
          }
        },
      },
      {
        type: 'attractor.changed',
        handler: (data: unknown) => {
          const event = data as { attractor?: AttractorType };
          if (event.attractor) {
            log('Attractor changed:', event.attractor);
            setAttractor(event.attractor);
          }
        },
      },
      {
        type: 'pmre.triggered',
        handler: (data: unknown) => {
          const event = data as PMREPromptEvent;
          log('PMRE triggered:', event);
          setLastPrompt(event);
        },
      },
      {
        type: 'error',
        handler: (data: unknown) => {
          const event = data as { message?: string };
          log('Error:', event.message);
          setError(event.message || 'Unknown error');
          setIsConnected(false);
          setIsConnecting(false);
        },
      },
      {
        type: 'heartbeat',
        handler: () => {
          // Update reconnect attempts from client status
          const status = client.getStatus();
          setReconnectAttempts(status.reconnectAttempts);
        },
      },
    ];

    for (const { type, handler } of events) {
      const unsub = client.on(type, handler);
      unsubscribesRef.current.push(unsub);
    }

    // Connect
    setIsConnecting(true);
    connectedLearnerRef.current = learnerId;
    client.connect(learnerId);
  }, [learnerId, debug, log]);

  // Disconnect function
  const disconnect = useCallback(() => {
    const client = getSSEClient();
    client.disconnect();

    // Clear subscriptions
    unsubscribesRef.current.forEach((unsub) => unsub());
    unsubscribesRef.current = [];

    // Reset state
    setIsConnected(false);
    setIsConnecting(false);
    setError(null);
    setReconnectAttempts(0);
    connectedLearnerRef.current = null;

    log('Disconnected');
  }, [log]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && learnerId) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [autoConnect, learnerId, connect, disconnect]);

  return {
    // State
    state,
    attractor,
    lastPrompt,

    // Connection status
    isConnected,
    isConnecting,
    error,
    reconnectAttempts,

    // Actions
    connect,
    disconnect,
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook that only subscribes to C/E/G state updates
 */
export function useHyroCEGState(learnerId: string | null): CEGState | null {
  const { state } = useHyroRealtime(learnerId);
  return state;
}

/**
 * Hook that only subscribes to attractor state
 */
export function useHyroAttractor(learnerId: string | null): AttractorType | null {
  const { attractor } = useHyroRealtime(learnerId);
  return attractor;
}

/**
 * Hook for connection status only
 */
export function useHyroConnectionStatus(learnerId: string | null): {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
} {
  const { isConnected, isConnecting, error } = useHyroRealtime(learnerId, {
    autoConnect: true,
  });

  return { isConnected, isConnecting, error };
}
