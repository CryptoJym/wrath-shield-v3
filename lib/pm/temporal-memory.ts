/**
 * Temporal Memory System (Graphiti-Style Bi-Temporal Modeling)
 *
 * Implements bi-temporal fact storage for the PM agent:
 * - Valid Time: When the fact was true in reality
 * - Transaction Time: When we learned about the fact
 *
 * This enables:
 * - Historical queries: "What was the priority last week?"
 * - Change tracking: "When did the priority change?"
 * - Late-arriving facts: "We learned on Dec 4 that something happened on Dec 3"
 * - Audit trail: Complete history of all state changes
 *
 * Works alongside Zep (semantic memory) by providing temporal layer.
 */

import { ensureServerOnly } from '../server-only-guard';
import { getDatabase } from '../db/Database';
import crypto from 'crypto';

ensureServerOnly('lib/pm/temporal-memory');

// ============================================================================
// Types
// ============================================================================

export type EntityType = 'task' | 'project' | 'person' | 'decision' | 'pattern' | 'rule';
export type FactSource = 'github_webhook' | 'user_edit' | 'ai_suggestion' | 'queue_processor' | 'pattern_extraction' | 'manual' | 'system';

export interface TemporalFact {
  id: string;

  // Entity identification
  entity_type: EntityType;
  entity_id: string;

  // Bi-temporal timestamps
  valid_from: number;      // Unix timestamp: when fact became true
  valid_to: number | null; // Unix timestamp: when fact stopped being true (null = current)
  recorded_at: number;     // Unix timestamp: when we learned this fact

  // The fact itself
  attribute: string;       // e.g., 'priority', 'status', 'assignee', 'due_date'
  value: string;           // JSON-encoded value
  previous_value: string | null;  // JSON-encoded previous value

  // Provenance
  source: FactSource;
  source_id: string | null;
  confidence: number;      // 0-1: how confident are we?

  // Metadata
  metadata: Record<string, unknown>;
}

export interface EntityRelationship {
  id: string;

  from_entity_type: EntityType;
  from_entity_id: string;

  to_entity_type: EntityType;
  to_entity_id: string;

  relationship_type: RelationshipType;

  valid_from: number;
  valid_to: number | null;

  strength: number;  // 0-1 for inference strength

  metadata: Record<string, unknown>;
}

export type RelationshipType =
  | 'assigned_to'
  | 'belongs_to'
  | 'blocks'
  | 'depends_on'
  | 'related_to'
  | 'created_by'
  | 'mentioned_in'
  | 'part_of';

export interface FactQuery {
  entity_type?: EntityType;
  entity_id?: string;
  attribute?: string;
  valid_at?: Date;      // Query facts valid at this time
  recorded_after?: Date;  // Query facts recorded after this time
  source?: FactSource;
  limit?: number;
}

export interface EntityState {
  entity_type: EntityType;
  entity_id: string;
  attributes: Record<string, any>;
  relationships: EntityRelationship[];
  last_updated: number;
}

// ============================================================================
// Database Schema
// ============================================================================

function ensureTemporalTables(): void {
  const db = getDatabase().getRawDb();

  // Temporal facts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS temporal_facts (
      id TEXT PRIMARY KEY,

      -- Entity
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,

      -- Bi-temporal
      valid_from INTEGER NOT NULL,
      valid_to INTEGER,
      recorded_at INTEGER NOT NULL,

      -- Fact
      attribute TEXT NOT NULL,
      value TEXT NOT NULL,
      previous_value TEXT,

      -- Provenance
      source TEXT NOT NULL,
      source_id TEXT,
      confidence REAL DEFAULT 1.0,

      -- Metadata
      metadata TEXT,

      CHECK (entity_type IN ('task', 'project', 'person', 'decision', 'pattern', 'rule')),
      CHECK (confidence >= 0.0 AND confidence <= 1.0),
      CHECK (source IN ('github_webhook', 'user_edit', 'ai_suggestion', 'queue_processor', 'pattern_extraction', 'manual', 'system'))
    );

    CREATE INDEX IF NOT EXISTS idx_temporal_facts_entity
      ON temporal_facts(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_temporal_facts_valid_time
      ON temporal_facts(valid_from, valid_to);
    CREATE INDEX IF NOT EXISTS idx_temporal_facts_attribute
      ON temporal_facts(entity_type, attribute);
    CREATE INDEX IF NOT EXISTS idx_temporal_facts_recorded
      ON temporal_facts(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_temporal_facts_current
      ON temporal_facts(entity_type, entity_id, valid_to)
      WHERE valid_to IS NULL;
  `);

  // Entity relationships table
  db.exec(`
    CREATE TABLE IF NOT EXISTS entity_relationships (
      id TEXT PRIMARY KEY,

      from_entity_type TEXT NOT NULL,
      from_entity_id TEXT NOT NULL,

      to_entity_type TEXT NOT NULL,
      to_entity_id TEXT NOT NULL,

      relationship_type TEXT NOT NULL,

      valid_from INTEGER NOT NULL,
      valid_to INTEGER,

      strength REAL DEFAULT 1.0,

      metadata TEXT,

      CHECK (strength >= 0.0 AND strength <= 1.0),
      CHECK (relationship_type IN ('assigned_to', 'belongs_to', 'blocks', 'depends_on', 'related_to', 'created_by', 'mentioned_in', 'part_of'))
    );

    CREATE INDEX IF NOT EXISTS idx_relationships_from
      ON entity_relationships(from_entity_type, from_entity_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_to
      ON entity_relationships(to_entity_type, to_entity_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_type
      ON entity_relationships(relationship_type);
    CREATE INDEX IF NOT EXISTS idx_relationships_valid_time
      ON entity_relationships(valid_from, valid_to);
    CREATE INDEX IF NOT EXISTS idx_relationships_current
      ON entity_relationships(from_entity_type, from_entity_id, valid_to)
      WHERE valid_to IS NULL;
  `);
}

// ============================================================================
// Core Functions: Temporal Facts
// ============================================================================

/**
 * Record a temporal fact
 */
export async function recordFact(params: {
  entity_type: EntityType;
  entity_id: string;
  attribute: string;
  value: any;
  valid_from?: Date;
  source: FactSource;
  source_id?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}): Promise<TemporalFact> {
  ensureTemporalTables();
  const db = getDatabase().getRawDb();
  const now = Math.floor(Date.now() / 1000);

  const validFrom = params.valid_from
    ? Math.floor(params.valid_from.getTime() / 1000)
    : now;

  // Get previous value for this attribute
  const previousFact = await getCurrentFact(
    params.entity_type,
    params.entity_id,
    params.attribute
  );

  // If previous fact exists, close it
  if (previousFact) {
    db.prepare(`
      UPDATE temporal_facts
      SET valid_to = ?
      WHERE id = ?
    `).run(validFrom, previousFact.id);
  }

  // Create new fact
  const id = `fact_${now}_${crypto.randomBytes(4).toString('hex')}`;
  const fact: TemporalFact = {
    id,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    valid_from: validFrom,
    valid_to: null,
    recorded_at: now,
    attribute: params.attribute,
    value: JSON.stringify(params.value),
    previous_value: previousFact ? previousFact.value : null,
    source: params.source,
    source_id: params.source_id || null,
    confidence: params.confidence ?? 1.0,
    metadata: params.metadata || {}
  };

  db.prepare(`
    INSERT INTO temporal_facts (
      id, entity_type, entity_id, valid_from, valid_to, recorded_at,
      attribute, value, previous_value, source, source_id, confidence, metadata
    ) VALUES (
      @id, @entity_type, @entity_id, @valid_from, @valid_to, @recorded_at,
      @attribute, @value, @previous_value, @source, @source_id, @confidence, @metadata
    )
  `).run({
    ...fact,
    metadata: JSON.stringify(fact.metadata)
  });

  console.log(`[TemporalMemory] Recorded fact: ${params.entity_type}/${params.entity_id}.${params.attribute} = ${JSON.stringify(params.value)}`);

  return fact;
}

/**
 * Get current fact for an attribute
 */
export function getCurrentFact(
  entity_type: EntityType,
  entity_id: string,
  attribute: string
): TemporalFact | null {
  ensureTemporalTables();
  const db = getDatabase().getRawDb();

  const row = db.prepare(`
    SELECT * FROM temporal_facts
    WHERE entity_type = ? AND entity_id = ? AND attribute = ? AND valid_to IS NULL
    ORDER BY valid_from DESC
    LIMIT 1
  `).get(entity_type, entity_id, attribute) as any;

  if (!row) return null;

  return {
    ...row,
    metadata: JSON.parse(row.metadata || '{}')
  };
}

/**
 * Query facts with filters
 */
export function queryFacts(query: FactQuery): TemporalFact[] {
  ensureTemporalTables();
  const db = getDatabase().getRawDb();

  let sql = 'SELECT * FROM temporal_facts WHERE 1=1';
  const params: any[] = [];

  if (query.entity_type) {
    sql += ' AND entity_type = ?';
    params.push(query.entity_type);
  }

  if (query.entity_id) {
    sql += ' AND entity_id = ?';
    params.push(query.entity_id);
  }

  if (query.attribute) {
    sql += ' AND attribute = ?';
    params.push(query.attribute);
  }

  if (query.valid_at) {
    const timestamp = Math.floor(query.valid_at.getTime() / 1000);
    sql += ' AND valid_from <= ? AND (valid_to IS NULL OR valid_to > ?)';
    params.push(timestamp, timestamp);
  }

  if (query.recorded_after) {
    const timestamp = Math.floor(query.recorded_after.getTime() / 1000);
    sql += ' AND recorded_at > ?';
    params.push(timestamp);
  }

  if (query.source) {
    sql += ' AND source = ?';
    params.push(query.source);
  }

  sql += ' ORDER BY recorded_at DESC';

  if (query.limit) {
    sql += ` LIMIT ${query.limit}`;
  }

  const rows = db.prepare(sql).all(...params) as any[];

  return rows.map(row => ({
    ...row,
    metadata: JSON.parse(row.metadata || '{}')
  }));
}

/**
 * Get complete history for an entity
 */
export function getEntityHistory(
  entity_type: EntityType,
  entity_id: string
): TemporalFact[] {
  return queryFacts({ entity_type, entity_id });
}

/**
 * Get entity state at a specific point in time
 */
export function getFactsAtTime(
  entity_type: EntityType,
  entity_id: string,
  point_in_time: Date
): TemporalFact[] {
  return queryFacts({
    entity_type,
    entity_id,
    valid_at: point_in_time
  });
}

/**
 * Get current state of an entity (all current facts)
 */
export function getCurrentState(
  entity_type: EntityType,
  entity_id: string
): EntityState {
  ensureTemporalTables();
  const db = getDatabase().getRawDb();

  // Get all current facts
  const facts = db.prepare(`
    SELECT * FROM temporal_facts
    WHERE entity_type = ? AND entity_id = ? AND valid_to IS NULL
    ORDER BY recorded_at DESC
  `).all(entity_type, entity_id) as any[];

  // Get current relationships
  const relationships = getCurrentRelationships(entity_type, entity_id);

  // Build attribute map
  const attributes: Record<string, any> = {};
  let lastUpdated = 0;

  for (const fact of facts) {
    attributes[fact.attribute] = JSON.parse(fact.value);
    if (fact.recorded_at > lastUpdated) {
      lastUpdated = fact.recorded_at;
    }
  }

  return {
    entity_type,
    entity_id,
    attributes,
    relationships,
    last_updated: lastUpdated
  };
}

/**
 * Get historical state of an entity at a specific time
 */
export function getHistoricalState(
  entity_type: EntityType,
  entity_id: string,
  point_in_time: Date
): EntityState {
  const facts = getFactsAtTime(entity_type, entity_id, point_in_time);
  const relationships = getRelationshipsAtTime(entity_type, entity_id, point_in_time);

  const attributes: Record<string, any> = {};
  let lastUpdated = 0;

  for (const fact of facts) {
    attributes[fact.attribute] = JSON.parse(fact.value);
    if (fact.valid_from > lastUpdated) {
      lastUpdated = fact.valid_from;
    }
  }

  return {
    entity_type,
    entity_id,
    attributes,
    relationships,
    last_updated: lastUpdated
  };
}

// ============================================================================
// Core Functions: Entity Relationships
// ============================================================================

/**
 * Record a relationship between entities
 */
export async function recordRelationship(params: {
  from_entity_type: EntityType;
  from_entity_id: string;
  to_entity_type: EntityType;
  to_entity_id: string;
  relationship_type: RelationshipType;
  valid_from?: Date;
  strength?: number;
  metadata?: Record<string, unknown>;
}): Promise<EntityRelationship> {
  ensureTemporalTables();
  const db = getDatabase().getRawDb();
  const now = Math.floor(Date.now() / 1000);

  const validFrom = params.valid_from
    ? Math.floor(params.valid_from.getTime() / 1000)
    : now;

  // Check if relationship already exists
  const existing = db.prepare(`
    SELECT * FROM entity_relationships
    WHERE from_entity_type = ? AND from_entity_id = ?
      AND to_entity_type = ? AND to_entity_id = ?
      AND relationship_type = ?
      AND valid_to IS NULL
  `).get(
    params.from_entity_type,
    params.from_entity_id,
    params.to_entity_type,
    params.to_entity_id,
    params.relationship_type
  ) as any;

  if (existing) {
    // Update strength if provided
    if (params.strength !== undefined) {
      db.prepare(`
        UPDATE entity_relationships
        SET strength = ?, metadata = ?
        WHERE id = ?
      `).run(params.strength, JSON.stringify(params.metadata || {}), existing.id);
    }

    return {
      ...existing,
      metadata: JSON.parse(existing.metadata || '{}')
    };
  }

  // Create new relationship
  const id = `rel_${now}_${crypto.randomBytes(4).toString('hex')}`;
  const relationship: EntityRelationship = {
    id,
    from_entity_type: params.from_entity_type,
    from_entity_id: params.from_entity_id,
    to_entity_type: params.to_entity_type,
    to_entity_id: params.to_entity_id,
    relationship_type: params.relationship_type,
    valid_from: validFrom,
    valid_to: null,
    strength: params.strength ?? 1.0,
    metadata: params.metadata || {}
  };

  db.prepare(`
    INSERT INTO entity_relationships (
      id, from_entity_type, from_entity_id, to_entity_type, to_entity_id,
      relationship_type, valid_from, valid_to, strength, metadata
    ) VALUES (
      @id, @from_entity_type, @from_entity_id, @to_entity_type, @to_entity_id,
      @relationship_type, @valid_from, @valid_to, @strength, @metadata
    )
  `).run({
    ...relationship,
    metadata: JSON.stringify(relationship.metadata)
  });

  console.log(`[TemporalMemory] Recorded relationship: ${params.from_entity_type}/${params.from_entity_id} --[${params.relationship_type}]--> ${params.to_entity_type}/${params.to_entity_id}`);

  return relationship;
}

/**
 * Get current relationships for an entity
 */
export function getCurrentRelationships(
  entity_type: EntityType,
  entity_id: string,
  relationship_type?: RelationshipType
): EntityRelationship[] {
  ensureTemporalTables();
  const db = getDatabase().getRawDb();

  let sql = `
    SELECT * FROM entity_relationships
    WHERE (
      (from_entity_type = ? AND from_entity_id = ?)
      OR (to_entity_type = ? AND to_entity_id = ?)
    ) AND valid_to IS NULL
  `;
  const params = [entity_type, entity_id, entity_type, entity_id];

  if (relationship_type) {
    sql += ' AND relationship_type = ?';
    params.push(relationship_type);
  }

  sql += ' ORDER BY valid_from DESC';

  const rows = db.prepare(sql).all(...params) as any[];

  return rows.map(row => ({
    ...row,
    metadata: JSON.parse(row.metadata || '{}')
  }));
}

/**
 * Get relationships at a specific point in time
 */
export function getRelationshipsAtTime(
  entity_type: EntityType,
  entity_id: string,
  point_in_time: Date
): EntityRelationship[] {
  ensureTemporalTables();
  const db = getDatabase().getRawDb();
  const timestamp = Math.floor(point_in_time.getTime() / 1000);

  const rows = db.prepare(`
    SELECT * FROM entity_relationships
    WHERE (
      (from_entity_type = ? AND from_entity_id = ?)
      OR (to_entity_type = ? AND to_entity_id = ?)
    )
    AND valid_from <= ?
    AND (valid_to IS NULL OR valid_to > ?)
    ORDER BY valid_from DESC
  `).all(entity_type, entity_id, entity_type, entity_id, timestamp, timestamp) as any[];

  return rows.map(row => ({
    ...row,
    metadata: JSON.parse(row.metadata || '{}')
  }));
}

/**
 * End a relationship (set valid_to)
 */
export function endRelationship(relationship_id: string, end_time?: Date): void {
  ensureTemporalTables();
  const db = getDatabase().getRawDb();
  const timestamp = end_time
    ? Math.floor(end_time.getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  db.prepare(`
    UPDATE entity_relationships
    SET valid_to = ?
    WHERE id = ?
  `).run(timestamp, relationship_id);

  console.log(`[TemporalMemory] Ended relationship: ${relationship_id}`);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get statistics about temporal memory
 */
export function getTemporalStats(): {
  total_facts: number;
  current_facts: number;
  total_relationships: number;
  current_relationships: number;
  entities_tracked: number;
  oldest_fact: number | null;
  newest_fact: number | null;
} {
  ensureTemporalTables();
  const db = getDatabase().getRawDb();

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM temporal_facts) as total_facts,
      (SELECT COUNT(*) FROM temporal_facts WHERE valid_to IS NULL) as current_facts,
      (SELECT COUNT(*) FROM entity_relationships) as total_relationships,
      (SELECT COUNT(*) FROM entity_relationships WHERE valid_to IS NULL) as current_relationships,
      (SELECT COUNT(DISTINCT entity_id) FROM temporal_facts) as entities_tracked,
      (SELECT MIN(recorded_at) FROM temporal_facts) as oldest_fact,
      (SELECT MAX(recorded_at) FROM temporal_facts) as newest_fact
  `).get() as any;

  return stats;
}

/**
 * Clean up old facts (archive facts older than retention period)
 */
export function archiveOldFacts(retention_days: number = 365): number {
  ensureTemporalTables();
  const db = getDatabase().getRawDb();
  const cutoff = Math.floor(Date.now() / 1000) - (retention_days * 86400);

  // Archive closed facts older than retention period
  const result = db.prepare(`
    DELETE FROM temporal_facts
    WHERE valid_to IS NOT NULL AND valid_to < ?
  `).run(cutoff);

  console.log(`[TemporalMemory] Archived ${result.changes} old facts (older than ${retention_days} days)`);

  return result.changes;
}

export {
  ensureTemporalTables
};
