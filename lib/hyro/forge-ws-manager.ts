/**
 * HYRO FORGE: SSE Connection Manager
 * Server-side manager for SSE connections per learner
 */

import { ensureServerOnly } from '../server-only-guard';
import { getEventBus } from './forge-event-bus';
import { REDIS_CHANNELS } from './forge-event-schemas';

ensureServerOnly('forge-ws-manager');

// ============================================================================
// Types
// ============================================================================

interface SSEConnection {
  id: string;
  learnerId: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  connectedAt: Date;
  lastActivity: Date;
}

interface SSEMessage {
  event: string;
  data: unknown;
  id?: string;
}

// ============================================================================
// SSE Connection Manager
// ============================================================================

class SSEConnectionManager {
  private connections: Map<string, SSEConnection> = new Map();
  private learnerConnections: Map<string, Set<string>> = new Map();
  private encoder: TextEncoder = new TextEncoder();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private eventBusUnsubscribes: Array<() => void> = [];

  constructor() {
    this.startHeartbeat();
    this.subscribeToEventBus();
    console.log('[SSEManager] Initialized');
  }

  private startHeartbeat(): void {
    // Send heartbeat every 30 seconds to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      this.broadcast({ event: 'heartbeat', data: { timestamp: Date.now() } });
      this.cleanupStaleConnections();
    }, 30000);
  }

  private subscribeToEventBus(): void {
    const eventBus = getEventBus();

    // Subscribe to state updates
    const unsubState = eventBus.subscribe(
      REDIS_CHANNELS.STATE_UPDATED,
      (event) => {
        const { learnerId } = event as { learnerId: string };
        this.broadcastToLearner(learnerId, {
          event: 'state.updated',
          data: event,
        });
      }
    );
    this.eventBusUnsubscribes.push(unsubState);

    // Subscribe to attractor changes
    const unsubAttractor = eventBus.subscribe(
      REDIS_CHANNELS.ATTRACTOR_CHANGED,
      (event) => {
        const { learnerId } = event as { learnerId: string };
        this.broadcastToLearner(learnerId, {
          event: 'attractor.changed',
          data: event,
        });
      }
    );
    this.eventBusUnsubscribes.push(unsubAttractor);

    // Subscribe to PMRE triggers
    const unsubPMRE = eventBus.subscribe(
      REDIS_CHANNELS.PMRE_TRIGGERED,
      (event) => {
        const { learnerId } = event as { learnerId: string };
        this.broadcastToLearner(learnerId, {
          event: 'pmre.triggered',
          data: event,
        });
      }
    );
    this.eventBusUnsubscribes.push(unsubPMRE);

    console.log('[SSEManager] Subscribed to event bus channels');
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [connId, conn] of this.connections) {
      if (now - conn.lastActivity.getTime() > staleThreshold) {
        console.log(`[SSEManager] Removing stale connection: ${connId}`);
        this.removeConnection(connId);
      }
    }
  }

  addConnection(
    learnerId: string,
    controller: ReadableStreamDefaultController<Uint8Array>
  ): string {
    const connId = `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const connection: SSEConnection = {
      id: connId,
      learnerId,
      controller,
      connectedAt: new Date(),
      lastActivity: new Date(),
    };

    this.connections.set(connId, connection);

    // Track by learner
    if (!this.learnerConnections.has(learnerId)) {
      this.learnerConnections.set(learnerId, new Set());
    }
    this.learnerConnections.get(learnerId)!.add(connId);

    console.log(
      `[SSEManager] Connection added: ${connId} for learner ${learnerId}`
    );

    // Send initial connected message
    this.sendToConnection(connId, {
      event: 'connected',
      data: { connectionId: connId, learnerId },
    });

    return connId;
  }

  removeConnection(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    // Remove from learner tracking
    const learnerConns = this.learnerConnections.get(conn.learnerId);
    if (learnerConns) {
      learnerConns.delete(connectionId);
      if (learnerConns.size === 0) {
        this.learnerConnections.delete(conn.learnerId);
      }
    }

    // Close the controller if possible
    try {
      conn.controller.close();
    } catch {
      // Already closed
    }

    this.connections.delete(connectionId);
    console.log(`[SSEManager] Connection removed: ${connectionId}`);
  }

  private formatSSEMessage(message: SSEMessage): string {
    let output = '';

    if (message.event) {
      output += `event: ${message.event}\n`;
    }

    if (message.id) {
      output += `id: ${message.id}\n`;
    }

    const dataStr =
      typeof message.data === 'string'
        ? message.data
        : JSON.stringify(message.data);
    output += `data: ${dataStr}\n\n`;

    return output;
  }

  private sendToConnection(connectionId: string, message: SSEMessage): boolean {
    const conn = this.connections.get(connectionId);
    if (!conn) return false;

    try {
      const formatted = this.formatSSEMessage(message);
      conn.controller.enqueue(this.encoder.encode(formatted));
      conn.lastActivity = new Date();
      return true;
    } catch (error) {
      console.error(`[SSEManager] Error sending to ${connectionId}:`, error);
      this.removeConnection(connectionId);
      return false;
    }
  }

  broadcastToLearner(learnerId: string, message: SSEMessage): number {
    const connIds = this.learnerConnections.get(learnerId);
    if (!connIds || connIds.size === 0) return 0;

    let sent = 0;
    for (const connId of connIds) {
      if (this.sendToConnection(connId, message)) {
        sent++;
      }
    }

    return sent;
  }

  broadcast(message: SSEMessage): number {
    let sent = 0;
    for (const connId of this.connections.keys()) {
      if (this.sendToConnection(connId, message)) {
        sent++;
      }
    }
    return sent;
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getLearnerConnectionCount(learnerId: string): number {
    return this.learnerConnections.get(learnerId)?.size || 0;
  }

  getStats(): {
    totalConnections: number;
    uniqueLearners: number;
    connectionsByLearner: Record<string, number>;
  } {
    const connectionsByLearner: Record<string, number> = {};

    for (const [learnerId, conns] of this.learnerConnections) {
      connectionsByLearner[learnerId] = conns.size;
    }

    return {
      totalConnections: this.connections.size,
      uniqueLearners: this.learnerConnections.size,
      connectionsByLearner,
    };
  }

  shutdown(): void {
    console.log('[SSEManager] Shutting down...');

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Unsubscribe from event bus
    for (const unsub of this.eventBusUnsubscribes) {
      unsub();
    }

    // Close all connections
    for (const connId of this.connections.keys()) {
      this.removeConnection(connId);
    }

    console.log('[SSEManager] Shutdown complete');
  }
}

// ============================================================================
// Singleton
// ============================================================================

let managerInstance: SSEConnectionManager | null = null;

export function getSSEManager(): SSEConnectionManager {
  if (!managerInstance) {
    managerInstance = new SSEConnectionManager();
  }
  return managerInstance;
}

export { SSEConnectionManager };
