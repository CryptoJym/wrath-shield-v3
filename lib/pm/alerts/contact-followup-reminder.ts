/**
 * Contact Follow-up Reminder System
 *
 * Proactive alert system that monitors contact interaction patterns and creates
 * reminders BEFORE relationships go cold. Builds on Phase 2B follow-up connector
 * but focuses on REMINDERS vs DETECTION.
 *
 * KEY DIFFERENCES FROM PHASE 2B:
 * - Phase 2B: Detects when follow-ups are needed (reactive)
 * - Phase 3C: Alerts before relationships go cold (proactive)
 *
 * FEATURES:
 * - Tiered contact types (VIP, active deals, regular)
 * - Relationship health assessment (healthy, cooling, cold, dormant)
 * - Severity-based alerts (info, warning, critical)
 * - 48-hour cooldown per contact
 * - VIP-first prioritization
 * - AI-generated outreach suggestions
 *
 * USAGE:
 *   import { generateContactReminders } from '@/lib/pm/alerts/contact-followup-reminder';
 *   const reminders = await generateContactReminders();
 */

import { ensureServerOnly } from '@/lib/server-only-guard';
import { getRelationshipDb, topContacts, listRelationshipSummaries, type ContactRow, type RelationshipSummary } from '@/lib/relationshipDb';
import { listRecentEvents, type EventRow } from '@/lib/events';
import { getFollowupStatus } from '@/lib/pm/connectors/comms-followup-connector';
import type { BackgroundJob, JobResult } from '@/lib/pm/background-jobs';

ensureServerOnly('lib/pm/alerts/contact-followup-reminder');

// ============================================================================
// Types
// ============================================================================

export type ContactType = 'vip' | 'active_deal' | 'regular';
export type RelationshipHealth = 'healthy' | 'cooling' | 'cold' | 'dormant';
export type ReminderSeverity = 'info' | 'warning' | 'critical';

export interface ContactReminderConfig {
  vip_contacts: number;        // Days before reminder for VIP contacts
  active_deals: number;        // Days before reminder for active deals
  regular_contacts: number;    // Days before reminder for regular contacts
  dormant_threshold: number;   // Days before considering dormant
  cooling_percentage: number;  // % of threshold = cooling (0.7 = 70%)
  max_reminders_per_run: number; // Rate limit
  cooldown_hours: number;      // Hours before re-reminding same contact
}

export interface ContactReminder {
  contact_id: string;
  contact_name: string;
  contact_handle: string;
  contact_type: ContactType;
  days_since_contact: number;
  last_interaction: string | null;
  last_interaction_summary: string;
  relationship_health: RelationshipHealth;
  suggested_action: string;
  suggested_message?: string;
  severity: ReminderSeverity;
  threshold_days: number;
  health_percentage: number;
  created_at: number;
}

export interface HealthSummary {
  total_contacts: number;
  by_health: Record<RelationshipHealth, number>;
  by_type: Record<ContactType, number>;
  by_severity: Record<ReminderSeverity, number>;
  vip_needing_attention: number;
  active_deals_at_risk: number;
  dormant_count: number;
  reminders_created: number;
}

interface ReminderTracking {
  contact_id: string;
  contact_type: ContactType;
  relationship_health: RelationshipHealth;
  last_reminder_ts: number | null;
  reminder_count: number;
  last_health_check_ts: number;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: ContactReminderConfig = {
  vip_contacts: 3,           // VIPs: remind after 3 days
  active_deals: 5,           // Active deals: 5 days
  regular_contacts: 14,      // Regular: 14 days
  dormant_threshold: 30,     // Dormant after 30 days
  cooling_percentage: 0.7,   // 70% of threshold = cooling
  max_reminders_per_run: 20, // Max 20 reminders per scan
  cooldown_hours: 48,        // 48-hour cooldown per contact
};

const ACTIVE_DEAL_KEYWORDS = [
  'proposal', 'contract', 'deal', 'negotiation', 'quote',
  'agreement', 'terms', 'pricing', 'budget', 'scope',
];

const VIP_KEYWORDS = [
  'important', 'client', 'partner', 'investor', 'executive',
  'founder', 'ceo', 'cto', 'director', 'vp',
];

// ============================================================================
// Database Schema
// ============================================================================

function ensureReminderTable(): void {
  const db = getRelationshipDb();
  if (!db) {
    console.warn('[ContactReminder] Database not available');
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_reminders (
      contact_id TEXT PRIMARY KEY,
      contact_type TEXT NOT NULL,
      relationship_health TEXT NOT NULL,
      last_reminder_ts INTEGER,
      reminder_count INTEGER DEFAULT 0,
      last_health_check_ts INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      updated_at INTEGER DEFAULT (strftime('%s','now')),

      FOREIGN KEY(contact_id) REFERENCES contacts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_reminder_health ON contact_reminders(relationship_health);
    CREATE INDEX IF NOT EXISTS idx_reminder_type ON contact_reminders(contact_type);
    CREATE INDEX IF NOT EXISTS idx_reminder_last_ts ON contact_reminders(last_reminder_ts DESC);
  `);
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Generate contact follow-up reminders
 */
export async function generateContactReminders(
  config: Partial<ContactReminderConfig> = {}
): Promise<ContactReminder[]> {
  ensureReminderTable();

  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const db = getRelationshipDb();

  if (!db) {
    console.warn('[ContactReminder] Database not available');
    return [];
  }

  const contacts = topContacts(200); // Check top 200 contacts
  const events = listRecentEvents(1000);
  const summaries = listRelationshipSummaries();
  const summaryMap = new Map(summaries.map(s => [s.contact_id, s]));

  const reminders: ContactReminder[] = [];
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);

  console.log(`[ContactReminder] Scanning ${contacts.length} contacts for reminders`);

  for (const contact of contacts) {
    // Skip invalid contacts
    if (!contact.handle || !contact.last_ts) continue;

    // Skip if too few messages (likely one-time contacts)
    if (contact.message_count < 3) continue;

    // Calculate days since last contact
    const daysSinceContact = (now - contact.last_ts * 1000) / (1000 * 60 * 60 * 24);

    // Determine contact type
    const contactType = determineContactType(
      contact,
      events.filter(e => e.contact === contact.handle),
      summaryMap.get(contact.id)
    );

    // Get threshold for this contact type
    const threshold = getThresholdForType(contactType, finalConfig);

    // Assess relationship health
    const healthAssessment = assessRelationshipHealth(
      daysSinceContact,
      threshold,
      finalConfig
    );

    // Update tracking
    updateReminderTracking(contact.id, contactType, healthAssessment.health, nowSec);

    // Skip if relationship is healthy
    if (healthAssessment.health === 'healthy') continue;

    // Check if reminder is due (cooldown)
    const tracking = getReminderTracking(contact.id);
    if (tracking && tracking.last_reminder_ts) {
      const hoursSinceLastReminder = (now - tracking.last_reminder_ts * 1000) / (1000 * 60 * 60);
      if (hoursSinceLastReminder < finalConfig.cooldown_hours) {
        // Still in cooldown
        continue;
      }
    }

    // Check if Phase 2B follow-up already exists
    const existingFollowup = getFollowupStatus(contact.id);
    if (existingFollowup && !Array.isArray(existingFollowup) && !existingFollowup.followup_completed) {
      // Skip - Phase 2B already handling this
      console.log(`[ContactReminder] Skipping ${contact.display_name} - active Phase 2B follow-up exists`);
      continue;
    }

    // Create reminder
    const reminder: ContactReminder = {
      contact_id: contact.id,
      contact_name: contact.display_name || contact.handle,
      contact_handle: contact.handle,
      contact_type: contactType,
      days_since_contact: Math.floor(daysSinceContact * 10) / 10, // Round to 1 decimal
      last_interaction: contact.last_ts ? new Date(contact.last_ts * 1000).toISOString() : null,
      last_interaction_summary: contact.last_text || '',
      relationship_health: healthAssessment.health,
      suggested_action: generateSuggestedAction(contact, contactType, healthAssessment.health, daysSinceContact),
      suggested_message: generateSuggestedMessage(contact, contactType, healthAssessment.health),
      severity: healthAssessment.severity,
      threshold_days: threshold,
      health_percentage: Math.floor(healthAssessment.percentage * 100) / 100, // Round to 2 decimals
      created_at: nowSec,
    };

    reminders.push(reminder);

    // Record reminder sent
    recordReminderSent(contact.id, nowSec);

    // Rate limit check
    if (reminders.length >= finalConfig.max_reminders_per_run) {
      console.log(`[ContactReminder] Rate limit reached (${finalConfig.max_reminders_per_run}), stopping scan`);
      break;
    }
  }

  // Sort by severity (critical first) and contact type (VIP first)
  const sortedReminders = reminders.sort((a, b) => {
    // Critical before warning before info
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }

    // VIP before active_deal before regular
    const typeOrder = { vip: 0, active_deal: 1, regular: 2 };
    return typeOrder[a.contact_type] - typeOrder[b.contact_type];
  });

  console.log(`[ContactReminder] Created ${sortedReminders.length} reminders`);
  console.log(`[ContactReminder] By severity: ${countBySeverity(sortedReminders)}`);
  console.log(`[ContactReminder] By type: ${countByType(sortedReminders)}`);

  return sortedReminders;
}

/**
 * Get VIP contacts needing attention
 */
export async function getVIPContactsNeedingAttention(): Promise<ContactReminder[]> {
  const allReminders = await generateContactReminders();
  return allReminders.filter(r => r.contact_type === 'vip' && r.severity === 'critical');
}

/**
 * Get relationship health summary
 */
export function getRelationshipHealthSummary(): HealthSummary {
  ensureReminderTable();

  const db = getRelationshipDb();
  if (!db) {
    return createEmptySummary();
  }

  const contacts = topContacts(200);
  const trackings = getAllReminderTrackings();

  const summary: HealthSummary = {
    total_contacts: contacts.length,
    by_health: {
      healthy: 0,
      cooling: 0,
      cold: 0,
      dormant: 0,
    },
    by_type: {
      vip: 0,
      active_deal: 0,
      regular: 0,
    },
    by_severity: {
      info: 0,
      warning: 0,
      critical: 0,
    },
    vip_needing_attention: 0,
    active_deals_at_risk: 0,
    dormant_count: 0,
    reminders_created: 0,
  };

  for (const tracking of trackings) {
    summary.by_health[tracking.relationship_health]++;
    summary.by_type[tracking.contact_type]++;

    if (tracking.relationship_health === 'dormant') {
      summary.dormant_count++;
    }

    if (tracking.contact_type === 'vip' && tracking.relationship_health !== 'healthy') {
      summary.vip_needing_attention++;
    }

    if (tracking.contact_type === 'active_deal' && tracking.relationship_health !== 'healthy') {
      summary.active_deals_at_risk++;
    }

    if (tracking.last_reminder_ts) {
      summary.reminders_created++;
    }

    // Map health to severity for counts
    const severity = mapHealthToSeverity(tracking.relationship_health, tracking.contact_type);
    summary.by_severity[severity]++;
  }

  return summary;
}

// ============================================================================
// Contact Type Detection
// ============================================================================

/**
 * Determine contact type (VIP, active deal, or regular)
 */
function determineContactType(
  contact: ContactRow,
  events: EventRow[],
  summary?: RelationshipSummary
): ContactType {
  // Check if VIP
  if (isVIPContact(contact, summary)) {
    return 'vip';
  }

  // Check if active deal
  if (isActiveDeal(contact, events, summary)) {
    return 'active_deal';
  }

  return 'regular';
}

/**
 * Check if contact is VIP
 */
function isVIPContact(contact: ContactRow, summary?: RelationshipSummary): boolean {
  // High message volume
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

  // Check display name for VIP indicators
  if (contact.display_name) {
    const nameLower = contact.display_name.toLowerCase();
    if (VIP_KEYWORDS.some(kw => nameLower.includes(kw))) {
      return true;
    }
  }

  return false;
}

/**
 * Check if contact has active deal
 */
function isActiveDeal(
  contact: ContactRow,
  events: EventRow[],
  summary?: RelationshipSummary
): boolean {
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

  // Must have recent activity (within 30 days)
  if (!contact.last_ts || contact.last_ts * 1000 < thirtyDaysAgo) {
    return false;
  }

  // Check recent messages for deal keywords
  const recentEvents = events
    .filter(e => e.ts * 1000 > thirtyDaysAgo)
    .slice(0, 10); // Last 10 messages

  for (const event of recentEvents) {
    const text = (event.preview || event.subject || '').toLowerCase();
    if (ACTIVE_DEAL_KEYWORDS.some(kw => text.includes(kw))) {
      return true;
    }
  }

  // Check relationship summary
  if (summary?.summary) {
    const summaryLower = summary.summary.toLowerCase();
    if (ACTIVE_DEAL_KEYWORDS.some(kw => summaryLower.includes(kw))) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Health Assessment
// ============================================================================

/**
 * Assess relationship health based on days since contact
 */
function assessRelationshipHealth(
  daysSinceContact: number,
  threshold: number,
  config: ContactReminderConfig
): { health: RelationshipHealth; percentage: number; severity: ReminderSeverity } {
  const percentage = daysSinceContact / threshold;

  if (percentage >= 2.0) {
    // 200%+ = dormant
    return {
      health: 'dormant',
      percentage,
      severity: 'critical',
    };
  } else if (percentage >= 1.0) {
    // 100%+ = cold (threshold exceeded)
    return {
      health: 'cold',
      percentage,
      severity: 'critical',
    };
  } else if (percentage >= config.cooling_percentage) {
    // 70%+ = cooling (approaching threshold)
    return {
      health: 'cooling',
      percentage,
      severity: 'warning',
    };
  } else {
    // < 70% = healthy
    return {
      health: 'healthy',
      percentage,
      severity: 'info',
    };
  }
}

/**
 * Get threshold days for contact type
 */
function getThresholdForType(type: ContactType, config: ContactReminderConfig): number {
  switch (type) {
    case 'vip':
      return config.vip_contacts;
    case 'active_deal':
      return config.active_deals;
    case 'regular':
      return config.regular_contacts;
  }
}

/**
 * Map health to severity (considers contact type)
 */
function mapHealthToSeverity(health: RelationshipHealth, type: ContactType): ReminderSeverity {
  if (health === 'dormant' || health === 'cold') {
    return 'critical';
  }

  if (health === 'cooling') {
    // VIP cooling is critical, others are warning
    return type === 'vip' ? 'critical' : 'warning';
  }

  return 'info';
}

// ============================================================================
// Suggestion Generation
// ============================================================================

/**
 * Generate suggested action text
 */
function generateSuggestedAction(
  contact: ContactRow,
  type: ContactType,
  health: RelationshipHealth,
  daysSince: number
): string {
  const name = contact.display_name || contact.handle;
  const days = Math.floor(daysSince);

  if (health === 'dormant') {
    return `Re-engage dormant ${type === 'vip' ? 'VIP ' : ''}contact ${name} (${days} days inactive)`;
  }

  if (health === 'cold') {
    return `Follow up with ${name} - ${days} days since last contact (threshold exceeded)`;
  }

  if (health === 'cooling') {
    if (type === 'vip') {
      return `VIP ALERT: Check in with ${name} (${days} days, approaching threshold)`;
    }
    if (type === 'active_deal') {
      return `Active deal at risk: Follow up with ${name} (${days} days)`;
    }
    return `Relationship cooling with ${name} (${days} days)`;
  }

  return `Check in with ${name}`;
}

/**
 * Generate suggested outreach message (optional AI template)
 */
function generateSuggestedMessage(
  contact: ContactRow,
  type: ContactType,
  health: RelationshipHealth
): string | undefined {
  const name = contact.display_name?.split(' ')[0] || 'there';

  if (health === 'dormant') {
    return `Hey ${name}! It's been a while since we caught up. How have you been? Would love to hear what you've been working on.`;
  }

  if (health === 'cold') {
    if (type === 'active_deal') {
      return `Hi ${name}, following up on our recent discussion. Do you have any questions or need any additional information from my side?`;
    }
    return `Hi ${name}, wanted to check in and see how things are going. Let me know if there's anything I can help with!`;
  }

  if (health === 'cooling') {
    if (type === 'vip') {
      return `Hi ${name}, hope you're doing well! Wanted to touch base and see if you have time for a quick catch-up this week.`;
    }
    if (type === 'active_deal') {
      return `Hi ${name}, checking in on our discussion. Any updates on your end?`;
    }
    return `Hey ${name}, just wanted to say hi and see how you're doing!`;
  }

  return undefined;
}

// ============================================================================
// Database Tracking
// ============================================================================

/**
 * Update reminder tracking for a contact
 */
function updateReminderTracking(
  contactId: string,
  type: ContactType,
  health: RelationshipHealth,
  nowSec: number
): void {
  const db = getRelationshipDb();
  if (!db) return;

  const stmt = db.prepare(`
    INSERT INTO contact_reminders (
      contact_id,
      contact_type,
      relationship_health,
      last_health_check_ts
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(contact_id) DO UPDATE SET
      contact_type = excluded.contact_type,
      relationship_health = excluded.relationship_health,
      last_health_check_ts = excluded.last_health_check_ts,
      updated_at = strftime('%s', 'now')
  `);

  stmt.run(contactId, type, health, nowSec);
}

/**
 * Record that a reminder was sent
 */
function recordReminderSent(contactId: string, nowSec: number): void {
  const db = getRelationshipDb();
  if (!db) return;

  const stmt = db.prepare(`
    UPDATE contact_reminders
    SET last_reminder_ts = ?,
        reminder_count = reminder_count + 1,
        updated_at = strftime('%s', 'now')
    WHERE contact_id = ?
  `);

  stmt.run(nowSec, contactId);
}

/**
 * Get reminder tracking for a contact
 */
function getReminderTracking(contactId: string): ReminderTracking | null {
  const db = getRelationshipDb();
  if (!db) return null;

  const stmt = db.prepare(`
    SELECT * FROM contact_reminders WHERE contact_id = ?
  `);

  const row = stmt.get(contactId) as any;
  if (!row) return null;

  return {
    contact_id: row.contact_id,
    contact_type: row.contact_type as ContactType,
    relationship_health: row.relationship_health as RelationshipHealth,
    last_reminder_ts: row.last_reminder_ts,
    reminder_count: row.reminder_count,
    last_health_check_ts: row.last_health_check_ts,
  };
}

/**
 * Get all reminder trackings
 */
function getAllReminderTrackings(): ReminderTracking[] {
  const db = getRelationshipDb();
  if (!db) return [];

  const stmt = db.prepare(`
    SELECT * FROM contact_reminders
    ORDER BY last_health_check_ts DESC
  `);

  const rows = stmt.all() as any[];
  return rows.map(row => ({
    contact_id: row.contact_id,
    contact_type: row.contact_type as ContactType,
    relationship_health: row.relationship_health as RelationshipHealth,
    last_reminder_ts: row.last_reminder_ts,
    reminder_count: row.reminder_count,
    last_health_check_ts: row.last_health_check_ts,
  }));
}

// ============================================================================
// Background Job Registration
// ============================================================================

/**
 * Register contact reminder job
 */
export function registerContactReminderJob(): void {
  // Note: This function is for documentation purposes
  // Actual registration happens in lib/pm/background-jobs.ts
  console.log('[ContactReminder] Job registration function called');
}

/**
 * Background job definition (export for use in background-jobs.ts)
 */
export const CONTACT_REMINDER_JOB: BackgroundJob = {
  id: 'contact-followup-reminders',
  name: 'Contact Follow-up Reminders',
  description: 'Alert on contacts needing follow-up before relationships go cold',
  schedule: 'interval',
  interval_minutes: 720, // Every 12 hours
  cooldown_minutes: 720, // 12 hour cooldown
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const startTime = Date.now();

    try {
      const reminders = await generateContactReminders();

      return {
        success: true,
        items_processed: reminders.length,
        items_succeeded: reminders.length,
        items_failed: 0,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        items_processed: 0,
        items_succeeded: 0,
        items_failed: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        duration_ms: Date.now() - startTime,
      };
    }
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

function countBySeverity(reminders: ContactReminder[]): string {
  const counts = { critical: 0, warning: 0, info: 0 };
  reminders.forEach(r => counts[r.severity]++);
  return `critical: ${counts.critical}, warning: ${counts.warning}, info: ${counts.info}`;
}

function countByType(reminders: ContactReminder[]): string {
  const counts = { vip: 0, active_deal: 0, regular: 0 };
  reminders.forEach(r => counts[r.contact_type]++);
  return `vip: ${counts.vip}, active_deal: ${counts.active_deal}, regular: ${counts.regular}`;
}

function createEmptySummary(): HealthSummary {
  return {
    total_contacts: 0,
    by_health: { healthy: 0, cooling: 0, cold: 0, dormant: 0 },
    by_type: { vip: 0, active_deal: 0, regular: 0 },
    by_severity: { info: 0, warning: 0, critical: 0 },
    vip_needing_attention: 0,
    active_deals_at_risk: 0,
    dormant_count: 0,
    reminders_created: 0,
  };
}
