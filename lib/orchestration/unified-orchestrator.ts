/**
 * Unified Orchestration Layer
 * ===========================
 *
 * The Brain of the System: "Things that need US to act, not me"
 *
 * This is the single intelligent gateway that processes ALL incoming signals
 * and determines the appropriate action based on:
 *
 * 1. WHO - Contact enrichment from comms (VIP status, relationship context)
 * 2. WHAT - Domain detection (Vuplicity, NewReward, Family, etc.)
 * 3. HOW URGENT - Priority based on Life Charter + deadlines
 * 4. WHO DECIDES - Escalation level (CRITICAL/PROPOSE/AUTO_EXECUTE)
 * 5. WHAT HAPPENS - Execute autonomously or queue for James
 *
 * The goal: Autonomous handling of routine decisions while surfacing
 * only what truly needs human judgment.
 */

import { createHash } from 'crypto';
import { getDatabase } from '../db/Database';
import { getLifeCharter, getDomain } from '../life-os-config';
import { type ContactRow } from '../relationshipDb';
import {
  enqueueSignal,
  type IncomingSignal,
  type QueueAction,
  type SignalSource as QueueSignalSource,
  type SignalType as QueueSignalType,
  type EscalationLevel as QueueEscalationLevel,
} from '../pm/task-queue';
import { recordOrchestratorDecision } from '../agents/orchestrator-memory';

// =============================================================================
// TYPES
// =============================================================================

export type SignalSource =
  | 'comms'      // Email, iMessage, SMS
  | 'inbox'      // Inbox agent
  | 'finance'    // Finance signals
  | 'legal'      // Legal/compliance
  | 'pm'         // PM agent
  | 'calendar'   // Calendar events
  | 'lifelog'    // Limitless lifelogs
  | 'github'     // GitHub events
  | 'eeg'        // WHOOP/EEG data
  | 'manual';    // Manual entry

export type SignalType =
  | 'task'
  | 'follow_up'
  | 'deadline'
  | 'alert'
  | 'mention'
  | 'meeting'
  | 'expense'
  | 'compliance'
  | 'health'
  | 'message';

// Internal escalation levels (semantic, uppercase)
export type EscalationLevel = 'CRITICAL' | 'PROPOSE' | 'AUTO_EXECUTE';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

// =============================================================================
// TYPE CONVERSION (Unified Orchestrator -> Task Queue)
// =============================================================================

/**
 * Convert internal escalation level to task-queue compatible format
 */
function toQueueEscalation(level: EscalationLevel): QueueEscalationLevel {
  switch (level) {
    case 'CRITICAL': return 'critical';
    case 'PROPOSE': return 'propose';
    case 'AUTO_EXECUTE': return 'auto';
  }
}

/**
 * Convert signal source to task-queue compatible format
 * Falls back to 'inbox' for sources not supported by task-queue
 */
function toQueueSource(source: SignalSource): QueueSignalSource {
  const validSources: QueueSignalSource[] = ['comms', 'inbox', 'legal', 'finance', 'eeg', 'github', 'calendar'];
  if (validSources.includes(source as QueueSignalSource)) {
    return source as QueueSignalSource;
  }
  // Map extended sources to closest equivalents
  switch (source) {
    case 'pm': return 'inbox';
    case 'lifelog': return 'inbox';
    case 'manual': return 'inbox';
    default: return 'inbox';
  }
}

/**
 * Convert signal type to task-queue compatible format
 */
function toQueueSignalType(type: SignalType): QueueSignalType {
  const validTypes: QueueSignalType[] = ['task', 'deadline', 'follow_up', 'energy_window', 'commit', 'mention'];
  if (validTypes.includes(type as QueueSignalType)) {
    return type as QueueSignalType;
  }
  // Map extended types to closest equivalents
  switch (type) {
    case 'alert': return 'task';
    case 'meeting': return 'task';
    case 'expense': return 'task';
    case 'compliance': return 'task';
    case 'health': return 'task';
    case 'message': return 'task';
    default: return 'task';
  }
}

export interface UnifiedSignal {
  id: string;
  source: SignalSource;
  signal_type: SignalType;
  timestamp: number;

  // Core content
  title: string;
  content: string;

  // Source confidence
  source_confidence: number;

  // Payload from source (varies by type)
  payload: Record<string, unknown>;

  // Optional metadata from source
  metadata?: {
    contact_id?: string;
    contact_handle?: string;
    domain_id?: string;
    project_id?: string;
    due_date?: string;
    [key: string]: unknown;
  };
}

export interface EnrichedSignal extends UnifiedSignal {
  // Relationship enrichment
  contact?: {
    id: string;
    display_name: string;
    handle: string;
    is_vip: boolean;
    message_count: number;
    last_interaction: number;
    relationship_summary?: string;
  };

  // Domain enrichment
  domain?: {
    id: string;
    name: string;
    type: string;
    priority_weight: number;
    sensitivity_level?: string;
  };

  // Cross-reference detection
  related_signals?: string[];
  is_duplicate?: boolean;
  duplicate_of?: string;
}

export interface OrchestrationDecision {
  signal_id: string;
  timestamp: number;

  // Calculated priority
  priority: Priority;
  priority_factors: string[];

  // Escalation
  escalation_level: EscalationLevel;
  escalation_triggers: string[];

  // Action
  action: QueueAction;
  target_agents: string[];

  // Whether to auto-execute or queue for review
  auto_execute: boolean;

  // Confidence in this decision
  confidence: number;

  // Human-readable reasoning
  reasoning: string;
}

export interface OrchestrationResult {
  signal: EnrichedSignal;
  decision: OrchestrationDecision;
  executed: boolean;
  execution_result?: {
    success: boolean;
    action_id?: string;
    error?: string;
  };
}

// =============================================================================
// VIP DETECTION
// =============================================================================

const VIP_KEYWORDS = [
  'client', 'investor', 'partner', 'founder', 'ceo', 'cto', 'executive',
  'important', 'key', 'strategic', 'priority', 'vip'
];

const VIP_MESSAGE_THRESHOLD = 50;

function isContactVIP(contact: ContactRow, relationshipSummary?: string): boolean {
  // High message count = VIP
  if (contact.message_count >= VIP_MESSAGE_THRESHOLD) {
    return true;
  }

  // Check relationship summary for VIP keywords
  if (relationshipSummary) {
    const lower = relationshipSummary.toLowerCase();
    return VIP_KEYWORDS.some(kw => lower.includes(kw));
  }

  return false;
}

// =============================================================================
// CONTACT ENRICHMENT
// =============================================================================

async function enrichWithContact(signal: UnifiedSignal): Promise<EnrichedSignal['contact'] | undefined> {
  const contactId = signal.metadata?.contact_id;
  const contactHandle = signal.metadata?.contact_handle;

  if (!contactId && !contactHandle) {
    return undefined;
  }

  try {
    const db = getDatabase();

    // Find contact
    let contact: ContactRow | undefined;
    if (contactId) {
      contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId) as ContactRow | undefined;
    } else if (contactHandle) {
      contact = db.prepare('SELECT * FROM contacts WHERE handle = ? OR canonical_handle = ?')
        .get(contactHandle, contactHandle) as ContactRow | undefined;
    }

    if (!contact) {
      return undefined;
    }

    // Get relationship summary
    const summaryRow = db.prepare('SELECT summary FROM relationship_summaries WHERE contact_id = ?')
      .get(contact.id) as { summary?: string } | undefined;

    return {
      id: contact.id,
      display_name: contact.display_name || contact.handle,
      handle: contact.handle,
      is_vip: isContactVIP(contact, summaryRow?.summary),
      message_count: contact.message_count || 0,
      last_interaction: contact.last_ts || 0,
      relationship_summary: summaryRow?.summary,
    };
  } catch (e) {
    console.warn('[UnifiedOrchestrator] Failed to enrich contact:', e);
    return undefined;
  }
}

// =============================================================================
// DOMAIN ENRICHMENT
// =============================================================================

function enrichWithDomain(signal: UnifiedSignal): EnrichedSignal['domain'] | undefined {
  const domainId = signal.metadata?.domain_id;

  // Try explicit domain first
  if (domainId) {
    const domain = getDomain(domainId);
    if (domain) {
      return {
        id: domain.id,
        name: domain.name,
        type: domain.type,
        priority_weight: domain.priority_weight,
        sensitivity_level: domain.sensitivity_level,
      };
    }
  }

  // Infer domain from content
  const content = `${signal.title} ${signal.content}`.toLowerCase();

  // Check for Vuplicity/FCRA
  if (content.includes('fcra') || content.includes('vuplicity') || content.includes('background check') || content.includes('screening')) {
    return {
      id: 'vuplicity',
      name: 'Vuplicity',
      type: 'venture',
      priority_weight: 9,
      sensitivity_level: 'high_compliance',
    };
  }

  // Check for family
  if (content.includes('lisa') || content.includes('hyro') || content.includes('family')) {
    return {
      id: 'family',
      name: 'Family & Home',
      type: 'personal',
      priority_weight: 10,
    };
  }

  // Check for NewReward
  if (content.includes('reward') || content.includes('lead gen') || content.includes('campaign')) {
    return {
      id: 'reward',
      name: 'New Reward',
      type: 'venture',
      priority_weight: 7,
    };
  }

  return undefined;
}

// =============================================================================
// DUPLICATE DETECTION
// =============================================================================

function generateSignalHash(signal: UnifiedSignal): string {
  // Create a hash based on key signal attributes
  const hashInput = [
    signal.title.toLowerCase().trim(),
    signal.content.toLowerCase().trim().slice(0, 200),
    signal.metadata?.contact_handle || '',
    signal.signal_type,
  ].join('|');

  return createHash('sha256').update(hashInput).digest('hex').slice(0, 16);
}

async function detectDuplicate(signal: UnifiedSignal): Promise<{ isDuplicate: boolean; duplicateOf?: string }> {
  const hash = generateSignalHash(signal);
  const db = getDatabase();

  try {
    // Check in PM queue for similar signals in last 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const existing = db.prepare(`
      SELECT id, payload FROM pm_queue
      WHERE created_at > ?
      AND json_extract(metadata, '$.signal_hash') = ?
    `).get(oneDayAgo, hash) as { id: string; payload: string } | undefined;

    if (existing) {
      return { isDuplicate: true, duplicateOf: existing.id };
    }

    return { isDuplicate: false };
  } catch (e) {
    // Table might not exist yet
    return { isDuplicate: false };
  }
}

// =============================================================================
// PRIORITY CALCULATION
// =============================================================================

function calculatePriority(enriched: EnrichedSignal): { priority: Priority; factors: string[] } {
  const factors: string[] = [];
  let score = 0;

  const charter = getLifeCharter();

  // Domain weight (0-10)
  if (enriched.domain) {
    score += enriched.domain.priority_weight;
    factors.push(`Domain weight: ${enriched.domain.name} (${enriched.domain.priority_weight})`);
  }

  // VIP contact bonus (+3)
  if (enriched.contact?.is_vip) {
    score += 3;
    factors.push(`VIP contact: ${enriched.contact.display_name}`);
  }

  // Signal type urgency
  if (enriched.signal_type === 'deadline') {
    score += 2;
    factors.push('Signal type: deadline');
  } else if (enriched.signal_type === 'compliance') {
    score += 4;
    factors.push('Signal type: compliance (high urgency)');
  } else if (enriched.signal_type === 'alert') {
    score += 2;
    factors.push('Signal type: alert');
  }

  // Due date urgency
  if (enriched.metadata?.due_date) {
    const dueDate = new Date(enriched.metadata.due_date);
    const daysUntil = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) {
      score += 5;
      factors.push(`Overdue by ${Math.abs(daysUntil)} days`);
    } else if (daysUntil <= 1) {
      score += 4;
      factors.push('Due within 24 hours');
    } else if (daysUntil <= 3) {
      score += 2;
      factors.push(`Due in ${daysUntil} days`);
    }
  }

  // Sensitivity level
  if (enriched.domain?.sensitivity_level === 'high_compliance') {
    score += 3;
    factors.push('High compliance sensitivity');
  }

  // Source confidence modifier
  if (enriched.source_confidence < 0.5) {
    score -= 1;
    factors.push('Low source confidence');
  }

  // Convert score to priority
  let priority: Priority;
  if (score >= 15) {
    priority = 'critical';
  } else if (score >= 10) {
    priority = 'high';
  } else if (score >= 5) {
    priority = 'medium';
  } else {
    priority = 'low';
  }

  return { priority, factors };
}

// =============================================================================
// ESCALATION DETERMINATION
// =============================================================================

function determineEscalation(enriched: EnrichedSignal, priority: Priority): { level: EscalationLevel; triggers: string[] } {
  const charter = getLifeCharter();
  const triggers: string[] = [];
  const content = `${enriched.title} ${enriched.content}`.toLowerCase();

  // Check CRITICAL triggers
  const criticalTriggers = charter.escalation_levels.CRITICAL.triggers;
  for (const trigger of criticalTriggers) {
    const triggerLower = trigger.toLowerCase();

    if (triggerLower.includes('legal') && (content.includes('lawsuit') || content.includes('legal threat'))) {
      triggers.push(trigger);
    }
    if (triggerLower.includes('fcra') && (content.includes('fcra') || content.includes('compliance incident'))) {
      triggers.push(trigger);
    }
    if (triggerLower.includes('security') && content.includes('breach')) {
      triggers.push(trigger);
    }
    if (triggerLower.includes('family') && enriched.domain?.id === 'family' && priority === 'critical') {
      triggers.push(trigger);
    }
    if (triggerLower.includes('health') && enriched.signal_type === 'health' && priority === 'critical') {
      triggers.push(trigger);
    }
  }

  if (triggers.length > 0) {
    return { level: 'CRITICAL', triggers };
  }

  // Check PROPOSE triggers
  const proposeTriggers = charter.escalation_levels.PROPOSE.triggers;
  for (const trigger of proposeTriggers) {
    const triggerLower = trigger.toLowerCase();

    if (triggerLower.includes('new project') && content.includes('new project')) {
      triggers.push(trigger);
    }
    if (triggerLower.includes('expense') && enriched.signal_type === 'expense') {
      triggers.push(trigger);
    }
    if (triggerLower.includes('structural') && content.includes('restructure')) {
      triggers.push(trigger);
    }
    if (triggerLower.includes('meeting') && enriched.signal_type === 'meeting' && content.includes('external')) {
      triggers.push(trigger);
    }
  }

  // VIP contacts should propose for review
  if (enriched.contact?.is_vip && enriched.signal_type === 'follow_up') {
    triggers.push('VIP contact follow-up');
  }

  if (triggers.length > 0 || priority === 'high') {
    return { level: 'PROPOSE', triggers: triggers.length > 0 ? triggers : ['High priority signal'] };
  }

  // Default to AUTO_EXECUTE for routine items
  return { level: 'AUTO_EXECUTE', triggers: ['Routine signal within confidence threshold'] };
}

// =============================================================================
// ACTION DETERMINATION
// =============================================================================

function determineAction(enriched: EnrichedSignal, priority: Priority): QueueAction {
  // Compliance signals go to escalation
  if (enriched.domain?.sensitivity_level === 'high_compliance' || enriched.signal_type === 'compliance') {
    return 'escalate';
  }

  // Critical priority always escalates
  if (priority === 'critical') {
    return 'escalate';
  }

  // Tasks and follow-ups become local tasks or GitHub issues
  if (enriched.signal_type === 'task' || enriched.signal_type === 'follow_up') {
    // GitHub-related signals go to GitHub
    if (enriched.source === 'github' || enriched.content.toLowerCase().includes('github')) {
      return 'github_issue';
    }
    return 'local_task';
  }

  // Alerts and deadlines escalate
  if (enriched.signal_type === 'alert' || enriched.signal_type === 'deadline') {
    return 'escalate';
  }

  // Low priority can be deferred
  if (priority === 'low' && enriched.source_confidence < 0.6) {
    return 'defer';
  }

  // Default to local task
  return 'local_task';
}

// =============================================================================
// MAIN ORCHESTRATION FUNCTION
// =============================================================================

export async function orchestrateSignal(signal: UnifiedSignal): Promise<OrchestrationResult> {
  const startTime = Date.now();

  // 1. Enrich with contact data
  const contact = await enrichWithContact(signal);

  // 2. Enrich with domain data
  const domain = enrichWithDomain(signal);

  // 3. Check for duplicates
  const { isDuplicate, duplicateOf } = await detectDuplicate(signal);

  // 4. Build enriched signal
  const enriched: EnrichedSignal = {
    ...signal,
    contact,
    domain,
    is_duplicate: isDuplicate,
    duplicate_of: duplicateOf,
  };

  // 5. Handle duplicates
  if (isDuplicate) {
    return {
      signal: enriched,
      decision: {
        signal_id: signal.id,
        timestamp: Date.now(),
        priority: 'low',
        priority_factors: ['Duplicate signal'],
        escalation_level: 'AUTO_EXECUTE',
        escalation_triggers: ['Duplicate - already processed'],
        action: 'ignore',
        target_agents: [],
        auto_execute: true,
        confidence: 1.0,
        reasoning: `Duplicate of ${duplicateOf}`,
      },
      executed: true,
      execution_result: { success: true },
    };
  }

  // 6. Calculate priority
  const { priority, factors: priorityFactors } = calculatePriority(enriched);

  // 7. Determine escalation
  const { level: escalationLevel, triggers: escalationTriggers } = determineEscalation(enriched, priority);

  // 8. Determine action
  const action = determineAction(enriched, priority);

  // 9. Determine target agents
  const targetAgents: string[] = [];
  if (domain?.id) {
    targetAgents.push(`agent.${domain.id}`);
  }
  if (action === 'github_issue') {
    targetAgents.push('agent.pm');
  }
  if (escalationLevel === 'CRITICAL') {
    targetAgents.push('agent.orchestrator');
  }

  // 10. Determine if auto-execute
  const autoExecute = escalationLevel === 'AUTO_EXECUTE' &&
                      signal.source_confidence >= 0.7 &&
                      action !== 'escalate';

  // 11. Build reasoning
  const reasoning = buildReasoning(enriched, priority, escalationLevel, action, priorityFactors, escalationTriggers);

  // 12. Calculate decision confidence
  const decisionConfidence = calculateDecisionConfidence(enriched, priority, escalationLevel);

  // 13. Build decision
  const decision: OrchestrationDecision = {
    signal_id: signal.id,
    timestamp: Date.now(),
    priority,
    priority_factors: priorityFactors,
    escalation_level: escalationLevel,
    escalation_triggers: escalationTriggers,
    action,
    target_agents: targetAgents,
    auto_execute: autoExecute,
    confidence: decisionConfidence,
    reasoning,
  };

  // 14. Execute if auto-execute
  let executed = false;
  let executionResult: OrchestrationResult['execution_result'];

  if (autoExecute) {
    try {
      // Convert to IncomingSignal for PM queue using type conversion functions
      const pmSignal: IncomingSignal = {
        id: signal.id,
        source: toQueueSource(signal.source),
        signal_type: toQueueSignalType(signal.signal_type),
        payload: {
          ...signal.payload,
          title: signal.title,
          content: signal.content,
          contact_id: contact?.id,
          contact_name: contact?.display_name,
          is_vip: contact?.is_vip,
          domain_id: domain?.id,
          domain_name: domain?.name,
          original_source: signal.source, // Preserve original for tracking
          original_signal_type: signal.signal_type,
          orchestration_decision: {
            ...decision,
            // Store queue-compatible escalation level
            queue_escalation_level: toQueueEscalation(escalationLevel),
          },
        },
        timestamp: signal.timestamp,
        confidence: decisionConfidence,
      };

      await enqueueSignal(pmSignal);
      executed = true;
      executionResult = { success: true, action_id: signal.id };

      // Record decision to orchestrator memory
      await recordOrchestratorDecision({
        type: 'routing',
        description: `Auto-executed: ${action} for "${signal.title}"`,
        targetAgents,
        rationale: reasoning,
        escalationLevel,
        metadata: {
          signal_id: signal.id,
          priority,
          confidence: decisionConfidence,
          processing_time_ms: Date.now() - startTime,
        },
      });
    } catch (e: any) {
      executed = false;
      executionResult = { success: false, error: e.message };
    }
  } else {
    // Queue for review - store in PM queue with pending_review status
    try {
      const pmSignal: IncomingSignal = {
        id: signal.id,
        source: toQueueSource(signal.source),
        signal_type: toQueueSignalType(signal.signal_type),
        payload: {
          ...signal.payload,
          title: signal.title,
          content: signal.content,
          contact_id: contact?.id,
          contact_name: contact?.display_name,
          is_vip: contact?.is_vip,
          domain_id: domain?.id,
          domain_name: domain?.name,
          original_source: signal.source, // Preserve original for tracking
          original_signal_type: signal.signal_type,
          orchestration_decision: {
            ...decision,
            // Store queue-compatible escalation level
            queue_escalation_level: toQueueEscalation(escalationLevel),
          },
          requires_review: true,
        },
        timestamp: signal.timestamp,
        confidence: decisionConfidence,
      };

      await enqueueSignal(pmSignal);
      executed = true;
      executionResult = { success: true, action_id: signal.id };

      // Record decision
      await recordOrchestratorDecision({
        type: 'escalation',
        description: `Queued for review: ${action} for "${signal.title}"`,
        targetAgents,
        rationale: reasoning,
        escalationLevel,
        metadata: {
          signal_id: signal.id,
          priority,
          confidence: decisionConfidence,
          processing_time_ms: Date.now() - startTime,
        },
      });
    } catch (e: any) {
      executionResult = { success: false, error: e.message };
    }
  }

  return {
    signal: enriched,
    decision,
    executed,
    execution_result: executionResult,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function buildReasoning(
  enriched: EnrichedSignal,
  priority: Priority,
  escalation: EscalationLevel,
  action: QueueAction,
  priorityFactors: string[],
  escalationTriggers: string[]
): string {
  const parts: string[] = [];

  parts.push(`Signal from ${enriched.source}: "${enriched.title}"`);

  if (enriched.contact) {
    parts.push(`Contact: ${enriched.contact.display_name}${enriched.contact.is_vip ? ' (VIP)' : ''}`);
  }

  if (enriched.domain) {
    parts.push(`Domain: ${enriched.domain.name} (priority ${enriched.domain.priority_weight})`);
  }

  parts.push(`Priority: ${priority.toUpperCase()} based on: ${priorityFactors.join(', ')}`);
  parts.push(`Escalation: ${escalation} triggered by: ${escalationTriggers.join(', ')}`);
  parts.push(`Action: ${action}`);

  return parts.join('. ');
}

function calculateDecisionConfidence(
  enriched: EnrichedSignal,
  priority: Priority,
  escalation: EscalationLevel
): number {
  let confidence = enriched.source_confidence;

  // Boost confidence if we have rich context
  if (enriched.contact) {
    confidence += 0.05;
  }
  if (enriched.domain) {
    confidence += 0.05;
  }

  // Reduce confidence for high-stakes decisions
  if (escalation === 'CRITICAL') {
    confidence *= 0.9;
  }

  // Clamp to 0-1
  return Math.max(0, Math.min(1, confidence));
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

export async function orchestrateBatch(signals: UnifiedSignal[]): Promise<OrchestrationResult[]> {
  const results: OrchestrationResult[] = [];

  for (const signal of signals) {
    try {
      const result = await orchestrateSignal(signal);
      results.push(result);
    } catch (e: any) {
      console.error(`[UnifiedOrchestrator] Failed to process signal ${signal.id}:`, e);
      results.push({
        signal: signal as EnrichedSignal,
        decision: {
          signal_id: signal.id,
          timestamp: Date.now(),
          priority: 'low',
          priority_factors: ['Processing error'],
          escalation_level: 'PROPOSE',
          escalation_triggers: ['Error during processing'],
          action: 'escalate',
          target_agents: ['agent.orchestrator'],
          auto_execute: false,
          confidence: 0,
          reasoning: `Error: ${e.message}`,
        },
        executed: false,
        execution_result: { success: false, error: e.message },
      });
    }
  }

  return results;
}

// =============================================================================
// SIGNAL CREATION HELPERS
// =============================================================================

export function createSignalFromComms(
  eventId: string,
  channel: string,
  subject: string,
  preview: string,
  contact?: string,
  confidence: number = 0.7
): UnifiedSignal {
  return {
    id: `comms-${eventId}-${Date.now()}`,
    source: 'comms',
    signal_type: 'message',
    timestamp: Date.now(),
    title: subject,
    content: preview,
    source_confidence: confidence,
    payload: {
      event_id: eventId,
      channel,
    },
    metadata: {
      contact_handle: contact,
    },
  };
}

export function createSignalFromFollowUp(
  contactId: string,
  contactName: string,
  contactHandle: string,
  reason: string,
  isVip: boolean,
  daysSinceLast: number,
  confidence: number = 0.75
): UnifiedSignal {
  return {
    id: `followup-${contactId}-${Date.now()}`,
    source: 'comms',
    signal_type: 'follow_up',
    timestamp: Date.now(),
    title: `Follow up with ${contactName}`,
    content: reason,
    source_confidence: confidence,
    payload: {
      contact_id: contactId,
      contact_name: contactName,
      follow_up_reason: reason,
      days_since_last: daysSinceLast,
      is_vip: isVip,
    },
    metadata: {
      contact_id: contactId,
      contact_handle: contactHandle,
    },
  };
}

export function createSignalFromLifelog(
  lifelogId: string,
  title: string,
  content: string,
  actionType: 'task' | 'follow_up',
  urgency: 'high' | 'medium' | 'low',
  confidence: number = 0.7
): UnifiedSignal {
  return {
    id: `lifelog-${lifelogId}-${Date.now()}`,
    source: 'lifelog',
    signal_type: actionType,
    timestamp: Date.now(),
    title,
    content,
    source_confidence: confidence,
    payload: {
      lifelog_id: lifelogId,
      urgency,
    },
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  isContactVIP,
  enrichWithContact,
  enrichWithDomain,
  detectDuplicate,
  calculatePriority,
  determineEscalation,
  determineAction,
};
