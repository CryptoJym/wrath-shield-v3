/**
 * Communications Pipeline
 *
 * Multi-stage pipeline for processing communications:
 * 1. Ingest: Receive events from sources (email/calendar/imessage/lifelog)
 * 2. Dedupe: Identify and merge duplicate items
 * 3. Classify: Categorize by type (finance/legal/pm/ea/junk)
 * 4. Route: Send to appropriate agent/queue via Life OS domain routing
 * 5. Action: Generate suggestions and context requests
 *
 * Pipeline maintains metrics, logs classification decisions, and tracks routing accuracy.
 * Now integrated with Life OS config for domain-aware routing.
 */

import { EventRow, listRecentEvents, updateEventClassification, routeEvent } from '@/lib/events';
import { createContextRequest, type RoutingTarget } from '@/lib/context_requests';
import { emitMessage, smartEmit, detectDomain, routeToAgents } from '@/lib/agent_bus';
import { getDomain, getDomains, determineEscalationLevel, getLifeCharter } from '@/lib/life-os-config';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type ClassificationCategory = 'finance' | 'legal' | 'pm' | 'ea' | 'health' | 'comms' | 'junk';

export interface ClassificationResult {
  category: ClassificationCategory;
  confidence: number;
  reasoning: string;
  keywords: string[];
  needs_review: boolean;
}

export interface DedupeResult {
  is_duplicate: boolean;
  duplicate_of?: string;
  similarity_score?: number;
}

export interface PipelineMetrics {
  total_processed: number;
  by_category: Record<ClassificationCategory, number>;
  by_source: Record<string, number>;
  avg_confidence: number;
  needs_review_count: number;
  junk_count: number;
  routed_count: number;
  dedupe_hits: number;
  last_updated: number;
}

export interface PipelineLog {
  id: string;
  timestamp: number;
  event_id: string;
  stage: 'ingest' | 'dedupe' | 'classify' | 'route' | 'action';
  action: string;
  details: Record<string, any>;
  success: boolean;
  error?: string;
}

// ============================================================================
// In-Memory Storage (can be persisted to JSON later)
// ============================================================================

const pipelineMetrics: PipelineMetrics = {
  total_processed: 0,
  by_category: {
    finance: 0,
    legal: 0,
    pm: 0,
    ea: 0,
    health: 0,
    comms: 0,
    junk: 0,
  },
  by_source: {},
  avg_confidence: 0,
  needs_review_count: 0,
  junk_count: 0,
  routed_count: 0,
  dedupe_hits: 0,
  last_updated: Date.now(),
};

const pipelineLogs: PipelineLog[] = [];
const MAX_LOGS = 500;

// Dedupe cache: hash -> event_id
const dedupeCache = new Map<string, string>();
const MAX_DEDUPE_CACHE = 1000;

// ============================================================================
// Pipeline Stages
// ============================================================================

/**
 * Stage 1: Ingest
 * Validate and normalize incoming event
 */
export function ingestEvent(event: EventRow): { success: boolean; error?: string } {
  try {
    // Validate required fields
    if (!event.id || !event.source || !event.channel) {
      return { success: false, error: 'Missing required fields' };
    }

    // Update metrics
    pipelineMetrics.by_source[event.source] = (pipelineMetrics.by_source[event.source] || 0) + 1;

    logPipelineAction({
      event_id: event.id,
      stage: 'ingest',
      action: 'received',
      details: { source: event.source, channel: event.channel },
      success: true,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Stage 2: Dedupe
 * Check if event is a duplicate using content hash
 */
export function dedupeEvent(event: EventRow): DedupeResult {
  try {
    // Generate content hash
    const content = [
      event.contact || '',
      event.subject || '',
      event.preview?.slice(0, 200) || '',
      event.ts,
    ].join('|');

    const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);

    // Check cache
    if (dedupeCache.has(hash)) {
      const duplicate_of = dedupeCache.get(hash)!;
      pipelineMetrics.dedupe_hits++;

      logPipelineAction({
        event_id: event.id,
        stage: 'dedupe',
        action: 'duplicate_detected',
        details: { duplicate_of, hash },
        success: true,
      });

      return {
        is_duplicate: true,
        duplicate_of,
        similarity_score: 1.0,
      };
    }

    // Add to cache
    dedupeCache.set(hash, event.id);

    // Trim cache if needed
    if (dedupeCache.size > MAX_DEDUPE_CACHE) {
      const firstKey = dedupeCache.keys().next().value;
      if (firstKey !== undefined) {
        dedupeCache.delete(firstKey);
      }
    }

    logPipelineAction({
      event_id: event.id,
      stage: 'dedupe',
      action: 'unique',
      details: { hash },
      success: true,
    });

    return { is_duplicate: false };
  } catch (error) {
    logPipelineAction({
      event_id: event.id,
      stage: 'dedupe',
      action: 'error',
      details: {},
      success: false,
      error: String(error),
    });

    return { is_duplicate: false };
  }
}

/**
 * Stage 3: Classify
 * Categorize event by type with confidence scoring
 */
export function classifyEvent(event: EventRow): ClassificationResult {
  try {
    const text = [
      event.contact || '',
      event.subject || '',
      event.preview || '',
      event.source || '',
    ]
      .join(' ')
      .toLowerCase();

    // Finance patterns
    const financePatterns = [
      /invoice|payment|receipt|expense|budget|revenue|tax|accounting|financial|money|\$|dollar|plaid|stripe|paypal|quickbooks/i,
    ];
    const financeScore = countMatches(text, financePatterns);

    // Legal patterns
    const legalPatterns = [
      /legal|contract|agreement|lawsuit|court|attorney|lawyer|compliance|regulation|dispute|settlement|trademark|patent|nda/i,
    ];
    const legalScore = countMatches(text, legalPatterns);

    // PM patterns
    const pmPatterns = [
      /project|task|deadline|milestone|sprint|roadmap|timeline|delivery|launch|release|github|gitlab|jira|trello|asana|motion/i,
    ];
    const pmScore = countMatches(text, pmPatterns);

    // EA patterns (executive assistant - scheduling, calendar, travel)
    const eaPatterns = [
      /meeting|calendar|schedule|appointment|call|conference|zoom|travel|flight|hotel|itinerary|agenda/i,
    ];
    const eaScore = countMatches(text, eaPatterns);

    // Health patterns
    const healthPatterns = [
      /health|wellness|recovery|hrv|sleep|workout|exercise|whoop|fitness|nutrition|therapy/i,
    ];
    const healthScore = countMatches(text, healthPatterns);

    // Comms patterns (relationship management)
    const commsPatterns = [/email|message|contact|relationship|follow.?up|networking|connection/i];
    const commsScore = countMatches(text, commsPatterns);

    // Junk patterns
    const junkPatterns = [
      /unsubscribe|spam|promotion|offer|deal|discount|subscribe|newsletter|advertisement|marketing/i,
    ];
    const junkScore = countMatches(text, junkPatterns);

    // Calculate scores
    const scores = {
      finance: financeScore,
      legal: legalScore,
      pm: pmScore,
      ea: eaScore,
      health: healthScore,
      comms: commsScore,
      junk: junkScore,
    };

    // Find highest score
    let maxCategory: ClassificationCategory = 'comms'; // default
    let maxScore = 0;

    for (const [category, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxCategory = category as ClassificationCategory;
      }
    }

    // Calculate confidence (normalize score to 0-1)
    const confidence = Math.min(maxScore / 5, 1.0); // Max 5 matches = 100% confidence

    // Determine if needs review (low confidence)
    const needs_review = confidence < 0.7;

    // Extract keywords
    const keywords = extractKeywords(text, maxCategory);

    logPipelineAction({
      event_id: event.id,
      stage: 'classify',
      action: 'classified',
      details: { category: maxCategory, confidence, scores, keywords },
      success: true,
    });

    // Update metrics
    pipelineMetrics.by_category[maxCategory]++;
    if (needs_review) pipelineMetrics.needs_review_count++;
    if (maxCategory === 'junk') pipelineMetrics.junk_count++;

    return {
      category: maxCategory,
      confidence,
      reasoning: `Matched ${maxScore} patterns for ${maxCategory}`,
      keywords,
      needs_review,
    };
  } catch (error) {
    logPipelineAction({
      event_id: event.id,
      stage: 'classify',
      action: 'error',
      details: {},
      success: false,
      error: String(error),
    });

    return {
      category: 'comms',
      confidence: 0.3,
      reasoning: 'Classification error - defaulting to comms',
      keywords: [],
      needs_review: true,
    };
  }
}

/**
 * Stage 4: Route
 * Route classified event to appropriate agent using Life OS domain routing
 */
export function routeEventToAgent(
  event: EventRow,
  classification: ClassificationResult,
  user_id?: string
): { success: boolean; routed_to?: RoutingTarget; error?: string; escalationLevel?: string; routedAgents?: string[] } {
  try {
    // Skip routing for junk or low confidence items
    if (classification.category === 'junk') {
      logPipelineAction({
        event_id: event.id,
        stage: 'route',
        action: 'skipped_junk',
        details: { classification },
        success: true,
      });

      return { success: true };
    }

    if (classification.needs_review) {
      logPipelineAction({
        event_id: event.id,
        stage: 'route',
        action: 'skipped_needs_review',
        details: { classification },
        success: true,
      });

      return { success: true };
    }

    // Build content for Life OS domain detection
    const content = [event.subject || '', event.preview || '', event.contact || ''].join(' ');

    // Use Life OS domain detection
    const detectedDomain = detectDomain(content);

    // Determine escalation level via Life OS
    const escalationLevel = determineEscalationLevel(content, detectedDomain || undefined);

    // Use Life OS smart routing to get target agents
    const busMessage = smartEmit({
      from: 'comms-agent',
      category: 'task',
      subject: event.subject || 'Routed event',
      body: content,
      confidence: classification.confidence,
      impact: classification.confidence > 0.8 ? 'medium' : 'high',
      metadata: {
        event_id: event.id,
        source: event.source,
        channel: event.channel,
        classification: classification.category,
      },
    });

    // Map category to routing target (fallback for context requests)
    const categoryToTarget: Record<ClassificationCategory, RoutingTarget | null> = {
      finance: 'finance',
      legal: 'legal',
      pm: 'pm',
      ea: 'pm',
      health: null,
      comms: null,
      junk: null,
    };

    const target = categoryToTarget[classification.category];

    if (!target && !busMessage) {
      logPipelineAction({
        event_id: event.id,
        stage: 'route',
        action: 'no_target',
        details: { classification, detectedDomain, escalationLevel },
        success: true,
      });

      return { success: true, escalationLevel };
    }

    // Update event's routed_target
    if (target) {
      routeEvent(event.id, target, user_id);
    }

    // Create context request with escalation info
    createContextRequest({
      event_id: event.id,
      event_payload: {
        channel: event.channel,
        subject: event.subject || undefined,
        preview: event.preview || undefined,
        contact: event.contact || undefined,
        source: event.source,
        ts: event.ts,
      },
      target: target || 'orchestrator',
      user_id,
      escalation_level: escalationLevel as 'CRITICAL' | 'PROPOSE' | 'AUTO_EXECUTE',
      detected_domain: detectedDomain || undefined,
    });

    pipelineMetrics.routed_count++;

    const routedAgents = busMessage?.to ? (Array.isArray(busMessage.to) ? busMessage.to : [busMessage.to]) : [];

    logPipelineAction({
      event_id: event.id,
      stage: 'route',
      action: 'routed',
      details: {
        target,
        confidence: classification.confidence,
        detectedDomain,
        escalationLevel,
        routedAgents,
        busMessageId: busMessage?.id,
      },
      success: true,
    });

    return { success: true, routed_to: target || undefined, escalationLevel, routedAgents };
  } catch (error) {
    logPipelineAction({
      event_id: event.id,
      stage: 'route',
      action: 'error',
      details: {},
      success: false,
      error: String(error),
    });

    return { success: false, error: String(error) };
  }
}

/**
 * Stage 5: Action
 * Generate suggestions and action items
 */
export function generateActions(
  event: EventRow,
  classification: ClassificationResult
): { suggestions: string[]; priority: 'low' | 'medium' | 'high' } {
  try {
    const suggestions: string[] = [];
    let priority: 'low' | 'medium' | 'high' = 'low';

    // Generate category-specific suggestions
    switch (classification.category) {
      case 'finance':
        suggestions.push('Review transaction details');
        suggestions.push('Categorize expense');
        if (classification.confidence > 0.8) {
          suggestions.push('Auto-file to accounting');
        }
        priority = classification.confidence > 0.8 ? 'medium' : 'high';
        break;

      case 'legal':
        suggestions.push('Review contract terms');
        suggestions.push('Check for deadlines');
        suggestions.push('Flag for legal review');
        priority = 'high';
        break;

      case 'pm':
        suggestions.push('Create task in Motion');
        suggestions.push('Assign to project');
        suggestions.push('Set deadline');
        priority = 'medium';
        break;

      case 'ea':
        suggestions.push('Add to calendar');
        suggestions.push('Send calendar invite');
        suggestions.push('Prepare agenda');
        priority = 'medium';
        break;

      case 'health':
        suggestions.push('Log to health tracker');
        suggestions.push('Review wellness metrics');
        priority = 'low';
        break;

      case 'comms':
        suggestions.push('Add contact to CRM');
        suggestions.push('Schedule follow-up');
        priority = 'low';
        break;

      case 'junk':
        suggestions.push('Mark as spam');
        suggestions.push('Unsubscribe');
        priority = 'low';
        break;
    }

    logPipelineAction({
      event_id: event.id,
      stage: 'action',
      action: 'suggestions_generated',
      details: { suggestions, priority },
      success: true,
    });

    return { suggestions, priority };
  } catch (error) {
    logPipelineAction({
      event_id: event.id,
      stage: 'action',
      action: 'error',
      details: {},
      success: false,
      error: String(error),
    });

    return { suggestions: [], priority: 'low' };
  }
}

// ============================================================================
// Full Pipeline Execution
// ============================================================================

/**
 * Run full pipeline on an event
 */
export function runPipeline(
  event: EventRow,
  options: {
    skip_dedupe?: boolean;
    skip_route?: boolean;
    user_id?: string;
  } = {}
): {
  success: boolean;
  dedupe: DedupeResult;
  classification: ClassificationResult;
  routing?: { success: boolean; routed_to?: RoutingTarget };
  actions: { suggestions: string[]; priority: 'low' | 'medium' | 'high' };
  error?: string;
} {
  try {
    // Stage 1: Ingest
    const ingestResult = ingestEvent(event);
    if (!ingestResult.success) {
      return {
        success: false,
        dedupe: { is_duplicate: false },
        classification: {
          category: 'comms',
          confidence: 0,
          reasoning: 'Ingest failed',
          keywords: [],
          needs_review: true,
        },
        actions: { suggestions: [], priority: 'low' },
        error: ingestResult.error,
      };
    }

    // Stage 2: Dedupe
    const dedupe = options.skip_dedupe ? { is_duplicate: false } : dedupeEvent(event);
    if (dedupe.is_duplicate) {
      return {
        success: true,
        dedupe,
        classification: {
          category: 'comms',
          confidence: 0,
          reasoning: 'Duplicate event',
          keywords: [],
          needs_review: false,
        },
        actions: { suggestions: [], priority: 'low' },
      };
    }

    // Stage 3: Classify
    const classification = classifyEvent(event);

    // Update event classification in database
    updateEventClassification(event.id, classification.category, classification.confidence, options.user_id);

    // Stage 4: Route (optional)
    let routing;
    if (!options.skip_route) {
      routing = routeEventToAgent(event, classification, options.user_id);
    }

    // Stage 5: Actions
    const actions = generateActions(event, classification);

    // Update metrics
    pipelineMetrics.total_processed++;
    pipelineMetrics.last_updated = Date.now();

    return {
      success: true,
      dedupe,
      classification,
      routing,
      actions,
    };
  } catch (error) {
    return {
      success: false,
      dedupe: { is_duplicate: false },
      classification: {
        category: 'comms',
        confidence: 0,
        reasoning: 'Pipeline error',
        keywords: [],
        needs_review: true,
      },
      actions: { suggestions: [], priority: 'low' },
      error: String(error),
    };
  }
}

/**
 * Batch process multiple events
 */
export function runPipelineBatch(
  events: EventRow[],
  options: {
    skip_dedupe?: boolean;
    skip_route?: boolean;
    user_id?: string;
  } = {}
): { processed: number; results: ReturnType<typeof runPipeline>[] } {
  const results = events.map((event) => runPipeline(event, options));
  return {
    processed: results.filter((r) => r.success).length,
    results,
  };
}

// ============================================================================
// Metrics & Reporting
// ============================================================================

/**
 * Get current pipeline metrics
 */
export function getPipelineMetrics(): PipelineMetrics {
  return { ...pipelineMetrics };
}

/**
 * Get pipeline logs
 */
export function getPipelineLogs(limit = 50): PipelineLog[] {
  return pipelineLogs.slice(0, limit);
}

/**
 * Reset metrics (for testing)
 */
export function resetMetrics(): void {
  pipelineMetrics.total_processed = 0;
  pipelineMetrics.by_category = {
    finance: 0,
    legal: 0,
    pm: 0,
    ea: 0,
    health: 0,
    comms: 0,
    junk: 0,
  };
  pipelineMetrics.by_source = {};
  pipelineMetrics.avg_confidence = 0;
  pipelineMetrics.needs_review_count = 0;
  pipelineMetrics.junk_count = 0;
  pipelineMetrics.routed_count = 0;
  pipelineMetrics.dedupe_hits = 0;
  pipelineMetrics.last_updated = Date.now();
}

/**
 * Clear pipeline logs
 */
export function clearLogs(): void {
  pipelineLogs.length = 0;
}

// ============================================================================
// Helpers
// ============================================================================

function logPipelineAction(params: {
  event_id: string;
  stage: PipelineLog['stage'];
  action: string;
  details: Record<string, any>;
  success: boolean;
  error?: string;
}): void {
  const log: PipelineLog = {
    id: crypto.randomBytes(8).toString('hex'),
    timestamp: Date.now(),
    event_id: params.event_id,
    stage: params.stage,
    action: params.action,
    details: params.details,
    success: params.success,
    error: params.error,
  };

  pipelineLogs.unshift(log);

  // Trim logs
  if (pipelineLogs.length > MAX_LOGS) {
    pipelineLogs.length = MAX_LOGS;
  }
}

function countMatches(text: string, patterns: RegExp[]): number {
  let count = 0;
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

function extractKeywords(text: string, category: ClassificationCategory): string[] {
  const categoryKeywords: Record<ClassificationCategory, string[]> = {
    finance: ['invoice', 'payment', 'expense', 'tax', 'receipt'],
    legal: ['contract', 'agreement', 'legal', 'attorney', 'court'],
    pm: ['project', 'task', 'deadline', 'milestone', 'sprint'],
    ea: ['meeting', 'calendar', 'schedule', 'appointment', 'call'],
    health: ['health', 'wellness', 'recovery', 'workout', 'sleep'],
    comms: ['email', 'message', 'contact', 'follow-up', 'relationship'],
    junk: ['unsubscribe', 'spam', 'promotion', 'offer', 'deal'],
  };

  const keywords = categoryKeywords[category] || [];
  return keywords.filter((kw) => text.toLowerCase().includes(kw));
}
