/**
 * Comms Follow-up Connector
 *
 * Monitors contact interactions from the Comms agent and creates
 * follow-up reminder signals for the PM queue.
 *
 * TRIGGER SCENARIOS:
 * 1. No response after outbound message (3 days normal, 1 day VIP)
 * 2. Promised callback detection ("I'll get back to you")
 * 3. Scheduled check-ins from relationship summaries
 * 4. VIP contact staleness (7 days no interaction)
 * 5. Unanswered questions (2 days)
 *
 * USAGE:
 *   import { scanContactsForFollowups } from '@/lib/pm/connectors/comms-followup-connector';
 *   const signals = await scanContactsForFollowups();
 */

import { ensureServerOnly } from '@/lib/server-only-guard';
import { enqueueSignal, type IncomingSignal } from '@/lib/pm/task-queue';
import { getRelationshipDb, topContacts, listRelationshipSummaries, type ContactRow, type RelationshipSummary } from '@/lib/relationshipDb';
import { listRecentEvents, type EventRow } from '@/lib/events';
import crypto from 'crypto';

ensureServerOnly('lib/pm/connectors/comms-followup-connector');

// ============================================================================
// Types
// ============================================================================

export type FollowupReason =
  | 'no_response'
  | 'promised_callback'
  | 'scheduled'
  | 'vip_stale'
  | 'unanswered_question';

export interface FollowupSignal {
  signal: IncomingSignal;
  contact: ContactRow;
  reason: FollowupReason;
}

export interface FollowupStatus {
  contact_id: string;
  contact_name: string | null;
  last_followup_signal_id: string | null;
  last_followup_ts: number | null;
  last_interaction_ts: number | null;
  followup_reason: FollowupReason | null;
  followup_completed: boolean;
  completed_at: number | null;
}

interface FollowupDetection {
  shouldFollowup: boolean;
  reason: FollowupReason | null;
  suggestedAction: string;
  confidence: number;
  daysSinceLast: number;
  isVIP: boolean;
  lastInteractionPreview: string;
}

// ============================================================================
// Configuration
// ============================================================================

const FOLLOWUP_THRESHOLDS = {
  no_response_normal: 3, // days
  no_response_vip: 1,
  promised_callback: 2,
  unanswered_question: 2,
  vip_staleness: 7,
  scheduled_checkin: 7,
};

const FOLLOWUP_COOLDOWN_HOURS = 24;

const CALLBACK_PATTERNS = [
  /i'?ll\s+(get|reach)\s+back/i,
  /will\s+follow\s+up/i,
  /let\s+me\s+check/i,
  /get\s+back\s+to\s+you/i,
  /circle\s+back/i,
  /touch\s+base/i,
];

const VIP_KEYWORDS = ['important', 'client', 'partner', 'investor', 'executive', 'founder'];

// ============================================================================
// Database Schema
// ============================================================================

function ensureFollowupTable(): void {
  const db = getRelationshipDb();
  if (!db) {
    console.warn('[FollowupConnector] Database not available');
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS followup_tracking (
      contact_id TEXT PRIMARY KEY,
      last_followup_signal_id TEXT,
      last_followup_ts INTEGER,
      last_interaction_ts INTEGER,
      followup_reason TEXT,
      followup_completed INTEGER DEFAULT 0,
      completed_at INTEGER,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_followup_completed ON followup_tracking(followup_completed);
    CREATE INDEX IF NOT EXISTS idx_followup_ts ON followup_tracking(last_followup_ts DESC);
  `);
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Scan all contacts and create follow-up signals where needed
 */
export async function scanContactsForFollowups(): Promise<FollowupSignal[]> {
  ensureFollowupTable();

  const db = getRelationshipDb();
  if (!db) {
    console.warn('[FollowupConnector] Database not available');
    return [];
  }

  const contacts = topContacts(200); // Check top 200 contacts
  const events = listRecentEvents(1000); // Get recent events for context
  const summaries = listRelationshipSummaries();
  const summaryMap = new Map(summaries.map(s => [s.contact_id, s]));

  const followupSignals: FollowupSignal[] = [];

  console.log(`[FollowupConnector] Scanning ${contacts.length} contacts for follow-ups`);

  for (const contact of contacts) {
    // Skip if no handle (invalid contact)
    if (!contact.handle) continue;

    // Check if already has active follow-up
    const existing = getFollowupStatus(contact.id);
    if (existing && !Array.isArray(existing) && !existing.followup_completed) {
      const cooldownMs = FOLLOWUP_COOLDOWN_HOURS * 60 * 60 * 1000;
      const timeSinceLastFollowup = Date.now() - (existing.last_followup_ts || 0) * 1000;

      if (timeSinceLastFollowup < cooldownMs) {
        // Still in cooldown period
        continue;
      }
    }

    // Get contact's recent events
    const contactEvents = events.filter(e =>
      e.contact === contact.handle ||
      e.contact === contact.display_name ||
      e.contact === contact.canonical_handle
    );

    // Detect if follow-up is needed
    const detection = detectFollowupReason(contact, contactEvents, summaryMap.get(contact.id));

    if (detection.shouldFollowup && detection.reason) {
      // Create signal
      const signal = await createFollowupSignal(contact, detection);

      if (signal) {
        followupSignals.push({
          signal: signal.incomingSignal,
          contact,
          reason: detection.reason,
        });

        // Track in database
        trackFollowup(contact.id, signal.incomingSignal.id, detection.reason, contact.last_ts || 0);

        console.log(`[FollowupConnector] Created follow-up signal for ${contact.display_name || contact.handle}: ${detection.reason}`);
      }
    }
  }

  console.log(`[FollowupConnector] Created ${followupSignals.length} follow-up signals`);
  return followupSignals;
}

/**
 * Process a contact interaction (clears follow-up if exists)
 */
export async function processContactInteraction(interaction: {
  contact_id?: string;
  contact_handle?: string;
  event_id: string;
}): Promise<void> {
  ensureFollowupTable();

  const db = getRelationshipDb();
  if (!db) return;

  // Try to find contact
  let contactId = interaction.contact_id;
  if (!contactId && interaction.contact_handle) {
    const stmt = db.prepare('SELECT id FROM contacts WHERE handle = ? OR canonical_handle = ?');
    const row = stmt.get(interaction.contact_handle, interaction.contact_handle) as { id: string } | undefined;
    if (row) contactId = row.id;
  }

  if (!contactId) return;

  // Check if follow-up exists
  const existing = getFollowupStatus(contactId);
  if (existing && !Array.isArray(existing) && !existing.followup_completed) {
    // Mark as complete
    await markFollowupComplete(contactId, 'Auto-cleared: contact responded');
    console.log(`[FollowupConnector] Auto-cleared follow-up for contact ${contactId}`);
  }
}

/**
 * Manually mark a follow-up as complete
 */
export async function markFollowupComplete(contactId: string, notes?: string): Promise<void> {
  ensureFollowupTable();

  const db = getRelationshipDb();
  if (!db) return;

  const now = Math.floor(Date.now() / 1000);

  const stmt = db.prepare(`
    UPDATE followup_tracking
    SET followup_completed = 1,
        completed_at = ?,
        notes = ?
    WHERE contact_id = ?
  `);

  stmt.run(now, notes || null, contactId);
  console.log(`[FollowupConnector] Marked follow-up complete for ${contactId}`);
}

/**
 * Get follow-up status for a contact
 */
export function getFollowupStatus(contactId?: string): FollowupStatus | FollowupStatus[] | null {
  ensureFollowupTable();

  const db = getRelationshipDb();
  if (!db) return null;

  if (contactId) {
    // Get specific contact
    const stmt = db.prepare(`
      SELECT ft.*, c.display_name as contact_name
      FROM followup_tracking ft
      LEFT JOIN contacts c ON ft.contact_id = c.id
      WHERE ft.contact_id = ?
    `);
    const row = stmt.get(contactId) as any;

    if (!row) return null;

    return {
      contact_id: row.contact_id,
      contact_name: row.contact_name,
      last_followup_signal_id: row.last_followup_signal_id,
      last_followup_ts: row.last_followup_ts,
      last_interaction_ts: row.last_interaction_ts,
      followup_reason: row.followup_reason as FollowupReason,
      followup_completed: Boolean(row.followup_completed),
      completed_at: row.completed_at,
    };
  }

  // Get all pending follow-ups
  const stmt = db.prepare(`
    SELECT ft.*, c.display_name as contact_name
    FROM followup_tracking ft
    LEFT JOIN contacts c ON ft.contact_id = c.id
    WHERE ft.followup_completed = 0
    ORDER BY ft.last_followup_ts DESC
  `);

  const rows = stmt.all() as any[];
  return rows.map(row => ({
    contact_id: row.contact_id,
    contact_name: row.contact_name,
    last_followup_signal_id: row.last_followup_signal_id,
    last_followup_ts: row.last_followup_ts,
    last_interaction_ts: row.last_interaction_ts,
    followup_reason: row.followup_reason as FollowupReason,
    followup_completed: Boolean(row.followup_completed),
    completed_at: row.completed_at,
  }));
}

// ============================================================================
// Detection Logic
// ============================================================================

/**
 * Detect if contact needs follow-up and why
 */
function detectFollowupReason(
  contact: ContactRow,
  events: EventRow[],
  summary?: RelationshipSummary
): FollowupDetection {
  const now = Date.now();
  const lastTs = contact.last_ts ? contact.last_ts * 1000 : 0;
  const daysSinceLast = (now - lastTs) / (1000 * 60 * 60 * 24);

  const isVIP = isVIPContact(contact, summary);
  const lastPreview = contact.last_text || '';

  // Sort events by timestamp
  const sortedEvents = events.sort((a, b) => b.ts - a.ts);

  // 1. Check for unanswered questions
  if (sortedEvents.length > 0) {
    const lastEvent = sortedEvents[0];
    if (lastEvent.direction === 'sent' && (lastEvent.preview || lastEvent.subject || '').includes('?')) {
      if (daysSinceLast >= FOLLOWUP_THRESHOLDS.unanswered_question) {
        return {
          shouldFollowup: true,
          reason: 'unanswered_question',
          suggestedAction: 'Follow up on unanswered question',
          confidence: 0.9,
          daysSinceLast,
          isVIP,
          lastInteractionPreview: lastPreview,
        };
      }
    }
  }

  // 2. Check for promised callback
  for (const pattern of CALLBACK_PATTERNS) {
    if (pattern.test(lastPreview)) {
      if (daysSinceLast >= FOLLOWUP_THRESHOLDS.promised_callback) {
        return {
          shouldFollowup: true,
          reason: 'promised_callback',
          suggestedAction: 'Check in on promised callback',
          confidence: 0.85,
          daysSinceLast,
          isVIP,
          lastInteractionPreview: lastPreview,
        };
      }
    }
  }

  // 3. Check for no response after outbound message
  if (sortedEvents.length > 0) {
    const lastSent = sortedEvents.find(e => e.direction === 'sent');
    const lastReceived = sortedEvents.find(e => e.direction === 'received');

    if (lastSent && (!lastReceived || lastSent.ts > lastReceived.ts)) {
      const threshold = isVIP ? FOLLOWUP_THRESHOLDS.no_response_vip : FOLLOWUP_THRESHOLDS.no_response_normal;
      const timeSinceSent = (now - lastSent.ts * 1000) / (1000 * 60 * 60 * 24);

      if (timeSinceSent >= threshold) {
        return {
          shouldFollowup: true,
          reason: 'no_response',
          suggestedAction: `No response to last message (${Math.floor(timeSinceSent)} days ago)`,
          confidence: isVIP ? 0.9 : 0.75,
          daysSinceLast,
          isVIP,
          lastInteractionPreview: lastPreview,
        };
      }
    }
  }

  // 4. Check for VIP staleness
  if (isVIP && daysSinceLast >= FOLLOWUP_THRESHOLDS.vip_staleness) {
    return {
      shouldFollowup: true,
      reason: 'vip_stale',
      suggestedAction: `Check in with VIP contact (${Math.floor(daysSinceLast)} days since last interaction)`,
      confidence: 0.8,
      daysSinceLast,
      isVIP,
      lastInteractionPreview: lastPreview,
    };
  }

  // 5. Check for scheduled check-in from summary
  if (summary?.suggested_follow_up) {
    const followupText = summary.suggested_follow_up.toLowerCase();

    // Parse for time indicators
    const hasTimeIndicator = /soon|this week|next week|\d+\s+days?/i.test(followupText);

    if (hasTimeIndicator && daysSinceLast >= FOLLOWUP_THRESHOLDS.scheduled_checkin) {
      return {
        shouldFollowup: true,
        reason: 'scheduled',
        suggestedAction: summary.suggested_follow_up,
        confidence: 0.75,
        daysSinceLast,
        isVIP,
        lastInteractionPreview: lastPreview,
      };
    }
  }

  // No follow-up needed
  return {
    shouldFollowup: false,
    reason: null,
    suggestedAction: '',
    confidence: 0,
    daysSinceLast,
    isVIP,
    lastInteractionPreview: lastPreview,
  };
}

/**
 * Determine if contact is VIP
 */
function isVIPContact(contact: ContactRow, summary?: RelationshipSummary): boolean {
  // Check if manually flagged as VIP
  // (Would need to add vip column to contacts table in future)

  // Check message frequency (top 10% = VIP)
  if (contact.message_count >= 50) {
    return true;
  }

  // Check relationship summary for VIP keywords
  if (summary?.summary) {
    const summaryLower = summary.summary.toLowerCase();
    if (VIP_KEYWORDS.some(kw => summaryLower.includes(kw))) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Signal Creation
// ============================================================================

/**
 * Create follow-up signal and enqueue it
 */
async function createFollowupSignal(
  contact: ContactRow,
  detection: FollowupDetection
): Promise<{ incomingSignal: IncomingSignal; queueId: string } | null> {
  const signalId = `comms-followup-${contact.id}-${Date.now()}`;

  const signal: IncomingSignal = {
    id: signalId,
    source: 'comms',
    signal_type: 'follow_up',
    payload: {
      contact_id: contact.id,
      contact_name: contact.display_name || contact.handle,
      contact_handle: contact.handle,
      last_interaction: contact.last_ts ? new Date(contact.last_ts * 1000).toISOString() : null,
      last_interaction_preview: detection.lastInteractionPreview,
      follow_up_reason: detection.reason,
      suggested_action: detection.suggestedAction,
      days_since_last: Math.floor(detection.daysSinceLast),
      is_vip: detection.isVIP,
      importance: detection.isVIP || detection.reason === 'unanswered_question' || detection.reason === 'promised_callback'
        ? 'high'
        : 'normal',
    },
    timestamp: Date.now(),
    confidence: detection.confidence,
  };

  try {
    const queueId = await enqueueSignal(signal);
    console.log(`[FollowupConnector] Enqueued signal ${signalId} as ${queueId}`);
    return { incomingSignal: signal, queueId };
  } catch (error) {
    console.error(`[FollowupConnector] Failed to enqueue signal:`, error);
    return null;
  }
}

/**
 * Track follow-up in database
 */
function trackFollowup(
  contactId: string,
  signalId: string,
  reason: FollowupReason,
  lastInteractionTs: number
): void {
  const db = getRelationshipDb();
  if (!db) return;

  const now = Math.floor(Date.now() / 1000);

  const stmt = db.prepare(`
    INSERT INTO followup_tracking (
      contact_id,
      last_followup_signal_id,
      last_followup_ts,
      last_interaction_ts,
      followup_reason,
      followup_completed
    ) VALUES (?, ?, ?, ?, ?, 0)
    ON CONFLICT(contact_id) DO UPDATE SET
      last_followup_signal_id = excluded.last_followup_signal_id,
      last_followup_ts = excluded.last_followup_ts,
      last_interaction_ts = excluded.last_interaction_ts,
      followup_reason = excluded.followup_reason,
      followup_completed = 0,
      completed_at = NULL
  `);

  stmt.run(contactId, signalId, now, lastInteractionTs, reason);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get summary of follow-up activity
 */
export function getFollowupSummary(): {
  total_pending: number;
  by_reason: Record<FollowupReason, number>;
  vip_count: number;
  oldest_pending?: FollowupStatus;
} {
  const pending = getFollowupStatus() as FollowupStatus[];

  if (!Array.isArray(pending)) {
    return {
      total_pending: 0,
      by_reason: {
        no_response: 0,
        promised_callback: 0,
        scheduled: 0,
        vip_stale: 0,
        unanswered_question: 0,
      },
      vip_count: 0,
    };
  }

  const byReason: Record<string, number> = {};
  let vipCount = 0;

  for (const item of pending) {
    if (item.followup_reason) {
      byReason[item.followup_reason] = (byReason[item.followup_reason] || 0) + 1;
    }

    // Check if VIP (would need to join with contacts table)
    // For now, count VIP by reason type
    if (item.followup_reason === 'vip_stale') {
      vipCount++;
    }
  }

  const oldest = pending.sort((a, b) => (a.last_followup_ts || 0) - (b.last_followup_ts || 0))[0];

  return {
    total_pending: pending.length,
    by_reason: byReason as Record<FollowupReason, number>,
    vip_count: vipCount,
    oldest_pending: oldest,
  };
}
