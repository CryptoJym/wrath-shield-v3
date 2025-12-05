/**
 * Inbox Email Connector
 *
 * Bridges the Inbox agent and PM agent by:
 * 1. Processing emails from the events table
 * 2. Extracting action items from email content
 * 3. Creating task signals for the PM queue
 * 4. Handling email-to-task conversion with context preservation
 *
 * Integrates with:
 * - lib/events.ts (email storage)
 * - lib/pm/task-queue.ts (signal ingestion)
 * - lib/comms/pipeline.ts (classification)
 */

import { ensureServerOnly } from '../../server-only-guard';
import { listRecentEvents, type EventRow } from '../../events';
import { enqueueSignal, type IncomingSignal } from '../task-queue';
import { randomBytes } from 'crypto';

ensureServerOnly('lib/pm/connectors/inbox-email-connector');

// ============================================================================
// Types
// ============================================================================

export interface ActionItem {
  action: string;
  confidence: number;
  keywords: string[];
  context: string;
}

export interface EmailAnalysis {
  has_action: boolean;
  action_items: ActionItem[];
  deadline?: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  urgency_indicators: string[];
  is_reply: boolean;
  is_forward: boolean;
  has_attachment: boolean;
  thread_context?: string;
}

export interface TaskSignal extends IncomingSignal {
  payload: {
    email_id: string;
    subject: string;
    sender: string;
    action_item: string;
    full_context: string;
    urgency_indicators: string[];
    deadline?: string;
    thread_id?: string;
    classification?: string;
    is_reply?: boolean;
    is_forward?: boolean;
    attachment_count?: number;
  };
}

export interface SyncResult {
  processed: number;
  signals_created: number;
  skipped_duplicate: number;
  skipped_no_action: number;
  errors: number;
  error_details: string[];
}

// ============================================================================
// Action Item Detection Patterns
// ============================================================================

// High confidence patterns (0.85-0.95)
const HIGH_CONFIDENCE_PATTERNS = [
  /please\s+(?:can\s+you\s+)?(\w+)/gi,
  /can\s+you\s+(?:please\s+)?(\w+)/gi,
  /could\s+you\s+(?:please\s+)?(\w+)/gi,
  /would\s+you\s+(?:please\s+|mind\s+)?(\w+)/gi,
  /i\s+need\s+you\s+to\s+(\w+)/gi,
  /action\s+required:?\s*(.+)/gi,
  /todo:?\s*(.+)/gi,
  /action\s+item:?\s*(.+)/gi,
];

// Medium confidence patterns (0.6-0.8)
const MEDIUM_CONFIDENCE_PATTERNS = [
  /let\s+me\s+know\s+(?:when|if|about)\s+(.+)/gi,
  /send\s+me\s+(.+)/gi,
  /update\s+me\s+(?:on|about)\s+(.+)/gi,
  /follow\s+up\s+(?:with|on)\s+(.+)/gi,
  /reminder:?\s*(.+)/gi,
  /\?\s*$/gm, // Questions
];

// Low confidence patterns (0.4-0.6)
const LOW_CONFIDENCE_PATTERNS = [
  /fyi:?\s*(.+)/gi,
  /should\s+(?:we|you|i)\s+(\w+)/gi,
  /might\s+want\s+to\s+(\w+)/gi,
  /consider\s+(\w+ing)/gi,
];

// Deadline indicators
const DEADLINE_PATTERNS = [
  /(?:by|due|deadline:?)\s+([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/gi,
  /(?:by|due|deadline:?)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/gi,
  /(?:by|due|deadline:?)\s+(tomorrow|today|tonight|eod|eow)/gi,
  /(?:by|due)\s+(?:the\s+)?end\s+of\s+(day|week|month)/gi,
  /asap/gi,
];

// Urgency keywords
const URGENT_KEYWORDS = [
  'urgent', 'asap', 'critical', 'important', 'priority',
  'time-sensitive', 'immediate', 'emergency', 'deadline',
  'rush', 'expedite', 'high priority'
];

// Action verbs
const ACTION_VERBS = [
  'review', 'approve', 'send', 'update', 'schedule', 'confirm',
  'respond', 'reply', 'follow up', 'check', 'verify', 'complete',
  'finish', 'submit', 'prepare', 'create', 'draft', 'revise'
];

// ============================================================================
// Email Processing
// ============================================================================

/**
 * Process a single email and create task signals
 */
export async function processEmail(email: EventRow): Promise<TaskSignal[]> {
  try {
    // Validate email is actionable
    if (email.channel !== 'email') {
      return [];
    }

    // Skip junk
    if (email.junk === 1) {
      return [];
    }

    // Skip already routed
    if (email.routed_target && email.routed_target !== 'pm') {
      return [];
    }

    // Analyze email for action items
    const analysis = analyzeEmail(email);

    if (!analysis.has_action || analysis.action_items.length === 0) {
      return [];
    }

    // Create signals for each action item
    const signals: TaskSignal[] = [];

    for (const item of analysis.action_items) {
      const signal = createTaskSignal(email, item, analysis);
      signals.push(signal);

      // Enqueue to PM queue
      await enqueueSignal(signal);
    }

    return signals;
  } catch (error) {
    console.error(`[Inbox Connector] Error processing email ${email.id}:`, error);
    return [];
  }
}

/**
 * Batch process inbox emails since a given date
 */
export async function syncInbox(since: Date): Promise<SyncResult> {
  const result: SyncResult = {
    processed: 0,
    signals_created: 0,
    skipped_duplicate: 0,
    skipped_no_action: 0,
    errors: 0,
    error_details: [],
  };

  try {
    // Get recent emails from events table
    const sinceTs = Math.floor(since.getTime() / 1000);
    const events = await listRecentEvents(1000); // Get last 1000 events

    // Filter for emails after since date
    const emails = events.filter(e =>
      e.channel === 'email' &&
      e.ts >= sinceTs &&
      e.junk !== 1
    );

    // Process each email
    for (const email of emails) {
      result.processed++;

      try {
        const signals = await processEmail(email);

        if (signals.length === 0) {
          result.skipped_no_action++;
        } else {
          result.signals_created += signals.length;
        }
      } catch (error) {
        result.errors++;
        result.error_details.push(`${email.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`[Inbox Connector] Sync complete:`, result);
    return result;
  } catch (error) {
    console.error('[Inbox Connector] Sync failed:', error);
    result.errors++;
    result.error_details.push(error instanceof Error ? error.message : String(error));
    return result;
  }
}

/**
 * Extract action items from email body using pattern matching
 */
export function extractActionItems(body: string): ActionItem[] {
  if (!body) return [];

  const items: ActionItem[] = [];
  const seenActions = new Set<string>();

  // High confidence patterns
  for (const pattern of HIGH_CONFIDENCE_PATTERNS) {
    const matches = Array.from(body.matchAll(pattern));
    for (const match of matches) {
      const action = cleanActionText(match[0]);
      if (action && !seenActions.has(action.toLowerCase())) {
        items.push({
          action,
          confidence: 0.9,
          keywords: extractKeywords(match[0]),
          context: getContext(body, match.index || 0),
        });
        seenActions.add(action.toLowerCase());
      }
    }
  }

  // Medium confidence patterns
  for (const pattern of MEDIUM_CONFIDENCE_PATTERNS) {
    const matches = Array.from(body.matchAll(pattern));
    for (const match of matches) {
      const action = cleanActionText(match[0]);
      if (action && !seenActions.has(action.toLowerCase())) {
        items.push({
          action,
          confidence: 0.7,
          keywords: extractKeywords(match[0]),
          context: getContext(body, match.index || 0),
        });
        seenActions.add(action.toLowerCase());
      }
    }
  }

  // Low confidence patterns
  for (const pattern of LOW_CONFIDENCE_PATTERNS) {
    const matches = Array.from(body.matchAll(pattern));
    for (const match of matches) {
      const action = cleanActionText(match[0]);
      if (action && !seenActions.has(action.toLowerCase())) {
        items.push({
          action,
          confidence: 0.5,
          keywords: extractKeywords(match[0]),
          context: getContext(body, match.index || 0),
        });
        seenActions.add(action.toLowerCase());
      }
    }
  }

  return items;
}

/**
 * Detect deadline from email text
 */
export function detectDeadline(text: string): string | null {
  if (!text) return null;

  for (const pattern of DEADLINE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const dateStr = match[1]?.toLowerCase();
      if (!dateStr) continue;

      // Handle relative dates
      const now = new Date();
      if (dateStr === 'today' || dateStr === 'tonight' || dateStr === 'eod') {
        return now.toISOString().split('T')[0];
      }
      if (dateStr === 'tomorrow') {
        now.setDate(now.getDate() + 1);
        return now.toISOString().split('T')[0];
      }
      if (dateStr === 'eow') {
        const day = now.getDay();
        const diff = 5 - day; // Friday
        now.setDate(now.getDate() + diff);
        return now.toISOString().split('T')[0];
      }

      // Try to parse date string
      try {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      } catch {
        // Continue to next pattern
      }
    }
  }

  return null;
}

/**
 * Determine urgency level from email signals
 */
export function inferUrgency(email: EventRow, analysis?: EmailAnalysis): 'critical' | 'high' | 'medium' | 'low' {
  let score = 0;

  // Deadline presence
  if (analysis?.deadline) score += 30;

  // Urgent keywords in subject/body
  const text = `${email.subject || ''} ${email.preview || ''}`.toLowerCase();
  for (const keyword of URGENT_KEYWORDS) {
    if (text.includes(keyword)) {
      score += 25;
      break;
    }
  }

  // Flagged status
  if (email.flagged === 1) score += 30;

  // High confidence classification
  if (email.classification === 'legal') score += 25;
  if (email.classification === 'finance' && email.confidence && email.confidence > 0.8) score += 15;

  // Reply-all or direct
  const metadata = typeof email.metadata === 'string' ? JSON.parse(email.metadata) : email.metadata;
  if (metadata?.reply_all) score += 10;
  if (metadata?.direct_to) score += 10;

  // Action strength
  if (analysis?.action_items?.length) {
    const maxConfidence = Math.max(...analysis.action_items.map(a => a.confidence));
    if (maxConfidence > 0.85) score += 15;
  }

  if (score >= 60) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

// ============================================================================
// Analysis
// ============================================================================

/**
 * Analyze email for actionable content
 */
function analyzeEmail(email: EventRow): EmailAnalysis {
  const subject = email.subject || '';
  const body = email.preview || '';
  const fullText = `${subject}\n${body}`;

  // Extract action items
  const action_items = extractActionItems(fullText);

  // Detect deadline
  const deadline = detectDeadline(fullText);

  // Check for urgency indicators
  const urgency_indicators: string[] = [];
  for (const keyword of URGENT_KEYWORDS) {
    if (fullText.toLowerCase().includes(keyword)) {
      urgency_indicators.push(keyword);
    }
  }

  // Check metadata
  const metadata = typeof email.metadata === 'string' ? JSON.parse(email.metadata) : (email.metadata || {});
  const is_reply = !!metadata.in_reply_to || subject.toLowerCase().startsWith('re:');
  const is_forward = subject.toLowerCase().startsWith('fwd:') || subject.toLowerCase().startsWith('fw:');
  const has_attachment = !!(metadata.attachments && metadata.attachments.length > 0);

  const analysis: EmailAnalysis = {
    has_action: action_items.length > 0,
    action_items,
    deadline,
    urgency: 'medium', // Will be calculated
    urgency_indicators,
    is_reply,
    is_forward,
    has_attachment,
  };

  // Calculate urgency
  analysis.urgency = inferUrgency(email, analysis);

  return analysis;
}

/**
 * Create task signal from email and action item
 */
function createTaskSignal(email: EventRow, item: ActionItem, analysis: EmailAnalysis): TaskSignal {
  const metadata = typeof email.metadata === 'string' ? JSON.parse(email.metadata) : (email.metadata || {});

  return {
    id: `inbox-email-${email.id}-${randomBytes(4).toString('hex')}`,
    source: 'inbox',
    signal_type: 'task',
    payload: {
      email_id: email.id,
      subject: email.subject || '(no subject)',
      sender: email.contact || 'unknown',
      action_item: item.action,
      full_context: `${email.subject || ''}\n\n${email.preview || ''}`,
      urgency_indicators: analysis.urgency_indicators,
      deadline: analysis.deadline,
      thread_id: metadata.thread_id,
      classification: email.classification || undefined,
      is_reply: analysis.is_reply,
      is_forward: analysis.is_forward,
      attachment_count: metadata.attachments?.length || 0,
    },
    timestamp: email.ts * 1000, // Convert to ms
    confidence: item.confidence,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Clean action text for display
 */
function cleanActionText(text: string): string {
  return text
    .replace(/^(please|can you|could you|would you|i need you to|todo:?|action item:?|action required:?)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200); // Max 200 chars
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/);
  const keywords: string[] = [];

  for (const verb of ACTION_VERBS) {
    if (words.some(w => w.includes(verb))) {
      keywords.push(verb);
    }
  }

  for (const urgent of URGENT_KEYWORDS) {
    if (words.some(w => w.includes(urgent))) {
      keywords.push(urgent);
    }
  }

  return Array.from(new Set(keywords));
}

/**
 * Get surrounding context for an action item
 */
function getContext(body: string, matchIndex: number, contextLength: number = 100): string {
  const start = Math.max(0, matchIndex - contextLength);
  const end = Math.min(body.length, matchIndex + contextLength);
  return body.slice(start, end).trim();
}

// ============================================================================
// Exports
// ============================================================================

export default {
  processEmail,
  syncInbox,
  extractActionItems,
  detectDeadline,
  inferUrgency,
};
