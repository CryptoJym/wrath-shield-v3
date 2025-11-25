/**
 * PM Agent Relationships Map
 *
 * Normalizes person entities from comms (email/imessage/lifelogs) into
 * a unified relationship map with roles, projects, orgs, and freshness.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import crypto from 'crypto';

// Types
export interface CommsSource {
  channel: 'email' | 'imessage' | 'lifelog' | 'manual';
  timestamp: number; // Unix seconds
  link?: string; // Optional deep link
  snippet?: string; // Last message snippet
}

export interface PersonEntity {
  id: string; // SHA1 of canonical identifier
  canonical_id: string; // Email or phone (normalized)
  display_name: string | null;
  emails: string[];
  phones: string[];
  roles: string[];
  projects: string[];
  orgs: string[];
  last_source: CommsSource;
  last_seen: number; // Unix seconds
  message_count: number;
  confidence: number; // 0-1 merge confidence
  metadata?: Record<string, unknown>;
}

export interface RelationshipsMap {
  version: string;
  updated_at: number;
  persons: PersonEntity[];
}

// Storage path
const RELATIONSHIPS_PATH = resolve(process.cwd(), '.data', 'pm-relationships.json');

/**
 * Load relationships map from disk
 */
export function loadRelationshipsMap(): RelationshipsMap {
  if (!existsSync(RELATIONSHIPS_PATH)) {
    return {
      version: '1.0',
      updated_at: Math.floor(Date.now() / 1000),
      persons: [],
    };
  }
  try {
    const raw = readFileSync(RELATIONSHIPS_PATH, 'utf-8');
    return JSON.parse(raw) as RelationshipsMap;
  } catch {
    return {
      version: '1.0',
      updated_at: Math.floor(Date.now() / 1000),
      persons: [],
    };
  }
}

/**
 * Save relationships map to disk
 */
export function saveRelationshipsMap(map: RelationshipsMap): void {
  const dir = dirname(RELATIONSHIPS_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  map.updated_at = Math.floor(Date.now() / 1000);
  writeFileSync(RELATIONSHIPS_PATH, JSON.stringify(map, null, 2), 'utf-8');
}

/**
 * Normalize an identifier (email or phone)
 */
export function normalizeIdentifier(raw: string): { type: 'email' | 'phone' | 'unknown'; value: string; confidence: number } {
  if (!raw) return { type: 'unknown', value: raw, confidence: 0 };

  const trimmed = raw.trim().toLowerCase();

  // Email detection
  if (trimmed.includes('@')) {
    return { type: 'email', value: trimmed, confidence: 0.98 };
  }

  // Phone detection (extract digits)
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    const confidence = digits.length === 10 ? 0.99 : 0.94;
    return { type: 'phone', value: last10, confidence };
  }

  return { type: 'unknown', value: trimmed, confidence: 0.5 };
}

/**
 * Generate person ID from canonical identifier
 */
export function generatePersonId(canonical: string): string {
  return crypto.createHash('sha1').update(canonical).digest('hex').slice(0, 16);
}

/**
 * Extract roles from message content or metadata
 */
export function extractRoles(content: string, metadata?: Record<string, unknown>): string[] {
  const roles: Set<string> = new Set();

  // Check metadata first
  if (metadata?.role) roles.add(String(metadata.role));
  if (metadata?.title) roles.add(String(metadata.title));

  // Pattern matching for common role indicators
  const rolePatterns = [
    /(?:i(?:'m| am) (?:a |the )?)([\w\s]+?(?:manager|director|engineer|developer|designer|ceo|cto|cfo|vp|founder|owner|consultant|analyst|coordinator|specialist|lead))/gi,
    /(?:my role is |working as )([\w\s]+)/gi,
    /(?:^|\s)(CEO|CTO|CFO|COO|VP|SVP|EVP|CMO|CIO|CISO|CPO)(?:\s|$|,)/g,
  ];

  for (const pattern of rolePatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        roles.add(match[1].trim().toLowerCase());
      }
    }
  }

  return Array.from(roles).slice(0, 5); // Limit to 5 roles
}

/**
 * Extract project references from content
 */
export function extractProjects(content: string, metadata?: Record<string, unknown>): string[] {
  const projects: Set<string> = new Set();

  // Check metadata
  if (metadata?.project) projects.add(String(metadata.project));
  if (metadata?.projects && Array.isArray(metadata.projects)) {
    metadata.projects.forEach((p) => projects.add(String(p)));
  }

  // Known project patterns (from exec priorities)
  const knownProjects = [
    'utlyze',
    'vuplicity',
    'kahoa',
    'solutionstream',
    'solution stream',
    'new reward',
    'wrath shield',
    'fcra',
    'of one',
    'businessofone',
  ];

  const lowerContent = content.toLowerCase();
  for (const proj of knownProjects) {
    if (lowerContent.includes(proj)) {
      projects.add(proj);
    }
  }

  return Array.from(projects).slice(0, 5);
}

/**
 * Extract organization references from content
 */
export function extractOrgs(content: string, metadata?: Record<string, unknown>): string[] {
  const orgs: Set<string> = new Set();

  // Check metadata
  if (metadata?.company) orgs.add(String(metadata.company));
  if (metadata?.organization) orgs.add(String(metadata.organization));
  if (metadata?.org) orgs.add(String(metadata.org));

  // Email domain extraction
  const emailPattern = /@([\w.-]+\.\w+)/g;
  const emailMatches = content.matchAll(emailPattern);
  for (const match of emailMatches) {
    const domain = match[1].toLowerCase();
    // Skip common email providers
    if (!['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'me.com'].includes(domain)) {
      // Extract company name from domain
      const parts = domain.split('.');
      if (parts.length >= 2) {
        orgs.add(parts[0]);
      }
    }
  }

  return Array.from(orgs).slice(0, 5);
}

/**
 * Input entity from comms feed
 */
export interface CommsEntity {
  handle: string; // Email or phone
  display_name?: string | null;
  channel: 'email' | 'imessage' | 'lifelog' | 'manual';
  timestamp: number;
  content?: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Normalize and merge a comms entity into the relationships map
 */
export function normalizeAndMerge(entity: CommsEntity, map: RelationshipsMap): PersonEntity {
  const normalized = normalizeIdentifier(entity.handle);
  const personId = generatePersonId(normalized.value);

  // Find existing person
  let person = map.persons.find((p) => p.id === personId);

  // Extract enrichments
  const content = entity.content || '';
  const roles = extractRoles(content, entity.metadata);
  const projects = extractProjects(content, entity.metadata);
  const orgs = extractOrgs(content + ' ' + entity.handle, entity.metadata);

  const source: CommsSource = {
    channel: entity.channel,
    timestamp: entity.timestamp,
    link: entity.link,
    snippet: content.slice(0, 100),
  };

  if (person) {
    // Merge into existing
    if (normalized.type === 'email' && !person.emails.includes(normalized.value)) {
      person.emails.push(normalized.value);
    }
    if (normalized.type === 'phone' && !person.phones.includes(normalized.value)) {
      person.phones.push(normalized.value);
    }

    // Merge roles/projects/orgs (dedupe)
    person.roles = [...new Set([...person.roles, ...roles])].slice(0, 10);
    person.projects = [...new Set([...person.projects, ...projects])].slice(0, 10);
    person.orgs = [...new Set([...person.orgs, ...orgs])].slice(0, 10);

    // Update display name if we have a better one
    if (entity.display_name && !person.display_name) {
      person.display_name = entity.display_name;
    }

    // Update last seen
    if (entity.timestamp > person.last_seen) {
      person.last_seen = entity.timestamp;
      person.last_source = source;
    }

    person.message_count++;
    person.confidence = Math.max(person.confidence, normalized.confidence);
  } else {
    // Create new person
    person = {
      id: personId,
      canonical_id: normalized.value,
      display_name: entity.display_name || null,
      emails: normalized.type === 'email' ? [normalized.value] : [],
      phones: normalized.type === 'phone' ? [normalized.value] : [],
      roles,
      projects,
      orgs,
      last_source: source,
      last_seen: entity.timestamp,
      message_count: 1,
      confidence: normalized.confidence,
    };
    map.persons.push(person);
  }

  return person;
}

/**
 * Find person by email or phone
 */
export function findPerson(map: RelationshipsMap, identifier: string): PersonEntity | undefined {
  const normalized = normalizeIdentifier(identifier);
  return map.persons.find(
    (p) =>
      p.canonical_id === normalized.value ||
      p.emails.includes(normalized.value) ||
      p.phones.includes(normalized.value)
  );
}

/**
 * Get all persons sorted by last_seen (most recent first)
 */
export function getPersonsByRecency(map: RelationshipsMap, limit = 50): PersonEntity[] {
  return [...map.persons].sort((a, b) => b.last_seen - a.last_seen).slice(0, limit);
}

/**
 * Get freshness label from timestamp
 */
export function getFreshnessLabel(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 3600) return 'just now';
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

/**
 * Import contacts from existing relationshipDb (iMessage contacts)
 */
export async function importFromRelationshipDb(): Promise<number> {
  try {
    // Dynamic import to avoid circular deps
    const { topContacts } = await import('../../lib/relationshipDb');
    const contacts = topContacts(500);

    const map = loadRelationshipsMap();
    let imported = 0;

    for (const contact of contacts) {
      const entity: CommsEntity = {
        handle: contact.canonical_handle || contact.handle,
        display_name: contact.display_name,
        channel: 'imessage',
        timestamp: contact.last_ts || Math.floor(Date.now() / 1000),
        content: contact.last_text || '',
      };

      normalizeAndMerge(entity, map);
      imported++;
    }

    saveRelationshipsMap(map);
    return imported;
  } catch (e) {
    console.error('[Relationships] Failed to import from relationshipDb:', e);
    return 0;
  }
}

/**
 * Mock data for testing when no comms data available
 */
export function seedMockData(): void {
  const map = loadRelationshipsMap();

  const mockEntities: CommsEntity[] = [
    {
      handle: 'cody@newreward.com',
      display_name: 'Cody',
      channel: 'email',
      timestamp: Math.floor(Date.now() / 1000) - 86400,
      content: 'Working on the camera AI project for New Reward. I am the lead developer.',
      metadata: { project: 'New Reward', role: 'Lead Developer' },
    },
    {
      handle: 'lisa@utlyze.com',
      display_name: 'Lisa',
      channel: 'email',
      timestamp: Math.floor(Date.now() / 1000) - 172800,
      content: 'Utlyze MIP vision meeting scheduled. I am the Product Manager.',
      metadata: { project: 'Utlyze', role: 'Product Manager' },
    },
    {
      handle: '+18015551234',
      display_name: 'Mike (SolutionStream)',
      channel: 'imessage',
      timestamp: Math.floor(Date.now() / 1000) - 259200,
      content: 'Site rebuild going well. Fractional CAIO engagement confirmed.',
      metadata: { project: 'SolutionStream', org: 'SolutionStream' },
    },
    {
      handle: 'investor@vc.com',
      display_name: 'Alex Investor',
      channel: 'email',
      timestamp: Math.floor(Date.now() / 1000) - 604800,
      content: 'Interested in the Of One ecosystem pitch. I am a Partner at VC Fund.',
      metadata: { role: 'Partner', org: 'VC Fund' },
    },
    {
      handle: 'hr@vuplicity.com',
      display_name: 'Sarah HR',
      channel: 'email',
      timestamp: Math.floor(Date.now() / 1000) - 432000,
      content: 'Vuplicity background screening integration ready. I am the HR Director.',
      metadata: { project: 'Vuplicity', role: 'HR Director', org: 'Vuplicity' },
    },
  ];

  for (const entity of mockEntities) {
    normalizeAndMerge(entity, map);
  }

  saveRelationshipsMap(map);
  console.log(`[Relationships] Seeded ${mockEntities.length} mock entities`);
}
