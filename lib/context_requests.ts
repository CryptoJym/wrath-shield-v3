/**
 * Context Requests Store
 *
 * Lightweight JSON-based store for routing context requests.
 * When an event is routed to Finance/PM/Legal/Orchestrator, a context-request
 * record is created and a bus message is emitted.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import crypto from 'crypto';
import {
  emitMessage,
  type AgentId,
  type MessageCategory,
} from './agent_bus';

// ============================================================================
// Types
// ============================================================================

export type RoutingTarget = 'finance' | 'pm' | 'legal' | 'orchestrator';

export type RequestStatus = 'pending' | 'processing' | 'dispatched' | 'done' | 'failed';

export interface ContextRequest {
  id: string;
  created_at: number; // Unix seconds
  updated_at: number;
  event_id: string; // Reference to events table
  event_payload: {
    channel: string;
    subject?: string;
    preview?: string;
    contact?: string;
    source?: string;
    ts?: number;
  };
  target: RoutingTarget;
  status: RequestStatus;
  dispatched_to?: AgentId[]; // For orchestrator: downstream agents
  bus_message_ids: string[]; // IDs of emitted bus messages
  follow_up_questions?: string[];
  resolution_summary?: string;
  user_id?: string;
}

export interface ContextRequestStore {
  version: string;
  updated_at: number;
  requests: ContextRequest[];
  stats: {
    total: number;
    by_target: Record<RoutingTarget, number>;
    by_status: Record<RequestStatus, number>;
  };
}

// ============================================================================
// Storage
// ============================================================================

const STORE_PATH = resolve(process.cwd(), '.data', 'context-requests.json');
const MAX_REQUESTS = 500;

function ensureDir(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function createEmptyStore(): ContextRequestStore {
  return {
    version: '1.0',
    updated_at: Math.floor(Date.now() / 1000),
    requests: [],
    stats: {
      total: 0,
      by_target: { finance: 0, pm: 0, legal: 0, orchestrator: 0 },
      by_status: { pending: 0, processing: 0, dispatched: 0, done: 0, failed: 0 },
    },
  };
}

export function loadContextRequestStore(): ContextRequestStore {
  if (!existsSync(STORE_PATH)) {
    return createEmptyStore();
  }
  try {
    const raw = readFileSync(STORE_PATH, 'utf-8');
    return JSON.parse(raw) as ContextRequestStore;
  } catch {
    return createEmptyStore();
  }
}

export function saveContextRequestStore(store: ContextRequestStore): void {
  ensureDir(STORE_PATH);
  store.updated_at = Math.floor(Date.now() / 1000);
  updateStats(store);
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function updateStats(store: ContextRequestStore): void {
  store.stats.total = store.requests.length;
  store.stats.by_target = { finance: 0, pm: 0, legal: 0, orchestrator: 0 };
  store.stats.by_status = { pending: 0, processing: 0, dispatched: 0, done: 0, failed: 0 };

  for (const req of store.requests) {
    store.stats.by_target[req.target] = (store.stats.by_target[req.target] || 0) + 1;
    store.stats.by_status[req.status] = (store.stats.by_status[req.status] || 0) + 1;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function targetToAgentId(target: RoutingTarget): AgentId {
  const map: Record<RoutingTarget, AgentId> = {
    finance: 'finance-agent',
    pm: 'pm-agent',
    legal: 'legal-agent',
    orchestrator: 'orchestrator',
  };
  return map[target];
}

// ============================================================================
// Core Operations
// ============================================================================

/**
 * Create a context request when an event is routed
 * Emits a bus message to the target agent
 */
export function createContextRequest(params: {
  event_id: string;
  event_payload: ContextRequest['event_payload'];
  target: RoutingTarget;
  user_id?: string;
}): ContextRequest {
  const store = loadContextRequestStore();
  const now = Math.floor(Date.now() / 1000);

  // Check if request already exists for this event+target
  const existing = store.requests.find(
    (r) => r.event_id === params.event_id && r.target === params.target
  );
  if (existing) {
    // Update existing request
    existing.updated_at = now;
    existing.status = 'pending';
    saveContextRequestStore(store);
    return existing;
  }

  const request: ContextRequest = {
    id: generateId(),
    created_at: now,
    updated_at: now,
    event_id: params.event_id,
    event_payload: params.event_payload,
    target: params.target,
    status: 'pending',
    bus_message_ids: [],
    user_id: params.user_id,
  };

  // Emit bus message to target
  const agentId = targetToAgentId(params.target);
  const subject = params.event_payload.subject || params.event_payload.preview?.slice(0, 50) || 'New routed item';

  const busMsg = emitMessage({
    from: 'user',
    to: agentId,
    category: 'request',
    subject: `Routed: ${subject}`,
    body: buildMessageBody(params.event_payload),
    confidence: 0.7, // User-initiated routing = medium confidence
    impact: 'medium',
    context: {
      entity_id: params.event_id,
      entity_type: 'event',
      action_required: true,
    },
  }, true); // Force emit since it's user-initiated

  if (busMsg) {
    request.bus_message_ids.push(busMsg.id);
  }

  // Add to store
  store.requests.unshift(request);

  // Trim old requests
  if (store.requests.length > MAX_REQUESTS) {
    store.requests = store.requests.slice(0, MAX_REQUESTS);
  }

  saveContextRequestStore(store);

  // If target is orchestrator, trigger dispatch
  if (params.target === 'orchestrator') {
    orchestratorDispatch(request.id);
  }

  return request;
}

function buildMessageBody(payload: ContextRequest['event_payload']): string {
  const lines: string[] = [];
  if (payload.channel) lines.push(`Channel: ${payload.channel}`);
  if (payload.contact) lines.push(`From: ${payload.contact}`);
  if (payload.subject) lines.push(`Subject: ${payload.subject}`);
  if (payload.preview) lines.push(`Preview: ${payload.preview}`);
  if (payload.source) lines.push(`Source: ${payload.source}`);
  return lines.join('\n');
}

/**
 * Orchestrator dispatch logic
 * Reads the context request, determines downstream agents, and emits messages
 */
export function orchestratorDispatch(requestId: string): ContextRequest | null {
  const store = loadContextRequestStore();
  const request = store.requests.find((r) => r.id === requestId);

  if (!request || request.target !== 'orchestrator') {
    return null;
  }

  // Update status to processing
  request.status = 'processing';
  request.updated_at = Math.floor(Date.now() / 1000);

  // Determine downstream agents based on content analysis
  const downstreamAgents = analyzeAndRoute(request.event_payload);
  request.dispatched_to = downstreamAgents;

  // Emit messages to downstream agents
  for (const agentId of downstreamAgents) {
    const subject = request.event_payload.subject || 'Orchestrator dispatch';

    const busMsg = emitMessage({
      from: 'orchestrator',
      to: agentId,
      category: 'task',
      subject: `Dispatched: ${subject}`,
      body: `Orchestrator has routed this item for your attention.\n\n${buildMessageBody(request.event_payload)}`,
      confidence: 0.75, // Orchestrator confidence
      impact: 'medium',
      context: {
        entity_id: request.event_id,
        entity_type: 'event',
        action_required: true,
      },
      metadata: {
        context_request_id: request.id,
        dispatched_by: 'orchestrator',
      },
    }, true);

    if (busMsg) {
      request.bus_message_ids.push(busMsg.id);
    }
  }

  // Update status to dispatched
  request.status = downstreamAgents.length > 0 ? 'dispatched' : 'pending';
  request.updated_at = Math.floor(Date.now() / 1000);

  saveContextRequestStore(store);
  return request;
}

/**
 * Simple content analysis to determine which agents should handle the request
 */
function analyzeAndRoute(payload: ContextRequest['event_payload']): AgentId[] {
  const agents: AgentId[] = [];
  const text = [payload.subject, payload.preview, payload.contact, payload.source]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Finance keywords
  if (/invoice|payment|receipt|expense|budget|revenue|tax|accounting|financial|money|\$|dollar/i.test(text)) {
    agents.push('finance-agent');
  }

  // Legal keywords
  if (/legal|contract|agreement|lawsuit|court|attorney|lawyer|compliance|regulation|dispute|settlement/i.test(text)) {
    agents.push('legal-agent');
  }

  // PM keywords
  if (/project|task|deadline|milestone|sprint|roadmap|timeline|delivery|launch|release|github|motion/i.test(text)) {
    agents.push('pm-agent');
  }

  // Health keywords
  if (/health|wellness|recovery|hrv|sleep|workout|exercise|whoop|fitness/i.test(text)) {
    agents.push('health-agent');
  }

  // Comms keywords
  if (/meeting|calendar|schedule|email|message|call|contact|relationship/i.test(text)) {
    agents.push('comms-agent');
  }

  // Default to PM if no match
  if (agents.length === 0) {
    agents.push('pm-agent');
  }

  return agents;
}

/**
 * Update context request status
 */
export function updateContextRequestStatus(
  requestId: string,
  status: RequestStatus,
  resolution?: string
): ContextRequest | null {
  const store = loadContextRequestStore();
  const request = store.requests.find((r) => r.id === requestId);

  if (!request) return null;

  request.status = status;
  request.updated_at = Math.floor(Date.now() / 1000);
  if (resolution) {
    request.resolution_summary = resolution;
  }

  saveContextRequestStore(store);
  return request;
}

/**
 * Add follow-up question to a context request
 */
export function addFollowUpQuestion(requestId: string, question: string): ContextRequest | null {
  const store = loadContextRequestStore();
  const request = store.requests.find((r) => r.id === requestId);

  if (!request) return null;

  if (!request.follow_up_questions) {
    request.follow_up_questions = [];
  }
  request.follow_up_questions.push(question);
  request.updated_at = Math.floor(Date.now() / 1000);

  // Emit bus message for the follow-up
  const busMsg = emitMessage({
    from: targetToAgentId(request.target),
    to: 'user',
    category: 'request',
    subject: 'Follow-up question',
    body: question,
    confidence: 0.6, // Low confidence = needs user input
    impact: 'medium',
    context: {
      entity_id: request.event_id,
      entity_type: 'event',
      action_required: true,
    },
  }, true);

  if (busMsg) {
    request.bus_message_ids.push(busMsg.id);
  }

  saveContextRequestStore(store);
  return request;
}

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Get all context requests
 */
export function getAllContextRequests(options?: {
  limit?: number;
  target?: RoutingTarget;
  status?: RequestStatus;
}): ContextRequest[] {
  const store = loadContextRequestStore();
  let requests = store.requests;

  if (options?.target) {
    requests = requests.filter((r) => r.target === options.target);
  }

  if (options?.status) {
    requests = requests.filter((r) => r.status === options.status);
  }

  if (options?.limit) {
    requests = requests.slice(0, options.limit);
  }

  return requests;
}

/**
 * Get context request by ID
 */
export function getContextRequest(id: string): ContextRequest | undefined {
  const store = loadContextRequestStore();
  return store.requests.find((r) => r.id === id);
}

/**
 * Get context request by event ID
 */
export function getContextRequestByEventId(eventId: string): ContextRequest | undefined {
  const store = loadContextRequestStore();
  return store.requests.find((r) => r.event_id === eventId);
}

/**
 * Get routing stats
 */
export function getRoutingStats(): ContextRequestStore['stats'] {
  const store = loadContextRequestStore();
  return store.stats;
}

/**
 * Get pending requests count by target
 */
export function getPendingCountByTarget(): Record<RoutingTarget, number> {
  const store = loadContextRequestStore();
  const counts: Record<RoutingTarget, number> = {
    finance: 0,
    pm: 0,
    legal: 0,
    orchestrator: 0,
  };

  for (const req of store.requests) {
    if (req.status === 'pending' || req.status === 'processing') {
      counts[req.target]++;
    }
  }

  return counts;
}
