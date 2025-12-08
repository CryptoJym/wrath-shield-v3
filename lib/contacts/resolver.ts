/**
 * Contact Resolution Module
 *
 * Provides functions to match raw contact strings (emails, phones, names)
 * to canonical contacts in the relationships database.
 *
 * Features:
 * - Email/phone normalization
 * - Fuzzy name matching
 * - Auto-creation of new contacts
 * - Confidence scoring
 */

import { getRelationshipDb, upsertContact, type ContactRow } from '../relationshipDb';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface ContactMatch {
  contact_id: string;
  display_name: string | null;
  handle: string;
  canonical_handle: string | null;
  confidence: number;
  match_type: 'exact' | 'canonical' | 'fuzzy' | 'new';
}

export interface ResolveOptions {
  autoCreate?: boolean; // Create contact if not found (default: true)
  minConfidence?: number; // Minimum confidence for fuzzy matches (default: 0.7)
  source?: string; // Source of the contact (email, imessage, lifelog)
}

// ============================================================================
// Normalization Helpers
// ============================================================================

/**
 * Normalize an email address to canonical form
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';

  const trimmed = email.trim().toLowerCase();

  // Handle Gmail plus addressing (user+tag@gmail.com -> user@gmail.com)
  const gmailMatch = trimmed.match(/^([^+]+)\+[^@]+@(gmail\.com|googlemail\.com)$/i);
  if (gmailMatch) {
    return `${gmailMatch[1]}@gmail.com`;
  }

  // Handle googlemail.com -> gmail.com
  if (trimmed.endsWith('@googlemail.com')) {
    return trimmed.replace('@googlemail.com', '@gmail.com');
  }

  return trimmed;
}

/**
 * Normalize a phone number to E.164-like format
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';

  // Remove all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // If starts with +, keep it; otherwise add +1 for US numbers
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // 10-digit US number
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // 11-digit with leading 1
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  return cleaned;
}

/**
 * Normalize a name for comparison
 */
export function normalizeName(name: string): string {
  if (!name) return '';

  return name
    .trim()
    .toLowerCase()
    // Remove common suffixes and prefixes
    .replace(/\b(mr|mrs|ms|dr|jr|sr|ii|iii|iv)\.?\b/gi, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Determine the type of a contact handle
 */
export function getHandleType(handle: string): 'email' | 'phone' | 'name' {
  if (!handle) return 'name';

  const trimmed = handle.trim();

  // Check if email
  if (trimmed.includes('@') && trimmed.includes('.')) {
    return 'email';
  }

  // Check if phone (contains mostly digits)
  const digitCount = (trimmed.match(/\d/g) || []).length;
  if (digitCount >= 7 && digitCount / trimmed.length > 0.5) {
    return 'phone';
  }

  return 'name';
}

/**
 * Generate a canonical handle from a raw handle
 */
export function getCanonicalHandle(handle: string): string {
  const type = getHandleType(handle);

  switch (type) {
    case 'email':
      return normalizeEmail(handle);
    case 'phone':
      return normalizePhone(handle);
    case 'name':
      return normalizeName(handle);
    default:
      return handle.trim().toLowerCase();
  }
}

// ============================================================================
// Fuzzy Matching
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
export function calculateSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const normalizedA = a.toLowerCase().trim();
  const normalizedB = b.toLowerCase().trim();

  if (normalizedA === normalizedB) return 1;

  const maxLength = Math.max(normalizedA.length, normalizedB.length);
  if (maxLength === 0) return 1;

  const distance = levenshteinDistance(normalizedA, normalizedB);
  return 1 - distance / maxLength;
}

// ============================================================================
// Contact Resolution
// ============================================================================

/**
 * Find contacts by handle (exact or canonical match)
 */
export function findContactsByHandle(handle: string): ContactRow[] {
  const db = getRelationshipDb();
  if (!db) return [];

  const canonical = getCanonicalHandle(handle);

  try {
    const stmt = db.prepare(`
      SELECT * FROM contacts
      WHERE handle = ? OR canonical_handle = ? OR handle = ? OR canonical_handle = ?
      ORDER BY last_ts DESC
    `);
    return stmt.all(handle, handle, canonical, canonical) as ContactRow[];
  } catch (error) {
    console.error('[Contact Resolver] Error finding contacts:', error);
    return [];
  }
}

/**
 * Find contacts by name (fuzzy match)
 */
export function findContactsByName(name: string, minConfidence = 0.7): Array<ContactRow & { similarity: number }> {
  const db = getRelationshipDb();
  if (!db) return [];

  const normalizedName = normalizeName(name);
  if (!normalizedName) return [];

  try {
    const stmt = db.prepare(`SELECT * FROM contacts WHERE display_name IS NOT NULL`);
    const all = stmt.all() as ContactRow[];

    return all
      .map((contact) => ({
        ...contact,
        similarity: calculateSimilarity(normalizeName(contact.display_name || ''), normalizedName),
      }))
      .filter((c) => c.similarity >= minConfidence)
      .sort((a, b) => b.similarity - a.similarity);
  } catch (error) {
    console.error('[Contact Resolver] Error finding contacts by name:', error);
    return [];
  }
}

/**
 * Resolve a raw contact string to a canonical contact
 */
export function resolveContact(
  handle: string,
  displayName?: string,
  options: ResolveOptions = {}
): ContactMatch | null {
  const {
    autoCreate = true,
    minConfidence = 0.7,
    source,
  } = options;

  if (!handle || handle.trim() === '') {
    return null;
  }

  const trimmedHandle = handle.trim();
  const canonical = getCanonicalHandle(trimmedHandle);
  const handleType = getHandleType(trimmedHandle);

  // Step 1: Try exact match on handle or canonical_handle
  const exactMatches = findContactsByHandle(trimmedHandle);
  if (exactMatches.length > 0) {
    const best = exactMatches[0];
    const isExact = best.handle === trimmedHandle || best.canonical_handle === trimmedHandle;

    return {
      contact_id: best.id,
      display_name: best.display_name,
      handle: best.handle,
      canonical_handle: best.canonical_handle || null,
      confidence: isExact ? 1.0 : 0.95,
      match_type: isExact ? 'exact' : 'canonical',
    };
  }

  // Step 2: Try fuzzy name match if we have a name
  if (displayName || handleType === 'name') {
    const nameToMatch = displayName || trimmedHandle;
    const fuzzyMatches = findContactsByName(nameToMatch, minConfidence);

    if (fuzzyMatches.length > 0) {
      const best = fuzzyMatches[0];
      return {
        contact_id: best.id,
        display_name: best.display_name,
        handle: best.handle,
        canonical_handle: best.canonical_handle || null,
        confidence: best.similarity,
        match_type: 'fuzzy',
      };
    }
  }

  // Step 3: Auto-create if enabled
  if (autoCreate) {
    const contactId = `contact_${crypto.randomBytes(8).toString('hex')}`;

    const newContact: ContactRow = {
      id: contactId,
      display_name: displayName || (handleType === 'name' ? trimmedHandle : null),
      handle: trimmedHandle,
      canonical_handle: canonical !== trimmedHandle ? canonical : null,
      confidence: null,
      last_ts: Math.floor(Date.now() / 1000),
      last_text: null,
      message_count: 0,
      sent_count: 0,
      recv_count: 0,
    };

    upsertContact(newContact);

    console.log(`[Contact Resolver] Created new contact: ${contactId} for ${trimmedHandle}`);

    return {
      contact_id: contactId,
      display_name: newContact.display_name,
      handle: trimmedHandle,
      canonical_handle: newContact.canonical_handle ?? null,
      confidence: 1.0,
      match_type: 'new',
    };
  }

  return null;
}

/**
 * Resolve multiple contacts from a lifelog
 * Extracts names mentioned in the content and resolves them
 */
export function resolveContactsFromText(
  text: string,
  options: ResolveOptions = {}
): ContactMatch[] {
  if (!text) return [];

  const matches: ContactMatch[] = [];
  const seen = new Set<string>();

  // Pattern to find names: capitalized words after common prepositions
  const namePatterns = [
    /\b(?:with|to|from|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
    /\b(?:met|called|texted|emailed|talked to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:said|mentioned|asked|told|suggested)/g,
  ];

  for (const pattern of namePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();

      // Skip common words that might be capitalized
      const skipWords = ['the', 'and', 'but', 'for', 'with', 'from', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      if (skipWords.includes(name.toLowerCase())) continue;

      // Skip if already seen
      const normalized = normalizeName(name);
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      // Resolve the contact
      const resolved = resolveContact(name, name, { ...options, autoCreate: false });
      if (resolved) {
        matches.push(resolved);
      }
    }
  }

  return matches;
}

/**
 * Get contact by ID
 */
export function getContactById(contactId: string): ContactRow | null {
  const db = getRelationshipDb();
  if (!db) return null;

  try {
    const stmt = db.prepare(`SELECT * FROM contacts WHERE id = ?`);
    return (stmt.get(contactId) as ContactRow) || null;
  } catch (error) {
    console.error('[Contact Resolver] Error getting contact:', error);
    return null;
  }
}

/**
 * Update contact's last interaction
 */
export function updateContactInteraction(
  contactId: string,
  text: string,
  direction: 'sent' | 'recv'
): void {
  const db = getRelationshipDb();
  if (!db) return;

  try {
    const stmt = db.prepare(`
      UPDATE contacts
      SET last_ts = ?,
          last_text = ?,
          message_count = message_count + 1,
          ${direction}_count = ${direction}_count + 1,
          updated_at = strftime('%s', 'now')
      WHERE id = ?
    `);
    stmt.run(Math.floor(Date.now() / 1000), text?.substring(0, 200) || null, contactId);
  } catch (error) {
    console.error('[Contact Resolver] Error updating contact interaction:', error);
  }
}

/**
 * Link an event to a contact
 */
export function linkEventToContact(
  eventId: string,
  contactId: string
): void {
  // Import dynamically to avoid circular dependency
  const { getDb } = require('../events');

  try {
    const db = getDb();
    if (!db) return;

    // Check if contact_id column exists
    const cols = db.prepare("PRAGMA table_info('events')").all() as any[];
    const hasContactId = cols.some((c: any) => c.name === 'contact_id');

    if (!hasContactId) {
      // Add the column if it doesn't exist
      db.exec("ALTER TABLE events ADD COLUMN contact_id TEXT");
      db.exec("CREATE INDEX IF NOT EXISTS idx_events_contact_id ON events(contact_id)");
    }

    const stmt = db.prepare(`UPDATE events SET contact_id = ? WHERE id = ?`);
    stmt.run(contactId, eventId);
    db.close();
  } catch (error) {
    console.error('[Contact Resolver] Error linking event to contact:', error);
  }
}
