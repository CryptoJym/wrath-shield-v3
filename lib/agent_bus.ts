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
import {
  getAgentsForDomain,
  getDomain,
  determineEscalationLevel,
  type AgentDefinition,
} from './life-os-config';

// ============================================================================
// Types & Schema
// ============================================================================

export type AgentId =
  | 'pm-agent'
  | 'legal-agent'
  | 'finance-agent'
  | 'comms-agent'
  | 'health-agent'
  | 'hyro-agent'
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

export type MessageStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

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
  status: MessageStatus; // Added for dispatch tracking
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
    status: 'pending' as MessageStatus,
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
      subject: 'GitHub sync completed',
      body: 'Successfully refreshed 6 issues across 3 repositories. No conflicts detected.',
      confidence: 0.95,
      impact: 'low',
      context: { domain: 'pm', action_required: false },
      status: 'completed',
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
      body: 'Unable to confidently map Kahoa repos to GitHub milestones. Only 1 repo found (kahoa-roadmap). Manual review recommended.',
      confidence: 0.65,
      impact: 'medium',
      context: { project: 'Kahoa', domain: 'pm', action_required: true },
      status: 'pending',
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
      status: 'pending',
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
      status: 'completed',
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
      status: 'pending',
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
      body: 'Need Vuplicity project timeline for compliance documentation. Can you provide GitHub issue history?',
      confidence: 0.88,
      impact: 'medium',
      context: { project: 'Vuplicity', domain: 'legal' },
      status: 'in_progress',
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
      status: 'completed',
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
      status: 'completed',
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
      status: 'pending',
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
      status: 'completed',
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

// ============================================================================
// Domain-Aware Routing (Life OS Integration)
// ============================================================================

/**
 * Domain detection patterns for routing messages
 */
const DOMAIN_PATTERNS: Record<string, RegExp[]> = {
  family: [/kids?/i, /family/i, /custody/i, /divorce/i, /child/i, /parent/i, /lisa/i, /hiro/i],
  utlyze_core: [/utlyze/i, /saas/i, /platform/i, /startup/i],
  vuplicity: [/vuplicity/i, /fcra/i, /background\s*check/i, /credit\s*report/i, /consumer\s*report/i],
  career: [/job/i, /career/i, /interview/i, /salary/i, /promotion/i],
  health: [/health/i, /workout/i, /sleep/i, /whoop/i, /fitness/i, /diet/i, /recovery/i],
  personal_finance: [/finance/i, /budget/i, /tax/i, /investment/i, /money/i, /expense/i, /transaction/i],
  legal: [/lawsuit/i, /attorney/i, /court/i, /legal/i, /lawyer/i, /litigation/i, /mycase/i],
  social: [/friend/i, /social/i, /relationship/i, /network/i],
};

/**
 * Detect domain from message content
 */
export function detectDomain(content: string): string | null {
  const lowerContent = content.toLowerCase();

  for (const [domainId, patterns] of Object.entries(DOMAIN_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return domainId;
      }
    }
  }

  return null;
}

/**
 * Map Life OS agent ID to bus AgentId
 */
function agentIdToBusId(lifeOsAgentId: string): AgentId {
  const mapping: Record<string, AgentId> = {
    'agent.orchestrator': 'orchestrator',
    'agent.legal': 'legal-agent',
    'agent.finance': 'finance-agent',
    'agent.pm': 'pm-agent',
    'agent.comms': 'comms-agent',
    'agent.health': 'health-agent',
    'agent.hyro': 'hyro-agent',
  };
  return mapping[lifeOsAgentId] || 'pm-agent';
}

/**
 * Route message to appropriate agent(s) based on domain detection
 * Uses Life OS config for agent-domain mappings and priority weights
 */
export function routeToAgents(message: Partial<AgentMessage>): AgentId[] {
  const content = `${message.subject || ''} ${message.body || ''}`;
  const domain = message.context?.domain || detectDomain(content);

  if (domain) {
    try {
      const agents = getAgentsForDomain(domain);
      const domainConfig = getDomain(domain);
      const priorityWeight = domainConfig?.priority_weight || 5;

      if (agents.length > 0) {
        // Sort agents by their domain's priority weight (highest first)
        const sortedAgents = agents
          .map((agent) => ({
            agent,
            priority: domainConfig?.priority_weight || 5,
          }))
          .sort((a, b) => b.priority - a.priority)
          .map((item) => agentIdToBusId(item.agent.id));

        console.log(`[agent_bus] Routed to ${sortedAgents.join(', ')} based on domain: ${domain} (priority: ${priorityWeight})`);
        return sortedAgents;
      }
    } catch (error) {
      console.warn('[agent_bus] Life OS routing failed, using default:', error);
    }
  }

  // Default to PM agent
  return ['pm-agent'];
}

/**
 * Smart emit with domain-aware routing
 * Automatically routes message to appropriate agents based on content
 */
export function smartEmit(params: Omit<Parameters<typeof createMessage>[0], 'to'>): AgentMessage | null {
  const content = `${params.subject} ${params.body}`;

  // Detect domain if not provided
  const detectedDomain = params.context?.domain || detectDomain(content);

  // Determine escalation level from Life OS config
  const escalation = determineEscalationLevel(content, detectedDomain || undefined);

  // Adjust priority based on escalation
  let adjustedImpact = params.impact;
  if (escalation === 'CRITICAL') {
    adjustedImpact = 'high';
  } else if (escalation === 'PROPOSE' && adjustedImpact === 'low') {
    adjustedImpact = 'medium';
  }

  // Route to appropriate agents
  const targetAgents = routeToAgents({
    subject: params.subject,
    body: params.body,
    context: { ...params.context, domain: detectedDomain || undefined },
  });

  // Create message with routed targets
  const msg = createMessage({
    ...params,
    to: targetAgents.length === 1 ? targetAgents[0] : targetAgents,
    impact: adjustedImpact,
    context: {
      ...params.context,
      domain: detectedDomain || params.context?.domain,
    },
    metadata: {
      ...params.metadata,
      escalation_level: escalation,
      routed_via: 'life-os',
    },
  });

  return emit(msg);
}

/**
 * Get agents recommended for a domain based on Life OS config
 */
export function getRecommendedAgents(domainId: string): { agentId: AgentId; name: string; reason: string }[] {
  try {
    const agents = getAgentsForDomain(domainId);
    const domain = getDomain(domainId);

    return agents.map((agent) => ({
      agentId: agentIdToBusId(agent.id),
      name: agent.name,
      reason: `Handles ${domain?.name || domainId} domain (priority: ${domain?.priority_weight || 'default'})`,
    }));
  } catch {
    return [{ agentId: 'pm-agent', name: 'Project Manager', reason: 'Default handler' }];
  }
}

// ============================================================================
// Agent Dispatch via AgentInvoker
// ============================================================================

/**
 * Map bus AgentId to Life OS agent ID
 */
function busIdToAgentId(busId: AgentId): string {
  const mapping: Record<AgentId, string> = {
    'orchestrator': 'agent.orchestrator',
    'legal-agent': 'agent.legal',
    'finance-agent': 'agent.finance',
    'pm-agent': 'agent.pm',
    'comms-agent': 'agent.comms',
    'health-agent': 'agent.health',
    'hyro-agent': 'agent.hyro',
    'user': 'agent.orchestrator', // User messages go to orchestrator
  };
  return mapping[busId] || 'agent.orchestrator';
}

/**
 * Dispatch result from agent invocation
 */
export interface DispatchResult {
  success: boolean;
  messageId: string;
  agentId: string;
  response?: string;
  escalationLevel?: 'CRITICAL' | 'PROPOSE' | 'AUTO_EXECUTE';
  wasExecuted?: boolean;
  error?: string;
}

/**
 * Dispatch a bus message to an agent via AgentInvoker
 * This is the bridge between agent_bus and AgentInvoker
 *
 * @param messageId - The bus message ID to dispatch
 * @param forceExecute - Force execution even for CRITICAL/PROPOSE escalations
 */
export async function dispatchToAgent(messageId: string, forceExecute: boolean = false): Promise<DispatchResult> {
  const store = loadBusStore();
  const message = store.messages.find((m) => m.id === messageId);

  if (!message) {
    return { success: false, messageId, agentId: '', error: 'Message not found' };
  }

  // Get the target agent(s)
  const targets = Array.isArray(message.to) ? message.to : message.to === 'broadcast' ? ['orchestrator'] : [message.to];
  const primaryTarget = targets[0] as AgentId;

  // Map to Life OS agent ID
  const lifeOsAgentId = busIdToAgentId(primaryTarget);

  // Build the user message from bus message content
  const userMessage = [
    message.subject,
    message.body,
    message.context?.entity_type ? `[Entity: ${message.context.entity_type} - ${message.context.entity_id}]` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    // Dynamic import to avoid circular dependency
    const { invokeAgent } = await import('./agents/AgentInvoker');

    const response = await invokeAgent({
      agentId: lifeOsAgentId,
      userMessage,
      context: {
        domainId: message.context?.domain || undefined,
        metadata: {
          bus_message_id: messageId,
          original_from: message.from,
          original_category: message.category,
          entity_id: message.context?.entity_id,
          entity_type: message.context?.entity_type,
        },
      },
      forceExecute,
    });

    // Update message status
    message.status = response.shouldExecute ? 'in_progress' : 'pending';
    message.metadata = {
      ...message.metadata,
      agent_response_id: response.requestId,
      escalation_level: response.escalationLevel,
      was_executed: response.shouldExecute,
      model_used: response.model,
    };
    saveBusStore(store);

    return {
      success: true,
      messageId,
      agentId: lifeOsAgentId,
      response: response.content,
      escalationLevel: response.escalationLevel,
      wasExecuted: response.shouldExecute,
    };
  } catch (error) {
    console.error(`[agent_bus] Failed to dispatch message ${messageId}:`, error);

    // Update message status to failed
    message.status = 'pending';
    message.metadata = {
      ...message.metadata,
      dispatch_error: error instanceof Error ? error.message : 'Unknown error',
    };
    saveBusStore(store);

    return {
      success: false,
      messageId,
      agentId: lifeOsAgentId,
      error: error instanceof Error ? error.message : 'Dispatch failed',
    };
  }
}

/**
 * Dispatch all pending messages to their target agents
 * Respects escalation levels - only AUTO_EXECUTE messages are dispatched automatically
 *
 * @param options - Filter options
 * @returns Results of all dispatch attempts
 */
export async function dispatchPendingMessages(options?: {
  includePropose?: boolean;
  includeCritical?: boolean;
  limit?: number;
}): Promise<DispatchResult[]> {
  const store = loadBusStore();
  const results: DispatchResult[] = [];

  // Filter pending messages
  const pendingMessages = store.messages.filter((m) => {
    if (m.status !== 'pending') return false;
    if (m.from === 'user') return false; // Don't dispatch user messages back to agents

    const escalation = m.metadata?.escalation_level;

    // Always include AUTO_EXECUTE
    if (!escalation || escalation === 'AUTO_EXECUTE') return true;

    // Optionally include PROPOSE
    if (escalation === 'PROPOSE' && options?.includePropose) return true;

    // Optionally include CRITICAL
    if (escalation === 'CRITICAL' && options?.includeCritical) return true;

    return false;
  });

  // Apply limit
  const messagesToProcess = options?.limit ? pendingMessages.slice(0, options.limit) : pendingMessages;

  // Dispatch each message
  for (const message of messagesToProcess) {
    const result = await dispatchToAgent(message.id, false);
    results.push(result);
  }

  console.log(`[agent_bus] Dispatched ${results.filter((r) => r.success).length}/${messagesToProcess.length} messages`);
  return results;
}
