/**
 * EA Preference Model - Adaptive Learning System
 *
 * This module captures James's "State Vector" for preferences - enabling the EA
 * to learn and adapt over time through corrections rather than hardcoded rules.
 *
 * Manifold Alignment Principles:
 * - Minimize ENTROPY for James (reduce cognitive load)
 * - Maximize COHERENCE (consistent handling of similar items)
 * - Learn from corrections to improve over time
 *
 * Storage: Uses Zep memory under 'ea-agent' graph for persistent preference storage.
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from '../server-only-guard';
import {
  addAgentMemory,
  searchAgentMemory,
  type AgentId,
  type ZepSearchResult,
} from '../memory/zep';

// Prevent client-side imports
ensureServerOnly('lib/ea/preference-model');

// ============================================================================
// Type Definitions
// ============================================================================

const EA_AGENT_ID: AgentId = 'ea-agent';

/**
 * Batch frequency preferences for how James wants information delivered
 */
export type BatchFrequency = 'realtime' | 'hourly' | 'daily' | 'on_demand';

/**
 * Urgency classification levels
 */
export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low' | 'background';

/**
 * Domain classification for routing
 */
export type Domain =
  | 'legal'
  | 'finance'
  | 'health'
  | 'pm'
  | 'comms'
  | 'personal'
  | 'business'
  | 'hyro'
  | 'general';

/**
 * Pattern type for urgency triggers and auto-archive rules
 */
export interface PatternRule {
  pattern: string; // Regex pattern or keyword
  isRegex: boolean;
  caseSensitive: boolean;
  weight: number; // 0-1, how strongly this pattern affects classification
  learnedAt: string; // ISO timestamp
  source: 'manual' | 'correction' | 'inferred';
  exampleMatches?: string[]; // Sample texts that matched this pattern
}

/**
 * Priority contact configuration
 */
export interface PriorityContact {
  identifier: string; // Email, phone, or name pattern
  identifierType: 'email' | 'phone' | 'name' | 'domain';
  urgencyBoost: UrgencyLevel; // Minimum urgency for this contact
  alwaysNotify: boolean; // Bypass batch frequency for this contact
  notes?: string;
  addedAt: string;
  source: 'manual' | 'correction' | 'inferred';
}

/**
 * Domain-specific priority weighting
 */
export interface DomainSensitivity {
  domain: Domain;
  baseWeight: number; // 0-1, base priority multiplier
  currentFocusBoost: number; // Additional boost when this is current focus
  suppressWhenNotFocused: boolean; // Lower priority when not current focus
  lastUpdated: string;
}

/**
 * James's Preference Model - The "State Vector" for the EA
 *
 * This captures James's preferences as a non-linear system - not rigid rules,
 * but learned patterns that evolve through interaction.
 */
export interface JamesPreferenceModel {
  version: string;
  lastUpdated: string;

  // Urgency Detection
  urgency_triggers: PatternRule[];

  // Auto-Archive (things to never show)
  auto_archive_patterns: PatternRule[];

  // Priority Contacts (people who always get attention)
  priority_contacts: PriorityContact[];

  // Domain Sensitivity (per-domain priority weights)
  domain_sensitivity: DomainSensitivity[];

  // Batch Frequency Preference
  batch_frequency_preference: BatchFrequency;

  // Current Focus Domain (what project is he focused on now?)
  current_focus_domain: Domain | null;

  // Cognitive Load Limit (max items per batch)
  cognitive_load_limit: number;

  // Meta: Learning Statistics
  corrections_count: number;
  last_correction_at: string | null;
}

/**
 * Urgency score result from classification
 */
export interface UrgencyScore {
  level: UrgencyLevel;
  score: number; // 0-1 confidence
  factors: UrgencyFactor[];
  suggestedAction: 'notify_immediately' | 'add_to_batch' | 'archive' | 'defer';
  reasoning: string;
}

/**
 * Individual factor contributing to urgency calculation
 */
export interface UrgencyFactor {
  type: 'trigger_match' | 'contact_match' | 'domain_weight' | 'time_sensitivity' | 'correction_learned';
  description: string;
  weight: number;
  pattern?: string; // The pattern that matched
}

/**
 * Correction record for learning
 */
export interface CorrectionRecord {
  id: string;
  itemId: string;
  itemType: 'email' | 'message' | 'task' | 'notification' | 'unknown';
  itemSummary: string;
  originalClassification: {
    urgency: UrgencyLevel;
    domain: Domain;
    action: string;
  };
  correctedClassification: {
    urgency: UrgencyLevel;
    domain: Domain;
    action: string;
  };
  reason: string;
  timestamp: string;
  appliedPatterns?: PatternRule[];
}

// ============================================================================
// Default Model Configuration
// ============================================================================

/**
 * Create a fresh default preference model
 */
function createDefaultModel(): JamesPreferenceModel {
  const now = new Date().toISOString();

  return {
    version: '1.0.0',
    lastUpdated: now,

    // Default urgency triggers (conservative starting point)
    urgency_triggers: [
      {
        pattern: 'urgent|asap|immediately|emergency',
        isRegex: true,
        caseSensitive: false,
        weight: 0.9,
        learnedAt: now,
        source: 'manual',
        exampleMatches: [],
      },
      {
        pattern: 'deadline today|due today|expires today',
        isRegex: true,
        caseSensitive: false,
        weight: 0.85,
        learnedAt: now,
        source: 'manual',
        exampleMatches: [],
      },
      {
        pattern: 'court|hearing|filing deadline',
        isRegex: true,
        caseSensitive: false,
        weight: 0.95,
        learnedAt: now,
        source: 'manual',
        exampleMatches: [],
      },
    ],

    // Default auto-archive patterns
    auto_archive_patterns: [
      {
        pattern: 'unsubscribe|no-reply|noreply',
        isRegex: true,
        caseSensitive: false,
        weight: 0.7,
        learnedAt: now,
        source: 'manual',
        exampleMatches: [],
      },
      {
        pattern: 'newsletter|promotional|marketing',
        isRegex: true,
        caseSensitive: false,
        weight: 0.6,
        learnedAt: now,
        source: 'manual',
        exampleMatches: [],
      },
    ],

    // Empty priority contacts (learn from corrections)
    priority_contacts: [],

    // Default domain sensitivity
    domain_sensitivity: [
      { domain: 'legal', baseWeight: 0.9, currentFocusBoost: 0.1, suppressWhenNotFocused: false, lastUpdated: now },
      { domain: 'finance', baseWeight: 0.7, currentFocusBoost: 0.2, suppressWhenNotFocused: false, lastUpdated: now },
      { domain: 'health', baseWeight: 0.8, currentFocusBoost: 0.1, suppressWhenNotFocused: false, lastUpdated: now },
      { domain: 'pm', baseWeight: 0.6, currentFocusBoost: 0.3, suppressWhenNotFocused: true, lastUpdated: now },
      { domain: 'comms', baseWeight: 0.5, currentFocusBoost: 0.2, suppressWhenNotFocused: true, lastUpdated: now },
      { domain: 'personal', baseWeight: 0.4, currentFocusBoost: 0.1, suppressWhenNotFocused: true, lastUpdated: now },
      { domain: 'business', baseWeight: 0.7, currentFocusBoost: 0.2, suppressWhenNotFocused: false, lastUpdated: now },
      { domain: 'hyro', baseWeight: 0.5, currentFocusBoost: 0.3, suppressWhenNotFocused: true, lastUpdated: now },
      { domain: 'general', baseWeight: 0.3, currentFocusBoost: 0.1, suppressWhenNotFocused: true, lastUpdated: now },
    ],

    // Default batch frequency (daily - conservative)
    batch_frequency_preference: 'daily',

    // No current focus by default
    current_focus_domain: null,

    // Conservative cognitive load limit
    cognitive_load_limit: 10,

    // No corrections yet
    corrections_count: 0,
    last_correction_at: null,
  };
}

// ============================================================================
// Zep Memory Operations
// ============================================================================

const PREFERENCES_KEY = 'james_preference_model';
const CORRECTION_PREFIX = 'ea_correction_';

/**
 * Load James's preference model from Zep memory
 *
 * If no model exists, creates and saves a default one.
 */
export async function loadPreferences(): Promise<JamesPreferenceModel> {
  try {
    // Search for the preference model in EA agent memory
    const results = await searchAgentMemory(EA_AGENT_ID, PREFERENCES_KEY, 1);

    if (results.length > 0 && results[0].memory.metadata?.preferences) {
      const stored = results[0].memory.metadata.preferences as JamesPreferenceModel;
      console.log(`[PreferenceModel] Loaded preferences (version: ${stored.version}, corrections: ${stored.corrections_count})`);
      return stored;
    }

    // No preferences found - create default and save
    console.log('[PreferenceModel] No stored preferences found, creating default model');
    const defaultModel = createDefaultModel();
    await savePreferences(defaultModel);
    return defaultModel;
  } catch (error) {
    console.error('[PreferenceModel] Error loading preferences:', error);
    // Return default model on error (don't save to avoid overwriting)
    return createDefaultModel();
  }
}

/**
 * Save James's preference model to Zep memory
 */
export async function savePreferences(model: JamesPreferenceModel): Promise<void> {
  try {
    const updatedModel = {
      ...model,
      lastUpdated: new Date().toISOString(),
    };

    await addAgentMemory(
      EA_AGENT_ID,
      `[EA PREFERENCES] ${PREFERENCES_KEY} - Updated at ${updatedModel.lastUpdated}`,
      {
        type: 'preference_model',
        key: PREFERENCES_KEY,
        preferences: updatedModel,
        version: updatedModel.version,
        corrections_count: updatedModel.corrections_count,
      }
    );

    console.log(`[PreferenceModel] Saved preferences (version: ${updatedModel.version})`);
  } catch (error) {
    console.error('[PreferenceModel] Error saving preferences:', error);
    throw new Error(`Failed to save preferences: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Record a correction from James and learn from it
 *
 * This is the key learning mechanism - when James corrects a classification,
 * we record it and potentially update the preference model.
 */
export async function recordCorrection(
  itemId: string,
  original: {
    urgency: UrgencyLevel;
    domain: Domain;
    action: string;
  },
  corrected: {
    urgency: UrgencyLevel;
    domain: Domain;
    action: string;
  },
  reason: string,
  itemContext?: {
    type?: 'email' | 'message' | 'task' | 'notification' | 'unknown';
    summary?: string;
    sender?: string;
    content?: string;
  }
): Promise<void> {
  const correctionId = `${CORRECTION_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = new Date().toISOString();

  const correctionRecord: CorrectionRecord = {
    id: correctionId,
    itemId,
    itemType: itemContext?.type || 'unknown',
    itemSummary: itemContext?.summary || `Item ${itemId}`,
    originalClassification: original,
    correctedClassification: corrected,
    reason,
    timestamp,
  };

  // Store correction as separate memory for pattern learning
  const correctionText = `[EA CORRECTION] ${correctionId}
Item: ${correctionRecord.itemSummary}
Original: urgency=${original.urgency}, domain=${original.domain}, action=${original.action}
Corrected: urgency=${corrected.urgency}, domain=${corrected.domain}, action=${corrected.action}
Reason: ${reason}
Context: ${itemContext?.content?.substring(0, 200) || 'No content'}`;

  await addAgentMemory(EA_AGENT_ID, correctionText, {
    type: 'correction',
    correction_id: correctionId,
    item_id: itemId,
    item_type: correctionRecord.itemType,
    original_urgency: original.urgency,
    original_domain: original.domain,
    corrected_urgency: corrected.urgency,
    corrected_domain: corrected.domain,
    reason,
    sender: itemContext?.sender,
    timestamp,
  });

  // Update preferences with correction count
  const preferences = await loadPreferences();
  preferences.corrections_count += 1;
  preferences.last_correction_at = timestamp;

  // Attempt to learn new patterns from this correction
  await learnFromCorrection(preferences, correctionRecord, itemContext);

  await savePreferences(preferences);

  console.log(`[PreferenceModel] Recorded correction ${correctionId}: ${original.urgency} -> ${corrected.urgency}`);
}

/**
 * Learn new patterns from a correction
 *
 * This analyzes the correction to potentially add new rules or adjust weights.
 */
async function learnFromCorrection(
  model: JamesPreferenceModel,
  correction: CorrectionRecord,
  context?: {
    sender?: string;
    content?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();

  // Case 1: Item was incorrectly marked as low urgency but should be higher
  if (
    (correction.originalClassification.urgency === 'low' || correction.originalClassification.urgency === 'background') &&
    (correction.correctedClassification.urgency === 'high' || correction.correctedClassification.urgency === 'critical')
  ) {
    // Check if sender should be added as priority contact
    if (context?.sender) {
      const existingContact = model.priority_contacts.find(
        (c) => c.identifier.toLowerCase() === context.sender!.toLowerCase()
      );

      if (!existingContact) {
        // Add sender as priority contact
        const newContact: PriorityContact = {
          identifier: context.sender,
          identifierType: context.sender.includes('@') ? 'email' : 'name',
          urgencyBoost: correction.correctedClassification.urgency,
          alwaysNotify: correction.correctedClassification.urgency === 'critical',
          notes: `Learned from correction: "${correction.reason}"`,
          addedAt: now,
          source: 'correction',
        };
        model.priority_contacts.push(newContact);
        console.log(`[PreferenceModel] Learned new priority contact: ${context.sender}`);
      }
    }

    // Extract keywords from reason to create new trigger pattern
    if (correction.reason && correction.reason.length > 5) {
      const keywords = extractKeywordsFromReason(correction.reason);
      if (keywords.length > 0) {
        const newPattern: PatternRule = {
          pattern: keywords.join('|'),
          isRegex: true,
          caseSensitive: false,
          weight: 0.7, // Start with moderate weight
          learnedAt: now,
          source: 'correction',
          exampleMatches: [correction.itemSummary],
        };
        model.urgency_triggers.push(newPattern);
        console.log(`[PreferenceModel] Learned new urgency trigger: ${newPattern.pattern}`);
      }
    }
  }

  // Case 2: Item was incorrectly shown but should be archived
  if (
    correction.correctedClassification.action === 'archive' &&
    correction.originalClassification.action !== 'archive'
  ) {
    // Extract pattern from sender or content to auto-archive similar items
    if (context?.sender) {
      const senderDomain = context.sender.includes('@')
        ? context.sender.split('@')[1]
        : null;

      if (senderDomain) {
        const existingPattern = model.auto_archive_patterns.find(
          (p) => p.pattern.includes(senderDomain)
        );

        if (!existingPattern) {
          const newPattern: PatternRule = {
            pattern: senderDomain,
            isRegex: false,
            caseSensitive: false,
            weight: 0.6,
            learnedAt: now,
            source: 'correction',
            exampleMatches: [correction.itemSummary],
          };
          model.auto_archive_patterns.push(newPattern);
          console.log(`[PreferenceModel] Learned new auto-archive pattern: ${senderDomain}`);
        }
      }
    }
  }

  // Case 3: Domain was misclassified - adjust domain sensitivity
  if (correction.originalClassification.domain !== correction.correctedClassification.domain) {
    const correctDomain = model.domain_sensitivity.find(
      (d) => d.domain === correction.correctedClassification.domain
    );
    const wrongDomain = model.domain_sensitivity.find(
      (d) => d.domain === correction.originalClassification.domain
    );

    // Slightly boost the correct domain's weight
    if (correctDomain) {
      correctDomain.baseWeight = Math.min(1.0, correctDomain.baseWeight + 0.05);
      correctDomain.lastUpdated = now;
    }

    // Slightly reduce the wrong domain's weight (but not below 0.1)
    if (wrongDomain) {
      wrongDomain.baseWeight = Math.max(0.1, wrongDomain.baseWeight - 0.02);
      wrongDomain.lastUpdated = now;
    }
  }
}

/**
 * Extract meaningful keywords from a correction reason
 */
function extractKeywordsFromReason(reason: string): string[] {
  // Remove common stop words and extract meaningful terms
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'was', 'are', 'were', 'been', 'be', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
    'because', 'until', 'while', 'this', 'that', 'these', 'those', 'it',
    'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his',
    'she', 'her', 'they', 'them', 'their', 'what', 'which', 'who', 'whom',
  ]);

  const words = reason
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word));

  // Return unique keywords
  return Array.from(new Set(words)).slice(0, 5);
}

// ============================================================================
// Urgency Computation
// ============================================================================

/**
 * Compute urgency score for an item using the preference model
 *
 * This is the main classification function that applies James's learned
 * preferences to classify incoming items.
 */
export async function computeUrgency(
  item: {
    id: string;
    content: string;
    sender?: string;
    subject?: string;
    domain?: Domain;
    timestamp?: string;
    metadata?: Record<string, unknown>;
  },
  model: JamesPreferenceModel
): Promise<UrgencyScore> {
  const factors: UrgencyFactor[] = [];
  let baseScore = 0.3; // Start with baseline (low-medium)

  const contentLower = (item.content || '').toLowerCase();
  const subjectLower = (item.subject || '').toLowerCase();
  const combinedText = `${subjectLower} ${contentLower}`;

  // Factor 1: Check auto-archive patterns (should this be hidden?)
  for (const pattern of model.auto_archive_patterns) {
    if (matchesPattern(combinedText, pattern) || (item.sender && matchesPattern(item.sender, pattern))) {
      return {
        level: 'background',
        score: 0.1,
        factors: [
          {
            type: 'trigger_match',
            description: `Matches auto-archive pattern: ${pattern.pattern}`,
            weight: -1.0,
            pattern: pattern.pattern,
          },
        ],
        suggestedAction: 'archive',
        reasoning: `Item matches auto-archive pattern "${pattern.pattern}". Based on learned preferences, this should be archived without notification.`,
      };
    }
  }

  // Factor 2: Check priority contacts
  if (item.sender) {
    for (const contact of model.priority_contacts) {
      if (matchesContact(item.sender, contact)) {
        const boostValue = urgencyLevelToScore(contact.urgencyBoost);
        baseScore = Math.max(baseScore, boostValue);
        factors.push({
          type: 'contact_match',
          description: `From priority contact: ${contact.identifier}`,
          weight: boostValue,
          pattern: contact.identifier,
        });
      }
    }
  }

  // Factor 3: Check urgency trigger patterns
  for (const trigger of model.urgency_triggers) {
    if (matchesPattern(combinedText, trigger)) {
      baseScore = Math.max(baseScore, trigger.weight);
      factors.push({
        type: 'trigger_match',
        description: `Matches urgency trigger: ${trigger.pattern}`,
        weight: trigger.weight,
        pattern: trigger.pattern,
      });
    }
  }

  // Factor 4: Apply domain sensitivity
  const itemDomain = item.domain || 'general';
  const domainConfig = model.domain_sensitivity.find((d) => d.domain === itemDomain);

  if (domainConfig) {
    let domainWeight = domainConfig.baseWeight;

    // Boost if this is the current focus domain
    if (model.current_focus_domain === itemDomain) {
      domainWeight += domainConfig.currentFocusBoost;
      factors.push({
        type: 'domain_weight',
        description: `Current focus domain: ${itemDomain}`,
        weight: domainConfig.currentFocusBoost,
      });
    } else if (domainConfig.suppressWhenNotFocused && model.current_focus_domain) {
      // Suppress if not focused and configured to do so
      domainWeight *= 0.7;
      factors.push({
        type: 'domain_weight',
        description: `Domain ${itemDomain} suppressed (not current focus)`,
        weight: -0.1,
      });
    }

    baseScore *= domainWeight;
  }

  // Factor 5: Time sensitivity (items with today's date patterns)
  const todayPatterns = ['today', 'tonight', 'this morning', 'this afternoon', 'now', 'asap'];
  for (const pattern of todayPatterns) {
    if (combinedText.includes(pattern)) {
      baseScore = Math.max(baseScore, 0.7);
      factors.push({
        type: 'time_sensitivity',
        description: `Contains time-sensitive keyword: "${pattern}"`,
        weight: 0.2,
        pattern,
      });
      break;
    }
  }

  // Factor 6: Check for past corrections on similar items
  const relevantCorrections = await searchPastCorrections(combinedText);
  if (relevantCorrections.length > 0) {
    const avgCorrectedUrgency = relevantCorrections.reduce((sum, c) => {
      return sum + urgencyLevelToScore(c.corrected_urgency as UrgencyLevel);
    }, 0) / relevantCorrections.length;

    if (Math.abs(avgCorrectedUrgency - baseScore) > 0.2) {
      baseScore = (baseScore + avgCorrectedUrgency) / 2; // Blend with learned value
      factors.push({
        type: 'correction_learned',
        description: `Adjusted based on ${relevantCorrections.length} past correction(s)`,
        weight: avgCorrectedUrgency - baseScore,
      });
    }
  }

  // Compute final level and action
  const level = scoreToUrgencyLevel(baseScore);
  const suggestedAction = determineSuggestedAction(level, model, factors);

  // Build reasoning explanation
  const reasoning = buildReasoning(level, factors, model);

  return {
    level,
    score: Math.min(1.0, Math.max(0.0, baseScore)),
    factors,
    suggestedAction,
    reasoning,
  };
}

/**
 * Check if text matches a pattern rule
 */
function matchesPattern(text: string, rule: PatternRule): boolean {
  const checkText = rule.caseSensitive ? text : text.toLowerCase();
  const checkPattern = rule.caseSensitive ? rule.pattern : rule.pattern.toLowerCase();

  if (rule.isRegex) {
    try {
      const regex = new RegExp(checkPattern, rule.caseSensitive ? '' : 'i');
      return regex.test(checkText);
    } catch {
      // Invalid regex - fall back to simple includes
      return checkText.includes(checkPattern);
    }
  }

  return checkText.includes(checkPattern);
}

/**
 * Check if sender matches a priority contact
 */
function matchesContact(sender: string, contact: PriorityContact): boolean {
  const senderLower = sender.toLowerCase();
  const identifierLower = contact.identifier.toLowerCase();

  switch (contact.identifierType) {
    case 'email':
      return senderLower === identifierLower || senderLower.endsWith(`<${identifierLower}>`);
    case 'domain':
      return senderLower.includes(`@${identifierLower}`) || senderLower.endsWith(identifierLower);
    case 'phone':
      return sender.replace(/\D/g, '').includes(contact.identifier.replace(/\D/g, ''));
    case 'name':
      return senderLower.includes(identifierLower);
    default:
      return senderLower.includes(identifierLower);
  }
}

/**
 * Convert urgency level to numeric score
 */
function urgencyLevelToScore(level: UrgencyLevel): number {
  switch (level) {
    case 'critical': return 1.0;
    case 'high': return 0.8;
    case 'medium': return 0.5;
    case 'low': return 0.3;
    case 'background': return 0.1;
    default: return 0.3;
  }
}

/**
 * Convert numeric score to urgency level
 */
function scoreToUrgencyLevel(score: number): UrgencyLevel {
  if (score >= 0.9) return 'critical';
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  if (score >= 0.2) return 'low';
  return 'background';
}

/**
 * Determine suggested action based on urgency and model
 */
function determineSuggestedAction(
  level: UrgencyLevel,
  model: JamesPreferenceModel,
  factors: UrgencyFactor[]
): 'notify_immediately' | 'add_to_batch' | 'archive' | 'defer' {
  // Check if any priority contact with alwaysNotify matched
  const hasPriorityContact = factors.some(
    (f) => f.type === 'contact_match' && f.weight >= 0.8
  );

  if (level === 'critical' || hasPriorityContact) {
    return 'notify_immediately';
  }

  if (level === 'background') {
    return 'archive';
  }

  if (level === 'low' && model.batch_frequency_preference === 'daily') {
    return 'defer';
  }

  return 'add_to_batch';
}

/**
 * Build human-readable reasoning for the classification
 */
function buildReasoning(
  level: UrgencyLevel,
  factors: UrgencyFactor[],
  model: JamesPreferenceModel
): string {
  const parts: string[] = [];

  parts.push(`Classified as ${level.toUpperCase()} urgency.`);

  if (factors.length > 0) {
    parts.push('Factors:');
    factors.forEach((f) => {
      parts.push(`- ${f.description} (weight: ${f.weight.toFixed(2)})`);
    });
  }

  if (model.current_focus_domain) {
    parts.push(`Current focus: ${model.current_focus_domain}`);
  }

  parts.push(`Batch preference: ${model.batch_frequency_preference}`);

  return parts.join(' ');
}

/**
 * Search for past corrections relevant to this content
 */
async function searchPastCorrections(content: string): Promise<Array<{ corrected_urgency: string }>> {
  try {
    const keywords = content.split(/\s+/).slice(0, 10).join(' ');
    const results = await searchAgentMemory(EA_AGENT_ID, `correction ${keywords}`, 3);

    return results
      .filter((r) => r.memory.metadata?.type === 'correction')
      .map((r) => ({
        corrected_urgency: r.memory.metadata?.corrected_urgency || 'medium',
      }));
  } catch {
    return [];
  }
}

// ============================================================================
// Model Management Utilities
// ============================================================================

/**
 * Update current focus domain
 */
export async function setCurrentFocus(domain: Domain | null): Promise<void> {
  const model = await loadPreferences();
  model.current_focus_domain = domain;
  await savePreferences(model);
  console.log(`[PreferenceModel] Current focus set to: ${domain || 'none'}`);
}

/**
 * Update batch frequency preference
 */
export async function setBatchFrequency(frequency: BatchFrequency): Promise<void> {
  const model = await loadPreferences();
  model.batch_frequency_preference = frequency;
  await savePreferences(model);
  console.log(`[PreferenceModel] Batch frequency set to: ${frequency}`);
}

/**
 * Update cognitive load limit
 */
export async function setCognitiveLoadLimit(limit: number): Promise<void> {
  const model = await loadPreferences();
  model.cognitive_load_limit = Math.max(1, Math.min(50, limit));
  await savePreferences(model);
  console.log(`[PreferenceModel] Cognitive load limit set to: ${model.cognitive_load_limit}`);
}

/**
 * Add a manual priority contact
 */
export async function addPriorityContact(contact: Omit<PriorityContact, 'addedAt' | 'source'>): Promise<void> {
  const model = await loadPreferences();

  const existingIndex = model.priority_contacts.findIndex(
    (c) => c.identifier.toLowerCase() === contact.identifier.toLowerCase()
  );

  const newContact: PriorityContact = {
    ...contact,
    addedAt: new Date().toISOString(),
    source: 'manual',
  };

  if (existingIndex >= 0) {
    model.priority_contacts[existingIndex] = newContact;
  } else {
    model.priority_contacts.push(newContact);
  }

  await savePreferences(model);
  console.log(`[PreferenceModel] Added priority contact: ${contact.identifier}`);
}

/**
 * Remove a priority contact
 */
export async function removePriorityContact(identifier: string): Promise<void> {
  const model = await loadPreferences();
  model.priority_contacts = model.priority_contacts.filter(
    (c) => c.identifier.toLowerCase() !== identifier.toLowerCase()
  );
  await savePreferences(model);
  console.log(`[PreferenceModel] Removed priority contact: ${identifier}`);
}

/**
 * Add a manual urgency trigger pattern
 */
export async function addUrgencyTrigger(trigger: Omit<PatternRule, 'learnedAt' | 'source'>): Promise<void> {
  const model = await loadPreferences();

  model.urgency_triggers.push({
    ...trigger,
    learnedAt: new Date().toISOString(),
    source: 'manual',
  });

  await savePreferences(model);
  console.log(`[PreferenceModel] Added urgency trigger: ${trigger.pattern}`);
}

/**
 * Add a manual auto-archive pattern
 */
export async function addAutoArchivePattern(pattern: Omit<PatternRule, 'learnedAt' | 'source'>): Promise<void> {
  const model = await loadPreferences();

  model.auto_archive_patterns.push({
    ...pattern,
    learnedAt: new Date().toISOString(),
    source: 'manual',
  });

  await savePreferences(model);
  console.log(`[PreferenceModel] Added auto-archive pattern: ${pattern.pattern}`);
}

/**
 * Get correction statistics
 */
export async function getCorrectionStats(): Promise<{
  total: number;
  lastCorrection: string | null;
  learnedTriggers: number;
  learnedContacts: number;
  learnedArchivePatterns: number;
}> {
  const model = await loadPreferences();

  return {
    total: model.corrections_count,
    lastCorrection: model.last_correction_at,
    learnedTriggers: model.urgency_triggers.filter((t) => t.source === 'correction').length,
    learnedContacts: model.priority_contacts.filter((c) => c.source === 'correction').length,
    learnedArchivePatterns: model.auto_archive_patterns.filter((p) => p.source === 'correction').length,
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  EA_AGENT_ID,
  createDefaultModel,
};
