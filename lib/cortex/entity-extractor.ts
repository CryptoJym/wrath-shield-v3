/**
 * Wrath Shield v3 - Entity Extraction System
 *
 * Extracts structured entities (people, organizations, amounts, dates, agreements)
 * from event content in the Working Memory Buffer. Features:
 * - Lightweight LLM-based extraction with regex fallbacks
 * - SQLite persistence for entities and relationships
 * - Content-based caching to avoid re-processing
 * - Relationship graph for entity connections
 *
 * @example
 * ```typescript
 * import { extractEntities, searchEntitiesByType, findRelatedEntities } from '@/lib/cortex/entity-extractor';
 *
 * // Extract entities from event content
 * const result = await extractEntities(content, eventId);
 * console.log(`Found ${result.entities.length} entities`);
 *
 * // Search for all monetary amounts
 * const amounts = await searchEntitiesByType('amount', 50);
 *
 * // Find related entities (graph traversal)
 * const related = await findRelatedEntities(entityId, 2);
 * ```
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { createHash, randomUUID } from 'crypto';
import { Database as SqliteDatabase } from 'better-sqlite3';
import { ensureServerOnly } from '../server-only-guard';
import { getDatabase } from '../db/Database';
import { DirectLLMClients } from '../DirectLLMClients';
import type { ConstructedPrompt } from '../PromptBuilder';

// Ensure this module is only used server-side
ensureServerOnly('lib/cortex/entity-extractor');

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Supported entity types for extraction
 */
export type EntityType =
  | 'person'
  | 'organization'
  | 'amount'
  | 'date'
  | 'location'
  | 'agreement'
  | 'task'
  | 'deadline'
  | 'email'
  | 'phone';

/**
 * Extracted entity with position tracking
 */
export interface ExtractedEntity {
  /** Unique entity identifier */
  id: string;

  /** Entity type classification */
  type: EntityType;

  /** Raw entity value from text */
  value: string;

  /** Normalized value (e.g., ISO dates, standardized formats) */
  normalizedValue?: string;

  /** Confidence score (0-1) */
  confidence: number;

  /** Start position in source text */
  startPos: number;

  /** End position in source text */
  endPos: number;

  /** Optional metadata for entity context */
  metadata?: Record<string, unknown>;
}

/**
 * Entity extraction result
 */
export interface EntityExtractionResult {
  /** All extracted entities */
  entities: ExtractedEntity[];

  /** Relationships between entities */
  relationships: EntityRelationship[];

  /** Timestamp of extraction */
  extractedAt: string;
}

/**
 * Relationship between two entities
 */
export interface EntityRelationship {
  /** Unique relationship identifier */
  id: string;

  /** Source entity ID */
  sourceEntityId: string;

  /** Target entity ID */
  targetEntityId: string;

  /** Type of relationship */
  relationshipType: string; // 'owes', 'scheduled_with', 'belongs_to', 'deadline_for', etc.

  /** Confidence score (0-1) */
  confidence: number;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * LLM extraction response format
 */
interface LLMExtractionResponse {
  entities: Array<{
    type: EntityType;
    value: string;
    normalizedValue?: string;
    confidence: number;
    startPos?: number;
    endPos?: number;
    metadata?: Record<string, unknown>;
  }>;
  relationships: Array<{
    sourceEntity: string; // Entity value
    targetEntity: string; // Entity value
    relationshipType: string;
    confidence: number;
  }>;
}

// ============================================================================
// Regex Patterns for Fast Extraction
// ============================================================================

/**
 * Regex patterns for common entity types
 * These provide fast fallback extraction when LLM is unavailable
 */
const REGEX_PATTERNS = {
  // ISO date: 2025-12-09
  isoDate: /\b\d{4}-\d{2}-\d{2}\b/g,

  // Natural language dates: "next Tuesday", "December 5th", "Jan 15, 2025"
  naturalDate:
    /\b(?:next|last|this)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi,

  // Currency amounts: $500, $1,234.56, 500 dollars
  currency: /\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\b\d+(?:\.\d{2})?\s*(?:dollars?|usd|eur|gbp)\b/gi,

  // Email addresses
  email: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,

  // Phone numbers: (555) 123-4567, 555-123-4567, 555.123.4567
  phone: /(?:\+\d{1,3}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,

  // Time: 3:30pm, 15:30, 3pm
  time: /\b\d{1,2}:\d{2}\s*(?:am|pm)?\b|\b\d{1,2}\s*(?:am|pm)\b/gi,

  // Proper names (basic heuristic - capitalized words)
  properName: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,
};

// ============================================================================
// Entity Extractor Class
// ============================================================================

/**
 * Configuration for entity extraction
 */
export interface EntityExtractorConfig {
  /** Whether to use LLM for extraction (default: true) */
  useLLM: boolean;

  /** LLM model for extraction (default: 'anthropic/claude-haiku-3.5') */
  llmModel: string;

  /** Max tokens for LLM extraction (default: 1500) */
  maxTokens: number;

  /** Temperature for LLM (default: 0.1 for consistent extraction) */
  temperature: number;

  /** Cache TTL in hours (default: 24) */
  cacheTTLHours: number;

  /** Minimum confidence threshold (default: 0.5) */
  minConfidence: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: EntityExtractorConfig = {
  useLLM: true,
  llmModel: 'anthropic/claude-haiku-3.5',
  maxTokens: 1500,
  temperature: 0.1,
  cacheTTLHours: 24,
  minConfidence: 0.5,
};

/**
 * Entity Extractor - Extracts structured entities from text
 */
export class EntityExtractor {
  private db: SqliteDatabase;
  private config: EntityExtractorConfig;

  /**
   * Initialize Entity Extractor
   */
  constructor(config?: Partial<EntityExtractorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.db = getDatabase().getRawDb();
    this.ensureTables();
  }

  /**
   * Create entity storage tables
   */
  private ensureTables(): void {
    // Create tables without foreign keys first
    // Note: Using cortex_* prefix to avoid conflicts with memory architecture tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cortex_extracted_entities (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        normalized_value TEXT,
        confidence REAL NOT NULL,
        start_pos INTEGER,
        end_pos INTEGER,
        metadata_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cortex_entity_relationships (
        id TEXT PRIMARY KEY,
        source_entity_id TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        confidence REAL NOT NULL,
        event_id TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cortex_extraction_cache (
        content_hash TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        extraction_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_cortex_entities_event ON cortex_extracted_entities(event_id);
      CREATE INDEX IF NOT EXISTS idx_cortex_entities_type ON cortex_extracted_entities(type);
      CREATE INDEX IF NOT EXISTS idx_cortex_entities_value ON cortex_extracted_entities(value);
      CREATE INDEX IF NOT EXISTS idx_cortex_relationships_source ON cortex_entity_relationships(source_entity_id);
      CREATE INDEX IF NOT EXISTS idx_cortex_relationships_target ON cortex_entity_relationships(target_entity_id);
      CREATE INDEX IF NOT EXISTS idx_cortex_relationships_event ON cortex_entity_relationships(event_id);
      CREATE INDEX IF NOT EXISTS idx_cortex_cache_expires ON cortex_extraction_cache(expires_at);
    `);
  }

  /**
   * Generate SHA-256 hash of content for caching
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Check if extraction is cached
   */
  private getCachedExtraction(contentHash: string): EntityExtractionResult | null {
    const now = new Date().toISOString();

    // Clean up expired cache entries
    this.db.prepare('DELETE FROM cortex_extraction_cache WHERE expires_at < ?').run(now);

    const cached = this.db
      .prepare('SELECT extraction_json FROM cortex_extraction_cache WHERE content_hash = ? AND expires_at >= ?')
      .get(contentHash, now) as any;

    if (cached?.extraction_json) {
      return JSON.parse(cached.extraction_json);
    }

    return null;
  }

  /**
   * Store extraction result in cache
   */
  private cacheExtraction(contentHash: string, eventId: string, result: EntityExtractionResult): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.cacheTTLHours * 3600 * 1000).toISOString();

    this.db
      .prepare(
        `INSERT OR REPLACE INTO cortex_extraction_cache (content_hash, event_id, extraction_json, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(contentHash, eventId, JSON.stringify(result), now.toISOString(), expiresAt);
  }

  /**
   * Extract entities using regex patterns (fallback)
   */
  private extractWithRegex(content: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Extract dates (ISO)
    let match;
    while ((match = REGEX_PATTERNS.isoDate.exec(content)) !== null) {
      entities.push({
        id: randomUUID(),
        type: 'date',
        value: match[0],
        normalizedValue: match[0], // Already ISO format
        confidence: 0.9,
        startPos: match.index,
        endPos: match.index + match[0].length,
      });
    }

    // Extract natural dates
    REGEX_PATTERNS.naturalDate.lastIndex = 0;
    while ((match = REGEX_PATTERNS.naturalDate.exec(content)) !== null) {
      entities.push({
        id: randomUUID(),
        type: 'date',
        value: match[0],
        confidence: 0.7,
        startPos: match.index,
        endPos: match.index + match[0].length,
      });
    }

    // Extract currency amounts
    REGEX_PATTERNS.currency.lastIndex = 0;
    while ((match = REGEX_PATTERNS.currency.exec(content)) !== null) {
      entities.push({
        id: randomUUID(),
        type: 'amount',
        value: match[0],
        normalizedValue: this.normalizeCurrency(match[0]),
        confidence: 0.85,
        startPos: match.index,
        endPos: match.index + match[0].length,
      });
    }

    // Extract emails
    REGEX_PATTERNS.email.lastIndex = 0;
    while ((match = REGEX_PATTERNS.email.exec(content)) !== null) {
      entities.push({
        id: randomUUID(),
        type: 'email',
        value: match[0],
        normalizedValue: match[0].toLowerCase(),
        confidence: 0.95,
        startPos: match.index,
        endPos: match.index + match[0].length,
      });
    }

    // Extract phone numbers
    REGEX_PATTERNS.phone.lastIndex = 0;
    while ((match = REGEX_PATTERNS.phone.exec(content)) !== null) {
      entities.push({
        id: randomUUID(),
        type: 'phone',
        value: match[0],
        normalizedValue: this.normalizePhone(match[0]),
        confidence: 0.8,
        startPos: match.index,
        endPos: match.index + match[0].length,
      });
    }

    return entities;
  }

  /**
   * Normalize currency to standard format
   */
  private normalizeCurrency(value: string): string {
    const cleaned = value.replace(/[^\d.]/g, '');
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? cleaned : amount.toFixed(2);
  }

  /**
   * Normalize phone number to E.164 format (basic)
   */
  private normalizePhone(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    return digits;
  }

  /**
   * Extract entities using LLM
   */
  private async extractWithLLM(content: string): Promise<EntityExtractionResult> {
    const prompt: ConstructedPrompt = {
      messages: [
        {
          role: 'system',
          content: `You are an expert entity extraction system. Extract structured entities from text.

Extract the following entity types:
- person: Names of people
- organization: Companies, institutions
- amount: Money amounts (with currency)
- date: Dates and times
- location: Places, addresses
- agreement: Commitments or agreements
- task: Action items or to-dos
- deadline: Due dates or time constraints
- email: Email addresses
- phone: Phone numbers

Also identify relationships between entities:
- owes: Financial obligations
- scheduled_with: Meeting/event participants
- belongs_to: Organizational membership
- deadline_for: Task deadlines
- located_at: Location relationships

Return JSON with:
{
  "entities": [{"type": "...", "value": "...", "normalizedValue": "...", "confidence": 0.0-1.0}],
  "relationships": [{"sourceEntity": "...", "targetEntity": "...", "relationshipType": "...", "confidence": 0.0-1.0}]
}`,
        },
        {
          role: 'user',
          content: `Extract entities and relationships from this text:\n\n${content}`,
        },
      ],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      // Enable prompt caching - system prompt is large and stable
      enablePromptCaching: true,
      metadata: {
        date: new Date().toISOString(),
        has_whoop_data: false,
        has_manipulations: false,
        wrath_deployed: true,
        memory_count: 0,
        anchor_count: 0,
      },
    };

    try {
      const response = await DirectLLMClients.openRouterChat(prompt, this.config.llmModel);
      const parsed: LLMExtractionResponse = JSON.parse(response.content);

      // Convert LLM response to our format
      const entities: ExtractedEntity[] = parsed.entities
        .filter(e => e.confidence >= this.config.minConfidence)
        .map(e => ({
          id: randomUUID(),
          type: e.type,
          value: e.value,
          normalizedValue: e.normalizedValue,
          confidence: e.confidence,
          startPos: e.startPos ?? content.indexOf(e.value),
          endPos: e.endPos ?? content.indexOf(e.value) + e.value.length,
          metadata: e.metadata,
        }));

      // Build entity value->id map for relationships
      const entityMap = new Map<string, string>();
      entities.forEach(e => entityMap.set(e.value.toLowerCase(), e.id));

      const relationships: EntityRelationship[] = parsed.relationships
        .filter(r => r.confidence >= this.config.minConfidence)
        .map(r => {
          const sourceId = entityMap.get(r.sourceEntity.toLowerCase());
          const targetId = entityMap.get(r.targetEntity.toLowerCase());

          if (!sourceId || !targetId) return null;

          return {
            id: randomUUID(),
            sourceEntityId: sourceId,
            targetEntityId: targetId,
            relationshipType: r.relationshipType,
            confidence: r.confidence,
          } as EntityRelationship;
        })
        .filter((r): r is EntityRelationship => r !== null);

      return {
        entities,
        relationships,
        extractedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[EntityExtractor] LLM extraction failed, falling back to regex:', error);
      return {
        entities: this.extractWithRegex(content),
        relationships: [],
        extractedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Extract entities from content
   */
  public async extractEntities(content: string, eventId: string): Promise<EntityExtractionResult> {
    // Check cache first
    const contentHash = this.hashContent(content);
    const cached = this.getCachedExtraction(contentHash);
    if (cached) {
      console.log(`[EntityExtractor] Using cached extraction for event ${eventId}`);
      return cached;
    }

    // Perform extraction
    let result: EntityExtractionResult;

    if (this.config.useLLM) {
      result = await this.extractWithLLM(content);
    } else {
      result = {
        entities: this.extractWithRegex(content),
        relationships: [],
        extractedAt: new Date().toISOString(),
      };
    }

    // Store entities in database
    const stmt = this.db.prepare(
      `INSERT INTO cortex_extracted_entities (id, event_id, type, value, normalized_value, confidence, start_pos, end_pos, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const transaction = this.db.transaction((entities: ExtractedEntity[]) => {
      for (const entity of entities) {
        stmt.run(
          entity.id,
          eventId,
          entity.type,
          entity.value,
          entity.normalizedValue || null,
          entity.confidence,
          entity.startPos,
          entity.endPos,
          entity.metadata ? JSON.stringify(entity.metadata) : null,
          new Date().toISOString()
        );
      }
    });

    transaction(result.entities);

    // Store relationships
    if (result.relationships.length > 0) {
      const relStmt = this.db.prepare(
        `INSERT INTO cortex_entity_relationships (id, source_entity_id, target_entity_id, relationship_type, confidence, event_id, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );

      const relTransaction = this.db.transaction((relationships: EntityRelationship[]) => {
        for (const rel of relationships) {
          relStmt.run(
            rel.id,
            rel.sourceEntityId,
            rel.targetEntityId,
            rel.relationshipType,
            rel.confidence,
            eventId,
            rel.metadata ? JSON.stringify(rel.metadata) : null,
            new Date().toISOString()
          );
        }
      });

      relTransaction(result.relationships);
    }

    // Cache the result
    this.cacheExtraction(contentHash, eventId, result);

    console.log(
      `[EntityExtractor] Extracted ${result.entities.length} entities and ${result.relationships.length} relationships for event ${eventId}`
    );

    return result;
  }

  /**
   * Get all entities for a specific event
   */
  public async getEntitiesForEvent(eventId: string): Promise<ExtractedEntity[]> {
    const rows = this.db
      .prepare('SELECT * FROM cortex_extracted_entities WHERE event_id = ? ORDER BY start_pos ASC')
      .all(eventId) as any[];

    return rows.map(this.rowToEntity);
  }

  /**
   * Get relationships for a specific entity
   */
  public async getRelationshipsForEntity(entityId: string): Promise<EntityRelationship[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM cortex_entity_relationships
         WHERE source_entity_id = ? OR target_entity_id = ?
         ORDER BY confidence DESC`
      )
      .all(entityId, entityId) as any[];

    return rows.map(this.rowToRelationship);
  }

  /**
   * Search entities by type
   */
  public async searchEntitiesByType(type: EntityType, limit = 100): Promise<ExtractedEntity[]> {
    const rows = this.db
      .prepare('SELECT * FROM cortex_extracted_entities WHERE type = ? ORDER BY confidence DESC LIMIT ?')
      .all(type, limit) as any[];

    return rows.map(this.rowToEntity);
  }

  /**
   * Find related entities (graph traversal)
   */
  public async findRelatedEntities(entityId: string, depth = 2): Promise<ExtractedEntity[]> {
    const visited = new Set<string>();
    const relatedIds = new Set<string>();
    const queue: Array<{ id: string; currentDepth: number }> = [{ id: entityId, currentDepth: 0 }];

    while (queue.length > 0) {
      const { id, currentDepth } = queue.shift()!;

      if (visited.has(id) || currentDepth >= depth) {
        continue;
      }

      visited.add(id);

      // Get relationships
      const relationships = await this.getRelationshipsForEntity(id);

      for (const rel of relationships) {
        const relatedId = rel.sourceEntityId === id ? rel.targetEntityId : rel.sourceEntityId;

        if (!visited.has(relatedId)) {
          relatedIds.add(relatedId);
          queue.push({ id: relatedId, currentDepth: currentDepth + 1 });
        }
      }
    }

    // Fetch all related entities
    if (relatedIds.size === 0) {
      return [];
    }

    const placeholders = Array.from(relatedIds).map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT * FROM cortex_extracted_entities WHERE id IN (${placeholders})`)
      .all(...Array.from(relatedIds)) as any[];

    return rows.map(this.rowToEntity);
  }

  /**
   * Search entities by value (fuzzy)
   */
  public async searchEntitiesByValue(query: string, limit = 50): Promise<ExtractedEntity[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM cortex_extracted_entities
         WHERE value LIKE ? OR normalized_value LIKE ?
         ORDER BY confidence DESC
         LIMIT ?`
      )
      .all(`%${query}%`, `%${query}%`, limit) as any[];

    return rows.map(this.rowToEntity);
  }

  /**
   * Get entity statistics
   */
  public async getStats(): Promise<{
    totalEntities: number;
    entitiesByType: Record<EntityType, number>;
    totalRelationships: number;
    relationshipsByType: Record<string, number>;
  }> {
    const totalEntities = (
      this.db.prepare('SELECT COUNT(*) as count FROM cortex_extracted_entities').get() as any
    ).count;

    const totalRelationships = (
      this.db.prepare('SELECT COUNT(*) as count FROM cortex_entity_relationships').get() as any
    ).count;

    const entitiesByTypeRows = this.db
      .prepare('SELECT type, COUNT(*) as count FROM cortex_extracted_entities GROUP BY type')
      .all() as any[];

    const entitiesByType: Record<string, number> = {};
    entitiesByTypeRows.forEach(row => {
      entitiesByType[row.type] = row.count;
    });

    const relationshipsByTypeRows = this.db
      .prepare('SELECT relationship_type, COUNT(*) as count FROM cortex_entity_relationships GROUP BY relationship_type')
      .all() as any[];

    const relationshipsByType: Record<string, number> = {};
    relationshipsByTypeRows.forEach(row => {
      relationshipsByType[row.relationship_type] = row.count;
    });

    return {
      totalEntities,
      entitiesByType: entitiesByType as any,
      totalRelationships,
      relationshipsByType,
    };
  }

  /**
   * Convert database row to ExtractedEntity
   */
  private rowToEntity(row: any): ExtractedEntity {
    return {
      id: row.id,
      type: row.type,
      value: row.value,
      normalizedValue: row.normalized_value || undefined,
      confidence: row.confidence,
      startPos: row.start_pos,
      endPos: row.end_pos,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    };
  }

  /**
   * Convert database row to EntityRelationship
   */
  private rowToRelationship(row: any): EntityRelationship {
    return {
      id: row.id,
      sourceEntityId: row.source_entity_id,
      targetEntityId: row.target_entity_id,
      relationshipType: row.relationship_type,
      confidence: row.confidence,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    };
  }

  /**
   * Clear all entities (useful for testing)
   */
  public async clearAll(): Promise<void> {
    this.db.prepare('DELETE FROM cortex_entity_relationships').run();
    this.db.prepare('DELETE FROM cortex_extracted_entities').run();
    this.db.prepare('DELETE FROM cortex_extraction_cache').run();
    console.log('[EntityExtractor] Cleared all entities and relationships');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: EntityExtractor | null = null;

/**
 * Get singleton EntityExtractor instance
 */
export function getEntityExtractor(config?: Partial<EntityExtractorConfig>): EntityExtractor {
  if (!instance) {
    instance = new EntityExtractor(config);
  }
  return instance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetEntityExtractor(): void {
  instance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Extract entities from content
 */
export async function extractEntities(content: string, eventId: string): Promise<EntityExtractionResult> {
  return getEntityExtractor().extractEntities(content, eventId);
}

/**
 * Get entities for an event
 */
export async function getEntitiesForEvent(eventId: string): Promise<ExtractedEntity[]> {
  return getEntityExtractor().getEntitiesForEvent(eventId);
}

/**
 * Get relationships for an entity
 */
export async function getRelationshipsForEntity(entityId: string): Promise<EntityRelationship[]> {
  return getEntityExtractor().getRelationshipsForEntity(entityId);
}

/**
 * Search entities by type
 */
export async function searchEntitiesByType(type: EntityType, limit?: number): Promise<ExtractedEntity[]> {
  return getEntityExtractor().searchEntitiesByType(type, limit);
}

/**
 * Find related entities (graph traversal)
 */
export async function findRelatedEntities(entityId: string, depth?: number): Promise<ExtractedEntity[]> {
  return getEntityExtractor().findRelatedEntities(entityId, depth);
}
