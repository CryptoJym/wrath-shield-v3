// @ts-nocheck
/**
 * Tests for HYRO FORGE Spaced Repetition System (SRS)
 *
 * Tests for SM-2 algorithm implementation, deck management,
 * card operations, and review functionality.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock database
const mockDb = {
  prepare: jest.fn(() => ({
    run: jest.fn(() => ({ changes: 1 })),
    get: jest.fn(),
    all: jest.fn(() => []),
  })),
  transaction: jest.fn((fn) => fn),
};

jest.mock('../../../lib/db/Database', () => ({
  getDatabase: jest.fn(() => mockDb),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-123'),
}));

// Mock forge-xp
jest.mock('../../../lib/hyro/forge-xp', () => ({
  awardXP: jest.fn(),
}));

import {
  QUALITY_RATINGS,
  createDeck,
  getDeck,
  getAllDecks,
  getDeckStats,
  createCard,
  getCard,
  getDeckCards,
  getDueCards,
  getTotalDueCount,
  reviewCard,
  createCards,
  getReviewSessionSummary,
  type CardState,
  type CardType,
  type SRSDeck,
  type SRSCard,
  type ReviewResult,
  type DeckStats,
} from '../../../lib/hyro/forge-srs';

describe('HYRO FORGE: Spaced Repetition System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Type Tests
  // ==========================================================================

  describe('Types', () => {
    it('should define CardState type', () => {
      const states: CardState[] = ['new', 'learning', 'review', 'graduated'];
      expect(states).toHaveLength(4);
    });

    it('should define CardType type', () => {
      const types: CardType[] = ['basic', 'cloze', 'image'];
      expect(types).toHaveLength(3);
    });

    it('should define QUALITY_RATINGS constant', () => {
      expect(QUALITY_RATINGS).toBeDefined();
      expect(QUALITY_RATINGS[0]).toEqual({
        label: 'Blackout',
        description: 'Complete failure to recall',
      });
      expect(QUALITY_RATINGS[5]).toEqual({
        label: 'Perfect',
        description: 'Perfect response',
      });
    });

    it('should have all quality ratings from 0-5', () => {
      expect(Object.keys(QUALITY_RATINGS)).toHaveLength(6);
      for (let i = 0; i <= 5; i++) {
        expect(QUALITY_RATINGS[i]).toBeDefined();
        expect(QUALITY_RATINGS[i].label).toBeDefined();
        expect(QUALITY_RATINGS[i].description).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // SRSDeck Interface Tests
  // ==========================================================================

  describe('SRSDeck Interface', () => {
    it('should accept valid deck', () => {
      const deck: SRSDeck = {
        id: 'deck-123',
        title: 'Math Flashcards',
        description: 'Basic math concepts',
        subject: 'math',
        icon: '🧮',
        card_count: 50,
        due_count: 10,
        is_active: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      expect(deck.title).toBe('Math Flashcards');
      expect(deck.card_count).toBe(50);
    });

    it('should accept deck with null optional fields', () => {
      const deck: SRSDeck = {
        id: 'deck-minimal',
        title: 'Basic Deck',
        description: null,
        subject: null,
        icon: '📚',
        card_count: 0,
        due_count: 0,
        is_active: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      expect(deck.description).toBeNull();
      expect(deck.subject).toBeNull();
    });
  });

  // ==========================================================================
  // SRSCard Interface Tests
  // ==========================================================================

  describe('SRSCard Interface', () => {
    it('should accept valid card', () => {
      const card: SRSCard = {
        id: 'card-123',
        deck_id: 'deck-456',
        front: 'What is 2 + 2?',
        back: '4',
        card_type: 'basic',
        tags: JSON.stringify(['math', 'addition']),
        source_quest_id: null,
        source_assignment_id: null,
        easiness_factor: 2.5,
        interval_days: 7,
        repetitions: 5,
        next_review_at: Date.now() + 86400000 * 7,
        last_reviewed_at: Date.now(),
        card_state: 'review',
        created_at: Date.now() - 86400000 * 30,
        updated_at: Date.now(),
      };

      expect(card.front).toBe('What is 2 + 2?');
      expect(card.easiness_factor).toBe(2.5);
    });

    it('should accept new card state', () => {
      const card: SRSCard = {
        id: 'card-new',
        deck_id: 'deck-123',
        front: 'New question',
        back: 'New answer',
        card_type: 'basic',
        tags: null,
        source_quest_id: null,
        source_assignment_id: null,
        easiness_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: null,
        last_reviewed_at: null,
        card_state: 'new',
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      expect(card.card_state).toBe('new');
      expect(card.next_review_at).toBeNull();
    });

    it('should accept cloze card type', () => {
      const card: SRSCard = {
        id: 'card-cloze',
        deck_id: 'deck-123',
        front: 'The {{c1::capital}} of France is Paris',
        back: 'capital',
        card_type: 'cloze',
        tags: null,
        source_quest_id: null,
        source_assignment_id: null,
        easiness_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: null,
        last_reviewed_at: null,
        card_state: 'new',
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      expect(card.card_type).toBe('cloze');
    });

    it('should accept card with quest source', () => {
      const card: SRSCard = {
        id: 'card-quest',
        deck_id: 'deck-123',
        front: 'Quest related question',
        back: 'Answer',
        card_type: 'basic',
        tags: null,
        source_quest_id: 'quest-789',
        source_assignment_id: 'assignment-abc',
        easiness_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: null,
        last_reviewed_at: null,
        card_state: 'new',
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      expect(card.source_quest_id).toBe('quest-789');
      expect(card.source_assignment_id).toBe('assignment-abc');
    });
  });

  // ==========================================================================
  // ReviewResult Interface Tests
  // ==========================================================================

  describe('ReviewResult Interface', () => {
    it('should accept valid review result', () => {
      const result: ReviewResult = {
        card_id: 'card-123',
        quality: 4,
        easiness_before: 2.5,
        interval_before: 3,
        easiness_after: 2.6,
        interval_after: 8,
        next_review_at: Date.now() + 86400000 * 8,
        xp_earned: 8,
      };

      expect(result.quality).toBe(4);
      expect(result.xp_earned).toBe(8);
    });

    it('should accept review result with failed review', () => {
      const result: ReviewResult = {
        card_id: 'card-123',
        quality: 1,
        easiness_before: 2.5,
        interval_before: 7,
        easiness_after: 2.1,
        interval_after: 0,
        next_review_at: Date.now(),
        xp_earned: 0,
      };

      expect(result.quality).toBe(1);
      expect(result.xp_earned).toBe(0);
      expect(result.interval_after).toBe(0);
    });
  });

  // ==========================================================================
  // DeckStats Interface Tests
  // ==========================================================================

  describe('DeckStats Interface', () => {
    it('should accept valid deck stats', () => {
      const stats: DeckStats = {
        total_cards: 100,
        new_cards: 20,
        learning_cards: 15,
        review_cards: 45,
        graduated_cards: 20,
        due_today: 25,
        average_easiness: 2.5,
        mastery_percent: 20,
      };

      expect(stats.total_cards).toBe(100);
      expect(stats.mastery_percent).toBe(20);
    });

    it('should accept empty deck stats', () => {
      const stats: DeckStats = {
        total_cards: 0,
        new_cards: 0,
        learning_cards: 0,
        review_cards: 0,
        graduated_cards: 0,
        due_today: 0,
        average_easiness: 2.5,
        mastery_percent: 0,
      };

      expect(stats.total_cards).toBe(0);
      expect(stats.mastery_percent).toBe(0);
    });
  });

  // ==========================================================================
  // Deck Functions Tests
  // ==========================================================================

  describe('createDeck', () => {
    it('should create deck with required params', () => {
      const mockDeck: SRSDeck = {
        id: 'test-uuid-123',
        title: 'Test Deck',
        description: null,
        subject: null,
        icon: '📚',
        card_count: 0,
        due_count: 0,
        is_active: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => mockDeck),
        all: jest.fn(),
      });

      const deck = createDeck({ title: 'Test Deck' });

      expect(mockDb.prepare).toHaveBeenCalled();
      expect(deck.title).toBe('Test Deck');
    });

    it('should create deck with all params', () => {
      const mockDeck: SRSDeck = {
        id: 'test-uuid-123',
        title: 'Math Deck',
        description: 'Math flashcards',
        subject: 'math',
        icon: '🧮',
        card_count: 0,
        due_count: 0,
        is_active: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => mockDeck),
        all: jest.fn(),
      });

      const deck = createDeck({
        title: 'Math Deck',
        description: 'Math flashcards',
        subject: 'math',
        icon: '🧮',
      });

      expect(deck.title).toBe('Math Deck');
      expect(deck.description).toBe('Math flashcards');
    });
  });

  describe('getDeck', () => {
    it('should return deck when found', () => {
      const mockDeck: SRSDeck = {
        id: 'deck-123',
        title: 'Found Deck',
        description: null,
        subject: null,
        icon: '📚',
        card_count: 10,
        due_count: 3,
        is_active: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => mockDeck),
        all: jest.fn(),
      });

      const deck = getDeck('deck-123');

      expect(deck).toBeDefined();
      expect(deck?.id).toBe('deck-123');
    });

    it('should return null when deck not found', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => null),
        all: jest.fn(),
      });

      const deck = getDeck('nonexistent');

      expect(deck).toBeNull();
    });
  });

  describe('getAllDecks', () => {
    it('should return all active decks', () => {
      const mockDecks: SRSDeck[] = [
        {
          id: 'deck-1',
          title: 'Deck 1',
          description: null,
          subject: null,
          icon: '📚',
          card_count: 10,
          due_count: 3,
          is_active: 1,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
        {
          id: 'deck-2',
          title: 'Deck 2',
          description: null,
          subject: null,
          icon: '📖',
          card_count: 20,
          due_count: 5,
          is_active: 1,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ];

      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn(() => mockDecks),
      });

      const decks = getAllDecks();

      expect(decks).toHaveLength(2);
    });

    it('should return empty array when no decks', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn(() => []),
      });

      const decks = getAllDecks();

      expect(decks).toHaveLength(0);
    });
  });

  describe('getDeckStats', () => {
    it('should return deck statistics', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => ({
          total_cards: 100,
          new_cards: 20,
          learning_cards: 15,
          review_cards: 45,
          graduated_cards: 20,
          due_today: 25,
          average_easiness: 2.5,
        })),
        all: jest.fn(),
      });

      const stats = getDeckStats('deck-123');

      expect(stats.total_cards).toBe(100);
      expect(stats.mastery_percent).toBe(20);
    });

    it('should handle empty deck', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => ({
          total_cards: null,
          new_cards: null,
          learning_cards: null,
          review_cards: null,
          graduated_cards: null,
          due_today: null,
          average_easiness: null,
        })),
        all: jest.fn(),
      });

      const stats = getDeckStats('empty-deck');

      expect(stats.total_cards).toBe(0);
      expect(stats.mastery_percent).toBe(0);
    });
  });

  // ==========================================================================
  // Card Functions Tests
  // ==========================================================================

  describe('createCard', () => {
    it('should create card with required params', () => {
      const mockCard: SRSCard = {
        id: 'test-uuid-123',
        deck_id: 'deck-123',
        front: 'Question?',
        back: 'Answer',
        card_type: 'basic',
        tags: null,
        source_quest_id: null,
        source_assignment_id: null,
        easiness_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: null,
        last_reviewed_at: null,
        card_state: 'new',
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => mockCard),
        all: jest.fn(),
      });

      const card = createCard({
        deck_id: 'deck-123',
        front: 'Question?',
        back: 'Answer',
      });

      expect(card.front).toBe('Question?');
      expect(card.back).toBe('Answer');
    });
  });

  describe('getCard', () => {
    it('should return card when found', () => {
      const mockCard: SRSCard = {
        id: 'card-123',
        deck_id: 'deck-456',
        front: 'Q',
        back: 'A',
        card_type: 'basic',
        tags: null,
        source_quest_id: null,
        source_assignment_id: null,
        easiness_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: null,
        last_reviewed_at: null,
        card_state: 'new',
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => mockCard),
        all: jest.fn(),
      });

      const card = getCard('card-123');

      expect(card).toBeDefined();
      expect(card?.id).toBe('card-123');
    });

    it('should return null when card not found', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => null),
        all: jest.fn(),
      });

      const card = getCard('nonexistent');

      expect(card).toBeNull();
    });
  });

  describe('getDeckCards', () => {
    it('should return all cards in deck', () => {
      const mockCards: SRSCard[] = [
        {
          id: 'card-1',
          deck_id: 'deck-123',
          front: 'Q1',
          back: 'A1',
          card_type: 'basic',
          tags: null,
          source_quest_id: null,
          source_assignment_id: null,
          easiness_factor: 2.5,
          interval_days: 0,
          repetitions: 0,
          next_review_at: null,
          last_reviewed_at: null,
          card_state: 'new',
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ];

      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn(() => mockCards),
      });

      const cards = getDeckCards('deck-123');

      expect(cards).toHaveLength(1);
    });
  });

  describe('getDueCards', () => {
    it('should return due cards for deck', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn(() => []),
      });

      const cards = getDueCards('deck-123', 20);

      expect(mockDb.prepare).toHaveBeenCalled();
      expect(cards).toHaveLength(0);
    });

    it('should return due cards across all decks', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn(() => []),
      });

      const cards = getDueCards(undefined, 20);

      expect(mockDb.prepare).toHaveBeenCalled();
      expect(cards).toHaveLength(0);
    });
  });

  describe('getTotalDueCount', () => {
    it('should return total due count', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => ({ count: 15 })),
        all: jest.fn(),
      });

      const count = getTotalDueCount();

      expect(count).toBe(15);
    });
  });

  // ==========================================================================
  // Review Functions Tests
  // ==========================================================================

  describe('reviewCard', () => {
    it('should throw error if card not found', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => null),
        all: jest.fn(),
      });

      expect(() => reviewCard('nonexistent', 4)).toThrow('Card not found');
    });

    it('should update card on successful review', () => {
      const mockCard: SRSCard = {
        id: 'card-123',
        deck_id: 'deck-456',
        front: 'Q',
        back: 'A',
        card_type: 'basic',
        tags: null,
        source_quest_id: null,
        source_assignment_id: null,
        easiness_factor: 2.5,
        interval_days: 3,
        repetitions: 2,
        next_review_at: null,
        last_reviewed_at: null,
        card_state: 'learning',
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      const runMock = jest.fn();
      mockDb.prepare.mockReturnValue({
        run: runMock,
        get: jest.fn(() => mockCard),
        all: jest.fn(),
      });
      mockDb.transaction.mockImplementation((fn) => fn());

      const result = reviewCard('card-123', 4);

      expect(result.card_id).toBe('card-123');
      expect(result.quality).toBe(4);
      expect(result.easiness_before).toBe(2.5);
    });
  });

  describe('createCards', () => {
    it('should create multiple cards in batch', () => {
      const mockCard: SRSCard = {
        id: 'test-uuid-123',
        deck_id: 'deck-123',
        front: 'Q',
        back: 'A',
        card_type: 'basic',
        tags: null,
        source_quest_id: null,
        source_assignment_id: null,
        easiness_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: null,
        last_reviewed_at: null,
        card_state: 'new',
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => mockCard),
        all: jest.fn(),
      });
      mockDb.transaction.mockImplementation((fn) => fn());

      const cards = createCards('deck-123', [
        { front: 'Q1', back: 'A1' },
        { front: 'Q2', back: 'A2' },
      ]);

      expect(cards).toHaveLength(2);
    });
  });

  describe('getReviewSessionSummary', () => {
    it('should return session summary', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => ({
          cards_reviewed: 10,
          correct_count: 8,
          incorrect_count: 2,
          total_xp: 50,
          average_quality: 3.8,
        })),
        all: jest.fn(),
      });

      const summary = getReviewSessionSummary(Date.now() - 3600000);

      expect(summary.cards_reviewed).toBe(10);
      expect(summary.correct_count).toBe(8);
      expect(summary.total_xp).toBe(50);
    });

    it('should handle empty session', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => ({
          cards_reviewed: null,
          correct_count: null,
          incorrect_count: null,
          total_xp: null,
          average_quality: null,
        })),
        all: jest.fn(),
      });

      const summary = getReviewSessionSummary(Date.now());

      expect(summary.cards_reviewed).toBe(0);
      expect(summary.total_xp).toBe(0);
    });
  });

  // ==========================================================================
  // SM-2 Algorithm Tests
  // ==========================================================================

  describe('SM-2 Algorithm (via reviewCard)', () => {
    it('should reset on failed review (quality < 3)', () => {
      const mockCard: SRSCard = {
        id: 'card-fail',
        deck_id: 'deck-123',
        front: 'Q',
        back: 'A',
        card_type: 'basic',
        tags: null,
        source_quest_id: null,
        source_assignment_id: null,
        easiness_factor: 2.5,
        interval_days: 7,
        repetitions: 5,
        next_review_at: null,
        last_reviewed_at: null,
        card_state: 'review',
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => mockCard),
        all: jest.fn(),
      });
      mockDb.transaction.mockImplementation((fn) => fn());

      const result = reviewCard('card-fail', 2);

      expect(result.interval_after).toBe(0);
      expect(result.xp_earned).toBe(0);
    });

    it('should award XP on successful review', () => {
      const mockCard: SRSCard = {
        id: 'card-success',
        deck_id: 'deck-123',
        front: 'Q',
        back: 'A',
        card_type: 'basic',
        tags: null,
        source_quest_id: null,
        source_assignment_id: null,
        easiness_factor: 2.5,
        interval_days: 3,
        repetitions: 2,
        next_review_at: null,
        last_reviewed_at: null,
        card_state: 'learning',
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => mockCard),
        all: jest.fn(),
      });
      mockDb.transaction.mockImplementation((fn) => fn());

      const result = reviewCard('card-success', 5);

      expect(result.xp_earned).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle quality values at boundaries', () => {
      const mockCard: SRSCard = {
        id: 'card-edge',
        deck_id: 'deck-123',
        front: 'Q',
        back: 'A',
        card_type: 'basic',
        tags: null,
        source_quest_id: null,
        source_assignment_id: null,
        easiness_factor: 2.5,
        interval_days: 1,
        repetitions: 1,
        next_review_at: null,
        last_reviewed_at: null,
        card_state: 'learning',
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => mockCard),
        all: jest.fn(),
      });
      mockDb.transaction.mockImplementation((fn) => fn());

      // Test quality 0
      const result0 = reviewCard('card-edge', 0);
      expect(result0.quality).toBe(0);

      // Test quality 5
      const result5 = reviewCard('card-edge', 5);
      expect(result5.quality).toBe(5);
    });

    it('should enforce minimum easiness factor', () => {
      const mockCard: SRSCard = {
        id: 'card-min-ef',
        deck_id: 'deck-123',
        front: 'Q',
        back: 'A',
        card_type: 'basic',
        tags: null,
        source_quest_id: null,
        source_assignment_id: null,
        easiness_factor: 1.3, // Already at minimum
        interval_days: 1,
        repetitions: 1,
        next_review_at: null,
        last_reviewed_at: null,
        card_state: 'learning',
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => mockCard),
        all: jest.fn(),
      });
      mockDb.transaction.mockImplementation((fn) => fn());

      const result = reviewCard('card-min-ef', 0);

      expect(result.easiness_after).toBeGreaterThanOrEqual(1.3);
    });
  });
});
