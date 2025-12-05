/**
 * PM Memory Bootstrap System
 *
 * Seeds initial triage patterns and organizational knowledge into Zep
 * to bootstrap the AI learning loop. Without historical data, the AI
 * makes decisions in a vacuum. This provides foundational patterns.
 *
 * Categories:
 * - Triage patterns: How to route different signal types
 * - Escalation patterns: When to escalate vs auto-execute
 * - Domain patterns: Project and domain-specific rules
 * - Correction examples: Past mistakes to learn from
 */

import { ensureServerOnly } from '../server-only-guard';
import { addPMMemory } from './pm-memory';
import { getLifeCharter, getDomains, getMappings } from '../life-os-config';

ensureServerOnly('lib/pm/bootstrap-memory');

// ============================================================================
// Types
// ============================================================================

export interface BootstrapPattern {
  id: string;
  category: 'triage' | 'pattern' | 'rule' | 'decision';
  text: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Core Triage Patterns
// ============================================================================

const TRIAGE_PATTERNS: BootstrapPattern[] = [
  // === LEGAL SIGNALS ===
  {
    id: 'legal-deadline-critical',
    category: 'pattern',
    text: 'Triage pattern: Signals from legal source with deadline type should ALWAYS be action=local_task, escalation=critical, priority=critical. Legal deadlines are non-negotiable and require immediate attention.',
    metadata: {
      source: 'legal',
      signal_type: 'deadline',
      recommended_action: 'local_task',
      recommended_escalation: 'critical',
      recommended_priority: 'critical',
    },
  },
  {
    id: 'legal-threat-escalate',
    category: 'pattern',
    text: 'Triage pattern: Any signal containing "lawsuit", "legal threat", "litigation", or "court" should escalate immediately. action=escalate, escalation=critical. These require human attention regardless of source.',
    metadata: {
      keywords: ['lawsuit', 'legal threat', 'litigation', 'court', 'subpoena'],
      recommended_action: 'escalate',
      recommended_escalation: 'critical',
    },
  },
  {
    id: 'fcra-compliance',
    category: 'pattern',
    text: 'Triage pattern: FCRA compliance signals are always critical. Fair Credit Reporting Act violations can result in statutory damages. action=local_task, escalation=critical, priority=critical.',
    metadata: {
      keywords: ['fcra', 'fair credit', 'background check', 'consumer report'],
      recommended_action: 'local_task',
      recommended_escalation: 'critical',
      recommended_priority: 'critical',
    },
  },

  // === SECURITY SIGNALS ===
  {
    id: 'security-breach-critical',
    category: 'pattern',
    text: 'Triage pattern: Security breach signals from any source require immediate escalation. Keywords: "breach", "hack", "compromised", "vulnerability", "exploit". action=escalate, escalation=critical.',
    metadata: {
      keywords: ['security breach', 'hack', 'compromised', 'vulnerability', 'exploit', 'unauthorized access'],
      recommended_action: 'escalate',
      recommended_escalation: 'critical',
    },
  },

  // === GITHUB SIGNALS ===
  {
    id: 'github-issue-opened',
    category: 'pattern',
    text: 'Triage pattern: New GitHub issues (action=opened) should sync to local task tracking. action=local_task, escalation=auto. These are already tracked in GitHub, local copy is for unified view.',
    metadata: {
      source: 'github',
      signal_type: 'task',
      payload_action: 'opened',
      recommended_action: 'local_task',
      recommended_escalation: 'auto',
    },
  },
  {
    id: 'github-mention-high',
    category: 'pattern',
    text: 'Triage pattern: High-confidence GitHub mentions (confidence > 0.8) often indicate someone needs response. action=github_issue, escalation=propose. Let human decide if action needed.',
    metadata: {
      source: 'github',
      signal_type: 'mention',
      confidence_threshold: 0.8,
      recommended_action: 'github_issue',
      recommended_escalation: 'propose',
    },
  },
  {
    id: 'github-security-alert',
    category: 'pattern',
    text: 'Triage pattern: GitHub security alerts (dependabot, secret scanning) should be escalated. action=escalate, escalation=critical. Security vulnerabilities need immediate attention.',
    metadata: {
      source: 'github',
      signal_type: 'security_alert',
      recommended_action: 'escalate',
      recommended_escalation: 'critical',
    },
  },

  // === COMMS SIGNALS ===
  {
    id: 'comms-follow-up-high',
    category: 'pattern',
    text: 'Triage pattern: High-importance comms follow-ups (importance=high) need proposal. action=local_task, escalation=propose. Important contacts deserve thoughtful response.',
    metadata: {
      source: 'comms',
      signal_type: 'follow_up',
      importance: 'high',
      recommended_action: 'local_task',
      recommended_escalation: 'propose',
    },
  },
  {
    id: 'comms-client-urgent',
    category: 'pattern',
    text: 'Triage pattern: Client communications marked urgent should be prioritized. action=local_task, escalation=propose, priority=high. Client relationships are business-critical.',
    metadata: {
      source: 'comms',
      keywords: ['client', 'customer', 'urgent'],
      recommended_action: 'local_task',
      recommended_escalation: 'propose',
      recommended_priority: 'high',
    },
  },

  // === INBOX SIGNALS ===
  {
    id: 'inbox-meeting-action',
    category: 'pattern',
    text: 'Triage pattern: Action items extracted from meetings (has meeting_id) need proposal. action=local_task, escalation=propose, priority=high. Meeting commitments should be honored.',
    metadata: {
      source: 'inbox',
      signal_type: 'task',
      has_meeting_id: true,
      recommended_action: 'local_task',
      recommended_escalation: 'propose',
      recommended_priority: 'high',
    },
  },
  {
    id: 'inbox-email-deadline',
    category: 'pattern',
    text: 'Triage pattern: Emails with explicit deadlines need tracking. action=local_task, priority=high. Deadline detection confidence matters - if deadline is clear, trust it.',
    metadata: {
      source: 'inbox',
      has_deadline: true,
      recommended_action: 'local_task',
      recommended_priority: 'high',
    },
  },

  // === FINANCE SIGNALS ===
  {
    id: 'finance-large-amount',
    category: 'pattern',
    text: 'Triage pattern: Finance signals with amounts over $500 need proposal. action=local_task, escalation=propose. Large expenses need human approval.',
    metadata: {
      source: 'finance',
      amount_threshold: 500,
      recommended_action: 'local_task',
      recommended_escalation: 'propose',
    },
  },
  {
    id: 'finance-subscription',
    category: 'pattern',
    text: 'Triage pattern: Recurring subscription charges can be auto-processed. action=local_task, escalation=auto. These are expected and pre-approved.',
    metadata: {
      source: 'finance',
      type: 'subscription',
      recommended_action: 'local_task',
      recommended_escalation: 'auto',
    },
  },

  // === CONFIDENCE PATTERNS ===
  {
    id: 'low-confidence-defer',
    category: 'pattern',
    text: 'Triage pattern: Low-confidence signals (confidence < 0.5) should be deferred. action=defer, escalation=propose. When uncertain, wait for more information.',
    metadata: {
      confidence_threshold: 0.5,
      confidence_direction: 'below',
      recommended_action: 'defer',
      recommended_escalation: 'propose',
    },
  },
  {
    id: 'high-confidence-auto',
    category: 'pattern',
    text: 'Triage pattern: High-confidence routine signals (confidence > 0.9) can auto-execute. action=local_task, escalation=auto. Trust strong signals.',
    metadata: {
      confidence_threshold: 0.9,
      confidence_direction: 'above',
      recommended_escalation: 'auto',
    },
  },

  // === EEG / ENERGY SIGNALS ===
  {
    id: 'eeg-energy-window',
    category: 'pattern',
    text: 'Triage pattern: Energy window notifications from EEG are informational only. action=defer, escalation=auto. These inform scheduling but don\'t create tasks.',
    metadata: {
      source: 'eeg',
      signal_type: 'energy_window',
      recommended_action: 'defer',
      recommended_escalation: 'auto',
    },
  },
];

// ============================================================================
// Domain-Specific Patterns
// ============================================================================

function generateDomainPatterns(): BootstrapPattern[] {
  const patterns: BootstrapPattern[] = [];
  const domains = getDomains();

  for (const domain of domains.domains) {
    // High-compliance domains
    if (domain.sensitivity_level === 'high_compliance') {
      patterns.push({
        id: `domain-${domain.id}-compliance`,
        category: 'pattern',
        text: `Domain pattern: ${domain.name} is a high-compliance domain. All signals for this domain should default to escalation=propose. Compliance errors are expensive.`,
        metadata: {
          domain_id: domain.id,
          domain_name: domain.name,
          sensitivity: 'high_compliance',
          recommended_escalation: 'propose',
        },
      });
    }

    // Personal domain
    if (domain.type === 'personal') {
      patterns.push({
        id: `domain-${domain.id}-personal`,
        category: 'pattern',
        text: `Domain pattern: ${domain.name} is a personal domain. Family-related signals should prioritize appropriately. Family emergencies are critical.`,
        metadata: {
          domain_id: domain.id,
          domain_name: domain.name,
          type: 'personal',
          family_emergency_escalation: 'critical',
        },
      });
    }
  }

  return patterns;
}

// ============================================================================
// Escalation Rule Patterns
// ============================================================================

function generateEscalationPatterns(): BootstrapPattern[] {
  const charter = getLifeCharter();
  const patterns: BootstrapPattern[] = [];

  // CRITICAL triggers
  patterns.push({
    id: 'escalation-critical-triggers',
    category: 'rule',
    text: `CRITICAL escalation triggers (response: ${charter.escalation_levels.CRITICAL.response_time}): ${charter.escalation_levels.CRITICAL.triggers.join('; ')}. These require immediate human attention.`,
    metadata: {
      escalation_level: 'critical',
      response_time: charter.escalation_levels.CRITICAL.response_time,
      triggers: charter.escalation_levels.CRITICAL.triggers,
    },
  });

  // PROPOSE triggers
  patterns.push({
    id: 'escalation-propose-triggers',
    category: 'rule',
    text: `PROPOSE escalation triggers (response: ${charter.escalation_levels.PROPOSE.response_time}): ${charter.escalation_levels.PROPOSE.triggers.join('; ')}. These need approval before action.`,
    metadata: {
      escalation_level: 'propose',
      response_time: charter.escalation_levels.PROPOSE.response_time,
      triggers: charter.escalation_levels.PROPOSE.triggers,
    },
  });

  // AUTO_EXECUTE triggers
  patterns.push({
    id: 'escalation-auto-triggers',
    category: 'rule',
    text: `AUTO_EXECUTE triggers (response: ${charter.escalation_levels.AUTO_EXECUTE.response_time}): ${charter.escalation_levels.AUTO_EXECUTE.triggers.join('; ')}. These can proceed without approval.`,
    metadata: {
      escalation_level: 'auto',
      response_time: charter.escalation_levels.AUTO_EXECUTE.response_time,
      triggers: charter.escalation_levels.AUTO_EXECUTE.triggers,
    },
  });

  // Global principles
  for (let i = 0; i < charter.global_principles.length; i++) {
    patterns.push({
      id: `principle-${i + 1}`,
      category: 'rule',
      text: `Global principle: ${charter.global_principles[i]}`,
      metadata: {
        type: 'global_principle',
        index: i + 1,
      },
    });
  }

  return patterns;
}

// ============================================================================
// Example Corrections (Synthetic training data)
// ============================================================================

const CORRECTION_EXAMPLES: BootstrapPattern[] = [
  {
    id: 'correction-legal-not-urgent',
    category: 'decision',
    text: 'Correction example: Legal signal about "statute of limitations research" was incorrectly escalated to critical. Correct: escalation=propose. Not all legal signals are emergencies - research tasks can be proposed.',
    metadata: {
      type: 'correction',
      original_action: 'escalate',
      original_escalation: 'critical',
      corrected_action: 'local_task',
      corrected_escalation: 'propose',
      lesson: 'Legal research is different from legal deadlines',
    },
  },
  {
    id: 'correction-github-noise',
    category: 'decision',
    text: 'Correction example: GitHub bot comments (dependabot updates, CI status) were creating local tasks. Correct: action=ignore for automated bot messages. Only human-authored content needs tracking.',
    metadata: {
      type: 'correction',
      source: 'github',
      original_action: 'local_task',
      corrected_action: 'ignore',
      lesson: 'Filter out automated bot noise',
    },
  },
  {
    id: 'correction-comms-spam',
    category: 'decision',
    text: 'Correction example: Marketing emails detected as follow-up signals. Correct: action=ignore. Check sender domain and content for marketing indicators before creating tasks.',
    metadata: {
      type: 'correction',
      source: 'comms',
      original_action: 'local_task',
      corrected_action: 'ignore',
      lesson: 'Marketing emails are not follow-ups',
    },
  },
  {
    id: 'correction-finance-refund',
    category: 'decision',
    text: 'Correction example: Refund transactions were creating expense tasks. Correct: action=defer for refunds. Refunds are credits, not expenses to track.',
    metadata: {
      type: 'correction',
      source: 'finance',
      transaction_type: 'refund',
      original_action: 'local_task',
      corrected_action: 'defer',
      lesson: 'Refunds are not actionable expenses',
    },
  },
];

// ============================================================================
// Bootstrap Functions
// ============================================================================

/**
 * Seed all bootstrap patterns into Zep memory
 */
export async function bootstrapPMMemory(options?: {
  skipIfExists?: boolean;
  categories?: Array<'triage' | 'domain' | 'escalation' | 'corrections'>;
}): Promise<{
  seeded: number;
  skipped: number;
  errors: string[];
}> {
  const categories = options?.categories ?? ['triage', 'domain', 'escalation', 'corrections'];
  const results = {
    seeded: 0,
    skipped: 0,
    errors: [] as string[],
  };

  const allPatterns: BootstrapPattern[] = [];

  // Gather patterns based on requested categories
  if (categories.includes('triage')) {
    allPatterns.push(...TRIAGE_PATTERNS);
  }
  if (categories.includes('domain')) {
    allPatterns.push(...generateDomainPatterns());
  }
  if (categories.includes('escalation')) {
    allPatterns.push(...generateEscalationPatterns());
  }
  if (categories.includes('corrections')) {
    allPatterns.push(...CORRECTION_EXAMPLES);
  }

  console.log(`[Bootstrap] Seeding ${allPatterns.length} patterns...`);

  for (const pattern of allPatterns) {
    try {
      await addPMMemory(pattern.text, pattern.category, {
        bootstrap_id: pattern.id,
        bootstrap_category: pattern.category,
        ...pattern.metadata,
      });
      results.seeded++;
      console.log(`[Bootstrap] Seeded: ${pattern.id}`);
    } catch (error) {
      const errMsg = `Failed to seed ${pattern.id}: ${error instanceof Error ? error.message : String(error)}`;
      results.errors.push(errMsg);
      console.error(`[Bootstrap] ${errMsg}`);
    }
  }

  console.log(`[Bootstrap] Complete: ${results.seeded} seeded, ${results.skipped} skipped, ${results.errors.length} errors`);

  return results;
}

/**
 * Seed a specific pattern by ID
 */
export async function seedPattern(patternId: string): Promise<boolean> {
  const allPatterns = [
    ...TRIAGE_PATTERNS,
    ...generateDomainPatterns(),
    ...generateEscalationPatterns(),
    ...CORRECTION_EXAMPLES,
  ];

  const pattern = allPatterns.find(p => p.id === patternId);
  if (!pattern) {
    console.error(`[Bootstrap] Pattern not found: ${patternId}`);
    return false;
  }

  try {
    await addPMMemory(pattern.text, pattern.category, {
      bootstrap_id: pattern.id,
      ...pattern.metadata,
    });
    console.log(`[Bootstrap] Seeded: ${patternId}`);
    return true;
  } catch (error) {
    console.error(`[Bootstrap] Failed to seed ${patternId}:`, error);
    return false;
  }
}

/**
 * List all available bootstrap patterns
 */
export function listBootstrapPatterns(): Array<{ id: string; category: string; preview: string }> {
  const allPatterns = [
    ...TRIAGE_PATTERNS,
    ...generateDomainPatterns(),
    ...generateEscalationPatterns(),
    ...CORRECTION_EXAMPLES,
  ];

  return allPatterns.map(p => ({
    id: p.id,
    category: p.category,
    preview: p.text.substring(0, 100) + '...',
  }));
}

/**
 * Add a custom triage pattern (for runtime learning)
 */
export async function addCustomTriagePattern(params: {
  id: string;
  description: string;
  source?: string;
  signalType?: string;
  keywords?: string[];
  recommendedAction: string;
  recommendedEscalation: string;
  recommendedPriority?: string;
}): Promise<void> {
  const text = `Custom triage pattern: ${params.description}. ` +
    `Recommended: action=${params.recommendedAction}, escalation=${params.recommendedEscalation}` +
    (params.recommendedPriority ? `, priority=${params.recommendedPriority}` : '') +
    '.';

  await addPMMemory(text, 'pattern', {
    custom_pattern_id: params.id,
    source: params.source,
    signal_type: params.signalType,
    keywords: params.keywords,
    recommended_action: params.recommendedAction,
    recommended_escalation: params.recommendedEscalation,
    recommended_priority: params.recommendedPriority,
    created_at: new Date().toISOString(),
  });

  console.log(`[Bootstrap] Added custom pattern: ${params.id}`);
}
