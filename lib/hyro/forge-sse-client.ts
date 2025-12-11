/**
 * HYRO FORGE: Browser SSE Client
 * Client-side SSE connection with auto-reconnect
 */

'use client';

// ============================================================================
// Types
// ============================================================================

export type SSEEventType =
  | 'connected'
  | 'heartbeat'
  | 'state.updated'
  | 'attractor.changed'
  | 'pmre.triggered'
  | 'error';

export type SSEEventHandler = (data: unknown) => void;

interface SSEClientConfig {
  baseUrl?: string;
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  debug?: boolean;
}

// ============================================================================
// SSE Client
// ============================================================================

class HyroSSEClient {
  private eventSource: EventSource | null = null;
  private handlers: Map<SSEEventType, Set<SSEEventHandler>> = new Map();
  private reconnectAttempts: number = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private learnerId: string | null = null;
  private config: Required<SSEClientConfig>;

  public isConnected: boolean = false;
  public isConnecting: boolean = false;
  public lastError: string | null = null;
  public connectionId: string | null = null;

  constructor(config: SSEClientConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || '/api/hyro/sse',
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      initialReconnectDelay: config.initialReconnectDelay ?? 1000,
      maxReconnectDelay: config.maxReconnectDelay ?? 30000,
      debug: config.debug ?? false,
    };
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[HyroSSE]', ...args);
    }
  }

  connect(learnerId: string): void {
    if (this.isConnected || this.isConnecting) {
      this.log('Already connected or connecting');
      return;
    }

    this.learnerId = learnerId;
    this.isConnecting = true;
    this.lastError = null;

    const url = `${this.config.baseUrl}?learnerId=${encodeURIComponent(learnerId)}`;
    this.log('Connecting to:', url);

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.log('Connection opened');
        this.isConnecting = false;
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };

      this.eventSource.onerror = (event) => {
        this.log('Connection error:', event);
        this.handleError('Connection error');
      };

      // Listen for specific event types
      this.setupEventListeners();
    } catch (error) {
      this.handleError(`Failed to connect: ${error}`);
    }
  }

  private setupEventListeners(): void {
    if (!this.eventSource) return;

    const eventTypes: SSEEventType[] = [
      'connected',
      'heartbeat',
      'state.updated',
      'attractor.changed',
      'pmre.triggered',
    ];

    for (const eventType of eventTypes) {
      this.eventSource.addEventListener(eventType, (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          this.log(`Received ${eventType}:`, data);

          // Store connection ID
          if (eventType === 'connected' && data.connectionId) {
            this.connectionId = data.connectionId;
          }

          this.emit(eventType, data);
        } catch (error) {
          this.log(`Error parsing ${eventType} data:`, error);
        }
      });
    }
  }

  private handleError(message: string): void {
    this.lastError = message;
    this.isConnected = false;
    this.isConnecting = false;

    this.emit('error', { message });

    // Close existing connection
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    // Attempt reconnect
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.log('Max reconnect attempts reached');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Exponential backoff
    const delay = Math.min(
      this.config.initialReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.config.maxReconnectDelay
    );

    this.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      if (this.learnerId) {
        this.connect(this.learnerId);
      }
    }, delay);
  }

  disconnect(): void {
    this.log('Disconnecting');

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.connectionId = null;
    this.reconnectAttempts = 0;
  }

  on(eventType: SSEEventType, handler: SSEEventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.off(eventType, handler);
    };
  }

  off(eventType: SSEEventType, handler: SSEEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(eventType: SSEEventType, data: unknown): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          this.log(`Handler error for ${eventType}:`, error);
        }
      });
    }
  }

  getStatus(): {
    isConnected: boolean;
    isConnecting: boolean;
    reconnectAttempts: number;
    lastError: string | null;
    connectionId: string | null;
  } {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      lastError: this.lastError,
      connectionId: this.connectionId,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let clientInstance: HyroSSEClient | null = null;

export function getSSEClient(config?: SSEClientConfig): HyroSSEClient {
  if (!clientInstance) {
    clientInstance = new HyroSSEClient(config);
  }
  return clientInstance;
}

export function createSSEClient(config?: SSEClientConfig): HyroSSEClient {
  return new HyroSSEClient(config);
}

export { HyroSSEClient };
