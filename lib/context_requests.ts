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
import {
  getAgents,
  getDomains,
  getMappings,
  determineEscalationLevel,
  getAgentsForDomain,
  type AgentDefinition,
  type Domain,
} from './life-os-config';

// ============================================================================
// Types
// ============================================================================

export type RoutingTarget = 'finance' | 'pm' | 'legal' | 'orchestrator' | 'hyro';

export type RequestStatus = 'pending' | 'processing' | 'dispatched' | 'done' | 'failed';

export type EscalationLevel = 'CRITICAL' | 'PROPOSE' | 'AUTO_EXECUTE';

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
    domain_id?: string; // Life OS domain
  };
  target: RoutingTarget;
  status: RequestStatus;
  escalation_level?: EscalationLevel; // From Life Charter
  detected_domain?: string; // Detected Life OS domain
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
      by_target: { finance: 0, pm: 0, legal: 0, orchestrator: 0, hyro: 0 },
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
  store.stats.by_target = { finance: 0, pm: 0, legal: 0, orchestrator: 0, hyro: 0 };
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
    hyro: 'hyro-agent',
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
  escalation_level?: EscalationLevel;
  detected_domain?: string;
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

  // Use provided escalation/domain or determine from content
  const content = [params.event_payload.subject, params.event_payload.preview, params.event_payload.contact]
    .filter(Boolean)
    .join(' ');
  const detectedDomain = params.detected_domain || params.event_payload.domain_id || detectDomain(content);
  const escalationLevel = params.escalation_level || determineEscalationLevel(content, detectedDomain);

  const request: ContextRequest = {
    id: generateId(),
    created_at: now,
    updated_at: now,
    event_id: params.event_id,
    event_payload: params.event_payload,
    target: params.target,
    status: 'pending',
    escalation_level: escalationLevel,
    detected_domain: detectedDomain,
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
 * Orchestrator dispatch logic with escalation enforcement
 * Reads the context request, checks escalation level, and routes accordingly
 *
 * Escalation Levels (from Life Charter):
 * - CRITICAL: Immediate notification to user, DO NOT auto-execute
 * - PROPOSE: Queue for user approval before execution
 * - AUTO_EXECUTE: Proceed with routing automatically
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

  // Get escalation level (should already be set from createContextRequest)
  const escalation = request.escalation_level || 'AUTO_EXECUTE';

  // Determine downstream agents based on content analysis
  const downstreamAgents = analyzeAndRoute(request.event_payload);
  request.dispatched_to = downstreamAgents;

  // ENFORCE ESCALATION RULES
  if (escalation === 'CRITICAL') {
    // CRITICAL: Emit alert to user, DO NOT auto-dispatch to agents
    console.log(`[context_requests] CRITICAL escalation - halting auto-dispatch for request ${requestId}`);

    const busMsg = emitMessage({
      from: 'orchestrator',
      to: 'user',
      category: 'alert',
      subject: `CRITICAL: ${request.event_payload.subject || 'Requires immediate attention'}`,
      body: `CRITICAL ESCALATION - This item requires your immediate attention.\n\nEscalation triggered for: ${request.detected_domain || 'unknown domain'}\n\n${buildMessageBody(request.event_payload)}\n\nProposed routing: ${downstreamAgents.join(', ')}\n\nPlease approve or dismiss this request.`,
      confidence: 1.0, // Full confidence for critical alerts
      impact: 'high',
      context: {
        entity_id: request.event_id,
        entity_type: 'event',
        action_required: true,
      },
      metadata: {
        context_request_id: request.id,
        escalation_level: 'CRITICAL',
        proposed_agents: downstreamAgents,
        requires_approval: true,
      },
    }, true);

    if (busMsg) {
      request.bus_message_ids.push(busMsg.id);
    }

    // Set status to awaiting_approval (new status)
    request.status = 'pending'; // Keep pending until user approves
    request.updated_at = Math.floor(Date.now() / 1000);
    saveContextRequestStore(store);
    return request;
  }

  if (escalation === 'PROPOSE') {
    // PROPOSE: Queue for approval, emit notification but don't fully dispatch
    console.log(`[context_requests] PROPOSE escalation - queuing for approval for request ${requestId}`);

    const busMsg = emitMessage({
      from: 'orchestrator',
      to: 'user',
      category: 'request',
      subject: `Approval needed: ${request.event_payload.subject || 'Action proposed'}`,
      body: `ACTION PROPOSAL - This item is queued for your approval.\n\nDomain: ${request.detected_domain || 'general'}\n\n${buildMessageBody(request.event_payload)}\n\nProposed routing: ${downstreamAgents.join(', ')}\n\nReply 'approve' to proceed or 'dismiss' to cancel.`,
      confidence: 0.8,
      impact: 'high',
      context: {
        entity_id: request.event_id,
        entity_type: 'event',
        action_required: true,
      },
      metadata: {
        context_request_id: request.id,
        escalation_level: 'PROPOSE',
        proposed_agents: downstreamAgents,
        requires_approval: true,
      },
    }, true);

    if (busMsg) {
      request.bus_message_ids.push(busMsg.id);
    }

    // Set status to pending (awaiting approval)
    request.status = 'pending';
    request.updated_at = Math.floor(Date.now() / 1000);
    saveContextRequestStore(store);
    return request;
  }

  // AUTO_EXECUTE: Proceed with normal routing
  console.log(`[context_requests] AUTO_EXECUTE - proceeding with dispatch for request ${requestId}`);

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
 * Approve a pending escalation request
 * Called when user approves a CRITICAL or PROPOSE escalation
 */
export function approveEscalatedRequest(requestId: string): ContextRequest | null {
  const store = loadContextRequestStore();
  const request = store.requests.find((r) => r.id === requestId);

  if (!request) {
    console.warn(`[context_requests] Request not found: ${requestId}`);
    return null;
  }

  if (request.status !== 'pending') {
    console.warn(`[context_requests] Request ${requestId} is not pending (status: ${request.status})`);
    return request;
  }

  const downstreamAgents = request.dispatched_to || [];

  // Now dispatch to the proposed agents
  for (const agentId of downstreamAgents) {
    const subject = request.event_payload.subject || 'Approved dispatch';

    const busMsg = emitMessage({
      from: 'orchestrator',
      to: agentId,
      category: 'task',
      subject: `Approved: ${subject}`,
      body: `User approved this escalated item.\n\n${buildMessageBody(request.event_payload)}`,
      confidence: 0.9, // High confidence after user approval
      impact: 'high',
      context: {
        entity_id: request.event_id,
        entity_type: 'event',
        action_required: true,
      },
      metadata: {
        context_request_id: request.id,
        dispatched_by: 'orchestrator',
        user_approved: true,
        original_escalation: request.escalation_level,
      },
    }, true);

    if (busMsg) {
      request.bus_message_ids.push(busMsg.id);
    }
  }

  request.status = 'dispatched';
  request.updated_at = Math.floor(Date.now() / 1000);

  saveContextRequestStore(store);
  console.log(`[context_requests] Approved escalated request ${requestId}, dispatched to: ${downstreamAgents.join(', ')}`);
  return request;
}

/**
 * Dismiss an escalated request
 * Called when user rejects a CRITICAL or PROPOSE escalation
 */
export function dismissEscalatedRequest(requestId: string, reason?: string): ContextRequest | null {
  const store = loadContextRequestStore();
  const request = store.requests.find((r) => r.id === requestId);

  if (!request) {
    console.warn(`[context_requests] Request not found: ${requestId}`);
    return null;
  }

  request.status = 'failed';
  request.updated_at = Math.floor(Date.now() / 1000);
  request.resolution_summary = reason || 'User dismissed escalation';

  saveContextRequestStore(store);
  console.log(`[context_requests] Dismissed escalated request ${requestId}: ${reason || 'no reason provided'}`);
  return request;
}

/**
 * Get pending escalations (CRITICAL and PROPOSE awaiting approval)
 */
export function getPendingEscalations(): ContextRequest[] {
  const store = loadContextRequestStore();
  return store.requests.filter(
    (r) =>
      r.status === 'pending' &&
      (r.escalation_level === 'CRITICAL' || r.escalation_level === 'PROPOSE')
  );
}

/**
 * Detect Life OS domain from content using keywords and key people
 */
function detectDomain(text: string): string | undefined {
  const lowerText = text.toLowerCase();
  const domainsConfig = getDomains();

  // Domain-specific keyword patterns
  const domainPatterns: Record<string, RegExp[]> = {
    'vuplicity': [/vuplicity/i, /fcra/i, /background\s*check/i, /compliance/i, /screening/i],
    'utlyze_core': [/utlyze/i, /of\s*one/i, /managed\s*ai/i, /venture\s*studio/i],
    'family': [/lisa/i, /hiro/i, /family/i, /home/i, /wife/i, /son/i, /daughter/i],
    'hiro_education': [/hiro.*education/i, /hiro.*learn/i, /hiro.*school/i, /hiro.*development/i],
    'solutionstream': [/solutionstream/i, /jason\s*thelin/i, /justin\s*rohatinsky/i],
    'kahoa': [/kahoa/i, /ryan\s*kell/i, /connor\s*larson/i, /training\s*program/i],
    'reward': [/reward/i, /lead\s*gen/i, /marketing\s*ai/i],
    'personal_private': [/private/i, /personal/i, /experiment/i, /deep\s*work/i],
  };

  // Check domain patterns
  for (const [domainId, patterns] of Object.entries(domainPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerText)) {
        return domainId;
      }
    }
  }

  // Check key people from domains config
  for (const domain of domainsConfig.domains) {
    for (const person of domain.key_people) {
      if (lowerText.includes(person.toLowerCase())) {
        return domain.id;
      }
    }
  }

  return undefined;
}

/**
 * Content analysis to determine which agents should handle the request
 * Uses Life OS config for intelligent routing based on domains and agent definitions
 */
function analyzeAndRoute(payload: ContextRequest['event_payload']): AgentId[] {
  const agents: AgentId[] = [];
  const text = [payload.subject, payload.preview, payload.contact, payload.source]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // First, detect the domain
  const domainId = payload.domain_id || detectDomain(text);

  // If we detected a domain, get agents that handle it
  if (domainId) {
    const domainAgents = getAgentsForDomain(domainId);
    for (const agent of domainAgents) {
      // Map agent IDs to bus agent IDs
      const busAgentId = agentIdToBusId(agent.id);
      if (busAgentId && !agents.includes(busAgentId)) {
        agents.push(busAgentId);
      }
    }
  }

  // Also check for specific keywords that should trigger certain agents
  // Finance keywords (always include finance agent for money matters)
  if (/invoice|payment|receipt|expense|budget|revenue|tax|accounting|financial|money|\$\d+|dollar/i.test(text)) {
    if (!agents.includes('finance-agent')) {
      agents.push('finance-agent');
    }
  }

  // Legal keywords (always include legal agent for legal matters)
  if (/legal|contract|agreement|lawsuit|court|attorney|lawyer|compliance|regulation|dispute|settlement|fcra/i.test(text)) {
    if (!agents.includes('legal-agent')) {
      agents.push('legal-agent');
    }
  }

  // PM keywords (task management)
  if (/project|task|deadline|milestone|sprint|roadmap|timeline|delivery|launch|release|github/i.test(text)) {
    if (!agents.includes('pm-agent')) {
      agents.push('pm-agent');
    }
  }

  // Health keywords
  if (/health|wellness|recovery|hrv|sleep|workout|exercise|whoop|fitness/i.test(text)) {
    if (!agents.includes('health-agent')) {
      agents.push('health-agent');
    }
  }

  // Comms keywords
  if (/meeting|calendar|schedule|email|message|call|contact|relationship/i.test(text)) {
    if (!agents.includes('comms-agent')) {
      agents.push('comms-agent');
    }
  }

  // Hyro (Education) keywords
  if (/learn|course|tutorial|education|study|read|article|paper|research|book|training|skill/i.test(text)) {
    if (!agents.includes('hyro-agent')) {
      agents.push('hyro-agent');
    }
  }

  // Default to PM if no match
  if (agents.length === 0) {
    agents.push('pm-agent');
  }

  return agents;
}

/**
 * Map Life OS agent IDs to bus agent IDs
 */
function agentIdToBusId(lifeOsAgentId: string): AgentId | null {
  const mapping: Record<string, AgentId> = {
    'agent.orchestrator': 'orchestrator',
    'agent.pm': 'pm-agent',
    'agent.comms': 'comms-agent',
    'agent.finance': 'finance-agent',
    'agent.legal': 'legal-agent',
    'agent.utlyze': 'pm-agent', // Route to PM for now
    'agent.vuplicity': 'legal-agent', // Route to legal due to compliance
    'agent.solutionstream': 'pm-agent',
    'agent.kahoa': 'pm-agent',
    'agent.hiro': 'hyro-agent', // Legacy alias for agent.hyro
    'agent.family': 'pm-agent',
    'agent.hyro': 'hyro-agent',
    'agent.grok': 'hyro-agent', // Research agent routes through hyro
    'agent.relationships': 'comms-agent',
    'agent.architect': 'orchestrator',
  };
  return mapping[lifeOsAgentId] || null;
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
    hyro: 0,
  };

  for (const req of store.requests) {
    if (req.status === 'pending' || req.status === 'processing') {
      counts[req.target]++;
    }
  }

  return counts;
}
