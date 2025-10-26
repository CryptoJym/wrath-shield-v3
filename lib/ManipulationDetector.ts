/**
 * Wrath Shield v3 - Manipulation Detection Pipeline
 *
 * Analyzes lifelog transcripts to:
 * - Flag manipulative phrases using rule-based pattern matching
 * - Score severity (1-5 scale)
 * - Classify user responses (wrath/compliance/silence)
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from './server-only-guard';

// Prevent client-side imports
ensureServerOnly('lib/ManipulationDetector');

/**
 * Manipulation pattern categories with weighted regex patterns
 */
export type ManipulationCategory =
  | 'gaslighting'
  | 'guilt'
  | 'obligation'
  | 'minimization'
  | 'blame_shift'
  | 'conditional_affection';

/**
 * User response classification types
 */
export type ResponseType = 'wrath' | 'compliance' | 'silence';

/**
 * Pattern definition for manipulation detection
 */
interface Pattern {
  re: RegExp;
  weight: number;
  tag: ManipulationCategory;
}

/**
 * Manipulation flag detected in a lifelog segment
 */
export interface ManipulationFlag {
  timestamp: string; // ISO 8601 timestamp
  text: string; // Excerpt of manipulative text
  tags: ManipulationCategory[];
  severity: number; // 1-5 scale
}

/**
 * Lifelog segment from Limitless API
 */
export interface LifelogSegment {
  speaker: 'user' | 'other';
  text: string;
  timestamp: string; // ISO 8601
}

/**
 * Analysis result for a lifelog
 */
export interface ManipulationAnalysis {
  manipulation_count: number;
  wrath_deployed: number; // 0 or 1 (boolean as integer)
  flags: ManipulationFlag[];
}

/**
 * Manipulation detection patterns with severity weights
 */
const MANIPULATION_PATTERNS: Pattern[] = [
  // Gaslighting (weight: 3)
  {
    re: /you(?:['']?re|\s+are)\s+(?:\w+\s+)?(overreacting|crazy|imagining|(?:too|so)\s+sensitive|being\s+dramatic)/i,
    weight: 3,
    tag: 'gaslighting',
  },
  {
    re: /calm\s+down|you\s+need\s+to\s+relax|it['']?s\s+(all\s+)?in\s+your\s+head/i,
    weight: 3,
    tag: 'gaslighting',
  },
  { re: /that\s+(?:\w+\s+)?never\s+happened|i\s+never\s+said\s+that/i, weight: 3, tag: 'gaslighting' },

  // Guilt trips (weight: 3)
  {
    re: /after\s+all\s+(?:i|we)(?:['']ve)?\s+done(?:\s+for\s+you)?/i,
    weight: 3,
    tag: 'guilt',
  },
  { re: /you\s+owe\s+me|i\s+did\s+this\s+for\s+you/i, weight: 3, tag: 'guilt' },
  { re: /how\s+could\s+you\s+do\s+this\s+to\s+me/i, weight: 3, tag: 'guilt' },

  // Obligation (weight: 2)
  {
    re: /you\s+should(?:n['']?t)?|you\s+must|it['']?s\s+the\s+least\s+you\s+(can|could)\s+do/i,
    weight: 2,
    tag: 'obligation',
  },
  { re: /you\s+have\s+to|you['']re\s+supposed\s+to/i, weight: 2, tag: 'obligation' },

  // Conditional affection (weight: 4)
  {
    re: /if\s+you\s+(?:\w+\s+)?(loved|cared\s+about|respected)\s+me/i,
    weight: 4,
    tag: 'conditional_affection',
  },
  { re: /real\s+(friends|partners)\s+would/i, weight: 4, tag: 'conditional_affection' },

  // Minimization (weight: 2)
  {
    re: /(?:it['']?s\s+)?not\s+(?:a\s+)?big\s+deal|you['']?re\s+making\s+a\s+big\s+deal/i,
    weight: 2,
    tag: 'minimization',
  },
  { re: /don['']?t\s+be\s+so\s+sensitive/i, weight: 2, tag: 'minimization' },

  // Blame shifting (weight: 3)
  {
    re: /it['']?s\s+your\s+fault|you\s+made\s+me\s+(?:do|say|act)/i,
    weight: 3,
    tag: 'blame_shift',
  },
  { re: /look\s+what\s+you\s+made\s+me\s+do/i, weight: 3, tag: 'blame_shift' },
];

/**
 * Intensifier patterns that increase severity
 */
const INTENSIFIERS = /\b(always|never|every\s+time|constantly|stupid|idiot|pathetic)\b/i;

/**
 * Wrath/Assertive boundary response patterns
 */
const WRATH_PATTERNS = [
  /\b(?:i\s+)?(?:will\s+not|won['']?t|refuse\s+to)/i,
  /\bthat['']?s\s+not\s+acceptable\b/i,
  /\bstop(?:\s+it|\s+that)?\b/i,
  /\b(?:i['']?m\s+)?not\s+ok(?:ay)?\s+with\s+(?:that|this)\b/i,
  /\bno\b(?!.*\bproblem\b)/i, // "no" but not "no problem"
];

/**
 * Compliance response patterns
 */
const COMPLIANCE_PATTERNS = [
  /\b(?:okay|ok|fine|whatever|sure)\b/i,
  /\b(?:i['']?m\s+)?sorry\b/i,
  /\byou['']?re\s+right\b/i,
  /\bi\s+guess(?:\s+so)?\b/i,
];

/**
 * Match manipulation patterns in text
 */
function matchPatterns(text: string): { tags: ManipulationCategory[]; baseWeight: number } | null {
  const tags: ManipulationCategory[] = [];
  let baseWeight = 0;

  for (const pattern of MANIPULATION_PATTERNS) {
    if (pattern.re.test(text)) {
      tags.push(pattern.tag);
      baseWeight += pattern.weight;
    }
  }

  return tags.length > 0 ? { tags, baseWeight } : null;
}

/**
 * Calculate severity score (1-5) based on patterns and intensifiers
 */
function calculateSeverity(text: string, baseWeight: number): number {
  let severity = baseWeight;

  // Add points for intensifiers
  const intensifierMatches = text.match(new RegExp(INTENSIFIERS, 'g'));
  if (intensifierMatches) {
    severity += intensifierMatches.length;
  }

  // Clamp to 1-5 scale
  return Math.min(5, Math.max(1, severity));
}

/**
 * Find user's response to a manipulative segment
 * Looks ahead N minutes for user's next statement
 */
function findUserResponse(
  manipulationTimestamp: string,
  segments: LifelogSegment[],
  windowMinutes: number = 5
): ResponseType {
  const manipulationTime = new Date(manipulationTimestamp).getTime();
  const windowMs = windowMinutes * 60 * 1000;

  // Find next user segment within time window
  for (const seg of segments) {
    if (seg.speaker !== 'user') continue;

    const segTime = new Date(seg.timestamp).getTime();
    const timeDiff = segTime - manipulationTime;

    // Only consider future responses within window
    if (timeDiff <= 0 || timeDiff > windowMs) continue;

    // Check for wrath/assertive patterns first
    for (const pattern of WRATH_PATTERNS) {
      if (pattern.test(seg.text)) {
        return 'wrath';
      }
    }

    // Check for compliance patterns
    for (const pattern of COMPLIANCE_PATTERNS) {
      if (pattern.test(seg.text)) {
        return 'compliance';
      }
    }

    // Found a response but it doesn't match either pattern
    // Consider it neutral/silence
    return 'silence';
  }

  // No response found within window
  return 'silence';
}

/**
 * Analyze a lifelog for manipulative phrases and responses
 *
 * @param segments - Array of conversation segments from lifelog
 * @returns Analysis with manipulation count, wrath deployment, and flags
 */
export function analyzeLifelog(segments: LifelogSegment[]): ManipulationAnalysis {
  const flags: ManipulationFlag[] = [];
  let wrathDeployed = false;

  for (const seg of segments) {
    // Only analyze segments where someone else is speaking to the user
    if (seg.speaker !== 'other') continue;

    const match = matchPatterns(seg.text);
    if (!match) continue;

    // Calculate severity
    const severity = calculateSeverity(seg.text, match.baseWeight);

    // Find user's response
    const responseType = findUserResponse(seg.timestamp, segments);

    // Create flag
    flags.push({
      timestamp: seg.timestamp,
      text: seg.text.slice(0, 200), // Truncate to 200 chars for privacy
      tags: match.tags,
      severity,
    });

    // Track if wrath was deployed
    if (responseType === 'wrath') {
      wrathDeployed = true;
    }
  }

  return {
    manipulation_count: flags.length,
    wrath_deployed: wrathDeployed ? 1 : 0,
    flags,
  };
}

/**
 * Parse lifelog raw JSON to extract segments
 *
 * Handles Limitless API format where lifelog contains:
 * - transcript: full text
 * - metadata.contents: array of segments
 *
 * @param rawJson - Serialized lifelog from Limitless API
 * @returns Array of conversation segments
 */
export function parseLifelogSegments(rawJson: string): LifelogSegment[] {
  try {
    const lifelog = JSON.parse(rawJson);

    // Check if contents array exists in expected location
    const contents = lifelog?.metadata?.contents || lifelog?.contents || [];

    if (!Array.isArray(contents)) {
      console.warn('[ManipulationDetector] No contents array found in lifelog');
      return [];
    }

    // Map to standardized segment format
    return contents
      .filter((item: any) => item?.text && item?.timestamp)
      .map((item: any) => ({
        speaker: item.speaker === 'user' ? 'user' : 'other',
        text: item.text,
        timestamp: item.timestamp,
      }));
  } catch (error) {
    console.error('[ManipulationDetector] Failed to parse lifelog JSON:', error);
    return [];
  }
}

/**
 * Convenience function to analyze lifelog from raw JSON
 *
 * Combines parsing and analysis in one call
 *
 * @param rawJson - Serialized lifelog from database
 * @returns Analysis result
 */
export function analyzeLifelogFromRaw(rawJson: string): ManipulationAnalysis {
  const segments = parseLifelogSegments(rawJson);
  return analyzeLifelog(segments);
}

/**
 * Export for testing and utilities
 */
export const _testExports = {
  matchPatterns,
  calculateSeverity,
  findUserResponse,
  MANIPULATION_PATTERNS,
  WRATH_PATTERNS,
  COMPLIANCE_PATTERNS,
  INTENSIFIERS,
};
