/**
 * HYRO FORGE: Spaced Repetition System (SRS)
 * SM-2 algorithm implementation for flashcard-based learning
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import { awardXP } from './forge-xp';

// ============================================================================
// Types
// ============================================================================

export type CardState = 'new' | 'learning' | 'review' | 'graduated';
export type CardType = 'basic' | 'cloze' | 'image';

export interface SRSDeck {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  icon: string;
  card_count: number;
  due_count: number;
  is_active: number;
  created_at: number;
  updated_at: number;
}

export interface SRSCard {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  card_type: CardType;
  tags: string | null;
  source_quest_id: string | null;
  source_assignment_id: string | null;
  easiness_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: number | null;
  last_reviewed_at: number | null;
  card_state: CardState;
  created_at: number;
  updated_at: number;
}

export interface ReviewResult {
  card_id: string;
  quality: number;
  easiness_before: number;
  interval_before: number;
  easiness_after: number;
  interval_after: number;
  next_review_at: number;
  xp_earned: number;
}

export interface DeckStats {
  total_cards: number;
  new_cards: number;
  learning_cards: number;
  review_cards: number;
  graduated_cards: number;
  due_today: number;
  average_easiness: number;
  mastery_percent: number;
}

// ============================================================================
// SM-2 Algorithm Constants
// ============================================================================

const SM2_MIN_EASINESS = 1.3;
const SM2_DEFAULT_EASINESS = 2.5;

// Initial intervals for new/learning cards (in days)
const LEARNING_INTERVALS = [0, 1, 3]; // Same day, 1 day, 3 days

// Quality rating descriptions
export const QUALITY_RATINGS = {
  0: { label: 'Blackout', description: 'Complete failure to recall' },
  1: { label: 'Incorrect', description: 'Incorrect but recognized answer' },
  2: { label: 'Hard', description: 'Incorrect but seemed easy to recall' },
  3: { label: 'Good', description: 'Correct with serious difficulty' },
  4: { label: 'Easy', description: 'Correct after hesitation' },
  5: { label: 'Perfect', description: 'Perfect response' },
};

// ============================================================================
// Deck Functions
// ============================================================================

/**
 * Create a new deck
 */
export function createDeck(params: {
  title: string;
  description?: string;
  subject?: string;
  icon?: string;
}): SRSDeck {
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO hyro_srs_decks (id, title, description, subject, icon)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, params.title, params.description || null, params.subject || null, params.icon || '📚');

  return getDeck(id)!;
}

/**
 * Get a deck by ID
 */
export function getDeck(deckId: string): SRSDeck | null {
  const db = getDatabase();
  return db.prepare(`SELECT * FROM hyro_srs_decks WHERE id = ?`).get(deckId) as SRSDeck | null;
}

/**
 * Get all decks
 */
export function getAllDecks(): SRSDeck[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT d.*,
      (SELECT COUNT(*) FROM hyro_srs_cards WHERE deck_id = d.id) as card_count,
      (SELECT COUNT(*) FROM hyro_srs_cards WHERE deck_id = d.id AND next_review_at <= unixepoch()) as due_count
    FROM hyro_srs_decks d
    WHERE d.is_active = 1
    ORDER BY d.updated_at DESC
  `).all() as SRSDeck[];
}

/**
 * Get deck statistics
 */
export function getDeckStats(deckId: string): DeckStats {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_cards,
      SUM(CASE WHEN card_state = 'new' THEN 1 ELSE 0 END) as new_cards,
      SUM(CASE WHEN card_state = 'learning' THEN 1 ELSE 0 END) as learning_cards,
      SUM(CASE WHEN card_state = 'review' THEN 1 ELSE 0 END) as review_cards,
      SUM(CASE WHEN card_state = 'graduated' THEN 1 ELSE 0 END) as graduated_cards,
      SUM(CASE WHEN next_review_at IS NOT NULL AND next_review_at <= ? THEN 1 ELSE 0 END) as due_today,
      AVG(easiness_factor) as average_easiness
    FROM hyro_srs_cards
    WHERE deck_id = ?
  `).get(now, deckId) as any;

  const totalCards = stats.total_cards || 0;
  const masteryPercent = totalCards > 0
    ? Math.round((stats.graduated_cards / totalCards) * 100)
    : 0;

  return {
    total_cards: stats.total_cards || 0,
    new_cards: stats.new_cards || 0,
    learning_cards: stats.learning_cards || 0,
    review_cards: stats.review_cards || 0,
    graduated_cards: stats.graduated_cards || 0,
    due_today: stats.due_today || 0,
    average_easiness: stats.average_easiness || SM2_DEFAULT_EASINESS,
    mastery_percent: masteryPercent,
  };
}

/**
 * Update deck card counts
 */
function updateDeckCounts(deckId: string): void {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    UPDATE hyro_srs_decks
    SET
      card_count = (SELECT COUNT(*) FROM hyro_srs_cards WHERE deck_id = ?),
      due_count = (SELECT COUNT(*) FROM hyro_srs_cards WHERE deck_id = ? AND next_review_at IS NOT NULL AND next_review_at <= ?),
      updated_at = unixepoch()
    WHERE id = ?
  `).run(deckId, deckId, now, deckId);
}

// ============================================================================
// Card Functions
// ============================================================================

/**
 * Create a new card
 */
export function createCard(params: {
  deck_id: string;
  front: string;
  back: string;
  card_type?: CardType;
  tags?: string[];
  source_quest_id?: string;
  source_assignment_id?: string;
}): SRSCard {
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO hyro_srs_cards (id, deck_id, front, back, card_type, tags, source_quest_id, source_assignment_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.deck_id,
    params.front,
    params.back,
    params.card_type || 'basic',
    params.tags ? JSON.stringify(params.tags) : null,
    params.source_quest_id || null,
    params.source_assignment_id || null
  );

  updateDeckCounts(params.deck_id);
  return getCard(id)!;
}

/**
 * Get a card by ID
 */
export function getCard(cardId: string): SRSCard | null {
  const db = getDatabase();
  return db.prepare(`SELECT * FROM hyro_srs_cards WHERE id = ?`).get(cardId) as SRSCard | null;
}

/**
 * Get all cards in a deck
 */
export function getDeckCards(deckId: string): SRSCard[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM hyro_srs_cards
    WHERE deck_id = ?
    ORDER BY created_at DESC
  `).all(deckId) as SRSCard[];
}

/**
 * Get cards due for review
 */
export function getDueCards(deckId?: string, limit: number = 20): SRSCard[] {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  if (deckId) {
    return db.prepare(`
      SELECT * FROM hyro_srs_cards
      WHERE deck_id = ?
        AND (next_review_at IS NULL OR next_review_at <= ?)
      ORDER BY
        CASE WHEN card_state = 'new' THEN 0 ELSE 1 END,
        next_review_at ASC NULLS FIRST
      LIMIT ?
    `).all(deckId, now, limit) as SRSCard[];
  }

  return db.prepare(`
    SELECT c.* FROM hyro_srs_cards c
    JOIN hyro_srs_decks d ON c.deck_id = d.id
    WHERE d.is_active = 1
      AND (c.next_review_at IS NULL OR c.next_review_at <= ?)
    ORDER BY
      CASE WHEN c.card_state = 'new' THEN 0 ELSE 1 END,
      c.next_review_at ASC NULLS FIRST
    LIMIT ?
  `).all(now, limit) as SRSCard[];
}

/**
 * Get total due card count
 */
export function getTotalDueCount(): number {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const result = db.prepare(`
    SELECT COUNT(*) as count FROM hyro_srs_cards c
    JOIN hyro_srs_decks d ON c.deck_id = d.id
    WHERE d.is_active = 1
      AND (c.next_review_at IS NULL OR c.next_review_at <= ?)
  `).get(now) as { count: number };

  return result.count;
}

// ============================================================================
// SM-2 Algorithm Implementation
// ============================================================================

/**
 * Calculate new interval and easiness factor based on SM-2 algorithm
 * @param quality - Rating from 0-5
 * @param easiness - Current easiness factor
 * @param interval - Current interval in days
 * @param repetitions - Number of successful reviews
 */
function calculateSM2(
  quality: number,
  easiness: number,
  interval: number,
  repetitions: number
): { newEasiness: number; newInterval: number; newRepetitions: number; newState: CardState } {
  // Ensure quality is in valid range
  quality = Math.max(0, Math.min(5, quality));

  // Calculate new easiness factor
  let newEasiness = easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEasiness = Math.max(SM2_MIN_EASINESS, newEasiness);

  let newInterval: number;
  let newRepetitions: number;
  let newState: CardState;

  if (quality < 3) {
    // Failed review - reset to beginning
    newRepetitions = 0;
    newInterval = 0;
    newState = 'learning';
  } else {
    // Successful review
    newRepetitions = repetitions + 1;

    if (newRepetitions === 1) {
      newInterval = 1;
      newState = 'learning';
    } else if (newRepetitions === 2) {
      newInterval = 3;
      newState = 'learning';
    } else if (newRepetitions === 3) {
      newInterval = 6;
      newState = 'review';
    } else {
      newInterval = Math.round(interval * newEasiness);
      newState = newInterval >= 21 ? 'graduated' : 'review';
    }
  }

  return { newEasiness, newInterval, newRepetitions, newState };
}

/**
 * Review a card and update its SRS parameters
 */
export function reviewCard(
  cardId: string,
  quality: number,
  responseTimeMs?: number
): ReviewResult {
  const db = getDatabase();
  const card = getCard(cardId);

  if (!card) {
    throw new Error(`Card not found: ${cardId}`);
  }

  const { newEasiness, newInterval, newRepetitions, newState } = calculateSM2(
    quality,
    card.easiness_factor,
    card.interval_days,
    card.repetitions
  );

  const now = Math.floor(Date.now() / 1000);
  const nextReviewAt = now + (newInterval * 86400); // Convert days to seconds

  // Calculate XP based on quality
  let xpEarned = 0;
  if (quality >= 3) {
    xpEarned = 5 + (quality - 3) * 3; // 5 XP for quality 3, 8 for 4, 11 for 5
    if (newState === 'graduated') {
      xpEarned += 10; // Bonus for mastering a card
    }
  }

  return db.transaction(() => {
    // Record review history
    db.prepare(`
      INSERT INTO hyro_srs_reviews (
        id, card_id, quality, response_time_ms,
        easiness_before, interval_before, easiness_after, interval_after, xp_earned
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      cardId,
      quality,
      responseTimeMs || null,
      card.easiness_factor,
      card.interval_days,
      newEasiness,
      newInterval,
      xpEarned
    );

    // Update card
    db.prepare(`
      UPDATE hyro_srs_cards
      SET
        easiness_factor = ?,
        interval_days = ?,
        repetitions = ?,
        next_review_at = ?,
        last_reviewed_at = ?,
        card_state = ?,
        updated_at = unixepoch()
      WHERE id = ?
    `).run(newEasiness, newInterval, newRepetitions, nextReviewAt, now, newState, cardId);

    // Award XP if earned
    if (xpEarned > 0) {
      awardXP(xpEarned, 'srs_review', cardId);
    }

    // Update deck counts
    updateDeckCounts(card.deck_id);

    // Update mastery count if card graduated
    if (newState === 'graduated' && card.card_state !== 'graduated') {
      db.prepare(`
        UPDATE hyro_character
        SET srs_mastery_count = srs_mastery_count + 1
        WHERE id = 'hyro'
      `).run();
    }

    return {
      card_id: cardId,
      quality,
      easiness_before: card.easiness_factor,
      interval_before: card.interval_days,
      easiness_after: newEasiness,
      interval_after: newInterval,
      next_review_at: nextReviewAt,
      xp_earned: xpEarned,
    };
  });
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Create multiple cards at once (for importing)
 */
export function createCards(
  deckId: string,
  cards: Array<{ front: string; back: string; tags?: string[] }>
): SRSCard[] {
  const db = getDatabase();

  return db.transaction(() => {
    const created: SRSCard[] = [];

    for (const card of cards) {
      const id = randomUUID();
      db.prepare(`
        INSERT INTO hyro_srs_cards (id, deck_id, front, back, tags)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, deckId, card.front, card.back, card.tags ? JSON.stringify(card.tags) : null);

      created.push(getCard(id)!);
    }

    updateDeckCounts(deckId);
    return created;
  });
}

/**
 * Get review session summary
 */
export function getReviewSessionSummary(sessionStartTime: number): {
  cards_reviewed: number;
  correct_count: number;
  incorrect_count: number;
  total_xp: number;
  average_quality: number;
} {
  const db = getDatabase();

  const summary = db.prepare(`
    SELECT
      COUNT(*) as cards_reviewed,
      SUM(CASE WHEN quality >= 3 THEN 1 ELSE 0 END) as correct_count,
      SUM(CASE WHEN quality < 3 THEN 1 ELSE 0 END) as incorrect_count,
      SUM(xp_earned) as total_xp,
      AVG(quality) as average_quality
    FROM hyro_srs_reviews
    WHERE reviewed_at >= ?
  `).get(sessionStartTime) as any;

  return {
    cards_reviewed: summary.cards_reviewed || 0,
    correct_count: summary.correct_count || 0,
    incorrect_count: summary.incorrect_count || 0,
    total_xp: summary.total_xp || 0,
    average_quality: summary.average_quality || 0,
  };
}
