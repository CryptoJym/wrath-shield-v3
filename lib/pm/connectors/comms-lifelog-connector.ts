/**
 * Comms Lifelog Connector
 *
 * Monitors lifelog entries from Comms agent (Limitless integration)
 * Detects action items and follow-ups within lifelog content
 * Feeds signals to PM Agent Task Queue for intelligent routing
 *
 * ARCHITECTURE:
 * 1. Parse lifelog entries from SQLite (raw_json field)
 * 2. Detect action items using pattern matching + confidence scoring
 * 3. Extract metadata (urgency, people, projects, context)
 * 4. Create signals and enqueue to PM Task Queue
 * 5. Track metrics and log all actions
 *
 * INTEGRATION:
 * - Database: lib/db/queries (getLifelogsForDate)
 * - Task Queue: lib/pm/task-queue (enqueueSignal)
 * - Types: lib/db/types (Lifelog)
 */

import { ensureServerOnly } from '../../server-only-guard';
import { getLifelogsForDate } from '../../db/queries';
import type { Lifelog } from '../../db/types';
import { enqueueSignal, type IncomingSignal } from '../task-queue';
import * as crypto from 'crypto';

ensureServerOnly('lib/pm/connectors/comms-lifelog-connector');

// ============================================================================
// Types
// ============================================================================

export interface ActionItem {
  text: string;
  type: 'task' | 'follow_up';
  confidence: number; // 0-1
  urgency: 'low' | 'medium' | 'high';
  context?: string;
  people?: string[];
  project?: string;
  source: {
    lifelog_id: string;
    date: string;
    excerpt: string; // Surrounding text
  };
}

export interface ProcessingResult {
  lifelog_id: string;
  date: string;
  items_found: number;
  signals_created: string[]; // Queue IDs from enqueueSignal()
  errors: string[];
}

export interface SyncResult {
  processed: number;
  total_items: number;
  total_signals: number;
  errors: string[];
  skipped: number;
}

// ============================================================================
// Action Item Detection Patterns
// ============================================================================

interface ActionPattern {
  pattern: RegExp;
  baseConfidence: number;
  type: 'task' | 'follow_up';
  description: string;
}

const ACTION_PATTERNS: ActionPattern[] = [
  // High confidence patterns (explicit markers)
  {
    pattern: /\bTODO:\s*([^.!?\n]+)/gi,
    baseConfidence: 0.95,
    type: 'task',
    description: 'TODO marker',
  },
  {
    pattern: /\bREMINDER:\s*([^.!?\n]+)/gi,
    baseConfidence: 0.9,
    type: 'task',
    description: 'REMINDER marker',
  },
  {
    pattern: /\bACTION:\s*([^.!?\n]+)/gi,
    baseConfidence: 0.95,
    type: 'task',
    description: 'ACTION marker',
  },
  {
    pattern: /\bTASK:\s*([^.!?\n]+)/gi,
    baseConfidence: 0.95,
    type: 'task',
    description: 'TASK marker',
  },

  // Medium-high confidence patterns (imperative phrases)
  {
    pattern: /\b(?:I|we) (?:need|must|have) to\s+([^.!?]+)/gi,
    baseConfidence: 0.85,
    type: 'task',
    description: 'Imperative need',
  },
  {
    pattern: /\b(?:I|we) should\s+([^.!?]+)/gi,
    baseConfidence: 0.8,
    type: 'task',
    description: 'Should statement',
  },
  {
    pattern: /\b(?:I|we) will\s+([^.!?]+)/gi,
    baseConfidence: 0.75,
    type: 'task',
    description: 'Future commitment',
  },

  // Follow-up patterns
  {
    pattern: /\bfollow(?:-|\s)?up (?:with|on)\s+([^.!?]+)/gi,
    baseConfidence: 0.85,
    type: 'follow_up',
    description: 'Follow-up phrase',
  },
  {
    pattern: /\bcheck in (?:with|on)\s+([^.!?]+)/gi,
    baseConfidence: 0.8,
    type: 'follow_up',
    description: 'Check-in phrase',
  },
  {
    pattern: /\breach out to\s+([^.!?]+)/gi,
    baseConfidence: 0.75,
    type: 'follow_up',
    description: 'Reach out phrase',
  },

  // Decision-based actions
  {
    pattern: /\bdecided to\s+([^.!?]+)/gi,
    baseConfidence: 0.7,
    type: 'task',
    description: 'Decision made',
  },
  {
    pattern: /\bneed to decide\s+([^.!?]+)/gi,
    baseConfidence: 0.75,
    type: 'task',
    description: 'Decision needed',
  },

  // Remember phrases
  {
    pattern: /\bremember to\s+([^.!?]+)/gi,
    baseConfidence: 0.75,
    type: 'task',
    description: 'Remember phrase',
  },
  {
    pattern: /\bdon't forget to\s+([^.!?]+)/gi,
    baseConfidence: 0.8,
    type: 'task',
    description: 'Don\'t forget phrase',
  },

  // Meeting notes patterns
  {
    pattern: /\baction items?:\s*([^.!?\n]+)/gi,
    baseConfidence: 0.9,
    type: 'task',
    description: 'Meeting action item',
  },
  {
    pattern: /\bnext steps?:\s*([^.!?\n]+)/gi,
    baseConfidence: 0.85,
    type: 'task',
    description: 'Next steps',
  },
  {
    pattern: /\bassigned to me:\s*([^.!?\n]+)/gi,
    baseConfidence: 0.95,
    type: 'task',
    description: 'Assigned action',
  },
];

const URGENCY_KEYWORDS = {
  high: ['urgent', 'asap', 'immediately', 'critical', 'today', 'now', 'emergency', 'deadline'],
  medium: ['soon', 'this week', 'important', 'should', 'needed', 'required'],
  low: ['eventually', 'someday', 'maybe', 'consider', 'if possible', 'nice to have'],
};

// ============================================================================
// Action Item Detection
// ============================================================================

/**
 * Extract action items from text using pattern matching
 */
export function detectActionItems(text: string, metadata: { lifelog_id: string; date: string }): ActionItem[] {
  const items: ActionItem[] = [];
  const lowercaseText = text.toLowerCase();

  // Check each pattern
  for (const { pattern, baseConfidence, type, description } of ACTION_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(text)) !== null) {
      const matchedText = match[1]?.trim();
      if (!matchedText || matchedText.length < 5) {
        continue; // Skip very short matches
      }

      // Extract context (50 chars before and after)
      const matchIndex = match.index;
      const contextStart = Math.max(0, matchIndex - 50);
      const contextEnd = Math.min(text.length, matchIndex + match[0].length + 50);
      const context = text.slice(contextStart, contextEnd).trim();

      // Calculate confidence
      let confidence = baseConfidence;

      // Adjust confidence based on text quality
      if (matchedText.length < 10) {
        confidence *= 0.8; // Very short actions are less confident
      }
      if (matchedText.includes('?')) {
        confidence *= 0.7; // Questions are less actionable
      }
      if (/\b(?:might|could|maybe)\b/i.test(matchedText)) {
        confidence *= 0.6; // Tentative language reduces confidence
      }

      // Determine urgency
      let urgency: 'low' | 'medium' | 'high' = 'medium';
      for (const [level, keywords] of Object.entries(URGENCY_KEYWORDS)) {
        for (const keyword of keywords) {
          if (lowercaseText.includes(keyword)) {
            urgency = level as 'low' | 'medium' | 'high';
            break;
          }
        }
      }

      // Extract people (simple capitalized word detection after common prepositions)
      const people: string[] = [];
      const peoplePattern = /\b(?:with|to|for|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
      let personMatch;
      while ((personMatch = peoplePattern.exec(matchedText)) !== null) {
        people.push(personMatch[1]);
      }

      // Extract project references (look for capitalized multi-word phrases)
      const projectPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s+(?:project|initiative|campaign)/gi;
      const projectMatch = projectPattern.exec(matchedText);
      const project = projectMatch ? projectMatch[1] : undefined;

      // Get excerpt (first 150 chars of matched text)
      const excerpt = matchedText.slice(0, 150) + (matchedText.length > 150 ? '...' : '');

      items.push({
        text: matchedText,
        type,
        confidence: Math.min(confidence, 1.0), // Cap at 1.0
        urgency,
        context,
        people: people.length > 0 ? people : undefined,
        project,
        source: {
          lifelog_id: metadata.lifelog_id,
          date: metadata.date,
          excerpt,
        },
      });
    }
  }

  // Deduplicate similar items (same text within 20 chars)
  const deduplicated = items.filter((item, index) => {
    for (let i = 0; i < index; i++) {
      if (isSimilarText(item.text, items[i].text)) {
        return false; // Skip duplicate
      }
    }
    return true;
  });

  console.log(`[Comms Lifelog Connector] Detected ${deduplicated.length} action items (${items.length - deduplicated.length} duplicates removed)`);

  return deduplicated;
}

/**
 * Check if two texts are similar (simple Levenshtein-like comparison)
 */
function isSimilarText(a: string, b: string): boolean {
  const minLength = Math.min(a.length, b.length);
  if (minLength < 20) return a.toLowerCase() === b.toLowerCase();

  // Check if one contains the other (after lowercasing)
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  return lowerA.includes(lowerB) || lowerB.includes(lowerA);
}

// ============================================================================
// Lifelog Processing
// ============================================================================

/**
 * Process a single lifelog entry and create signals for detected action items
 */
export async function processLifelogEntry(entry: Lifelog): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    lifelog_id: entry.id,
    date: entry.date,
    items_found: 0,
    signals_created: [],
    errors: [],
  };

  try {
    console.log(`[Comms Lifelog Connector] Processing lifelog ${entry.id} (${entry.date})`);

    // Extract text content from lifelog
    let text = entry.title || '';

    // Parse raw_json if available
    if (entry.raw_json) {
      try {
        const parsed = JSON.parse(entry.raw_json);

        // Extract text from common Limitless API fields
        if (parsed.note) text += '\n' + parsed.note;
        if (parsed.text) text += '\n' + parsed.text;
        if (parsed.summary) text += '\n' + parsed.summary;
        if (parsed.content) text += '\n' + parsed.content;
        if (parsed.markdown) text += '\n' + parsed.markdown;
        if (parsed.transcript) text += '\n' + parsed.transcript;

        // Handle array of messages/entries
        if (Array.isArray(parsed.messages)) {
          for (const msg of parsed.messages) {
            if (typeof msg === 'string') {
              text += '\n' + msg;
            } else if (msg && typeof msg === 'object') {
              if (msg.content) text += '\n' + msg.content;
              if (msg.text) text += '\n' + msg.text;
            }
          }
        }
      } catch (parseError) {
        result.errors.push(`Failed to parse raw_json: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        console.warn(`[Comms Lifelog Connector] Failed to parse raw_json for ${entry.id}:`, parseError);
      }
    }

    // Skip if no meaningful text
    if (!text || text.trim().length < 10) {
      console.log(`[Comms Lifelog Connector] Skipping ${entry.id}: insufficient text`);
      return result;
    }

    // Detect action items
    const items = detectActionItems(text, {
      lifelog_id: entry.id,
      date: entry.date,
    });

    result.items_found = items.length;

    if (items.length === 0) {
      console.log(`[Comms Lifelog Connector] No action items found in ${entry.id}`);
      return result;
    }

    // Create signals for each action item
    for (const item of items) {
      try {
        // Build signal payload
        const payload: Record<string, unknown> = {
          title: item.text,
          context: item.context,
          urgency: item.urgency,
          source_lifelog_id: entry.id,
          source_date: entry.date,
          excerpt: item.source.excerpt,
        };

        if (item.people && item.people.length > 0) {
          payload.people = item.people;
          payload.contact_name = item.people[0]; // First person for follow-ups
        }

        if (item.project) {
          payload.project_name = item.project;
        }

        // Determine signal type based on item type
        const signalType = item.type === 'follow_up' ? 'follow_up' : 'task';

        // Add importance flag for high urgency follow-ups (triggers PROPOSE escalation)
        if (item.type === 'follow_up' && item.urgency === 'high') {
          payload.importance = 'high';
        }

        // Create signal
        const signal: IncomingSignal = {
          id: `comms-lifelog-${entry.id}-${crypto.randomBytes(4).toString('hex')}`,
          source: 'comms',
          signal_type: signalType,
          payload,
          timestamp: Date.now(),
          confidence: item.confidence,
        };

        // Enqueue signal
        const queueId = await enqueueSignal(signal);
        result.signals_created.push(queueId);

        console.log(`[Comms Lifelog Connector] Created ${signalType} signal ${queueId} (confidence: ${item.confidence.toFixed(2)})`);
      } catch (signalError) {
        const errorMsg = `Failed to create signal for item "${item.text}": ${signalError instanceof Error ? signalError.message : String(signalError)}`;
        result.errors.push(errorMsg);
        console.error(`[Comms Lifelog Connector] ${errorMsg}`);
      }
    }

    console.log(`[Comms Lifelog Connector] Completed ${entry.id}: ${result.items_found} items, ${result.signals_created.length} signals`);
  } catch (error) {
    const errorMsg = `Failed to process lifelog ${entry.id}: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMsg);
    console.error(`[Comms Lifelog Connector] ${errorMsg}`);
  }

  return result;
}

/**
 * Batch process recent lifelogs since a given date
 */
export async function syncRecentLifelogs(since: Date, userId?: string): Promise<SyncResult> {
  const result: SyncResult = {
    processed: 0,
    total_items: 0,
    total_signals: 0,
    errors: [],
    skipped: 0,
  };

  try {
    console.log(`[Comms Lifelog Connector] Syncing lifelogs since ${since.toISOString()}`);

    // Get all dates from since until today
    const dates: string[] = [];
    const currentDate = new Date(since);
    const today = new Date();

    while (currentDate <= today) {
      dates.push(currentDate.toISOString().split('T')[0]); // YYYY-MM-DD
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`[Comms Lifelog Connector] Querying ${dates.length} dates`);

    // Process each date
    for (const date of dates) {
      try {
        const lifelogs = getLifelogsForDate(date, userId);

        if (lifelogs.length === 0) {
          continue;
        }

        console.log(`[Comms Lifelog Connector] Processing ${lifelogs.length} lifelogs for ${date}`);

        for (const entry of lifelogs) {
          const entryResult = await processLifelogEntry(entry);

          result.processed++;
          result.total_items += entryResult.items_found;
          result.total_signals += entryResult.signals_created.length;

          if (entryResult.errors.length > 0) {
            result.errors.push(...entryResult.errors);
          }

          if (entryResult.items_found === 0) {
            result.skipped++;
          }
        }
      } catch (dateError) {
        const errorMsg = `Failed to process date ${date}: ${dateError instanceof Error ? dateError.message : String(dateError)}`;
        result.errors.push(errorMsg);
        console.error(`[Comms Lifelog Connector] ${errorMsg}`);
      }
    }

    console.log(`[Comms Lifelog Connector] Sync complete: ${result.processed} processed, ${result.total_signals} signals created, ${result.skipped} skipped`);
  } catch (error) {
    const errorMsg = `Sync failed: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMsg);
    console.error(`[Comms Lifelog Connector] ${errorMsg}`);
  }

  return result;
}

// ============================================================================
// Real-time Integration (Future - Phase 3)
// ============================================================================

/**
 * Register with UnifiedBus for real-time lifelog updates
 * @future Phase 3 implementation
 */
export function registerWithBus(): void {
  // TODO: Phase 3
  // Listen for lifelog creation events via UnifiedBus
  // Process new entries in real-time as they're created
  console.log('[Comms Lifelog Connector] Real-time bus registration not yet implemented');
}
