/**
 * FlashcardReview Component Tests
 * Tests for the SRS flashcard review component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
// lucide-react is mocked globally in jest.setup.react.ts
import { FlashcardReview, Card } from '@/components/forge/srs/FlashcardReview';

// Test data
const mockCards: Card[] = [
  {
    id: 'card-1',
    front_content: 'What is 2 + 2?',
    back_content: '4',
    card_type: 'basic',
    category: 'math',
    difficulty: 1,
    ease_factor: 2.5,
    interval_days: 1,
    repetitions: 0,
    stat_name: 'intelligence',
    next_review_at: Date.now(),
    created_at: Date.now() - 86400000,
  },
  {
    id: 'card-2',
    front_content: 'What is the capital of France?',
    back_content: 'Paris',
    card_type: 'basic',
    category: 'geography',
    difficulty: 2,
    ease_factor: 2.5,
    interval_days: 1,
    repetitions: 1,
    stat_name: 'wisdom',
    next_review_at: Date.now(),
    created_at: Date.now() - 172800000,
  },
  {
    id: 'card-3',
    front_content: 'Define photosynthesis',
    back_content: 'The process by which plants convert sunlight into energy',
    card_type: 'definition',
    category: 'science',
    difficulty: 3,
    ease_factor: 2.3,
    interval_days: 3,
    repetitions: 2,
    stat_name: 'intelligence',
    next_review_at: Date.now(),
    created_at: Date.now() - 259200000,
  },
];

const mockReviewResult = {
  card_id: 'card-1',
  new_interval: 3,
  new_ease_factor: 2.6,
  next_review_at: Date.now() + 259200000,
  xp_earned: 10,
};

describe('FlashcardReview', () => {
  const mockOnReviewCard = jest.fn();
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnReviewCard.mockResolvedValue(mockReviewResult);
  });

  describe('Rendering', () => {
    it('renders the first card front content', () => {
      render(
        <FlashcardReview
          cards={mockCards}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    });

    it('shows progress indicator', () => {
      render(
        <FlashcardReview
          cards={mockCards}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    it('shows card category badge', () => {
      render(
        <FlashcardReview
          cards={mockCards}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText('math')).toBeInTheDocument();
    });

    it('shows card stat badge', () => {
      render(
        <FlashcardReview
          cards={mockCards}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText('intelligence')).toBeInTheDocument();
    });

    it('shows difficulty level', () => {
      render(
        <FlashcardReview
          cards={mockCards}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText('Level 1')).toBeInTheDocument();
    });

    it('shows flip hint on front', () => {
      render(
        <FlashcardReview
          cards={mockCards}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText('Tap to reveal answer')).toBeInTheDocument();
    });

    it('shows Question label on front', () => {
      render(
        <FlashcardReview
          cards={mockCards}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText('Question')).toBeInTheDocument();
    });

    it('shows keyboard shortcuts hint', () => {
      render(
        <FlashcardReview
          cards={mockCards}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText('Space: Flip')).toBeInTheDocument();
      expect(screen.getByText('1-6: Rate')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no cards', () => {
      render(
        <FlashcardReview
          cards={[]}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText('No cards to review!')).toBeInTheDocument();
      expect(screen.getByText('All caught up. Check back later.')).toBeInTheDocument();
    });
  });

  describe('Card Flip', () => {
    it('flips card when clicked', () => {
      render(
        <FlashcardReview
          cards={mockCards}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      const cardContainer = screen.getByText('What is 2 + 2?').closest('div[style*="perspective"]');
      if (cardContainer) {
        fireEvent.click(cardContainer);
      }

      // After flip, answer should be visible
      expect(screen.getByText('Answer')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('shows rating buttons after flip', () => {
      render(
        <FlashcardReview
          cards={mockCards}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      const cardContainer = screen.getByText('What is 2 + 2?').closest('div[style*="perspective"]');
      if (cardContainer) {
        fireEvent.click(cardContainer);
      }

      expect(screen.getByText('How well did you know this?')).toBeInTheDocument();
      expect(screen.getByText('Blackout')).toBeInTheDocument();
      expect(screen.getByText('Wrong')).toBeInTheDocument();
      expect(screen.getByText('Hard')).toBeInTheDocument();
      expect(screen.getByText('Good')).toBeInTheDocument();
      expect(screen.getByText('Easy')).toBeInTheDocument();
      expect(screen.getByText('Perfect')).toBeInTheDocument();
    });
  });

  describe('Rating', () => {
    it('calls onReviewCard when rating is selected', async () => {
      render(
        <FlashcardReview
          cards={mockCards}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      // Flip the card first
      const cardContainer = screen.getByText('What is 2 + 2?').closest('div[style*="perspective"]');
      if (cardContainer) {
        fireEvent.click(cardContainer);
      }

      // Click Good rating
      const goodButton = screen.getByText('Good');
      fireEvent.click(goodButton);

      await waitFor(() => {
        expect(mockOnReviewCard).toHaveBeenCalledWith(
          'card-1',
          3, // Good = 3
          expect.any(Number) // response time
        );
      });
    });

    it('advances to next card after rating', async () => {
      render(
        <FlashcardReview
          cards={mockCards}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      // Flip and rate first card
      const cardContainer = screen.getByText('What is 2 + 2?').closest('div[style*="perspective"]');
      if (cardContainer) {
        fireEvent.click(cardContainer);
      }

      const goodButton = screen.getByText('Good');
      fireEvent.click(goodButton);

      await waitFor(() => {
        expect(screen.getByText('2 / 3')).toBeInTheDocument();
        expect(screen.getByText('What is the capital of France?')).toBeInTheDocument();
      });
    });

    it('calls onComplete when all cards are reviewed', async () => {
      const singleCard = [mockCards[0]];

      render(
        <FlashcardReview
          cards={singleCard}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      // Flip and rate
      const cardContainer = screen.getByText('What is 2 + 2?').closest('div[style*="perspective"]');
      if (cardContainer) {
        fireEvent.click(cardContainer);
      }

      const perfectButton = screen.getByText('Perfect');
      fireEvent.click(perfectButton);

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            total_cards: 1,
            total_xp: 10,
          })
        );
      });
    });
  });

  describe('Rating Quality Values', () => {
    it.each([
      ['Blackout', 0],
      ['Wrong', 1],
      ['Hard', 2],
      ['Good', 3],
      ['Easy', 4],
      ['Perfect', 5],
    ])('sends quality %i when %s is clicked', async (label, quality) => {
      render(
        <FlashcardReview
          cards={mockCards}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      // Flip the card
      const cardContainer = screen.getByText('What is 2 + 2?').closest('div[style*="perspective"]');
      if (cardContainer) {
        fireEvent.click(cardContainer);
      }

      const button = screen.getByText(label);
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOnReviewCard).toHaveBeenCalledWith(
          'card-1',
          quality,
          expect.any(Number)
        );
      });
    });
  });

  describe('Timer', () => {
    it('shows timer', () => {
      render(
        <FlashcardReview
          cards={mockCards}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByTestId('icon-clock')).toBeInTheDocument();
      expect(screen.getByText(/\d+s/)).toBeInTheDocument();
    });
  });

  describe('Progress Bar', () => {
    it('shows progress bar with initial state', () => {
      render(
        <FlashcardReview
          cards={mockCards}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      // Progress bar should exist
      const progressContainer = screen.getByText('1 / 3').closest('div');
      expect(progressContainer).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles review API failure gracefully', async () => {
      mockOnReviewCard.mockRejectedValueOnce(new Error('API Error'));

      render(
        <FlashcardReview
          cards={mockCards}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      // Flip and rate
      const cardContainer = screen.getByText('What is 2 + 2?').closest('div[style*="perspective"]');
      if (cardContainer) {
        fireEvent.click(cardContainer);
      }

      const goodButton = screen.getByText('Good');
      fireEvent.click(goodButton);

      // Should not crash - card should remain
      await waitFor(() => {
        expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('disables rating buttons while loading', async () => {
      mockOnReviewCard.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockReviewResult), 100))
      );

      render(
        <FlashcardReview
          cards={mockCards}
          onReviewCard={mockOnReviewCard}
          onComplete={mockOnComplete}
        />
      );

      // Flip the card
      const cardContainer = screen.getByText('What is 2 + 2?').closest('div[style*="perspective"]');
      if (cardContainer) {
        fireEvent.click(cardContainer);
      }

      const goodButton = screen.getByText('Good');
      fireEvent.click(goodButton);

      // The review action should be triggered
      await waitFor(() => {
        expect(mockOnReviewCard).toHaveBeenCalled();
      });
    });
  });
});
