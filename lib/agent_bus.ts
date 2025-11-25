/**
 * Agent Bus
 *
 * Central message bus for inter-agent communication with adaptive triggers.
 * Messages are emitted only when confidence < 0.8 or impact is high.
 *
 * JSON-based storage for lightweight persistence.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import crypto from 'crypto';

// ============================================================================
// Types & Schema
// ============================================================================

export type AgentId =
  | 'pm-agent'
  | 'legal-agent'
  | 'finance-agent'
  | 'comms-agent'
  | 'health-agent'
  | 'orchestrator'
  | 'user';

export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

export type MessageCategory =
  | 'task'
  | 'alert'
  | 'request'
  | 'response'
  | 'status'
  | 'decision'
  | 'escalation';

export interface AgentMessage {
  id: string;
  timestamp: number; // Unix seconds
  from: AgentId;
  to: AgentId | AgentId[] | 'broadcast';
  category: MessageCategory;
  priority: MessagePriority;
  subject: string;
  body: string;
  confidence: number; // 0-1, triggers emit if < 0.8
  impact: 'low' | 'medium' | 'high'; // High impact always emits
  context?: {
    project?: string;
    domain?: string;
    entity_id?: string;
    entity_type?: string;
    action_required?: boolean;
    deadline?: number; // Unix seconds
  };
  metadata?: Record<string, unknown>;
  read: boolean;
  acknowledged: boolean;
  response_to?: string; // ID of message this responds to
}

export interface AgentBusStore {
  version: string;
  updated_at: number;
  messages: AgentMessage[];
  stats: {
    total_messages: number;
    unread_count: number;
    by_agent: Record<AgentId, number>;
    by_category: Record<MessageCategory, number>;
  };
}

// ============================================================================
// Storage
// ============================================================================

const BUS_STORE_PATH = resolve(process.cwd(), '.data', 'agent-bus.json');
const MAX_MESSAGES = 500; // Keep last N messages

function ensureDir(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Load agent bus store from disk
 */
export function loadBusStore(): AgentBusStore {
  if (!existsSync(BUS_STORE_PATH)) {
    return createEmptyStore();
  }
  try {
    const raw = readFileSync(BUS_STORE_PATH, 'utf-8');
    return JSON.parse(raw) as AgentBusStore;
  } catch {
    return createEmptyStore();
  }
}

/**
 * Save agent bus store to disk
 */
export function saveBusStore(store: AgentBusStore): void {
  ensureDir(BUS_STORE_PATH);
  store.updated_at = Math.floor(Date.now() / 1000);
  updateStats(store);
  writeFileSync(BUS_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function createEmptyStore(): AgentBusStore {
  return {
    version: '1.0',
    updated_at: Math.floor(Date.now() / 1000),
    messages: [],
    stats: {
      total_messages: 0,
      unread_count: 0,
      by_agent: {} as Record<AgentId, number>,
      by_category: {} as Record<MessageCategory, number>,
    },
  };
}

function updateStats(store: AgentBusStore): void {
  store.stats.total_messages = store.messages.length;
  store.stats.unread_count = store.messages.filter((m) => !m.read).length;

  // Reset counts
  store.stats.by_agent = {} as Record<AgentId, number>;
  store.stats.by_category = {} as Record<MessageCategory, number>;

  for (const msg of store.messages) {
    store.stats.by_agent[msg.from] = (store.stats.by_agent[msg.from] || 0) + 1;
    store.stats.by_category[msg.category] = (store.stats.by_category[msg.category] || 0) + 1;
  }
}

// ============================================================================
// Adaptive Triggers
// ============================================================================

/**
 * Determine if a message should be emitted based on adaptive rules
 *
 * Rules:
 * - Always emit if confidence < 0.8
 * - Always emit if impact is 'high'
 * - Always emit if priority is 'critical'
 * - Always emit if category is 'escalation' or 'decision'
 * - Otherwise, suppress (return false)
 */
export function shouldEmit(msg: Partial<AgentMessage>): boolean {
  // Low confidence = needs attention
  if ((msg.confidence ?? 1) < 0.8) return true;

  // High impact = always emit
  if (msg.impact === 'high') return true;

  // Critical priority = always emit
  if (msg.priority === 'critical') return true;

  // Escalations and decisions always emit
  if (msg.category === 'escalation' || msg.category === 'decision') return true;

  // Action required = emit
  if (msg.context?.action_required) return true;

  // Default: suppress low-priority, high-confidence messages
  return false;
}

/**
 * Calculate priority based on confidence and impact
 */
export function calculatePriority(confidence: number, impact: 'low' | 'medium' | 'high'): MessagePriority {
  if (impact === 'high' && confidence < 0.5) return 'critical';
  if (impact === 'high' || confidence < 0.6) return 'high';
  if (impact === 'medium' || confidence < 0.8) return 'normal';
  return 'low';
}

// ============================================================================
// Message Helpers
// ============================================================================

/**
 * Generate unique message ID
 */
export function generateMessageId(): string {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Create a new message (does not emit)
 */
export function createMessage(params: {
  from: AgentId;
  to: AgentId | AgentId[] | 'broadcast';
  category: MessageCategory;
  subject: string;
  body: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  context?: AgentMessage['context'];
  metadata?: Record<string, unknown>;
  response_to?: string;
}): AgentMessage {
  const priority = calculatePriority(params.confidence, params.impact);

  return {
    id: generateMessageId(),
    timestamp: Math.floor(Date.now() / 1000),
    from: params.from,
    to: params.to,
    category: params.category,
    priority,
    subject: params.subject,
    body: params.body,
    confidence: params.confidence,
    impact: params.impact,
    context: params.context,
    metadata: params.metadata,
    read: false,
    acknowledged: false,
    response_to: params.response_to,
  };
}

/**
 * Emit a message to the bus (with adaptive filtering)
 * Returns the message if emitted, null if suppressed
 */
export function emit(msg: AgentMessage, force = false): AgentMessage | null {
  if (!force && !shouldEmit(msg)) {
    return null; // Suppressed
  }

  const store = loadBusStore();

  // Add message
  store.messages.unshift(msg); // Newest first

  // Trim to max size
  if (store.messages.length > MAX_MESSAGES) {
    store.messages = store.messages.slice(0, MAX_MESSAGES);
  }

  saveBusStore(store);
  return msg;
}

/**
 * Quick emit helper - creates and emits in one call
 */
export function emitMessage(params: Parameters<typeof createMessage>[0], force = false): AgentMessage | null {
  const msg = createMessage(params);
  return emit(msg, force);
}

/**
 * Mark message as read
 */
export function markRead(messageId: string): boolean {
  const store = loadBusStore();
  const msg = store.messages.find((m) => m.id === messageId);
  if (msg) {
    msg.read = true;
    saveBusStore(store);
    return true;
  }
  return false;
}

/**
 * Mark message as acknowledged
 */
export function acknowledge(messageId: string): boolean {
  const store = loadBusStore();
  const msg = store.messages.find((m) => m.id === messageId);
  if (msg) {
    msg.acknowledged = true;
    msg.read = true;
    saveBusStore(store);
    return true;
  }
  return false;
}

/**
 * Mark all messages as read
 */
export function markAllRead(): number {
  const store = loadBusStore();
  let count = 0;
  for (const msg of store.messages) {
    if (!msg.read) {
      msg.read = true;
      count++;
    }
  }
  saveBusStore(store);
  return count;
}

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Get messages for a specific agent
 */
export function getMessagesFor(agentId: AgentId, options?: { unreadOnly?: boolean; limit?: number }): AgentMessage[] {
  const store = loadBusStore();
  let messages = store.messages.filter(
    (m) => m.to === agentId || m.to === 'broadcast' || (Array.isArray(m.to) && m.to.includes(agentId))
  );

  if (options?.unreadOnly) {
    messages = messages.filter((m) => !m.read);
  }

  if (options?.limit) {
    messages = messages.slice(0, options.limit);
  }

  return messages;
}

/**
 * Get messages from a specific agent
 */
export function getMessagesFrom(agentId: AgentId, options?: { limit?: number }): AgentMessage[] {
  const store = loadBusStore();
  let messages = store.messages.filter((m) => m.from === agentId);

  if (options?.limit) {
    messages = messages.slice(0, options.limit);
  }

  return messages;
}

/**
 * Get all messages (newest first)
 */
export function getAllMessages(options?: { limit?: number; category?: MessageCategory; priority?: MessagePriority }): AgentMessage[] {
  const store = loadBusStore();
  let messages = store.messages;

  if (options?.category) {
    messages = messages.filter((m) => m.category === options.category);
  }

  if (options?.priority) {
    messages = messages.filter((m) => m.priority === options.priority);
  }

  if (options?.limit) {
    messages = messages.slice(0, options.limit);
  }

  return messages;
}

/**
 * Get message by ID
 */
export function getMessage(id: string): AgentMessage | undefined {
  const store = loadBusStore();
  return store.messages.find((m) => m.id === id);
}

/**
 * Get bus stats
 */
export function getStats(): AgentBusStore['stats'] {
  const store = loadBusStore();
  return store.stats;
}

/**
 * Get unread count for an agent
 */
export function getUnreadCount(agentId?: AgentId): number {
  const store = loadBusStore();
  if (!agentId) return store.stats.unread_count;

  return store.messages.filter(
    (m) => !m.read && (m.to === agentId || m.to === 'broadcast' || (Array.isArray(m.to) && m.to.includes(agentId)))
  ).length;
}

// ============================================================================
// Seed Example Messages
// ============================================================================

/**
 * Seed example messages for testing
 */
export function seedExampleMessages(): number {
  const store = loadBusStore();
  const now = Math.floor(Date.now() / 1000);

  const exampleMessages: AgentMessage[] = [
    // PM Agent messages
    {
      id: generateMessageId(),
      timestamp: now - 300,
      from: 'pm-agent',
      to: 'orchestrator',
      category: 'status',
      priority: 'normal',
      subject: 'Sync completed: GitHub ↔ Motion',
      body: 'Successfully synced 6 tasks across 3 project mappings. No conflicts detected.',
      confidence: 0.95,
      impact: 'low',
      context: { domain: 'pm', action_required: false },
      read: false,
      acknowledged: false,
    },
    {
      id: generateMessageId(),
      timestamp: now - 600,
      from: 'pm-agent',
      to: 'user',
      category: 'alert',
      priority: 'high',
      subject: 'Low confidence mapping: Kahoa',
      body: 'Unable to confidently map Kahoa repos to Motion project. Only 1 repo found (kahoa-roadmap). Manual review recommended.',
      confidence: 0.65,
      impact: 'medium',
      context: { project: 'Kahoa', domain: 'pm', action_required: true },
      read: false,
      acknowledged: false,
    },

    // Finance Agent messages
    {
      id: generateMessageId(),
      timestamp: now - 1200,
      from: 'finance-agent',
      to: 'user',
      category: 'decision',
      priority: 'high',
      subject: 'Unusual transaction detected',
      body: 'Transaction of $2,450 to "Tech Solutions LLC" flagged. Category uncertain (could be software or consulting). Please classify.',
      confidence: 0.45,
      impact: 'high',
      context: { domain: 'finance', entity_type: 'transaction', action_required: true },
      read: false,
      acknowledged: false,
    },
    {
      id: generateMessageId(),
      timestamp: now - 3600,
      from: 'finance-agent',
      to: 'orchestrator',
      category: 'status',
      priority: 'low',
      subject: 'Monthly rollup complete',
      body: 'November 2025 financial rollup processed. 127 transactions categorized with 94% auto-classification rate.',
      confidence: 0.94,
      impact: 'low',
      context: { domain: 'finance' },
      read: true,
      acknowledged: true,
    },

    // Legal Agent messages
    {
      id: generateMessageId(),
      timestamp: now - 1800,
      from: 'legal-agent',
      to: 'user',
      category: 'escalation',
      priority: 'critical',
      subject: 'Deadline approaching: Court filing',
      body: 'Motion to compel discovery due in 3 days. Document preparation 60% complete. Immediate attention required.',
      confidence: 0.99,
      impact: 'high',
      context: { domain: 'legal', deadline: now + 259200, action_required: true },
      read: false,
      acknowledged: false,
    },
    {
      id: generateMessageId(),
      timestamp: now - 7200,
      from: 'legal-agent',
      to: 'pm-agent',
      category: 'request',
      priority: 'normal',
      subject: 'Request: Project timeline for legal review',
      body: 'Need Vuplicity project timeline for compliance documentation. Can you provide Motion task history?',
      confidence: 0.88,
      impact: 'medium',
      context: { project: 'Vuplicity', domain: 'legal' },
      read: false,
      acknowledged: false,
    },

    // Comms Agent messages
    {
      id: generateMessageId(),
      timestamp: now - 900,
      from: 'comms-agent',
      to: 'user',
      category: 'alert',
      priority: 'normal',
      subject: 'New contact identified: Cody (New Reward)',
      body: 'Detected new contact from email thread. Role: Lead Developer. Project: New Reward (Camera AI). Added to relationships map.',
      confidence: 0.78,
      impact: 'low',
      context: { entity_type: 'contact', project: 'New Reward' },
      read: false,
      acknowledged: false,
    },
    {
      id: generateMessageId(),
      timestamp: now - 5400,
      from: 'comms-agent',
      to: 'orchestrator',
      category: 'status',
      priority: 'low',
      subject: 'Email sync: 23 new messages',
      body: 'Processed 23 new emails. 3 flagged for action, 2 added to legal context queue.',
      confidence: 0.92,
      impact: 'low',
      context: { domain: 'comms' },
      read: true,
      acknowledged: false,
    },

    // Health Agent messages
    {
      id: generateMessageId(),
      timestamp: now - 2400,
      from: 'health-agent',
      to: 'user',
      category: 'alert',
      priority: 'high',
      subject: 'Recovery score below baseline',
      body: 'WHOOP recovery at 42% (baseline: 65%). HRV significantly reduced. Consider adjusting schedule for today.',
      confidence: 0.97,
      impact: 'high',
      context: { domain: 'health', action_required: true },
      read: false,
      acknowledged: false,
    },

    // Orchestrator messages
    {
      id: generateMessageId(),
      timestamp: now - 4800,
      from: 'orchestrator',
      to: 'broadcast',
      category: 'task',
      priority: 'normal',
      subject: 'Daily sync initiated',
      body: 'Starting 17:00 sync cycle. All agents: report status within 5 minutes.',
      confidence: 1.0,
      impact: 'low',
      context: { action_required: true },
      read: true,
      acknowledged: true,
    },
  ];

  // Add messages that don't already exist
  const existingIds = new Set(store.messages.map((m) => m.id));
  let added = 0;

  for (const msg of exampleMessages) {
    if (!existingIds.has(msg.id)) {
      store.messages.unshift(msg);
      added++;
    }
  }

  // Sort by timestamp descending
  store.messages.sort((a, b) => b.timestamp - a.timestamp);

  saveBusStore(store);
  return added;
}

/**
 * Clear all messages (for testing)
 */
export function clearMessages(): void {
  const store = createEmptyStore();
  saveBusStore(store);
}
