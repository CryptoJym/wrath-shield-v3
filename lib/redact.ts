/**
 * Wrath Shield v3 - PII Redaction Module
 *
 * Redacts personally identifiable information (PII) in UI previews
 * with click-to-reveal functionality for privacy protection.
 *
 * SECURITY: This module is designed for client-side use to protect
 * sensitive data in UI previews. Actual data remains encrypted at rest.
 */

/**
 * Types of PII that can be redacted
 */
export type PIIType =
  | 'name'
  | 'email'
  | 'phone'
  | 'address'
  | 'ssn'
  | 'credit_card'
  | 'date_of_birth'
  | 'ip_address'
  | 'url';

/**
 * Redacted segment with original text and metadata
 */
export interface RedactedSegment {
  type: PIIType;
  redacted: string; // Display text like "[NAME]"
  original: string; // Original PII value
  startIndex: number;
  endIndex: number;
}

/**
 * Result of redaction operation
 */
export interface RedactionResult {
  redactedText: string;
  segments: RedactedSegment[];
  hasPII: boolean;
}

/**
 * PII detection patterns
 */
const PII_PATTERNS = {
  // Email addresses (RFC 5322 simplified)
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // Phone numbers (US and international formats)
  // Matches: (555) 123-4567, 555-123-4567, +1 555 123 4567, etc.
  phone: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,

  // Social Security Numbers (XXX-XX-XXXX)
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,

  // Credit card numbers (13-19 digits with optional spaces/dashes)
  credit_card: /\b(?:\d{4}[-\s]?){3}\d{4}\b|\b\d{13,19}\b/g,

  // Date of birth patterns (MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD)
  date_of_birth: /\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12][0-9]|3[01])[-/](?:19|20)\d{2}\b|\b(?:19|20)\d{2}[-/](?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12][0-9]|3[01])\b/g,

  // IP addresses (IPv4)
  ip_address: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,

  // URLs (http/https)
  url: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/g,

  // US street addresses (simplified - matches common patterns)
  // Example: "123 Main St", "456 Oak Avenue Apt 2B"
  address: /\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way|Parkway|Pkwy)(?:\s+(?:Apt|Apartment|Unit|Suite|Ste|#)\s*[A-Za-z0-9]+)?\b/gi,
};

/**
 * Common first and last names for name detection
 * In production, this would be a more comprehensive list or ML model
 */
const COMMON_NAMES = new Set([
  // Common first names
  'james', 'john', 'robert', 'michael', 'william', 'david', 'richard', 'joseph',
  'thomas', 'charles', 'christopher', 'daniel', 'matthew', 'anthony', 'donald',
  'mark', 'paul', 'steven', 'andrew', 'kenneth', 'joshua', 'kevin', 'brian',
  'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan', 'jacob',
  'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott',
  'mary', 'patricia', 'jennifer', 'linda', 'barbara', 'elizabeth', 'susan',
  'jessica', 'sarah', 'karen', 'nancy', 'lisa', 'betty', 'margaret', 'sandra',
  'ashley', 'kimberly', 'emily', 'donna', 'michelle', 'dorothy', 'carol',
  'amanda', 'melissa', 'deborah', 'stephanie', 'rebecca', 'sharon', 'laura',
  'cynthia', 'kathleen', 'amy', 'angela', 'shirley', 'anna', 'brenda', 'pamela',

  // Common last names
  'smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis',
  'rodriguez', 'martinez', 'hernandez', 'lopez', 'gonzalez', 'wilson', 'anderson',
  'thomas', 'taylor', 'moore', 'jackson', 'martin', 'lee', 'perez', 'thompson',
  'white', 'harris', 'sanchez', 'clark', 'ramirez', 'lewis', 'robinson', 'walker',
  'young', 'allen', 'king', 'wright', 'scott', 'torres', 'nguyen', 'hill', 'flores',
  'green', 'adams', 'nelson', 'baker', 'hall', 'rivera', 'campbell', 'mitchell',
  'carter', 'roberts',
]);

/**
 * Detect if a word is likely a proper name (capitalized)
 */
function isPossibleName(word: string): boolean {
  // Must start with capital letter
  if (!/^[A-Z][a-z]+$/.test(word)) {
    return false;
  }

  // Check against common names list
  const lowerWord = word.toLowerCase();
  return COMMON_NAMES.has(lowerWord);
}

/**
 * Detect names in text (capitalized words that match common names)
 * This is a simplified approach - production would use NER (Named Entity Recognition)
 */
function detectNames(text: string): Array<{ match: string; index: number }> {
  const names: Array<{ match: string; index: number }> = [];
  const words = text.split(/\b/);
  let currentIndex = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Check if word is a possible name
    if (isPossibleName(word)) {
      // Check if it's at the start of a sentence or after punctuation (likely a name)
      const prevWord = i > 0 ? words[i - 1] : '';
      const isStartOfSentence = i === 0 || /[.!?]\s*$/.test(prevWord);

      // If it's a common name and NOT at the start of a sentence, it's likely a person's name
      if (!isStartOfSentence) {
        names.push({ match: word, index: currentIndex });
      }
      // Also check for full names (First Last)
      else if (i + 2 < words.length && isPossibleName(words[i + 2])) {
        const fullName = word + words[i + 1] + words[i + 2];
        names.push({ match: fullName, index: currentIndex });
        i += 2; // Skip next two words
        currentIndex += words[i + 1].length + words[i + 2].length;
      }
    }

    currentIndex += word.length;
  }

  return names;
}

/**
 * Redact PII from text, returning redacted text and segment information
 */
export function redactPII(text: string, options?: {
  types?: PIIType[];
  preserveFormat?: boolean;
}): RedactionResult {
  const typesToRedact = options?.types || [
    'name', 'email', 'phone', 'address', 'ssn',
    'credit_card', 'date_of_birth', 'ip_address', 'url'
  ];
  const preserveFormat = options?.preserveFormat ?? false;

  const segments: RedactedSegment[] = [];
  let redactedText = text;
  let offset = 0;

  // Process each PII type
  for (const type of typesToRedact) {
    if (type === 'name') {
      // Special handling for names
      const names = detectNames(text);
      for (const { match, index } of names) {
        const adjustedIndex = index + offset;
        const replacement = preserveFormat
          ? '█'.repeat(match.length)
          : '[NAME]';

        segments.push({
          type: 'name',
          redacted: replacement,
          original: match,
          startIndex: adjustedIndex,
          endIndex: adjustedIndex + replacement.length,
        });

        redactedText =
          redactedText.slice(0, adjustedIndex) +
          replacement +
          redactedText.slice(adjustedIndex + match.length);

        offset += replacement.length - match.length;
      }
    } else {
      // Pattern-based redaction for other types
      const pattern = PII_PATTERNS[type as keyof typeof PII_PATTERNS];
      if (!pattern) continue;

      let match;
      const regex = new RegExp(pattern.source, pattern.flags);

      while ((match = regex.exec(text)) !== null) {
        const adjustedIndex = match.index + offset;
        const replacement = preserveFormat
          ? '█'.repeat(match[0].length)
          : `[${type.toUpperCase()}]`;

        segments.push({
          type,
          redacted: replacement,
          original: match[0],
          startIndex: adjustedIndex,
          endIndex: adjustedIndex + replacement.length,
        });

        redactedText =
          redactedText.slice(0, adjustedIndex) +
          replacement +
          redactedText.slice(adjustedIndex + match[0].length);

        offset += replacement.length - match[0].length;
      }
    }
  }

  return {
    redactedText,
    segments,
    hasPII: segments.length > 0,
  };
}

/**
 * Reveal PII at specific segment index
 */
export function revealSegment(
  redactionResult: RedactionResult,
  segmentIndex: number
): string {
  if (segmentIndex < 0 || segmentIndex >= redactionResult.segments.length) {
    return redactionResult.redactedText;
  }

  const segment = redactionResult.segments[segmentIndex];
  let result = redactionResult.redactedText;

  // Replace the redacted portion with the original
  result =
    result.slice(0, segment.startIndex) +
    segment.original +
    result.slice(segment.endIndex);

  return result;
}

/**
 * Reveal all PII in the text
 */
export function revealAll(redactionResult: RedactionResult): string {
  let result = redactionResult.redactedText;

  // Process segments in reverse order to maintain correct indices
  const sortedSegments = [...redactionResult.segments].sort(
    (a, b) => b.startIndex - a.startIndex
  );

  for (const segment of sortedSegments) {
    result =
      result.slice(0, segment.startIndex) +
      segment.original +
      result.slice(segment.endIndex);
  }

  return result;
}

/**
 * Count PII occurrences by type
 */
export function countPII(redactionResult: RedactionResult): Record<PIIType, number> {
  const counts: Record<string, number> = {};

  for (const segment of redactionResult.segments) {
    counts[segment.type] = (counts[segment.type] || 0) + 1;
  }

  return counts as Record<PIIType, number>;
}

/**
 * Check if text contains any PII
 */
export function hasPII(text: string, types?: PIIType[]): boolean {
  const result = redactPII(text, { types });
  return result.hasPII;
}

/**
 * Truncate text and redact PII (for previews)
 */
export function redactAndTruncate(
  text: string,
  maxLength: number = 200,
  options?: { types?: PIIType[]; preserveFormat?: boolean }
): RedactionResult {
  // First redact
  const result = redactPII(text, options);

  // Then truncate if needed
  if (result.redactedText.length > maxLength) {
    const truncated = result.redactedText.slice(0, maxLength) + '...';

    // Filter segments that are still within the truncated text
    const validSegments = result.segments.filter(
      seg => seg.startIndex < maxLength
    );

    return {
      redactedText: truncated,
      segments: validSegments,
      hasPII: validSegments.length > 0,
    };
  }

  return result;
}
